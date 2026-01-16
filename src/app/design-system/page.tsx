"use client";

import { useState } from "react";
import { RidgeCard, RidgeCardHeader, RidgeCardTitle, RidgeCardDescription, RidgeCardContent, RidgeCardFooter, StatsCard } from "@/components/ui/ridge-card";
import { Button, AccentButton, RidgeButton, PillButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RidgeToggleGroup, RidgeToggleItem } from "@/components/ui/ridge-toggle";

export default function DesignSystemPage() {
  const [toggleValue, setToggleValue] = useState("option1");

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-12">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="folio-h1 mb-4">Folio Design System</h1>
        <p className="folio-body mb-12">
          A neumorphic design system featuring double-ridge borders, warm shadows, and editorial typography.
        </p>

        {/* Color Palette */}
        <section className="mb-12">
          <h3 className="folio-meta uppercase tracking-wider mb-4">Color Palette</h3>
          <RidgeCard>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="w-full h-16 rounded-lg bg-[var(--bg-base)] border border-[var(--ridge-outer)]" />
                <p className="folio-meta">--bg-base</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-16 rounded-lg bg-[var(--bg-elevated)] border border-[var(--ridge-outer)]" />
                <p className="folio-meta">--bg-elevated</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-16 rounded-lg bg-[var(--accent)]" />
                <p className="folio-meta">--accent</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-16 rounded-lg bg-[var(--text-primary)]" />
                <p className="folio-meta">--text-primary</p>
              </div>
            </div>
            <div className="h-px bg-[var(--ridge-outer)] my-6" />
            <div className="space-y-2">
              <p className="text-[var(--text-primary)] folio-ui">Text Primary</p>
              <p className="text-[var(--text-secondary)] folio-ui">Text Secondary</p>
              <p className="text-[var(--text-tertiary)] folio-ui">Text Tertiary</p>
              <p className="text-[var(--accent)] folio-ui">Accent Color</p>
            </div>
          </RidgeCard>
        </section>

        {/* Typography */}
        <section className="mb-12">
          <h3 className="folio-meta uppercase tracking-wider mb-4">Typography</h3>
          <RidgeCard>
            <div className="space-y-6">
              <div>
                <p className="folio-meta mb-1">.folio-h1</p>
                <h1 className="folio-h1">Editorial Headline One</h1>
              </div>
              <div className="h-px bg-[var(--ridge-outer)]" />
              <div>
                <p className="folio-meta mb-1">.folio-h2</p>
                <h2 className="folio-h2">Section Headline Two</h2>
              </div>
              <div className="h-px bg-[var(--ridge-outer)]" />
              <div>
                <p className="folio-meta mb-1">.folio-h3</p>
                <h3 className="folio-h3">Subsection Headline Three</h3>
              </div>
              <div className="h-px bg-[var(--ridge-outer)]" />
              <div>
                <p className="folio-meta mb-1">.folio-quote</p>
                <p className="folio-quote">&ldquo;Design is not just what it looks like. Design is how it works.&rdquo;</p>
              </div>
              <div className="h-px bg-[var(--ridge-outer)]" />
              <div>
                <p className="folio-meta mb-1">.folio-body</p>
                <p className="folio-body">
                  Body text for longer content. The Folio design system uses Instrument Sans for body copy,
                  providing excellent readability at various sizes. Line height is optimized for comfortable reading.
                </p>
              </div>
              <div className="h-px bg-[var(--ridge-outer)]" />
              <div>
                <p className="folio-meta mb-1">.folio-ui</p>
                <span className="folio-ui">UI Label Text</span>
              </div>
              <div className="h-px bg-[var(--ridge-outer)]" />
              <div>
                <p className="folio-meta mb-1">.folio-meta</p>
                <span className="folio-meta">Meta / Caption Text</span>
              </div>
            </div>
          </RidgeCard>
        </section>

        {/* Ridge Cards */}
        <section className="mb-12">
          <h3 className="folio-meta uppercase tracking-wider mb-4">Ridge Cards</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <RidgeCard size="sm">
              <RidgeCardHeader>
                <RidgeCardTitle>Small Card</RidgeCardTitle>
                <RidgeCardDescription>size=&quot;sm&quot;</RidgeCardDescription>
              </RidgeCardHeader>
              <RidgeCardContent>
                <p className="folio-body">Compact ridge card with smaller border radius.</p>
              </RidgeCardContent>
            </RidgeCard>

            <RidgeCard>
              <RidgeCardHeader>
                <RidgeCardTitle>Default Card</RidgeCardTitle>
                <RidgeCardDescription>size=&quot;default&quot;</RidgeCardDescription>
              </RidgeCardHeader>
              <RidgeCardContent>
                <p className="folio-body">Standard ridge card with neumorphic shadows.</p>
              </RidgeCardContent>
            </RidgeCard>

            <RidgeCard size="lg">
              <RidgeCardHeader>
                <RidgeCardTitle>Large Card</RidgeCardTitle>
                <RidgeCardDescription>size=&quot;lg&quot;</RidgeCardDescription>
              </RidgeCardHeader>
              <RidgeCardContent>
                <p className="folio-body">Large ridge card with enhanced shadow depth.</p>
              </RidgeCardContent>
            </RidgeCard>
          </div>

          <div className="mt-6">
            <RidgeCard padding="xl">
              <RidgeCardHeader>
                <RidgeCardTitle>Card with Footer</RidgeCardTitle>
                <RidgeCardDescription>Demonstrating the full card structure</RidgeCardDescription>
              </RidgeCardHeader>
              <RidgeCardContent>
                <p className="folio-body">
                  Ridge cards feature a double-border pattern with an outer and inner border,
                  creating depth through the neumorphic shadow system.
                </p>
              </RidgeCardContent>
              <RidgeCardFooter className="justify-end gap-3">
                <Button variant="ghost">Cancel</Button>
                <Button variant="accent">Save Changes</Button>
              </RidgeCardFooter>
            </RidgeCard>
          </div>
        </section>

        {/* Stats Cards */}
        <section className="mb-12">
          <h3 className="folio-meta uppercase tracking-wider mb-4">Stats Cards</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard value="2,847" label="Total Views" />
            <StatsCard
              value="156"
              label="New Followers"
              trend={{ value: 12, direction: "up" }}
            />
            <StatsCard
              value="$4,230"
              label="Revenue"
              trend={{ value: 8, direction: "up" }}
            />
            <StatsCard
              value="23"
              label="Pending Orders"
              trend={{ value: 3, direction: "down" }}
            />
          </div>
        </section>

        {/* Buttons */}
        <section className="mb-12">
          <h3 className="folio-meta uppercase tracking-wider mb-4">Buttons</h3>
          <RidgeCard>
            <div className="space-y-6">
              <div>
                <p className="folio-meta mb-3">Accent Button - Primary CTA</p>
                <div className="flex flex-wrap gap-3">
                  <AccentButton size="sm">Small</AccentButton>
                  <AccentButton>Default</AccentButton>
                  <AccentButton size="lg">Large</AccentButton>
                  <AccentButton disabled>Disabled</AccentButton>
                </div>
              </div>

              <div className="h-px bg-[var(--ridge-outer)]" />

              <div>
                <p className="folio-meta mb-3">Ridge Button - Secondary</p>
                <div className="flex flex-wrap gap-3">
                  <RidgeButton size="sm">Small</RidgeButton>
                  <RidgeButton>Default</RidgeButton>
                  <RidgeButton size="lg">Large</RidgeButton>
                  <RidgeButton disabled>Disabled</RidgeButton>
                </div>
              </div>

              <div className="h-px bg-[var(--ridge-outer)]" />

              <div>
                <p className="folio-meta mb-3">Pill Button - Rounded Variant</p>
                <div className="flex flex-wrap gap-3">
                  <PillButton size="sm">Small Pill</PillButton>
                  <PillButton>Default Pill</PillButton>
                  <PillButton size="lg">Large Pill</PillButton>
                </div>
              </div>

              <div className="h-px bg-[var(--ridge-outer)]" />

              <div>
                <p className="folio-meta mb-3">Other Variants</p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="outline">Outline</Button>
                </div>
              </div>
            </div>
          </RidgeCard>
        </section>

        {/* Inputs */}
        <section className="mb-12">
          <h3 className="folio-meta uppercase tracking-wider mb-4">Form Inputs</h3>
          <RidgeCard>
            <div className="space-y-6 max-w-md">
              <div>
                <label className="folio-ui block mb-2">Default Input</label>
                <Input placeholder="Enter your name..." />
              </div>

              <div>
                <label className="folio-ui block mb-2">Input with Error</label>
                <Input placeholder="Invalid input..." error />
                <p className="folio-meta text-red-500 mt-1">This field is required</p>
              </div>

              <div className="h-px bg-[var(--ridge-outer)]" />

              <div>
                <label className="folio-ui block mb-2">Textarea</label>
                <Textarea placeholder="Write your message here..." rows={4} />
              </div>

              <div>
                <label className="folio-ui block mb-2">Textarea with Error</label>
                <Textarea placeholder="Invalid content..." error rows={3} />
              </div>
            </div>
          </RidgeCard>
        </section>

        {/* Toggle Group */}
        <section className="mb-12">
          <h3 className="folio-meta uppercase tracking-wider mb-4">Toggle Group</h3>
          <RidgeCard>
            <div className="space-y-6">
              <div>
                <p className="folio-meta mb-3">Simple Toggle</p>
                <RidgeToggleGroup value={toggleValue} onValueChange={setToggleValue}>
                  <RidgeToggleItem value="option1">Option 1</RidgeToggleItem>
                  <RidgeToggleItem value="option2">Option 2</RidgeToggleItem>
                  <RidgeToggleItem value="option3">Option 3</RidgeToggleItem>
                </RidgeToggleGroup>
                <p className="folio-meta mt-2">Selected: {toggleValue}</p>
              </div>

              <div className="h-px bg-[var(--ridge-outer)]" />

              <div>
                <p className="folio-meta mb-3">View Toggle Example</p>
                <RidgeToggleGroup value="grid" onValueChange={() => {}}>
                  <RidgeToggleItem value="grid">Grid View</RidgeToggleItem>
                  <RidgeToggleItem value="list">List View</RidgeToggleItem>
                </RidgeToggleGroup>
              </div>

              <div className="h-px bg-[var(--ridge-outer)]" />

              <div>
                <p className="folio-meta mb-3">Time Range Toggle</p>
                <RidgeToggleGroup value="week" onValueChange={() => {}}>
                  <RidgeToggleItem value="day">Day</RidgeToggleItem>
                  <RidgeToggleItem value="week">Week</RidgeToggleItem>
                  <RidgeToggleItem value="month">Month</RidgeToggleItem>
                  <RidgeToggleItem value="year">Year</RidgeToggleItem>
                </RidgeToggleGroup>
              </div>
            </div>
          </RidgeCard>
        </section>

        {/* Badges */}
        <section className="mb-12">
          <h3 className="folio-meta uppercase tracking-wider mb-4">Badges</h3>
          <RidgeCard>
            <p className="folio-meta mb-3">Use ridge-card classes with compact sizing for badge-like elements</p>
            <div className="flex flex-wrap gap-3">
              <span className="ridge-card ridge-card-sm px-3 py-1 text-sm text-[var(--text-primary)]">
                Default
              </span>
              <span className="ridge-card ridge-card-sm px-3 py-1 text-sm text-[var(--accent)]">
                Accent
              </span>
              <span className="ridge-card ridge-card-sm px-3 py-1 text-sm text-green-600">
                Success
              </span>
              <span className="ridge-card ridge-card-sm px-3 py-1 text-sm text-amber-600">
                Warning
              </span>
              <span className="ridge-card ridge-card-sm px-3 py-1 text-sm text-red-600">
                Error
              </span>
            </div>
          </RidgeCard>
        </section>

        {/* Dividers */}
        <section className="mb-12">
          <h3 className="folio-meta uppercase tracking-wider mb-4">Dividers</h3>
          <RidgeCard>
            <p className="folio-body">Content above the divider</p>
            <div className="h-px bg-[var(--ridge-outer)] my-4" />
            <p className="folio-body">Content below the divider</p>
            <div className="h-px bg-[var(--ridge-outer)] my-4" />
            <p className="folio-meta">
              Use: &lt;div className=&quot;h-px bg-[var(--ridge-outer)]&quot; /&gt;
            </p>
          </RidgeCard>
        </section>

        {/* CSS Variables Reference */}
        <section className="mb-12">
          <h3 className="folio-meta uppercase tracking-wider mb-4">CSS Variables Reference</h3>
          <RidgeCard>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="folio-h3 mb-4">Colors</h4>
                <ul className="space-y-2 folio-meta">
                  <li><code>--bg-base</code> - #FFFFFF</li>
                  <li><code>--bg-elevated</code> - #FAFAF9</li>
                  <li><code>--text-primary</code> - #1A1A1A</li>
                  <li><code>--text-secondary</code> - #5C5C5C</li>
                  <li><code>--text-tertiary</code> - #8C8C8C</li>
                  <li><code>--accent</code> - #B8845C</li>
                  <li><code>--accent-hover</code> - #A67548</li>
                </ul>
              </div>
              <div>
                <h4 className="folio-h3 mb-4">Shadows</h4>
                <ul className="space-y-2 folio-meta">
                  <li><code>--neu-raised</code> - Elevated shadow</li>
                  <li><code>--neu-raised-lg</code> - Large elevated</li>
                  <li><code>--neu-inset</code> - Inset shadow</li>
                  <li><code>--neu-inset-sm</code> - Small inset</li>
                  <li><code>--ridge-outer</code> - Outer border</li>
                  <li><code>--ridge-inner</code> - Inner border</li>
                </ul>
              </div>
            </div>
          </RidgeCard>
        </section>

        {/* Footer */}
        <footer className="text-center py-8">
          <p className="folio-meta">Folio Neumorphic Design System</p>
        </footer>
      </div>
    </div>
  );
}
