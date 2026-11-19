export interface SpawnConfig {
  value: number;
  weight: number;
  unlockAtBiggest: number;
  retireAtBiggest?: number;
  enabled: boolean;
}

export interface TileStyle {
  bg: string;
  bgDark: string;
  text: string;
  glow?: string;
}

export const GAME_CONFIG = {
  board: {
    cols: 5,
    maxRows: 7,
    capacity: 35,
    initialValues: [2, 4, 8] as const,
    mergeMultiplier: 2,
    milestoneValue: 2048,
    celebrationMinValue: 256,
    maxSpawnValue: 256,
  },
  animation: {
    shootDurationMs: 220,
    mergeDurationMs: 200,
    gravityDurationMs: 160,
    chainStepPauseMs: 50,
    invalidShakeMs: 260,
    celebrationMs: 1700,
  },
  storageKeys: {
    bestScore: 'shooter2048_best_score',
    bestTile: 'shooter2048_best_tile',
    soundEnabled: 'shooter2048_sound_enabled',
    reducedMotion: 'shooter2048_reduced_motion',
    tutorialSeen: 'shooter2048_tutorial_seen',
    savedRun: 'shooter2048_saved_run',
  },
  spawnTable: [
    { value: 2, weight: 46, unlockAtBiggest: 0, retireAtBiggest: 256, enabled: true },
    { value: 4, weight: 34, unlockAtBiggest: 0, retireAtBiggest: 512, enabled: true },
    { value: 8, weight: 22, unlockAtBiggest: 0, retireAtBiggest: 1024, enabled: true },
    { value: 16, weight: 20, unlockAtBiggest: 64, retireAtBiggest: 2048, enabled: true },
    { value: 32, weight: 16, unlockAtBiggest: 128, enabled: true },
    { value: 64, weight: 12, unlockAtBiggest: 512, enabled: true },
    { value: 128, weight: 9, unlockAtBiggest: 1024, enabled: true },
    { value: 256, weight: 7, unlockAtBiggest: 2048, enabled: true },
  ] as SpawnConfig[],
} as const;

export const TILE_COLORS: Record<number, string> = {
  2: '#F5B700',
  4: '#FF8C42',
  8: '#FF5D8F',
  16: '#2EC4B6',
  32: '#4E89FF',
  64: '#9B5DE5',
  128: '#F15BB5',
  256: '#00BBF9',
  512: '#FB5607',
  1024: '#06D6A0',
  2048: '#E63946',
  4096: '#7209B7',
  8192: '#118AB2',
  16384: '#D90429',
  32768: '#3A86FF',
  65536: '#FF006E',
};

export function getTileStyle(value: number): TileStyle {
  const bg = TILE_COLORS[value] ?? '#334155';
  const text = '#FFFFFF';
  return {
    bg,
    bgDark: shadeHex(bg, -18),
    text,
    glow: value >= 2048 ? bg : undefined,
  };
}

function shadeHex(hex: string, percent: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + Math.round((255 * percent) / 100)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round((255 * percent) / 100)));
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round((255 * percent) / 100)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
