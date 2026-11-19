import { BoardManager } from './BoardManager.mjs';
export class GameOverChecker {
  static canShoot(board, value){
    for (let c = 0; c < board.cols; c++) {
      if (board.canShootToColumn(c, value)) {
        return true;
      }
    }
    return false;
  }

  static isGameOver(board, current, next){
    return !GameOverChecker.canShoot(board, current) && !GameOverChecker.canShoot(board, next);
  }

  static isSwapRecommended(board, current, next){
    return !GameOverChecker.canShoot(board, current) && GameOverChecker.canShoot(board, next);
  }
}
