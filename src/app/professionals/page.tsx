'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  GlassCard,
  EditorialHeadline,
  GlassButton,
} from "@/components/ui/glass";
import { Building2, Palette, CheckCircle, ArrowRight } from 'lucide-react';

export default function ProfessionalsPage() {
  const { data: session } = useSession();

  const benefits = [
    {
      title: 'Directory Listing',
      description: 'Get discovered by potential clients and collaborators in the Folio directory.',
    },
    {
      title: 'Project Management',
      description: 'Organize projects, track selections, and collaborate with your team.',
    },
    {
      title: 'Professional Network',
      description: 'Connect with other designers, vendors, and industry professionals.',
    },
  ];

  const premiumBenefits = [
    'AI-powered image generation',
    'Client connections & leads',
    'Affiliate revenue earning',
    'Premium presentation tools',
    'Priority support',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center mb-16">
          <EditorialHeadline size="2xl" className="mb-4">
            Join Folio as a Design Professional
          </EditorialHeadline>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect with clients, manage projects, and grow your business with Folio's
            professional platform for interior designers and vendors.
          </p>
        </div>

        {/* Path Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          <Link href="/professionals/join?type=DESIGNER" className="block group">
            <GlassCard
              variant="strong"
              padding="xl"
              rounded="2xl"
              className="h-full transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex flex-col h-full">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                  <Palette className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  Interior Designer
                </h3>
                <p className="text-gray-600 mb-6 flex-grow">
                  Create stunning projects, curate product selections, and connect
                  with vendors through our platform built for design professionals.
                </p>
                <div className="flex items-center text-blue-600 font-medium group-hover:gap-2 transition-all">
                  <span>Get started</span>
                  <ArrowRight className="w-5 h-5 ml-1" />
                </div>
              </div>
            </GlassCard>
          </Link>

          <Link href="/professionals/join?type=VENDOR" className="block group">
            <GlassCard
              variant="strong"
              padding="xl"
              rounded="2xl"
              className="h-full transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex flex-col h-full">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
                  <Building2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  Vendor / Manufacturer
                </h3>
                <p className="text-gray-600 mb-6 flex-grow">
                  Showcase your products, connect with designers, and track how
                  your products are being specified in real projects.
                </p>
                <div className="flex items-center text-green-600 font-medium group-hover:gap-2 transition-all">
                  <span>Get started</span>
                  <ArrowRight className="w-5 h-5 ml-1" />
                </div>
              </div>
            </GlassCard>
          </Link>
        </div>

        {/* Benefits Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-semibold text-center text-gray-900 mb-8">
            Why join Folio?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <GlassCard key={index} variant="subtle" padding="lg" rounded="xl">
                <h3 className="font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-sm text-gray-600">{benefit.description}</p>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Tiers Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-gray-900 mb-8">
            Organization Tiers
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Free Tier */}
            <GlassCard variant="subtle" padding="lg" rounded="xl">
              <div className="text-center mb-4">
                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                  Free
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-center mb-4">Getting Started</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Create organization profile</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Invite team members</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Basic project management</span>
                </li>
              </ul>
            </GlassCard>

            {/* Claimed Tier */}
            <GlassCard variant="subtle" padding="lg" rounded="xl">
              <div className="text-center mb-4">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                  Verified
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-center mb-4">Claimed Organization</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>All Free features</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Verified badge in directory</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Enhanced visibility</span>
                </li>
              </ul>
            </GlassCard>

            {/* Professional Tier */}
            <GlassCard variant="strong" padding="lg" rounded="xl" className="ring-2 ring-purple-200">
              <div className="text-center mb-4">
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                  Professional
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-center mb-4">Full Access</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                {premiumBenefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          {session ? (
            <Link href="/professionals/join">
              <GlassButton variant="primary" size="lg">
                Join or Create an Organization
              </GlassButton>
            </Link>
          ) : (
            <div className="space-y-4">
              <Link href="/auth/signup">
                <GlassButton variant="primary" size="lg">
                  Create an Account
                </GlassButton>
              </Link>
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link href="/auth/signin" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
