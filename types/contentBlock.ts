/**
 * MClite - 内容块差异化显示系统类型定义
 *
 * 格式强调规则：
 * - 「」 角色语言/对话
 * - *...* 角色心理描写
 * - 【】 景物描写
 * - 【【...】】 系统提示/强调显示
 *
 * 禁止使用中英文引号""、''，统一使用「」
 */

/**
 * 内容块类型枚举
 */
export enum ContentBlockType {
  /** 普通文本 - 无特殊格式包裹的文本 */
  TEXT = 'text',
  /** 对话 - 「」包裹的角色语言 */
  DIALOGUE = 'dialogue',
  /** 心理描写 - *...* 包裹的角色心理活动 */
  THOUGHT = 'thought',
  /** 景物描写 - 【】包裹的环境/场景描写 */
  SCENERY = 'scenery',
  /** 系统提示 - 【【...】】包裹的强调内容 */
  SYSTEM = 'system',
}

/**
 * 内容块接口
 * 解析后的单个内容块
 */
export interface ContentBlock {
  /** 唯一标识符 */
  id: string;
  /** 内容块类型 */
  type: ContentBlockType;
  /** 原始内容（包含格式符号） */
  rawContent: string;
  /** 显示内容（去除格式符号后的纯文本） */
  displayContent: string;
  /** 在原始文本中的起始位置 */
  startIndex: number;
  /** 在原始文本中的结束位置 */
  endIndex: number;
}

/**
 * 解析结果接口
 */
export interface ParseResult {
  /** 解析后的内容块数组 */
  blocks: ContentBlock[];
  /** 原始文本 */
  originalText: string;
  /** 解析是否成功 */
  success: boolean;
  /** 错误信息（如果解析失败） */
  error?: string;
  /** 统计信息 */
  statistics: ParseStatistics;
}

/**
 * 解析统计信息
 */
export interface ParseStatistics {
  /** 总块数 */
  totalBlocks: number;
  /** 各类型块的数量统计 */
  blockCounts: Record<ContentBlockType, number>;
  /** 原始文本长度 */
  originalLength: number;
  /** 解析耗时（毫秒） */
  parseTime: number;
}

/**
 * 内容块样式配置
 */
export interface ContentBlockStyle {
  /** 背景颜色 */
  backgroundColor?: string;
  /** 文字颜色 */
  textColor?: string;
  /** 边框颜色 */
  borderColor?: string;
  /** 边框样式 */
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  /** 边框宽度 */
  borderWidth?: string;
  /** 圆角 */
  borderRadius?: string;
  /** 内边距 */
  padding?: string;
  /** 外边距 */
  margin?: string;
  /** 字体样式 */
  fontStyle?: 'normal' | 'italic';
  /** 字体粗细 */
  fontWeight?: 'normal' | 'bold' | number;
  /** 字体大小 */
  fontSize?: string;
  /** 行高 */
  lineHeight?: string | number;
  /** 图标（用于块前缀） */
  icon?: string;
  /** 额外的CSS类名 */
  className?: string;
}

/**
 * 内容块样式主题
 * 包含所有类型块的样式配置
 */
export interface ContentBlockTheme {
  /** 主题名称 */
  name: string;
  /** 各类型块的样式配置 */
  styles: Record<ContentBlockType, ContentBlockStyle>;
}

/**
 * 默认样式主题 - 亮色模式
 */
