'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface ProjectIntent {
  id: string;
  summary: string | null;
  moodKeywords: string[];
  styleTags: string[];
  budgetLevel: string | null;
  keyObjectives: any;
  constraints: any;
}

interface RoomIntent {
  id: string;
  roomName: string;
  moodKeywords: string[];
  functionalGoals: any;
  mustHaves: any;
  niceToHaves: any;
}

interface ProjectUnderstandingPanelProps {
  projectId: string;
}

export default function ProjectUnderstandingPanel({
  projectId,
}: ProjectUnderstandingPanelProps) {
  const { data: session } = useSession();
  const [projectIntent, setProjectIntent] = useState<ProjectIntent | null>(
    null
  );
  const [roomIntents, setRoomIntents] = useState<RoomIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchUnderstanding();
  }, [projectId]);

  const fetchUnderstanding = async () => {
    try {
      // Fetch project intent (GET request)
      const intentResponse = await fetch(
        `/api/projects/${projectId}/refresh-intent`
      );
      if (intentResponse.ok) {
        const data = await intentResponse.json();
        setProjectIntent(data.projectIntent);
        setRoomIntents(data.roomIntents);
      }
    } catch (error) {
      console.error('Error fetching project understanding:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/refresh-intent`,
        {
          method: 'POST',
        }
      );
      if (response.ok) {
        const data = await response.json();
        setProjectIntent(data.projectIntent);
        setRoomIntents(data.roomIntents);
      }
    } catch (error) {
      console.error('Error refreshing understanding:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-[var(--bg-elevated)] rounded-[20px] shadow-sm border border-[var(--border-default)] p-6 sticky top-4" data-tour="project-understanding">
      <div className="flex items-center justify-between mb-4">
        <h2 className="folio-h3 text-[var(--text-primary)]">
          Project Understanding
        </h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          data-tour="refresh-button"
          className="folio-ui text-[var(--accent)] hover:text-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-[var(--text-secondary)]">Loading...</div>
      ) : !projectIntent ? (
        <div className="text-center py-8 text-[var(--text-secondary)]">
          <p className="mb-4">No project understanding yet.</p>
          <p className="folio-ui">
            Add meeting notes and click "Refresh" to generate understanding.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Project Summary */}
          {projectIntent.summary && (
            <div>
              <h3 className="folio-ui font-medium text-[var(--text-primary)] mb-2">
                Summary
              </h3>
              <p className="folio-body text-[var(--text-secondary)]">{projectIntent.summary}</p>
            </div>
          )}

          {/* Mood Keywords */}
          {projectIntent.moodKeywords.length > 0 && (
            <div>
              <h3 className="folio-ui font-medium text-[var(--text-primary)] mb-2">
                Mood Keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {projectIntent.moodKeywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] folio-meta rounded"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Style Tags */}
          {projectIntent.styleTags.length > 0 && (
            <div>
              <h3 className="folio-ui font-medium text-[var(--text-primary)] mb-2">
                Style Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {projectIntent.styleTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] folio-meta rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Budget Level */}
          {projectIntent.budgetLevel && (
            <div>
              <h3 className="folio-ui font-medium text-[var(--text-primary)] mb-2">
                Budget Level
              </h3>
              <span className="inline-block px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] folio-meta rounded">
                {projectIntent.budgetLevel}
              </span>
            </div>
          )}

          {/* Room Intents */}
          {roomIntents.length > 0 && (
            <div>
              <h3 className="folio-ui font-medium text-[var(--text-primary)] mb-3">
                Room Understanding
              </h3>
              <div className="space-y-4">
                {roomIntents.map((roomIntent) => (
                  <div
                    key={roomIntent.id}
                    className="border border-[var(--border-default)] rounded-[20px] p-4"
                  >
                    <h4 className="font-medium text-[var(--text-primary)] mb-2">
                      {roomIntent.roomName}
                    </h4>
                    {roomIntent.moodKeywords.length > 0 && (
                      <div className="mb-2">
                        <div className="flex flex-wrap gap-1">
                          {roomIntent.moodKeywords.map((keyword, idx) => (
                            <span
                              key={idx}
                              className="inline-block px-2 py-0.5 bg-[var(--bg-base)] text-[var(--text-secondary)] folio-meta rounded"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {roomIntent.functionalGoals && (
                      <div className="folio-meta text-[var(--text-secondary)]">
                        <strong>Goals:</strong>{' '}
                        {JSON.stringify(roomIntent.functionalGoals)}
                      </div>
                    )}
                    {roomIntent.mustHaves && (
                      <div className="folio-meta text-[var(--text-secondary)] mt-1">
                        <strong>Must Haves:</strong>{' '}
                        {JSON.stringify(roomIntent.mustHaves)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

