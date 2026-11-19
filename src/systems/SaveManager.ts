import { GAME_CONFIG } from '../config/GameConfig';

export interface SavedRunState {
  columns: number[][];
  current: number;
  next: number;
  score: number;
  biggestTile: number;
  reached2048: boolean;
  mergeCount: number;
  maxChainCount: number;
}

export interface PersistentSettings {
  bestScore: number;
  bestTile: number;
  coins: number;
  claimedMilestones: number[];
  soundEnabled: boolean;
  reducedMotion: boolean;
  tutorialSeen: boolean;
}

export class SaveManager {
  private static readInt(key: string, fallback: number): number {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const val = parseInt(raw, 10);
      return Number.isFinite(val) && val >= 0 ? val : fallback;
    } catch {
      return fallback;
    }
  }

  private static readBool(key: string, fallback: boolean): boolean {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return raw === 'true';
    } catch {
      return fallback;
    }
  }

  private static readIntArray(key: string): number[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private static write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage quota/privacy mode errors
    }
  }

  public static load(): PersistentSettings {
    const keys = GAME_CONFIG.storageKeys;
    return {
      bestScore: SaveManager.readInt(keys.bestScore, 0),
      bestTile: SaveManager.readInt(keys.bestTile, 0),
      coins: SaveManager.readInt('shooter2048_coins', 0),
      claimedMilestones: SaveManager.readIntArray('shooter2048_claimed'),
      soundEnabled: SaveManager.readBool(keys.soundEnabled, true),
      reducedMotion: SaveManager.readBool(keys.reducedMotion, false),
      tutorialSeen: SaveManager.readBool(keys.tutorialSeen, false),
    };
  }

  public static saveBestScore(score: number): void {
    SaveManager.write(GAME_CONFIG.storageKeys.bestScore, String(Math.max(0, Math.floor(score))));
  }

  public static saveBestTile(tileValue: number): void {
    SaveManager.write(GAME_CONFIG.storageKeys.bestTile, String(Math.max(0, Math.floor(tileValue))));
  }

  public static saveCoins(coins: number): void {
    SaveManager.write('shooter2048_coins', String(Math.max(0, Math.floor(coins))));
  }

  public static saveClaimedMilestones(arr: number[]): void {
    SaveManager.write('shooter2048_claimed', JSON.stringify(arr));
  }

  public static saveSoundEnabled(enabled: boolean): void {
    SaveManager.write(GAME_CONFIG.storageKeys.soundEnabled, String(enabled));
  }

  public static saveReducedMotion(enabled: boolean): void {
    SaveManager.write(GAME_CONFIG.storageKeys.reducedMotion, String(enabled));
  }

  public static saveTutorialSeen(seen: boolean): void {
    SaveManager.write(GAME_CONFIG.storageKeys.tutorialSeen, String(seen));
  }

  public static saveRunState(run: SavedRunState): void {
    SaveManager.write(GAME_CONFIG.storageKeys.savedRun, JSON.stringify(run));
  }

  public static loadRunState(): SavedRunState | null {
    try {
      const raw = localStorage.getItem(GAME_CONFIG.storageKeys.savedRun);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SavedRunState;
      if (!Array.isArray(parsed.columns) || parsed.columns.length !== GAME_CONFIG.board.cols) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  public static clearRunState(): void {
    try {
      localStorage.removeItem(GAME_CONFIG.storageKeys.savedRun);
    } catch {
      // Ignore
    }
  }
}
