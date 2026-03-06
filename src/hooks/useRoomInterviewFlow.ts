"use client";

import { useState, useCallback, useMemo } from "react";
import type { InterviewQuestion } from "@/types/interview";
import type {
  RoomQuestionsGroup,
  RoomProgressMap,
  RoomProgressStatus,
  RoomGroupedQuestions,
} from "@/lib/editorial/roomPacing";

// Phase identifiers for General and Reflections rooms
export const GENERAL_ROOM_ID = '__general__';
export const REFLECTIONS_ROOM_ID = '__reflections__';

export type InterviewPhase = 'general' | 'rooms' | 'reflections';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface RoomInterviewFlowState {
  /** All room groups with questions (includes General + Reflections) */
  rooms: RoomQuestionsGroup[];

  /** Current room index */
  currentRoomIndex: number;

  /** Current room group (convenience) */
  currentRoom: RoomQuestionsGroup | null;

  /** Current question index within room */
  currentQuestionIndex: number;

  /** Current question (convenience) */
  currentQuestion: InterviewQuestion | null;

  /** Total questions in current room */
  totalQuestionsInRoom: number;

  /** Per-room progress map */
  roomProgress: RoomProgressMap;

  /** Current interview phase */
  currentPhase: InterviewPhase;

  /** Cross-room phase — asking synthesis questions */
  crossRoomPhase: boolean;

  /** Cross-room questions available */
  crossRoomQuestions: InterviewQuestion[];

  /** Can designer finish the interview? */
  canFinish: boolean;

  /** Active warnings for unanswered important rooms */
  activeWarnings: Array<{ roomId: string; roomName: string; reason: string }>;

  /** Can skip current room (minimum met)? */
  canSkipRoom: boolean;

  /** Can skip reflections phase entirely? */
  canSkipReflections: boolean;

  /** Minimum total answers required */
  minimumTotalAnswers: number;

  /** Total answers given across all rooms */
  totalAnswerCount: number;

  /** Has the interview started (at least 1 room with answers)? */
  hasStarted: boolean;

  // Actions
  advanceQuestion: () => void;
  skipRoom: () => void;
  skipReflections: () => void;
  recordAnswer: (questionId: string) => void;
  goToRoom: (roomIndex: number) => void;
  initFromSavedState: (
    answeredQuestionIds: Set<string>,
    savedProgress: RoomProgressMap | null,
  ) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPhaseForRoom(room: RoomQuestionsGroup | null): InterviewPhase {
  if (!room) return 'rooms';
  if (room.roomId === GENERAL_ROOM_ID) return 'general';
  if (room.roomId === REFLECTIONS_ROOM_ID) return 'reflections';
  return 'rooms';
}

function isActualRoom(room: RoomQuestionsGroup): boolean {
  return room.roomId !== GENERAL_ROOM_ID && room.roomId !== REFLECTIONS_ROOM_ID;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRoomInterviewFlow(
  rooms: RoomQuestionsGroup[],
  crossRoomQuestions: InterviewQuestion[],
  globalGates: RoomGroupedQuestions["globalGates"],
): RoomInterviewFlowState {
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [roomProgress, setRoomProgress] = useState<RoomProgressMap>(() => {
    const initial: RoomProgressMap = {};
    for (const room of rooms) {
      initial[room.roomId] = {
        status: "not_started",
        answeredCount: 0,
        totalQuestions: room.budget.baseQuestions,
        baseQuestions: room.budget.baseQuestions,
      };
    }
    return initial;
  });
  const [crossRoomPhase, setCrossRoomPhase] = useState(false);
  const [crossRoomQuestionIndex, setCrossRoomQuestionIndex] = useState(0);

  // Derived values
  const currentRoom = rooms[currentRoomIndex] ?? null;
  const totalQuestionsInRoom = currentRoom?.questions.length ?? 0;
  const currentPhase = getPhaseForRoom(currentRoom);

  const currentQuestion = useMemo(() => {
    if (crossRoomPhase) {
      return crossRoomQuestions[crossRoomQuestionIndex] ?? null;
    }
    return currentRoom?.questions[currentQuestionIndex] ?? null;
  }, [crossRoomPhase, crossRoomQuestions, crossRoomQuestionIndex, currentRoom, currentQuestionIndex]);

  // Count completed actual rooms (not General/Reflections)
  const actualRooms = useMemo(() => rooms.filter(isActualRoom), [rooms]);

  const completedRoomCount = useMemo(
    () => actualRooms.filter((r) => roomProgress[r.roomId]?.status === "complete").length,
    [actualRooms, roomProgress],
  );

  const skippedRoomCount = useMemo(
    () => actualRooms.filter((r) => roomProgress[r.roomId]?.status === "skipped").length,
    [actualRooms, roomProgress],
  );

  const totalAnswerCount = useMemo(
    () => Object.values(roomProgress).reduce((sum, r) => sum + r.answeredCount, 0),
    [roomProgress],
  );

  const hasStarted = totalAnswerCount > 0;

  // Can skip: General = never, Reflections = always, Rooms = after 1 answer
  const canSkipRoom = useMemo(() => {
    if (!currentRoom) return false;
    if (currentRoom.roomId === GENERAL_ROOM_ID) return false;
    if (currentRoom.roomId === REFLECTIONS_ROOM_ID) return true;
    const progress = roomProgress[currentRoom.roomId];
    return progress ? progress.answeredCount >= 1 : false;
  }, [currentRoom, roomProgress]);

  // Can skip reflections entirely
  const canSkipReflections = useMemo(() => {
    return currentPhase === 'reflections';
  }, [currentPhase]);

  // Active warnings (rooms with 3+ images/5+ tags and zero answers)
  const activeWarnings = useMemo(() => {
    return globalGates.warnings.filter((w) => {
      const progress = roomProgress[w.roomId];
      return progress && progress.answeredCount === 0;
    });
  }, [globalGates.warnings, roomProgress]);

  // Can finish: all actual rooms complete or skipped, minimum total answers met,
  // at least 1 complete, and either reflections complete/skipped or we're past them
  const canFinish = useMemo(() => {
    const allActualDone = completedRoomCount + skippedRoomCount >= actualRooms.length;
    const meetsMinimum = totalAnswerCount >= globalGates.minimumTotalAnswers;
    const hasAtLeastOneComplete = completedRoomCount > 0;
    const generalDone = roomProgress[GENERAL_ROOM_ID]?.status === 'complete';

    // Reflections can be skipped or completed — either counts as "done"
    const reflectionsProgress = roomProgress[REFLECTIONS_ROOM_ID];
    const reflectionsDone = !reflectionsProgress ||
      reflectionsProgress.status === 'complete' ||
      reflectionsProgress.status === 'skipped';

    return allActualDone && meetsMinimum && hasAtLeastOneComplete && generalDone && reflectionsDone;
  }, [completedRoomCount, skippedRoomCount, actualRooms.length, totalAnswerCount, globalGates.minimumTotalAnswers, roomProgress]);

  // Record an answer for a question
  const recordAnswer = useCallback(
    (questionId: string) => {
      if (!currentRoom) return;
      setRoomProgress((prev) => {
        const current = prev[currentRoom.roomId] || {
          status: "not_started" as RoomProgressStatus,
          answeredCount: 0,
          totalQuestions: currentRoom.budget.baseQuestions,
          baseQuestions: currentRoom.budget.baseQuestions,
        };
        const newCount = current.answeredCount + 1;
        const isComplete = newCount >= current.totalQuestions;
        return {
          ...prev,
          [currentRoom.roomId]: {
            ...current,
            answeredCount: newCount,
            status: isComplete ? "complete" : "in_progress",
          },
        };
      });
    },
    [currentRoom],
  );

  // Find next room that isn't complete or skipped
  const findNextRoom = useCallback(
    (fromIndex: number): number | null => {
      for (let i = fromIndex; i < rooms.length; i++) {
        const progress = roomProgress[rooms[i].roomId];
        if (!progress || progress.status === "not_started" || progress.status === "in_progress") {
          return i;
        }
      }
      return null;
    },
    [rooms, roomProgress],
  );

  // Advance to next question in room, or next room if done
  const advanceQuestion = useCallback(() => {
    if (crossRoomPhase) {
      if (crossRoomQuestionIndex < crossRoomQuestions.length - 1) {
        setCrossRoomQuestionIndex((i) => i + 1);
      }
      return;
    }

    if (currentQuestionIndex < totalQuestionsInRoom - 1) {
      // More questions in current room
      setCurrentQuestionIndex((i) => i + 1);
    } else {
      // Room done — mark complete
      if (currentRoom) {
        setRoomProgress((prev) => ({
          ...prev,
          [currentRoom.roomId]: {
            ...prev[currentRoom.roomId],
            status: "complete",
          },
        }));
      }

      // Move to next room (General → rooms → Reflections)
      const nextIdx = findNextRoom(currentRoomIndex + 1);
      if (nextIdx !== null) {
        setCurrentRoomIndex(nextIdx);
        setCurrentQuestionIndex(0);
      }
      // If no next room, canFinish will be true and the UI shows "Finish interview"
    }
  }, [
    crossRoomPhase,
    crossRoomQuestionIndex,
    crossRoomQuestions.length,
    currentQuestionIndex,
    totalQuestionsInRoom,
    currentRoom,
    currentRoomIndex,
    findNextRoom,
  ]);

  // Skip current room
  const skipRoom = useCallback(() => {
    if (!currentRoom) return;
    if (currentRoom.roomId === GENERAL_ROOM_ID) return; // General can't be skipped

    setRoomProgress((prev) => ({
      ...prev,
      [currentRoom.roomId]: {
        ...prev[currentRoom.roomId],
        status: "skipped",
      },
    }));

    const nextIdx = findNextRoom(currentRoomIndex + 1);
    if (nextIdx !== null) {
      setCurrentRoomIndex(nextIdx);
      setCurrentQuestionIndex(0);
    }
  }, [currentRoom, currentRoomIndex, findNextRoom]);

  // Skip reflections entirely
  const skipReflections = useCallback(() => {
    setRoomProgress((prev) => ({
      ...prev,
      [REFLECTIONS_ROOM_ID]: {
        ...prev[REFLECTIONS_ROOM_ID],
        status: "skipped",
      },
    }));
  }, []);

  // Go to a specific room
  const goToRoom = useCallback((roomIndex: number) => {
    if (roomIndex >= 0 && roomIndex < rooms.length) {
      setCurrentRoomIndex(roomIndex);
      setCurrentQuestionIndex(0);
    }
  }, [rooms.length]);

  // Initialize from saved state (resume)
  const initFromSavedState = useCallback(
    (answeredQuestionIds: Set<string>, savedProgress: RoomProgressMap | null) => {
      if (savedProgress) {
        setRoomProgress(savedProgress);
      } else {
        // Compute room progress from answered question IDs
        const computed: RoomProgressMap = {};
        for (const room of rooms) {
          const answered = room.questions.filter((q) => answeredQuestionIds.has(q.id)).length;
          const isComplete = answered >= room.budget.baseQuestions;
          computed[room.roomId] = {
            status: answered === 0 ? "not_started" : isComplete ? "complete" : "in_progress",
            answeredCount: answered,
            totalQuestions: room.budget.baseQuestions,
            baseQuestions: room.budget.baseQuestions,
          };
        }
        setRoomProgress(computed);
      }

      // Find first incomplete room
      const progress = savedProgress || roomProgress;
      for (let i = 0; i < rooms.length; i++) {
        const p = progress[rooms[i].roomId];
        if (!p || p.status === "in_progress" || p.status === "not_started") {
          setCurrentRoomIndex(i);
          const firstUnanswered = rooms[i].questions.findIndex(
            (q) => !answeredQuestionIds.has(q.id),
          );
          setCurrentQuestionIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
          break;
        }
      }
    },
    [rooms, roomProgress],
  );

  return {
    rooms,
    currentRoomIndex,
    currentRoom,
    currentQuestionIndex,
    currentQuestion,
    totalQuestionsInRoom,
    roomProgress,
    currentPhase,
    crossRoomPhase,
    crossRoomQuestions,
    canFinish,
    activeWarnings,
    canSkipRoom,
    canSkipReflections,
    minimumTotalAnswers: globalGates.minimumTotalAnswers,
    totalAnswerCount,
    hasStarted,
    advanceQuestion,
    skipRoom,
    skipReflections,
    recordAnswer,
    goToRoom,
    initFromSavedState,
  };
}
