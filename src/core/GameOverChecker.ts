import { BoardManager } from './BoardManager';

export class GameOverChecker {
  public static canShoot(board: BoardManager, value: number): boolean {
    for (let c = 0; c < board.cols; c++) {
      if (board.canShootToColumn(c, value)) {
        return true;
      }
    }
    return false;
  }

  public static isGameOver(board: BoardManager, current: number, next: number): boolean {
    return !GameOverChecker.canShoot(board, current) && !GameOverChecker.canShoot(board, next);
  }

  public static isSwapRecommended(board: BoardManager, current: number, next: number): boolean {
    return !GameOverChecker.canShoot(board, current) && GameOverChecker.canShoot(board, next);
  }
}
