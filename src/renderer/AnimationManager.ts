import { GAME_CONFIG, getTileStyle } from '../config/GameConfig';
import { GameBoard, MergeEvent, Position, ShotResult, Tile } from '../core/types';
import { AudioManager } from '../systems/AudioManager';

export interface FloatingText {
  text: string;
  subtext?: string;
  pos: Position;
  color: string;
  elapsedMs: number;
  durationMs: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  elapsedMs: number;
  durationMs: number;
}

export interface AnimatedTileDraw {
  id: number;
  value: number;
  col: number;
  row: number;
  scale: number;
  alpha: number;
  highlight?: boolean;
}

export interface SwapMergeStep {
  consumedTiles: { tile: Tile; fromPos: Position; toPos: Position }[];
  targetPos: Position;
  newValue: number;
  mergedTileId: number;
}

type TimelinePhase =
  | {
      kind: 'SHOOT';
      col: number;
      toRow: number;
      value: number;
      durationMs: number;
      boardSnapshot: GameBoard;
    }
  | {
      kind: 'LANDING';
      col: number;
      row: number;
      value: number;
      tileId: number;
      durationMs: number;
      boardSnapshot: GameBoard;
    }
  | {
      kind: 'MERGE';
      event: MergeEvent;
      durationMs: number;
      boardBeforeMerge: GameBoard;
      hiddenIds: Set<number>;
    }
  | {
      kind: 'GRAVITY';
      event: MergeEvent;
      durationMs: number;
      boardAfterMerge: GameBoard;
      movedIds: Set<number>;
    }
  | {
      kind: 'SWAP_MERGE';
      steps: SwapMergeStep[];
      currentStepIndex: number;
      stepDurationMs: number;
      stepElapsedMs: number;
    };

/**
 * Find the actual position of a tile by its ID in a board snapshot.
 */
function findTilePos(board: GameBoard, tileId: number): Position | null {
  for (let c = 0; c < board.columns.length; c++) {
    const col = board.columns[c];
    for (let r = 0; r < col.length; r++) {
      if (col[r].id === tileId) return { col: c, row: r };
    }
  }
  return null;
}

export class AnimationManager {
  private phases: TimelinePhase[] = [];
  private phaseElapsedMs = 0;
  private onTimelineComplete: (() => void) | null = null;
  private onPhaseMergeAudio: ((chainIndex: number) => void) | null = null;

  private shakeCol = -1;
  private shakeElapsedMs = 0;
  private celebrationElapsedMs = -1;
  private celebrationValue = 0;

  public readonly floatingTexts: FloatingText[] = [];
  public readonly particles: Particle[] = [];
  private reducedMotion = false;

  constructor(private readonly audio?: AudioManager) {}

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  public isAnimating(): boolean {
    return this.phases.length > 0;
  }

  public hasActiveEffects(): boolean {
    return (
      this.phases.length > 0 ||
      this.shakeCol !== -1 ||
      this.celebrationElapsedMs >= 0 ||
      this.floatingTexts.length > 0 ||
      this.particles.length > 0
    );
  }

  public reset(): void {
    this.phases = [];
    this.phaseElapsedMs = 0;
    this.onTimelineComplete = null;
    this.shakeCol = -1;
    this.shakeElapsedMs = 0;
    this.celebrationElapsedMs = -1;
    this.floatingTexts.length = 0;
    this.particles.length = 0;
  }

  public triggerInvalidShake(col: number): void {
    this.shakeCol = col;
    this.shakeElapsedMs = 0;
  }

  public getColumnShakeOffset(col: number): number {
    if (this.shakeCol !== col || this.reducedMotion) return 0;
    const t = this.shakeElapsedMs / GAME_CONFIG.animation.invalidShakeMs;
    if (t >= 1) return 0;
    return Math.sin(t * Math.PI * 5) * 6 * (1 - t);
  }

