import { BoardManager } from './BoardManager.mjs';
import { ChainResolver } from './ChainResolver.mjs';
import { GameOverChecker } from './GameOverChecker.mjs';
import { GameState } from './GameState.mjs';
import { NumberGenerator } from './NumberGenerator.mjs';
import { ScoreManager } from './ScoreManager.mjs';

export class GameManager {
  board;
  generator;
  scoreManager;
  state = GameState.READY;
  currentNumber = 2;
  nextNumber = 4;
  virtualShotCounter = -1;

  constructor(options = {}) {
    this.board = new BoardManager();
    this.generator = new NumberGenerator(options.seed);
    this.scoreManager = new ScoreManager(options.initialBestScore, options.initialBestTile);
    this.initQueue();
  }

  initQueue(){
    const biggest = this.board.getBiggestTileValue();
    const boardValues = this.board.getBoardValues();
    this.currentNumber = this.generator.generateNext(biggest, boardValues);
    this.nextNumber = this.generator.generateNext(biggest, boardValues);
  }

  reset(){
    this.board.reset();
    this.scoreManager.resetRun();
    this.state = GameState.READY;
    this.initQueue();
  }

  getState(){
    return this.state;
  }

  setState(newState){
    this.state = newState;
  }

  getBoardSnapshot(){
    return this.board.cloneBoard();
  }

  getCurrentNumber(){
    return this.currentNumber;
  }

  getNextNumber(){
    return this.nextNumber;
  }

  setQueueForTesting(current, next){
    this.currentNumber = current;
    this.nextNumber = next;
    this.evaluateStateAfterBoardChange();
  }

  exportRunState() {
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

  restoreRunState(data){
    this.board.loadColumns(data.columns);
    this.currentNumber = data.current;
    this.nextNumber = data.next;
    this.scoreManager.restoreRun(data);
    this.evaluateStateAfterBoardChange();
  }

  getScoreSnapshot(){
    return this.scoreManager.getSnapshot();
  }

  canShootToColumn(col){
    if (this.state !== GameState.READY) return false;
    return this.board.canShootToColumn(col, this.currentNumber);
  }

  isSwapRecommended(){
    if (this.state === GameState.GAME_OVER) return false;
    return GameOverChecker.isSwapRecommended(this.board, this.currentNumber, this.nextNumber);
  }

  swap(){
    if (this.state !== GameState.READY) {
      return false;
    }
    const prevCurrent = this.currentNumber;
    this.currentNumber = this.nextNumber;
    this.nextNumber = prevCurrent;
    return true;
  }

  shoot(col, deferReadyState = false){
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

  finishAnimation(){
    if (this.state === GameState.GAME_OVER) return;
    const gameOver = GameOverChecker.isGameOver(this.board, this.currentNumber, this.nextNumber);
    this.state = gameOver ? GameState.GAME_OVER : GameState.READY;
  }

  evaluateStateAfterBoardChange(){
    this.scoreManager.syncBoardBiggestTile(this.board.getBiggestTileValue());
    const gameOver = GameOverChecker.isGameOver(this.board, this.currentNumber, this.nextNumber);
    this.state = gameOver ? GameState.GAME_OVER : GameState.READY;
  }
}
