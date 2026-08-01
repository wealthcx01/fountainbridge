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
export type DocumentKind = 'text' | 'pdf' | 'unsupported';

const TEXT = /\.(md|markdown|txt|csv|tsv|json|ya?ml|log)$/i;
const PDF = /\.pdf$/i;

/**
 * Known-but-unsupported formats, named individually.
 *
 * A refusal that names the format — "a Word document" — reads as a decision. A refusal that says
 * "unsupported file type" reads as a shrug, and a founder cannot tell whether it is coming later or
 * never.
 */
const NAMED: Array<[RegExp, string]> = [
  [/\.(docx?|odt|rtf)$/i, 'a Word document'],
  [/\.(xlsx?|ods)$/i, 'a spreadsheet'],
  [/\.(pptx?|odp|key)$/i, 'a slide deck'],
  [/\.(png|jpe?g|gif|webp|heic)$/i, 'an image'],
  [/\.(zip|tar|gz|7z|rar)$/i, 'an archive'],
];

export function documentKind(filename: string): DocumentKind {
  if (TEXT.test(filename)) return 'text';
  if (PDF.test(filename)) return 'pdf';
  return 'unsupported';
}

/** Why this file was not taken, in a sentence a founder can act on. Null when it can be read. */
export function refusalFor(filename: string): string | null {
  if (documentKind(filename) !== 'unsupported') return null;
  const named = NAMED.find(([pattern]) => pattern.test(filename))?.[1];
  return named
    ? `“${filename}” is ${named}, and the studio can only read text documents and PDFs so far. `
      + 'Export it as a PDF and try again, or paste the part that matters.'
    : `The studio does not know how to read “${filename}”. It can read text documents and PDFs — `
      + 'export it as one of those, or paste the part that matters.';
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

/** What a founder is told when a document had nothing readable in it. */
export function emptyRefusal(name: string): string {
  return `“${name}” has no readable text in it — it is most likely a scan or photographs of pages `
    + 'rather than a document. Nothing was saved, because saving an empty file under that name would '
    + 'teach your venture that the document is blank. A version with selectable text would work.';
}

/**
 * The largest document the studio will carry, in bytes.
 *
 * Bounded because the bytes pass through the studio's memory. Generous enough for a real market
 * report; small enough that a founder cannot take the studio down by attaching a video.
 */
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

export function tooLargeRefusal(name: string, bytes: number): string {
  return `“${name}” is ${Math.round(bytes / 1024 / 1024)}MB, and the studio takes documents up to `
    + `${MAX_DOCUMENT_BYTES / 1024 / 1024}MB. Split it, or send the part that matters.`;
}