export const DEFAULT_LIGHT_THEME: ContentBlockTheme = {
  name: 'light',
  styles: {
    [ContentBlockType.TEXT]: {
      textColor: 'var(--text-color)',
      backgroundColor: 'transparent',
      fontStyle: 'normal',
    },
    [ContentBlockType.DIALOGUE]: {
      textColor: '#1a5fb4', // 深蓝色 - 对话感
      backgroundColor: 'rgba(26, 95, 180, 0.05)',
      borderColor: 'rgba(26, 95, 180, 0.2)',
      borderStyle: 'solid',
      borderWidth: '0 0 0 3px',
      borderRadius: '0 4px 4px 0',
      padding: '8px 12px',
      margin: '4px 0',
      fontWeight: 'normal',
      icon: '💬',
    },
    [ContentBlockType.THOUGHT]: {
      textColor: '#8b5cf6', // 紫色 - 思考/内心
      backgroundColor: 'rgba(139, 92, 246, 0.05)',
      fontStyle: 'italic',
      padding: '6px 12px',
      margin: '4px 0',
      borderRadius: '4px',
      icon: '💭',
    },
    [ContentBlockType.SCENERY]: {
      textColor: '#059669', // 绿色 - 自然/环境
      backgroundColor: 'rgba(5, 150, 105, 0.05)',
      borderColor: 'rgba(5, 150, 105, 0.15)',
      borderStyle: 'dashed',
      borderWidth: '1px',
      borderRadius: '6px',
      padding: '10px 14px',
      margin: '8px 0',
      lineHeight: 1.8,
      icon: '🏞️',
    },
    [ContentBlockType.SYSTEM]: {
      textColor: '#dc2626', // 红色 - 警示/系统
      backgroundColor: 'rgba(220, 38, 38, 0.08)',
      borderColor: '#dc2626',
      borderStyle: 'solid',
      borderWidth: '2px',
      borderRadius: '8px',
      padding: '12px 16px',
      margin: '10px 0',
      fontWeight: 'bold',
      icon: '⚠️',
    },
  },
};

/**
 * 默认样式主题 - 暗色模式
 */
export const DEFAULT_DARK_THEME: ContentBlockTheme = {
  name: 'dark',
  styles: {
    [ContentBlockType.TEXT]: {
      textColor: 'var(--text-color)',
      backgroundColor: 'transparent',
      fontStyle: 'normal',
    },
    [ContentBlockType.DIALOGUE]: {
      textColor: '#60a5fa', // 亮蓝色
      backgroundColor: 'rgba(96, 165, 250, 0.1)',
      borderColor: 'rgba(96, 165, 250, 0.3)',
      borderStyle: 'solid',
      borderWidth: '0 0 0 3px',
      borderRadius: '0 4px 4px 0',
      padding: '8px 12px',
      margin: '4px 0',
      fontWeight: 'normal',
      icon: '💬',
    },
    [ContentBlockType.THOUGHT]: {
      textColor: '#a78bfa', // 亮紫色
      backgroundColor: 'rgba(167, 139, 250, 0.1)',
      fontStyle: 'italic',
      padding: '6px 12px',
      margin: '4px 0',
      borderRadius: '4px',
      icon: '💭',
    },
    [ContentBlockType.SCENERY]: {
      textColor: '#34d399', // 亮绿色
      backgroundColor: 'rgba(52, 211, 153, 0.1)',
      borderColor: 'rgba(52, 211, 153, 0.2)',
      borderStyle: 'dashed',
      borderWidth: '1px',
      borderRadius: '6px',
      padding: '10px 14px',
      margin: '8px 0',
      lineHeight: 1.8,
      icon: '🏞️',
    },
    [ContentBlockType.SYSTEM]: {
      textColor: '#f87171', // 亮红色
      backgroundColor: 'rgba(248, 113, 113, 0.15)',
      borderColor: '#f87171',
      borderStyle: 'solid',
      borderWidth: '2px',
      borderRadius: '8px',
      padding: '12px 16px',
      margin: '10px 0',
      fontWeight: 'bold',
      icon: '⚠️',
    },
  },
};

/**
 * 格式符号定义
 * 用于解析器识别不同类型的内容块
 */
export interface FormatMarker {
  /** 格式类型 */
  type: ContentBlockType;
  /** 开始符号 */
  start: string;
  /** 结束符号 */
  end: string;
  /** 正则表达式（用于匹配） */
  regex: RegExp;
  /** 优先级（数字越大优先级越高） */
  priority: number;
}

/**
 * 格式符号配置
 * 注意：优先级高的先匹配，以避免嵌套符号被错误解析
 *
 * 兼容性说明：
 * - 不使用 lookbehind 断言 (?<!) 因为旧版浏览器不支持
 * - 使用简单的字符类和非贪婪匹配
 * - 通过优先级排序来处理嵌套情况
 */
