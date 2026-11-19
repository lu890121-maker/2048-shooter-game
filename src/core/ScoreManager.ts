import { GAME_CONFIG } from '../config/GameConfig';

export interface ScoreSnapshot {
  score: number;
  bestScore: number;
  biggestTile: number;
  allTimeBiggestTile: number;
  reached2048: boolean;
  mergeCount: number;
  maxChainCount: number;
}

export class ScoreManager {
  private score = 0;
  private bestScore = 0;
  private biggestTile = 0;
  private allTimeBiggestTile = 0;
  private reached2048 = false;
  private mergeCount = 0;
  private maxChainCount = 0;

  constructor(initialBestScore = 0, initialBestTile = 0) {
    this.bestScore = Math.max(0, initialBestScore);
    this.allTimeBiggestTile = Math.max(0, initialBestTile);
  }

  public restoreRun(data: {
    score: number;
    biggestTile: number;
    reached2048: boolean;
    mergeCount: number;
    maxChainCount: number;
  }): void {
    this.score = Math.max(0, data.score);
    if (this.score > this.bestScore) this.bestScore = this.score;
    this.biggestTile = Math.max(0, data.biggestTile);
    if (this.biggestTile > this.allTimeBiggestTile) this.allTimeBiggestTile = this.biggestTile;
    this.reached2048 = Boolean(data.reached2048);
    this.mergeCount = Math.max(0, data.mergeCount);
    this.maxChainCount = Math.max(0, data.maxChainCount);
  }

  public resetRun(): void {
    this.score = 0;
    this.biggestTile = 0;
    this.reached2048 = false;
    this.mergeCount = 0;
    this.maxChainCount = 0;
  }

  public recordResolution(
    scoreGain: number,
    chainCount: number,
    boardBiggestTile: number
  ): { reached2048Now: boolean; newMilestoneValue: number | null } {
    const prevBiggest = this.biggestTile;
    this.score += scoreGain;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }

    this.mergeCount += chainCount;
    if (chainCount > this.maxChainCount) {
      this.maxChainCount = chainCount;
    }

    if (boardBiggestTile > this.biggestTile) {
      this.biggestTile = boardBiggestTile;
    }
    if (this.biggestTile > this.allTimeBiggestTile) {
      this.allTimeBiggestTile = this.biggestTile;
    }

    let reached2048Now = false;
    if (!this.reached2048 && this.biggestTile >= GAME_CONFIG.board.milestoneValue) {
      this.reached2048 = true;
      reached2048Now = true;
    }

    let newMilestoneValue: number | null = null;
    if (
      chainCount > 0 &&
      boardBiggestTile > prevBiggest &&
      boardBiggestTile >= GAME_CONFIG.board.celebrationMinValue
    ) {
      newMilestoneValue = boardBiggestTile;
    }

    return { reached2048Now, newMilestoneValue };
  }

  public syncBoardBiggestTile(boardBiggestTile: number): void {
    if (boardBiggestTile > this.biggestTile) {
      this.biggestTile = boardBiggestTile;
    }
    if (this.biggestTile > this.allTimeBiggestTile) {
      this.allTimeBiggestTile = this.biggestTile;
    }
    if (this.biggestTile >= GAME_CONFIG.board.milestoneValue) {
      this.reached2048 = true;
    }
  }

  public getSnapshot(): ScoreSnapshot {
    return {
      score: this.score,
      bestScore: this.bestScore,
      biggestTile: this.biggestTile,
      allTimeBiggestTile: this.allTimeBiggestTile,
      reached2048: this.reached2048,
      mergeCount: this.mergeCount,
      maxChainCount: this.maxChainCount,
    };
  }
}
