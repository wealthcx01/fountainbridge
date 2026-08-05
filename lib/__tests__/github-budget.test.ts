import { describe, it, expect, beforeEach } from 'vitest';
import { recordBudget, githubBudget, clearGithubBudget, budgetIsLow } from '../github';

const headers = (h: Record<string, string>) => new Headers(h);
const NOW = Date.parse('2026-08-05T12:00:00Z');

describe('knowing how much budget is left', () => {
  beforeEach(() => clearGithubBudget());

  it('reads the allowance off a response the studio was making anyway', () => {
    // It has to cost nothing. This is the one ticket whose whole subject is not spending requests.
    recordBudget('rest', headers({
      'x-ratelimit-remaining': '4200', 'x-ratelimit-limit': '5000',
      'x-ratelimit-reset': String(Math.floor(NOW / 1000) + 600),
    }), NOW);
    expect(githubBudget().rest).toMatchObject({ remaining: 4200, limit: 5000 });
    expect(githubBudget().rest?.resetsAt).toBe('2026-08-05T12:10:00.000Z');
  });

  it('keeps the two allowances apart', () => {
    // FB-083 moved the ticket and pull-request reads onto GraphQL precisely because it draws on a
    // separate pool. An operator who cannot see both cannot see the headroom that bought.
    recordBudget('rest', headers({ 'x-ratelimit-remaining': '10', 'x-ratelimit-limit': '5000' }), NOW);
    recordBudget('graphql', headers({ 'x-ratelimit-remaining': '4999', 'x-ratelimit-limit': '5000' }), NOW);
    expect(githubBudget().rest?.remaining).toBe(10);
    expect(githubBudget().graphql?.remaining).toBe(4999);
  });

  it('says when it last heard, because a stale figure is not a reassuring one', () => {
    recordBudget('rest', headers({ 'x-ratelimit-remaining': '1', 'x-ratelimit-limit': '5000' }), NOW);
    expect(githubBudget().rest?.seenAt).toBe('2026-08-05T12:00:00.000Z');
  });

  it('ignores a response that carries no usable numbers', () => {
    // Never invent a budget. "Not heard yet" and "nearly empty" must not look the same.
    recordBudget('rest', headers({}), NOW);
    recordBudget('rest', headers({ 'x-ratelimit-remaining': 'x', 'x-ratelimit-limit': '5000' }), NOW);
    recordBudget('rest', headers({ 'x-ratelimit-remaining': '5', 'x-ratelimit-limit': '0' }), NOW);
    expect(githubBudget().rest).toBeNull();
  });

  it('calls a fifth left low, and says nothing about what it has not seen', () => {
    expect(budgetIsLow({ remaining: 999, limit: 5000, resetsAt: '', seenAt: '' })).toBe(true);
    expect(budgetIsLow({ remaining: 1001, limit: 5000, resetsAt: '', seenAt: '' })).toBe(false);
    expect(budgetIsLow(null)).toBe(false);
  });
});
