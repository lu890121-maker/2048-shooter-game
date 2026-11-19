import { BoardManager } from './BoardManager.mjs';
import { MergeSystem } from './MergeSystem.mjs';

export class ChainResolver {
  static resolveShot(
    board,
    col,
    shotTileId,
    shotValue){
    const colLen = board.getColumnLength(col);
    const merges = [];
    const checkQueue = [];
    const queuedSet = new Set();

    const enqueue = (tileId) => {
      if (!queuedSet.has(tileId)) {
        queuedSet.add(tileId);
        checkQueue.push(tileId);
      }
    };

    let landingRow;
    let isFullColumnDirectMerge = false;

    if (colLen < board.maxRows) {
      const shotTile = board.createTile(shotValue);
      // Preserve caller's intended shotTileId if needed? BoardManager assigns unique IDs.
      void shotTileId;
      const landedPos = board.pushTileToColumn(col, shotTile);
      landingRow = landedPos.row;
      enqueue(shotTile.id);
    } else {
      // Full column special rule: bottom tile (row = maxRows - 1) must match shotValue
      isFullColumnDirectMerge = true;
      landingRow = board.maxRows - 1;
      const anchorPos = { col, row: landingRow };
      const bottomTile = board.getTileAt(anchorPos);
      if (!bottomTile || bottomTile.value !== shotValue) {
        throw new Error(`Full column ${col} cannot accept value ${shotValue}`);
      }

      // Check orthogonal neighbors of anchorPos (including cross-column & above)
      const matchingNeighbors = board
        .getOrthogonalNeighbors(anchorPos)
        .filter((n) => n.tile.value === shotValue);

      const consumedBoardTiles = [
        { tile: { ...bottomTile }, pos: { ...anchorPos } },
        ...matchingNeighbors.map((n) => ({
          tile: { ...n.tile },
          pos: { ...n.pos },
        })),
      ];

      // Shot tile conceptually arrives from row = maxRows
      const virtualShotTile = {
        tile: { id: shotTileId, value: shotValue },
        pos: { col, row: board.maxRows },
      };

      const totalCount = consumedBoardTiles.length + 1;
      const newValue = shotValue * Math.pow(2, totalCount - 1);
      const targetPos = MergeSystem.selectTargetPosition(
        consumedBoardTiles.map((c) => c.pos),
        anchorPos
      );

      const mergedTile = board.createTile(newValue);
      board.replaceTileAt(targetPos, mergedTile);

      const idsToRemove = new Set();
      for (const c of consumedBoardTiles) {
        if (c.pos.col === targetPos.col && c.pos.row === targetPos.row) continue;
        idsToRemove.add(c.tile.id);
      }

      const gravityMoves = board.removeTilesByIdsAndCompact(idsToRemove);
      const finalTargetPos = board.findTilePositionById(mergedTile.id) ?? targetPos;

      merges.push({
        chainIndex: 1,
        baseValue: shotValue,
        newValue,
        scoreGain: newValue,
        consumed: [virtualShotTile, ...consumedBoardTiles],
        result: {
          tile: { ...mergedTile },
          pos: { ...finalTargetPos },
        },
        gravityMoves,
      });

      enqueue(mergedTile.id);
      for (const move of gravityMoves) {
        enqueue(move.tileId);
      }
    }

    // Chain loop: only newly created or gravity-shifted tiles are checked
    while (checkQueue.length > 0) {
      const tileId = checkQueue.shift();
      queuedSet.delete(tileId);

      const currentPos = board.findTilePositionById(tileId);
      if (!currentPos) continue; // Already consumed in an earlier merge

      const group = MergeSystem.findMergeGroup(board, currentPos);
      if (!group) continue;

      const mergedTile = board.createTile(group.newValue);
      board.replaceTileAt(group.targetPos, mergedTile);

      const idsToRemove = new Set();
      for (const c of group.consumed) {
        if (c.pos.col === group.targetPos.col && c.pos.row === group.targetPos.row) continue;
        idsToRemove.add(c.tile.id);
      }

      const gravityMoves = board.removeTilesByIdsAndCompact(idsToRemove);
      const finalTargetPos = board.findTilePositionById(mergedTile.id) ?? group.targetPos;

      merges.push({
        chainIndex: merges.length + 1,
        baseValue: group.baseValue,
        newValue: group.newValue,
        scoreGain: group.newValue,
        consumed: group.consumed,
        result: {
          tile: { ...mergedTile },
          pos: { ...finalTargetPos },
        },
        gravityMoves,
      });

      enqueue(mergedTile.id);
      for (const move of gravityMoves) {
        enqueue(move.tileId);
      }
    }

    let totalScoreGain = 0;
    for (const m of merges) {
      totalScoreGain += m.scoreGain;
    }

    return {
      landingRow,
      isFullColumnDirectMerge,
      merges,
      totalScoreGain,
      chainCount: merges.length,
    };
  }
}
