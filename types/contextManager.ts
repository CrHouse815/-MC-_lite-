/**
 * MC房子 - 上下文管理系统类型定义
 * 基于归墟Plus的设计，实现分段正文与总结系统
 */

/**
 * 历史记录条目的字段结构
 * 由AI生成，包含完整的事件信息
 */
export interface HistoryRecordEntry {
  /** 序号（唯一且不重复） */
  序号: number;
  /** 日期时间，格式：YYYY年MM月DD日 HH:MM */
  日期: string;
  /** 当前场景 */
  地点: string;
  /** 70字内精炼叙述本次事件 */
  描述: string;
  /** 标签列表 */
  标签: string[];
  /** 300字以内详细记录本次事件 */
  重要信息: string;
  /** 自动化系统内容 */
  自动化系统: string;
  /** 原始文本（用于存储） */
  _raw?: string;
}

/**
 * 历史正文条目
 * 存储AI回复中的<gametxt>内容
 */
export interface HistoryTextEntry {
  /** 序号（与历史记录对应） */
  序号: number;
  /** 完整的正文内容 */
  内容: string;
}

/**
 * 分段配置
 */
export interface SegmentConfig {
  /** 分段正文数量 N（最近N条完整正文）, 0表示不使用分段正文 */
  segmentCount: number;
  /** 小总结范围 M（从分段正文之后计算M条历史记录）, 0表示不使用小总结 */
  smallSummaryCount: number;
}

/**
 * 分段范围计算结果
 */
export interface SegmentRanges {
  /** 总记录数 */
  totalCount: number;
  /** 分段正文范围 [start, end]（编号，包含两端） */
  segmentRange: [number, number] | null;
  /** 小总结范围 [start, end]（编号，包含两端） */
  smallSummaryRange: [number, number] | null;
  /** 大总结范围 [start, end]（编号，包含两端） */
  largeSummaryRange: [number, number] | null;
}

/**
 * 分段内容结果
 */
export interface SegmentedContent {
  /** 分段正文（完整正文） */
  segmentedText: string;
  /** 小总结（日期+重要信息+自动化系统） */
  smallSummary: string;
  /** 大总结（日期+描述） */
  largeSummary: string;
  /** 计算的范围信息 */
  ranges: SegmentRanges;
}

/**
 * 上下文模式
 */
export type ContextMode = 'full' | 'segmented';

/**
 * 世界书条目配置
 */
export interface WorldbookEntryConfig {
  /** 条目名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 条目位置深度 */
  depth: number;
  /** 条目顺序 */
  order: number;
  /** 条目角色 */
  role: 'system' | 'user' | 'assistant';
}

/**
 * 上下文管理器状态
 */
export interface ContextManagerState {
  /** 当前模式 */
  mode: ContextMode;
  /** 分段配置 */
  config: SegmentConfig;
  /** 历史记录列表 */
  historyRecords: HistoryRecordEntry[];
  /** 历史正文列表 */
  historyTexts: HistoryTextEntry[];
  /** 当前分段内容 */
  segmentedContent: SegmentedContent | null;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 最后更新时间 */
  lastUpdateTime: number;
  /** 错误信息 */
  error: string | null;
}

/**
 * 上下文管理器存档数据
 */
export interface ContextManagerSaveData {
  /** 分段配置 */
  config: SegmentConfig;
  /** 世界书快照 */
  worldbookSnapshots: {
    历史正文: string;
    历史记录: string;
    分段正文: string;
    小总结: string;
    大总结: string;
  };
  /** 保存时间戳 */
  timestamp: number;
}

/**
 * 世界书条目名称常量
 */
export const WORLDBOOK_ENTRY_NAMES = {
  /** 历史正文（存储用，分段模式下禁用） */
  HISTORY_TEXT: '历史正文',
  /** 历史记录（存储用，分段模式下禁用） */
  HISTORY_RECORD: '历史记录',
  /** 分段正文（分段模式下启用） */
  SEGMENTED_TEXT: '分段正文',
  /** 小总结（分段模式下启用） */
  SMALL_SUMMARY: '小总结',
  /** 大总结（分段模式下启用） */
  LARGE_SUMMARY: '大总结',
} as const;

/**
 * 默认分段配置
 */
export const DEFAULT_SEGMENT_CONFIG: SegmentConfig = {
  segmentCount: 3,
  smallSummaryCount: 25,
};

/**
 * 世界书条目默认配置
 */
export const WORLDBOOK_ENTRY_CONFIGS: Record<string, WorldbookEntryConfig> = {
  [WORLDBOOK_ENTRY_NAMES.HISTORY_TEXT]: {
    name: WORLDBOOK_ENTRY_NAMES.HISTORY_TEXT,
    enabled: false, // 分段模式下禁用
    depth: 2,
    order: 100,
    role: 'system',
  },
  [WORLDBOOK_ENTRY_NAMES.HISTORY_RECORD]: {
    name: WORLDBOOK_ENTRY_NAMES.HISTORY_RECORD,
    enabled: false, // 分段模式下禁用
    depth: 2,
    order: 99,
    role: 'system',
  },
  [WORLDBOOK_ENTRY_NAMES.SEGMENTED_TEXT]: {
    name: WORLDBOOK_ENTRY_NAMES.SEGMENTED_TEXT,
    enabled: true,
    depth: 2,
    order: 100,
    role: 'system',
  },
  [WORLDBOOK_ENTRY_NAMES.SMALL_SUMMARY]: {
    name: WORLDBOOK_ENTRY_NAMES.SMALL_SUMMARY,
    enabled: true,
    depth: 4,
    order: 90,
    role: 'system',
  },
  [WORLDBOOK_ENTRY_NAMES.LARGE_SUMMARY]: {
    name: WORLDBOOK_ENTRY_NAMES.LARGE_SUMMARY,
    enabled: true,
    depth: 6,
    order: 80,
    role: 'system',
  },
};

/**
 * 小总结提取的字段
 */
export const SMALL_SUMMARY_FIELDS: (keyof HistoryRecordEntry)[] = ['日期', '重要信息', '自动化系统'];

/**
 * 大总结提取的字段
 */
export const LARGE_SUMMARY_FIELDS: (keyof HistoryRecordEntry)[] = ['日期', '描述'];

/**
 * 历史记录分隔符
 */
export const RECORD_SEPARATOR = '\n——————\n';

/**
 * 正文分隔符
 */
export const TEXT_SEPARATOR = '\n\n---\n\n';
