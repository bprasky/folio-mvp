"use client";

import { useState, useEffect } from "react";
import { Play, ExternalLink, Quote } from "lucide-react";
import Link from "next/link";

interface DesignerInsight {
  id: string;
  quoteText: string;
  designer: {
    id: string;
    name: string;
    profileImage: string | null;
  };
  project: {
    id: string;
    title: string;
    slug: string;
  };
  interviewSession: {
    id: string;
    recordedAt: Date | string;
  };
  startMs: number;
  endMs: number;
}

interface DesignerInsightsProps {
  productId: string;
}

export function DesignerInsights({ productId }: DesignerInsightsProps) {
  const [insights, setInsights] = useState<DesignerInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchInsights() {
      try {
        const response = await fetch(`/api/products/${productId}/insights?limit=6&approvedOnly=true`);
        if (!response.ok) {
          throw new Error("Failed to fetch insights");
        }
        const data = await response.json();
        setInsights(data.insights || []);
      } catch (err) {
        console.error("Error fetching insights:", err);
        setError("Failed to load designer insights");
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, [productId]);

  const playSegment = async (insight: DesignerInsight) => {
    try {
      // Fetch interview session to get recording URL (cache per interview session)
      let recordingUrl = audioUrls[insight.interviewSession.id];
      
      if (!recordingUrl) {
        const response = await fetch(`/api/interviews/${insight.interviewSession.id}/status`);
        if (!response.ok) throw new Error("Failed to fetch interview");

        const data = await response.json();
        recordingUrl = data.interviewSession?.recordingAsset?.url;

        if (!recordingUrl) {
          alert("Audio recording not available");
          return;
        }

        setAudioUrls((prev) => ({
          ...prev,
          [insight.interviewSession.id]: recordingUrl,
        }));
      }

      setPlayingId(insight.id);

      const audio = new Audio(recordingUrl);
      audio.currentTime = insight.startMs / 1000;

      const stopAt = insight.endMs / 1000;
      const checkTime = setInterval(() => {
        if (audio.currentTime >= stopAt) {
          audio.pause();
          clearInterval(checkTime);
          setPlayingId(null);
        }
      }, 100);

      audio.play().catch((err) => {
        console.error("Play error:", err);
        clearInterval(checkTime);
        setPlayingId(null);
      });
    } catch (err) {
      console.error("Error playing segment:", err);
      alert("Failed to play audio segment");
      setPlayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
        <div className="text-sm text-[#6B7280]">Designer Insights</div>
        <div className="mt-2 text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || insights.length === 0) {
    return null; // Don't show section if no insights
  }

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-[#6B7280]">Designer Insights</div>
        <div className="text-xs text-[#9CA3AF]">{insights.length} insight{insights.length !== 1 ? "s" : ""}</div>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0"
          >
            <div className="flex items-start space-x-3">
              <Quote className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#111827] leading-relaxed italic">
                  "{insight.quoteText}"
                </p>
                <div className="mt-2 flex items-center space-x-3 text-xs text-[#6B7280]">
                  <div className="flex items-center space-x-1">
                    {insight.designer.profileImage && (
                      <img
                        src={insight.designer.profileImage}
                        alt={insight.designer.name}
                        className="w-4 h-4 rounded-full"
                      />
                    )}
                    <span>{insight.designer.name}</span>
                  </div>
                  <span>•</span>
                  <Link
                    href={`/p/${insight.project.slug || insight.project.id}`}
                    className="hover:text-[#111827] flex items-center space-x-1"
                  >
                    <span>{insight.project.title}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
              <button
                onClick={() => playSegment(insight)}
                className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                title="Play audio segment"
              >
                <Play
                  className={`h-4 w-4 ${
                    playingId === insight.id ? "text-blue-600" : "text-gray-400"
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

