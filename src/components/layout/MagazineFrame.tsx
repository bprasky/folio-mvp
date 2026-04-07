'use client';
import React from 'react';
import { motion } from 'framer-motion';

interface MagazineFrameProps {
  children: React.ReactNode;
  isLoggedIn?: boolean;
  showLoadingAnimation?: boolean;
}

export default function MagazineFrame({ 
  children, 
  isLoggedIn = false, 
  showLoadingAnimation = false 
}: MagazineFrameProps) {
  return (
    <div className="min-h-screen bg-surface-elevated relative">
      {/* Magazine Frame */}
      <div className="absolute inset-0 pointer-events-none z-50">
        {/* Top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-stone-300 via-stone-400 to-stone-300" />
        
        {/* Bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-stone-300 via-stone-400 to-stone-300" />
        
        {/* Left border */}
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-stone-300 via-stone-400 to-stone-300" />
        
        {/* Right border */}
        <div className="absolute top-0 bottom-0 right-0 w-1 bg-gradient-to-b from-stone-300 via-stone-400 to-stone-300" />
        
        {/* Corner decorations */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-folio-border-strong" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-folio-border-strong" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-folio-border-strong" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-folio-border-strong" />
      </div>

      {/* Loading Animation for existing sessions */}
      {showLoadingAnimation && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2, delay: 0.5 }}
          className="fixed inset-0 z-40 bg-surface-elevated flex items-center justify-center"
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="mb-8"
            >
              <h1 className="text-6xl font-serif text-folio-text-primary mb-2">FOLIO</h1>
              <div className="w-24 h-0.5 bg-stone-600 mx-auto"></div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-folio-text-secondary text-lg"
            >
              Opening your design magazine...
            </motion.div>
            
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 0.8 }}
              className="mt-6 h-0.5 bg-stone-400"
            />
          </div>
        </motion.div>
      )}

      {/* Main content with magazine-style padding */}
      <div className="relative z-10" style={{ 
        paddingTop: '8px', 
        paddingBottom: '8px', 
        paddingLeft: '8px', 
        paddingRight: '8px' 
      }}>
        {children}
      </div>
    </div>
  );
}





