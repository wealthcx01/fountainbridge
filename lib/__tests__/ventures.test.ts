import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadVentures, ventureChatUrl } from '../ventures';

const DIR = join(process.cwd(), 'ventures');

describe('loadVentures (against the real ventures/ manifests)', () => {
  it('loads arca and the-reset, skips the example template', () => {
    const ids = loadVentures(DIR).map((v) => v.id);
    expect(ids).toContain('arca');
    expect(ids).toContain('the-reset');
    expect(ids).not.toContain('example-venture');
  });

  it('extracts the founder workspace email and name', () => {
    const reset = loadVentures(DIR).find((v) => v.id === 'the-reset');
    expect(reset?.founderEmail).toBe('ross@bruntsfield.capital');
    expect(reset?.founderName).toBe('Ross');
  });

  it('returns a sorted, summarized shape', () => {
    const vs = loadVentures(DIR);
    expect(vs.map((v) => v.id)).toEqual([...vs.map((v) => v.id)].sort());
    for (const v of vs) {
      expect(typeof v.name).toBe('string');
      expect(Array.isArray(v.repos)).toBe(true);
    }
  });

  it('returns [] for a missing directory (never throws)', () => {
    expect(loadVentures('/no/such/dir')).toEqual([]);
  });

  it('parses the Build/Sell/Scale surfaces (FB-048), all three provisioned since FB-045', () => {
    const arca = loadVentures(DIR).find((v) => v.id === 'arca');
    expect(arca?.departments.map((d) => d.id)).toEqual(['build', 'sell', 'scale']);
    const build = arca?.departments.find((d) => d.id === 'build');
    expect(build?.gate).toBe('pr');
    expect(build?.provisioned).toBe(true); // repo 'arca' is in the venture's repos
    const sell = arca?.departments.find((d) => d.id === 'sell');
    expect(sell?.gate).toBe('activegraph');
    expect(sell?.provisioned).toBe(true); // 'arca-marketing' created + in repos (FB-045)
    expect(arca?.departments.find((d) => d.id === 'scale')?.provisioned).toBe(true);
  });

  it('still marks a declared-but-unprovisioned department as coming', () => {
    // the-reset's repos exist in the manifest but not yet as real repos — the "coming" state has to
    // survive arca's departments going live, or the studio would promise a surface nobody can use.
    const reset = loadVentures(DIR).find((v) => v.id === 'the-reset');
    expect(reset?.departments.some((d) => !d.provisioned)).toBe(true);
  });

  it('parses a department launch target, and refuses a non-http(s) one (FB-093)', () => {
    // Written against a temp manifest rather than the real ones: no real venture has a launch
    // target yet (ARCA's app has no public hostname), and this behaviour must not silently rot
    // while that stays true.
    const dir = mkdtempSync(join(tmpdir(), 'ventures-launch-'));
    writeFileSync(join(dir, 'v.yaml'), [
      'id: v',
      'name: V',
      'repos: [v-app, v-mkt, v-bad]',
      'departments:',
      '  - { id: build, venture_id: v, name: Build, repo: v-app, queue_path: docs/tickets, gate: pr,',
      '      launch: { url: "https://app.v.example", label: Open the app } }',
      '  - { id: sell, venture_id: v, name: Sell, repo: v-mkt, queue_path: docs/tickets, gate: activegraph }',
      // The href rule, enforced at the loader even though the schema also rejects it: a manifest
      // that somehow skipped validation must still never put a script scheme into an <a href>.
      '  - { id: bad, venture_id: v, name: Bad, repo: v-bad, queue_path: docs/tickets, gate: pr,',
      '      launch: { url: "javascript:alert(1)" } }',
    ].join('\n'));
    const v = loadVentures(dir).find((x) => x.id === 'v');
    expect(v?.departments.find((d) => d.id === 'build')?.launch).toEqual({
      url: 'https://app.v.example',
      label: 'Open the app',
    });
    expect(v?.departments.find((d) => d.id === 'sell')?.launch).toBeNull();
    expect(v?.departments.find((d) => d.id === 'bad')?.launch).toBeNull();
  });

  it('no real manifest carries a launch target yet — arca reads null (FB-093)', () => {
    // When ARCA's app gets a public hostname and `launch:` lands in its manifest, this flips —
    // update it to assert the real URL then, and move the e2e assertion from pending to button.
    const arca = loadVentures(DIR).find((v) => v.id === 'arca');
    for (const d of arca?.departments ?? []) expect(d.launch).toBeNull();
  });

  it('exposes the box host and derives the chat URL (FB-025)', () => {
    // arca has a provisioned box → a real chat URL (chat.<host>).
    const arca = loadVentures(DIR).find((v) => v.id === 'arca');
    expect(arca?.vpsHost).toBe('arca.bruntsfield.capital');
    expect(ventureChatUrl(arca?.vpsHost ?? null)).toBe('https://chat.arca.bruntsfield.capital');
    // a venture with no box → no chat URL (the "coming with your box" state).
    expect(ventureChatUrl(null)).toBeNull();
  });
});
