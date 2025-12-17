/**
 * 上下文管理服务
 * 负责管理历史记录、历史正文的分段和总结生成
 * 当历史正文和历史记录更新时，自动同步更新分段内容
 */

import type {
  ContextManagerSaveData,
  ContextManagerState,
  ContextMode,
  HistoryRecordEntry,
  HistoryTextEntry,
  SegmentConfig,
  SegmentedContent,
  SegmentRanges,
} from '../types/contextManager';
import { DEFAULT_SEGMENT_CONFIG, WORLDBOOK_ENTRY_NAMES } from '../types/contextManager';
import { HistoryRecordParser } from './HistoryRecordParser';
import { worldbookService } from './WorldbookService';

/**
 * 上下文管理服务类
 */
export class ContextManagerService {
  /** 当前状态 */
  private state: ContextManagerState;

  /** 是否已初始化 */
  private initialized: boolean = false;

  /**
   * 是否启用上下文管理功能
   * 当设置为 false 时，将跳过所有世界书条目的创建和更新
   * 这允许用户使用外挂的世界书来提供上下文内容
   */
  private enabled: boolean = false;

  constructor() {
    this.state = {
      mode: 'segmented',
      config: { ...DEFAULT_SEGMENT_CONFIG },
      historyRecords: [],
      historyTexts: [],
      segmentedContent: null,
      isProcessing: false,
      lastUpdateTime: 0,
      error: null,
    };
  }

  /**
   * 检查上下文管理功能是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 启用上下文管理功能
   */
  enable(): void {
    this.enabled = true;
    console.log('[ContextManager] 上下文管理功能已启用');
  }

  /**
   * 禁用上下文管理功能
   * 禁用后将跳过所有世界书条目的创建和更新
   */
  disable(): void {
    this.enabled = false;
    console.log('[ContextManager] 上下文管理功能已禁用（将使用外挂世界书）');
  }

