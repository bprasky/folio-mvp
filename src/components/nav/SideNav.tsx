'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import BrandMark from './BrandMark';

const Item = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="block px-3 py-2 rounded-md hover:bg-white/5">
    {children}
  </Link>
);

export default function SideNav() {
  return (
    <motion.aside
      layout
      className="fixed left-0 top-0 bottom-0 z-40 w-68 max-w-[240px] px-3 py-4
                 bg-[rgb(22,22,22,0.92)] backdrop-blur-md border-r border-white/10 text-[14px] text-neutral-200"
      initial={{ x: -24, opacity: 0 }} 
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: .28, ease: [0.22,0.61,0.36,1] }}
    >
      <div className="px-2 pb-3 flex items-center gap-2">
        <BrandMark variant="metrics" />
      </div>
      <nav className="space-y-1">
        <Item href="/dashboard">Dashboard</Item>
        <Item href="/analytics">Analytics</Item>
        <Item href="/projects">Projects</Item>
        <Item href="/vendor">Vendors</Item>
      </nav>
    </motion.aside>
  );
}





