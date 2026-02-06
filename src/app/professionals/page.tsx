'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaPalette, FaStore, FaArrowRight } from 'react-icons/fa';
import { GlassCard, GlassButton, EditorialHeadline } from '@/components/ui/glass';

export default function ProfessionalsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleRoleSelect = (role: 'designer' | 'vendor') => {
    if (!session) {
      router.push(`/auth/signup?callbackUrl=/professionals/${role}/organization`);
    } else {
      router.push(`/professionals/${role}/organization`);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#FAF8F5' }}
    >
      {/* Hero Section */}
      <section className="relative py-24 md:py-32 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <EditorialHeadline
              as="h1"
              size="xl"
              className="mb-6 text-folio-ink"
            >
              Join the Folio Community
            </EditorialHeadline>
            <p className="text-lg md:text-xl text-folio-stone-700 font-sans max-w-xl mx-auto leading-relaxed">
              Connect with design professionals, showcase your work, and grow your business.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Role Selection Section */}
      <section className="px-4 pb-24 md:pb-32">
        <div className="max-w-3xl mx-auto">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-center text-folio-stone-500 font-sans text-sm uppercase tracking-wider mb-10"
          >
            Select your role to continue
          </motion.p>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {/* Designer Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div
                onClick={() => handleRoleSelect('designer')}
                className="group cursor-pointer bg-white rounded-2xl p-8 md:p-10 border border-folio-stone-100 hover:border-folio-stone-300 transition-all duration-300 hover:shadow-folio2 h-full flex flex-col"
              >
                <div className="flex-1">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mb-6 group-hover:bg-purple-100 transition-colors">
                    <FaPalette className="w-6 h-6 text-purple-600" />
                  </div>

                  {/* Title */}
                  <h2 className="font-serif text-2xl md:text-3xl text-folio-ink mb-3">
                    Interior Designer
                  </h2>

                  {/* Value Proposition */}
                  <p className="font-sans text-folio-stone-600 leading-relaxed mb-8">
                    Showcase your portfolio and connect with clients looking for design expertise.
                  </p>
                </div>

                {/* CTA Button */}
                <button className="w-full py-3.5 px-6 rounded-full bg-folio-ink text-white font-sans font-medium flex items-center justify-center gap-2 group-hover:opacity-90 transition-colors">
                  Continue as Designer
                  <FaArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>

            {/* Vendor Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div
                onClick={() => handleRoleSelect('vendor')}
                className="group cursor-pointer bg-white rounded-2xl p-8 md:p-10 border border-folio-stone-100 hover:border-folio-stone-300 transition-all duration-300 hover:shadow-folio2 h-full flex flex-col"
              >
                <div className="flex-1">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-6 group-hover:bg-emerald-100 transition-colors">
                    <FaStore className="w-6 h-6 text-emerald-600" />
                  </div>

                  {/* Title */}
                  <h2 className="font-serif text-2xl md:text-3xl text-folio-ink mb-3">
                    Vendor / Manufacturer
                  </h2>

                  {/* Value Proposition */}
                  <p className="font-sans text-folio-stone-600 leading-relaxed mb-8">
                    List your products and connect with designers who specify your pieces.
                  </p>
                </div>

                {/* CTA Button */}
                <button className="w-full py-3.5 px-6 rounded-full bg-folio-ink text-white font-sans font-medium flex items-center justify-center gap-2 group-hover:opacity-90 transition-colors">
                  Continue as Vendor
                  <FaArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </div>

          {/* Sign in link for unauthenticated users */}
          {!session && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="text-center mt-12 text-folio-stone-600 font-sans"
            >
              Already have an account?{' '}
              <Link
                href="/auth/signin?callbackUrl=/professionals"
                className="text-folio-ink underline underline-offset-4 hover:no-underline"
              >
                Sign in
              </Link>
            </motion.p>
          )}
        </div>
      </section>
    </div>
  );
}
