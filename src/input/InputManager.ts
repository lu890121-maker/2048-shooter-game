import { GAME_CONFIG } from '../config/GameConfig';
import { BoardLayout } from '../renderer/BoardLayout';
import { GameRenderer } from '../renderer/GameRenderer';

export interface InputHandlers {
  onSelectColumn: (col: number) => void;
  onShootColumn: (col: number) => void;
  onSwap: () => void;
  onAimStateChange?: (isAiming: boolean) => void;
  onTileSwapClick?: (col: number, row: number) => void;
}

export class InputManager {
  private selectedCol = 2;
  private isPressing = false;
  private activePointerId: number | null = null;
  private tileSwapMode = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: GameRenderer,
    private readonly handlers: InputHandlers
  ) {
    this.bindEvents();
  }

  public setTileSwapMode(enabled: boolean): void {
    this.tileSwapMode = enabled;
  }

  private getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  private getCanvasX(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect();
    return clientX - rect.left;
  }

  private updateColumnFromClientX(clientX: number): number {
    const col = BoardLayout.pixelToCol(this.renderer.getMetrics(), this.getCanvasX(clientX));
    if (col !== -1) {
      this.selectedCol = col;
      this.handlers.onSelectColumn(col);
    }
    return col;
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      
      // 如果在互换模式，传递完整的 col 和 row，不设置 isPressing
      if (this.tileSwapMode && this.handlers.onTileSwapClick) {
        const pos = this.getCanvasPos(e.clientX, e.clientY);
        const metrics = this.renderer.getMetrics();
        const col = BoardLayout.pixelToCol(metrics, pos.x);
        const row = BoardLayout.pixelToRow(metrics, pos.y);
        if (col !== -1 && row !== -1) {
          this.handlers.onTileSwapClick(col, row);
        }
        return;
      }
      
      this.isPressing = true;
      this.activePointerId = e.pointerId;
      try {
        this.canvas.setPointerCapture?.(e.pointerId);
      } catch {
        // Ignore in environments without pointer capture
      }
      
      this.updateColumnFromClientX(e.clientX);
      this.handlers.onAimStateChange?.(true);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      // 互换模式下不处理移动
      if (this.tileSwapMode) return;
      
      if (this.isPressing) {
        if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
        this.updateColumnFromClientX(e.clientX);
      } else if (e.pointerType === 'mouse') {
        this.updateColumnFromClientX(e.clientX);
      }
    });

    const releasePointer = (e: PointerEvent, shouldShoot: boolean) => {
      if (!this.isPressing) return;
      if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
      
      // 互换模式下不处理发射
      if (this.tileSwapMode) {
        this.isPressing = false;
        this.activePointerId = null;
        return;
      }

      const col = this.updateColumnFromClientX(e.clientX);
      this.isPressing = false;
      this.activePointerId = null;
      this.handlers.onAimStateChange?.(false);

      if (shouldShoot && col !== -1) {
        this.handlers.onShootColumn(col);
      }
    };

    this.canvas.addEventListener('pointerup', (e) => releasePointer(e, true));
    this.canvas.addEventListener('pointercancel', (e) => releasePointer(e, false));

    window.addEventListener('keydown', (e) => {
      const key = e.key;
      if (key === ' ' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
        e.preventDefault();
      }

      if (key >= '1' && key <= String(GAME_CONFIG.board.cols)) {
        const col = parseInt(key, 10) - 1;
        this.selectedCol = col;
        this.handlers.onSelectColumn(col);
        this.handlers.onShootColumn(col);
        return;
      }

      if (key === 'ArrowLeft') {
        this.selectedCol = Math.max(0, this.selectedCol - 1);
        this.handlers.onSelectColumn(this.selectedCol);
        return;
      }

      if (key === 'ArrowRight') {
        this.selectedCol = Math.min(GAME_CONFIG.board.cols - 1, this.selectedCol + 1);
        this.handlers.onSelectColumn(this.selectedCol);
        return;
      }

      if (key === ' ' || key === 'Enter') {
        this.handlers.onShootColumn(this.selectedCol);
        return;
      }

      if (key === 's' || key === 'S') {
        this.handlers.onSwap();
      }
    });
  }
}
