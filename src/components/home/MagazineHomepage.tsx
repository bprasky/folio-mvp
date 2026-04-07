'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, Users, TrendingUp } from 'lucide-react';

interface MagazineHomepageProps {
  onEnterApp: () => void;
}

export default function MagazineHomepage({ onEnterApp }: MagazineHomepageProps) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Show content after a brief delay to simulate magazine opening
    const timer = setTimeout(() => setShowContent(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-stone-200 relative overflow-hidden">
      {/* Magazine Cover Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-32 h-32 border border-folio-border-strong rotate-12" />
        <div className="absolute top-40 right-32 w-24 h-24 border border-folio-border-strong rotate-45" />
        <div className="absolute bottom-32 left-32 w-40 h-40 border border-folio-border-strong rotate-12" />
        <div className="absolute bottom-20 right-20 w-28 h-28 border border-folio-border-strong rotate-45" />
      </div>

      {/* Hero Section - Magazine Cover Style */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className="max-w-6xl mx-auto text-center">
          {/* Folio Logo */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="mb-8"
          >
            <h1 className="text-8xl font-serif text-folio-text-primary tracking-wider mb-4">
              FOLIO
            </h1>
            <div className="w-32 h-0.5 bg-stone-600 mx-auto mb-4"></div>
            <div className="text-xl text-folio-text-secondary tracking-widest uppercase">
              Design Intelligence Magazine
            </div>
          </motion.div>

          {/* Main Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="mb-12"
          >
            <h2 className="text-5xl font-serif text-folio-text-primary mb-6 leading-tight">
              Where Architecture Meets
              <br />
              <span className="text-folio-text-secondary">Innovation</span>
            </h2>
            <p className="text-xl text-folio-text-secondary max-w-2xl mx-auto leading-relaxed">
              Discover the intersection of design, data, and intelligence. 
              Your gateway to the future of architectural innovation.
            </p>
          </motion.div>

          {/* Feature Cards */}
          {showContent && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="grid md:grid-cols-3 gap-8 mb-12"
            >
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-lg border border-folio-border-strong shadow-lg">
                <BookOpen className="w-12 h-12 text-folio-text-secondary mx-auto mb-4" />
                <h3 className="text-xl font-serif text-folio-text-primary mb-2">Design Intelligence</h3>
                <p className="text-folio-text-secondary">
                  Access curated insights and data-driven design solutions.
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-lg border border-folio-border-strong shadow-lg">
                <Users className="w-12 h-12 text-folio-text-secondary mx-auto mb-4" />
                <h3 className="text-xl font-serif text-folio-text-primary mb-2">Community</h3>
                <p className="text-folio-text-secondary">
                  Connect with leading architects and design professionals.
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-lg border border-folio-border-strong shadow-lg">
                <TrendingUp className="w-12 h-12 text-folio-text-secondary mx-auto mb-4" />
                <h3 className="text-xl font-serif text-folio-text-primary mb-2">Analytics</h3>
                <p className="text-folio-text-secondary">
                  Track trends and measure the impact of your designs.
                </p>
              </div>
            </motion.div>
          )}

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Button
              onClick={onEnterApp}
              className="bg-stone-800 hover:bg-stone-700 text-white px-8 py-4 text-lg rounded-lg shadow-lg"
            >
              Enter the Magazine
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>

          {/* Magazine Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="absolute bottom-8 right-8 text-right"
          >
            <div className="text-folio-text-secondary text-sm">
              <div>VOL. 2024</div>
              <div className="text-xs mt-1">DESIGN INTELLIGENCE EDITION</div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}





