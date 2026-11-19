import { GAME_CONFIG } from '../config/GameConfig.mjs';

export class BoardManager {
  cols;
  maxRows;
  board;
  nextTileId = 1;

  constructor(cols = GAME_CONFIG.board.cols, maxRows = GAME_CONFIG.board.maxRows) {
    this.cols = cols;
    this.maxRows = maxRows;
    this.board = {
      columns: Array.from({ length: cols }, () => []),
    };
  }

  createTile(value){
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid tile value: ${value}`);
    }
    return {
      id: this.nextTileId++,
      value,
    };
  }

  reset(){
    this.nextTileId = 1;
    this.board = {
      columns: Array.from({ length: this.cols }, () => []),
    };
  }

  loadColumns(columnsValues){
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

  getBoard(){
    return this.board;
  }

  cloneBoard(){
    return {
      columns: this.board.columns.map((col) => col.map((t) => ({ ...t }))),
    };
  }

  getColumn(col){
    if (!this.isValidCol(col)) return [];
    return this.board.columns[col];
  }

  getColumnLength(col){
    if (!this.isValidCol(col)) return 0;
    return this.board.columns[col].length;
  }

  isValidCol(col){
    return Number.isInteger(col) && col >= 0 && col < this.cols;
  }

  getTileAt(pos){
    if (!this.isValidCol(pos.col)) return null;
    const colTiles = this.board.columns[pos.col];
    if (pos.row < 0 || pos.row >= colTiles.length) return null;
    return colTiles[pos.row];
  }

  findTilePositionById(tileId){
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

  getOrthogonalNeighbors(pos) {
    const dirs = [
      { col: pos.col, row: pos.row - 1 },
      { col: pos.col, row: pos.row + 1 },
      { col: pos.col - 1, row: pos.row },
      { col: pos.col + 1, row: pos.row },
    ];
    const result = [];
    for (const d of dirs) {
      const tile = this.getTileAt(d);
      if (tile) {
        result.push({ pos: d, tile });
      }
    }
    return result;
  }

  canShootToColumn(col, value){
    if (!this.isValidCol(col)) return false;
    const colTiles = this.board.columns[col];
    if (colTiles.length < this.maxRows) {
      return true;
    }
    const bottomTile = colTiles[colTiles.length - 1];
    return bottomTile !== undefined && bottomTile.value === value;
  }

  getLandingRow(col){
    if (!this.isValidCol(col)) return -1;
    const len = this.board.columns[col].length;
    return len < this.maxRows ? len : this.maxRows - 1;
  }

  pushTileToColumn(col, tile){
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

  replaceTileAt(pos, newTile){
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
  removeTilesByIdsAndCompact(idsToRemove){
    const moves = [];
    for (let c = 0; c < this.cols; c++) {
      const oldCol = this.board.columns[c];
      let writeRow = 0;
      const newCol = [];
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

  getBiggestTileValue(){
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
  getBoardValues(){
    const values = new Set();
    for (let c = 0; c < this.cols; c++) {
      for (const tile of this.board.columns[c]) {
        values.add(tile.value);
      }
    }
    return values;
  }

  getTotalTileCount(){
    let count = 0;
    for (let c = 0; c < this.cols; c++) {
      count += this.board.columns[c].length;
    }
    return count;
  }

  validateIntegrity() {
    const errors = [];
    const seenIds = new Set();

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
}
