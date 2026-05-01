'use client';

import { useState, useEffect, useRef } from 'react';

interface BioQuestion {
  id: string;
  question: string;
  round: 'base' | 'followup';
}

interface ChatMessage {
  type: 'question' | 'answer';
  text: string;
  questionId?: string;
}

interface BioInterviewChatProps {
  onComplete: () => void;
}

export default function BioInterviewChat({ onComplete }: BioInterviewChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<BioQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [baseAnswerCount, setBaseAnswerCount] = useState(0);
  const [round, setRound] = useState<'base' | 'followup'>('base');
  const [canGenerate, setCanGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load questions
  useEffect(() => {
    loadQuestions('base');
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input after question appears
  useEffect(() => {
    if (!loading && !submitting) {
      inputRef.current?.focus();
    }
  }, [loading, submitting, currentQuestionIdx]);

  async function loadQuestions(questionRound: 'base' | 'followup') {
    setLoading(true);
    try {
      const res = await fetch(`/api/designer/bio/questions?round=${questionRound}`);
      const data = await res.json();
      const qs: BioQuestion[] = data.questions || [];

      if (qs.length === 0 && questionRound === 'followup') {
        // No follow-ups available, let them generate
        setCanGenerate(true);
        setLoading(false);
        return;
      }

      setQuestions(qs);
      setCurrentQuestionIdx(0);
      setRound(questionRound);

      // Show first question
      if (qs.length > 0) {
        setMessages((prev) => [...prev, { type: 'question', text: qs[0].question, questionId: qs[0].id }]);
      }
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAnswer() {
    if (!answer.trim() || submitting) return;

    const currentQ = questions[currentQuestionIdx];
    if (!currentQ) return;

    const answerText = answer.trim();
    setSubmitting(true);

    // Show answer in chat
    setMessages((prev) => [...prev, { type: 'answer', text: answerText }]);
    setAnswer('');

    try {
      const res = await fetch('/api/designer/bio/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          question: currentQ.question,
          answer: answerText,
          round: currentQ.round,
        }),
      });

      const data = await res.json();
      setBaseAnswerCount(data.baseAnswerCount || 0);
      setCanGenerate(data.canGenerateBio || false);

      // Move to next question or transition
      const nextIdx = currentQuestionIdx + 1;
      if (nextIdx < questions.length) {
        setCurrentQuestionIdx(nextIdx);
        // Small delay before showing next question for conversational feel
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { type: 'question', text: questions[nextIdx].question, questionId: questions[nextIdx].id },
          ]);
          setSubmitting(false);
        }, 600);
      } else {
        // All questions in this round answered
        setSubmitting(false);
        if (round === 'base' && data.canGenerateBio) {
          setCanGenerate(true);
        } else if (round === 'followup') {
          setCanGenerate(true);
        }
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setSubmitting(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/designer/bio/generate', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate bio');
      }
      onComplete();
    } catch (err) {
      console.error('Failed to generate bio:', err);
      setGenerating(false);
    }
  }

  function handleGoDeeper() {
    loadQuestions('followup');
  }

  const isLastQuestion = currentQuestionIdx >= questions.length - 1;
  const allAnswered = currentQuestionIdx >= questions.length && !submitting;
  const progressText = `${Math.min(currentQuestionIdx + 1, questions.length)} of ${questions.length}`;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  }

  return (
    <div className="bio-chat">
      {/* Progress bar */}
      <div className="bio-chat-header">
        <span className="bio-chat-progress">{loading ? 'Loading questions...' : progressText}</span>
        {canGenerate && !allAnswered && (
          <button onClick={handleGenerate} disabled={generating} className="bio-chat-generate-hint">
            {generating ? 'Generating...' : 'Generate bio now'}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="bio-chat-messages" ref={scrollRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`bio-chat-msg bio-chat-msg--${msg.type}`}>
            {msg.type === 'question' && <div className="bio-chat-avatar">F</div>}
            <div className={`bio-chat-bubble bio-chat-bubble--${msg.type}`}>
              {msg.text}
            </div>
          </div>
        ))}

        {submitting && (
          <div className="bio-chat-msg bio-chat-msg--question">
            <div className="bio-chat-avatar">F</div>
            <div className="bio-chat-bubble bio-chat-bubble--question bio-chat-typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        {/* End-of-round actions */}
        {allAnswered && canGenerate && (
          <div className="bio-chat-actions">
            <p className="bio-chat-actions-text">
              Great answers! Ready to generate your bio, or want to go deeper?
            </p>
            <div className="bio-chat-actions-row">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="accent-btn pill-btn bio-chat-action-btn"
              >
                {generating ? 'Generating...' : 'Generate My Bio'}
              </button>
              {round === 'base' && (
                <button
                  onClick={handleGoDeeper}
                  className="ridge-btn pill-btn bio-chat-action-btn"
                >
                  Go Deeper
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      {!allAnswered && !loading && (
        <div className="bio-chat-input-row">
          <textarea
            ref={inputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            className="bio-chat-input"
            rows={2}
            disabled={submitting}
          />
          <button
            onClick={handleSubmitAnswer}
            disabled={submitting || !answer.trim()}
            className="accent-btn bio-chat-send"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 9l14-7-4 16-4-6-6-3z" fill="currentColor" />
            </svg>
          </button>
        </div>
      )}

      <style jsx>{`
        .bio-chat {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface-canvas);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 600px;
        }
        .bio-chat-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .bio-chat-progress {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--text-tertiary);
          letter-spacing: 0.03em;
        }
        .bio-chat-generate-hint {
          background: none;
          border: none;
          color: var(--accent);
          font-family: var(--font-body);
          font-size: 12px;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .bio-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 300px;
        }
        .bio-chat-msg {
          display: flex;
          gap: 10px;
          max-width: 85%;
        }
        .bio-chat-msg--question {
          align-self: flex-start;
        }
        .bio-chat-msg--answer {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        .bio-chat-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--text-primary);
          color: var(--surface-canvas);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-headline);
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .bio-chat-bubble {
          padding: 12px 16px;
          border-radius: 16px;
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.5;
        }
        .bio-chat-bubble--question {
          background: var(--surface-ground);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
        }
        .bio-chat-bubble--answer {
          background: var(--text-primary);
          color: var(--surface-canvas);
          border-bottom-right-radius: 4px;
        }
        .bio-chat-typing {
          display: flex;
          gap: 4px;
          padding: 14px 18px;
        }
        .bio-chat-typing span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-tertiary);
          animation: bioTyping 1.2s infinite;
        }
        .bio-chat-typing span:nth-child(2) { animation-delay: 0.2s; }
        .bio-chat-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bioTyping {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
        .bio-chat-actions {
          align-self: center;
          text-align: center;
          padding: 16px 0;
        }
        .bio-chat-actions-text {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0 0 12px;
        }
        .bio-chat-actions-row {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        .bio-chat-action-btn {
          padding: 10px 24px;
          font-size: 13px;
        }
        .bio-chat-input-row {
          padding: 12px 16px;
          border-top: 1px solid var(--border);
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }
        .bio-chat-input {
          flex: 1;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-ground);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.4;
          resize: none;
          outline: none;
        }
        .bio-chat-input:focus {
          border-color: var(--accent);
        }
        .bio-chat-send {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          flex-shrink: 0;
        }
        .bio-chat-send:disabled {
          opacity: 0.4;
        }
      `}</style>
    </div>
  );
}
