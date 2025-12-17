/**
 * MVU变量拦截服务
 * 负责拦截原生MVU变量系统发送给AI的内容，用过滤后的精简版本替换
 *
 * 工作原理：
 * 1. 监听酒馆的 CHAT_COMPLETION_PROMPT_READY 事件
 * 2. 识别提示词中的MVU变量内容
 * 3. 使用 AIContextFilterService 过滤变量数据
 * 4. 替换原始内容，让AI只能看到过滤后的版本
 */

import type { AIContextOptions, FilterPreset, FilterResult, OutputFormat } from '../types/aiContext';
import { aiContextFilterService } from './AIContextFilterService';

/**
 * MVU变量标记模式
 * 用于识别消息中的MVU变量内容
 */
const MVU_PATTERNS = {
  /** stat_data JSON块 */
  STAT_DATA: /stat_data[:\s]*(\{[\s\S]*?\})\s*(?=display_data|delta_data|$)/gi,
  /** 完整MVU数据块 */
  MVU_DATA_BLOCK: /<mvu_data>([\s\S]*?)<\/mvu_data>/gi,
  /** 变量表JSON */
  VARIABLES_JSON: /【?变量[表数据]*】?[:\s]*(\{[\s\S]*?\})/gi,
  /** 世界书变量条目标记 */
  WORLDBOOK_VARIABLES: /\[variables?\][:\s]*([\s\S]*?)(?=\[\/variables?\]|\n\n|$)/gi,
  /** JSON对象（可能是变量数据） */
  JSON_OBJECT: /\{[\s\S]*?"(?:规章制度|人员信息|组织架构|系统状态)"[\s\S]*?\}/g,
};

/**
 * 拦截器配置
 */
export interface InterceptorConfig {
  /** 是否启用拦截 */
  enabled: boolean;
  /** 默认过滤预设 */
  defaultPreset: FilterPreset;
  /** 默认输出格式 */
  defaultFormat: OutputFormat;
  /** 是否在控制台显示调试信息 */
  debug: boolean;
  /** 自定义过滤选项 */
  filterOptions?: AIContextOptions;
  /** 变量标识前缀（用于标记过滤后的内容） */
  filteredMarker: string;
  /** 是否保留原始内容的备份（仅用于调试） */
  keepOriginalBackup: boolean;
  /** 自定义最大深度 */
  maxDepth: number;
  /** 自定义数组最大长度 */
  maxArrayLength: number;
}

/**
 * 拦截统计信息
 */
export interface InterceptStats {
  /** 总拦截次数 */
  totalInterceptions: number;
  /** 成功替换次数 */
  successfulReplacements: number;
  /** 失败次数 */
  failures: number;
  /** 上次拦截时间 */
  lastInterceptionTime: number | null;
  /** 上次过滤结果 */
  lastFilterResult: FilterResult | null;
  /** 原始大小历史（最近10次） */
  originalSizeHistory: number[];
  /** 过滤后大小历史（最近10次） */
  filteredSizeHistory: number[];
}

/**
 * 默认配置 - 拦截器默认禁用
 * 注意：变量过滤功能已废止，默认禁用拦截器
 */
const DEFAULT_CONFIG: InterceptorConfig = {
  enabled: false, // 【重要】默认禁用，让原生MVU变量正常发送给AI
  defaultPreset: 'minimal',
  defaultFormat: 'json',
  debug: false,
  filteredMarker: '【已优化】',
  keepOriginalBackup: false,
  maxDepth: 0,
  maxArrayLength: 0,
};

/**
 * 配置存储键名
 */
const CONFIG_STORAGE_KEY = 'mc_mvu_interceptor_config';

/**
 * MVU拦截服务类
 */
export class MVUInterceptorService {
  private config: InterceptorConfig;
  private stats: InterceptStats;
  private isListening: boolean = false;
  private originalBackups: Map<string, string> = new Map();

  /** 事件处理函数引用（用于移除监听） */
  private promptReadyHandler: ((eventData: any) => void) | null = null;
  private generateAfterDataHandler: ((generateData: any) => void) | null = null;

  constructor(config?: Partial<InterceptorConfig>) {
    // 尝试从存储加载配置
    const savedConfig = this.loadConfigFromStorage();
    this.config = { ...DEFAULT_CONFIG, ...savedConfig, ...config };
    this.stats = this.createEmptyStats();
  }

  /**
   * 从存储加载配置
   */
  private loadConfigFromStorage(): Partial<InterceptorConfig> | null {
    try {
      // 尝试从酒馆变量加载
      if (typeof (window as any).getVariables === 'function') {
        const variables = (window as any).getVariables({ type: 'chat' });
        if (variables?.__mvu_interceptor_config) {
          return variables.__mvu_interceptor_config;
        }
      }
      // 尝试从localStorage加载
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn('[MVUInterceptor] 加载配置失败:', err);
    }
    return null;
  }

