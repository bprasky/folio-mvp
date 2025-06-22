'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'homeowner' | 'designer' | 'vendor' | 'student';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isLoading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
  const [role, setRoleState] = useState<UserRole>('homeowner');
  const [isLoading, setIsLoading] = useState(true);

  // Load role from localStorage on mount
  useEffect(() => {
    const savedRole = localStorage.getItem('userRole') as UserRole;
    if (savedRole && ['homeowner', 'designer', 'vendor'].includes(savedRole)) {
      setRoleState(savedRole);
    }
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

  const value = {
    role,
    setRole,
    isLoading
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