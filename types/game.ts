/**
 * MC房子 - 游戏相关类型定义
 * 定义游戏状态、实体、物品等类型
 */

/**
 * 游戏状态
 */
export interface GameState {
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 当前场景ID */
  currentScene?: string;
  /** 游戏是否暂停 */
  isPaused: boolean;
  /** 游戏时间（游戏内时间） */
  gameTime: GameTime;
  /** 游戏数据 */
  gameData: Record<string, any>;
}

/**
 * 游戏时间
 */
export interface GameTime {
  /** 天数 */
  day: number;
  /** 小时（0-23） */
  hour: number;
  /** 分钟（0-59） */
  minute: number;
  /** 时间流逝速度倍率 */
  timeScale: number;
}

/**
 * 坐标位置
 */
export interface Position {
  /** X坐标 */
  x: number;
  /** Y坐标 */
  y: number;
  /** Z坐标（可选，用于3D或层级） */
  z?: number;
}

/**
 * 方向枚举
 */
export type Direction = 'north' | 'south' | 'east' | 'west' | 'up' | 'down';

/**
 * 玩家数据
 */
export interface PlayerData {
  /** 玩家ID */
  id: string;
  /** 玩家名称 */
  name: string;
  /** 当前位置 */
  position: Position;
  /** 面朝方向 */
  facing: Direction;
  /** 生命值 */
  health: number;
  /** 最大生命值 */
  maxHealth: number;
  /** 饥饿值 */
  hunger: number;
  /** 最大饥饿值 */
  maxHunger: number;
  /** 经验值 */
  experience: number;
  /** 等级 */
  level: number;
  /** 背包 */
  inventory: Inventory;
  /** 装备栏 */
  equipment: Equipment;
  /** 属性 */
  attributes: PlayerAttributes;
}

/**
 * 玩家属性
 */
export interface PlayerAttributes {
  /** 力量 */
  strength: number;
  /** 敏捷 */
  agility: number;
  /** 耐力 */
  endurance: number;
  /** 智力 */
  intelligence: number;
  /** 幸运 */
  luck: number;
}

/**
 * 物品
 */
export interface Item {
  /** 物品ID */
  id: string;
  /** 物品名称 */
  name: string;
  /** 物品描述 */
  description: string;
  /** 物品类型 */
  type: ItemType;
  /** 稀有度 */
  rarity: ItemRarity;
  /** 堆叠数量 */
  stackSize: number;
  /** 最大堆叠数量 */
  maxStackSize: number;
  /** 物品图标 */
  icon?: string;
  /** 物品属性 */
  properties?: Record<string, any>;
}

/**
 * 物品类型
 */
export type ItemType =
  | 'block' // 方块
  | 'tool' // 工具
  | 'weapon' // 武器
  | 'armor' // 护甲
  | 'food' // 食物
  | 'material' // 材料
  | 'misc'; // 杂项

/**
 * 物品稀有度
 */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * 背包
 */
export interface Inventory {
  /** 背包槽位 */
  slots: (InventorySlot | null)[];
  /** 背包容量 */
  capacity: number;
}

/**
 * 背包槽位
 */
export interface InventorySlot {
  /** 物品 */
  item: Item;
  /** 数量 */
  quantity: number;
}

/**
 * 装备栏
 */
export interface Equipment {
  /** 头盔 */
  head: Item | null;
  /** 胸甲 */
  chest: Item | null;
  /** 护腿 */
  legs: Item | null;
  /** 靴子 */
  feet: Item | null;
  /** 主手 */
  mainHand: Item | null;
  /** 副手 */
  offHand: Item | null;
}

/**
 * 方块
 */
export interface Block {
  /** 方块ID */
  id: string;
  /** 方块名称 */
  name: string;
  /** 方块类型 */
  type: BlockType;
  /** 硬度 */
  hardness: number;
  /** 是否可破坏 */
  breakable: boolean;
  /** 是否可通过 */
  passable: boolean;
  /** 方块图标/纹理 */
  texture?: string;
}

/**
 * 方块类型
 */
