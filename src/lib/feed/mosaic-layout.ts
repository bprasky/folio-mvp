import type { FeedProjectItem } from './feed-layout';

export type MosaicPattern = 'A' | 'B' | 'C';

export interface MosaicSlot {
  project: FeedProjectItem;
  size: 'large' | 'small' | 'full';
}

export interface MosaicRow {
  pattern: MosaicPattern;
  slots: MosaicSlot[];
}

export function buildMosaicLayout(
  projects: FeedProjectItem[]
): MosaicRow[] {
  const rows: MosaicRow[] = [];
  let i = 0;
  let patternIndex = 0;

  while (i < projects.length) {
    const project = projects[i];

    // Editorial projects always get Pattern C (full-width)
    if (project.isEditorial) {
      rows.push({
        pattern: 'C',
        slots: [{ project, size: 'full' }],
      });
      i += 1;
      continue;
    }

    // Alternate between Pattern A and B
    const pattern: MosaicPattern = patternIndex % 2 === 0 ? 'A' : 'B';
    const remaining = projects.length - i;

    if (remaining === 1) {
      // Last project alone — give it full width
      rows.push({
        pattern: 'C',
        slots: [{ project, size: 'full' }],
      });
      i += 1;
    } else {
      // Pack up to 3 projects into a row (large + 2 small)
      const next = projects[i + 1];
      const afterNext = projects[i + 2];

      const slots: MosaicSlot[] = [
        { project, size: 'large' },
        { project: next, size: 'small' },
        ...(afterNext
          ? [{ project: afterNext, size: 'small' as const }]
          : []),
      ];

      rows.push({ pattern, slots });
      i += slots.length;
      patternIndex += 1;
    }
  }

  return rows;
}
