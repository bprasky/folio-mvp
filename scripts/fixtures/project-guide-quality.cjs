// Synthetic state only. Guide conversation is never editorial evidence.
const base = { stage: 'interview_resume', projectId: 'synthetic-only', projectName: 'Courtyard house', photoCount: 12,
  taggedPhotoCount: 5, unreviewedPhotoCount: 4, sortedPhotoCount: 12, answeredCount: 4, remainingQuestionCount: 7,
  allowedActions: ['resume_interview', 'start_over', 'open_upload', 'open_tagging', 'none'] };
module.exports = [
  { id: 'upload-before-project', expectedAction: 'none', input: { ...base, stage: 'upload', projectId: undefined,
    photoCount: 0, taggedPhotoCount: 0, unreviewedPhotoCount: 0, sortedPhotoCount: 0, answeredCount: 0, remainingQuestionCount: null,
    allowedActions: ['open_upload', 'none'], userText: 'Can I use a link to my project photos instead of uploading all the files?' } },
  { id: 'tagging-counts', expectedAction: 'none', input: { ...base, stage: 'tagging',
    userText: 'How many photos have I tagged, and do I have to finish all the tags before the interview?' } },
  { id: 'ambiguous-resume', expectedAction: 'none', input: { ...base, userText: 'Yes please.',
    recentTurns: [{ role: 'assistant', text: 'Would you like to pick up where we left off, or start over?' }] } },
  { id: 'restart-question-is-not-command', expectedAction: 'none', input: { ...base,
    userText: 'Will starting over erase my answers? I am just asking, please do not do that yet.' } },
  { id: 'completed-add-detail', expectedAction: 'add_more', input: { ...base, stage: 'interview_complete', answeredCount: 12,
    remainingQuestionCount: 0, allowedActions: ['add_more', 'open_upload', 'open_tagging', 'none'],
    userText: 'The clients changed their minds about the open kitchen after staying in the house for a week. We kept a separate kitchen instead. Let me add that to the interview.' } },
];