  /**
   * 设置上下文管理功能的启用状态
   * @param enabled 是否启用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[ContextManager] 上下文管理功能已${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 初始化服务
   * 【修复】移除了 ensureAllEntries() 调用，采用懒创建模式
   * 这避免了在卡片导入时覆盖原有世界书内容的问题
   * 【新增】默认禁用上下文管理功能，允许用户使用外挂世界书
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('[ContextManager] 正在初始化...');

      // 【重要】默认禁用上下文管理功能
      // 原因：用户会在外挂的世界书中提供上下文内容，此功能会抢占原有世界书位置
      // 如果需要启用，可以调用 enable() 方法
      if (!this.enabled) {
        console.log('[ContextManager] 上下文管理功能已禁用，跳过初始化世界书服务');
        this.initialized = true;
        return true;
      }

      // 初始化世界书服务
      await worldbookService.initialize();

      // 【修复】不再调用 ensureAllEntries()
      // 原因：如果卡片绑定了世界书，ensureAllEntries 会在检测不到条目时创建空条目
      // 这会导致后续更新操作用空内容覆盖原有的世界书内容
      // 新方案：采用懒创建模式，条目会在真正需要写入内容时自动创建

      // 从世界书加载现有数据（如果有的话）
      await this.loadFromWorldbook();

      this.initialized = true;
      console.log('[ContextManager] 初始化完成');
      return true;
    } catch (err) {
      console.error('[ContextManager] 初始化失败:', err);
      this.state.error = err instanceof Error ? err.message : '初始化失败';
      return false;
    }
  }

  /**
   * 从世界书加载现有数据
   */
  async loadFromWorldbook(): Promise<void> {
    // 【新增】如果功能已禁用，跳过加载
    if (!this.enabled) {
      console.log('[ContextManager] 功能已禁用，跳过从世界书加载数据');
      return;
    }

    try {
      // 加载历史记录
      const historyRecordText = await worldbookService.getEntryContent(WORLDBOOK_ENTRY_NAMES.HISTORY_RECORD);
      this.state.historyRecords = HistoryRecordParser.parseRecords(historyRecordText);

      // 加载历史正文
      const historyTextContent = await worldbookService.getEntryContent(WORLDBOOK_ENTRY_NAMES.HISTORY_TEXT);
      this.state.historyTexts = HistoryRecordParser.parseHistoryTexts(historyTextContent);

      console.log(
        `[ContextManager] 已加载 ${this.state.historyRecords.length} 条历史记录，${this.state.historyTexts.length} 条历史正文`,
      );
    } catch (err) {
      console.error('[ContextManager] 从世界书加载数据失败:', err);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): Readonly<ContextManagerState> {
    return this.state;
  }

  /**
   * 获取分段配置
   */
  getConfig(): SegmentConfig {
    return { ...this.state.config };
  }

  /**
   * 设置分段配置
   * @param config 新的分段配置
   */
  async setConfig(config: Partial<SegmentConfig>): Promise<void> {
    this.state.config = {
      ...this.state.config,
      ...config,
    };

    // 配置变更后自动重新生成分段
    await this.regenerateSegments();
  }

  /**
   * 设置分段正文数量
   * @param count 数量（0表示不使用分段正文）
   */
  async setSegmentCount(count: number): Promise<void> {
    await this.setConfig({ segmentCount: Math.max(0, count) });
  }

  /**
   * 设置小总结范围
   * @param count 数量（0表示不使用小总结）
   */
  async setSmallSummaryCount(count: number): Promise<void> {
    await this.setConfig({ smallSummaryCount: Math.max(0, count) });
  }

  /**
   * 获取当前模式
   */
  getMode(): ContextMode {
    return this.state.mode;
  }

  /**
   * 切换模式
   * @param mode 新模式
   */
  async switchMode(mode: ContextMode): Promise<void> {
    if (mode === this.state.mode) return;

    this.state.mode = mode;

    if (mode === 'full') {
      await worldbookService.switchToFullMode();
    } else {
      await worldbookService.switchToSegmentedMode();
      // 切换到分段模式时重新生成分段
      await this.regenerateSegments();
    }

    console.log(`[ContextManager] 已切换到${mode === 'full' ? '全量' : '分段'}模式`);
  }

  /**
   * 计算分段范围
   * @param totalCount 总记录数
   * @param segmentCount 分段正文数量 N
   * @param smallSummaryCount 小总结范围 M
   */
  calculateRanges(totalCount: number, segmentCount: number, smallSummaryCount: number): SegmentRanges {
    const result: SegmentRanges = {
      totalCount,
      segmentRange: null,
      smallSummaryRange: null,
      largeSummaryRange: null,
    };

    if (totalCount === 0) return result;

    // 1. 分段正文范围（最近N条）
    if (segmentCount > 0 && totalCount > 0) {
      const segmentStart = Math.max(1, totalCount - segmentCount + 1);
      const segmentEnd = totalCount;
      result.segmentRange = [segmentStart, segmentEnd];
    }

    // 2. 小总结范围（从分段正文之后往前数M条）
    const smallSummaryEnd =
      segmentCount > 0
        ? Math.max(0, totalCount - segmentCount) // 分段正文之前
        : totalCount; // 如果没有分段正文，从最新开始

    if (smallSummaryCount > 0 && smallSummaryEnd > 0) {
      const smallSummaryStart = Math.max(1, smallSummaryEnd - smallSummaryCount + 1);
      result.smallSummaryRange = [smallSummaryStart, smallSummaryEnd];
    }

    // 3. 大总结范围（余下的所有）
    const largeSummaryEnd =
      smallSummaryCount > 0 && result.smallSummaryRange
        ? result.smallSummaryRange[0] - 1 // 小总结之前
        : segmentCount > 0 && result.segmentRange
          ? result.segmentRange[0] - 1 // 分段正文之前
          : totalCount; // 如果都没有，就是全部

    if (largeSummaryEnd >= 1) {
      result.largeSummaryRange = [1, largeSummaryEnd];
    }

    return result;
  }

  /**
   * 生成分段内容
   * 注意：范围是基于数组索引（1-based）计算的，而不是基于记录的序号字段
   * 这是因为历史记录的序号可能不是从1开始连续递增的
   */
  generateSegmentedContent(): SegmentedContent {
    const { historyRecords, historyTexts, config } = this.state;
    const { segmentCount, smallSummaryCount } = config;

    const totalCount = historyRecords.length;
    const ranges = this.calculateRanges(totalCount, segmentCount, smallSummaryCount);

    // 生成分段正文
    // 使用数组切片而非序号过滤，因为historyTexts的序号是按添加顺序从1递增的
    let segmentedText = '';
    if (ranges.segmentRange && historyTexts.length > 0) {
      const [start, end] = ranges.segmentRange;
      // 转换为0-based索引进行切片
      const selectedTexts = historyTexts.slice(start - 1, end);
      segmentedText = HistoryRecordParser.formatSegmentedText(selectedTexts);
    }

    // 生成小总结（日期+重要信息+自动化系统）
    // 使用数组切片而非序号过滤，避免序号不连续导致的问题
    let smallSummary = '';
    if (ranges.smallSummaryRange) {
      const [start, end] = ranges.smallSummaryRange;
      // 转换为0-based索引进行切片
      const selectedRecords = historyRecords.slice(start - 1, end);
      smallSummary = HistoryRecordParser.formatSmallSummary(selectedRecords);
    }

    // 生成大总结（日期+描述）
    // 使用数组切片而非序号过滤，避免序号不连续导致的问题
    let largeSummary = '';
    if (ranges.largeSummaryRange) {
      const [start, end] = ranges.largeSummaryRange;
      // 转换为0-based索引进行切片
      const selectedRecords = historyRecords.slice(start - 1, end);
      largeSummary = HistoryRecordParser.formatLargeSummary(selectedRecords);
    }

    return {
      segmentedText,
      smallSummary,
      largeSummary,
      ranges,
    };
  }

  /**
   * 重新生成并更新所有分段内容
   * 【修复】添加保护逻辑：只在有数据时才写入世界书，避免用空内容覆盖现有数据
   */
  async regenerateSegments(): Promise<boolean> {
    // 【新增】如果功能已禁用，跳过分段生成
    if (!this.enabled) {
      console.log('[ContextManager] 功能已禁用，跳过分段生成');
      return true;
    }

    try {
      this.state.isProcessing = true;
      this.state.error = null;

      // 【修复】检查是否有数据，如果没有数据则跳过写入
      // 这避免了在初始化时用空内容覆盖现有世界书内容的问题
      const hasData = this.state.historyRecords.length > 0 || this.state.historyTexts.length > 0;

      if (!hasData) {
        console.log('[ContextManager] 没有历史数据，跳过分段生成（避免覆盖现有世界书内容）');
        return true;
      }

      // 生成分段内容
      const segmentedContent = this.generateSegmentedContent();
      this.state.segmentedContent = segmentedContent;

      // 【修复】只在有实际内容时才更新到世界书
      // 避免用空字符串覆盖原有内容
      if (segmentedContent.segmentedText) {
        await worldbookService.setEntryContent(WORLDBOOK_ENTRY_NAMES.SEGMENTED_TEXT, segmentedContent.segmentedText);
      }

      if (segmentedContent.smallSummary) {
        await worldbookService.setEntryContent(WORLDBOOK_ENTRY_NAMES.SMALL_SUMMARY, segmentedContent.smallSummary);
      }

      if (segmentedContent.largeSummary) {
        await worldbookService.setEntryContent(WORLDBOOK_ENTRY_NAMES.LARGE_SUMMARY, segmentedContent.largeSummary);
      }

      this.state.lastUpdateTime = Date.now();
      console.log('[ContextManager] 分段内容已更新', {
        分段正文条数: segmentedContent.ranges.segmentRange
          ? segmentedContent.ranges.segmentRange[1] - segmentedContent.ranges.segmentRange[0] + 1
          : 0,
        小总结条数: segmentedContent.ranges.smallSummaryRange
          ? segmentedContent.ranges.smallSummaryRange[1] - segmentedContent.ranges.smallSummaryRange[0] + 1
          : 0,
        大总结条数: segmentedContent.ranges.largeSummaryRange
          ? segmentedContent.ranges.largeSummaryRange[1] - segmentedContent.ranges.largeSummaryRange[0] + 1
          : 0,
      });

      return true;
    } catch (err) {
      console.error('[ContextManager] 重新生成分段失败:', err);
      this.state.error = err instanceof Error ? err.message : '生成分段失败';
      return false;
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * 处理AI回复，提取并追加历史记录和历史正文
   * 这是核心方法，当AI生成结束时调用
   * @param aiResponse AI回复的完整文本
   */
  async processAIResponse(aiResponse: string): Promise<boolean> {
    // 【新增】如果功能已禁用，跳过处理
    if (!this.enabled) {
      console.log('[ContextManager] 功能已禁用，跳过处理AI回复');
      return false;
    }

    try {
      this.state.isProcessing = true;
      this.state.error = null;

      let updated = false;

      // 提取<gametxt>内容
      const gameText = HistoryRecordParser.extractGameTextTag(aiResponse);
      if (gameText) {
        // 追加到历史正文
        const currentHistoryText = await worldbookService.getEntryContent(WORLDBOOK_ENTRY_NAMES.HISTORY_TEXT);
        const newHistoryText = HistoryRecordParser.appendText(currentHistoryText, gameText);
        await worldbookService.setEntryContent(WORLDBOOK_ENTRY_NAMES.HISTORY_TEXT, newHistoryText);

        // 更新本地状态
        const newSequence = this.state.historyTexts.length + 1;
        this.state.historyTexts.push({
          序号: newSequence,
          内容: gameText,
        });

        updated = true;
        console.log('[ContextManager] 已追加历史正文，当前共', this.state.historyTexts.length, '条');
      }

      // 提取<历史记录>内容
      const historyRecordText = HistoryRecordParser.extractHistoryRecordTag(aiResponse);
      if (historyRecordText) {
        // 解析新记录
        const newRecord = HistoryRecordParser.parseRecord(historyRecordText);

        if (newRecord) {
          // 追加到历史记录
          const currentHistoryRecord = await worldbookService.getEntryContent(WORLDBOOK_ENTRY_NAMES.HISTORY_RECORD);
          const newHistoryRecordText = HistoryRecordParser.appendRecord(currentHistoryRecord, historyRecordText);
          await worldbookService.setEntryContent(WORLDBOOK_ENTRY_NAMES.HISTORY_RECORD, newHistoryRecordText);

          // 更新本地状态
          this.state.historyRecords.push(newRecord);

          updated = true;
          console.log('[ContextManager] 已追加历史记录，当前共', this.state.historyRecords.length, '条');
        }
      }

      // 如果有更新，且处于分段模式，自动重新生成分段
      if (updated && this.state.mode === 'segmented') {
        await this.regenerateSegments();
      }

      this.state.lastUpdateTime = Date.now();
      return updated;
    } catch (err) {
      console.error('[ContextManager] 处理AI回复失败:', err);
      this.state.error = err instanceof Error ? err.message : '处理AI回复失败';
      return false;
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * 获取历史记录数量
   */
  getRecordCount(): number {
    return this.state.historyRecords.length;
  }

  /**
   * 获取历史正文数量
   */
  getTextCount(): number {
    return this.state.historyTexts.length;
  }

  /**
   * 获取最新的历史记录
   * @param count 获取数量
   */
  getLatestRecords(count: number): HistoryRecordEntry[] {
    return this.state.historyRecords.slice(-count);
  }

  /**
   * 获取最新的历史正文
   * @param count 获取数量
   */
  getLatestTexts(count: number): HistoryTextEntry[] {
    return this.state.historyTexts.slice(-count);
  }

  /**
   * 清空所有历史数据
   * @param forceWorldbook 是否强制清空世界书（即使功能未启用）
   */
  async clearAll(forceWorldbook: boolean = false): Promise<boolean> {
    // 【修复】如果功能已禁用且不强制清空世界书，只清空本地状态
    if (!this.enabled && !forceWorldbook) {
      console.log('[ContextManager] 功能已禁用，只清空本地状态');
      this.state.historyRecords = [];
      this.state.historyTexts = [];
      this.state.segmentedContent = null;
      this.state.lastUpdateTime = Date.now();
      return true;
    }

    try {
      this.state.isProcessing = true;

      // 清空世界书条目（如果启用或强制清空）
      if (this.enabled || forceWorldbook) {
        // 确保世界书服务已初始化
        if (!worldbookService.isAvailable()) {
          console.warn('[ContextManager] 世界书服务不可用，跳过清空世界书条目');
        } else {
          await worldbookService.clearAllContextEntries();
          console.log('[ContextManager] 已清空世界书条目');
        }
      }

      // 清空本地状态
      this.state.historyRecords = [];
      this.state.historyTexts = [];
      this.state.segmentedContent = null;
      this.state.lastUpdateTime = Date.now();

      console.log('[ContextManager] 已清空所有历史数据');
      return true;
    } catch (err) {
      console.error('[ContextManager] 清空数据失败:', err);
      this.state.error = err instanceof Error ? err.message : '清空数据失败';
      return false;
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * 获取存档数据
   */
  async getSaveData(): Promise<ContextManagerSaveData> {
    const worldbookSnapshots = await worldbookService.getContextSnapshot();

    return {
      config: { ...this.state.config },
      worldbookSnapshots: worldbookSnapshots as ContextManagerSaveData['worldbookSnapshots'],
      timestamp: Date.now(),
    };
  }

  /**
   * 从存档数据恢复
   * @param saveData 存档数据
   */
  async restoreFromSaveData(saveData: ContextManagerSaveData): Promise<boolean> {
    try {
      this.state.isProcessing = true;

      // 恢复配置
      this.state.config = { ...saveData.config };

      // 恢复世界书内容
      await worldbookService.restoreFromSnapshot(saveData.worldbookSnapshots);

      // 重新加载本地状态
      await this.loadFromWorldbook();

      // 如果处于分段模式，重新生成分段
      if (this.state.mode === 'segmented') {
        await this.regenerateSegments();
      }

      this.state.lastUpdateTime = Date.now();
      console.log('[ContextManager] 已从存档恢复');
      return true;
    } catch (err) {
      console.error('[ContextManager] 从存档恢复失败:', err);
      this.state.error = err instanceof Error ? err.message : '恢复失败';
      return false;
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    recordCount: number;
    textCount: number;
    segmentCount: number;
    smallSummaryCount: number;
    largeSummaryCount: number;
    mode: ContextMode;
  } {
    const ranges =
      this.state.segmentedContent?.ranges ||
      this.calculateRanges(
        this.state.historyRecords.length,
        this.state.config.segmentCount,
        this.state.config.smallSummaryCount,
      );

    return {
      recordCount: this.state.historyRecords.length,
      textCount: this.state.historyTexts.length,
      segmentCount: ranges.segmentRange ? ranges.segmentRange[1] - ranges.segmentRange[0] + 1 : 0,
      smallSummaryCount: ranges.smallSummaryRange ? ranges.smallSummaryRange[1] - ranges.smallSummaryRange[0] + 1 : 0,
      largeSummaryCount: ranges.largeSummaryRange ? ranges.largeSummaryRange[1] - ranges.largeSummaryRange[0] + 1 : 0,
      mode: this.state.mode,
    };
  }
}

// 导出单例
export const contextManagerService = new ContextManagerService();
