"use client";

import { useState, useEffect } from "react";
import { Play, Quote } from "lucide-react";
import { motion } from "framer-motion";

interface PullQuote {
  id: string;
  quoteText: string;
  designer: {
    id: string;
    name: string;
    profileImage: string | null;
  };
  interviewSession: {
    id: string;
    recordedAt: Date | string;
  };
  startMs: number;
  endMs: number;
}

interface PullQuoteBlockProps {
  projectId: string;
  index?: number; // Position in the editorial flow
}

export function PullQuoteBlock({ projectId, index = 0 }: PullQuoteBlockProps) {
  const [quotes, setQuotes] = useState<PullQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchQuotes() {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/interview-quotes?limit=3&approvedOnly=true`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch quotes");
        }
        const data = await response.json();
        setQuotes(data.quotes || []);
      } catch (err) {
        console.error("Error fetching pullquotes:", err);
        // Fail silently - don't show section if no quotes
      } finally {
        setLoading(false);
      }
    }

    fetchQuotes();
  }, [projectId]);

  const playSegment = async (quote: PullQuote) => {
    try {
      // Fetch interview session to get recording URL (cache per interview session)
      let recordingUrl = audioUrls[quote.interviewSession.id];

      if (!recordingUrl) {
        const response = await fetch(`/api/interviews/${quote.interviewSession.id}/status`);
        if (!response.ok) throw new Error("Failed to fetch interview");

        const data = await response.json();
        recordingUrl = data.interviewSession?.recordingAsset?.url;

        if (!recordingUrl) {
          alert("Audio recording not available");
          return;
        }

        setAudioUrls((prev) => ({
          ...prev,
          [quote.interviewSession.id]: recordingUrl,
        }));
      }

      setPlayingId(quote.id);

      const audio = new Audio(recordingUrl);
      audio.currentTime = quote.startMs / 1000;

      const stopAt = quote.endMs / 1000;
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

  if (loading || quotes.length === 0) {
    return null; // Don't render if no quotes
  }

  // Show only the first quote for now (can expand later)
  const quote = quotes[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.1 }}
      className="w-full py-12 md:py-16"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Quote Icon */}
          <div className="absolute -top-4 -left-4 text-[var(--text-tertiary)]">
            <Quote className="h-16 w-16 md:h-24 md:w-24" />
          </div>

          {/* Quote Text */}
          <div className="relative pl-8 md:pl-12">
            <blockquote className="text-2xl md:text-3xl lg:text-4xl font-light text-[var(--text-primary)] leading-relaxed italic">
              "{quote.quoteText}"
            </blockquote>

            {/* Designer Attribution */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {quote.designer.profileImage && (
                  <img
                    src={quote.designer.profileImage}
                    alt={quote.designer.name}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <div className="folio-ui font-medium text-[var(--text-primary)]">
                    {quote.designer.name}
                  </div>
                  <div className="folio-ui text-[var(--text-secondary)]">Designer</div>
                </div>
              </div>

              {/* Play Button */}
              <button
                onClick={() => playSegment(quote)}
                className="flex items-center space-x-2 px-4 py-2 rounded-full border border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] transition-colors"
                title="Play audio segment"
              >
                <Play
                  className={`h-4 w-4 ${
                    playingId === quote.id ? "text-blue-600" : "text-[var(--text-secondary)]"
                  }`}
                />
                <span className="folio-ui text-[var(--text-secondary)]">Listen</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}



