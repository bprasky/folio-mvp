'use client';

import { useState } from 'react';
import { Mic, MessageSquare, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface InterviewModeSelectorProps {
  onSelectMode: (mode: 'realtime' | 'text') => void;
  projectName: string;
}

export function InterviewModeSelector({
  onSelectMode,
  projectName,
}: InterviewModeSelectorProps) {
  const [hoveredMode, setHoveredMode] = useState<'realtime' | 'text' | null>(null);

  return (
    <div className="flex flex-col items-center py-8 px-4">
      <h2 className="text-2xl font-semibold text-folio-text-primary mb-2 text-center">
        Tell the story of {projectName}
      </h2>
      <p className="text-folio-text-secondary text-center max-w-md mb-8">
        Share the decisions, inspirations, and moments that shaped this project.
      </p>

      <div className="w-full max-w-lg space-y-4">
        {/* Live Interview Option */}
        <motion.button
          onClick={() => onSelectMode('realtime')}
          onMouseEnter={() => setHoveredMode('realtime')}
          onMouseLeave={() => setHoveredMode(null)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`
            relative w-full p-6 rounded-xl border-2 transition-all text-left
            ${
              hoveredMode === 'realtime'
                ? 'border-amber-400 bg-amber-50/50'
                : 'border-folio-border-subtle bg-surface-canvas hover:border-folio-border-strong'
            }
          `}
        >
          <div className="flex gap-4">
            <div
              className={`
              p-3 rounded-full transition-colors shrink-0
              ${hoveredMode === 'realtime' ? 'bg-amber-100' : 'bg-surface-elevated'}
            `}
            >
              <Mic
                className={`w-6 h-6 ${
                  hoveredMode === 'realtime' ? 'text-amber-600' : 'text-folio-text-secondary'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-folio-text-primary">
                  Live Conversation
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                  <Sparkles className="w-3 h-3" />
                  Recommended
                </span>
              </div>
              <p className="text-sm text-folio-text-secondary mb-2">
                Have a natural conversation about your project. Our story AI
                will guide you through the story with questions tailored to your
                work.
              </p>
              <p className="text-xs text-folio-text-tertiary">
                ~10-15 minutes &bull; Uses microphone
              </p>
            </div>
          </div>

          {hoveredMode === 'realtime' && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 pt-4 border-t border-amber-200"
            >
              <p className="text-sm text-amber-700 italic">
                "I've been looking at your project—let's talk about the decisions
                that shaped it..."
              </p>
            </motion.div>
          )}
        </motion.button>

        {/* Text Interview Option */}
        <motion.button
          onClick={() => onSelectMode('text')}
          onMouseEnter={() => setHoveredMode('text')}
          onMouseLeave={() => setHoveredMode(null)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`
            relative w-full p-6 rounded-xl border-2 transition-all text-left
            ${
              hoveredMode === 'text'
                ? 'border-folio-border-strong bg-surface-ground/50'
                : 'border-folio-border-subtle bg-surface-canvas hover:border-folio-border-strong'
            }
          `}
        >
          <div className="flex gap-4">
            <div
              className={`
              p-3 rounded-full transition-colors shrink-0
              ${hoveredMode === 'text' ? 'bg-surface-elevated' : 'bg-surface-elevated'}
            `}
            >
              <MessageSquare
                className={`w-6 h-6 ${
                  hoveredMode === 'text' ? 'text-folio-text-secondary' : 'text-folio-text-secondary'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-folio-text-primary">
                Written Responses
              </span>
              <p className="text-sm text-folio-text-secondary mt-1 mb-2">
                Answer questions at your own pace by typing. Good for quiet
                environments or when you prefer to write.
              </p>
              <p className="text-xs text-folio-text-tertiary">
                ~15-20 minutes &bull; Text only
              </p>
            </div>
          </div>
        </motion.button>
      </div>

      <p className="text-xs text-folio-text-tertiary mt-6 text-center">
        You can switch modes at any time during the interview.
      </p>
    </div>
  );
}