  /**
   * 保存配置到存储
   */
  public async saveConfigToStorage(): Promise<boolean> {
    try {
      const configToSave = {
        enabled: this.config.enabled,
        maxDepth: this.config.maxDepth,
        maxArrayLength: this.config.maxArrayLength,
      };

      // 保存到localStorage
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configToSave));

      // 尝试保存到酒馆变量
      if (typeof (window as any).insertOrAssignVariables === 'function') {
        await (window as any).insertOrAssignVariables(
          {
            __mvu_interceptor_config: configToSave,
          },
          { type: 'chat' },
        );
      }

      console.log('[MVUInterceptor] 配置已保存');
      return true;
    } catch (err) {
      console.error('[MVUInterceptor] 保存配置失败:', err);
      return false;
    }
  }

  /**
   * 创建空的统计对象
   */
  private createEmptyStats(): InterceptStats {
    return {
      totalInterceptions: 0,
      successfulReplacements: 0,
      failures: 0,
      lastInterceptionTime: null,
      lastFilterResult: null,
      originalSizeHistory: [],
      filteredSizeHistory: [],
    };
  }

  /**
   * 初始化拦截服务
   * 注册事件监听器
   */
  public initialize(): boolean {
    if (this.isListening) {
      console.warn('[MVUInterceptor] 已经在监听中');
      return true;
    }

    try {
      // 检查事件系统是否可用
      if (typeof (window as any).eventOn !== 'function') {
        console.error('[MVUInterceptor] eventOn函数不可用');
        return false;
      }

      const eventOn = (window as any).eventOn;
      const tavernEvents = (window as any).tavern_events;

      if (!tavernEvents) {
        console.error('[MVUInterceptor] tavern_events不可用');
        return false;
      }

      // 创建处理函数
      this.promptReadyHandler = (eventData: any) => this.handlePromptReady(eventData);
      this.generateAfterDataHandler = (generateData: any) => this.handleGenerateAfterData(generateData);

      // 监听提示词准备就绪事件
      if (tavernEvents.CHAT_COMPLETION_PROMPT_READY) {
        eventOn(tavernEvents.CHAT_COMPLETION_PROMPT_READY, this.promptReadyHandler);
        this.log('已注册 CHAT_COMPLETION_PROMPT_READY 监听');
      }

      // 监听生成数据就绪事件
      if (tavernEvents.GENERATE_AFTER_DATA) {
        eventOn(tavernEvents.GENERATE_AFTER_DATA, this.generateAfterDataHandler);
        this.log('已注册 GENERATE_AFTER_DATA 监听');
      }

      this.isListening = true;
      console.log('[MVUInterceptor] 初始化成功，开始监听AI请求');
      return true;
    } catch (err) {
      console.error('[MVUInterceptor] 初始化失败:', err);
      return false;
    }
  }

  /**
   * 销毁拦截服务
   * 移除事件监听器
   */
  public destroy(): void {
    if (!this.isListening) return;

    try {
      const eventRemoveListener = (window as any).eventRemoveListener;
      const tavernEvents = (window as any).tavern_events;

      if (eventRemoveListener && tavernEvents) {
        if (this.promptReadyHandler && tavernEvents.CHAT_COMPLETION_PROMPT_READY) {
          eventRemoveListener(tavernEvents.CHAT_COMPLETION_PROMPT_READY, this.promptReadyHandler);
        }
        if (this.generateAfterDataHandler && tavernEvents.GENERATE_AFTER_DATA) {
          eventRemoveListener(tavernEvents.GENERATE_AFTER_DATA, this.generateAfterDataHandler);
        }
      }

      this.promptReadyHandler = null;
      this.generateAfterDataHandler = null;
      this.isListening = false;
      this.originalBackups.clear();

      console.log('[MVUInterceptor] 已销毁');
    } catch (err) {
      console.error('[MVUInterceptor] 销毁失败:', err);
    }
  }

  /**
   * 处理CHAT_COMPLETION_PROMPT_READY事件
   * 这是主要的拦截点
   */
  private handlePromptReady(eventData: { chat: { role: string; content: string }[]; dryRun: boolean }): void {
    if (!this.config.enabled || eventData.dryRun) return;

    this.stats.totalInterceptions++;
    this.stats.lastInterceptionTime = Date.now();
    this.log('收到 CHAT_COMPLETION_PROMPT_READY 事件');

    try {
      const chat = eventData.chat;
      if (!Array.isArray(chat)) return;

      let replaced = false;

      // 遍历所有消息，查找并替换MVU变量内容
      for (let i = 0; i < chat.length; i++) {
        const message = chat[i];
        if (!message.content || typeof message.content !== 'string') continue;

        const result = this.processMessageContent(message.content);
        if (result.modified) {
          // 备份原始内容
          if (this.config.keepOriginalBackup) {
            this.originalBackups.set(`prompt_${i}_${Date.now()}`, message.content);
          }

          // 替换内容
          message.content = result.content;
          replaced = true;
          this.log(`消息[${i}] 已替换，压缩比: ${result.compressionRatio?.toFixed(1)}%`);
        }
      }

      if (replaced) {
        this.stats.successfulReplacements++;
      }
    } catch (err) {
      this.stats.failures++;
      console.error('[MVUInterceptor] 处理提示词失败:', err);
    }
  }

  /**
   * 处理GENERATE_AFTER_DATA事件
   * 作为备用拦截点
   */
  private handleGenerateAfterData(generateData: {
    prompt: { role: 'user' | 'assistant' | 'system'; content: string }[];
  }): void {
    if (!this.config.enabled) return;

    this.log('收到 GENERATE_AFTER_DATA 事件');

    try {
      const prompt = generateData.prompt;
      if (!Array.isArray(prompt)) return;

      for (let i = 0; i < prompt.length; i++) {
        const message = prompt[i];
        if (!message.content || typeof message.content !== 'string') continue;

        const result = this.processMessageContent(message.content);
        if (result.modified) {
          message.content = result.content;
          this.log(`prompt[${i}] 已替换`);
        }
      }
    } catch (err) {
      console.error('[MVUInterceptor] 处理生成数据失败:', err);
    }
  }

  /**
   * 处理单条消息内容
   * 识别并替换MVU变量数据
   */
  private processMessageContent(content: string): {
    modified: boolean;
    content: string;
    compressionRatio?: number;
  } {
    let modified = false;
    let processedContent = content;
    let totalOriginalSize = 0;
    let totalFilteredSize = 0;

    // 1. 处理 <mvu_data> 标签
    processedContent = processedContent.replace(MVU_PATTERNS.MVU_DATA_BLOCK, (_match, dataContent) => {
      modified = true;
      totalOriginalSize += dataContent.length;

      const filtered = this.filterMvuContent(dataContent);
      totalFilteredSize += filtered.length;

      return `<mvu_data>${this.config.filteredMarker}\n${filtered}\n</mvu_data>`;
    });

    // 2. 处理变量表JSON
    processedContent = processedContent.replace(MVU_PATTERNS.VARIABLES_JSON, (_match, jsonContent) => {
      modified = true;
      totalOriginalSize += jsonContent.length;

      const filtered = this.filterMvuContent(jsonContent);
      totalFilteredSize += filtered.length;

      return `【变量表】${this.config.filteredMarker}：${filtered}`;
    });

    // 3. 处理世界书变量条目
    processedContent = processedContent.replace(MVU_PATTERNS.WORLDBOOK_VARIABLES, (_match, varContent) => {
      modified = true;
      totalOriginalSize += varContent.length;

      const filtered = this.filterMvuContent(varContent);
      totalFilteredSize += filtered.length;

      return `[variables]${this.config.filteredMarker}：\n${filtered}\n[/variables]`;
    });

    // 4. 处理可能的JSON变量对象
    processedContent = processedContent.replace(MVU_PATTERNS.JSON_OBJECT, jsonMatch => {
      // 只处理较大的JSON块（避免误伤小的配置对象）
      if (jsonMatch.length < 500) return jsonMatch;

      try {
        const parsed = JSON.parse(jsonMatch);
        // 确认是变量数据
        if (
          parsed['规章制度'] ||
          parsed['人员信息'] ||
          parsed['组织架构'] ||
          parsed['系统状态'] ||
          parsed['stat_data']
        ) {
          modified = true;
          totalOriginalSize += jsonMatch.length;

          const filtered = this.filterVariableData(parsed);
          totalFilteredSize += filtered.length;

          return `${this.config.filteredMarker}\n${filtered}`;
        }
      } catch {
        // 不是有效JSON，跳过
      }
      return jsonMatch;
    });

    // 更新统计
    if (modified) {
      const compressionRatio = totalOriginalSize > 0 ? (1 - totalFilteredSize / totalOriginalSize) * 100 : 0;

      this.stats.originalSizeHistory.push(totalOriginalSize);
      this.stats.filteredSizeHistory.push(totalFilteredSize);

      // 只保留最近10次
      if (this.stats.originalSizeHistory.length > 10) {
        this.stats.originalSizeHistory.shift();
        this.stats.filteredSizeHistory.shift();
      }

      return { modified, content: processedContent, compressionRatio };
    }

    return { modified: false, content };
  }

  /**
   * 过滤MVU内容（字符串形式）
   */
  private filterMvuContent(content: string): string {
    try {
      // 尝试解析为JSON
      const parsed = JSON.parse(content);
      return this.filterVariableData(parsed);
    } catch {
      // 不是有效JSON，尝试提取其中的JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return this.filterVariableData(parsed);
        } catch {
          // 无法解析，返回压缩后的原内容
          return this.compressText(content);
        }
      }
      return this.compressText(content);
    }
  }

  /**
   * 过滤变量数据对象
   * 使用与预览面板完全相同的配置确保一致性
   */
  private filterVariableData(data: Record<string, any>): string {
    const options: AIContextOptions = {
      preset: 'minimal', // 固定使用最小模式
      output: {
        format: this.config.defaultFormat,
        pretty: false,
        indent: 0,
        includePaths: false,
        language: 'zh',
      },
      customRules: {
        maxDepth: this.config.maxDepth,
        maxArrayLength: this.config.maxArrayLength,
        removeMeta: true,
        removeHiddenNodes: true,
        simplifyStructures: true,
        removeEmptyNodes: true,
        excludeFields: ['修订记录', '附件表单', '版本', '生效日期', '编制单位', '备注', '说明', '荣誉程度', '层级'],
        includeFields: [],
      },
    };

    const result = aiContextFilterService.filter(data, options);
    this.stats.lastFilterResult = result;

    this.log(`过滤完成: ${result.stats.totalNodes}个节点 -> ${result.stats.keptNodes}个节点`);
    this.log(`压缩比: ${result.filtered.compressionRatio.toFixed(1)}%`);

    return result.output.content;
  }

  /**
   * 压缩文本（移除多余空白）
   */
  private compressText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  /**
   * 日志输出
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[MVUInterceptor]', ...args);
    }
  }

  // ========== 公共API ==========

  /**
   * 启用拦截
   */
  public enable(): void {
    this.config.enabled = true;
    console.log('[MVUInterceptor] 已启用');
  }

  /**
   * 禁用拦截
   */
  public disable(): void {
    this.config.enabled = false;
    console.log('[MVUInterceptor] 已禁用');
  }

  /**
   * 切换启用状态
   */
  public toggle(): boolean {
    this.config.enabled = !this.config.enabled;
    console.log(`[MVUInterceptor] ${this.config.enabled ? '已启用' : '已禁用'}`);
    return this.config.enabled;
  }

  /**
   * 设置过滤预设 (保留接口但固定使用minimal)
   */
  public setPreset(_preset: FilterPreset): void {
    // 固定使用最小模式，忽略传入的预设
    this.config.defaultPreset = 'minimal';
    this.log(`预设固定为: minimal`);
  }

  /**
   * 设置最大深度
   */
  public setMaxDepth(depth: number): void {
    this.config.maxDepth = depth;
    this.log(`最大深度已设置为: ${depth === 0 ? '无限制' : depth}`);
  }

  /**
   * 设置数组最大长度
   */
  public setMaxArrayLength(length: number): void {
    this.config.maxArrayLength = length;
    this.log(`数组最大长度已设置为: ${length === 0 ? '无限制' : length}`);
  }

  /**
   * 设置调试模式
   */
  public setDebug(enabled: boolean): void {
    this.config.debug = enabled;
  }

  /**
   * 获取当前配置
   */
  public getConfig(): InterceptorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<InterceptorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取统计信息
   */
  public getStats(): InterceptStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  public resetStats(): void {
    this.stats = this.createEmptyStats();
  }

  /**
   * 获取平均压缩比
   */
  public getAverageCompressionRatio(): number {
    const originalTotal = this.stats.originalSizeHistory.reduce((a, b) => a + b, 0);
    const filteredTotal = this.stats.filteredSizeHistory.reduce((a, b) => a + b, 0);

    if (originalTotal === 0) return 0;
    return (1 - filteredTotal / originalTotal) * 100;
  }

  /**
   * 手动过滤变量数据（用于测试）
   */
  public filterDataManually(data: Record<string, any>, preset?: FilterPreset): string {
    const originalPreset = this.config.defaultPreset;
    if (preset) {
      this.config.defaultPreset = preset;
    }

    const result = this.filterVariableData(data);

    if (preset) {
      this.config.defaultPreset = originalPreset;
    }

    return result;
  }

  /**
   * 检查服务是否正在监听
   */
  public isActive(): boolean {
    return this.isListening && this.config.enabled;
  }
}

// 导出单例实例
export const mvuInterceptorService = new MVUInterceptorService();

// 导出便捷函数
export function initializeMvuInterceptor(config?: Partial<InterceptorConfig>): boolean {
  if (config) {
    mvuInterceptorService.updateConfig(config);
  }
  return mvuInterceptorService.initialize();
}

export function destroyMvuInterceptor(): void {
  mvuInterceptorService.destroy();
}

export function toggleMvuInterceptor(): boolean {
  return mvuInterceptorService.toggle();
}
