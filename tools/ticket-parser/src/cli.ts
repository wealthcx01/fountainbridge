/**
 * Tiny CLI for dogfooding the parser: read a ticket file, print the parsed Ticket + warnings.
 *   npm run parse -- <path-to-ticket.md> [--repo <repo>]
 * The repo defaults to 'fountainbridge' and the path is reported repo-relative when possible.
 */

import { readFileSync } from 'node:fs';
import { parseTicket } from './parse';

function main(argv: string[]): number {
  const args = argv.slice(2);
  const repoFlag = args.indexOf('--repo');
  const repo = repoFlag >= 0 ? args[repoFlag + 1] : 'fountainbridge';
  const file = args.find((a, i) => !a.startsWith('--') && i !== repoFlag + 1);
  if (!file) {
    console.error('usage: npm run parse -- <path-to-ticket.md> [--repo <repo>]');
    return 2;
  }
  const content = readFileSync(file, 'utf8');
  const relPath = file.includes('docs/tickets/')
    ? 'docs/tickets/' + file.split('docs/tickets/')[1]
    : file;
  const { ticket, warnings } = parseTicket(content, { repo, path: relPath });
  console.log(JSON.stringify({ ...ticket, body_md: `<${ticket.body_md.length} chars>` }, null, 2));
  if (warnings.length) {
    console.error(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.error(`  [${w.code}] ${w.message}`);
  }
  return 0;
}

process.exit(main(process.argv));
