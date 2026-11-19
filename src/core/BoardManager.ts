import { GAME_CONFIG } from '../config/GameConfig';
import { GameBoard, Position, Tile, TileMove } from './types';

export class BoardManager {
  public readonly cols: number;
  public readonly maxRows: number;
  private board: GameBoard;
  private nextTileId = 1;

  constructor(cols = GAME_CONFIG.board.cols, maxRows = GAME_CONFIG.board.maxRows) {
    this.cols = cols;
    this.maxRows = maxRows;
    this.board = {
      columns: Array.from({ length: cols }, () => []),
    };
  }

  public createTile(value: number): Tile {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid tile value: ${value}`);
    }
    return {
      id: this.nextTileId++,
      value,
    };
  }

  public reset(): void {
    this.nextTileId = 1;
    this.board = {
      columns: Array.from({ length: this.cols }, () => []),
    };
  }

  public loadColumns(columnsValues: number[][]): void {
    if (columnsValues.length !== this.cols) {
      throw new Error(`Expected ${this.cols} columns, got ${columnsValues.length}`);
    }
    this.reset();
    for (let c = 0; c < this.cols; c++) {
      const colVals = columnsValues[c];
      if (colVals.length > this.maxRows) {
        throw new Error(`Column ${c} exceeds maxRows (${this.maxRows})`);
      }
      this.board.columns[c] = colVals.map((v) => this.createTile(v));
    }
  }

  public getBoard(): GameBoard {
    return this.board;
  }

  public cloneBoard(): GameBoard {
    return {
      columns: this.board.columns.map((col) => col.map((t) => ({ ...t }))),
    };
  }

  public getColumn(col: number): readonly Tile[] {
    if (!this.isValidCol(col)) return [];
    return this.board.columns[col];
  }

  public getColumnLength(col: number): number {
    if (!this.isValidCol(col)) return 0;
    return this.board.columns[col].length;
  }

  public isValidCol(col: number): boolean {
    return Number.isInteger(col) && col >= 0 && col < this.cols;
  }

  public getTileAt(pos: Position): Tile | null {
    if (!this.isValidCol(pos.col)) return null;
    const colTiles = this.board.columns[pos.col];
    if (pos.row < 0 || pos.row >= colTiles.length) return null;
    return colTiles[pos.row];
  }

  public findTilePositionById(tileId: number): Position | null {
    for (let c = 0; c < this.cols; c++) {
      const colTiles = this.board.columns[c];
      for (let r = 0; r < colTiles.length; r++) {
        if (colTiles[r].id === tileId) {
          return { col: c, row: r };
        }
      }
    }
    return null;
  }

  public getOrthogonalNeighbors(pos: Position): Array<{ pos: Position; tile: Tile }> {
    const dirs: Position[] = [
      { col: pos.col, row: pos.row - 1 },
      { col: pos.col, row: pos.row + 1 },
      { col: pos.col - 1, row: pos.row },
      { col: pos.col + 1, row: pos.row },
    ];
    const result: Array<{ pos: Position; tile: Tile }> = [];
    for (const d of dirs) {
      const tile = this.getTileAt(d);
      if (tile) {
        result.push({ pos: d, tile });
      }
    }
    return result;
  }

  public canShootToColumn(col: number, value: number): boolean {
    if (!this.isValidCol(col)) return false;
    const colTiles = this.board.columns[col];
    if (colTiles.length < this.maxRows) {
      return true;
    }
    const bottomTile = colTiles[colTiles.length - 1];
    return bottomTile !== undefined && bottomTile.value === value;
  }

  public getLandingRow(col: number): number {
    if (!this.isValidCol(col)) return -1;
    const len = this.board.columns[col].length;
    return len < this.maxRows ? len : this.maxRows - 1;
  }

  public pushTileToColumn(col: number, tile: Tile): Position {
    if (!this.isValidCol(col)) {
      throw new Error(`Invalid column: ${col}`);
    }
    const colTiles = this.board.columns[col];
    if (colTiles.length >= this.maxRows) {
      throw new Error(`Column ${col} is already full`);
    }
    const row = colTiles.length;
    colTiles.push(tile);
    return { col, row };
  }

  public replaceTileAt(pos: Position, newTile: Tile): void {
    if (!this.isValidCol(pos.col)) {
      throw new Error(`Invalid column: ${pos.col}`);
    }
    const colTiles = this.board.columns[pos.col];
    if (pos.row < 0 || pos.row >= colTiles.length) {
      throw new Error(`Invalid row ${pos.row} in column ${pos.col}`);
    }
    colTiles[pos.row] = newTile;
  }

  /**
   * Removes tiles by their IDs and compacts affected columns upward (no gaps).
   * Preserves tile identities and returns all vertical shifts that occurred.
   */
  public removeTilesByIdsAndCompact(idsToRemove: Set<number>): TileMove[] {
    const moves: TileMove[] = [];
    for (let c = 0; c < this.cols; c++) {
      const oldCol = this.board.columns[c];
      let writeRow = 0;
      const newCol: Tile[] = [];
      let changed = false;

      for (let r = 0; r < oldCol.length; r++) {
        const tile = oldCol[r];
        if (idsToRemove.has(tile.id)) {
          changed = true;
          continue;
        }
        if (r !== writeRow) {
          moves.push({
            tileId: tile.id,
            value: tile.value,
            from: { col: c, row: r },
            to: { col: c, row: writeRow },
          });
        }
        newCol.push(tile);
        writeRow++;
      }

      if (changed) {
        this.board.columns[c] = newCol;
      }
    }
    return moves;
  }

  public getBiggestTileValue(): number {
    let max = 0;
    for (let c = 0; c < this.cols; c++) {
      for (const tile of this.board.columns[c]) {
        if (tile.value > max) max = tile.value;
      }
    }
    return max;
  }

  /**
   * 获取棋盘上所有不重复的数字值集合
   * 用于动态淘汰机制：判断某个数字是否还在棋盘上
   */
  public getBoardValues(): Set<number> {
    const values = new Set<number>();
    for (let c = 0; c < this.cols; c++) {
      for (const tile of this.board.columns[c]) {
        values.add(tile.value);
      }
    }
    return values;
  }

  public getTotalTileCount(): number {
    let count = 0;
    for (let c = 0; c < this.cols; c++) {
      count += this.board.columns[c].length;
    }
    return count;
  }

  public validateIntegrity(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const seenIds = new Set<number>();

    if (this.board.columns.length !== this.cols) {
      errors.push(`Invalid column count: ${this.board.columns.length}`);
    }

    for (let c = 0; c < this.board.columns.length; c++) {
      const col = this.board.columns[c];
      if (col.length > this.maxRows) {
        errors.push(`Column ${c} exceeds maxRows (${col.length} > ${this.maxRows})`);
      }
      for (let r = 0; r < col.length; r++) {
        const tile = col[r];
        if (!tile) {
          errors.push(`Gap/undefined tile at (${c}, ${r})`);
          continue;
        }
        if (seenIds.has(tile.id)) {
          errors.push(`Duplicate tile ID ${tile.id} at (${c}, ${r})`);
        }
        seenIds.add(tile.id);
        if (!Number.isFinite(tile.value) || tile.value <= 0) {
          errors.push(`Invalid tile value ${tile.value} at (${c}, ${r})`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 互换两个位置上的数字
   * @param pos1 第一个位置
   * @param pos2 第二个位置
   * @returns 是否互换成功
   */
  public swapTiles(pos1: Position, pos2: Position): boolean {
    if (!this.isValidCol(pos1.col) || !this.isValidCol(pos2.col)) {
      return false;
    }

    const tile1 = this.getTileAt(pos1);
    const tile2 = this.getTileAt(pos2);

    if (!tile1 || !tile2) {
      return false;
    }

    // 互换位置
    this.board.columns[pos1.col][pos1.row] = tile2;
    this.board.columns[pos2.col][pos2.row] = tile1;

    return true;
  }
}
