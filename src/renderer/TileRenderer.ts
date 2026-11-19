import { getTileStyle } from '../config/GameConfig';

export interface DrawTileOptions {
  scale?: number;
  alpha?: number;
  highlight?: boolean;
  ghost?: boolean;
}

// 格式化数字显示：2048以下显示原数字，从4K开始用K代替千
function formatTileValue(value: number): string {
  if (value >= 4000) {
    return Math.round(value / 1000) + 'K';
  }
  return String(value);
}

export class TileRenderer {
  public static drawTile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    value: number,
    options: DrawTileOptions = {}
  ): void {
    const scale = options.scale ?? 1;
    const alpha = options.alpha ?? 1;
    const style = getTileStyle(value);
    const radius = Math.max(9, Math.round(size * 0.18));

    ctx.save();
    ctx.globalAlpha = alpha;

    const cx = x + size / 2;
    const cy = y + size / 2;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-size / 2, -size / 2);

    if (options.ghost) {
      ctx.strokeStyle = style.bg;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      TileRenderer.roundRectPath(ctx, 2, 2, size - 4, size - 4, radius);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = style.bg;
      ctx.globalAlpha = alpha * 0.18;
      ctx.fill();
      ctx.restore();
      return;
    }

    // Optional outer glow for 2048+
    if (style.glow) {
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = 16;
    }

    const bevel = Math.max(3, Math.round(size * 0.08));
    const faceH = size - bevel;

    // Clip to outer rounded rect for razor-sharp anti-aliased edges
    ctx.save();
    TileRenderer.roundRectPath(ctx, 0.5, 0.5, size - 1, size - 1, radius);
    ctx.clip();

    // Bottom 3D lip
    ctx.fillStyle = style.bgDark;
    ctx.fillRect(0, 0, size, size);

    ctx.shadowBlur = 0;

    // Main candy face with subtle vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, faceH);
    grad.addColorStop(0, style.bg);
    grad.addColorStop(1, style.bgDark);
    ctx.fillStyle = style.bg;
    TileRenderer.roundRectPath(ctx, 0.5, 0.5, size - 1, faceH, radius);
    ctx.fill();

    // Soft glossy top sheen
    const sheenGrad = ctx.createLinearGradient(0, 1, 0, faceH * 0.45);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = sheenGrad;
    TileRenderer.roundRectPath(ctx, 1.5, 1.5, size - 3, faceH * 0.45, Math.max(6, radius - 2));
    ctx.fill();

    // Crisp inner top-edge highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 1.5;
    TileRenderer.roundRectPath(ctx, 1.25, 1.25, size - 2.5, faceH - 1.5, Math.max(6, radius - 1));
    ctx.stroke();

    ctx.restore(); // End clip

    // Clean outer edge stroke for crisp tile separation
    ctx.strokeStyle = options.highlight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.24)';
    ctx.lineWidth = options.highlight ? 2.5 : 1.25;
    TileRenderer.roundRectPath(ctx, 0.5, 0.5, size - 1, size - 1, radius);
    ctx.stroke();

    // Pure white number with subtle drop shadow for crisp legibility
    const text = formatTileValue(value);
    const len = text.length;
    const fontScale = len <= 2 ? 0.43 : len === 3 ? 0.35 : len === 4 ? 0.28 : 0.23;
    const fontSize = Math.max(12, Math.round(size * fontScale));
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${fontSize}px "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    ctx.fillText(text, size / 2, faceH / 2 + 1, size * 0.86);

    ctx.restore();
  }

  public static roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
