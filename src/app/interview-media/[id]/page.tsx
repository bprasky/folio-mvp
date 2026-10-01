import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicMediaPiece } from '@/lib/interview-media/service';
export const dynamic = 'force-dynamic';
export default async function PublishedInterviewMedia({ params }: { params: { id: string } }) {
  const piece = await publicMediaPiece(params.id).catch(() => null);
  if (!piece) notFound();
  return <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
    <Link href={piece.destination || '/'} className="folio-meta">View the Folio source →</Link>
    <h1 className="folio-h1">{piece.title}</h1><p className="folio-body">{piece.description}</p>
    {piece.mimeType.startsWith('video/') ? <video controls playsInline src={piece.url} className="max-h-[75vh] w-full bg-black" /> : <audio controls src={piece.url} className="w-full" />}
    <p className="folio-meta">{piece.credits}</p>
  </main>;
}
