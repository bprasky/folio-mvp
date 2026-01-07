'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FaRocket, FaCheckCircle, FaExclamationCircle, FaCube, 
  FaImage, FaStickyNote, FaPlus, FaArrowRight, FaMagic,
  FaFileAlt, FaPlay
} from 'react-icons/fa';
import { toast } from 'sonner';
import type { PendingApproval } from '@/lib/approvals-utils';

interface OverviewTabProps {
  projectId: string;
  project: {
    id: string;
    title: string;
    isPublic?: boolean;
    publishedAt?: Date | null;
  };
  isOwner: boolean;
}

// Approval type icons
const APPROVAL_ICONS: Record<string, React.ElementType> = {
  CREATE_ROOM: FaPlus,
  GENERATE_SKELETONS: FaCube,
  GENERATE_CONCEPT_IMAGE: FaImage,
  DRAFT_EDITORIAL: FaFileAlt,
  PUBLISH_EDITORIAL: FaRocket,
  TAGGABLE_ITEMS_READY: FaMagic,
};

// Approval type button labels
const APPROVAL_BUTTON_LABELS: Record<string, string> = {
  CREATE_ROOM: 'Create Room',
  GENERATE_SKELETONS: 'Generate Skeletons',
  GENERATE_CONCEPT_IMAGE: 'Generate Image',
  DRAFT_EDITORIAL: 'Create Draft',
  PUBLISH_EDITORIAL: 'Publish',
  TAGGABLE_ITEMS_READY: 'Review & Tag',
};

// Approval type accent colors
const APPROVAL_ACCENT_COLORS: Record<string, string> = {
  TAGGABLE_ITEMS_READY: 'bg-blue-500',
  DRAFT_EDITORIAL: 'bg-emerald-500',
  PUBLISH_EDITORIAL: 'bg-green-500',
  CREATE_ROOM: 'bg-purple-500',
  GENERATE_SKELETONS: 'bg-indigo-500',
  GENERATE_CONCEPT_IMAGE: 'bg-cyan-500',
};

// Value lines for key approvals
const APPROVAL_VALUE_LINES: Record<string, string> = {
  TAGGABLE_ITEMS_READY: 'Unlocks: affiliate credit • instant recall • publish-ready callouts',
  DRAFT_EDITORIAL: 'Unlocks: community sharing • portfolio showcase • SEO benefits',
  PUBLISH_EDITORIAL: 'Unlocks: public visibility • engagement tracking • brand exposure',
};

interface RecentNote {
  id: string;
  title: string | null;
  rawText: string | null;
  createdAt: Date;
  attachments: Array<{
    id: string;
    room?: { id: string; name: string } | null;
  }>;
}

