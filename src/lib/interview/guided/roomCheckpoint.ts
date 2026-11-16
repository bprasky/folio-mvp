import type { GuidedQuestion, GuidedSession } from './types';

export const ROOM_CHECKPOINT_CATEGORY = 'room_wrapup';
export const isRoomCheckpoint = (question: GuidedQuestion | null | undefined) => question?.category === ROOM_CHECKPOINT_CATEGORY;
export const isRoomInvitation = (question: GuidedQuestion | null | undefined) => isRoomCheckpoint(question) && !question?.parentQuestionId;

export function roomCheckpointPrompt(roomName: string, nextRoomName?: string) {
  return nextRoomName
    ? `Before we move to ${nextRoomName}, did we miss anything you wanted to mention about ${roomName}?`
    : `Did we miss anything you wanted to mention about ${roomName}?`;
}

export function checkpointDestination(session: GuidedSession, question: GuidedQuestion) {
  const target = session.plan.find(q => q.id === question.checkpointReturnQuestionId && ['pending', 'active'].includes(q.status));
  return target ? target.roomId ? session.rooms.find(room => room.id === target.roomId)?.name : 'About this project' : undefined;
}

/** Recognize only a whole negative/control reply, never “no, but …”. */
export function declinesRoomInvitation(text: string) {
  return /^(?:no|no thanks|no thank you|nope|nothing else|that['’]s (?:all|everything)|we covered (?:it|everything)|let['’]s (?:continue|move on)|continue)[.!\s]*$/i.test(text.trim());
}
