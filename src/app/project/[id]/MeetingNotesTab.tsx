'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { FaPaperclip, FaCheckSquare } from 'react-icons/fa';
import ProjectUnderstandingPanel from './ProjectUnderstandingPanel';
import NoteAttachmentBadges from '@/components/notes/NoteAttachmentBadges';
import CreateActionItemModal from '@/components/action-items/CreateActionItemModal';

interface Attachment {
  id: string;
  project?: { id: string; title: string } | null;
  room?: { id: string; name: string } | null;
  productTag?: {
    id: string;
    product?: { id: string; name: string } | null;
  } | null;
}

interface MeetingNote {
  id: string;
  title: string | null;
  rawText: string | null;
  sourceType: string;
  createdAt: Date;
  updatedAt: Date;
  attachments?: Attachment[];
}

interface MeetingNotesTabProps {
  projectId: string;
}

export default function MeetingNotesTab({ projectId }: MeetingNotesTabProps) {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rooms, setRooms] = useState<Array<{ id: string; name: string }>>([]);
  const [productTags, setProductTags] = useState<Array<{ id: string; product: { name: string } }>>([]);
  const [attachingToNoteId, setAttachingToNoteId] = useState<string | null>(null);
  const [createActionItemNoteId, setCreateActionItemNoteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    rawText: '',
    sourceType: 'text',
  });

  // Fetch meeting notes, rooms, and product tags on mount
  useEffect(() => {
    fetchNotes();
    fetchRooms();
    fetchProductTags();
  }, [projectId]);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/meeting-notes`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error('Error fetching meeting notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/rooms`);
      if (response.ok) {
        const data = await response.json();
        setRooms(Array.isArray(data) ? data : (data.rooms || []));
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const fetchProductTags = async () => {
    try {
      // Fetch product tags via project data
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const project = await response.json();
        // Extract product tags from project images or productTags
        const tags: Array<{ id: string; product: { name: string } }> = [];
        
        if (project.productTags && Array.isArray(project.productTags)) {
          project.productTags.forEach((tag: any) => {
            tags.push({
              id: tag.id,
              product: { name: tag.product?.name || 'Product' },
            });
          });
        } else if (project.images) {
          project.images.forEach((img: any) => {
            if (img.tags) {
              img.tags.forEach((tag: any) => {
                tags.push({
                  id: tag.id,
                  product: { name: tag.product?.name || 'Product' },
                });
              });
            }
          });
        }
        setProductTags(tags);
      }
    } catch (error) {
      console.error('Error fetching product tags:', error);
    }
  };

  const handleAttach = async (noteId: string, type: 'room' | 'productTag', id: string) => {
    try {
      const response = await fetch(`/api/meeting-notes/${noteId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });

      if (response.ok) {
        fetchNotes(); // Refresh notes
        setAttachingToNoteId(null);
      }
    } catch (error) {
      console.error('Error attaching note:', error);
    }
  };

  const handleDetach = async (noteId: string, attachmentId: string) => {
    try {
      const response = await fetch(
        `/api/meeting-notes/${noteId}/attachments?attachmentId=${attachmentId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        fetchNotes(); // Refresh notes
      }
    } catch (error) {
      console.error('Error detaching note:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rawText.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/meeting-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: formData.sourceType,
          title: formData.title || null,
          rawText: formData.rawText,
        }),
      });

      if (response.ok) {
        const newNote = await response.json();
        setNotes([newNote, ...notes]);
        setFormData({ title: '', rawText: '', sourceType: 'text' });
      } else {
        console.error('Failed to create meeting note');
      }
    } catch (error) {
      console.error('Error creating meeting note:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6" data-tour="meeting-notes-content">
        {/* Add Note Form */}
        <div className="bg-[var(--bg-elevated)] rounded-lg shadow-sm border border-[var(--border-default)] p-6">
          <h2 className="folio-h3 text-[var(--text-primary)] mb-4">
            Add Meeting Note
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="title"
                className="block folio-ui font-medium text-[var(--text-primary)] mb-1"
              >
                Title (optional)
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent bg-[var(--bg-base)]"
                placeholder="e.g., Initial Client Meeting"
              />
            </div>
            <div>
              <label
                htmlFor="rawText"
                className="block folio-ui font-medium text-[var(--text-primary)] mb-1"
              >
                Notes
              </label>
              <textarea
                id="rawText"
                value={formData.rawText}
                onChange={(e) =>
                  setFormData({ ...formData, rawText: e.target.value })
                }
                rows={8}
                required
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent bg-[var(--bg-base)]"
                placeholder="Enter meeting notes, transcript, or other project context..."
              />
            </div>
            <div>
              <label
                htmlFor="sourceType"
                className="block folio-ui font-medium text-[var(--text-primary)] mb-1"
              >
                Source Type
              </label>
              <select
                id="sourceType"
                value={formData.sourceType}
                onChange={(e) =>
                  setFormData({ ...formData, sourceType: e.target.value })
                }
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent bg-[var(--bg-base)]"
              >
                <option value="text">Text</option>
                <option value="audio">Audio</option>
                <option value="file">File</option>
                <option value="external_transcript">External Transcript</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting || !formData.rawText.trim()}
              className="w-full bg-[var(--accent)] text-white py-2 px-4 rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Note'}
            </button>
          </form>
        </div>

        {/* Notes List */}
        <div className="bg-[var(--bg-elevated)] rounded-lg shadow-sm border border-[var(--border-default)] p-6">
          <h2 className="folio-h3 text-[var(--text-primary)] mb-4">
            Meeting Notes ({notes.length})
          </h2>
          {loading ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              Loading notes...
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              No meeting notes yet. Add your first note above.
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="border border-[var(--border-default)] rounded-lg p-4 hover:border-[var(--accent)] transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-[var(--text-primary)]">
                      {note.title || 'Untitled Note'}
                    </h3>
                    <span className="folio-meta text-[var(--text-tertiary)]">
                      {formatDate(note.createdAt)}
                    </span>
                  </div>
                  <p className="folio-body text-[var(--text-secondary)] whitespace-pre-wrap">
                    {note.rawText || 'No content'}
                  </p>
                  
                  {/* Attachments */}
                  {note.attachments && note.attachments.length > 0 && (
                    <div className="mt-3">
                      <NoteAttachmentBadges
                        attachments={note.attachments}
                        onRemove={(attachmentId) => handleDetach(note.id, attachmentId)}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="inline-block folio-meta px-2 py-1 bg-[var(--bg-base)] text-[var(--text-secondary)] rounded">
                      {note.sourceType}
                    </span>

                    {/* Attach button */}
                    <div className="relative">
                      <button
                        onClick={() => setAttachingToNoteId(attachingToNoteId === note.id ? null : note.id)}
                        className="inline-flex items-center gap-1 folio-meta px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] rounded hover:bg-[var(--accent)]/20"
                      >
                        <FaPaperclip />
                        Attach...
                      </button>

                      {attachingToNoteId === note.id && (
                        <div className="absolute left-0 mt-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md shadow-lg z-10 min-w-[200px]">
                          <div className="p-2">
                            <div className="folio-meta font-medium text-[var(--text-primary)] mb-1">Attach to:</div>
                            {rooms.length > 0 && (
                              <div className="mb-2">
                                <div className="folio-meta text-[var(--text-tertiary)] mb-1">Rooms:</div>
                                {rooms.map((room) => (
                                  <button
                                    key={room.id}
                                    onClick={() => handleAttach(note.id, 'room', room.id)}
                                    className="block w-full text-left folio-meta px-2 py-1 hover:bg-[var(--bg-base)] rounded"
                                  >
                                    {room.name}
                                  </button>
                                ))}
                              </div>
                            )}
                            {productTags.length > 0 && (
                              <div>
                                <div className="folio-meta text-[var(--text-tertiary)] mb-1">Products:</div>
                                {productTags.map((tag) => (
                                  <button
                                    key={tag.id}
                                    onClick={() => handleAttach(note.id, 'productTag', tag.id)}
                                    className="block w-full text-left folio-meta px-2 py-1 hover:bg-[var(--bg-base)] rounded"
                                  >
                                    {tag.product.name}
                                  </button>
                                ))}
                              </div>
                            )}
                            {rooms.length === 0 && productTags.length === 0 && (
                              <div className="folio-meta text-[var(--text-tertiary)] py-2">
                                No rooms or products available
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Create Action Item button */}
                    <button
                      onClick={() => setCreateActionItemNoteId(note.id)}
                      className="inline-flex items-center gap-1 folio-meta px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100"
                    >
                      <FaCheckSquare />
                      Create Action Item
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Side Panel - Project Understanding */}
      <div className="lg:col-span-1">
        <ProjectUnderstandingPanel projectId={projectId} />
      </div>

      {/* Create Action Item Modal */}
      {createActionItemNoteId && (
        <CreateActionItemModal
          isOpen={!!createActionItemNoteId}
          onClose={() => setCreateActionItemNoteId(null)}
          onSuccess={() => {
            setCreateActionItemNoteId(null);
            // Optionally refresh action items list if displayed
          }}
          sourceNoteId={createActionItemNoteId}
          projectId={projectId}
          defaultTitle={notes.find((n) => n.id === createActionItemNoteId)?.title || ''}
        />
      )}
    </div>
  );
}

