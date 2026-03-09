import { useState, useEffect } from 'react';
import type { RoomQuestionsGroup, RoomGroupedQuestions } from '@/lib/editorial/roomPacing';
import type { ProjectSizeClassification } from '@/lib/interview/contextLevel';

export interface RoomInterviewQuestionsResult {
  rooms: RoomQuestionsGroup[];
  crossRoomQuestions: RoomGroupedQuestions['crossRoomQuestions'];
  globalGates: RoomGroupedQuestions['globalGates'];
  contextLevel: number;
  contextDescription: string;
  upgradeSuggestion: string | null;
  projectSize: ProjectSizeClassification;
  loading: boolean;
  error: string | null;
}

/**
 * Deduplicate rooms by normalized name — keeps the first (display-format) entry,
 * discards slug duplicates like "dining_room" when "Dining Room" already exists.
 */
function deduplicateRooms(rooms: RoomQuestionsGroup[]): RoomQuestionsGroup[] {
  const seen = new Set<string>();
  return rooms.filter((room) => {
    const normalized = room.roomName.toLowerCase().replace(/_/g, ' ').trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * Fetches interview questions grouped by room from the API.
 * Used by InterviewModal when room pacing is active.
 */
export function useRoomInterviewQuestions(projectId: string): RoomInterviewQuestionsResult {
  const [rooms, setRooms] = useState<RoomQuestionsGroup[]>([]);
  const [crossRoomQuestions, setCrossRoomQuestions] = useState<RoomGroupedQuestions['crossRoomQuestions']>([]);
  const [globalGates, setGlobalGates] = useState<RoomGroupedQuestions['globalGates']>({
    minimumTotalAnswers: 5,
    warnings: [],
  });
  const [contextLevel, setContextLevel] = useState(0);
  const [contextDescription, setContextDescription] = useState('');
  const [upgradeSuggestion, setUpgradeSuggestion] = useState<string | null>(null);
  const [projectSize, setProjectSize] = useState<ProjectSizeClassification>({
    size: 'focused',
    targetQuestionCount: 6,
    roomCount: 0,
    selectionCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    async function fetchGroupedQuestions() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/posting/project/${projectId}/interview/questions?grouped=true`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch grouped questions');
        }

        const data = await response.json();
        if (cancelled) return;

        setRooms(deduplicateRooms(data.rooms || []));
        setCrossRoomQuestions(data.crossRoomQuestions || []);
        setGlobalGates(data.globalGates || { minimumTotalAnswers: 5, warnings: [] });
        setContextLevel(data.contextLevel ?? 0);
        setContextDescription(data.contextDescription || '');
        setUpgradeSuggestion(data.upgradeSuggestion || null);
        setProjectSize(data.projectSize || {
          size: 'focused',
          targetQuestionCount: 6,
          roomCount: 0,
          selectionCount: 0,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          console.error('[useRoomInterviewQuestions] Error:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchGroupedQuestions();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return {
    rooms,
    crossRoomQuestions,
    globalGates,
    contextLevel,
    contextDescription,
    upgradeSuggestion,
    projectSize,
    loading,
    error,
  };
}
