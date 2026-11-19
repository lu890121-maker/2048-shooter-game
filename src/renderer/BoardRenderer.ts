import { getTileStyle } from '../config/GameConfig';
import { GameBoard } from '../core/types';
import { AnimationManager } from './AnimationManager';
import { BoardLayout, BoardMetrics } from './BoardLayout';
import { TileRenderer } from './TileRenderer';

export interface BoardRenderParams {
  board: GameBoard;
  hoveredCol: number;
  currentNumber: number;
  canShootHovered: boolean;
  landingRowHovered: number;
  isReady: boolean;
  isAiming?: boolean;
  animations: AnimationManager;
  tutorialCol?: number;
  tutorialTimeMs?: number;
}

export class BoardRenderer {
  public static render(
    ctx: CanvasRenderingContext2D,
    metrics: BoardMetrics,
    params: BoardRenderParams
  ): void {
    const { cols, maxRows, tileSize, boardX, boardY, boardWidth, boardHeight, launcherSize, launcherY } = metrics;
    const {
      board,
      hoveredCol,
      currentNumber,
      canShootHovered,
      landingRowHovered,
      isReady,
      isAiming = false,
      animations,
      tutorialCol = -1,
      tutorialTimeMs = 0,
    } = params;

    // Board outer container
    ctx.save();
    ctx.fillStyle = '#1E293B';
    TileRenderer.roundRectPath(
      ctx,
      boardX - 10,
      boardY - 10,
      boardWidth + 20,
      boardHeight + 20,
      18
    );
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Draw 5 columns + 7 empty slot guides per column
    for (let c = 0; c < cols; c++) {
      const shakeX = animations.getColumnShakeOffset(c);
      const colX = BoardLayout.colToX(metrics, c) + shakeX;
      const isHovered = isReady && c === hoveredCol;

      // Subtle column lane background
      ctx.save();
      ctx.fillStyle = isHovered
        ? canShootHovered
          ? 'rgba(56, 189, 248, 0.08)'
          : 'rgba(248, 113, 113, 0.1)'
        : 'rgba(15, 23, 42, 0.45)';
      TileRenderer.roundRectPath(ctx, colX - 2, boardY - 2, tileSize + 4, boardHeight + 4, 12);
      ctx.fill();
      ctx.restore();

      // Empty slot guides
      for (let r = 0; r < maxRows; r++) {
        const slotY = BoardLayout.rowToY(metrics, r);
        ctx.save();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.07)';
        TileRenderer.roundRectPath(
          ctx,
          colX,
          slotY,
          tileSize,
          tileSize,
          Math.max(8, Math.round(tileSize * 0.16))
        );
        ctx.fill();
        ctx.restore();
      }
    }

    // Dashed aiming guide line & ghost landing preview
    if (isReady && hoveredCol >= 0 && hoveredCol < cols) {
      const shakeX = animations.getColumnShakeOffset(hoveredCol);
      const colX = BoardLayout.colToX(metrics, hoveredCol) + shakeX;
      const centerX = colX + tileSize / 2;
      const startY = launcherY - 2;
      const targetY =
        landingRowHovered >= 0
          ? BoardLayout.rowToY(metrics, landingRowHovered) + tileSize / 2
          : boardY + boardHeight - tileSize / 2;

      ctx.save();
      ctx.strokeStyle = canShootHovered
        ? getTileStyle(currentNumber).bg
        : 'rgba(248, 113, 113, 0.75)';
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(centerX, startY);
      ctx.lineTo(centerX, targetY);
      ctx.stroke();
      ctx.restore();

      if (canShootHovered && landingRowHovered >= 0) {
        const ghostY = BoardLayout.rowToY(metrics, landingRowHovered);
        TileRenderer.drawTile(ctx, colX, ghostY, tileSize, currentNumber, {
          ghost: true,
          alpha: isAiming ? 0.9 : 0.65,
        });
      }

      // Draw clean launcher rail & full unclipped aiming tile below the 5x7 board
      const railY = launcherY + launcherSize / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(boardX + 6, railY);
      ctx.lineTo(boardX + boardWidth - 6, railY);
      ctx.stroke();
      ctx.restore();

      const launcherX = centerX - launcherSize / 2;
      TileRenderer.drawTile(ctx, launcherX, launcherY, launcherSize, currentNumber, {
        highlight: isAiming,
        scale: isAiming ? 1.06 : 0.96,
        alpha: isAiming ? 1 : 0.85,
      });
    }

    // Draw tiles (either from active animation timeline or settled board)
    const animatedTiles = animations.getFrameTiles();
    if (animatedTiles) {
      for (const item of animatedTiles) {
        const shakeX = animations.getColumnShakeOffset(Math.round(item.col));
        const px = BoardLayout.colToX(metrics, item.col) + shakeX;
        const py = BoardLayout.rowToY(metrics, item.row);
        TileRenderer.drawTile(ctx, px, py, tileSize, item.value, {
          scale: item.scale,
          alpha: item.alpha,
          highlight: item.highlight,
        });
      }
    } else {
      for (let c = 0; c < board.columns.length; c++) {
        const shakeX = animations.getColumnShakeOffset(c);
        const col = board.columns[c];
        for (let r = 0; r < col.length; r++) {
          const px = BoardLayout.colToX(metrics, c) + shakeX;
          const py = BoardLayout.rowToY(metrics, r);
          TileRenderer.drawTile(ctx, px, py, tileSize, col[r].value);
        }
      }
    }


