/** Word wrapping is shared with the canvas renderer so the preview cannot clip text. */
export function wrapCardText(text: string, measure: (value: string) => number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= width) { line = next; continue; }
      if (line) lines.push(line);
      line = '';
      for (const character of Array.from(word)) {
        if (line && measure(line + character) > width) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function socialAnswerCardFits(questionLines: number, answerLines: number, creditLines = 1) {
  return questionLines * 68 + answerLines * 51 + creditLines * 32 + 56 <= 1000;
}

/** Explicit user action only; a too-long answer is rejected, never truncated. */
export async function renderSocialAnswerCard(question: string, answer: string, designerName: string): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image creation is unavailable in this browser. You can still copy your excerpt.');
  const styles = getComputedStyle(document.documentElement);
  const headline = styles.getPropertyValue('--font-headline').trim() || 'Georgia';
  const body = styles.getPropertyValue('--font-body').trim() || 'Arial';
  context.font = `500 58px ${headline}`;
  const questionLines = wrapCardText(question, value => context.measureText(value).width, 900);
  context.font = `400 38px ${body}`;
  const answerLines = wrapCardText(answer, value => context.measureText(value).width, 900);
  context.font = `500 26px ${body}`;
  const creditLines = wrapCardText(designerName, value => context.measureText(value).width, 900);
  if (!socialAnswerCardFits(questionLines.length, answerLines.length, creditLines.length)) throw new Error('This answer is too long for one image. Choose a shorter answer below, or copy this excerpt to use as an Instagram caption.');
  context.fillStyle = '#f7f4ef'; context.fillRect(0, 0, 1080, 1350);
  context.fillStyle = '#69645d'; context.font = `500 24px ${body}`;
  context.fillText('IN CONVERSATION', 90, 88);
  context.textBaseline = 'top'; let y = 150;
  context.fillStyle = '#24231f'; context.font = `500 58px ${headline}`;
  for (const line of questionLines) { context.fillText(line, 90, y); y += 68; }
  y += 36; context.font = `400 38px ${body}`;
  for (const line of answerLines) { context.fillText(line, 90, y); y += 51; }
  y += 20; context.font = `500 26px ${body}`;
  for (const line of creditLines) { context.fillText(line, 90, y); y += 32; }
  context.strokeStyle = '#d4cec4'; context.beginPath(); context.moveTo(90, 1210); context.lineTo(990, 1210); context.stroke();
  context.font = `500 38px ${headline}`; context.fillText('FOLIO', 90, 1250);
  context.font = `400 24px ${body}`; context.textAlign = 'right'; context.fillText('folioad.com', 990, 1260);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the image. Please try again.')), 'image/png'));
}
