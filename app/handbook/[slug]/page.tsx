import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadHandbook, minutesToRead } from '@/lib/handbook';
import { HandbookReader } from '@/components/HandbookReader';

/** One chapter, outside a venture (FB-023, restyled FB-134). Self-guards as well as the middleware. */
export default async function HandbookChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const { slug } = await params;
  const all = loadHandbook(); // read the content dir once
  const idx = all.findIndex((c) => c.slug === slug);
  if (idx < 0) notFound();

  return (
    <HandbookReader
      chapter={all[idx]}
      minutes={minutesToRead(all[idx].body)}
      prev={idx > 0 ? all[idx - 1] : null}
      next={idx < all.length - 1 ? all[idx + 1] : null}
      base="/handbook"
    />
  );
}
