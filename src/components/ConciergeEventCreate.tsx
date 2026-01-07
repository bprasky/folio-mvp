"use client";
import React, { useState, useRef, useEffect } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaUpload, FaLink, FaTimes, FaCheck, FaEdit, FaSpinner, FaRobot, FaUser } from 'react-icons/fa';
import clsx from 'clsx';
import ConciergeAnalytics from './ConciergeAnalytics';

interface ExtractedEventData {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  isVirtual?: boolean;
  eventTypes?: string[];
  includesFood?: boolean;
  isSponsored?: boolean;
  promotionTier?: number;
  capacity?: number;
  eventTags?: string[];
  designStyles?: string[];
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ConciergeEventCreateProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (eventData: any) => void;
  className?: string;
}

export default function ConciergeEventCreate({ isOpen, onClose, onSubmit, className }: ConciergeEventCreateProps) {
  const [mode, setMode] = useState<'chat' | 'import'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! I'm Folio's Event Concierge. I can help you create an event quickly. Just describe your event naturally, like 'Opening party at Refinery in Brooklyn this Friday at 7pm' or tell me what you have in mind!",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedEventData>({});
  const [currentStep, setCurrentStep] = useState<'input' | 'review' | 'complete'>('input');
  const [importUrl, setImportUrl] = useState('');
  const [importPreview, setImportPreview] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const addMessage = (content: string, type: 'user' | 'assistant') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSubmit = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue.trim();
    addMessage(userMessage, 'user');
    setInputValue('');
    setIsProcessing(true);

    try {
      // Call AI parsing endpoint
      const response = await fetch('/api/event-concierge/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: userMessage })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Parse API error:', errorText);
        throw new Error(`Failed to parse event: ${response.status}`);
      }

      const responseText = await response.text();
      console.log('Parse API response:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Response:', responseText);
        throw new Error('Invalid response format from server');
      }

      const { extractedData: newData, followUpQuestion } = result;

      // Update extracted data
      setExtractedData(prev => ({ ...prev, ...newData }));

      // Add assistant response
      if (followUpQuestion) {
        addMessage(followUpQuestion, 'assistant');
      } else {
        addMessage("Great! I've extracted the event details. Please review the information above and click 'Create Event' when you're ready.", 'assistant');
        setCurrentStep('review');
      }
    } catch (error) {
      console.error('Parse error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addMessage(`I'm sorry, I couldn't process that: ${errorMessage}. Could you try describing your event in a different way?`, 'assistant');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;

    setIsImporting(true);
    try {
      const response = await fetch(`/api/event-import?source=${encodeURIComponent(importUrl)}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Import API error:', errorText);
        throw new Error(`Failed to import event: ${response.status}`);
      }

      const responseText = await response.text();
      console.log('Import API response:', responseText);
      
      let preview;
      try {
        preview = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Response:', responseText);
        throw new Error('Invalid response format from server');
      }
      
      setImportPreview(preview);
      setExtractedData(preview);
      addMessage(`I found an event at that URL! Here's what I extracted: "${preview.title}". Please review the details above and click 'Create Event' when ready.`, 'assistant');
      setCurrentStep('review');
      setMode('chat'); // Switch back to chat mode to show review
    } catch (error) {
      console.error('Import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addMessage(`I couldn't import from that URL: ${errorMessage}. Please check the link or try a different source.`, 'assistant');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFinalSubmit = async () => {
    setIsProcessing(true);
    try {
      const eventData = {
        ...extractedData,
        isConciergeCreated: true,
        conciergeRating: userRating
      };
      
      await onSubmit(eventData);
      setCurrentStep('complete');
      addMessage("Perfect! Your event has been created successfully. 🎉", 'assistant');
      
      // Track completion analytics
      const duration = Date.now() - startTime;
      return (
        <ConciergeAnalytics
          eventType="concierge_completed"
          eventData={eventData}
          duration={duration}
          source="floating_button"
        />
      );
    } catch (error) {
      addMessage("There was an issue creating your event. Please try again or use the regular form.", 'assistant');
      
      // Track abandonment analytics
      const duration = Date.now() - startTime;
      return (
        <ConciergeAnalytics
          eventType="concierge_abandoned"
          duration={duration}
          source="floating_button"
        />
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const updateField = (field: keyof ExtractedEventData, value: any) => {
    setExtractedData(prev => ({ ...prev, [field]: value }));
  };

  const renderReviewSection = () => (
    <div className="bg-gray-50 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3">Event Details</h3>
      <div className="space-y-3">
        {Object.entries(extractedData).map(([key, value]) => {
          if (!value) return null;
          
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}:
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-900">
                  {Array.isArray(value) ? value.join(', ') : String(value)}
                </span>
                <button
                  onClick={() => {/* TODO: Add edit functionality */}}
                  className="text-folio-accent hover:text-folio-accent-dark"
                >
                  <FaEdit className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 flex space-x-2">
        <button
          onClick={handleFinalSubmit}
          disabled={isProcessing}
          className="flex-1 bg-folio-accent text-white px-4 py-2 rounded-md hover:bg-folio-accent-dark transition-colors disabled:opacity-50"
        >
          {isProcessing ? <FaSpinner className="w-4 h-4 animate-spin" /> : 'Create Event'}
        </button>
        <button
          onClick={() => setCurrentStep('input')}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  );

  const renderImportSection = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Event URL or File
        </label>
        <div className="flex space-x-2">
          <input
            type="url"
            placeholder="Paste Eventbrite, Instagram, or other event URL..."
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
          />
          <button
            onClick={handleImport}
            disabled={isImporting || !importUrl.trim()}
            className="px-4 py-2 bg-folio-accent text-white rounded-md hover:bg-folio-accent-dark transition-colors disabled:opacity-50"
          >
            {isImporting ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaLink className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {importPreview && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-2">Preview</h4>
          <div className="space-y-2 text-sm">
            <div><strong>Title:</strong> {importPreview.title}</div>
            <div><strong>Date:</strong> {importPreview.startDate}</div>
            <div><strong>Location:</strong> {importPreview.location}</div>
            {importPreview.description && (
              <div><strong>Description:</strong> {importPreview.description.substring(0, 100)}...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Analytics Tracking */}
      <ConciergeAnalytics
        eventType="concierge_started"
        source="floating_button"
      />
      
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end z-50">
          <div className={clsx(
        "bg-white rounded-t-lg shadow-2xl w-full max-w-md h-[80vh] flex flex-col",
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <FaRobot className="text-folio-accent w-5 h-5" />
            <h2 className="text-lg font-semibold">Event Concierge</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setMode('chat')}
            className={clsx(
              "flex-1 py-3 text-sm font-medium transition-colors",
              mode === 'chat'
                ? "text-folio-accent border-b-2 border-folio-accent"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Chat
          </button>
          <button
            onClick={() => setMode('import')}
            className={clsx(
              "flex-1 py-3 text-sm font-medium transition-colors",
              mode === 'import'
                ? "text-folio-accent border-b-2 border-folio-accent"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Import
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mode === 'chat' ? (
            <>
              {/* Review Section - Show prominently when in review mode */}
              {currentStep === 'review' && (
                <div className="p-4 border-b border-gray-200">
                  {renderReviewSection()}
                </div>
              )}
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={clsx(
                      "flex",
                      message.type === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={clsx(
                        "max-w-[80%] rounded-lg px-3 py-2",
                        message.type === 'user'
                          ? "bg-folio-accent text-white"
                          : "bg-gray-100 text-gray-900"
                      )}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))}
                
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-3 py-2">
                      <div className="flex items-center space-x-2">
                        <FaSpinner className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-gray-600">Processing...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {currentStep === 'input' && (
                <div className="p-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Describe your event..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                      rows={2}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                    />
                    <button
                      onClick={isListening ? stopListening : startListening}
                      className={clsx(
                        "px-3 py-2 rounded-md transition-colors",
                        isListening
                          ? "bg-red-500 text-white hover:bg-red-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {isListening ? <FaMicrophoneSlash className="w-4 h-4" /> : <FaMicrophone className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!inputValue.trim() || isProcessing}
                      className="px-3 py-2 bg-folio-accent text-white rounded-md hover:bg-folio-accent-dark transition-colors disabled:opacity-50"
                    >
                      <FaCheck className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Import Section */
            <div className="p-4">
              {renderImportSection()}
            </div>
          )}
        </div>

        {/* Rating (after completion) */}
        {currentStep === 'complete' && (
          <div className="p-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">How was your concierge experience?</p>
              <div className="flex justify-center space-x-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setUserRating(rating)}
                    className={clsx(
                      "w-8 h-8 rounded-full transition-colors",
                      userRating && userRating >= rating
                        ? "bg-yellow-400 text-white"
                        : "bg-gray-200 text-gray-400 hover:bg-gray-300"
                    )}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
} 