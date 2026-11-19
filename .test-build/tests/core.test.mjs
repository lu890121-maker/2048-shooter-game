import assert from 'node:assert/strict';
import { GameManager } from '../src/core/GameManager.mjs';
import { GameState } from '../src/core/GameState.mjs';
import { NumberGenerator } from '../src/core/NumberGenerator.mjs';
const tests = [];

function test(name, fn){
  tests.push({ name, fn });
}

// Test 1: Normal Merge (8 + 8 -> 16, score +16)
test('Test 1: Normal merge (8 + 8 = 16, score +16)', () => {
  const gm = new GameManager({ seed: 1 });
  gm.board.loadColumns([[8], [], [], [], []]);
  gm.setQueueForTesting(8, 2);

  const res = gm.shoot(0);
  assert.equal(res.ok, true);
  assert.equal(gm.board.getColumnLength(0), 1);
  assert.equal(gm.board.getTileAt({ col: 0, row: 0 })?.value, 16);
  assert.equal(res.totalScoreGain, 16);
  assert.equal(gm.getScoreSnapshot().score, 16);
});

// Test 2: Three identical numbers (8 + 8 + 8 -> 32, only one 32)
test('Test 2: Three identical numbers merge into one 32', () => {
  const gm = new GameManager({ seed: 2 });
  // (0,0)=8, (2,0)=8, shoot 8 into col 1 -> lands at (1,0), touches left and right
  gm.board.loadColumns([[8], [], [8], [], []]);
  gm.setQueueForTesting(8, 4);

  const res = gm.shoot(1);
  assert.equal(res.ok, true);
  assert.equal(res.merges.length, 1);
  assert.equal(res.merges[0].newValue, 32);
  assert.equal(gm.board.getTotalTileCount(), 1);
  assert.equal(gm.board.getTileAt({ col: 1, row: 0 })?.value, 32);
  assert.equal(gm.getScoreSnapshot().score, 32);
});

// Test 3: Four identical numbers (8 + 8 + 8 + 8 -> 64, only one 64)
test('Test 3: Four identical numbers merge into one 64', () => {
  const gm = new GameManager({ seed: 3 });
  // Setup: (2,0)=8, (1,1)=8, (3,1)=8, plus (1,0)=2 and (3,0)=4 so row 1 exists in cols 1 & 3
  gm.board.loadColumns([[], [2, 8], [8], [4, 8], []]);
  gm.setQueueForTesting(8, 2);

  // Shoot 8 into col 2 -> lands at (2,1), touches (2,0)=8, (1,1)=8, (3,1)=8
  const res = gm.shoot(2);
  assert.equal(res.ok, true);
  assert.equal(res.merges.length, 1);
  assert.equal(res.merges[0].newValue, 64);
  assert.equal(gm.board.getTileAt({ col: 2, row: 0 })?.value, 64);
  assert.equal(gm.board.getColumnLength(1), 1);
  assert.equal(gm.board.getColumnLength(3), 1);
  assert.equal(gm.board.getTotalTileCount(), 3); // 2, 4, and 64
});

// Test 4: Diagonal tiles must NOT merge
test('Test 4: Diagonal same-value tiles do NOT merge', () => {
  const gm = new GameManager({ seed: 4 });
  // (0,0)=8, (1,0)=2; shoot 8 into col 1 -> lands at (1,1) diagonal to (0,0)
  gm.board.loadColumns([[8], [2], [], [], []]);
  gm.setQueueForTesting(8, 4);

  const res = gm.shoot(1);
  assert.equal(res.ok, true);
  assert.equal(res.merges.length, 0);
  assert.equal(gm.board.getTileAt({ col: 0, row: 0 })?.value, 8);
  assert.equal(gm.board.getTileAt({ col: 1, row: 1 })?.value, 8);
  assert.equal(gm.getScoreSnapshot().score, 0);
});

// Test 5: Cross-column horizontal merge
test('Test 5: Cross-column horizontal merge', () => {
  const gm = new GameManager({ seed: 5 });
  gm.board.loadColumns([[], [2, 8], [4], [], []]);
  gm.setQueueForTesting(8, 2);

  const res = gm.shoot(2); // lands at (2,1) next to (1,1)=8
  assert.equal(res.ok, true);
  assert.equal(res.merges.length, 1);
  assert.equal(res.merges[0].newValue, 16);
  assert.equal(gm.board.getTileAt({ col: 2, row: 1 })?.value, 16);
  assert.equal(gm.board.getColumnLength(1), 1);
});

