import { GAME_CONFIG } from '../config/GameConfig.mjs';
export class ScoreManager {
  score = 0;
  bestScore = 0;
  biggestTile = 0;
  allTimeBiggestTile = 0;
  reached2048 = false;
  mergeCount = 0;
  maxChainCount = 0;

  constructor(initialBestScore = 0, initialBestTile = 0) {
    this.bestScore = Math.max(0, initialBestScore);
    this.allTimeBiggestTile = Math.max(0, initialBestTile);
  }

  restoreRun(data){
    this.score = Math.max(0, data.score);
    if (this.score > this.bestScore) this.bestScore = this.score;
    this.biggestTile = Math.max(0, data.biggestTile);
    if (this.biggestTile > this.allTimeBiggestTile) this.allTimeBiggestTile = this.biggestTile;
    this.reached2048 = Boolean(data.reached2048);
    this.mergeCount = Math.max(0, data.mergeCount);
    this.maxChainCount = Math.max(0, data.maxChainCount);
  }

  resetRun(){
    this.score = 0;
    this.biggestTile = 0;
    this.reached2048 = false;
    this.mergeCount = 0;
    this.maxChainCount = 0;
  }

  recordResolution(
    scoreGain,
    chainCount,
    boardBiggestTile) {
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

    let newMilestoneValue = null;
    if (
      chainCount > 0 &&
      boardBiggestTile > prevBiggest &&
      boardBiggestTile >= GAME_CONFIG.board.celebrationMinValue
    ) {
      newMilestoneValue = boardBiggestTile;
    }

    return { reached2048Now, newMilestoneValue };
  }

  syncBoardBiggestTile(boardBiggestTile){
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

  getSnapshot(){
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
