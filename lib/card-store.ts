import { PICTURES, type PictureName, type PlainParts, type ReviewCardFile } from './review';
import { memoryPressStore, sqlPressStore, type PressStore } from './press-store';

/**
 * The factory's cards and their pictures, as the studio keeps them (FB-275, `db/008_factory_cards.sql`).
 *
 * The planning box puts them in through the door (`lib/factory-door.ts`). The Review screen reads
 * them out (`lib/review-load.ts`). Every call names the venture, and the database is what keeps one
 * venture's cards from another's: each one runs inside `withVenture` (lib/db.ts), and none of the
 * statements below names a venture except through the connection's own scope. A statement here
 * cannot reach another venture's card even by being handed the wrong repository.
 *
 * Two stores share this one shape:
 *
 *   - `sqlCardStore`, over the studio's database. Production, staging, previews and every test copy.
 *   - `memoryCardStore`, for the browser tests' own studio only, which has no database (see
 *     `lib/card-store-live.ts` for when it is used, and why).
 *
 * The statements are exported so the tests run THESE strings against real Postgres.
 */

/** Where a card stands. Only a `finished` card has a Review screen. */
export const CARD_STATES = ['finished', 'stuck', 'sent-back', 'done', 'failed', 'needs-you'] as const;
export type CardKind = (typeof CARD_STATES)[number];

/** One card, as the door stores it. */
export interface StoredCard {
  repo: string;
  number: number;
  runId: string | null;
  state: CardKind;
  /** When the box made this version. An older version never replaces a newer one. */
  sentAt: string;
  headSha: string;
  /** Checked to be a preview address before it was stored. Opened again before it is drawn. */
  previewUrl: string | null;
  plain: PlainParts;
  /** Everything the card carried that is not a plain part. John's alone. */
  forJohn: Record<string, unknown>;
}

export interface PictureInfo {
  name: PictureName;
  width: number;
  height: number;
  takenAt: string;
}

export interface StoredPicture extends PictureInfo {
  headSha: string;
  bytes: Uint8Array;
}

/** A card, with the pictures it has so far. */
export interface CardWithPictures extends StoredCard {
  pictures: PictureInfo[];
}

export interface Heartbeat {
  box: string;
  reportedAt: string;
  receivedAt: string;
}

/** The cards, their pictures, the box's heartbeat, and the presses on the cards (FB-276). */
export interface CardStore extends PressStore {
  /** Keep this card, unless a newer version of it is already here. */
  putCard(ventureId: string, card: StoredCard): Promise<'stored' | 'older'>;
  card(ventureId: string, repo: string, number: number): Promise<CardWithPictures | null>;
  /** Every finished card of the venture's, in any of the repositories given. */
  finished(ventureId: string, repos: string[]): Promise<{ repo: string; number: number }[]>;
  /** Keep a picture of a card's work. Only of the version the card is about. */
  putPicture(ventureId: string, repo: string, number: number, picture: StoredPicture): Promise<'stored' | 'no-card' | 'other-version'>;
  picture(ventureId: string, repo: string, number: number, name: PictureName): Promise<Uint8Array | null>;
  /** Set or clear a card's preview address. */
  putPreview(ventureId: string, repo: string, number: number, url: string | null): Promise<'stored' | 'no-card'>;
  /** The box reported. Belongs to no venture. */
  beat(box: string, reportedAt: string): Promise<void>;
  lastBeat(box: string): Promise<Heartbeat | null>;
}