// Test 6: Chain merge (64, 32, 16, 8 + 8 -> 128, score 240, chain 4)
test('Test 6: Vertical chain merge (64, 32, 16, 8 + 8 = 128, score 240, 4 chains)', () => {
  const gm = new GameManager({ seed: 6 });
  gm.board.loadColumns([[64, 32, 16, 8], [], [], [], []]);
  gm.setQueueForTesting(8, 2);

  const res = gm.shoot(0);
  assert.equal(res.ok, true);
  assert.equal(res.chainCount, 4);
  assert.equal(res.totalScoreGain, 240);
  assert.equal(gm.getScoreSnapshot().score, 240);
  assert.equal(gm.board.getColumnLength(0), 1);
  assert.equal(gm.board.getTileAt({ col: 0, row: 0 })?.value, 128);
});

// Test 7: Column capacity limit (7 tiles, shooting different value fails without consuming queue)
test('Test 7: Full column (7 tiles) rejects mismatched shot without consuming queue', () => {
  const gm = new GameManager({ seed: 7 });
  gm.board.loadColumns([[2, 4, 8, 16, 32, 64, 128], [], [], [], []]);
  gm.setQueueForTesting(4, 8);

  const res = gm.shoot(0);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'COLUMN_FULL');
  assert.equal(gm.getCurrentNumber(), 4);
  assert.equal(gm.getNextNumber(), 8);
  assert.equal(gm.getScoreSnapshot().score, 0);
  assert.equal(gm.board.getColumnLength(0), 7);
});

// Test 8: Full column matching bottom tile (7 tiles, bottom 8, shoot 8 -> merges!)
test('Test 8: Full column (7 tiles) allows matching bottom tile shot and merges', () => {
  const gm = new GameManager({ seed: 8 });
  gm.board.loadColumns([[2, 4, 16, 32, 64, 128, 8], [], [], [], []]);
  gm.setQueueForTesting(8, 2);

  const res = gm.shoot(0);
  assert.equal(res.ok, true);
  assert.equal(res.isFullColumnDirectMerge, true);
  assert.equal(gm.board.getColumnLength(0), 7);
  assert.equal(gm.board.getTileAt({ col: 0, row: 6 })?.value, 16);
  assert.equal(res.totalScoreGain, 16);
});

// Test 8b: Full column matching bottom tile + cross-column merge
test('Test 8b: Full column match also triggers cross-column merge', () => {
  const gm = new GameManager({ seed: 80 });
  gm.board.loadColumns([
    [2, 4, 16, 32, 64, 128, 8],
    [2, 4, 16, 32, 64, 256, 8],
    [],
    [],
    [],
  ]);
  gm.setQueueForTesting(8, 2);

  const res = gm.shoot(0);
  assert.equal(res.ok, true);
  assert.equal(res.merges[0].newValue, 32); // shot 8 + (0,6)=8 + (1,6)=8 = 32
  assert.equal(gm.board.getTileAt({ col: 0, row: 6 })?.value, 32);
  assert.equal(gm.board.getColumnLength(1), 6);
});

// Test 9: Tile compaction / gravity without gaps
test('Test 9: Removing middle tile compacts column with no gaps and preserves IDs', () => {
  const gm = new GameManager({ seed: 9 });
  gm.board.loadColumns([[2, 4, 8, 16], [], [], [], []]);
  const id8 = gm.board.getTileAt({ col: 0, row: 2 }).id;
  const id16 = gm.board.getTileAt({ col: 0, row: 3 }).id;
  const id4 = gm.board.getTileAt({ col: 0, row: 1 }).id;

  const moves = gm.board.removeTilesByIdsAndCompact(new Set([id4]));
  assert.equal(moves.length, 2);
  assert.equal(gm.board.getColumnLength(0), 3);
  assert.equal(gm.board.getTileAt({ col: 0, row: 1 })?.id, id8);
  assert.equal(gm.board.getTileAt({ col: 0, row: 2 })?.id, id16);
  assert.equal(gm.board.validateIntegrity().valid, true);
});

// Test 10: Swap Current and Next
test('Test 10: Swap exchanges Current and Next without altering board or score', () => {
  const gm = new GameManager({ seed: 10 });
  gm.board.loadColumns([[2], [], [], [], []]);
  gm.setQueueForTesting(2, 8);

  const swapped = gm.swap();
  assert.equal(swapped, true);
  assert.equal(gm.getCurrentNumber(), 8);
  assert.equal(gm.getNextNumber(), 2);
  assert.equal(gm.getScoreSnapshot().score, 0);
  assert.equal(gm.board.getTotalTileCount(), 1);
});

