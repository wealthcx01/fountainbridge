import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { VentureSummary } from './ventures';
import { approvalRepos } from './venture-repos';
import { checkedPreview } from './preview-check';
import { pressRecordFile, pressesFor } from './press-record';
import { isPictureName, reviewFor, stateAfter, type PictureName, type ReviewCardFile, type ReviewView } from './review';

/**
 * Where the Review screen's cards come from (FB-274).
 *
 * Until the card store lands (FB-275) there is one source: the test rig's files, named by
 * `REVIEW_FIXTURE_DIR` and read only when `E2E_TEST_LOGIN=1`, like every other fixture switch here.
 * Outside the rig there are no cards yet, so every Review address answers "That work isn't here".
 * FB-275 adds the store as a second source behind this same interface.
 */
export interface CardSource {
  get(repo: string, number: number): ReviewCardFile | null;
  /** The numbers of every card in one of the venture's places, lowest first. */
  numbers(repo: string): number[];
}

export function cardSource(env: Record<string, string | undefined> = process.env): CardSource | null {
  const dir = env.REVIEW_FIXTURE_DIR;
  if (!dir || env.E2E_TEST_LOGIN !== '1') return null;
  return {
    get(repo, number) {
      try {
        return JSON.parse(readFileSync(join(dir, repo, `${number}.json`), 'utf8')) as ReviewCardFile;
      } catch {
        return null;
      }
    },
    numbers(repo) {
      try {
        return readdirSync(join(dir, repo))
          .map((f) => /^(\d+)\.json$/.exec(f)?.[1])
          .filter((n): n is string => Boolean(n))
          .map(Number)
          .sort((a, b) => a - b);
      } catch {
        return [];
      }
    },
  };
}

/**
 * One card of this venture's, or null.
 *
 * Null both when there is no such card and when it belongs to another venture: the repository must
 * be one of this venture's own (CLAUDE.md #6), so a card that is not yours gets the same answer as
 * one that does not exist.
 */
export function cardOf(venture: VentureSummary, repo: string, number: number, source: CardSource | null): ReviewCardFile | null {
  if (!source || !Number.isInteger(number) || number <= 0) return null;
  if (!approvalRepos(venture).includes(repo)) return null;
  return source.get(repo, number);
}

/** Who pressed, in the words this viewer reads. */
function namer(viewerEmail: string, admins: string[], venture: VentureSummary) {
  return (email: string) => {
    const e = email.toLowerCase();
    if (e === viewerEmail.toLowerCase()) return 'you';
    if (admins.includes(e)) return 'John';
    if (venture.founderEmail && e === venture.founderEmail.toLowerCase()) return venture.founderName ?? 'the founder';
    return email;
  };
}

/** Everything the Review screen shows for one card, for one viewer. Null when it is not theirs to see. */
export async function loadReview(
  venture: VentureSummary,
  repo: string,
  number: number,
  viewer: { email: string; isJohn: boolean; admins: string[] },
  source: CardSource | null = cardSource(),
  env: Record<string, string | undefined> = process.env,
): Promise<ReviewView | null> {
  const card = cardOf(venture, repo, number, source);
  if (!card || !source) return null;

  const file = pressRecordFile(env);
  const state = stateAfter(file ? pressesFor(file, repo, number) : [], namer(viewer.email, viewer.admins, venture));

  // "1 of 6 pieces of finished work": every card of the venture's still waiting on someone.
  const waiting = approvalRepos(venture).flatMap((r) =>
    source.numbers(r)
      .filter((n) => {
        if (r === repo && n === number) return true;
        const s = stateAfter(file ? pressesFor(file, r, n) : []);
        return s.kind === 'finished' || s.kind === 'signed-off';
      })
      .map((n) => ({ repo: r, number: n })),
  );
  const index = waiting.findIndex((w) => w.repo === repo && w.number === number);
  const next = waiting[index + 1] ?? (index > 0 ? waiting[0] : null);

  // Opened before it is drawn as a link (FB-184), the same as on the work page.
  const preview = card.previewUrl ? await checkedPreview(card.previewUrl, env) : null;

  return reviewFor(card, {
    ventureId: venture.id,
    ventureName: venture.name,
    repo,
    number,
    preview,
    state,
    place: {
      index: index + 1,
      of: waiting.length,
      next: next ? `/venture/${venture.id}/review/${next.repo}/${next.number}` : null,
    },
    viewer: { isJohn: viewer.isJohn },
  });
}

/**
 * A test picture, drawn from the card's own words (FB-274).
 *
 * The real pictures are taken by the planning box (cowgate CG-0065) and kept in the studio's
 * database (FB-275), never in git, because this repository is public. The rig has neither, so it
 * draws a plain stand-in of the right size: a light page with the venture's name, which picture it
 * is, and its size. Nothing in it is a real screen.
 */
export function testPicture(card: ReviewCardFile, name: PictureName, ventureName: string): string | null {
  if (!isPictureName(name)) return null;
  const size = card.pictures[name];
  if (!size) return null;
  const { width: w, height: h } = size;
  const phone = name.endsWith('phone');
  const after = name.startsWith('after');
  const pad = phone ? 24 : 48;
  // A phone's width holds about 24 letters of the title a line; two lines at most.
  const title = phone && card.title.length > 24
    ? [card.title.slice(0, card.title.lastIndexOf(' ', 24)), card.title.slice(card.title.lastIndexOf(' ', 24) + 1)]
    : [card.title];
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  const rows = Array.from({ length: phone ? 6 : 5 }, (_, i) => {
    const y = (phone ? 220 : 240) + i * (phone ? 92 : 120);
    return `<rect x="${pad}" y="${y}" width="${w - pad * 2}" height="${phone ? 76 : 96}" fill="#f4f1ec" stroke="#e4ded4"/>` +
      `<rect x="${pad + 16}" y="${y + 16}" width="${phone ? 44 : 60}" height="${phone ? 44 : 64}" fill="#e4ded4"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#ffffff"/>` +
    `<rect width="${w}" height="${phone ? 56 : 64}" fill="#f4f1ec"/>` +
    `<text x="${pad}" y="${phone ? 36 : 40}" font-family="sans-serif" font-size="${phone ? 16 : 18}" font-weight="600" fill="#22201c">${esc(ventureName)}</text>` +
    title.map((line, i) =>
      `<text x="${pad}" y="${(phone ? 112 : 136) + i * 30}" font-family="sans-serif" font-size="${phone ? 22 : 32}" font-weight="600" fill="#22201c">${esc(line)}</text>`).join('') +
    `<text x="${pad}" y="176" font-family="sans-serif" font-size="${phone ? 14 : 16}" fill="#77716a">Test picture · ${after ? 'after' : 'before'} · ${w}×${h}</text>` +
    (after ? rows : `<text x="${pad}" y="${phone ? 260 : 300}" font-family="sans-serif" font-size="${phone ? 15 : 18}" fill="#77716a">Not built yet.</text>`) +
    `</svg>`;
}
