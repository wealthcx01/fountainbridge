/**
 * FB-168 — the pages the landmark check opens. Kept apart from the spec, with no Playwright in it,
 * so a unit test (app/__tests__/landmark-pages.test.ts) can hold it to every page the studio has.
 * Add a page to the app and forget it here, and that unit test fails and names it.
 */

/** Pages opened signed in as Bruntsfield, which can see every venture. Query strings that pick a tab are left off, except one that opens a ticket. */
export const SIGNED_IN = [
  '/',
  '/attention',
  '/activity',
  '/lanes',
  '/foundry',
  '/handbook',
  '/handbook/how-to-start',
  '/how-it-works',
  '/how-it-works/lanes',
  '/playbook',
  '/playbook/moats',
  '/admin/timing',
  '/admin/machine-budgets',
  '/venture/arca',
  '/venture/arca/tickets',
  '/venture/arca/tickets?t=arca%2FARCA-1',
  '/venture/arca/knowledge',
  '/venture/arca/routines',
  '/venture/arca/ads',
  '/venture/arca/activity',
  '/venture/arca/composer',
  '/venture/arca/handbook',
  '/venture/arca/handbook/how-to-start',
  '/venture/arca/sell',
  '/venture/arca/work/arca/10',
  '/venture/arca/approvals/arca/free-post',
  '/venture/the-reset',
  '/venture/the-reset/knowledge',
  '/venture/the-reset/sell',
] as const;

/** The page an account with no venture is sent to. It is opened signed in as such an account. */
export const REFUSED = '/not-authorized';

/** The one page a signed-out visitor sees. */
export const SIGNED_OUT = '/login';

/** Every path the landmark check opens, whoever it is opened as. */
export const ALL_CHECKED: readonly string[] = [...SIGNED_IN, REFUSED, SIGNED_OUT];
