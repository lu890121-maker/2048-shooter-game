import { getTileStyle } from '../config/GameConfig';
import { GameManager } from '../core/GameManager';
import { GameState } from '../core/GameState';

export interface UIActions {
  onSwap: () => void;
  onRestart: () => void;
  onToggleSound: () => void;
  onSkipTutorial: () => void;
  onClaimMilestone: () => void;
  onCloseMilestone: () => void;
  onTileSwap: () => void;
}

const MILESTONE_REWARDS: Record<number, number> = {
  256: 10, 512: 20, 1024: 40, 2048: 80,
  4096: 160, 8192: 320, 16384: 640, 32768: 1280, 65536: 2560,
};

export class GameUI {
  private scoreEl = document.getElementById('hud-score')!;
  private bestEl = document.getElementById('hud-best')!;
  private biggestEl = document.getElementById('hud-biggest')!;
  private coinsEl = document.getElementById('hud-coins')!;

  private currentTileEl = document.getElementById('launcher-current')!;
  private nextTileEl = document.getElementById('launcher-next')!;
  private currentSlotEl = document.getElementById('current-slot')!;
  private swapBtnEl = document.getElementById('btn-swap') as HTMLButtonElement;
  private swapHintEl = document.getElementById('swap-hint')!;
  private feedbackEl = document.getElementById('feedback-toast')!;

  private soundBtnEl = document.getElementById('btn-sound') as HTMLButtonElement;
  private tileSwapBtnEl = document.getElementById('btn-tile-swap') as HTMLButtonElement;
  private restartBtnEl = document.getElementById('btn-restart') as HTMLButtonElement;
  private skipTutBtnEl = document.getElementById('btn-skip-tutorial') as HTMLButtonElement;

  private gameOverModalEl = document.getElementById('gameover-modal')!;
  private finalScoreEl = document.getElementById('go-score')!;
  private finalBestEl = document.getElementById('go-best')!;
  private finalBiggestEl = document.getElementById('go-biggest')!;
  private finalStatsEl = document.getElementById('go-stats')!;
  private playAgainBtnEl = document.getElementById('btn-play-again') as HTMLButtonElement;

  private milestoneModalEl = document.getElementById('milestone-modal')!;
  private milestonePrevEl = document.getElementById('milestone-prev')!;
  private milestoneCurrentEl = document.getElementById('milestone-current')!;
  private milestoneNextEl = document.getElementById('milestone-next')!;
  private milestoneRewardEl = document.getElementById('milestone-reward-amount')!;
  private claimBtnEl = document.getElementById('btn-claim-milestone') as HTMLButtonElement;
  private closeMilestoneBtnEl = document.getElementById('btn-close-milestone') as HTMLButtonElement;

  private toastTimer: number | null = null;
  private tileSwapMode = false;

  constructor(private readonly actions: UIActions) {
    this.swapBtnEl.addEventListener('click', () => this.actions.onSwap());
    this.restartBtnEl.addEventListener('click', () => this.actions.onRestart());
    this.playAgainBtnEl.addEventListener('click', () => this.actions.onRestart());
    this.soundBtnEl.addEventListener('click', () => this.actions.onToggleSound());
    this.tileSwapBtnEl.addEventListener('click', () => this.actions.onTileSwap());
    this.skipTutBtnEl.addEventListener('click', () => this.actions.onSkipTutorial());
    this.claimBtnEl.addEventListener('click', () => this.actions.onClaimMilestone());
    this.closeMilestoneBtnEl.addEventListener('click', () => this.actions.onCloseMilestone());
  }

  public setTileSwapMode(enabled: boolean): void {
    this.tileSwapMode = enabled;
    this.updateTileSwapButton();
  }

  private updateTileSwapButton(): void {
    if (this.tileSwapMode) {
      this.tileSwapBtnEl.textContent = '✕ 取消';
      this.tileSwapBtnEl.style.backgroundColor = '#EF4444';
    } else {
      const coins = parseInt(this.coinsEl.textContent?.replace(/,/g, '') || '0');
      this.tileSwapBtnEl.textContent = coins >= 100 ? '🔀 互换' : '🔀 互换(100)';
      this.tileSwapBtnEl.style.backgroundColor = '';
    }
  }

  public sync(
    gm: GameManager,
    soundEnabled: boolean,
    tutorialStep = 0,
    coins = 0
  ): void {
    const snap = gm.getScoreSnapshot();
    this.scoreEl.textContent = snap.score.toLocaleString();
    this.bestEl.textContent = snap.bestScore.toLocaleString();
    this.biggestEl.textContent = snap.biggestTile > 0 ? String(snap.biggestTile) : '—';
    this.coinsEl.textContent = coins.toLocaleString();

    this.applyTileBadge(this.currentTileEl, gm.getCurrentNumber());
    this.applyTileBadge(this.nextTileEl, gm.getNextNumber());

    const isGameOver = gm.getState() === GameState.GAME_OVER;
    const isReady = gm.getState() === GameState.READY;
    this.swapBtnEl.disabled = !isReady;

    const swapRec = gm.isSwapRecommended();
    this.swapHintEl.classList.toggle('visible', swapRec);
    this.swapBtnEl.classList.toggle('pulse-hint', swapRec);

    this.soundBtnEl.textContent = soundEnabled ? '🔊 音效' : '🔇 静音';
    this.soundBtnEl.setAttribute('aria-pressed', String(soundEnabled));

    // 更新互换按钮状态
    if (!this.tileSwapMode) {
      this.tileSwapBtnEl.disabled = !isReady || coins < 100;
      this.updateTileSwapButton();
    }

    this.skipTutBtnEl.classList.toggle('visible', tutorialStep > 0);
    this.currentSlotEl.classList.toggle('tut-highlight', tutorialStep === 2);

    if (isGameOver) {
      this.finalScoreEl.textContent = snap.score.toLocaleString();
      this.finalBestEl.textContent = snap.bestScore.toLocaleString();
      this.finalBiggestEl.textContent = String(snap.biggestTile);
      this.finalStatsEl.textContent = `合成次数: ${snap.mergeCount} · 最高连击: ${snap.maxChainCount}x`;
      this.gameOverModalEl.classList.add('open');
    } else {
      this.gameOverModalEl.classList.remove('open');
    }
  }

  public showMilestone(value: number): void {
    const milestones = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];
    const idx = milestones.indexOf(value);
    const prevValue = idx > 0 ? milestones[idx - 1] : 128;
    const nextValue = idx < milestones.length - 1 ? milestones[idx + 1] : value * 2;
    const reward = MILESTONE_REWARDS[value] || 50;

    this.applyTileBadge(this.milestonePrevEl, prevValue);
    this.applyTileBadge(this.milestoneCurrentEl, value);
    this.applyTileBadge(this.milestoneNextEl, nextValue);
    this.milestoneRewardEl.textContent = `+${reward}`;

    this.milestoneModalEl.classList.add('open');
  }

  public hideMilestone(): void {
    this.milestoneModalEl.classList.remove('open');
  }

  private applyTileBadge(el: HTMLElement, value: number): void {
    const style = getTileStyle(value);
    el.textContent = String(value);
    el.style.backgroundColor = style.bg;
    el.style.borderBottomColor = style.bgDark;
    el.style.color = '#FFFFFF';
    const len = String(value).length;
    el.style.fontSize = len <= 2 ? '1.35rem' : len === 3 ? '1.1rem' : '0.92rem';
  }

  public showFeedback(message: string): void {
    this.feedbackEl.textContent = message;
    this.feedbackEl.classList.add('visible');
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.feedbackEl.classList.remove('visible');
    }, 1500);
  }
}
