'use client';

import { createContext, useContext, useState, ReactNode } from "react";

type DrawerSection = "roomPhase"|"timeline"|"geo"|"designers"|"products";

type DrawerState = { 
  open: boolean; 
  section?: DrawerSection; 
  anchorKey?: string; 
};

interface AnalyticsDrawerContextType {
  state: DrawerState;
  openDrawer: (params: { section: DrawerSection; anchorKey?: string }) => void;
  closeDrawer: () => void;
}

const AnalyticsDrawerContext = createContext<AnalyticsDrawerContextType | null>(null);

export function AnalyticsDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DrawerState>({ open: false });
  
  const openDrawer = ({ section, anchorKey }: { section: DrawerSection; anchorKey?: string }) =>
    setState({ open: true, section, anchorKey });
    
  const closeDrawer = () => setState({ open: false });
  
  return (
    <AnalyticsDrawerContext.Provider value={{ state, openDrawer, closeDrawer }}>
      {children}
    </AnalyticsDrawerContext.Provider>
  );
}

export function useAnalyticsDrawer() {
  const context = useContext(AnalyticsDrawerContext);
  if (!context) {
    throw new Error("useAnalyticsDrawer must be used within AnalyticsDrawerProvider");
  }
  return context;
}