/** Anything with pg's `query(text, params)` shape: a pooled client in the studio, PGlite in tests. */
export interface Querier {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

export const SQL = {
  // Pictures of an older version of the work go when a newer card arrives, so a founder is never
  // shown pictures of one version beside a sign-off button bound to another.
  dropOldPictures: `delete from factorystore.pictures p
                     using factorystore.cards c
                     where c.venture_id = p.venture_id and c.repo = p.repo and c.number = p.number
                       and c.repo = $1 and c.number = $2 and c.sent_at <= $3 and c.head_sha <> $4`,
  // `where cards.sent_at <= excluded.sent_at`: a card the box sent earlier, arriving late, changes
  // nothing. Nothing comes back from the statement when that happens, which is how the caller knows.
  putCard: `insert into factorystore.cards
              (venture_id, repo, number, run_id, state, sent_at, head_sha, preview_url, plain, for_john)
            values (current_setting('app.venture_id', true), $1, $2, $3, $4, $5, $6, $7, $8, $9)
            on conflict (venture_id, repo, number) do update set
              run_id = excluded.run_id, state = excluded.state, sent_at = excluded.sent_at,
              head_sha = excluded.head_sha,
              preview_url = coalesce(excluded.preview_url, factorystore.cards.preview_url),
              plain = excluded.plain, for_john = excluded.for_john, received_at = now()
            where factorystore.cards.sent_at <= excluded.sent_at
            returning 1 as kept`,
  card: `select repo, number, run_id, state, sent_at, head_sha, preview_url, plain, for_john
           from factorystore.cards where repo = $1 and number = $2`,
  pictureInfo: `select name, width, height, taken_at from factorystore.pictures where repo = $1 and number = $2`,
  finished: `select repo, number from factorystore.cards where state = 'finished' and repo = any($1::text[])`,
  headOf: 'select head_sha from factorystore.cards where repo = $1 and number = $2',
  putPicture: `insert into factorystore.pictures (venture_id, repo, number, name, head_sha, width, height, taken_at, bytes)
               values (current_setting('app.venture_id', true), $1, $2, $3, $4, $5, $6, $7, $8)
               on conflict (venture_id, repo, number, name) do update set
                 head_sha = excluded.head_sha, width = excluded.width, height = excluded.height,
                 taken_at = excluded.taken_at, bytes = excluded.bytes, received_at = now()`,
  picture: 'select bytes from factorystore.pictures where repo = $1 and number = $2 and name = $3',
  putPreview: 'update factorystore.cards set preview_url = $3 where repo = $1 and number = $2 returning 1 as kept',
  beat: `insert into factorystore.heartbeats (box, reported_at) values ($1, $2)
         on conflict (box) do update set reported_at = excluded.reported_at, received_at = now()`,
  lastBeat: 'select box, reported_at, received_at from factorystore.heartbeats where box = $1',
} as const;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

/** Rows come back as text or as objects depending on the driver; both are read the same way. */
const json = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);

/** Postgres's `bytea` arrives as a Buffer from pg and a Uint8Array from PGlite. */
const bytesOf = (v: unknown) => (v instanceof Uint8Array ? v : new Uint8Array(v as ArrayBuffer));

/**
 * The store over the studio's database.
 *
 * `asVenture` runs one transaction scoped to one venture (`withVenture`). `asNobody` runs one scoped
 * to no venture at all, so it sees no venture's rows, for the box's heartbeat (`withoutVenture`).
 */
export function sqlCardStore(run: {
  asVenture<T>(ventureId: string, fn: (q: Querier) => Promise<T>): Promise<T>;
  asNobody<T>(fn: (q: Querier) => Promise<T>): Promise<T>;
}): CardStore {
  return {
    ...sqlPressStore(run),

    putCard: (ventureId, c) =>
      run.asVenture(ventureId, async (q) => {
        await q.query(SQL.dropOldPictures, [c.repo, c.number, c.sentAt, c.headSha]);
        const { rows } = await q.query(SQL.putCard, [
          c.repo, c.number, c.runId, c.state, c.sentAt, c.headSha, c.previewUrl, JSON.stringify(c.plain), JSON.stringify(c.forJohn),
        ]);
        return rows.length ? 'stored' : 'older';
      }),

    card: (ventureId, repo, number) =>
      run.asVenture(ventureId, async (q) => {
        const { rows } = await q.query<Record<string, unknown>>(SQL.card, [repo, number]);
        const r = rows[0];
        if (!r) return null;
        const pics = await q.query<Record<string, unknown>>(SQL.pictureInfo, [repo, number]);
        return {
          repo: String(r.repo),
          number: Number(r.number),
          runId: (r.run_id as string | null) ?? null,
          state: r.state as CardKind,
          sentAt: iso(r.sent_at),
          headSha: String(r.head_sha ?? ''),
          previewUrl: (r.preview_url as string | null) ?? null,
          plain: json(r.plain) as PlainParts,
          forJohn: (json(r.for_john) ?? {}) as Record<string, unknown>,
          pictures: pics.rows.map((p) => ({
            name: p.name as PictureName,
            width: Number(p.width),
            height: Number(p.height),
            takenAt: iso(p.taken_at),
          })),
        };
      }),

    finished: (ventureId, repos) =>
      run.asVenture(ventureId, async (q) => {
        const { rows } = await q.query<{ repo: string; number: number }>(SQL.finished, [repos]);
        return rows.map((r) => ({ repo: r.repo, number: Number(r.number) }));
      }),

    putPicture: (ventureId, repo, number, p) =>
      run.asVenture(ventureId, async (q) => {
        const { rows } = await q.query<{ head_sha: string }>(SQL.headOf, [repo, number]);
        if (!rows[0]) return 'no-card';
        if (rows[0].head_sha !== p.headSha) return 'other-version';
        await q.query(SQL.putPicture, [repo, number, p.name, p.headSha, p.width, p.height, p.takenAt, Buffer.from(p.bytes)]);
        return 'stored';
      }),

    picture: (ventureId, repo, number, name) =>
      run.asVenture(ventureId, async (q) => {
        const { rows } = await q.query<{ bytes: unknown }>(SQL.picture, [repo, number, name]);
        return rows[0] ? bytesOf(rows[0].bytes) : null;
      }),

    putPreview: (ventureId, repo, number, url) =>
      run.asVenture(ventureId, async (q) => {
        const { rows } = await q.query(SQL.putPreview, [repo, number, url]);
        return rows.length ? 'stored' : 'no-card';
      }),

    beat: (box, reportedAt) =>
      run.asNobody(async (q) => {
        await q.query(SQL.beat, [box, reportedAt]);
      }),

    lastBeat: (box) =>
      run.asNobody(async (q) => {
        const { rows } = await q.query<Record<string, unknown>>(SQL.lastBeat, [box]);
        const r = rows[0];
        return r ? { box: String(r.box), reportedAt: iso(r.reported_at), receivedAt: iso(r.received_at) } : null;
      }),
  };
}

