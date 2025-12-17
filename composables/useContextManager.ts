/**
 * MC房子 - 上下文管理 Composable
 * 提供上下文管理功能的响应式接口
 */

import { computed, onMounted, ref } from 'vue';
import { contextManagerService } from '../services/ContextManagerService';
import type {
  ContextMode,
  HistoryRecordEntry,
  HistoryTextEntry,
  SegmentConfig,
  SegmentedContent,
} from '../types/contextManager';

/**
 * 上下文管理统计信息
 */
export interface ContextStatistics {
  recordCount: number;
  textCount: number;
  segmentCount: number;
  smallSummaryCount: number;
  largeSummaryCount: number;
  mode: ContextMode;
}

/**
 * 上下文管理Composable
 * 提供响应式的上下文管理功能
 */
export function useContextManager() {
  // ========== 响应式状态 ==========

  /** 是否已初始化 */
  const isInitialized = ref(false);

  /** 是否正在处理 */
  const isProcessing = ref(false);

  /** 错误信息 */
  const error = ref<string | null>(null);

  /** 当前模式 */
  const mode = ref<ContextMode>('segmented');

  /** 上下文管理功能是否启用 */
  const isEnabled = ref(false);

  /** 分段配置 */
  const config = ref<SegmentConfig>({
    segmentCount: 3,
    smallSummaryCount: 25,
  });

  /** 统计信息 */
  const statistics = ref<ContextStatistics>({
    recordCount: 0,
    textCount: 0,
    segmentCount: 0,
    smallSummaryCount: 0,
    largeSummaryCount: 0,
    mode: 'segmented',
  });

  /** 最新的历史记录 */
  const latestRecords = ref<HistoryRecordEntry[]>([]);

  /** 最新的历史正文 */
  const latestTexts = ref<HistoryTextEntry[]>([]);

  /** 当前分段内容 */
  const segmentedContent = ref<SegmentedContent | null>(null);

  /** 最后更新时间 */
  const lastUpdateTime = ref<number>(0);

  // ========== 计算属性 ==========

  /** 是否有历史记录 */
  const hasRecords = computed(() => statistics.value.recordCount > 0);

  /** 是否处于分段模式 */
  const isSegmentedMode = computed(() => mode.value === 'segmented');

  /** 格式化的最后更新时间 */
  const formattedLastUpdateTime = computed(() => {
    if (!lastUpdateTime.value) return '';
    return new Date(lastUpdateTime.value).toLocaleString('zh-CN');
  });

  // ========== 内部方法 ==========

  /**
   * 同步状态
   */
  const syncState = () => {
    const state = contextManagerService.getState();
    const stats = contextManagerService.getStatistics();
    const cfg = contextManagerService.getConfig();

    mode.value = state.mode;
    config.value = cfg;
    statistics.value = stats;
    isProcessing.value = state.isProcessing;
    error.value = state.error;
    lastUpdateTime.value = state.lastUpdateTime;
    segmentedContent.value = state.segmentedContent;
    isEnabled.value = contextManagerService.isEnabled();

    // 获取最新的记录（显示最近10条）
    latestRecords.value = contextManagerService.getLatestRecords(10);
    latestTexts.value = contextManagerService.getLatestTexts(5);
  };

  // ========== 公共方法 ==========

  /**
   * 初始化上下文管理
   */
  const initialize = async (): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const success = await contextManagerService.initialize();

      if (success) {
        isInitialized.value = true;
        syncState();
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 刷新状态
   */
  const refresh = async (): Promise<void> => {
    await contextManagerService.loadFromWorldbook();
    syncState();
  };

  /**
   * 设置分段正文数量
   * @param count 数量（0表示不使用分段正文）
   */
  const setSegmentCount = async (count: number): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      await contextManagerService.setSegmentCount(count);
      syncState();

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 设置小总结范围
   * @param count 数量（0表示不使用小总结）
   */
  const setSmallSummaryCount = async (count: number): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      await contextManagerService.setSmallSummaryCount(count);
      syncState();

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 更新配置
   * @param newConfig 新配置
   */
  const updateConfig = async (newConfig: Partial<SegmentConfig>): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      await contextManagerService.setConfig(newConfig);
      syncState();

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新配置失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 切换模式
   * @param newMode 新模式
   */
  const switchMode = async (newMode: ContextMode): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      await contextManagerService.switchMode(newMode);
      syncState();

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '切换模式失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 手动重新生成分段
   */
  const regenerateSegments = async (): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const success = await contextManagerService.regenerateSegments();
      syncState();

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '重新生成失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 清空所有历史数据
   * @param forceWorldbook 是否强制清空世界书（即使功能未启用）
   */
  const clearAll = async (forceWorldbook: boolean = false): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const success = await contextManagerService.clearAll(forceWorldbook);
      syncState();

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '清空失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 设置上下文管理功能的启用状态
   * @param enabled 是否启用
   */
  const setEnabled = async (enabled: boolean): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      contextManagerService.setEnabled(enabled);

      // 如果启用，需要初始化世界书服务并加载数据
      if (enabled) {
        await contextManagerService.initialize();
      }

      syncState();
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置启用状态失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 获取存档数据
   */
  const getSaveData = async () => {
    return await contextManagerService.getSaveData();
  };

  /**
   * 从存档恢复
   * @param saveData 存档数据
   */
  const restoreFromSaveData = async (saveData: any): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const success = await contextManagerService.restoreFromSaveData(saveData);
      syncState();

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '恢复失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  // ========== 生命周期 ==========

  onMounted(async () => {
    console.log('[useContextManager] Composable已挂载');
    // 注意：初始化由useAIInteraction负责，这里只同步状态
    syncState();
  });

  // ========== 返回公共接口 ==========

  return {
    // 状态
    isInitialized,
    isProcessing,
    error,
    mode,
    config,
    statistics,
    latestRecords,
    latestTexts,
    segmentedContent,
    lastUpdateTime,
    isEnabled,

    // 计算属性
    hasRecords,
    isSegmentedMode,
    formattedLastUpdateTime,

    // 方法
    initialize,
    refresh,
    setSegmentCount,
    setSmallSummaryCount,
    updateConfig,
    switchMode,
    regenerateSegments,
    clearAll,
    getSaveData,
    restoreFromSaveData,
    syncState,
    setEnabled,

    // 服务实例（高级用法）
    service: contextManagerService,
  };
}
