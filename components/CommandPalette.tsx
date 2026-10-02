'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { loadPalette, type PaletteData } from '@/app/actions/palette';
import { isPaletteShortcut, matchPalette, paletteAnnouncement } from '@/lib/palette';

/**
 * "Go to anything" (FB-179) — ⌘K on a Mac, Ctrl-K elsewhere, from every signed-in screen.
 *
 * What is listed and how typing narrows it is decided in `lib/palette.ts`. This is the keyboard and
 * the screen reader:
 *
 * - The dialog is modal and labelled. Focus goes to the search box when it opens and back to where
 *   it was when it closes. Tab stays inside it.
 * - The box is a combobox over a listbox: arrows move the active option, Enter goes, Escape closes.
 *   The active option is announced through `aria-activedescendant`, so focus never leaves the box.
 * - A polite live region says how many matches there are after each keystroke.
 * - It is also reachable without the shortcut: a "Go to anything" button is the first thing Tab
 *   reaches on every page. It is out of sight until it has focus, like a skip link, so the screen
 *   looks exactly as designed for a mouse user.
 *
 * It navigates only; it never decides anything (see `lib/palette.ts`).
 */
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const ventureId = /^\/venture\/([^/]+)/.exec(pathname ?? '')?.[1] ?? null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [data, setData] = useState<PaletteData | null>(null);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-o${i}`;

  const show = useCallback(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    setOpen(true);
    setQuery('');
    setActive(0);
    setData(null);
    setFailed(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    returnTo.current?.focus?.();
  }, []);

  // The shortcut, from anywhere — including inside a text box, which is where a founder in the
  // composer will be when they want to leave it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPaletteShortcut(e)) return;
      e.preventDefault();
      if (open) close();
      else show();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, show, close]);

  // Load on open, for the venture the founder is standing in.
  useEffect(() => {
    if (!open) return;
    let live = true;
    loadPalette(ventureId)
      .then((d) => { if (live) setData(d); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [open, ventureId]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);


  const shown = useMemo(() => matchPalette(data?.items ?? [], query), [data, query]);
  const safeActive = Math.min(active, Math.max(shown.length - 1, 0));

  const go = (i: number) => {
    const item = shown[i];
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); return; }
    if (e.key === 'Home') { e.preventDefault(); setActive(0); return; }
    if (e.key === 'End') { e.preventDefault(); setActive(Math.max(shown.length - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); go(safeActive); return; }
    // Tab stays inside: the only control in here is the box.
    if (e.key === 'Tab') e.preventDefault();
  };

  useEffect(() => {
    document.getElementById(optionId(safeActive))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeActive, shown]);

  const status = failed
    ? 'The studio could not load the list just now. Close this and try again in a moment.'
    : !data
      ? 'Loading…'
      : paletteAnnouncement(shown.length, data.items.length, query);

  let lastGroup: string | null = null;

  return (
    <>
      <button type="button" className="palette-skip" data-testid="palette-open" onClick={show}
        aria-keyshortcuts="Meta+K Control+K">
        Go to anything (⌘K or Ctrl-K)
      </button>
      {open ? (
        <div className="palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-label="Go to anything" className="palette" data-testid="palette">
            <input
              ref={input}
              className="palette-input"
              data-testid="palette-input"
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={shown.length ? optionId(safeActive) : undefined}
              aria-label="Go to a venture, a ticket or a screen"
              placeholder="Go to a venture, a ticket or a screen…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="palette-status" role="status" aria-live="polite" data-testid="palette-status">{status}</p>
            {data?.missing.length ? (
              <p className="palette-missing" data-testid="palette-missing">{data.missing.join(' ')}</p>
            ) : null}
            <ul id={listId} role="listbox" aria-label="Places" className="palette-list">
              {shown.map((item, i) => {
                const heading = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                return (
                  <li
                    key={item.key}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === safeActive}
                    className={`palette-option${i === safeActive ? ' is-active' : ''}`}
                    data-testid="palette-option"
                    onMouseMove={() => setActive(i)}
                    onMouseDown={(e) => { e.preventDefault(); go(i); }}
                  >
                    {heading ? <span className="palette-group" aria-hidden="true">{heading}</span> : null}
                    <span className="palette-label">{item.label}</span>
                    <span className="palette-hint">{item.hint}</span>
                  </li>
                );
              })}
            </ul>
            <p className="palette-keys" aria-hidden="true">↑ ↓ to choose · Enter to go · Esc to close</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
