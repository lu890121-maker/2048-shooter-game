import { GAME_CONFIG, SpawnConfig } from '../config/GameConfig';

export class NumberGenerator {
  private readonly spawnTable: SpawnConfig[];
  private rng: () => number;
  private mergedValues: Set<number> = new Set(); // 追踪已合成的数字

  constructor(seed?: number, spawnTable: readonly SpawnConfig[] = GAME_CONFIG.spawnTable) {
    this.spawnTable = spawnTable.map((item) => ({ ...item }));
    this.rng = seed !== undefined ? NumberGenerator.createSeededRng(seed) : Math.random;
  }

  public static createSeededRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * 记录已合成的数字
   * @param value 合成的数字值
   */
  public recordMerge(value: number): void {
    this.mergedValues.add(value);
  }

  /**
   * 重置已合成数字的记录
   */
  public resetMergedValues(): void {
    this.mergedValues.clear();
  }

  /**
   * 获取当前可生成的数字配置
   * @param biggestTile 棋盘上最大的数字
   * @param boardValues 棋盘上存在的所有不重复数字值
   */
  public getEligibleConfigs(biggestTile: number, boardValues: Set<number>): SpawnConfig[] {
    const eligible = this.spawnTable.filter((cfg) => {
      if (!cfg.enabled || cfg.weight <= 0) return false;
      if (biggestTile < cfg.unlockAtBiggest) return false;
      
      // 动态淘汰机制：如果达到淘汰阈值，检查棋盘上是否还有该数字
      if (cfg.retireAtBiggest !== undefined && biggestTile >= cfg.retireAtBiggest) {
        // 如果棋盘上还有该数字，继续允许生成
        if (boardValues.has(cfg.value)) {
          return true;
        }
        // 棋盘上没有该数字了，淘汰它
        return false;
      }

      // 动态淘汰：合成到V就淘汰V/128
      
      if (cfg.value > GAME_CONFIG.board.maxSpawnValue) return false;
      return true;
    });

    if (eligible.length === 0) {
      return this.spawnTable.filter((cfg) => cfg.enabled && cfg.unlockAtBiggest === 0);
    }
    return eligible;
  }

  /**
   * 生成下一个数字
   * @param biggestTile 棋盘上最大的数字
   * @param boardValues 棋盘上存在的所有不重复数字值
   */
  public generateNext(biggestTile: number, boardValues: Set<number>): number {
    const eligible = this.getEligibleConfigs(biggestTile, boardValues);
    const totalWeight = eligible.reduce((sum, cfg) => sum + cfg.weight, 0);
    let roll = this.rng() * totalWeight;

    for (const cfg of eligible) {
      roll -= cfg.weight;
      if (roll <= 0) {
        return cfg.value;
      }
    }
    return eligible[eligible.length - 1].value;
  }
}