/**
 * The same store, kept in this process's memory, for the browser tests' own studio.
 *
 * Kept by venture as the database keeps it, so a card put in under one venture is never found under
 * another. Never used where there is a database (`lib/card-store-live.ts`).
 */
export function memoryCardStore(now: () => Date = () => new Date()): CardStore {
  const cards = new Map<string, StoredCard>();
  const pictures = new Map<string, StoredPicture>();
  const beats = new Map<string, Heartbeat>();
  const key = (...parts: (string | number)[]) => JSON.stringify(parts);
  const picsOf = (v: string, repo: string, number: number) =>
    PICTURES.flatMap((name) => {
      const p = pictures.get(key(v, repo, number, name));
      return p ? [p] : [];
    });

  return {
    ...memoryPressStore((v, repo, number) => cards.get(key(v, repo, number))?.headSha ?? null, now),

    async putCard(v, c) {
      const was = cards.get(key(v, c.repo, c.number));
      if (was && Date.parse(was.sentAt) > Date.parse(c.sentAt)) return 'older';
      if (was && was.headSha !== c.headSha) for (const p of picsOf(v, c.repo, c.number)) pictures.delete(key(v, c.repo, c.number, p.name));
      cards.set(key(v, c.repo, c.number), structuredClone({ ...c, previewUrl: c.previewUrl ?? was?.previewUrl ?? null }));
      return 'stored';
    },
    async card(v, repo, number) {
      const c = cards.get(key(v, repo, number));
      if (!c) return null;
      return {
        ...structuredClone(c),
        pictures: picsOf(v, repo, number).map(({ name, width, height, takenAt }) => ({ name, width, height, takenAt })),
      };
    },
    async finished(v, repos) {
      return [...cards.entries()]
        .filter(([k, c]) => JSON.parse(k)[0] === v && c.state === 'finished' && repos.includes(c.repo))
        .map(([, c]) => ({ repo: c.repo, number: c.number }));
    },
    async putPicture(v, repo, number, p) {
      const c = cards.get(key(v, repo, number));
      if (!c) return 'no-card';
      if (c.headSha !== p.headSha) return 'other-version';
      pictures.set(key(v, repo, number, p.name), { ...p, bytes: new Uint8Array(p.bytes) });
      return 'stored';
    },
    async picture(v, repo, number, name) {
      return pictures.get(key(v, repo, number, name))?.bytes ?? null;
    },
    async putPreview(v, repo, number, url) {
      const c = cards.get(key(v, repo, number));
      if (!c) return 'no-card';
      c.previewUrl = url;
      return 'stored';
    },
    async beat(box, reportedAt) {
      beats.set(box, { box, reportedAt, receivedAt: now().toISOString() });
    },
    async lastBeat(box) {
      return beats.get(box) ?? null;
    },
  };
}

/**
 * A stored card, as the Review screen reads it: its plain parts, its checked preview, the pictures
 * the box has sent so far, and John's three lines. `forJohn` here is only ever read by `reviewFor`,
 * which hands it on to John alone.
 */
export function toReviewCard(c: CardWithPictures): ReviewCardFile {
  const john = (c.forJohn.forJohn ?? {}) as Record<string, unknown>;
  const line = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  const taken = c.pictures.map((p) => p.takenAt).sort();
  return {
    ...c.plain,
    state: 'finished',
    previewUrl: c.previewUrl,
    picturesTakenAt: taken.length ? taken[taken.length - 1] : null,
    pictures: Object.fromEntries(c.pictures.map((p) => [p.name, { width: p.width, height: p.height }])),
    forJohn: { cost: line(john.cost), nextStep: line(john.nextStep), runUrl: line(john.runUrl) },
  };
}
