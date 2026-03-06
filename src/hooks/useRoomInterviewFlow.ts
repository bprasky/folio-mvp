"use client";

import { useState, useCallback, useMemo } from "react";
import type { InterviewQuestion } from "@/types/interview";
import type {
  RoomQuestionsGroup,
  RoomProgressMap,
  RoomProgressStatus,
  RoomGroupedQuestions,
} from "@/lib/editorial/roomPacing";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface RoomInterviewFlowState {
  /** All room groups with questions */
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

  /** Minimum total answers required */
  minimumTotalAnswers: number;

  /** Total answers given across all rooms */
  totalAnswerCount: number;

  /** Has the interview started (at least 1 room with answers)? */
  hasStarted: boolean;

  // Actions
  advanceQuestion: () => void;
  skipRoom: () => void;
  recordAnswer: (questionId: string) => void;
  goToRoom: (roomIndex: number) => void;
  initFromSavedState: (
    answeredQuestionIds: Set<string>,
    savedProgress: RoomProgressMap | null,
  ) => void;
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

  const currentQuestion = useMemo(() => {
    if (crossRoomPhase) {
      return crossRoomQuestions[crossRoomQuestionIndex] ?? null;
    }
    return currentRoom?.questions[currentQuestionIndex] ?? null;
  }, [crossRoomPhase, crossRoomQuestions, crossRoomQuestionIndex, currentRoom, currentQuestionIndex]);

  // Count completed rooms
  const completedRoomCount = useMemo(
    () => Object.values(roomProgress).filter((r) => r.status === "complete").length,
    [roomProgress],
  );

  const skippedRoomCount = useMemo(
    () => Object.values(roomProgress).filter((r) => r.status === "skipped").length,
    [roomProgress],
  );

  const totalAnswerCount = useMemo(
    () => Object.values(roomProgress).reduce((sum, r) => sum + r.answeredCount, 0),
    [roomProgress],
  );

  const hasStarted = totalAnswerCount > 0;

  // Can skip: answered at least 1 question in current room (room minimum = 1 for skip purposes;
  // the spec says skip appears after room minimum — here, answering at least 1 question enables it)
  const canSkipRoom = useMemo(() => {
    if (!currentRoom) return false;
    const progress = roomProgress[currentRoom.roomId];
    return progress ? progress.answeredCount >= 1 : false;
  }, [currentRoom, roomProgress]);

  // Active warnings (rooms with 3+ images/5+ tags and zero answers)
  const activeWarnings = useMemo(() => {
    return globalGates.warnings.filter((w) => {
      const progress = roomProgress[w.roomId];
      return progress && progress.answeredCount === 0;
    });
  }, [globalGates.warnings, roomProgress]);

  // Can finish: all rooms complete or skipped, minimum total answers met, at least 1 complete
  const canFinish = useMemo(() => {
    const allDone = completedRoomCount + skippedRoomCount >= rooms.length;
    const meetsMinimum = totalAnswerCount >= globalGates.minimumTotalAnswers;
    const hasAtLeastOneComplete = completedRoomCount > 0;
    return allDone && meetsMinimum && hasAtLeastOneComplete;
  }, [completedRoomCount, skippedRoomCount, rooms.length, totalAnswerCount, globalGates.minimumTotalAnswers]);

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
      // Wrap around
      for (let i = 0; i < fromIndex; i++) {
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
      // Cross-room done — canFinish check handles the rest
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

      // Check if we should enter cross-room phase
      const newCompletedCount = completedRoomCount + 1;
      if (newCompletedCount >= 3 && crossRoomQuestions.length > 0 && !crossRoomPhase) {
        setCrossRoomPhase(true);
        setCrossRoomQuestionIndex(0);
        return;
      }

      // Move to next room
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
    completedRoomCount,
    currentRoomIndex,
    findNextRoom,
  ]);

  // Skip current room
  const skipRoom = useCallback(() => {
    if (!currentRoom) return;

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
    // If no next room, canFinish check handles the rest
  }, [currentRoom, currentRoomIndex, findNextRoom]);

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
          // Find first unanswered question in this room
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

  // Build room progress array for the progress bar
  const roomProgressForBar = useMemo(
    () =>
      rooms.map((room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        status: (roomProgress[room.roomId]?.status ?? "not_started") as RoomProgressStatus,
        answeredCount: roomProgress[room.roomId]?.answeredCount ?? 0,
        totalQuestions: room.budget.baseQuestions,
      })),
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
    crossRoomPhase,
    crossRoomQuestions,
    canFinish,
    activeWarnings,
    canSkipRoom,
    minimumTotalAnswers: globalGates.minimumTotalAnswers,
    totalAnswerCount,
    hasStarted,
    advanceQuestion,
    skipRoom,
    recordAnswer,
    goToRoom,
    initFromSavedState,
  };
}
