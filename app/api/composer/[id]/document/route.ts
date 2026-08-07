import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import {
  describeExtraction, emptyRefusal, looksEmpty, readDocumentText, refusalFor,
  tooLargeRefusal, MAX_DOCUMENT_BYTES,
} from '@/lib/documents';

/**
 * Turning a document into text the venture can know (FB-078).
 *
 * ## Where this runs, and the compromise in that
 *
 * The extraction happens **here, on the studio**, not on the venture's box — and FB-078 asked for
 * the opposite, so the difference is stated rather than buried.
 *
 * The ticket's reasoning was that every byte should stay on the venture's own machine (D1). That is
 * the better answer and it needs a new endpoint on the box plus a credential the studio would have
 * to hold, and it is not what shipped today. What shipped keeps the weaker promise it can actually
 * make: **the bytes pass through this process's memory and are never written to its disk.** The
 * extracted text goes to the venture's own repository, through the composer's existing deposit tool,
 * which is where it belongs.
 *
 * That is a real difference and the ticket records it as unfinished rather than as done.
 *
 * ## Why the studio extracts rather than the model
 *
 * The Agents API has no upload — uploads are a JWT-only route on LibreChat's own surface, and the
 * studio deliberately holds no JWT secret for the box, because holding one would let it impersonate
 * any founder on that machine. So a document has to become text somewhere before the conversation
 * can carry it, and the only place with both the bytes and no new credential is here.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'You need to sign in.' }, { status: 401 });

  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  if (!ventures.some((v) => v.id === id) || !canAccessVenture(access, id)) {
    return NextResponse.json({ error: 'You do not have access to this venture.' }, { status: 403 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const candidate = form.get('document');
    if (candidate instanceof File) file = candidate;
  } catch {
    return NextResponse.json({ error: 'That upload could not be read.' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'No document was attached.' }, { status: 400 });

  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: tooLargeRefusal(file.name, file.size) }, { status: 413 });
  }

  const refusal = refusalFor(file.name);
  if (refusal) return NextResponse.json({ error: refusal }, { status: 415 });

  let text: string;
  let pages: number | undefined;
  try {
    // One reader, shared with the studio's own upload (FB-106): two copies of "what the studio can
    // read" would be a founder told yes on one screen and no on the other.
    ({ text, pages } = await readDocumentText(file));
  } catch (err) {
    // A malformed or encrypted PDF. Said plainly rather than as a stack trace, and never as success.
    console.error('[document] extraction failed', { name: file.name, err });
    return NextResponse.json(
      { error: `“${file.name}” could not be opened. If it is password-protected, save an unlocked copy and try again.` },
      { status: 422 },
    );
  }

  // The refusal that matters most: a scan has no text layer, and depositing it empty would teach the
  // venture that a 60-page report is blank.
  if (looksEmpty(text)) {
    // The text is passed so the refusal can tell "nothing at all" (a scan) from "very little"
    // (a short document that came through) rather than guessing at the cause.
    return NextResponse.json({ error: emptyRefusal(file.name, text) }, { status: 422 });
  }

  return NextResponse.json({
    name: file.name,
    text,
    understood: describeExtraction({ name: file.name, text, pages }),
  });
}