// Test 11: Game Over check when Current cannot shoot, Next CAN shoot -> Swap recommended, NOT Game Over
test('Test 11: Current blocked but Next shootable -> NOT Game Over, swap recommended', () => {
  const gm = new GameManager({ seed: 11 });
  const fullCol = [2, 4, 8, 16, 32, 64, 128];
  gm.board.loadColumns([fullCol, fullCol, fullCol, fullCol, [2, 4, 8, 16, 32, 64, 256]]);
  gm.setQueueForTesting(512, 256);

  assert.equal(gm.getState(), GameState.READY);
  assert.equal(gm.isSwapRecommended(), true);
  assert.equal(gm.canShootToColumn(4), false);

  gm.swap();
  assert.equal(gm.getCurrentNumber(), 256);
  assert.equal(gm.canShootToColumn(4), true);
  const res = gm.shoot(4);
  assert.equal(res.ok, true);
  assert.equal(gm.board.getTileAt({ col: 4, row: 6 })?.value, 512);
});

// Test 12: Both Current and Next cannot shoot -> Game Over
test('Test 12: Both Current and Next blocked -> Game Over', () => {
  const gm = new GameManager({ seed: 12 });
  const fullCol = [2, 4, 8, 16, 32, 64, 128];
  gm.board.loadColumns([fullCol, fullCol, fullCol, fullCol, fullCol]);
  gm.setQueueForTesting(256, 512);

  assert.equal(gm.getState(), GameState.GAME_OVER);
  assert.equal(gm.swap(), false);
  const res = gm.shoot(0);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'NOT_READY');
});

// Test 13: Reaching 2048 triggers celebration flag and continues game
test('Test 13: Reaching 2048 triggers milestone and continues endless mode', () => {
  const gm = new GameManager({ seed: 13 });
  gm.board.loadColumns([[1024], [], [], [], []]);
  gm.setQueueForTesting(1024, 2);

  const res = gm.shoot(0);
  assert.equal(res.ok, true);
  assert.equal(res.reached2048Now, true);
  assert.equal(gm.getScoreSnapshot().biggestTile, 2048);
  assert.equal(gm.getScoreSnapshot().reached2048, true);
  assert.equal(gm.getState(), GameState.READY);

  // Can keep playing beyond 2048
  const res2 = gm.shoot(1);
  assert.equal(res2.ok, true);
});

// Test 14: Cross-column chain after gravity shift
test('Test 14: Gravity shift in one column triggers cross-column chain merge', () => {
  const gm = new GameManager({ seed: 14 });
  // Col 0: [2, 16] (16 at row 1)
  // Col 1: [4, 8, 16] (8 at row 1, 16 at row 2)
  // Shoot 8 into Col 2 at row 1? Wait: if Col 2 has [4], shooting 8 lands at (2,1),
  // merges with (1,1)=8 -> 16 at (2,1). (1,1)=8 is removed, so (1,2)=16 shifts up to (1,1)!
  // Then (1,1)=16 touches BOTH (0,1)=16 AND (2,1)=16 -> triple merge into 64 at (1,1)!
  gm.board.loadColumns([[2, 16], [4, 8, 16], [4], [], []]);
  gm.setQueueForTesting(8, 2);

  const res = gm.shoot(2);
  assert.equal(res.ok, true);
  assert.equal(res.chainCount, 2);
  assert.equal(gm.board.getBiggestTileValue(), 64);
  assert.equal(gm.board.getColumnLength(0), 1);
  assert.equal(gm.board.getColumnLength(1), 1);
  assert.equal(res.totalScoreGain, 16 + 64);
});

// Test 15: Rapid clicks during animation / resolving state cannot double-shoot
test('Test 15: Rapid input during SHOOTING/RESOLVING is rejected cleanly', () => {
  const gm = new GameManager({ seed: 15 });
  gm.setQueueForTesting(2, 4);

  const first = gm.shoot(0, true); // deferReadyState = true (simulating active animation)
  assert.equal(first.ok, true);
  assert.equal(gm.getState(), GameState.RESOLVING);

  const rapid1 = gm.shoot(1, true);
  const rapid2 = gm.shoot(2, true);
  assert.equal(rapid1.ok, false);
  assert.equal(rapid1.reason, 'NOT_READY');
  assert.equal(rapid2.ok, false);
  assert.equal(rapid2.reason, 'NOT_READY');
  assert.equal(gm.swap(), false);

  gm.finishAnimation();
  assert.equal(gm.getState(), GameState.READY);
});

