import { GAME_CONFIG } from '../config/GameConfig.mjs';
export class NumberGenerator {
  spawnTable;
  rng;
  constructor(seed, spawnTable = GAME_CONFIG.spawnTable) {
    this.spawnTable = spawnTable.map((item) => ({ ...item }));
    this.rng = seed !== undefined ? NumberGenerator.createSeededRng(seed) : Math.random;
  }

  static createSeededRng(seed) {
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
   * 获取当前可生成的数字配置
   * @param biggestTile 棋盘上最大的数字
   * @param boardValues 棋盘上存在的所有不重复数字值
   */
  getEligibleConfigs(biggestTile, boardValues){
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
  generateNext(biggestTile, boardValues){
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
