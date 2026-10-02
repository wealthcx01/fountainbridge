import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * "Go to anything" reads through a server action, and a server action is a public endpoint (FB-127):
 * anyone can call it naming any venture. These pin that a founder who names another founder's venture
 * gets nothing from it, and that a failed read is said in words rather than shown as a shorter list.
 */
const auth = vi.fn();
const loadVentures = vi.fn();
const loadVentureTickets = vi.fn();
const loadVentureAttention = vi.fn();
const ventureApprovals = vi.fn();

vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/ventures', () => ({ loadVentures: () => loadVentures() }));
vi.mock('@/lib/tickets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tickets')>()),
  loadVentureTickets: (...a: unknown[]) => loadVentureTickets(...a),
}));
vi.mock('@/lib/attention', () => ({ loadVentureAttention: (...a: unknown[]) => loadVentureAttention(...a) }));
vi.mock('@/lib/venture-reads', () => ({ ventureApprovals: (...a: unknown[]) => ventureApprovals(...a) }));

const { loadPalette } = await import('../palette');

const ARCA = { id: 'arca', name: 'ARCA', repos: ['arca'], departments: [], founderEmail: 'founder@bruntsfield.capital', approvalMatrix: [] };
const RESET = { id: 'the-reset', name: 'The Reset', repos: ['the-reset'], departments: [], founderEmail: 'ross@bruntsfield.capital', approvalMatrix: [] };

const lane = (repo: string, ids: string[]) => ({
  repo, ref: 'main', total: ids.length, skipped: 0, error: null, errorKind: null,
  groups: { filed: [], todo: ids.map((id) => ({ ticket: { id, title: `Title of ${id}`, repo }, warnings: [] })), 'in-progress': [], 'pr-open': [], done: [] },
});

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STUDIO_ADMIN_EMAILS;
  loadVentures.mockReturnValue([ARCA, RESET]);
  auth.mockResolvedValue({ user: { email: 'founder@bruntsfield.capital' } });
  loadVentureTickets.mockResolvedValue({ ventureId: 'arca', lanes: [lane('arca', ['ARCA-001', 'ARCA-061'])], fetchedAt: 0, totalWarnings: 0 });
  loadVentureAttention.mockResolvedValue({ approvals: [], errors: [] });
  ventureApprovals.mockResolvedValue([]);
});

describe('whose things it lists', () => {
  it('a founder sees their own venture’s tickets', async () => {
    const d = await loadPalette('arca');
    expect(d.items.filter((i) => i.group === 'Tickets').map((i) => i.hint)).toEqual(['ARCA-001', 'ARCA-061']);
    expect(d.missing).toEqual([]);
  });

  it('naming another founder’s venture reads nothing from it, and lists only your own', async () => {
    const d = await loadPalette('the-reset');
    expect(loadVentureTickets).not.toHaveBeenCalled();
    expect(ventureApprovals).not.toHaveBeenCalled();
    expect(d.items.every((i) => !i.href.startsWith('/venture/the-reset'))).toBe(true);
    expect(d.items.map((i) => i.label)).toContain('ARCA');
  });

  it('without a session, lists nothing', async () => {
    auth.mockResolvedValue(null);
    expect((await loadPalette('arca')).items).toEqual([]);
  });
});

describe('when a read fails', () => {
  it('keeps every screen and says, in words, that the tickets are missing', async () => {
    loadVentureTickets.mockRejectedValue(new Error('GitHub said 502'));
    const d = await loadPalette('arca');
    expect(d.items.some((i) => i.label === 'Composer')).toBe(true);
    expect(d.items.some((i) => i.group === 'Tickets')).toBe(false);
    expect(d.missing.join(' ')).toMatch(/tickets could not be read/);
  });

  it('says so when the sends could not be read', async () => {
    ventureApprovals.mockRejectedValue(new Error('502'));
    expect((await loadPalette('arca')).missing.join(' ')).toMatch(/Sends waiting on you could not be read/);
  });
});

describe('where waiting work goes', () => {
  it('to its ticket when the ticket is on the board, and to its own page when the id is only a guess', async () => {
    // ARCA's real case: a branch named `ARCA-061-…` for a ticket filed as `ARCA-61`.
    loadVentureTickets.mockResolvedValue({ ventureId: 'arca', lanes: [lane('arca', ['ARCA-61', 'ARCA-068'])], fetchedAt: 0, totalWarnings: 0 });
    loadVentureAttention.mockResolvedValue({
      errors: [],
      approvals: [
        { repo: 'arca', number: 93, title: 'build: ARCA-061-saved-card-lists', ticketTitle: null, linkedTicketId: 'ARCA-061' },
        { repo: 'arca', number: 70, title: 'Research', ticketTitle: 'Research: auction houses', linkedTicketId: 'ARCA-068' },
      ],
    });
    const work = (await loadPalette('arca')).items.filter((i) => i.key.startsWith('work:'));
    expect(work.map((w) => w.href)).toEqual([
      '/venture/arca/work/arca/93',
      '/venture/arca/tickets?filter=all&t=arca%2FARCA-068',
    ]);
  });
});