  public triggerMilestoneCelebration(value: number): void {
    this.celebrationElapsedMs = 0;
    this.celebrationValue = value;
    if (!this.reducedMotion) {
      const style = getTileStyle(value);
      const colors = [style.bg, "#FBBF24", "#38BDF8", "#FFFFFF", "#49AF85"];
      for (let i = 0; i < 28; i++) {
        const angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5) * 0.25;
        const speed = 110 + Math.random() * 190;
        this.particles.push({
          x: 0.5 + (Math.random() - 0.5) * 0.2,
          y: 0.3 + (Math.random() - 0.5) * 0.1,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 90,
          size: 4 + Math.random() * 4,
          color: colors[i % colors.length],
          elapsedMs: 0,
          durationMs: 900 + Math.random() * 400,
        });
      }
    }
  }

  public getCelebrationState(): { progress: number; value: number } | null {
    if (this.celebrationElapsedMs < 0) return null;
    return {
      progress: Math.min(1, this.celebrationElapsedMs / GAME_CONFIG.animation.celebrationMs),
      value: this.celebrationValue,
    };
  }

  /**
   * Start swap merge animation - plays merge animations for each step sequentially
   */
  public startSwapMergeAnimation(
    steps: SwapMergeStep[],
    onComplete: () => void
  ): void {
    const scale = this.reducedMotion ? 0.25 : 1;
    const stepMs = Math.round(GAME_CONFIG.animation.mergeDurationMs * scale);

    this.phases = [];
    this.phaseElapsedMs = 0;
    this.onTimelineComplete = onComplete;

    this.phases.push({
      kind: 'SWAP_MERGE',
      steps,
      currentStepIndex: 0,
      stepDurationMs: stepMs,
      stepElapsedMs: 0,
    });
  }

  public startShotTimeline(
    boardBeforeShot: GameBoard,
    result: ShotResult,
    onComplete: () => void
  ): void {
    const scale = this.reducedMotion ? 0.25 : 1;
    const shootMs = Math.round(GAME_CONFIG.animation.shootDurationMs * scale);
    const mergeMs = Math.round(GAME_CONFIG.animation.mergeDurationMs * scale);
    const gravityMs = Math.round(GAME_CONFIG.animation.gravityDurationMs * scale);

    this.phases = [];
    this.phaseElapsedMs = 0;
    this.onTimelineComplete = onComplete;
    this.onPhaseMergeAudio = (chainIdx) => this.audio?.playMerge(chainIdx);

    // Clone working board to step through visual states accurately
    const working: GameBoard = {
      columns: boardBeforeShot.columns.map((c) => c.map((t) => ({ ...t }))),
    };

    const shotValue = result.shotTile?.value ?? 2;
    const targetFlightRow = result.isFullColumnDirectMerge
      ? GAME_CONFIG.board.maxRows - 1
      : result.landingRow;

    this.phases.push({
      kind: 'SHOOT',
      col: result.col,
      toRow: targetFlightRow,
      value: shotValue,
      durationMs: shootMs,
      boardSnapshot: {
        columns: working.columns.map((c) => c.map((t) => ({ ...t }))),
      },
    });

    // If normal landing, place the shot tile into working board
    if (!result.isFullColumnDirectMerge && result.shotTile) {
      working.columns[result.col].push({ ...result.shotTile });
    }

    for (const ev of result.merges) {
      const boardBeforeMerge: GameBoard = {
        columns: working.columns.map((c) => c.map((t) => ({ ...t }))),
      };

      // Hidden IDs: consumed tiles that should not be drawn as static tiles
      // during the MERGE phase (they'll be drawn as animated sliding tiles instead)
      const hiddenIds = new Set<number>(ev.consumed.map((c) => c.tile.id));

      this.phases.push({
        kind: 'MERGE',
        event: ev,
        durationMs: mergeMs,
        boardBeforeMerge,
        hiddenIds,
      });

      // Apply merge to working board (replace at targetPos, remove others, compact)
      const consumedIds = new Set<number>(ev.consumed.map((c) => c.tile.id));
      for (let c = 0; c < working.columns.length; c++) {
        working.columns[c] = working.columns[c]
          .map((t) => {
            if (
              ev.chainIndex === 1 &&
              result.isFullColumnDirectMerge &&
              c === ev.result.pos.col &&
              working.columns[c].indexOf(t) === ev.result.pos.row
            ) {
              return { ...ev.result.tile };
            }
            if (t.id === ev.result.tile.id) return { ...ev.result.tile };
            return t;
          })
          .filter((t) => {
            if (t.id === ev.result.tile.id) return true;
            return !consumedIds.has(t.id);
          });
      }

      // Ensure result tile is at ev.result.pos in working board
      const colArr = working.columns[ev.result.pos.col];
      const alreadyThere = colArr.some((t) => t.id === ev.result.tile.id);
      if (!alreadyThere) {
        colArr.splice(ev.result.pos.row, 0, { ...ev.result.tile });
      }

      if (ev.gravityMoves.length > 0) {
        const movedIds = new Set(ev.gravityMoves.map((m) => m.tileId));
        this.phases.push({
          kind: 'GRAVITY',
          event: ev,
          durationMs: gravityMs,
          boardAfterMerge: {
            columns: working.columns.map((c) => c.map((t) => ({ ...t }))),
          },
          movedIds,
        });
      }
    }

    if (result.newMilestoneValue !== null) {
      this.triggerMilestoneCelebration(result.newMilestoneValue);
    }
  }

  public update(dtMs: number): void {
    if (this.shakeCol !== -1) {
      this.shakeElapsedMs += dtMs;
      if (this.shakeElapsedMs >= GAME_CONFIG.animation.invalidShakeMs) {
        this.shakeCol = -1;
      }
    }

    if (this.celebrationElapsedMs >= 0) {
      this.celebrationElapsedMs += dtMs;
      if (this.celebrationElapsedMs >= GAME_CONFIG.animation.celebrationMs) {
        this.celebrationElapsedMs = -1;
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      this.floatingTexts[i].elapsedMs += dtMs;
      if (this.floatingTexts[i].elapsedMs >= this.floatingTexts[i].durationMs) {
        this.floatingTexts.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.elapsedMs += dtMs;
      p.x += (p.vx / 360) * (dtMs / 1000);
      p.y += (p.vy / 500) * (dtMs / 1000);
      p.vy += 360 * (dtMs / 1000);
      if (p.elapsedMs >= p.durationMs) {
        this.particles.splice(i, 1);
      }
    }

    if (this.phases.length === 0) return;

    const phase = this.phases[0];

    // Handle SWAP_MERGE phase specially
    if (phase.kind === 'SWAP_MERGE') {
      phase.stepElapsedMs += dtMs;
      if (phase.stepElapsedMs >= phase.stepDurationMs) {
        // Move to next step
        phase.stepElapsedMs -= phase.stepDurationMs;
        phase.currentStepIndex++;
        // Play merge sound for this step
        this.audio?.playMerge(phase.currentStepIndex);
        
        if (phase.currentStepIndex >= phase.steps.length) {
          // All steps done
          this.phases.shift();
          this.phaseElapsedMs = 0;
          const cb = this.onTimelineComplete;
          this.onTimelineComplete = null;
          cb?.();
        }
      }
      return; // SWAP_MERGE handled, exit early
    }
    // Normal phase handling (SHOOT / MERGE / GRAVITY all have durationMs)
    this.phaseElapsedMs += dtMs;
    while (this.phases.length > 0) {
      const current = this.phases[0];
      if (current.kind === 'SWAP_MERGE') break; // handled above
      const dur = current.durationMs;
      if (this.phaseElapsedMs < dur) break;
      const finished = this.phases.shift()!;
      this.phaseElapsedMs -= dur;

      if (finished.kind === 'SHOOT' && this.phases[0]?.kind === 'MERGE') {
        const firstMerge = this.phases[0].event;
        this.spawnMergeEffects(firstMerge);
      } else if (finished.kind === 'MERGE' && this.phases[0]?.kind === 'MERGE') {
        this.spawnMergeEffects(this.phases[0].event);
      } else if (finished.kind === 'GRAVITY' && this.phases[0]?.kind === 'MERGE') {
        this.spawnMergeEffects(this.phases[0].event);
      }
    }

    if (this.phases.length === 0) {
      this.phaseElapsedMs = 0;
      const cb = this.onTimelineComplete;
      this.onTimelineComplete = null;
      cb?.();
    }
  }

  private spawnMergeEffects(ev: MergeEvent): void {
    this.onPhaseMergeAudio?.(ev.chainIndex);
  }

  /**
   * Computes which tiles to draw for the current animation frame.
   * Returns null when idle so renderer draws directly from GameManager board.
   */
  public getFrameTiles(): AnimatedTileDraw[] | null {
    if (this.phases.length === 0) return null;

    const phase = this.phases[0];
    const draws: AnimatedTileDraw[] = [];

    // Handle SWAP_MERGE phase
    if (phase.kind === 'SWAP_MERGE') {
      const step = phase.steps[phase.currentStepIndex];
      if (!step) return null;
      
      const t = Math.min(1, phase.stepElapsedMs / Math.max(1, phase.stepDurationMs));
      
      // First half: slide consumed tiles toward target
      if (t < 0.5) {
        const subT = t / 0.5;
        const eased = 1 - Math.pow(1 - subT, 3);
        for (const c of step.consumedTiles) {
          const curCol = c.fromPos.col + (c.toPos.col - c.fromPos.col) * eased;
          const curRow = c.fromPos.row + (c.toPos.row - c.fromPos.row) * eased;
          draws.push({
            id: c.tile.id,
            value: c.tile.value,
            col: curCol,
            row: curRow,
            scale: 1 - subT * 0.15,
            alpha: 1 - subT * 0.35,
          });
        }
      } else {
        // Second half: pop new merged tile
        const subT = (t - 0.5) / 0.5;
        const popScale = this.reducedMotion ? 1 : 1 + Math.sin(subT * Math.PI) * 0.22;
        draws.push({
          id: step.mergedTileId,
          value: step.newValue,
          col: step.targetPos.col,
          row: step.targetPos.row,
          scale: popScale,
          alpha: 1,
          highlight: true,
        });
      }
      
      return draws;
    }

    const t = Math.min(1, this.phaseElapsedMs / Math.max(1, phase.durationMs));
    const eased = 1 - Math.pow(1 - t, 3);

    if (phase.kind === 'SHOOT') {
      this.pushBoardTiles(phase.boardSnapshot, draws);
      const startRow = GAME_CONFIG.board.maxRows + 0.5;
      const curRow = startRow + (phase.toRow - startRow) * eased;
      draws.push({
        id: -9999,
        value: phase.value,
        col: phase.col,
        row: curRow,
        scale: 1,
        alpha: 1,
      });
    } else if (phase.kind === 'MERGE') {
      // Draw all non-consumed tiles from boardBeforeMerge
      this.pushBoardTiles(phase.boardBeforeMerge, draws, phase.hiddenIds);

      // Slide consumed tiles into result position during first half
      if (t < 0.5) {
        const subT = t / 0.5;
        for (const c of phase.event.consumed) {
          const actualPos = findTilePos(phase.boardBeforeMerge, c.tile.id);
          if (!actualPos) continue;

          const curCol = actualPos.col + (phase.event.result.pos.col - actualPos.col) * subT;
          const curRow = actualPos.row + (phase.event.result.pos.row - actualPos.row) * subT;
          draws.push({
            id: c.tile.id,
            value: c.tile.value,
            col: curCol,
            row: curRow,
            scale: 1 - subT * 0.15,
            alpha: 1 - subT * 0.35,
          });
        }
      } else {
        // Pop new merged tile in second half
        const subT = (t - 0.5) / 0.5;
        const popScale = this.reducedMotion ? 1 : 1 + Math.sin(subT * Math.PI) * 0.22;
        draws.push({
          id: phase.event.result.tile.id,
          value: phase.event.newValue,
          col: phase.event.result.pos.col,
          row: phase.event.result.pos.row,
          scale: popScale,
          alpha: 1,
          highlight: true,
        });
      }
    } else if (phase.kind === 'GRAVITY') {
      // Draw all non-moving tiles from boardAfterMerge
      this.pushBoardTiles(phase.boardAfterMerge, draws, phase.movedIds);
      for (const m of phase.event.gravityMoves) {
        const fromRow = m.from.row;
        const curRow = fromRow + (m.to.row - fromRow) * eased;
        draws.push({
          id: m.tileId,
          value: m.value,
          col: m.to.col,
          row: curRow,
          scale: 1,
          alpha: 1,
        });
      }
    }

    return draws;
  }

  private pushBoardTiles(
    board: GameBoard,
    out: AnimatedTileDraw[],
    skipIds?: Set<number>
  ): void {
    for (let c = 0; c < board.columns.length; c++) {
      const col = board.columns[c];
      for (let r = 0; r < col.length; r++) {
        const tile: Tile = col[r];
        if (skipIds?.has(tile.id)) continue;
        out.push({
          id: tile.id,
          value: tile.value,
          col: c,
          row: r,
          scale: 1,
          alpha: 1,
        });
      }
    }
  }
}
