import { calculateBaseCombatPower, evaluateCombatPower, parseRealmToLevel } from '../schema';

// ==================== 共享类型定义 ====================

export interface CombatState {
  正在战斗?: boolean;
  当前状态?: string;
  灵力值?: number;
  伤势等级?: string;
  已用底牌?: string[];
  战斗回合?: number;
}

export interface EnemyInfo {
  名称: string;
  境界: string;
  战力评估: string;
  状态: string;
  特点?: string;
}

export interface TribulationState {
  正在渡劫?: boolean;
  劫种?: string;
  劫难等级?: string;
  当前阶段?: number;
  总阶段数?: number;
  劫力承受?: number;
  劫难描述?: string;
  触发原因?: string;
  已用护道?: string[];
  上次渡劫结果?: string;
  渡劫冷却?: number;
  失败惩罚记录?: string;
}

// ==================== 共享工具函数 ====================

/** 伤势图标映射 */
export const getInjuryIcon = (injury: string) => {
  const icons: Record<string, string> = {
    '无伤': 'fa-solid fa-heart',
    '轻伤': 'fa-solid fa-bandage',
    '重伤': 'fa-solid fa-heart-crack',
    '濒死': 'fa-solid fa-skull',
  };
  return icons[injury] || 'fa-solid fa-heart';
};

/** 灵力值渐变色 */
export const getSpiritGradient = (value: number) => {
  if (value > 50) {
    return 'linear-gradient(90deg, #4a9eff 0%, #66bbff 100%)';
  } else if (value > 20) {
    return 'linear-gradient(90deg, #ffaa00 0%, #ffcc44 100%)';
  } else {
    return 'linear-gradient(90deg, #ff4444 0%, #ff6666 100%)';
  }
};

/** 威胁等级映射 */
export const getThreatLevel = (power: string) => {
  const levels: Record<string, string> = {
    '碾压': 'safe',
    '优势': 'easy',
    '势均力敌': 'equal',
    '劣势': 'hard',
    '绝望': 'deadly',
  };
  return levels[power] || 'equal';
};

/** 敌人生命状态图标 */
export const getEnemyHealthIcon = (status: string) => {
  const icons: Record<string, string> = {
    '完好': 'fa-solid fa-shield',
    '轻伤': 'fa-solid fa-shield-halved',
    '重伤': 'fa-solid fa-heart-crack',
    '濒死': 'fa-solid fa-skull',
    '已死': 'fa-solid fa-skull-crossbones',
  };
  return icons[status] || 'fa-solid fa-shield';
};

/** 根据主角战力值计算敌人的战力评估 */
export const getCalculatedPowerEval = (enemy: { 境界: string; 战力评估: string }, playerCombatPower?: number) => {
  if (!playerCombatPower) {
    return enemy.战力评估;
  }
  const enemyLevel = parseRealmToLevel(enemy.境界);
  const enemyPower = calculateBaseCombatPower(enemyLevel);
  if (enemyPower === 0) {
    return enemy.战力评估;
  }
  return evaluateCombatPower(playerCombatPower, enemyPower);
};

/** 计算敌人的战力数值 */
export const getEnemyPowerValue = (enemy: { 境界: string }) => {
  const enemyLevel = parseRealmToLevel(enemy.境界);
  return calculateBaseCombatPower(enemyLevel);
};

/** 劫种颜色映射 */
export const getTribulationTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    '无': '#888888',
    '雷劫': '#8844ff',
    '心劫': '#ff44aa',
    '天劫': '#ffdd00',
    '情劫': '#ff6b9d',
    '因果劫': '#44aaff',
    '红尘劫': '#ff8844',
    '轮回劫': '#44ffaa',
  };
  return colors[type] || '#888888';
};

/** 劫难等级颜色映射 */
export const getTribulationLevelColor = (level: string) => {
  const colors: Record<string, string> = {
    '无': '#888888',
    '小劫': '#44aa44',
    '中劫': '#ffcc00',
    '大劫': '#ff8800',
    '天罚': '#ff0000',
  };
  return colors[level] || '#888888';
};
