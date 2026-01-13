'use client';

import { GlassModal, GlassModalBody, GlassModalHeader } from '@/components/ui/glass-modal';
import { FaHeadset, FaTimes } from 'react-icons/fa';

interface SupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SupportModal({ open, onOpenChange }: SupportModalProps) {
  return (
    <GlassModal open={open} onOpenChange={onOpenChange} size="md">
      <GlassModalHeader className="relative">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <FaTimes className="w-4 h-4 text-gray-500" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-folio-accent to-folio-system rounded-full flex items-center justify-center">
            <FaHeadset className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-folio-text">Support</h2>
            <p className="text-sm text-folio-system">We're here to help</p>
          </div>
        </div>
      </GlassModalHeader>

      <GlassModalBody>
        <div className="space-y-6">
          <p className="text-folio-text leading-relaxed">
            At Folio we are reinventing support. This chat is trained on <em>why</em>, not just on <em>what</em>, and can effectively help you find an answer to your issue, tell you why we do it that way, and pass along good suggestions to our team!
          </p>

          <div className="bg-folio-muted/50 rounded-xl p-6 space-y-4">
            <h3 className="font-medium text-folio-text">What makes our support different:</h3>
            <ul className="space-y-3 text-sm text-folio-system">
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-folio-accent mt-2 flex-shrink-0" />
                <span>Understands the thinking behind Folio's design decisions</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-folio-accent mt-2 flex-shrink-0" />
                <span>Helps you accomplish your goals, not just answer questions</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-folio-accent mt-2 flex-shrink-0" />
                <span>Your feedback directly shapes our product roadmap</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              className="w-full py-3 px-6 bg-folio-text text-white rounded-xl font-medium hover:bg-opacity-90 transition-all"
              onClick={() => {
                // TODO: Open support chat
                onOpenChange(false);
              }}
            >
              Start a Conversation
            </button>
            <p className="text-xs text-folio-system text-center mt-3">
              Your conversations help us improve Folio for everyone.
            </p>
          </div>
        </div>
      </GlassModalBody>
    </GlassModal>
  );
}
