/**
 * MC房子 - MVU变量系统类型定义
 * 定义与酒馆MVU框架交互的类型
 */

/**
 * MVU数据结构
 */
export interface MvuData {
  /** 实际变量数据 */
  stat_data: Record<string, any>;
  /** 显示用的变量数据 */
  display_data: Record<string, any>;
  /** 最新变化的变量数据 */
  delta_data: Record<string, any>;
  /** 已初始化的世界书列表 */
  initialized_lorebooks: string[];
}

/**
 * 变量选项
 */
export interface VariableOption {
  /** 变量类型：message=聊天楼层, chat=聊天级别, character=角色卡, global=全局级别 */
  type?: 'message' | 'chat' | 'character' | 'global';
  /** 当 type 为 'message' 时，指定要获取的消息楼层号，'latest' 表示最新楼层 */
  message_id?: number | 'latest';
  /** 默认值 */
  default_value?: any;
  /** 变更原因 */
  reason?: string;
}

/**
 * 变量变化记录
 */
export interface VariableChange {
  /** 变量路径 */
  path: string;
  /** 旧值 */
  oldValue: any;
  /** 新值 */
  newValue: any;
  /** 变更时间 */
  timestamp: number;
  /** 变更原因 */
  reason?: string;
}

/**
 * 变量监听回调
 */
export type VariableWatchCallback = (oldValue: any, newValue: any) => void;

/**
 * MVU事件回调
 */
export interface MvuEventCallbacks {
  /** 更新开始回调 */
  onUpdateStarted?: (variables: Record<string, any>) => void;
  /** 更新结束回调 */
  onUpdateEnded?: (variables: Record<string, any>) => void;
  /** 变量更新回调 */
  onVariableUpdated?: (statData: Record<string, any>, path: string, oldValue: any, newValue: any) => void;
}

/**
 * MVU服务接口
 */
export interface IMvuService {
  /** 检查MVU是否可用 */
  isMvuAvailable(): boolean;
  /** 获取MVU数据 */
  getMvuData(options?: VariableOption, showDiff?: boolean): MvuData | null;
  /** 获取变量值 */
  getVariable(path: string, options?: VariableOption): any;
  /** 设置变量值 */
  setVariable(path: string, value: any, options?: VariableOption): Promise<boolean>;
  /** 批量设置变量 */
  setVariables(variables: Record<string, any>, options?: VariableOption): Promise<boolean>;
  /** 更新变量 */
  updateVariable(path: string, updater: (value: any) => any, options?: VariableOption): Promise<boolean>;
  /** 监听变量变化 */
  watchVariable(path: string, callback: VariableWatchCallback): () => void;
}
