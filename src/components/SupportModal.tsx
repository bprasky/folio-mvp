'use client';

import { useState, useRef, useEffect } from 'react';
import { GlassModal, GlassModalBody, GlassModalHeader } from '@/components/ui/glass-modal';
import { Headphones, X, Send, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SupportModal({ open, onOpenChange }: SupportModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset chat when modal closes
  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInput('');
    }
  }, [open]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Support chat error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Sorry, I couldn't connect: ${errorMsg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <GlassModal open={open} onOpenChange={onOpenChange} size="lg">
      <GlassModalHeader className="relative border-b border-folio-border-subtle">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 p-2 rounded-full hover:bg-surface-ground transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-folio-text-tertiary" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-neutral-900 rounded-full flex items-center justify-center">
            <Headphones className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-folio-text-primary">Support</h2>
            <p className="text-xs text-folio-text-tertiary">Trained on why, not just what</p>
          </div>
        </div>
      </GlassModalHeader>

      <GlassModalBody className="p-0 flex flex-col h-[60vh]">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-folio-text-tertiary text-center py-8">
              Ask anything about Folio. We'll help you find an answer and explain why we do it that way.
            </p>
          )}
          {messages.map((message, i) => (
            <div
              key={i}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  message.role === 'user'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-surface-ground text-folio-text-primary'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-surface-ground rounded-2xl px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-folio-text-tertiary" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-folio-border-subtle p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-folio-border-subtle px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </GlassModalBody>
    </GlassModal>
  );
}
