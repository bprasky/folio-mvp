"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandAssets } from "@/lib/aesthetic/types";
import { RidgeCard } from "@/components/ui/ridge-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function BrandAssetsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<BrandAssets>({
    moodImageUrls: [],
    inspiredByDesigners: [],
    inspiredByPublications: [],
    brandAdjectives: [],
  });

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const res = await fetch("/api/designer/brand-assets");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setAssets({
            logoLightUrl: data.logoLightUrl,
            logoDarkUrl: data.logoDarkUrl,
            logomarkUrl: data.logomarkUrl,
            primaryColor: data.primaryColor,
            secondaryColor: data.secondaryColor,
            accentColor: data.accentColor,
            backgroundColor: data.backgroundColor,
            headingFont: data.headingFont,
            bodyFont: data.bodyFont,
            moodImageUrls: data.moodImageUrls || [],
            inspirationNotes: data.inspirationNotes,
            inspiredByDesigners: data.inspiredByDesigners || [],
            inspiredByPublications: data.inspiredByPublications || [],
            tagline: data.tagline,
            brandAdjectives: data.brandAdjectives || [],
          });
        }
      }
    } catch (error) {
      console.error("Failed to load brand assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/designer/brand-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assets),
      });

      if (res.ok) {
        router.push("/designer/profile");
      } else {
        alert("Failed to save brand assets");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Failed to save brand assets");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
          <p className="mt-4 folio-body text-[var(--text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="folio-h1 text-[var(--text-primary)]">Brand Assets</h1>
        <p className="mt-2 folio-body text-[var(--text-secondary)]">
          These help us understand your aesthetic before you upload projects.
        </p>

        {/* Tagline */}
        <section className="mt-10">
          <label className="block folio-body font-medium text-[var(--text-primary)] mb-2">
            Tagline
          </label>
          <Input
            variant="ridge"
            value={assets.tagline || ""}
            onChange={(e) => setAssets({ ...assets, tagline: e.target.value })}
            placeholder="A short phrase that captures your approach..."
            maxLength={100}
          />
        </section>

        {/* Brand Colors */}
        <RidgeCard padding="lg" className="mt-10">
          <h2 className="folio-h3 text-[var(--text-primary)] mb-4">Brand Colors</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { key: "primaryColor", label: "Primary" },
              { key: "secondaryColor", label: "Secondary" },
              { key: "accentColor", label: "Accent" },
              { key: "backgroundColor", label: "Background" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block folio-meta mb-2">{label}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={assets[key as keyof BrandAssets] || "#000000"}
                    onChange={(e) =>
                      setAssets({ ...assets, [key]: e.target.value })
                    }
                    className="w-16 h-10 rounded border border-[var(--border-subtle)]"
                  />
                  <Input
                    variant="ridge"
                    value={assets[key as keyof BrandAssets] || ""}
                    onChange={(e) =>
                      setAssets({ ...assets, [key]: e.target.value })
                    }
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>
            ))}
          </div>
        </RidgeCard>

        {/* Brand Adjectives */}
        <RidgeCard padding="lg" className="mt-10">
          <h2 className="folio-h3 text-[var(--text-primary)] mb-2">
            Describe Your Aesthetic
          </h2>
          <p className="folio-meta mb-4">
            Select words that describe your design style (max 5).
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "Minimal",
              "Warm",
              "Bold",
              "Moody",
              "Coastal",
              "Eclectic",
              "Modern",
              "Traditional",
              "Transitional",
              "Rustic",
              "Industrial",
              "Luxe",
              "Casual",
              "Refined",
              "Playful",
              "Serene",
              "Dramatic",
              "Collected",
              "Clean",
              "Layered",
              "Organic",
              "Architectural",
            ].map((adj) => {
              const isSelected = assets.brandAdjectives.includes(adj);
              return (
                <button
                  key={adj}
                  onClick={() => {
                    if (isSelected) {
                      setAssets({
                        ...assets,
                        brandAdjectives: assets.brandAdjectives.filter((a) => a !== adj),
                      });
                    } else if (assets.brandAdjectives.length < 5) {
                      setAssets({
                        ...assets,
                        brandAdjectives: [...assets.brandAdjectives, adj],
                      });
                    }
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent)]"
                  }`}
                  disabled={!isSelected && assets.brandAdjectives.length >= 5}
                >
                  {adj}
                </button>
              );
            })}
          </div>
        </RidgeCard>

        {/* Save Button */}
        <div className="mt-12 flex justify-end gap-4">
          <Button
            variant="ridge"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Brand Assets"}
          </Button>
        </div>
      </div>
    </div>
  );
}


