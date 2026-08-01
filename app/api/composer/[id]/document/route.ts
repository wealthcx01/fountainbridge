import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import {
  describeExtraction, documentKind, emptyRefusal, looksEmpty, officeParts, refusalFor, slideNumber,
  textFromOfficeXml, tooLargeRefusal, MAX_DOCUMENT_BYTES,
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
    const kind = documentKind(file.name);
    if (kind === 'office') {
      // FB-084: .docx / .pptx / .xlsx are ZIP archives of XML. One tiny dependency, no service.
      const { unzipSync, strFromU8 } = await import('fflate');
      const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const { match, ordered } = officeParts(file.name);
      let names = Object.keys(zip).filter(match);
      // A ZIP's entry order is not a deck's order: slide10 can precede slide2. Reading a deck out of
      // sequence would hand the venture a market story with its argument shuffled.
      if (ordered) names = names.sort((a, b) => slideNumber(a) - slideNumber(b));
      const parts = names.map((n) => textFromOfficeXml(strFromU8(zip[n]))).filter(Boolean);
      // Slide boundaries survive, so a deck still reads as a deck.
      text = ordered ? parts.map((t, i) => `## Slide ${i + 1}\n\n${t}`).join('\n\n') : parts.join('\n\n');
      pages = ordered ? parts.length : undefined;
    } else if (kind === 'pdf') {
      // Imported here rather than at module scope: it is a large dependency, and every other route
      // in the studio would otherwise pay to load it.
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const extracted = await extractText(pdf, { mergePages: true });
      text = String(extracted.text ?? '');
      pages = extracted.totalPages;
    } else {
      text = await file.text();
    }
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
