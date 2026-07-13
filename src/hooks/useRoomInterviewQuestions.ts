import { useState, useEffect, useRef, useCallback } from 'react';
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
  /**
   * True while room groups are expected but haven't arrived yet (two-phase
   * generation: the About This Project group loads first; room questions are
   * generated later, informed by the designer's About answers).
   */
  roomsPending: boolean;
  /** Set when the rooms-phase fetch failed — lets the UI degrade instead of hang. */
  roomsError: string | null;
  /**
   * Trigger the rooms phase (idempotent — repeat calls while a fetch is in
   * flight or after success are no-ops; a failed attempt may be retried).
   * Call once the About This Project base answers are saved, so room
   * questions are generated WITH the designer's answers as context.
   */
  loadRooms: () => void;
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
 * Fetches interview questions grouped by room from the API, in two phases:
 *
 * Phase 1 (on mount): `phase=project` — just the About This Project group.
 * One fast LLM call, so the designer starts answering almost immediately.
 *
 * Phase 2 (via loadRooms(), called by the modal once the About base answers
 * are saved): `phase=rooms` — room questions generated server-side WITH a
 * fact digest of the designer's About answers, then appended to `rooms`.
 *
 * A fresh full-set localStorage cache short-circuits both phases (instant,
 * free re-opens with stable question IDs).
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
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  // Idempotency + merge bookkeeping for the rooms phase
  const roomsRequestedRef = useRef(false);
  const phase1DataRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const cacheKey = `folio.interview.qcache.grouped.${projectId}`;
  const signature = cacheSignature ?? 'default';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    // New signature (photos/tags changed) → full regeneration cycle
    roomsRequestedRef.current = false;
    phase1DataRef.current = null;
    setRoomsLoaded(false);
    setRoomsError(null);

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

    // Serve instantly from cache (and skip the LLM refetch) when fresh — no
    // wait, no repeated API spend. Only trust a cache that holds the FULL set:
    // more than just the project group, or a 0-room project where the project
    // group IS the full set. A project-only cache from an interrupted phase-1
    // session must not suppress the rooms phase.
    const cached = readQuestionsCache<any>(cacheKey, signature);
    if (cached && Array.isArray(cached.rooms) && cached.rooms.length > 0) {
      const isFullSet =
        cached.rooms.length > 1 || (cached.projectSize?.roomCount ?? 0) === 0;
      if (isFullSet) {
        applyData(cached);
        phase1DataRef.current = cached;
        setRoomsLoaded(true);
        setLoading(false);
        return () => {
          cancelled = true;
        };
      }
    }

    async function fetchProjectPhase() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/posting/project/${projectId}/interview/questions?grouped=true&phase=project`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch grouped questions');
        }

        const data = await response.json();
        if (cancelled) return;

        applyData(data);
        phase1DataRef.current = data;
        // 0-room project: the project group is the complete set — nothing pending.
        if ((data.projectSize?.roomCount ?? 0) === 0) {
          setRoomsLoaded(true);
          if (Array.isArray(data.rooms) && data.rooms.length > 0) {
            writeQuestionsCache(cacheKey, signature, data);
          }
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

    fetchProjectPhase();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, cacheSignature]);

  const loadRooms = useCallback(() => {
    if (!projectId) return;
    if (roomsRequestedRef.current) return;
    roomsRequestedRef.current = true;

    (async () => {
      try {
        const response = await fetch(
          `/api/posting/project/${projectId}/interview/questions?grouped=true&phase=rooms`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch room questions');
        }
        const data = await response.json();
        if (!mountedRef.current) return;

        const phase1 = phase1DataRef.current;
        const mergedRooms = pinProjectFirst(
          deduplicateRooms([...(phase1?.rooms || []), ...(data.rooms || [])])
        );
        setRooms(mergedRooms);
        if (data.globalGates) setGlobalGates(data.globalGates);
        setRoomsError(null);
        setRoomsLoaded(true);

        // Cache the assembled full set so re-opens are instant with stable IDs
        if (phase1 && mergedRooms.length > 1) {
          writeQuestionsCache(cacheKey, signature, {
            ...phase1,
            rooms: mergedRooms,
            globalGates: data.globalGates ?? phase1.globalGates,
          });
        }
      } catch (err) {
        if (!mountedRef.current) return;
        // Allow a later trigger to retry rather than dead-ending the interview
        roomsRequestedRef.current = false;
        setRoomsError(err instanceof Error ? err.message : 'Unknown error');
        console.error('[useRoomInterviewQuestions] loadRooms error:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    roomsPending: !roomsLoaded && (projectSize.roomCount ?? 0) > 0,
    roomsError,
    loadRooms,
  };
}
