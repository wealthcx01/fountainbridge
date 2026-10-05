'use server';

/**
 * The admin view's controls for the studio's cofounder (FB-201).
 *
 * A server action is a public endpoint, so each one reads the signed-in address from the session
 * here and hands it to `lib/cofounder-admin.ts`, where who may do what is decided and tested. Nothing
 * the page sends is believed about who is asking.
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { cofounderDeps } from '@/app/api/cofounder/deps';
import { changeSettings, changeStop, lookNow, releaseVenture, type AdminResult } from '@/lib/cofounder-admin';

async function signedInEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}

async function run(what: string, fn: () => Promise<AdminResult>): Promise<AdminResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, message: 'The studio has no database set up yet, so nothing here can be saved.' };
  }
  try {
    const r = await fn();
    if (r.ok) revalidatePath('/admin/cofounder');
    return r;
  } catch (e) {
    console.error(`[cofounder] ${what} failed`, { message: (e as Error)?.message });
    return { ok: false, message: 'The studio could not do that just now, so nothing changed. Try again in a minute.' };
  }
}

export async function saveCofounderSettings(ventureId: string, settings: unknown): Promise<AdminResult> {
  return run('save settings', async () => changeSettings(cofounderDeps(), await signedInEmail(), ventureId, settings));
}

export async function setCofounderStop(stopped: boolean): Promise<AdminResult> {
  return run('stop', async () => changeStop(cofounderDeps(), await signedInEmail(), stopped === true));
}

export async function releaseCofounder(ventureId: string): Promise<AdminResult> {
  return run('release', async () => releaseVenture(cofounderDeps(), await signedInEmail(), ventureId));
}

export async function cofounderLookNow(ventureId: string): Promise<AdminResult> {
  return run('look now', async () => lookNow(cofounderDeps(), await signedInEmail(), ventureId));
}
