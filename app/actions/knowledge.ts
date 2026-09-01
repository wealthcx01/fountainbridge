'use server';

/**
 * Handing the venture a document, from the studio (FB-106).
 *
 * Until now the only way in was mid-conversation with the composer, which means a founder with a
 * price list to hand over had to start a conversation about it first. This is the same destination
 * by the same route: a file in the venture's `context/` on git, proposed as a piece of work a human
 * merges. It writes NOTHING directly to the default branch.
 *
 * The gate is unchanged and deliberately so. `STUDIO_APPROVAL_GITHUB_TOKEN` is the studio's one
 * write credential, already used by `acceptWork`; the deposit lands as a proposal, and the same
 * human review that governs every other change governs this one. A second, ungated way to write to a
 * venture repo is exactly what CLAUDE.md #4 exists to prevent.
 */

import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { GitHubClient, GitHubError } from '@/lib/github';
import { approvalRepos } from '@/lib/venture-repos';
import { MAX_DOCUMENT_BYTES, looksEmpty, readDocumentText, refusalFor, tooLargeRefusal } from '@/lib/documents';
import { scanForSecrets, secretRefusal } from '@/lib/secrets';

export interface DepositResult {
  ok: boolean;
  message: string;
  /** Where the proposal can be read, when one was opened. */
  url?: string;
}

/** Lowercase-kebab, bounded — this becomes a path, so it is built here and never taken from input. */
const slugify = (name: string) =>
  name
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'document';

export async function depositDocument(ventureId: string, form: FormData): Promise<DepositResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, message: 'You need to sign in.' };

  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === ventureId);
  if (!venture || !canAccessVenture(access, ventureId)) {
    return { ok: false, message: 'You do not have access to this venture.' };
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose a file to hand over.' };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, message: tooLargeRefusal(file.name, file.size) };
  }

  // The same refusal and the same reader the composer uses, so what the studio accepts here and what
  // it accepts mid-conversation cannot drift apart — yes on one screen and no on the other is the
  // worse failure, and it is the one FB-106 names.
  const refusal = refusalFor(file.name);
  if (refusal) return { ok: false, message: refusal };

  let text: string;
  try {
    ({ text } = await readDocumentText(file));
  } catch {
    return {
      ok: false,
      message: `“${file.name}” could not be opened. If it is password-protected, save an unlocked copy and try again. Nothing was saved.`,
    };
  }
  // FB-140: a credential must never reach the venture's records.
  //
  // The composer's deposit tool has scanned every deposit since it was written — this door did not
  // scan at all. Two ways into one place and one of them guarded, on a control the studio itself
  // offers a founder. Anything handed over becomes permanent git history, so there is no taking it
  // back out afterwards (CLAUDE.md #8).
  //
  // BEFORE the write, and before the emptiness check below: a file that is nothing BUT a key has
  // little readable prose in it, and "there was no readable text" is a true sentence that tells a
  // founder the wrong thing about the most important refusal the studio makes.
  const secret = scanForSecrets(text);
  if (secret) return { ok: false, message: secretRefusal(file.name, secret) };

  // A scan has no text layer, and depositing it empty would teach the venture that a 60-page report
  // is blank.
  if (looksEmpty(text)) {
    return { ok: false, message: `“${file.name}” had no readable text in it. Nothing was saved.` };
  }


  const writeToken = process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
  if (!writeToken) {
    return { ok: false, message: 'This studio is not set up to save documents yet — an admin needs to finish setting it up.' };
  }

  const repo = approvalRepos(venture)[0];
  if (!repo) return { ok: false, message: 'This venture has nowhere to keep documents yet.' };

  const org = process.env.GITHUB_ORG ?? 'wealthcx01';
  const full = repo.includes('/') ? repo : `${org}/${repo}`;
  const slug = slugify(file.name);
  const path = `context/general/${slug}.md`;
  const branch = `foundry/knowledge-${slug}`;
  const client = new GitHubClient({ token: writeToken });

  try {
    const info = await client.request<{ default_branch: string }>(`/repos/${full}`);
    const base = info.default_branch;

    // Create the branch only if it is missing — a re-upload of the same document updates it rather
    // than failing, which is the same idempotency the composer's deposit path has.
    let head: string | null = null;
    try {
      const ref = await client.request<{ object: { sha: string } }>(`/repos/${full}/git/ref/heads/${branch}`);
      head = ref.object.sha;
    } catch {
      const baseRef = await client.request<{ object: { sha: string } }>(`/repos/${full}/git/ref/heads/${base}`);
      await client.request(`/repos/${full}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
      });
    }

    let sha: string | undefined;
    if (head) {
      try {
        const existing = await client.request<{ sha: string }>(`/repos/${full}/contents/${path}?ref=${branch}`);
        sha = existing.sha;
      } catch {
        // Not there yet on this branch; a create rather than an update.
      }
    }

    // The document, with the founder's own title on it and a note of where it came from — a corpus
    // entry whose provenance is guessable from its content is a corpus entry nobody trusts later.
    const body = `# ${file.name.replace(/\.[a-z0-9]+$/i, '')}\n\n`
      + `_Handed to the venture by ${email} from the studio._\n\n${text}\n`;
    await client.request(`/repos/${full}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `knowledge: ${file.name}`,
        content: Buffer.from(body, 'utf8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    const open = await client.request<Array<{ html_url: string }>>(
      `/repos/${full}/pulls?state=open&head=${encodeURIComponent(`${org}:${branch}`)}`,
    );
    if (Array.isArray(open) && open.length) {
      return { ok: true, message: 'Saved and updated. It is waiting for your OK.', url: open[0].html_url };
    }
    const pr = await client.request<{ html_url: string }>(`/repos/${full}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title: `Add to what your venture knows: ${file.name}`,
        head: branch,
        base,
        body: `Handed over from the studio by ${email}. Nothing is used until this is accepted.`,
      }),
    });
    return { ok: true, message: 'Saved. It is waiting for your OK before your team uses it.', url: pr.html_url };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 403) {
      return { ok: false, message: 'The studio is not allowed to write to this venture’s records. An admin needs to widen its access.' };
    }
    return { ok: false, message: 'Something went wrong saving that. Nothing was saved — try again.' };
  }
}
