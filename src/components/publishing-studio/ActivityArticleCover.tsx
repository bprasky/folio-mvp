'use client';

import { useState } from 'react';
import type { ActivityContext } from '@/lib/publishing-studio/activities';

/** The same authored cover appears in Studio, the interview and the published article. */
export function ActivityArticleCover({ title, identity, projectImageUrl, working = false, label = 'In conversation with Folio', heading = false }: {
  title: string; identity: NonNullable<ActivityContext['identity']>; projectImageUrl?: string | null; working?: boolean; label?: string; heading?: boolean;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  // Null is an unavailable project photograph; never replace it with a person or logo.
  const project = projectImageUrl !== undefined;
  const projectImage = projectImageUrl && projectImageUrl !== failedImage ? projectImageUrl : null;
  const portrait = !project && identity.portraitUrl;
  const logo = !project && !portrait && identity.logoUrl;
  const Title = heading ? 'h1' : 'span';
  return <div className="flex min-h-96 flex-col overflow-hidden bg-surface-ground text-folio-text-primary">
    {projectImage ? <img src={projectImage} alt={title} onError={() => setFailedImage(projectImage)} className="aspect-[4/3] w-full object-cover" /> : portrait ? <img src={portrait} alt={`${identity.name}, designer`} className="aspect-[4/3] w-full object-cover object-top" /> : logo ? <div className="flex aspect-[4/3] items-center justify-center p-12"><img src={logo} alt={`${identity.name} logo`} className="max-h-40 max-w-full object-contain" /></div> : null}
    <div className={`flex flex-1 flex-col p-6 sm:p-8 ${!projectImage && !portrait && !logo ? 'min-h-96 justify-between' : ''}`}>
      <span className="folio-meta text-folio-text-secondary">{label}{working ? ' · Working preview' : ''}</span>
      <Title className="folio-h2 my-5 block">{title}</Title>
      <span className="folio-ui mt-auto block border-t border-folio-border-subtle pt-4">{identity.name}</span>
    </div>
  </div>;
}
