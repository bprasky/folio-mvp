'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaPalette, FaStore, FaCheckCircle, FaArrowRight } from 'react-icons/fa';
import { GlassCard, GlassButton, EditorialHeadline } from '@/components/ui/glass';

export default function ProfessionalsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const features = {
    unclaimed: [
      'Directory listing for visibility',
      'Invite team members',
      'Basic organization profile',
    ],
    claimed: [
      'Verified badge in directory',
      'Enhanced profile features',
      'All unclaimed features',
    ],
    professional: [
      'Affiliate tags for revenue',
      'AI image generation',
      'Client connection tools',
      'Premium support',
      'All claimed features',
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-folio-bg via-white to-folio-stone-100">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <EditorialHeadline size="2xl" className="mb-6">
              Join Folio as a Design Professional
            </EditorialHeadline>
            <p className="text-xl text-folio-stone-600 max-w-2xl mx-auto mb-12">
              Create your organization profile, showcase your work, and connect with
              clients and vendors in the design community.
            </p>
          </motion.div>

          {/* Role Selection Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Designer Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <GlassCard
                variant="strong"
                padding="xl"
                rounded="2xl"
                className="h-full hover:shadow-folio2 transition-shadow cursor-pointer group"
                onClick={() => router.push('/professionals/join?type=designer')}
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <FaPalette className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="text-2xl font-semibold text-folio-ink mb-3">
                    Interior Designer
                  </h3>
                  <p className="text-folio-stone-600 mb-6">
                    Showcase your portfolio, tag products in projects, and build
                    your professional profile.
                  </p>
                  <ul className="text-left space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-folio-stone-700">
                      <FaCheckCircle className="text-green-500 flex-shrink-0" />
                      <span>Upload and publish projects</span>
                    </li>
                    <li className="flex items-center gap-2 text-folio-stone-700">
                      <FaCheckCircle className="text-green-500 flex-shrink-0" />
                      <span>Tag products with affiliate links</span>
                    </li>
                    <li className="flex items-center gap-2 text-folio-stone-700">
                      <FaCheckCircle className="text-green-500 flex-shrink-0" />
                      <span>Connect with clients</span>
                    </li>
                  </ul>
                  <GlassButton
                    variant="primary"
                    size="lg"
                    className="w-full group-hover:bg-purple-600"
                  >
                    Join as Designer
                    <FaArrowRight className="ml-2" />
                  </GlassButton>
                </div>
              </GlassCard>
            </motion.div>

            {/* Vendor Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <GlassCard
                variant="strong"
                padding="xl"
                rounded="2xl"
                className="h-full hover:shadow-folio2 transition-shadow cursor-pointer group"
                onClick={() => router.push('/professionals/join?type=vendor')}
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <FaStore className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-semibold text-folio-ink mb-3">
                    Vendor / Manufacturer
                  </h3>
                  <p className="text-folio-stone-600 mb-6">
                    List your products, track where they appear in projects,
                    and connect with designers.
                  </p>
                  <ul className="text-left space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-folio-stone-700">
                      <FaCheckCircle className="text-green-500 flex-shrink-0" />
                      <span>Product catalog management</span>
                    </li>
                    <li className="flex items-center gap-2 text-folio-stone-700">
                      <FaCheckCircle className="text-green-500 flex-shrink-0" />
                      <span>Track product placements</span>
                    </li>
                    <li className="flex items-center gap-2 text-folio-stone-700">
                      <FaCheckCircle className="text-green-500 flex-shrink-0" />
                      <span>Designer outreach tools</span>
                    </li>
                  </ul>
                  <GlassButton
                    variant="primary"
                    size="lg"
                    className="w-full group-hover:bg-green-600"
                  >
                    Join as Vendor
                    <FaArrowRight className="ml-2" />
                  </GlassButton>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Tier Comparison */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-center text-folio-ink mb-12">
            Organization Tiers
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Unclaimed Tier */}
            <GlassCard variant="subtle" padding="lg" rounded="xl">
              <div className="text-center mb-6">
                <span className="inline-block bg-folio-stone-100 text-folio-stone-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  Unclaimed
                </span>
                <h3 className="text-xl font-semibold text-folio-ink">
                  Directory Listing
                </h3>
                <p className="text-3xl font-bold text-folio-ink mt-2">Free</p>
              </div>
              <ul className="space-y-3">
                {features.unclaimed.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-folio-stone-700">
                    <FaCheckCircle className="text-folio-stone-400 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>

            {/* Claimed Tier */}
            <GlassCard variant="subtle" padding="lg" rounded="xl">
              <div className="text-center mb-6">
                <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  Claimed
                </span>
                <h3 className="text-xl font-semibold text-folio-ink">
                  Verified Organization
                </h3>
                <p className="text-3xl font-bold text-folio-ink mt-2">Free</p>
              </div>
              <ul className="space-y-3">
                {features.claimed.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-folio-stone-700">
                    <FaCheckCircle className="text-blue-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>

            {/* Professional Tier */}
            <GlassCard
              variant="strong"
              padding="lg"
              rounded="xl"
              className="border-2 border-purple-200 relative"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Recommended
                </span>
              </div>
              <div className="text-center mb-6 mt-2">
                <span className="inline-block bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  Professional
                </span>
                <h3 className="text-xl font-semibold text-folio-ink">
                  Full Platform Access
                </h3>
                <p className="text-3xl font-bold text-folio-ink mt-2">
                  $49<span className="text-base font-normal">/mo</span>
                </p>
              </div>
              <ul className="space-y-3">
                {features.professional.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-folio-stone-700">
                    <FaCheckCircle className="text-purple-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-semibold text-folio-ink mb-4">
            Ready to get started?
          </h2>
          <p className="text-folio-stone-600 mb-8">
            {session
              ? 'Choose your organization type above to begin.'
              : 'Create a Folio account first, then set up your organization.'}
          </p>
          {!session && (
            <Link href="/auth/signup">
              <GlassButton variant="primary" size="lg">
                Create Account
                <FaArrowRight className="ml-2" />
              </GlassButton>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
