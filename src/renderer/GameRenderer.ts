import { GameManager } from '../core/GameManager';
import { GameState } from '../core/GameState';
import { AnimationManager } from './AnimationManager';
import { BoardLayout, BoardMetrics } from './BoardLayout';
import { BoardRenderer } from './BoardRenderer';

export class GameRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private metrics: BoardMetrics;
  private dpr = 1;
  private hoveredCol = 2;
  private rafId: number | null = null;
  private tutorialCol = -1;
  private isAiming = false;
  private lastFrameMs = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gameManager: GameManager,
    private readonly animations: AnimationManager
  ) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.metrics = BoardLayout.compute(360, 500);
    this.resize();
  }

  public resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(240, Math.floor(rect.width || 360));
    const height = Math.max(320, Math.floor(rect.height || 500));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.metrics = BoardLayout.compute(width, height);
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--board-frame-w', `${this.metrics.boardWidth + 20}px`);
    }
    this.renderOnce();
  }

  public getMetrics(): BoardMetrics {
    return this.metrics;
  }

  public setHoveredCol(col: number): void {
    if (col >= 0 && col < this.gameManager.board.cols && this.hoveredCol !== col) {
      this.hoveredCol = col;
      this.renderOnce();
    }
  }

  public getHoveredCol(): number {
    return this.hoveredCol;
  }

  public setAiming(aiming: boolean): void {
    if (this.isAiming !== aiming) {
      this.isAiming = aiming;
      this.renderOnce();
    }
  }

  public setTutorialCol(col: number): void {
    this.tutorialCol = col;
    if (col >= 0) {
      this.hoveredCol = col;
      this.ensureAnimating();
    } else {
      this.renderOnce();
    }
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastFrameMs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, Math.max(0, now - this.lastFrameMs));
      this.lastFrameMs = now;

      this.animations.update(dt);
      this.renderOnce();

      if (this.animations.hasActiveEffects() || this.tutorialCol >= 0) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public ensureAnimating(): void {
    if (this.rafId === null) {
      this.startLoop();
    }
  }

  public renderOnce(): void {
    const { canvasWidth, canvasHeight } = this.metrics;
    this.ctx.save();
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const isReady = this.gameManager.getState() === GameState.READY;
    const canShootHovered = isReady && this.gameManager.canShootToColumn(this.hoveredCol);
    const landingRowHovered = canShootHovered
      ? this.gameManager.board.getLandingRow(this.hoveredCol)
      : -1;

    BoardRenderer.render(this.ctx, this.metrics, {
      board: this.gameManager.getBoardSnapshot(),
      hoveredCol: this.hoveredCol,
      currentNumber: this.gameManager.getCurrentNumber(),
      canShootHovered,
      landingRowHovered,
      isReady,
      isAiming: this.isAiming,
      animations: this.animations,
      tutorialCol: this.tutorialCol,
      tutorialTimeMs: performance.now(),
    });

    this.ctx.restore();
  }
}
