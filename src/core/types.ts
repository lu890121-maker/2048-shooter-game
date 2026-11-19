export interface Tile {
  id: number;
  value: number;
}

export interface GameBoard {
  columns: Tile[][];
}

export interface Position {
  col: number;
  row: number;
}

export interface PlacedTile {
  tile: Tile;
  pos: Position;
}

export interface TileMove {
  tileId: number;
  value: number;
  from: Position;
  to: Position;
}

export interface MergeEvent {
  chainIndex: number;
  baseValue: number;
  newValue: number;
  scoreGain: number;
  consumed: PlacedTile[];
  result: PlacedTile;
  gravityMoves: TileMove[];
}

export interface ShotResult {
  ok: boolean;
  reason?: 'NOT_READY' | 'INVALID_COLUMN' | 'COLUMN_FULL';
  col: number;
  shotTile?: Tile;
  landingRow: number;
  isFullColumnDirectMerge: boolean;
  merges: MergeEvent[];
  totalScoreGain: number;
  chainCount: number;
  reached2048Now: boolean;
  newMilestoneValue: number | null;
  gameOver: boolean;
  swapRecommended: boolean;
}
