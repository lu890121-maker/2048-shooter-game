import { BoardManager } from './BoardManager';
import { PlacedTile, Position } from './types';

export interface MergeGroup {
  baseValue: number;
  newValue: number;
  consumed: PlacedTile[];
  targetPos: Position;
}

export class MergeSystem {
  /**
   * Finds the connected orthogonal component of tiles with the same value starting at triggerPos.
   * Returns null if no orthogonal neighbor matches.
   */
  public static findMergeGroup(board: BoardManager, triggerPos: Position): MergeGroup | null {
    const triggerTile = board.getTileAt(triggerPos);
    if (!triggerTile) return null;

    const visited = new Set<number>([triggerTile.id]);
    const queue: PlacedTile[] = [{ tile: { ...triggerTile }, pos: { ...triggerPos } }];
    const consumed: PlacedTile[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      consumed.push(current);

      const neighbors = board.getOrthogonalNeighbors(current.pos);
      for (const n of neighbors) {
        if (n.tile.value === triggerTile.value && !visited.has(n.tile.id)) {
          visited.add(n.tile.id);
          queue.push({ tile: { ...n.tile }, pos: { ...n.pos } });
        }
      }
    }

    if (consumed.length <= 1) {
      return null;
    }

    const newValue = triggerTile.value * Math.pow(2, consumed.length - 1);
    const targetPos = MergeSystem.selectTargetPosition(
      consumed.map((c) => c.pos),
      triggerPos
    );

    return {
      baseValue: triggerTile.value,
      newValue,
      consumed,
      targetPos,
    };
  }

  /**
   * Deterministic target position rule:
   * 1. Highest position (smallest row).
   * 2. If tied at smallest row, prefer triggerPos.col if triggerPos is at that row.
   * 3. Otherwise smallest col.
   */
  public static selectTargetPosition(positions: Position[], triggerPos: Position): Position {
    let minRow = Infinity;
    for (const p of positions) {
      if (p.row < minRow) minRow = p.row;
    }

    const topCandidates = positions.filter((p) => p.row === minRow);
    const triggerMatch = topCandidates.find(
      (p) => p.col === triggerPos.col && p.row === triggerPos.row
    );
    if (triggerMatch) {
      return { ...triggerMatch };
    }

    topCandidates.sort((a, b) => a.col - b.col);
    return { ...topCandidates[0] };
  }
}
