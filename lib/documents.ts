/**
 * Turning a founder's document into something the venture can know (FB-078).
 *
 * ## The problem
 *
 * The things a founder actually has are a deck, a market report, a competitor spreadsheet, a PDF of
 * someone else's research. FB-065 gave the studio composer a file button that accepted **text only**
 * and refused everything else with an honest note pointing at LibreChat's own screen — the screen
 * FB-065 had just moved founders off. That was the right call for one ticket and a poor resting
 * place: the corpus the whole system reasons from could only be built out of things a founder typed.
 *
 * ## What is decided here, and what is not
 *
 * This module decides what a document IS and whether it can be read. It does no I/O, so the rules
 * are testable on their own — and the rule that matters most is the refusal: **a document that
 * cannot be read must never be deposited empty.** A scanned PDF with no text layer extracts to
 * nothing, and silently filing an empty file under `context/` would teach the venture brain that a
 * 60-page market report contains no information.
 */

/** What a founder handed over, from the studio's point of view. */
export type DocumentKind = 'text' | 'pdf' | 'office' | 'unsupported';

const TEXT = /\.(md|markdown|txt|csv|tsv|json|ya?ml|log)$/i;
const PDF = /\.pdf$/i;
/**
 * The formats founders actually hand over after PDF (FB-084).
 *
 * All three are ZIP archives of XML, which is why they can be read here with one tiny dependency and
 * no service: the words live in `word/document.xml`, `ppt/slides/slideN.xml`, and
 * `xl/sharedStrings.xml`. The older binary `.doc`/`.ppt`/`.xls` are NOT these and are deliberately
 * excluded — they are a different, far uglier format, and claiming to read one and returning nothing
 * would be worse than refusing it.
 */
const OFFICE = /\.(docx|pptx|xlsx)$/i;

/**
 * Known-but-unsupported formats, named individually.
 *
 * A refusal that names the format — "a Word document" — reads as a decision. A refusal that says
 * "unsupported file type" reads as a shrug, and a founder cannot tell whether it is coming later or
 * never.
 */
const NAMED: Array<[RegExp, string]> = [
  // The OLD binary formats and the OpenDocument ones. `.docx`/`.pptx`/`.xlsx` are read (FB-084);
  // these are a different format and are refused rather than silently returning nothing.
  [/\.(doc|odt|rtf|pages)$/i, 'an older Word document'],
  [/\.(xls|ods|numbers)$/i, 'an older spreadsheet'],
  [/\.(ppt|odp|key)$/i, 'an older slide deck'],
  [/\.(mp4|mov|avi|mkv|webm|m4v)$/i, 'a video'],
  [/\.(mp3|wav|m4a|aac|flac|ogg)$/i, 'an audio recording'],
  [/\.(png|jpe?g|gif|webp|heic)$/i, 'an image'],
  [/\.(zip|tar|gz|7z|rar)$/i, 'an archive'],
];

export function documentKind(filename: string): DocumentKind {
  if (TEXT.test(filename)) return 'text';
  if (PDF.test(filename)) return 'pdf';
  if (OFFICE.test(filename)) return 'office';
  return 'unsupported';
}

/** Which parts of an office archive hold the words, in the order a reader would meet them. */
export function officeParts(filename: string): { match: (path: string) => boolean; ordered: boolean } {
  if (/\.docx$/i.test(filename)) return { match: (p) => p === 'word/document.xml', ordered: false };
  if (/\.pptx$/i.test(filename)) {
    // Slides are `slide1.xml`, `slide2.xml`… and a ZIP's order is not the deck's order.
    return { match: (p) => /^ppt\/slides\/slide\d+\.xml$/.test(p), ordered: true };
  }
  return {
    // A spreadsheet's words are in the shared string table; the sheets hold references to it.
    match: (p) => p === 'xl/sharedStrings.xml',
    ordered: false,
  };
}

/** The slide number in `ppt/slides/slide12.xml`, for putting a deck back in its own order. */
export const slideNumber = (path: string): number => Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);

/**
 * The readable text inside one office XML part.
 *
 * Office XML wraps every run of text in `<a:t>` (slides) or `<w:t>` (documents). Stripping all tags
 * indiscriminately welds words together — `<w:t>Market</w:t><w:t>Movers</w:t>` becomes
 * `MarketMovers` — so the runs are extracted and joined with a space instead.
 */
