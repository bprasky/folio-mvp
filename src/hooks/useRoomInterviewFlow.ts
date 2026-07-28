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

  /** How many more answers needed before skip becomes available */
  answersUntilSkip: number;

  /** How many unanswered questions remain in current room */
  remainingInRoom: number;

  /** Minimum total answers required */
  minimumTotalAnswers: number;

  /** Total answers given across all rooms */
  totalAnswerCount: number;

  /** Has the interview started (at least 1 room with answers)? */
  hasStarted: boolean;

  /** Full question list for the current room (base + inserted follow-ups) */
  currentRoomQuestions: InterviewQuestion[];

  /** Per-room follow-up tracking: how many follow-ups generated vs budget */
  followUpsGeneratedInRoom: number;
  maxFollowUpsInRoom: number;

  /** Current round (1 = base, 2+ = follow-up) for the current room */
  currentRound: number;

  /** True while waiting for batch follow-up generation between rounds */
  pendingRoundTransition: boolean;

  /** True when the current room is the project-level phase (roomId === 'project') */
  isProjectPhase: boolean;

  // Actions
  advanceQuestion: () => void;
  skipRoom: () => void;
  recordAnswer: (questionId: string) => void;
  goToRoom: (roomIndex: number) => void;
  /**
   * Navigate to a specific question by id (for editing one saved answer in
   * place). Returns false when the id isn't in the current question set.
   */
  goToQuestionId: (questionId: string) => boolean;
  /** Insert follow-up questions into the current room's question queue (legacy single mode) */
  insertFollowUpQuestions: (questions: InterviewQuestion[]) => void;
  /** Insert batch follow-up questions for the next round */
  insertRoundQuestions: (questions: InterviewQuestion[]) => void;
  /** Complete a round transition (when no follow-ups generated or room doesn't qualify) */
  completeRoundTransition: () => void;
  /** Navigate to the previous question within the current room/phase */
  goToPreviousQuestion: () => void;
  /** Whether the user can go back to a previous question */
  canGoBack: boolean;
  /** Apply persisted room statuses without navigating — hydrates on load (C0). */
  hydrateStatuses: (
    entries: Array<{ roomId: string; status: RoomProgressStatus }>,
  ) => void;
  /**
   * Reset all internal flow state to a pristine interview — used by "Start over"
   * so a cleared interview doesn't retain stale room progress (which would make
   * resume navigation / finish detection fire off the old, deleted state).
   */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRoomInterviewFlow(
  rooms: RoomQuestionsGroup[],
  crossRoomQuestions: InterviewQuestion[],
  globalGates: RoomGroupedQuestions["globalGates"],
  options?: {
    /**
     * Fired when a room reaches a terminal status the server must learn (C0):
     * 'complete' from finalizeRoomAndAdvance, 'skipped' from skipRoom. The modal
     * persists it into EditorialInterview.roomProgress. Must be stable.
     */
    onRoomStatusChange?: (roomId: string, status: RoomProgressStatus) => void;
  },
): RoomInterviewFlowState {
  const onRoomStatusChange = options?.onRoomStatusChange;
  // Build the pristine per-room progress map (all rooms not_started). Shared by
  // the initial state and reset() so "Start over" restores exactly the same
  // shape the hook mounts with.
  const buildInitialProgress = useCallback((): RoomProgressMap => {
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
  }, [rooms]);

  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [roomProgress, setRoomProgress] = useState<RoomProgressMap>(buildInitialProgress);
  const [crossRoomPhase, setCrossRoomPhase] = useState(false);
  const [crossRoomQuestionIndex, setCrossRoomQuestionIndex] = useState(0);

  // Follow-up tracking: per-room count of generated follow-ups
  const [followUpCounts, setFollowUpCounts] = useState<Record<string, number>>({});
  // Dynamic question lists per room (base + inserted follow-ups)
  const [roomQuestionOverrides, setRoomQuestionOverrides] = useState<Record<string, InterviewQuestion[]>>({});

  // Round-based follow-up tracking
  const [roomRound, setRoomRound] = useState<Record<string, number>>({}); // roomId → current round (1, 2, 3)
  const [pendingRoundTransition, setPendingRoundTransition] = useState(false);

  // Derived values
  const currentRoom = rooms[currentRoomIndex] ?? null;
  // Use overridden question list (with follow-ups inserted) if available
  const currentRoomQuestions = useMemo(() => {
    if (!currentRoom) return [];
    return roomQuestionOverrides[currentRoom.roomId] || currentRoom.questions;
  }, [currentRoom, roomQuestionOverrides]);
  const totalQuestionsInRoom = currentRoomQuestions.length;

  const currentQuestion = useMemo(() => {
    if (crossRoomPhase) {
      return crossRoomQuestions[crossRoomQuestionIndex] ?? null;
    }
    return currentRoomQuestions[currentQuestionIndex] ?? null;
  }, [crossRoomPhase, crossRoomQuestions, crossRoomQuestionIndex, currentRoomQuestions, currentQuestionIndex]);

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

  // Can skip: answered at least ceil(budget * 0.6) questions in current room.
  // First room (index 0) cannot be skipped — it sets the interview tone.
  const skipMinimumForRoom = useMemo(() => {
    if (!currentRoom) return Infinity;
    return Math.ceil(currentRoom.budget.baseQuestions * 0.6);
  }, [currentRoom]);

  // Skip is now always available in the question phase (A2). The 60% answer gate
  // and the index-0 gate are intentionally removed — the room-vs-question choice
  // (and the About-group exception) is decided by the skip sheet UI, not here.
  const canSkipRoom = useMemo(() => !!currentRoom, [currentRoom]);

  // How many more answers needed before skip is available (for UI label)
  const answersUntilSkip = useMemo(() => {
    if (!currentRoom || currentRoomIndex === 0) return Infinity;
    const progress = roomProgress[currentRoom.roomId];
    const answered = progress?.answeredCount ?? 0;
    return Math.max(0, skipMinimumForRoom - answered);
  }, [currentRoom, currentRoomIndex, roomProgress, skipMinimumForRoom]);

  // How many questions remain unanswered in current room (for skip button label)
  const remainingInRoom = useMemo(() => {
    if (!currentRoom) return 0;
    const progress = roomProgress[currentRoom.roomId];
    const answered = progress?.answeredCount ?? 0;
    return Math.max(0, currentRoom.budget.baseQuestions - answered);
  }, [currentRoom, roomProgress]);

  // Follow-up budget tracking for current room
  const followUpsGeneratedInRoom = useMemo(() => {
    if (!currentRoom) return 0;
    return followUpCounts[currentRoom.roomId] || 0;
  }, [currentRoom, followUpCounts]);

  const maxFollowUpsInRoom = useMemo(() => {
    if (!currentRoom) return 0;
    return currentRoom.budget.maxFollowUps;
  }, [currentRoom]);

  // Current round for the active room (1 = base, 2+ = follow-up)
  const currentRound = useMemo(() => {
    if (!currentRoom) return 1;
    return roomRound[currentRoom.roomId] || 1;
  }, [currentRoom, roomRound]);

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
      // Total questions = dynamic list length (base + any inserted follow-ups)
      const dynamicTotal = currentRoomQuestions.length;
      setRoomProgress((prev) => {
        const current = prev[currentRoom.roomId] || {
          status: "not_started" as RoomProgressStatus,
          answeredCount: 0,
          totalQuestions: dynamicTotal,
          baseQuestions: currentRoom.budget.baseQuestions,
        };
        const newCount = current.answeredCount + 1;
        const isComplete = newCount >= dynamicTotal;
        return {
          ...prev,
          [currentRoom.roomId]: {
            ...current,
            answeredCount: newCount,
            totalQuestions: dynamicTotal,
            status: isComplete ? "complete" : "in_progress",
          },
        };
      });
    },
    [currentRoom, currentRoomQuestions],
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

  // Helper: finalize room and move to next
  const finalizeRoomAndAdvance = useCallback(() => {
    if (currentRoom) {
      // D1: a room reaches finalize with zero answers only when the designer
      // skipped every question individually (skip-question, not skip-room) —
      // recordAnswer was never called for it. Classify that as 'skipped', not
      // 'complete', so C0 never records a finished room that has no answers
      // (the caveat-4 contradiction). Any answered room finalizes 'complete'.
      //
      // Staleness note: answeredCount is read from the closure's roomProgress.
      // In the single path where the last answer is recorded in the SAME tick as
      // finalize (round 3+ via advanceQuestion), that count is stale by one — but
      // it never flips the zero-vs-nonzero decision: that path only runs at
      // round 3+, where the count is already well above zero, while the zero case
      // arises solely from skip-question, which calls no recordAnswer and so
      // carries an accurate 0.
      const answeredCount = roomProgress[currentRoom.roomId]?.answeredCount ?? 0;
      const finalStatus: RoomProgressStatus =
        answeredCount === 0 ? "skipped" : "complete";
      setRoomProgress((prev) => ({
        ...prev,
        [currentRoom.roomId]: {
          ...prev[currentRoom.roomId],
          status: finalStatus,
        },
      }));
      // C0/D1: emit the SAME status written locally — the local write and the
      // server emit must never disagree.
      onRoomStatusChange?.(currentRoom.roomId, finalStatus);
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
  }, [currentRoom, roomProgress, completedRoomCount, crossRoomQuestions.length, crossRoomPhase, currentRoomIndex, findNextRoom, onRoomStatusChange]);

  // Advance to next question in room, or trigger round transition / next room
  const advanceQuestion = useCallback(() => {
    if (crossRoomPhase) {
      if (crossRoomQuestionIndex < crossRoomQuestions.length - 1) {
        setCrossRoomQuestionIndex((i) => i + 1);
      }
      // Cross-room done — canFinish check handles the rest
      return;
    }

    if (currentQuestionIndex < totalQuestionsInRoom - 1) {
      // More questions in current room/round
      setCurrentQuestionIndex((i) => i + 1);
    } else {
      // All questions in current round answered — check if we should generate more rounds
      const round = currentRoom ? (roomRound[currentRoom.roomId] || 1) : 1;

      if (round <= 2) {
        // Round 1 or 2 just finished — signal round transition for batch follow-up generation
        // InterviewModal will call the batch endpoint and then call insertRoundQuestions or completeRoundTransition
        setPendingRoundTransition(true);
      } else {
        // Round 3+ done — room is truly complete
        finalizeRoomAndAdvance();
      }
    }
  }, [
    crossRoomPhase,
    crossRoomQuestionIndex,
    crossRoomQuestions.length,
    currentQuestionIndex,
    totalQuestionsInRoom,
    currentRoom,
    roomRound,
    finalizeRoomAndAdvance,
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
    // C0: persist the skip via the same status channel as completion.
    onRoomStatusChange?.(currentRoom.roomId, "skipped");

    const nextIdx = findNextRoom(currentRoomIndex + 1);
    if (nextIdx !== null) {
      setCurrentRoomIndex(nextIdx);
      setCurrentQuestionIndex(0);
    }
    // If no next room, canFinish check handles the rest
  }, [currentRoom, currentRoomIndex, findNextRoom, onRoomStatusChange]);

  // Go to a specific room
  const goToRoom = useCallback((roomIndex: number) => {
    if (roomIndex >= 0 && roomIndex < rooms.length) {
      setCurrentRoomIndex(roomIndex);
      setCurrentQuestionIndex(0);
    }
  }, [rooms.length]);

  // Navigate to a specific question by id — the room that holds it and the
  // question's index within that room (or the cross-room queue). Used to edit
  // one saved answer in place: with persisted (stable) question IDs, the saved
  // answer's questionId still matches a live question, so we can land on it and
  // pre-fill it. Returns false when the id isn't in the current set (e.g. the
  // project changed and questions regenerated), so the caller can fall back.
  const goToQuestionId = useCallback(
    (questionId: string): boolean => {
      for (let ri = 0; ri < rooms.length; ri++) {
        const room = rooms[ri];
        const list = roomQuestionOverrides[room.roomId] || room.questions;
        const qi = list.findIndex((q) => q.id === questionId);
        if (qi >= 0) {
          setCrossRoomPhase(false);
          setCurrentRoomIndex(ri);
          setCurrentQuestionIndex(qi);
          return true;
        }
      }
      const ci = crossRoomQuestions.findIndex((q) => q.id === questionId);
      if (ci >= 0) {
        setCrossRoomPhase(true);
        setCrossRoomQuestionIndex(ci);
        return true;
      }
      return false;
    },
    [rooms, roomQuestionOverrides, crossRoomQuestions],
  );

  // Insert follow-up questions into the current room's question queue.
  // Respects the room's maxFollowUps budget — only inserts up to the remaining budget.
  const insertFollowUpQuestions = useCallback(
    (questions: InterviewQuestion[]) => {
      if (!currentRoom || questions.length === 0) return;

      const roomId = currentRoom.roomId;
      const maxFollowUps = currentRoom.budget.maxFollowUps;
      const alreadyGenerated = followUpCounts[roomId] || 0;
      const remainingBudget = Math.max(0, maxFollowUps - alreadyGenerated);

      if (remainingBudget === 0) return;

      const toInsert = questions.slice(0, remainingBudget);

      // Update follow-up count
      setFollowUpCounts((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || 0) + toInsert.length,
      }));

      // Insert follow-ups right after the current question index in the dynamic list
      setRoomQuestionOverrides((prev) => {
        const currentList = prev[roomId] || currentRoom.questions;
        const insertAt = currentQuestionIndex + 1;
        const updated = [
          ...currentList.slice(0, insertAt),
          ...toInsert,
          ...currentList.slice(insertAt),
        ];
        return { ...prev, [roomId]: updated };
      });

      // Update totalQuestions in room progress to reflect the new questions
      setRoomProgress((prev) => {
        const current = prev[roomId];
        if (!current) return prev;
        return {
          ...prev,
          [roomId]: {
            ...current,
            totalQuestions: current.totalQuestions + toInsert.length,
          },
        };
      });
    },
    [currentRoom, currentQuestionIndex, followUpCounts],
  );

  // Insert batch follow-up questions for the next round (round-based flow).
  // Appends questions to end of the room's question list and advances the round counter.
  const insertRoundQuestions = useCallback(
    (questions: InterviewQuestion[]) => {
      if (!currentRoom || questions.length === 0) {
        // No follow-ups generated — complete the transition
        setPendingRoundTransition(false);
        finalizeRoomAndAdvance();
        return;
      }

      const roomId = currentRoom.roomId;
      const round = roomRound[roomId] || 1;

      // Advance round counter
      setRoomRound((prev) => ({ ...prev, [roomId]: round + 1 }));

      // Append follow-ups to end of the room's question list
      setRoomQuestionOverrides((prev) => {
        const currentList = prev[roomId] || currentRoom.questions;
        return { ...prev, [roomId]: [...currentList, ...questions] };
      });

      // Update totalQuestions in room progress
      setRoomProgress((prev) => {
        const current = prev[roomId];
        if (!current) return prev;
        return {
          ...prev,
          [roomId]: {
            ...current,
            totalQuestions: current.totalQuestions + questions.length,
          },
        };
      });

      // Advance to the first follow-up question (next after current last)
      setCurrentQuestionIndex((prev) => prev + 1);

      // Clear transition state
      setPendingRoundTransition(false);
    },
    [currentRoom, roomRound, finalizeRoomAndAdvance],
  );

  // Complete a round transition without adding questions (room is done).
  const completeRoundTransition = useCallback(() => {
    setPendingRoundTransition(false);
    finalizeRoomAndAdvance();
  }, [finalizeRoomAndAdvance]);

  // Apply persisted statuses (from server roomProgress / localStorage draft)
  // without moving the designer — hydrates 'complete' and 'skipped' on resume
  // (C0). Never downgrades: an incoming status applies only when it ranks >= the
  // current one, so stale hydration can't undo progress made this session.
  const hydrateStatuses = useCallback(
    (entries: Array<{ roomId: string; status: RoomProgressStatus }>) => {
      if (!entries.length) return;
      const rank: Record<RoomProgressStatus, number> = {
        not_started: 0,
        in_progress: 1,
        skipped: 2,
        complete: 3,
      };
      setRoomProgress((prev) => {
        const next = { ...prev };
        for (const { roomId, status } of entries) {
          const cur = next[roomId];
          const curRank = cur ? rank[cur.status] : -1;
          if (rank[status] < curRank) continue;
          next[roomId] = {
            status,
            answeredCount: cur?.answeredCount ?? 0,
            totalQuestions: cur?.totalQuestions ?? 0,
            baseQuestions: cur?.baseQuestions ?? 0,
          };
        }
        return next;
      });
    },
    [],
  );

  // Reset to a pristine interview (Start over). Mirrors the hook's mount state.
  const reset = useCallback(() => {
    setCurrentRoomIndex(0);
    setCurrentQuestionIndex(0);
    setRoomProgress(buildInitialProgress());
    setCrossRoomPhase(false);
    setCrossRoomQuestionIndex(0);
    setFollowUpCounts({});
    setRoomQuestionOverrides({});
    setRoomRound({});
    setPendingRoundTransition(false);
  }, [buildInitialProgress]);

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

  // Navigate to the previous question within the current room/phase
  const canGoBack = crossRoomPhase
    ? crossRoomQuestionIndex > 0
    : currentQuestionIndex > 0;

  const goToPreviousQuestion = useCallback(() => {
    if (crossRoomPhase) {
      if (crossRoomQuestionIndex > 0) {
        setCrossRoomQuestionIndex((i) => i - 1);
      }
      return;
    }
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((i) => i - 1);
    }
  }, [crossRoomPhase, crossRoomQuestionIndex, currentQuestionIndex]);

  return {
    rooms,
    currentRoomIndex,
    currentRoom,
    currentQuestionIndex,
    currentQuestion,
    currentRoomQuestions,
    totalQuestionsInRoom,
    roomProgress,
    crossRoomPhase,
    crossRoomQuestions,
    canFinish,
    activeWarnings,
    canSkipRoom,
    answersUntilSkip,
    remainingInRoom,
    followUpsGeneratedInRoom,
    maxFollowUpsInRoom,
    currentRound,
    pendingRoundTransition,
    isProjectPhase: currentRoom?.roomId === 'project',
    minimumTotalAnswers: globalGates.minimumTotalAnswers,
    totalAnswerCount,
    hasStarted,
    canGoBack,
    advanceQuestion,
    skipRoom,
    recordAnswer,
    goToRoom,
    goToQuestionId,
    goToPreviousQuestion,
    insertFollowUpQuestions,
    insertRoundQuestions,
    completeRoundTransition,
    hydrateStatuses,
    reset,
  };
}
