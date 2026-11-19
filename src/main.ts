import { GameManager } from './core/GameManager';
import { GameState } from './core/GameState';
import { InputManager } from './input/InputManager';
import { AnimationManager } from './renderer/AnimationManager';
import { GameRenderer } from './renderer/GameRenderer';
import { AudioManager } from './systems/AudioManager';
import { SaveManager } from './systems/SaveManager';
import { GameUI } from './ui/GameUI';
import { MergeSystem } from './core/MergeSystem';

const MILESTONE_REWARDS: Record<number, number> = {
  256: 10, 512: 20, 1024: 40, 2048: 80,
  4096: 160, 8192: 320, 16384: 640, 32768: 1280, 65536: 2560,
};

const TILE_SWAP_COST = 100;

function bootstrap(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Missing #game-canvas element');
  }

  const saved = SaveManager.load();
  let soundEnabled = saved.soundEnabled;
  let reducedMotion = saved.reducedMotion;
  let tutorialStep = saved.tutorialSeen ? 0 : 1;
  let coins = saved.coins;
  let claimedMilestones = new Set(saved.claimedMilestones);
  let firstSelectedPos: { col: number; row: number } | null = null;

  const audio = new AudioManager(soundEnabled);
  const animations = new AnimationManager(audio);
  animations.setReducedMotion(reducedMotion);

  const gameManager = new GameManager({
    initialBestScore: saved.bestScore,
    initialBestTile: saved.bestTile,
  });

  const setupTutorialBoard = () => {
    animations.reset();
    gameManager.reset();
    gameManager.board.loadColumns([[], [], [2], [], []]);
    gameManager.setQueueForTesting(2, 4);
    tutorialStep = 1;
    renderer.setTutorialCol(2);
    ui.sync(gameManager, soundEnabled, tutorialStep, coins);
  };

  const finishTutorial = () => {
    tutorialStep = 0;
    renderer.setTutorialCol(-1);
    SaveManager.saveTutorialSeen(true);
    ui.sync(gameManager, soundEnabled, tutorialStep, coins);
  };

  const persistRun = () => {
    if (gameManager.getState() === GameState.GAME_OVER) {
      SaveManager.clearRunState();
    } else {
      SaveManager.saveRunState(gameManager.exportRunState());
    }
  };

  const renderer = new GameRenderer(canvas, gameManager, animations);

  const ui = new GameUI({
    onSwap: () => {
      if (gameManager.swap()) {
        audio.playSwap();
        if (tutorialStep === 2) {
          finishTutorial();
        } else {
          ui.sync(gameManager, soundEnabled, tutorialStep, coins);
        }
        persistRun();
        renderer.renderOnce();
      }
    },
    onRestart: () => {
      animations.reset();
      gameManager.reset();
      SaveManager.clearRunState();
      tutorialStep = 0;
      firstSelectedPos = null;
      renderer.setTutorialCol(-1);
      ui.sync(gameManager, soundEnabled, tutorialStep, coins);
      renderer.renderOnce();
    },
    onToggleSound: () => {
      soundEnabled = !soundEnabled;
      audio.setEnabled(soundEnabled);
      SaveManager.saveSoundEnabled(soundEnabled);
      ui.sync(gameManager, soundEnabled, tutorialStep, coins);
    },
    onSkipTutorial: () => {
      finishTutorial();
    },
    onClaimMilestone: () => {
      // Claim is handled by the separate click handler below
    },
    onCloseMilestone: () => {
      ui.hideMilestone();
    },
    onTileSwap: () => {
      if (gameManager.getState() !== GameState.READY) {
        ui.showFeedback('当前状态无法互换');
        return;
      }
      if (coins < TILE_SWAP_COST) {
        ui.showFeedback(`金币不足，需要${TILE_SWAP_COST}金币`);
        return;
      }
      firstSelectedPos = null;
      inputManager.setTileSwapMode(true);
      ui.showFeedback('请点击第一个数字');
    },
  });

  const inputManager = new InputManager(canvas, renderer, {
    onSelectColumn: (col) => {
      renderer.setHoveredCol(col);
    },
    onAimStateChange: (aiming) => {
      renderer.setAiming(aiming);
    },
    onShootColumn: (col) => {
      if (gameManager.getState() !== GameState.READY || animations.isAnimating()) {
        return;
      }

      if (tutorialStep === 1 && col !== 2) {
        ui.showFeedback('请按住滑到中间高亮列再松手，试试合成 4！');
        return;
      }

      const boardBefore = gameManager.getBoardSnapshot();
      const result = gameManager.shoot(col, true);

      if (!result.ok) {
        if (result.reason === 'COLUMN_FULL') {
          audio.playInvalid();
          animations.triggerInvalidShake(col);
          renderer.ensureAnimating();
          ui.showFeedback('该列已满！请匹配最底部数字或换一列');
        }
        return;
      }

      audio.playShoot();

      const snap = gameManager.getScoreSnapshot();
      SaveManager.saveBestScore(snap.bestScore);
      SaveManager.saveBestTile(snap.allTimeBiggestTile);
      persistRun();

      if (tutorialStep === 1) {
        renderer.setTutorialCol(-1);
      }

      ui.sync(gameManager, soundEnabled, tutorialStep, coins);

      animations.startShotTimeline(boardBefore, result, () => {
        gameManager.finishAnimation();
        if (result.newMilestoneValue !== null) {
          audio.playMilestone(result.newMilestoneValue);
          if (!claimedMilestones.has(result.newMilestoneValue)) {
            ui.showMilestone(result.newMilestoneValue);
          }
        }
        if (gameManager.getState() === GameState.GAME_OVER) {
          audio.playGameOver();
        }
        if (tutorialStep === 1) {
          tutorialStep = 2;
        } else if (tutorialStep === 2) {
          finishTutorial();
        }
        ui.sync(gameManager, soundEnabled, tutorialStep, coins);
        renderer.renderOnce();
      });

      renderer.ensureAnimating();
    },
    onSwap: () => {
      if (gameManager.swap()) {
        audio.playSwap();
        if (tutorialStep === 2) {
          finishTutorial();
        } else {
          ui.sync(gameManager, soundEnabled, tutorialStep, coins);
        }
        persistRun();
        renderer.renderOnce();
      }
    },
    onTileSwapClick: (col, row) => {
      handleTileSwapClick(col, row);
    },
  });

  // 处理数字互换点击 - 支持点击任意位置
  const handleTileSwapClick = (col: number, row: number) => {
    const board = gameManager.board;

    // 检查该位置是否有数字
    const tile = board.getTileAt({ col, row });
    if (!tile) {
      ui.showFeedback('请点击有数字的位置');
      return;
    }

    const pos = { col, row };

    if (!firstSelectedPos) {
      // 第一次选择
      firstSelectedPos = pos;
      ui.showFeedback(`已选择 ${tile.value}，请点击第二个数字`);
      renderer.renderOnce();
    } else {
      // 第二次选择，执行互换
      if (firstSelectedPos.col === col && firstSelectedPos.row === row) {
        ui.showFeedback('不能互换同一个数字');
        return;
      }

      const tile1 = board.getTileAt(firstSelectedPos);
      if (!tile1) {
        ui.showFeedback('选择无效');
        firstSelectedPos = null;
        inputManager.setTileSwapMode(false);
        return;
      }

      // 执行互换
      const success = board.swapTiles(firstSelectedPos, pos);
      if (success) {
        const pos1 = { ...firstSelectedPos };
        const pos2 = { ...pos };

        // 扣除金币
        coins -= TILE_SWAP_COST;
        SaveManager.saveCoins(coins);

        // 播放音效
        audio.playSwap();

        // 退出互换模式
        firstSelectedPos = null;
        inputManager.setTileSwapMode(false);

        // 互换后检测并触发合并
        resolveSwapMerges(pos1, pos2);

        ui.showFeedback(`互换成功！消耗${TILE_SWAP_COST}金币`);
        ui.sync(gameManager, soundEnabled, tutorialStep, coins);
        persistRun();
        renderer.renderOnce();
      } else {
        ui.showFeedback('互换失败');
        firstSelectedPos = null;
        inputManager.setTileSwapMode(false);
      }
    }
  };

  // 互换后检测并触发合并
  const resolveSwapMerges = (pos1: { col: number; row: number }, pos2: { col: number; row: number }) => {
    const board = gameManager.board;
    const positions = [pos1, pos2];
    let totalScore = 0;
    let chainCount = 0;
    let milestoneValue: number | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      let merged = false;
      for (const pos of positions) {
        const group = MergeSystem.findMergeGroup(board, pos);
        if (!group) continue;

        merged = true;
        chainCount++;
        const scoreGain = group.newValue;
        totalScore += scoreGain;

        // 创建新的合并后的数字
        const mergedTile = board.createTile(group.newValue);
        board.replaceTileAt(group.targetPos, mergedTile);

        // 收集需要移除的 tile IDs
        const idsToRemove = new Set<number>();
        for (const c of group.consumed) {
          if (c.pos.col === group.targetPos.col && c.pos.row === group.targetPos.row) continue;
          idsToRemove.add(c.tile.id);
        }

        // 移除被消费的 tile 并压缩
        board.removeTilesByIdsAndCompact(idsToRemove);

        // 更新分数 - 使用 scoreManager 的正确 API
        const biggestOnBoard = board.getBiggestTileValue();
        const result = gameManager.scoreManager.recordResolution(scoreGain, 1, biggestOnBoard);
        if (result.newMilestoneValue !== null) {
          milestoneValue = result.newMilestoneValue;
        }

        // 更新检测位置（合并后位置可能变化）
        const newTargetPos = board.findTilePositionById(mergedTile.id);
        if (newTargetPos) {
          pos.col = newTargetPos.col;
          pos.row = newTargetPos.row;
        }

        // 浮动文本
        animations.floatingTexts.push({
          text: '+' + scoreGain + (chainCount > 1 ? ` CHAIN x${chainCount}!` : ''),
          pos: { ...group.targetPos },
          color: '#FBBF24',
          elapsedMs: 0,
          durationMs: 750,
        });
        audio.playMerge(chainCount);
        break; // 重新检测
      }
      if (!merged) break;
    }

    if (totalScore > 0) {
      const snap = gameManager.getScoreSnapshot();
      SaveManager.saveBestScore(snap.bestScore);
      SaveManager.saveBestTile(snap.allTimeBiggestTile);
      renderer.ensureAnimating();

      if (milestoneValue !== null) {
        if (!claimedMilestones.has(milestoneValue)) {
          ui.showMilestone(milestoneValue);
        }
        audio.playMilestone(milestoneValue);
      }
    }
  };

  // Override claim button to add coins
  document.getElementById('btn-claim-milestone')!.addEventListener('click', () => {
    const milestoneValue = parseInt((document.getElementById('milestone-current') as HTMLElement).textContent || '0');
    const reward = MILESTONE_REWARDS[milestoneValue] || 50;
    coins += reward;
    claimedMilestones.add(milestoneValue);
    SaveManager.saveCoins(coins);
    SaveManager.saveClaimedMilestones([...claimedMilestones]);
    ui.hideMilestone();
    ui.sync(gameManager, soundEnabled, tutorialStep, coins);
  });

  window.addEventListener('resize', () => renderer.resize());
  const savedRun = SaveManager.loadRunState();
  if (savedRun && saved.tutorialSeen) {
    gameManager.restoreRunState(savedRun);
    if (gameManager.getState() === GameState.GAME_OVER) {
      SaveManager.clearRunState();
      gameManager.reset();
    }
    ui.sync(gameManager, soundEnabled, tutorialStep, coins);
    renderer.renderOnce();
  } else if (tutorialStep === 1) {
    setupTutorialBoard();
  } else {
    ui.sync(gameManager, soundEnabled, tutorialStep, coins);
    renderer.renderOnce();
  }
}

bootstrap();
