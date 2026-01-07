'use client';

import { useState } from 'react';

type AIAnalystDrawerProps = {
  open: boolean;
  onClose: () => void;
  sectionId: 'events' | 'projects' | 'designerFunnel' | 'revenue';
  context: any;
};

type Message = { role: 'user' | 'assistant'; content: string };

export function AIAnalystDrawer({ open, onClose, sectionId, context }: AIAnalystDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Ask me why this recommendation was made, how the numbers were derived, or what might happen if you choose a different path.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function send() {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/vendor/ai-analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, context, question }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong fetching an answer. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div
        className="flex-1 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="w-full max-w-md h-full bg-white border-l border-neutral-300 shadow-2xl flex flex-col">
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-white/95 backdrop-blur-xl">
          <div>
            <div className="text-sm font-semibold text-neutral-800">AI Analyst</div>
            <div className="text-[11px] text-neutral-600">
              Discuss this recommendation based on your actual Folio data.
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-xs text-neutral-600 hover:text-neutral-800 transition"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`max-w-[85%] px-3 py-2 rounded-2xl ${
                m.role === 'user'
                  ? 'bg-black text-white ml-auto'
                  : 'bg-neutral-100 text-neutral-900'
              }`}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="max-w-[85%] px-3 py-2 rounded-2xl bg-neutral-100 text-neutral-600">
              Thinking...
            </div>
          )}
        </div>
        <div className="p-3 border-t border-neutral-200 flex items-center gap-2 bg-white/95 backdrop-blur-xl">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            className="flex-1 border border-neutral-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Ask why this was recommended, or explore alternative strategies…"
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-xl px-3 py-2 bg-black text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-800 transition"
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}


