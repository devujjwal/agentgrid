import { framePlacement, type LocalClip } from '../../../domain/local-reel';
export function drawLocalFrame(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  clip: LocalClip,
) {
  context.fillStyle = '#101d18';
  context.fillRect(0, 0, 720, 1280);
  const placement = framePlacement(clip.width, clip.height, clip.fit);
  context.drawImage(source, placement.x, placement.y, placement.width, placement.height);
  if (!clip.caption.trim()) return;
  context.font = '600 40px system-ui, sans-serif';
  const lines: string[] = [];
  let line = '';
  for (const character of Array.from(clip.caption.trim().replace(/\s+/gu, ' '))) {
    if (context.measureText(line + character).width > 576) {
      lines.push(line);
      line = character;
    } else line += character;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 5),
    height = shown.length * 52 + 40;
  context.fillStyle = 'rgba(16,29,24,0.85)';
  context.fillRect(48, 1070 - height, 624, height);
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'top';
  shown.forEach((text, index) => context.fillText(text, 360, 1090 - height + index * 52));
}
