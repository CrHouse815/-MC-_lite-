/**
 * MClite - 类型定义入口
 * 导出所有类型定义
 */

// MVU变量系统类型
export * from './mvu';

// 游戏相关类型
export * from './game';

// MClite v4 - 花名册类型（简化版）
export {
  DEFAULT_ROSTER,
  DEFAULT_SCHEMA,
  extractEntries,
  filterNonMetaKeys,
  getSchemaFields,
  isSpecialKey,
  isValidRoster,
  ROSTER_PATH,
  type Roster,
  type RosterEntry,
  type RosterMeta,
  type RosterSchema
} from './roster';

// MClite v4 - 文档类型（简化版）
export {
  convertLegacyToMultiDoc,
  DEFAULT_DOCUMENT_ENTRY,
  DEFAULT_DOCUMENTS,
  DOCUMENTS_PATH,
  flattenSections,
  getDocumentsSorted,
  getSectionsSorted,
  isLegacySingleDocument,
  type DocumentEntry,
  type DocumentsContainer, type Section as DocumentSection, type DocumentsMeta, type SectionsContainer,
  type SectionsMeta
} from './document';

// 数据库结构类型
export {
  ApplicantInfoGroup,
  ApplicationRecord,
  ApplicationRecords,
  CommonFieldGroup,
  CommonFieldGroupDefinitions,
  createEmptyDatabase,
  DATABASE_PATHS,
  DatabaseMeta,
  DBApprovalRecord,
  DBApprovalStatus,
  DepartmentList,
  DepartmentRecord,
  FormField,
  getApplicationList,
  getDepartmentList,
  getPersonnelList,
  MetaInfo,
  PersonnelRecord,
  SAMU7Database
} from './database';

// AI上下文类型
export * from './aiContext';

// 上下文管理系统类型
export * from './contextManager';

// 内容块差异化显示系统类型
export * from './contentBlock';

/**
 * AI消息类型
 */
export interface AIMessage {
  /** 消息ID */
  id: string;
  /** 消息内容 */
  content: string;
  /** 是否为用户消息 */
  isUser: boolean;
  /** 消息时间 */
  time: string;
  /** 多个回复选项（swipe功能） */
  swipes?: string[];
  /** 当前显示的swipe索引 */
  currentSwipeIndex?: number;
  /** 是否正在流式传输 */
  isStreaming?: boolean;
}

/**
 * 变量更新命令类型
 */
export interface VariableCommand {
  /** 命令类型 */
  type: 'SET' | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'APPEND' | 'REMOVE' | 'CLEAR' | 'TOGGLE' | 'INIT' | 'ASSIGN';
  /** 变量路径 */
  path: string;
  /** 变量值 */
  value?: any;
  /** 注释 */
  comment?: string;
  /** 父路径（ASSIGN 类型专用） */
  parentPath?: string;
  /** 键名（ASSIGN 类型专用） */
  key?: string;
}

/**
 * 命令执行结果类型
 */
export interface CommandExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 命令对象 */
  command: VariableCommand;
  /** 错误信息 */
  error?: string;
  /** 旧值 */
  oldValue?: any;
  /** 新值 */
  newValue?: any;
}

/**
 * 批量命令执行结果类型
 */
export interface BatchCommandResult {
  /** 整体是否成功 */
  success: boolean;
  /** 各命令执行结果 */
  results: CommandExecutionResult[];
  /** 错误信息 */
  error?: string;
}

/**
 * 应用状态类型
 */
export interface AppState {
  /** 是否全屏 */
  isFullscreen: boolean;
  /** 主题模式 */
  theme: 'dark' | 'light';
  /** 语言设置 */
  language: 'zh-CN' | 'en-US';
  /** 音量（0-1） */
  volume: number;
  /** 是否静音 */
  isMuted: boolean;
}

/**
 * 用户设置类型
 */
export interface UserSettings {
  /** 显示设置 */
  display: {
    /** 是否显示网格 */
    showGrid: boolean;
    /** 是否显示坐标 */
    showCoordinates: boolean;
    /** 缩放级别 */
    zoomLevel: number;
  };
  /** 游戏设置 */
  gameplay: {
    /** 自动保存间隔（秒） */
    autoSaveInterval: number;
    /** 是否启用自动保存 */
    autoSaveEnabled: boolean;
    /** 难度级别 */
    difficulty: 'easy' | 'normal' | 'hard';
  };
  /** 音频设置 */
  audio: {
    /** 主音量 */
    masterVolume: number;
    /** 音效音量 */
    sfxVolume: number;
    /** 音乐音量 */
    musicVolume: number;
  };
}