export default function OverviewTab({ projectId, project, isOwner }: OverviewTabProps) {
  const router = useRouter();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [editorialHint, setEditorialHint] = useState<string | null>(null);
  const [stats, setStats] = useState<{ imageCount: number; tagCount: number; isPublished: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [executingApprovals, setExecutingApprovals] = useState<Set<string>>(new Set());

  // Fetch overview data
  useEffect(() => {
    fetchOverviewData();
  }, [projectId]);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/overview`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setApprovals(data.approvals || []);
        setRecentNotes(data.recentNotes || []);
        setEditorialHint(data.editorialHint || null);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Error fetching overview:', error);
    } finally {
      setLoading(false);
    }
  };

  // Execute an approval
  const executeApproval = async (approval: PendingApproval) => {
    setExecutingApprovals(prev => new Set(prev).add(approval.id));
    
    try {
      let endpoint = '';
      let body: Record<string, any> = {};
      let navigateAfter: string | null = null;
      
      switch (approval.type) {
        case 'TAGGABLE_ITEMS_READY':
          // Navigate to boards with tagging mode
          const topRoom = approval.payload.byRoom?.[0];
          const roomId = topRoom?.roomId;
          if (roomId) {
            router.push(`/project/${projectId}?view=boards&mode=tagging&roomId=${roomId}`);
          } else {
            router.push(`/project/${projectId}?view=boards&mode=tagging`);
          }
          setExecutingApprovals(prev => {
            const next = new Set(prev);
            next.delete(approval.id);
            return next;
          });
          return; // Early return, no API call needed
        case 'CREATE_ROOM':
          endpoint = `/api/projects/${projectId}/approvals/create-room`;
          body = { roomName: approval.payload.roomName, roomType: approval.payload.roomType };
          break;
        case 'GENERATE_SKELETONS':
          endpoint = `/api/rooms/${approval.payload.roomId}/approvals/generate-skeletons`;
          body = { projectId };
          break;
        case 'GENERATE_CONCEPT_IMAGE':
          endpoint = `/api/rooms/${approval.payload.roomId}/approvals/generate-concept-image`;
          body = { projectId };
          break;
        case 'DRAFT_EDITORIAL':
          // Create draft, then navigate to PublishWorkflow for review
          endpoint = `/api/projects/${projectId}/approvals/draft-editorial`;
          body = {};
          navigateAfter = `/project/${projectId}/publish`; // Navigate to publish workflow
          break;
        case 'PUBLISH_EDITORIAL':
          // Explicit publish action
          endpoint = `/api/projects/${projectId}/approvals/publish-editorial`;
          body = {};
          break;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        // Different success messages based on type
        if (approval.type === 'DRAFT_EDITORIAL') {
          toast.success('Draft created! Taking you to review...');
        } else if (approval.type === 'PUBLISH_EDITORIAL') {
          toast.success('Editorial published! It will appear in the feed.');
        } else {
          toast.success(`${APPROVAL_BUTTON_LABELS[approval.type]} completed!`);
        }
        
        // Remove approval from list
        setApprovals(prev => prev.filter(a => a.id !== approval.id));
        
        // Navigate if needed (for draft editorial)
        if (navigateAfter) {
          router.push(navigateAfter);
        } else {
          // Refresh data
          fetchOverviewData();
          router.refresh();
        }
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.message || 'Action failed');
      }
    } catch (error) {
      console.error('Error executing approval:', error);
      toast.error('Failed to execute action');
    } finally {
      setExecutingApprovals(prev => {
        const next = new Set(prev);
        next.delete(approval.id);
        return next;
      });
    }
  };

  // Navigate to note
  const goToNotes = () => {
    router.push(`/project/${projectId}?view=meeting-notes`);
  };

  // Compute Resume CTA
  const getResumeCTA = () => {
    if (approvals.length === 0) {
      if (stats && stats.imageCount === 0) {
        return {
          label: 'Resume: Upload photos',
          href: `/project/${projectId}?view=media`,
        };
      }
      return null;
    }
    
    const taggableApproval = approvals.find(a => a.type === 'TAGGABLE_ITEMS_READY');
    if (taggableApproval) {
      const topRoom = taggableApproval.payload.byRoom?.[0];
      const roomId = topRoom?.roomId;
      if (roomId) {
        return {
          label: 'Resume: Tag detected items',
          href: `/project/${projectId}?view=boards&mode=tagging&roomId=${roomId}`,
        };
      }
      return {
        label: 'Resume: Tag detected items',
        href: `/project/${projectId}?view=boards&mode=tagging`,
      };
    }
    
    const draftApproval = approvals.find(a => a.type === 'DRAFT_EDITORIAL');
    if (draftApproval) {
      return {
        label: 'Resume: Create editorial draft',
        href: `/project/${projectId}/publish`,
      };
    }
    
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const resumeCTA = getResumeCTA();

  return (
    <div className="space-y-8">
      {/* Resume CTA */}
      {resumeCTA && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <FaPlay className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{resumeCTA.label}</p>
            </div>
          </div>
          <button
            onClick={() => router.push(resumeCTA.href)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            Continue <FaArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Opportunities Detected Section */}
      {approvals.length > 0 && (
        <section>
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-1">
              <FaMagic className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Opportunities Detected</h2>
              <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                {approvals.length}
              </span>
            </div>
            <p className="text-sm text-gray-600 ml-8">
              Folio found ways to turn this project into leverage.
            </p>
          </div>
          
          <div className="space-y-3">
            {approvals.map((approval) => {
              const Icon = APPROVAL_ICONS[approval.type] || FaCheckCircle;
              const isExecuting = executingApprovals.has(approval.id);
              const accentColor = APPROVAL_ACCENT_COLORS[approval.type] || 'bg-blue-500';
              const valueLine = APPROVAL_VALUE_LINES[approval.type];
              
              return (
                <div
                  key={approval.id}
                  className="relative bg-gray-50/60 border border-gray-200/60 rounded-xl p-5 flex items-start justify-between gap-4 shadow-sm hover:shadow-md transition-all group"
                >
                  {/* Left accent strip */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor} rounded-l-xl`} />
                  
                  <div className="flex items-start gap-4 flex-1 pl-1">
                    <div className={`w-12 h-12 rounded-lg ${accentColor} bg-opacity-10 flex items-center justify-center shrink-0`}>
                      <Icon className={`w-6 h-6 ${accentColor.replace('bg-', 'text-')}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900">{approval.title}</h3>
                      <p className="text-sm text-gray-600 mt-0.5">{approval.description}</p>
                      
                      {/* Value line for key approvals */}
                      {valueLine && (
                        <p className="text-xs text-gray-500 mt-2 italic">
                          {valueLine}
                        </p>
                      )}
                      
                      {/* Room chips for TAGGABLE_ITEMS_READY */}
                      {approval.type === 'TAGGABLE_ITEMS_READY' && approval.payload.byRoom && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {approval.payload.byRoom.slice(0, 3).map((room: { roomId: string | null; roomName: string; count: number }) => (
                            <button
                              key={room.roomName}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (room.roomId) {
                                  router.push(`/project/${projectId}?view=boards&mode=tagging&roomId=${room.roomId}`);
                                } else {
                                  router.push(`/project/${projectId}?view=boards&mode=tagging`);
                                }
                              }}
                              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                            >
                              {room.roomName} • {room.count}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {approval.source && (
                        <p className="text-xs text-gray-400 mt-2">
                          From: {approval.source.noteTitle || 'Meeting Note'} • {' '}
                          {new Date(approval.source.timestamp!).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => executeApproval(approval)}
                    disabled={isExecuting}
                    className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isExecuting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Working...
                      </>
                    ) : (
                      <>
                        {APPROVAL_BUTTON_LABELS[approval.type]}
                        <FaArrowRight className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Editorial Hint - shown when editorial drafts aren't available yet */}
      {editorialHint && !project.isPublic && (
        <div className="bg-blue-50 border border-blue-200/60 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <FaFileAlt className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-blue-800">{editorialHint}</p>
            <button
              onClick={() => router.push(`/project/${projectId}?view=media`)}
              className="text-sm font-medium text-blue-700 hover:text-blue-900 mt-1 inline-flex items-center gap-1"
            >
              Go to Media <FaArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Project Trail (Notes) Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FaStickyNote className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">Project Trail</h2>
            </div>
            <p className="text-sm text-gray-600 ml-7">
              Context and decisions you can reference anytime.
            </p>
          </div>
          <button
            onClick={goToNotes}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View all <FaArrowRight className="w-3 h-3" />
          </button>
        </div>
        
        {recentNotes.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200/60 border-dashed rounded-xl p-8 text-center">
            <FaStickyNote className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No notes yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Meeting notes will appear here as you add them.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentNotes.map((note) => (
              <button
                key={note.id}
                onClick={goToNotes}
                className="w-full bg-white border border-gray-200/60 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {note.title || 'Untitled Note'}
                    </h3>
                    {note.rawText && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {note.rawText.substring(0, 150)}
                        {note.rawText.length > 150 ? '...' : ''}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(note.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {note.attachments.length > 0 && (
                    <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-purple-50 text-purple-700">
                      {note.attachments.length} attachment{note.attachments.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
