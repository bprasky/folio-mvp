"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ProjectFolderContextType {
  currentFolderId: string | null;
  setCurrentFolderId: (folderId: string | null) => void;
}

const ProjectFolderContext = createContext<ProjectFolderContextType | undefined>(undefined);

export function ProjectFolderProvider({ children }: { children: ReactNode }) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('currentFolderId');
      if (stored) {
        setCurrentFolderId(stored);
      }
    }
  }, []);

  // Persist to localStorage when it changes
  const handleSetCurrentFolderId = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    if (typeof window !== 'undefined') {
      if (folderId) {
        localStorage.setItem('currentFolderId', folderId);
      } else {
        localStorage.removeItem('currentFolderId');
      }
    }
  };

  return (
    <ProjectFolderContext.Provider
      value={{
        currentFolderId,
        setCurrentFolderId: handleSetCurrentFolderId,
      }}
    >
      {children}
    </ProjectFolderContext.Provider>
  );
}

export function useProjectFolder() {
  const context = useContext(ProjectFolderContext);
  if (context === undefined) {
    throw new Error('useProjectFolder must be used within a ProjectFolderProvider');
  }
  return context;
}
