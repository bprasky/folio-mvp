'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import MagazineFrame from './MagazineFrame';
import MagazineLoginScreen from '../auth/MagazineLoginScreen';
import MagazineLoadingAnimation from './MagazineLoadingAnimation';
import LogoDriftAnimation from './LogoDriftAnimation';

interface MagazineAppWrapperProps {
  children: React.ReactNode;
}

export default function MagazineAppWrapper({ children }: MagazineAppWrapperProps) {
  const { data: session, status } = useSession();
  const [showLogin, setShowLogin] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [showLogoDrift, setShowLogoDrift] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    // Check if this is a first visit (no session and no previous visit)
    const hasVisited = localStorage.getItem('folio-visited');
    if (!hasVisited && status === 'unauthenticated') {
      setIsFirstVisit(true);
      setShowLogin(true);
    } else if (status === 'loading') {
      // Show loading animation for existing sessions
      setShowLoading(true);
    }
  }, [status]);

  const handleLogin = async (credentials: { email: string; password: string }) => {
    // Handle login logic here
    console.log('Login attempt:', credentials);
    // For now, just simulate successful login
    setShowLogin(false);
    setShowLogoDrift(true);
    localStorage.setItem('folio-visited', 'true');
  };

  const handleLoadingComplete = () => {
    setShowLoading(false);
  };

  const handleLogoDriftComplete = () => {
    setShowLogoDrift(false);
  };

  // Show login screen for first-time visitors
  if (showLogin) {
    return (
      <MagazineFrame isLoggedIn={false}>
        <MagazineLoginScreen onLogin={handleLogin} />
      </MagazineFrame>
    );
  }

  // Show loading animation for existing sessions
  if (showLoading) {
    return (
      <MagazineFrame isLoggedIn={true} showLoadingAnimation={true}>
        <MagazineLoadingAnimation onComplete={handleLoadingComplete} />
      </MagazineFrame>
    );
  }

  // Show main app with magazine frame
  return (
    <MagazineFrame isLoggedIn={!!session}>
      {showLogoDrift && (
        <LogoDriftAnimation 
          isVisible={showLogoDrift} 
          onComplete={handleLogoDriftComplete} 
        />
      )}
      {children}
    </MagazineFrame>
  );
}