// Test 16: NumberGenerator progression & retirement with dynamic elimination
test('Test 16: NumberGenerator unlocks higher tiles and retires small tiles at thresholds', () => {
  const gen = new NumberGenerator(42);
  const emptyBoard = new Set();
  
  // Initial state: only 2, 4, 8 available
  const initialEligible = gen.getEligibleConfigs(0, emptyBoard).map((c) => c.value);
  assert.deepEqual(initialEligible, [2, 4, 8]);

  // At 64: 16 unlocked
  const at64 = gen.getEligibleConfigs(64, emptyBoard).map((c) => c.value);
  assert.ok(at64.includes(16));

  // At 256: 2 should be retired (if not on board)
  const at256 = gen.getEligibleConfigs(256, emptyBoard).map((c) => c.value);
  assert.ok(!at256.includes(2));
  assert.ok(at256.includes(32));

  // At 256 but 2 still on board: 2 should still be available
  const boardWith2 = new Set([2]);
  const at256With2 = gen.getEligibleConfigs(256, boardWith2).map((c) => c.value);
  assert.ok(at256With2.includes(2), '2 should still be available when on board');
  assert.ok(at256With2.includes(32));

  // At 512: 2 and 4 retired (if not on board)
  const at512 = gen.getEligibleConfigs(512, emptyBoard).map((c) => c.value);
  assert.ok(!at512.includes(2));
  assert.ok(!at512.includes(4));
  assert.ok(at512.includes(64));

  // At 512 but 4 still on board: 4 should still be available
  const boardWith4 = new Set([4]);
  const at512With4 = gen.getEligibleConfigs(512, boardWith4).map((c) => c.value);
  assert.ok(at512With4.includes(4), '4 should still be available when on board');

  // At 2048: 16 retired (if not on board)
  const at2048 = gen.getEligibleConfigs(2048, emptyBoard).map((c) => c.value);
  assert.ok(!at2048.includes(16));
  assert.ok(at2048.includes(256));
});

// Test 16b: Milestone celebration triggers for each new big tile >= 256
test('Test 16b: New milestone triggers for 256, 512, 1024, 2048 without repeating', () => {
  const gm = new GameManager({ seed: 16 });
  gm.board.loadColumns([[128], [], [], [], []]);
  gm.setQueueForTesting(128, 128);
  const r256 = gm.shoot(0);
  assert.equal(r256.newMilestoneValue, 256);

  // Another 256 should NOT re-trigger 256 milestone
  gm.board.loadColumns([[256], [], [128], [], []]);
  gm.setQueueForTesting(128, 256);
  const r256Again = gm.shoot(2);
  assert.equal(r256Again.newMilestoneValue, null);

  // Merging to 512 triggers 512 milestone
  gm.setQueueForTesting(256, 4);
  const r512 = gm.shoot(2);
  assert.equal(r512.newMilestoneValue, 512);
});

// Test 17: Randomized fuzz stress test across 20 full games / 1500+ shots
test('Test 17: Randomized fuzz stress test verifies board invariants and zero deadlocks', () => {
  let totalShots = 0;
  let totalMerges = 0;

  for (let gameIdx = 0; gameIdx < 20; gameIdx++) {
    const gm = new GameManager({ seed: 1000 + gameIdx });
    const rng = NumberGenerator.createSeededRng(5000 + gameIdx);

    let safetyCounter = 0;
    while (gm.getState() !== GameState.GAME_OVER && safetyCounter < 400) {
      safetyCounter++;
      const validCols = [];
      for (let c = 0; c < 5; c++) {
        if (gm.canShootToColumn(c)) validCols.push(c);
      }

      if (validCols.length === 0) {
        assert.equal(gm.isSwapRecommended(), true);
        assert.equal(gm.swap(), true);
        continue;
      }

      const chosenCol = validCols[Math.floor(rng() * validCols.length)];
      const res = gm.shoot(chosenCol);
      assert.equal(res.ok, true);
      totalShots++;
      totalMerges += res.chainCount;

      const integrity = gm.board.validateIntegrity();
      assert.equal(integrity.valid, true, `Integrity error: ${integrity.errors.join('; ')}`);

      // Also verify no two adjacent same-value tiles remain unmerged on settled board
      for (let c = 0; c < 5; c++) {
        const col = gm.board.getColumn(c);
        for (let r = 0; r < col.length; r++) {
          const val = col[r].value;
          const neighbors = gm.board.getOrthogonalNeighbors({ col: c, row: r });
          for (const n of neighbors) {
            assert.notEqual(
              n.tile.value,
              val,
              `Unmerged adjacent tiles of value ${val} at (${c},${r}) and (${n.pos.col},${n.pos.row})`
            );
          }
        }
      }
    }

    // If ended by game over, verify operations are blocked
    if (gm.getState() === GameState.GAME_OVER) {
      assert.equal(gm.shoot(0).ok, false);
      assert.equal(gm.swap(), false);
    }
  }

  assert.ok(totalShots > 200, `Expected >200 fuzz shots, got ${totalShots}`);
  assert.ok(totalMerges > 100, `Expected >100 fuzz merges, got ${totalMerges}`);
});

let passed = 0;
for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log(`PASS: ${t.name}`);
  } catch (err) {
    console.error(`FAIL: ${t.name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log(`\nSummary: ${passed}/${tests.length} tests passed.`);
if (passed !== tests.length) {
  process.exit(1);
}
