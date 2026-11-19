import { GAME_CONFIG } from '../config/GameConfig';
import { Position } from '../core/types';

export interface BoardMetrics {
  canvasWidth: number;
  canvasHeight: number;
  cols: number;
  maxRows: number;
  tileSize: number;
  colGap: number;
  rowGap: number;
  boardX: number;
  boardY: number;
  boardWidth: number;
  boardHeight: number;
  launcherSize: number;
  launcherY: number;
  padding: number;
}

/**
 * Unified coordinate conversion for the entire game.
 * Reserves a dedicated launcher track below the 5x7 board so the aiming tile is never clipped.
 */
export class BoardLayout {
  public static compute(canvasWidth: number, canvasHeight: number): BoardMetrics {
    const cols = GAME_CONFIG.board.cols;
    const maxRows = GAME_CONFIG.board.maxRows;
    const padding = 6;
    const colGap = Math.max(6, Math.round(canvasWidth * 0.018));
    const rowGap = colGap;

    const availW = canvasWidth - padding * 2 - colGap * (cols - 1);
    // Reserve ~0.95 tile height below the 7 rows for the sliding launcher track
    const availH = canvasHeight - padding * 2 - rowGap * maxRows;
    const tileSize = Math.floor(Math.min(availW / cols, availH / (maxRows + 0.62)));

    const boardWidth = tileSize * cols + colGap * (cols - 1);
    const boardHeight = tileSize * maxRows + rowGap * (maxRows - 1);
    const launcherSize = Math.round(tileSize * 0.56);
    const trackGap = Math.max(7, Math.round(tileSize * 0.14));
    const totalHeight = boardHeight + trackGap + launcherSize;

    const boardX = Math.round((canvasWidth - boardWidth) / 2);
    const boardY = Math.max(padding, Math.round((canvasHeight - totalHeight) / 2));
    const launcherY = boardY + boardHeight + trackGap;

    return {
      canvasWidth,
      canvasHeight,
      cols,
      maxRows,
      tileSize,
      colGap,
      rowGap,
      boardX,
      boardY,
      boardWidth,
      boardHeight,
      launcherSize,
      launcherY,
      padding,
    };
  }

  public static colToX(metrics: BoardMetrics, col: number): number {
    return metrics.boardX + col * (metrics.tileSize + metrics.colGap);
  }

  public static rowToY(metrics: BoardMetrics, row: number): number {
    return metrics.boardY + row * (metrics.tileSize + metrics.rowGap);
  }

  public static posToPixel(metrics: BoardMetrics, pos: Position): { x: number; y: number } {
    return {
      x: BoardLayout.colToX(metrics, pos.col),
      y: BoardLayout.rowToY(metrics, pos.row),
    };
  }

  public static pixelToCol(metrics: BoardMetrics, x: number): number {
    const relX = x - metrics.boardX;
    if (relX < -16 || relX > metrics.boardWidth + 16) {
      return -1;
    }
    const stride = metrics.tileSize + metrics.colGap;
    const rawCol = Math.floor((relX + metrics.colGap * 0.5) / stride);
    return Math.max(0, Math.min(metrics.cols - 1, rawCol));
  }

  public static pixelToRow(metrics: BoardMetrics, y: number): number {
    const relY = y - metrics.boardY;
    if (relY < -8 || relY > metrics.boardHeight + 8) {
      return -1;
    }
    const stride = metrics.tileSize + metrics.rowGap;
    const rawRow = Math.floor((relY + metrics.rowGap * 0.5) / stride);
    return Math.max(0, Math.min(metrics.maxRows - 1, rawRow));
  }
}
