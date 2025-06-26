'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'homeowner' | 'designer' | 'vendor' | 'student' | 'admin';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isLoading: boolean;
  activeProfileId?: string;
  setActiveProfileId: (id: string) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
  const [role, setRoleState] = useState<UserRole>('homeowner');
  const [isLoading, setIsLoading] = useState(true);
  const [activeProfileId, setActiveProfileIdState] = useState<string>('');

  // Load role from localStorage on mount
  useEffect(() => {
    const savedRole = localStorage.getItem('userRole') as UserRole;
    const savedProfileId = localStorage.getItem('activeProfileId') || '';
    if (savedRole && ['homeowner', 'designer', 'vendor', 'student', 'admin'].includes(savedRole)) {
      setRoleState(savedRole);
    }
    setActiveProfileIdState(savedProfileId);
    setIsLoading(false);
  }, []);

  // Save role to localStorage when it changes
  const setRole = (newRole: UserRole) => {
    setIsLoading(true);
    
    // Simulate a brief loading delay for better UX
    setTimeout(() => {
      localStorage.setItem('userRole', newRole);
      setRoleState(newRole);
      setIsLoading(false);
    }, 300);
  };

  const setActiveProfileId = (id: string) => {
    localStorage.setItem('activeProfileId', id);
    setActiveProfileIdState(id);
  };

  const value = {
    role,
    setRole,
    isLoading,
    activeProfileId,
    setActiveProfileId
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
} 