export const FORMAT_MARKERS: FormatMarker[] = [
  {
    type: ContentBlockType.SYSTEM,
    start: '【【',
    end: '】】',
    // 匹配 【【...】】，非贪婪模式，不包含嵌套的方括号
    regex: /【【([^【】]*)】】/g,
    priority: 100, // 最高优先级，先匹配双方括号
  },
  {
    type: ContentBlockType.SCENERY,
    start: '【',
    end: '】',
    // 匹配单独的 【...】，内容不包含方括号字符
    // 通过优先级排序，先匹配 【【】】 再匹配 【】
    regex: /【([^【】]+)】/g,
    priority: 80,
  },
  {
    type: ContentBlockType.DIALOGUE,
    start: '「',
    end: '」',
    // 匹配 「...」，内容不包含对话括号
    regex: /「([^「」]+)」/g,
    priority: 60,
  },
  {
    type: ContentBlockType.THOUGHT,
    start: '*',
    end: '*',
    // 匹配 *...*，内容为非星号非空字符
    // 简化正则表达式，避免使用 lookahead
    regex: /\*([^*]+)\*/g,
    priority: 40,
  },
];

/**
 * 解析器配置
 */
export interface ParserConfig {
  /** 是否启用解析 */
  enabled: boolean;
  /** 使用的格式符号配置 */
  formatMarkers: FormatMarker[];
  /** 是否保留原始格式符号在显示内容中 */
  preserveMarkers: boolean;
  /** 是否转义HTML */
  escapeHtml: boolean;
  /** 最大嵌套深度（防止无限递归） */
  maxNestingDepth: number;
}

/**
 * 默认解析器配置
 */
export const DEFAULT_PARSER_CONFIG: ParserConfig = {
  enabled: true,
  formatMarkers: FORMAT_MARKERS,
  preserveMarkers: false,
  escapeHtml: true,
  maxNestingDepth: 10,
};

/**
 * 渲染器配置
 */
export interface RendererConfig {
  /** 是否启用渲染 */
  enabled: boolean;
  /** 是否显示图标 */
  showIcons: boolean;
  /** 是否启用动画 */
  enableAnimations: boolean;
  /** 当前主题 */
  theme: 'light' | 'dark' | 'auto';
  /** 自定义主题（优先使用） */
  customTheme?: ContentBlockTheme;
}

/**
 * 默认渲染器配置
 */
export const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  enabled: true,
  showIcons: true,
  enableAnimations: true,
  theme: 'auto',
};

/**
 * 内容块渲染事件
 */
export interface ContentBlockEvent {
  /** 事件类型 */
  type: 'click' | 'hover' | 'copy';
  /** 触发事件的内容块 */
  block: ContentBlock;
  /** 原生事件对象 */
  nativeEvent: Event;
}

/**
 * 生成唯一ID
 */
export function generateBlockId(): string {
  return `cb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 根据类型获取默认样式
 */
export function getDefaultStyle(type: ContentBlockType, theme: 'light' | 'dark' = 'light'): ContentBlockStyle {
  const themeConfig = theme === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
  return themeConfig.styles[type] || {};
}

/**
 * 获取类型的中文名称
 */
export function getTypeName(type: ContentBlockType): string {
  const names: Record<ContentBlockType, string> = {
    [ContentBlockType.TEXT]: '普通文本',
    [ContentBlockType.DIALOGUE]: '角色对话',
    [ContentBlockType.THOUGHT]: '心理描写',
    [ContentBlockType.SCENERY]: '景物描写',
    [ContentBlockType.SYSTEM]: '系统提示',
  };
  return names[type] || '未知类型';
}

/**
 * 获取类型的图标
 */
export function getTypeIcon(type: ContentBlockType): string {
  const icons: Record<ContentBlockType, string> = {
    [ContentBlockType.TEXT]: '📝',
    [ContentBlockType.DIALOGUE]: '💬',
    [ContentBlockType.THOUGHT]: '💭',
    [ContentBlockType.SCENERY]: '🏞️',
    [ContentBlockType.SYSTEM]: '⚠️',
  };
  return icons[type] || '📄';
}
