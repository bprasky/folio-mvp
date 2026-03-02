'use client';

import MosaicGrid, { MosaicCell } from '../MosaicGrid';
import LargeProjectCard from '../cards/LargeProjectCard';
import MediumProjectCard from '../cards/MediumProjectCard';
import type { ProfileProject } from '../types';

interface ProjectsFeedProps {
  projects: ProfileProject[];
}

export default function ProjectsFeed({ projects }: ProjectsFeedProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="folio-body" style={{ color: 'var(--text-tertiary)' }}>
          Publish your first project to showcase your work here.
        </p>
      </div>
    );
  }

  return (
    <MosaicGrid>
      {projects.map((project, i) => {
        const isLarge = i === 0;
        return (
          <MosaicCell key={project.id} size={isLarge ? 'large' : 'medium'}>
            {isLarge ? (
              <LargeProjectCard project={project} />
            ) : (
              <MediumProjectCard project={project} />
            )}
          </MosaicCell>
        );
      })}
    </MosaicGrid>
  );
}
