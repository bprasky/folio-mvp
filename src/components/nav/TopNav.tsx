'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import BrandMark from './BrandMark';

export default function TopNav() {
  return (
    <motion.header
      layout
      className="sticky top-0 z-40 h-14 px-4 md:px-8 flex items-center justify-between
                 bg-[rgba(250,249,247,0.85)] backdrop-blur-md border-b border-black/5"
      initial={{ y: -16, opacity: 0 }} 
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: .28, ease: [0.22,0.61,0.36,1] }}
    >
      <div className="flex items-center gap-6">
        <Link href="/home" className="font-serif">
          <BrandMark />
        </Link>
        <nav className="hidden md:flex items-center gap-5 text-sm text-neutral-700">
          <Link href="/discover">Discover</Link>
          <Link href="/editorials">Editorials</Link>
          <Link href="/designers">Designers</Link>
          <Link href="/professionals" className="text-neutral-500 hover:text-neutral-700">Professionals</Link>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/login" className="text-sm">Sign in</Link>
      </div>
    </motion.header>
  );
}





