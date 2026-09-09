export const INTERVIEW_MIME = 'audio/webm';
export const RECORDER_MIME = 'audio/webm;codecs=opus';
// Multipart passes through a Vercel Function. Leave headroom below its 4.5 MB body limit.
// The dedicated storage bucket remains capped at the separately approved 20 MiB.
export const MAX_INTERVIEW_BYTES = 4 * 1024 * 1024;
export function supportsInterviewRecording(recorder: { isTypeSupported?: (mime: string) => boolean } | undefined): boolean {
  return typeof recorder?.isTypeSupported === 'function' && recorder.isTypeSupported(RECORDER_MIME);
}
