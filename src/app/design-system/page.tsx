"use client";

import { useState } from "react";
import {
  GlassCard,
  GlassModal,
  GlassModalHeader,
  GlassModalBody,
  GlassModalFooter,
  EditorialHeadline,
  GlassInput,
  GlassTextarea,
  GlassButton,
  GlassBadge,
  GlassDivider,
  PageContainer,
} from "@/components/ui/glass";

export default function DesignSystemPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 py-12">
      <PageContainer>
        <EditorialHeadline size="xl" className="mb-12">
          Folio Design System
        </EditorialHeadline>
        
        {/* Headlines */}
        <section className="mb-12">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Headlines</h3>
          <GlassCard>
            <div className="space-y-4">
              <EditorialHeadline size="2xl">2XL Headline</EditorialHeadline>
              <EditorialHeadline size="xl">XL Headline</EditorialHeadline>
              <EditorialHeadline size="lg">LG Headline</EditorialHeadline>
              <EditorialHeadline size="md">MD Headline</EditorialHeadline>
              <EditorialHeadline size="sm">SM Headline</EditorialHeadline>
              <EditorialHeadline size="xs">XS Headline</EditorialHeadline>
              <EditorialHeadline size="md" italic={false}>Non-italic Headline</EditorialHeadline>
              <EditorialHeadline size="md" muted>Muted Headline</EditorialHeadline>
            </div>
          </GlassCard>
        </section>
        
        {/* Cards */}
        <section className="mb-12">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Cards</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassCard variant="subtle">
              <p className="text-gray-700">Subtle variant</p>
            </GlassCard>
            <GlassCard variant="default">
              <p className="text-gray-700">Default variant</p>
            </GlassCard>
            <GlassCard variant="strong">
              <p className="text-gray-700">Strong variant</p>
            </GlassCard>
            <GlassCard variant="solid">
              <p className="text-gray-700">Solid variant</p>
            </GlassCard>
          </div>
        </section>
        
        {/* Inputs */}
        <section className="mb-12">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Inputs</h3>
          <GlassCard>
            <div className="space-y-4 max-w-md">
              <GlassInput placeholder="Default input..." />
              <GlassInput placeholder="Error state..." error />
              <GlassTextarea placeholder="Textarea..." />
              <GlassTextarea placeholder="Error textarea..." error />
            </div>
          </GlassCard>
        </section>
        
        {/* Buttons */}
        <section className="mb-12">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Buttons</h3>
          <GlassCard>
            <div className="flex flex-wrap gap-4">
              <GlassButton variant="primary">Primary</GlassButton>
              <GlassButton variant="secondary">Secondary</GlassButton>
              <GlassButton variant="ghost">Ghost</GlassButton>
              <GlassButton variant="danger">Danger</GlassButton>
              <GlassButton size="sm">Small</GlassButton>
              <GlassButton size="lg">Large</GlassButton>
              <GlassButton rounded="lg">Rounded LG</GlassButton>
              <GlassButton rounded="xl">Rounded XL</GlassButton>
              <GlassButton disabled>Disabled</GlassButton>
            </div>
          </GlassCard>
        </section>
        
        {/* Badges */}
        <section className="mb-12">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Badges</h3>
          <GlassCard>
            <div className="flex flex-wrap gap-2">
              <GlassBadge>Default</GlassBadge>
              <GlassBadge variant="success">Success</GlassBadge>
              <GlassBadge variant="warning">Warning</GlassBadge>
              <GlassBadge variant="error">Error</GlassBadge>
              <GlassBadge variant="info">Info</GlassBadge>
            </div>
          </GlassCard>
        </section>
        
        {/* Divider */}
        <section className="mb-12">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Divider</h3>
          <GlassCard>
            <p className="text-gray-700">Content above</p>
            <GlassDivider />
            <p className="text-gray-700">Content below</p>
          </GlassCard>
        </section>
        
        {/* Modal */}
        <section className="mb-12">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Modal</h3>
          <GlassCard>
            <GlassButton onClick={() => setModalOpen(true)}>
              Open Glass Modal
            </GlassButton>
          </GlassCard>
        </section>
        
        {/* Modal Component */}
        <GlassModal open={modalOpen} onOpenChange={setModalOpen} size="lg">
          <GlassModalHeader>
            <EditorialHeadline size="md">Modal Example</EditorialHeadline>
          </GlassModalHeader>
          <GlassModalBody>
            <p className="text-gray-700 mb-4">
              This is a glass modal with the full design system styling.
            </p>
            <GlassInput placeholder="Try an input..." className="mb-4" />
            <GlassTextarea placeholder="And a textarea..." />
          </GlassModalBody>
          <GlassModalFooter>
            <div className="flex justify-end gap-3">
              <GlassButton variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </GlassButton>
              <GlassButton variant="primary" onClick={() => setModalOpen(false)}>
                Confirm
              </GlassButton>
            </div>
          </GlassModalFooter>
        </GlassModal>
        
      </PageContainer>
    </div>
  );
}