export function textFromOfficeXml(xml: string): string {
  const runs = [...xml.matchAll(/<(?:[aw]:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[aw]:)?t>/g)].map((m) => m[1]);
  const joined = runs.join(' ');
  return joined
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Why this file was not taken, in a sentence a founder can act on. Null when it can be read. */
export function refusalFor(filename: string): string | null {
  if (documentKind(filename) !== 'unsupported') return null;
  const named = NAMED.find(([pattern]) => pattern.test(filename))?.[1];
  // Video and audio are their own answer: "export it as a PDF" is nonsense advice for a recording,
  // and a founder told that learns the studio is not listening. The studio cannot transcribe yet —
  // there is no ffmpeg and no transcription model on a venture box (FB-084) — and says so.
  if (/\.(mp4|mov|avi|mkv|webm|m4v|mp3|wav|m4a|aac|flac|ogg)$/i.test(filename)) {
    return `The studio cannot listen to “${filename}” yet — it has no way to turn a recording into `
      + 'words. If you have a transcript or notes, those it can read.';
  }
  return named
    ? `“${filename}” is ${named}, and the studio reads text documents, PDFs, and Word, PowerPoint `
      + 'and Excel files saved in the modern format. Re-save it as one of those, or export a PDF.'
    : `The studio does not know how to read “${filename}”. It reads text documents, PDFs, and Word, `
      + 'PowerPoint and Excel files — export it as one of those, or paste the part that matters.';
}

/**
 * Does this extraction actually contain anything?
 *
 * The case this exists for is a **scanned PDF**: pages of images with no text layer, which extract
 * to a handful of stray characters or to nothing at all. Depositing that would put an empty file in
 * the venture's knowledge under a confident name, and the brain would then answer questions about a
 * market report by finding nothing in it.
 *
 * The threshold is deliberately generous — a one-page note is legitimate — and it is about
 * *characters of actual words*, not bytes, because a PDF with no text layer often still yields
 * whitespace and page numbers.
 */
export function looksEmpty(text: string): boolean {
  const words = text.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1);
  return words.length < 20;
}

export interface Extraction {
  name: string;
  text: string;
  /** Pages, when the format has them. */
  pages?: number;
}

/**
 * What the studio says it understood.
 *
 * The ticket asks for this explicitly, and the reason is worth keeping: a silent "saved" on a
 * 60-page report is indistinguishable from a failed extraction. Saying the size back is how a
 * founder catches the studio having read one page of sixty.
 */
export function describeExtraction(e: Extraction): string {
  const words = e.text.split(/\s+/).filter(Boolean).length;
  const rounded = words >= 1000 ? `${Math.round(words / 100) / 10} thousand` : `${words}`;
  const pages = e.pages ? `${e.pages} page${e.pages === 1 ? '' : 's'}, ` : '';
  return `I read ${e.name} — ${pages}about ${rounded} words.`;
}

/**
 * What a founder is told when a document had (almost) nothing readable in it.
 *
 * The cause is NOT assumed. The first version said "it is most likely a scan or photographs of
 * pages" for everything under the threshold — and a `.docx` that extracted perfectly but happened to
 * contain thirteen words got told it was a photograph. Being confidently wrong about the cause is
 * how a founder starts distrusting the parts that are right: they can see the document is not a scan,
 * so what else is the studio guessing at?
 *
 * Nothing at all is a scan. A little is a short document, and worth saying differently.
 */
export function emptyRefusal(name: string, text = ''): string {
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words === 0) {
    return `“${name}” has no readable text in it — most likely a scan or photographs of pages rather `
      + 'than a document. Nothing was saved, because saving an empty file under that name would teach '
      + 'your venture that the document is blank. A version with selectable text would work.';
  }
  return `“${name}” only has ${words} words of readable text in it. Nothing was saved, because that `
    + 'is usually a sign the document did not come through properly rather than that it is genuinely '
    + 'that short. If it really is that short, paste it into the chat instead.';
}

/**
 * The largest document the studio will carry, in bytes.
 *
 * Bounded because the bytes pass through the studio's memory. Generous enough for a real market
 * report; small enough that a founder cannot take the studio down by attaching a video.
 */
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

/**
 * What the studio accepts, said once (FB-106).
 *
 * The rules existed only inside the refusals, so a founder learned them by being turned away. Stated
 * at the point of upload now — and built from `MAX_DOCUMENT_BYTES` itself, so the sentence cannot
 * promise a limit the code does not enforce.
 */
export const ACCEPTED_DESCRIPTION =
  `Text, Markdown, PDF, Word, PowerPoint and Excel files, up to ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB.`;

export function tooLargeRefusal(name: string, bytes: number): string {
  return `“${name}” is ${Math.round(bytes / 1024 / 1024)}MB, and the studio takes documents up to `
    + `${MAX_DOCUMENT_BYTES / 1024 / 1024}MB. Split it, or send the part that matters.`;
}

/**
 * Read a document's text — the ONE reader (FB-106).
 *
 * It lived inline in the composer's upload route until the studio grew a second way to hand a
 * document over. Two copies of "what the studio can read" would be a founder told yes on one screen
 * and no on the other, which is precisely the drift FB-106 forbids at the point of upload.
 *
 * Throws for a document it cannot open; the caller decides how to say so, because the composer and
 * the knowledge view apologise in different places.
 */
export async function readDocumentText(file: File): Promise<{ text: string; pages?: number }> {
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
    const text = ordered ? parts.map((t, i) => `## Slide ${i + 1}\n\n${t}`).join('\n\n') : parts.join('\n\n');
    return ordered ? { text, pages: parts.length } : { text };
  }
  if (kind === 'pdf') {
    // Imported here rather than at module scope: it is a large dependency, and every other route in
    // the studio would otherwise pay to load it.
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const extracted = await extractText(pdf, { mergePages: true });
    return { text: String(extracted.text ?? ''), pages: extracted.totalPages };
  }
  return { text: await file.text() };
}
