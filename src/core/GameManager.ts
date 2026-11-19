import { BoardManager } from './BoardManager';
import { ChainResolver } from './ChainResolver';
import { GameOverChecker } from './GameOverChecker';
import { GameState } from './GameState';
import { NumberGenerator } from './NumberGenerator';
import { ScoreManager, ScoreSnapshot } from './ScoreManager';
import { GameBoard, ShotResult } from './types';

export interface GameManagerOptions {
  seed?: number;
  initialBestScore?: number;
  initialBestTile?: number;
}

export class GameManager {
  public readonly board: BoardManager;
  public readonly generator: NumberGenerator;
  public readonly scoreManager: ScoreManager;

  private state: GameState = GameState.READY;
  private currentNumber = 2;
  private nextNumber = 4;
  private virtualShotCounter = -1;

  constructor(options: GameManagerOptions = {}) {
    this.board = new BoardManager();
    this.generator = new NumberGenerator(options.seed);
    this.scoreManager = new ScoreManager(options.initialBestScore, options.initialBestTile);
    this.initQueue();
  }

  private initQueue(): void {
    const biggest = this.board.getBiggestTileValue();
    const boardValues = this.board.getBoardValues();
    this.currentNumber = this.generator.generateNext(biggest, boardValues);
    this.nextNumber = this.generator.generateNext(biggest, boardValues);
  }

  public reset(): void {
    this.board.reset();
    this.scoreManager.resetRun();
    this.generator.resetMergedValues();
    this.state = GameState.READY;
    this.initQueue();
  }

  public getState(): GameState {
    return this.state;
  }

  public setState(newState: GameState): void {
    this.state = newState;
  }

  public getBoardSnapshot(): GameBoard {
    return this.board.cloneBoard();
  }

  public getCurrentNumber(): number {
    return this.currentNumber;
  }

  public getNextNumber(): number {
    return this.nextNumber;
  }

  public setQueueForTesting(current: number, next: number): void {
    this.currentNumber = current;
    this.nextNumber = next;
    this.evaluateStateAfterBoardChange();
  }

  public exportRunState() {
    const snap = this.scoreManager.getSnapshot();
    return {
      columns: this.board.getBoard().columns.map((c) => c.map((t) => t.value)),
      current: this.currentNumber,
      next: this.nextNumber,
      score: snap.score,
      biggestTile: snap.biggestTile,
      reached2048: snap.reached2048,
      mergeCount: snap.mergeCount,
      maxChainCount: snap.maxChainCount,
    };
  }

  public restoreRunState(data: {
    columns: number[][];
    current: number;
    next: number;
    score: number;
    biggestTile: number;
    reached2048: boolean;
    mergeCount: number;
    maxChainCount: number;
  }): void {
    this.board.loadColumns(data.columns);
    this.currentNumber = data.current;
    this.nextNumber = data.next;
    this.scoreManager.restoreRun(data);
    this.evaluateStateAfterBoardChange();
  }

  public getScoreSnapshot(): ScoreSnapshot {
    return this.scoreManager.getSnapshot();
  }

  public canShootToColumn(col: number): boolean {
    if (this.state !== GameState.READY) return false;
    return this.board.canShootToColumn(col, this.currentNumber);
  }

  public isSwapRecommended(): boolean {
    if (this.state === GameState.GAME_OVER) return false;
    return GameOverChecker.isSwapRecommended(this.board, this.currentNumber, this.nextNumber);
  }

  public swap(): boolean {
    if (this.state !== GameState.READY) {
      return false;
    }
    const prevCurrent = this.currentNumber;
    this.currentNumber = this.nextNumber;
    this.nextNumber = prevCurrent;
    return true;
  }

  public shoot(col: number, deferReadyState = false): ShotResult {
    if (this.state !== GameState.READY) {
      return {
        ok: false,
        reason: 'NOT_READY',
        col,
        landingRow: -1,
        isFullColumnDirectMerge: false,
        merges: [],
        totalScoreGain: 0,
        chainCount: 0,
        reached2048Now: false,
        newMilestoneValue: null,
        gameOver: this.state === GameState.GAME_OVER,
        swapRecommended: false,
      };
    }

    if (!this.board.isValidCol(col)) {
      return {
        ok: false,
        reason: 'INVALID_COLUMN',
        col,
        landingRow: -1,
        isFullColumnDirectMerge: false,
        merges: [],
        totalScoreGain: 0,
        chainCount: 0,
        reached2048Now: false,
        newMilestoneValue: null,
        gameOver: false,
        swapRecommended: this.isSwapRecommended(),
      };
    }

    if (!this.board.canShootToColumn(col, this.currentNumber)) {
      return {
        ok: false,
        reason: 'COLUMN_FULL',
        col,
        landingRow: -1,
        isFullColumnDirectMerge: false,
        merges: [],
        totalScoreGain: 0,
        chainCount: 0,
        reached2048Now: false,
        newMilestoneValue: null,
        gameOver: false,
        swapRecommended: this.isSwapRecommended(),
      };
    }

    this.state = GameState.SHOOTING;
    const shotValue = this.currentNumber;
    const virtualShotId = this.virtualShotCounter--;

    this.state = GameState.RESOLVING;
    const resolution = ChainResolver.resolveShot(this.board, col, virtualShotId, shotValue);

    // 记录合成的数字，用于禁用对应的小数字生成
    for (const merge of resolution.merges) {
      this.generator.recordMerge(merge.newValue);
    }

    const biggestOnBoard = this.board.getBiggestTileValue();
    const { reached2048Now, newMilestoneValue } = this.scoreManager.recordResolution(
      resolution.totalScoreGain,
      resolution.chainCount,
      biggestOnBoard
    );

    this.currentNumber = this.nextNumber;
    // 获取当前棋盘上的数字值，用于动态淘汰判断
    const boardValues = this.board.getBoardValues();
    this.nextNumber = this.generator.generateNext(this.scoreManager.getSnapshot().biggestTile, boardValues);

    const gameOver = GameOverChecker.isGameOver(this.board, this.currentNumber, this.nextNumber);
    const swapRecommended =
      !gameOver && GameOverChecker.isSwapRecommended(this.board, this.currentNumber, this.nextNumber);

    if (!deferReadyState) {
      this.state = gameOver ? GameState.GAME_OVER : GameState.READY;
    }

    return {
      ok: true,
      col,
      shotTile: { id: virtualShotId, value: shotValue },
      landingRow: resolution.landingRow,
      isFullColumnDirectMerge: resolution.isFullColumnDirectMerge,
      merges: resolution.merges,
      totalScoreGain: resolution.totalScoreGain,
      chainCount: resolution.chainCount,
      reached2048Now,
      newMilestoneValue,
      gameOver,
      swapRecommended,
    };
  }

  public finishAnimation(): void {
    if (this.state === GameState.GAME_OVER) return;
    const gameOver = GameOverChecker.isGameOver(this.board, this.currentNumber, this.nextNumber);
    this.state = gameOver ? GameState.GAME_OVER : GameState.READY;
  }

  public evaluateStateAfterBoardChange(): void {
    this.scoreManager.syncBoardBiggestTile(this.board.getBiggestTileValue());
    const gameOver = GameOverChecker.isGameOver(this.board, this.currentNumber, this.nextNumber);
    this.state = gameOver ? GameState.GAME_OVER : GameState.READY;
  }
}
