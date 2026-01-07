'use client';

import Link from 'next/link';

interface Designer {
  id: string;
  name: string;
  bio?: string | null;
  profileImage?: string | null;
}

interface EmptyStateProps {
  username: string;
  designer: Designer;
}

/**
 * EMPTY MONOGRAPH STATE
 * 
 * Beautiful blank spread for designers with no published projects.
 * Encourages first project upload with subtle CTA.
 */
export default function EmptyState({ username, designer }: EmptyStateProps) {
  return (
    <main className="min-h-screen bg-[#fdfbf8] flex items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <div className="mb-12">
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-stone-900 mb-6 font-light">
            {designer.name}
          </h1>
          {designer.bio && (
            <p className="text-stone-600 text-lg md:text-xl font-light leading-relaxed max-w-xl mx-auto">
              {designer.bio}
            </p>
          )}
        </div>

        <div className="mt-20 p-12 md:p-16 bg-white rounded-lg border border-stone-200 shadow-sm">
          <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl text-stone-900 mb-6 font-light">
            Begin Your Monograph
          </h2>
          <p className="text-stone-600 mb-10 font-light leading-relaxed text-base md:text-lg">
            Your public profile will showcase your published projects, design signature, 
            and signature products. Start by uploading your first project.
          </p>
          <Link
            href="/designer/create-project"
            className="inline-block px-8 py-4 bg-stone-900 text-white rounded-full text-base md:text-lg font-light hover:bg-stone-800 transition-colors"
          >
            Upload First Project
          </Link>
        </div>
      </div>
    </main>
  );
}

