"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandAssets } from "@/lib/aesthetic/types";

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
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 mx-auto"></div>
          <p className="mt-4 text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-neutral-900">Brand Assets</h1>
        <p className="mt-2 text-neutral-600">
          These help us understand your aesthetic before you upload projects.
        </p>

        {/* Tagline */}
        <section className="mt-10">
          <label className="block text-sm font-medium text-neutral-900 mb-2">
            Tagline
          </label>
          <input
            type="text"
            value={assets.tagline || ""}
            onChange={(e) => setAssets({ ...assets, tagline: e.target.value })}
            placeholder="A short phrase that captures your approach..."
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
            maxLength={100}
          />
        </section>

        {/* Brand Colors */}
        <section className="mt-10">
          <h2 className="text-lg font-medium text-neutral-900 mb-4">Brand Colors</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { key: "primaryColor", label: "Primary" },
              { key: "secondaryColor", label: "Secondary" },
              { key: "accentColor", label: "Accent" },
              { key: "backgroundColor", label: "Background" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm text-neutral-600 mb-2">{label}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={assets[key as keyof BrandAssets] || "#000000"}
                    onChange={(e) =>
                      setAssets({ ...assets, [key]: e.target.value })
                    }
                    className="w-16 h-10 rounded border border-neutral-300"
                  />
                  <input
                    type="text"
                    value={assets[key as keyof BrandAssets] || ""}
                    onChange={(e) =>
                      setAssets({ ...assets, [key]: e.target.value })
                    }
                    placeholder="#000000"
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Brand Adjectives */}
        <section className="mt-10">
          <h2 className="text-lg font-medium text-neutral-900 mb-2">
            Describe Your Aesthetic
          </h2>
          <p className="text-sm text-neutral-500 mb-4">
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
                      ? "bg-neutral-900 text-white"
                      : "bg-white border border-neutral-300 text-neutral-700 hover:border-neutral-900"
                  }`}
                  disabled={!isSelected && assets.brandAdjectives.length >= 5}
                >
                  {adj}
                </button>
              );
            })}
          </div>
        </section>

        {/* Save Button */}
        <div className="mt-12 flex justify-end gap-4">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 border border-neutral-300 text-neutral-700 font-medium rounded-lg hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Brand Assets"}
          </button>
        </div>
      </div>
    </div>
  );
}


