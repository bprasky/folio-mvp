import type { ReactNode } from 'react';
import { ProjectFolderProvider } from '@/contexts/ProjectFolderContext';

export default function FoldersLayout({ children }: { children: ReactNode }) {
  return <ProjectFolderProvider>{children}</ProjectFolderProvider>;
}