    // Confetti particles for milestones
    for (const pt of animations.particles) {
      const pAlpha = Math.max(0, 1 - pt.elapsedMs / pt.durationMs);
      ctx.save();
      ctx.globalAlpha = pAlpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(boardX + pt.x * boardWidth, boardY + pt.y * boardHeight, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Milestone celebration banner (256, 512, 1024, 2048, 4096...)
    const celeb = animations.getCelebrationState();
    if (celeb) {
      const celebP = celeb.progress;
      const val = celeb.value;
      const style = getTileStyle(val);
      const alpha = celebP < 0.18 ? celebP / 0.18 : celebP > 0.8 ? (1 - celebP) / 0.2 : 1;
      const popScale = celebP < 0.2 ? 0.85 + 0.15 * (celebP / 0.2) : 1;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      const bannerW = Math.min(boardWidth * 0.9, 290);
      const bannerH = 68;
      const cx = boardX + boardWidth / 2;
      const cy = boardY + boardHeight * 0.26;
      ctx.translate(cx, cy);
      ctx.scale(popScale, popScale);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      TileRenderer.roundRectPath(ctx, -bannerW / 2, -bannerH / 2, bannerW, bannerH, 16);
      ctx.fill();
      ctx.strokeStyle = style.bg;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Mini tile badge on the left
      const badgeSize = 42;
      TileRenderer.drawTile(ctx, -bannerW / 2 + 12, -badgeSize / 2, badgeSize, val, { highlight: true });

      const title =
        val >= 4096 ? `传奇 ${val}!` :
        val >= 2048 ? `达成 2048!` :
        val >= 1024 ? `超神 ${val}!` :
        val >= 512 ? `厉害了 ${val}!` :
        `太棒了 ${val}!`;
      const subtitle =
        val >= 2048 ? '继续合成，冲击更高纪录！' :
        `新纪录！下个目标: ${val * 2}`;

      ctx.fillStyle = style.bg;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '800 18px "Inter", sans-serif';
      ctx.fillText(title, -bannerW / 2 + 66, -10);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '600 12px "Inter", sans-serif';
      ctx.fillText(subtitle, -bannerW / 2 + 66, 13);
      ctx.restore();
    }

    // Animated interactive tutorial guide (Step 1: tap highlighted column to shoot & merge)
    if (isReady && tutorialCol >= 0 && tutorialCol < cols) {
      const colX = BoardLayout.colToX(metrics, tutorialCol);
      const centerX = colX + tileSize / 2;
      const pulse = 0.5 + 0.5 * Math.sin(tutorialTimeMs / 240);
      const bounceY = Math.sin(tutorialTimeMs / 200) * 7;

      // Glowing column border
      ctx.save();
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 + pulse * 0.45})`;
      ctx.lineWidth = 3;
      TileRenderer.roundRectPath(ctx, colX - 2, boardY - 2, tileSize + 4, boardHeight + 4, 12);
      ctx.stroke();

      // Animated target ring at row 1 (landing spot)
      const targetY = BoardLayout.rowToY(metrics, 1) + tileSize / 2;
      ctx.strokeStyle = `rgba(251, 191, 36, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(centerX, targetY, tileSize * (0.28 + pulse * 0.1), 0, Math.PI * 2);
      ctx.stroke();

      // Bouncing pointer pill + hand icon
      const pillY = boardY + boardHeight * 0.52 + bounceY;
      const pillW = 152;
      const pillH = 34;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      TileRenderer.roundRectPath(ctx, centerX - pillW / 2, pillY - pillH / 2, pillW, pillH, 17);
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 13px "Inter", sans-serif';
      ctx.fillText('👆 按住滑到这里松手', centerX, pillY + 1);
      ctx.restore();
    }

    // Animated interactive tutorial guide (Step 1: tap highlighted column to shoot & merge)
    if (isReady && tutorialCol >= 0 && tutorialCol < cols) {
      const colX = BoardLayout.colToX(metrics, tutorialCol);
      const centerX = colX + tileSize / 2;
      const pulse = 0.5 + 0.5 * Math.sin(tutorialTimeMs / 240);
      const bounceY = Math.sin(tutorialTimeMs / 200) * 7;

      // Glowing column border
      ctx.save();
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 + pulse * 0.45})`;
      ctx.lineWidth = 3;
      TileRenderer.roundRectPath(ctx, colX - 2, boardY - 2, tileSize + 4, boardHeight + 4, 12);
      ctx.stroke();

      // Animated target ring at row 1 (landing spot)
      const targetY = BoardLayout.rowToY(metrics, 1) + tileSize / 2;
      ctx.strokeStyle = `rgba(251, 191, 36, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(centerX, targetY, tileSize * (0.28 + pulse * 0.1), 0, Math.PI * 2);
      ctx.stroke();

      // Bouncing pointer pill + hand icon
      const pillY = boardY + boardHeight * 0.52 + bounceY;
      const pillW = 152;
      const pillH = 34;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      TileRenderer.roundRectPath(ctx, centerX - pillW / 2, pillY - pillH / 2, pillW, pillH, 17);
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 13px "Inter", sans-serif';
      ctx.fillText('👆 按住滑到这里松手', centerX, pillY + 1);
      ctx.restore();
    }
  }
}