export type BlockType =
  | 'solid' // 实体方块
  | 'fluid' // 流体
  | 'plant' // 植物
  | 'decoration' // 装饰
  | 'interactive'; // 可交互

/**
 * 世界区块
 */
export interface Chunk {
  /** 区块坐标 */
  position: Position;
  /** 区块大小 */
  size: number;
  /** 方块数据 */
  blocks: (Block | null)[][][];
  /** 是否已加载 */
  isLoaded: boolean;
}

/**
 * NPC/实体
 */
export interface Entity {
  /** 实体ID */
  id: string;
  /** 实体名称 */
  name: string;
  /** 实体类型 */
  type: EntityType;
  /** 位置 */
  position: Position;
  /** 生命值 */
  health: number;
  /** 最大生命值 */
  maxHealth: number;
  /** 是否敌对 */
  hostile: boolean;
  /** 对话内容（NPC） */
  dialogue?: string[];
  /** AI行为 */
  behavior?: EntityBehavior;
}

/**
 * 实体类型
 */
export type EntityType = 'npc' | 'monster' | 'animal' | 'merchant' | 'boss';

/**
 * 实体行为
 */
export interface EntityBehavior {
  /** 空闲行为 */
  idle: string;
  /** 移动模式 */
  movement: 'static' | 'wander' | 'patrol' | 'follow';
  /** 攻击模式 */
  attack?: 'melee' | 'ranged' | 'magic';
  /** 巡逻路径（如果有） */
  patrolPath?: Position[];
}

/**
 * 任务
 */
export interface Quest {
  /** 任务ID */
  id: string;
  /** 任务名称 */
  name: string;
  /** 任务描述 */
  description: string;
  /** 任务类型 */
  type: QuestType;
  /** 任务状态 */
  status: QuestStatus;
  /** 任务目标 */
  objectives: QuestObjective[];
  /** 任务奖励 */
  rewards: QuestReward[];
  /** 前置任务 */
  prerequisites?: string[];
}

/**
 * 任务类型
 */
export type QuestType = 'main' | 'side' | 'daily' | 'achievement';

/**
 * 任务状态
 */
export type QuestStatus = 'locked' | 'available' | 'active' | 'completed' | 'failed';

/**
 * 任务目标
 */
export interface QuestObjective {
  /** 目标ID */
  id: string;
  /** 目标描述 */
  description: string;
  /** 目标类型 */
  type: 'collect' | 'kill' | 'talk' | 'explore' | 'craft';
  /** 目标物/目标ID */
  targetId: string;
  /** 当前进度 */
  current: number;
  /** 需要数量 */
  required: number;
  /** 是否完成 */
  completed: boolean;
}

/**
 * 任务奖励
 */
export interface QuestReward {
  /** 奖励类型 */
  type: 'item' | 'experience' | 'gold' | 'reputation';
  /** 奖励ID（物品ID等） */
  id?: string;
  /** 奖励数量 */
  amount: number;
}

/**
 * 配方
 */
export interface Recipe {
  /** 配方ID */
  id: string;
  /** 配方名称 */
  name: string;
  /** 输出物品 */
  output: {
    item: Item;
    quantity: number;
  };
  /** 输入材料 */
  inputs: {
    item: Item;
    quantity: number;
  }[];
  /** 制作类型 */
  craftingType: 'hand' | 'workbench' | 'furnace' | 'anvil';
  /** 制作时间（秒） */
  craftingTime: number;
}

/**
 * 游戏事件
 */
export interface GameEvent {
  /** 事件ID */
  id: string;
  /** 事件类型 */
  type: string;
  /** 事件数据 */
  data: Record<string, any>;
  /** 事件时间戳 */
  timestamp: number;
}

/**
 * 存档数据
 */
export interface SaveData {
  /** 存档ID */
  id: string;
  /** 存档名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 游戏时间 */
  gameTime: GameTime;
  /** 玩家数据 */
  player: PlayerData;
  /** 游戏数据 */
  gameData: Record<string, any>;
  /** 版本号 */
  version: string;
}
