'use client';

import FlowMosaic from '@/components/feed/FlowMosaic';
import type { FeedProjectItem } from '@/lib/feed/feed-layout';

interface ProjectFlowMosaicProps {
  projects: FeedProjectItem[];
}

export default function ProjectFlowMosaic({ projects }: ProjectFlowMosaicProps) {
  const items = projects.map(project => ({
    id: project.id,
    title: project.title,
    imageUrl: project.heroImage,
    viewCount: project.saveCount,
    eventTypes: [] as string[],
    href: `/project/${project.id}`,
  }));

  return <FlowMosaic events={items} preserveOrder />;
}
