import { useState, useEffect } from 'react';
import type { RoomQuestionsGroup, RoomGroupedQuestions } from '@/lib/editorial/roomPacing';
import type { ProjectSizeClassification } from '@/lib/interview/contextLevel';
import { readQuestionsCache, writeQuestionsCache } from '@/lib/interview/questionsCache';

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
 * Pin the "About This Project" group (roomId 'project') to index 0. The server
 * already emits it first, but this is order-preserving defense-in-depth so the
 * project section can never render after a real room — no matter the response
 * order — keeping the section list stable and flicker-free.
 */
function pinProjectFirst(rooms: RoomQuestionsGroup[]): RoomQuestionsGroup[] {
  const projectIdx = rooms.findIndex((r) => r.roomId === 'project');
  if (projectIdx <= 0) return rooms;
  const project = rooms[projectIdx];
  return [project, ...rooms.slice(0, projectIdx), ...rooms.slice(projectIdx + 1)];
}

/**
 * Fetches interview questions grouped by room from the API.
 * Used by InterviewModal when room pacing is active.
 */
export function useRoomInterviewQuestions(
  projectId: string,
  cacheSignature?: string,
): RoomInterviewQuestionsResult {
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

    const cacheKey = `folio.interview.qcache.grouped.${projectId}`;
    const signature = cacheSignature ?? 'default';

    const applyData = (data: any) => {
      setRooms(pinProjectFirst(deduplicateRooms(data.rooms || [])));
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
    };

    // Serve instantly from cache (and skip the slow LLM refetch) when fresh — no
    // wait, no repeated API spend. Only trust a cache that actually has rooms.
    const cached = readQuestionsCache<any>(cacheKey, signature);
    if (cached && Array.isArray(cached.rooms) && cached.rooms.length > 0) {
      applyData(cached);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

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

        applyData(data);
        if (Array.isArray(data.rooms) && data.rooms.length > 0) {
          writeQuestionsCache(cacheKey, signature, data);
        }
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
  }, [projectId, cacheSignature]);

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
