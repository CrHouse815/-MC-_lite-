/**
 * MC房子 - 存档管理 Composable
 * 提供存档/读档功能的响应式接口
 * 支持手动存档和自动存档功能
 */

import { computed, onMounted, onUnmounted, ref } from 'vue';
import { saveService, type AutoSaveConfig, type GameSaveData, type SaveMetadata } from '../services/SaveService';
import { useMvuStore } from '../stores/mvuStore';

/**
 * 存档统计信息
 */
export interface SaveStats {
  total: number;
  manual: number;
  auto: number;
  oldestSave: SaveMetadata | null;
  newestSave: SaveMetadata | null;
}

/**
 * 存档管理Composable
 */
export function useSave() {
  // ========== 响应式状态 ==========

  /** 是否已初始化 */
  const isInitialized = ref(false);

  /** 是否正在处理 */
  const isProcessing = ref(false);

  /** 错误信息 */
  const error = ref<string | null>(null);

  /** 存档列表 */
  const saveList = ref<SaveMetadata[]>([]);

  /** 当前加载的存档 */
  const currentSave = ref<SaveMetadata | null>(null);

  /** 自动存档配置 */
  const autoSaveConfig = ref<AutoSaveConfig>(saveService.getAutoSaveConfig());

  /** 存档统计 */
  const saveStats = ref<SaveStats>({
    total: 0,
    manual: 0,
    auto: 0,
    oldestSave: null,
    newestSave: null,
  });

  /** 最后一次自动存档 */
  const lastAutoSave = ref<SaveMetadata | null>(null);

  /** 自动存档回调清理函数 */
  let autoSaveUnsubscribe: (() => void) | null = null;

  /** 存档加载完成回调清理函数 */
  let loadCompleteUnsubscribe: (() => void) | null = null;

  // ========== 计算属性 ==========

  /** 手动存档列表 */
  const manualSaveList = computed(() => saveList.value.filter(s => !s.isAutoSave));

  /** 自动存档列表 */
  const autoSaveList = computed(() => saveList.value.filter(s => s.isAutoSave === true));

  /** 是否有存档 */
  const hasSaves = computed(() => saveList.value.length > 0);

  /** 是否启用自动存档 */
  const isAutoSaveEnabled = computed(() => autoSaveConfig.value.enabled);

  // ========== 内部方法 ==========

  /**
   * 初始化
   */
  const initialize = async (): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      await saveService.initialize();
      await refreshList();
      await refreshStats();

      // 同步自动存档配置
      autoSaveConfig.value = saveService.getAutoSaveConfig();

      // 注册自动存档事件回调
      autoSaveUnsubscribe = saveService.onAutoSave((save, err) => {
        if (save) {
          lastAutoSave.value = {
            id: save.id,
            name: save.name,
            createdAt: save.createdAt,
            updatedAt: save.updatedAt,
            version: save.version,
            isAutoSave: save.isAutoSave,
            saveSource: save.saveSource,
          };
          // 刷新列表
          refreshList();
          refreshStats();
          console.log('[useSave] 自动存档完成:', save.name);
        } else if (err) {
          console.error('[useSave] 自动存档失败:', err);
        }
      });

      // **关键修复**：注册存档加载完成事件回调
      // 当存档加载成功后，通知 mvuStore 刷新本地缓存数据
      loadCompleteUnsubscribe = saveService.onLoadComplete(async saveData => {
        console.log('[useSave] 存档加载完成，通知 mvuStore 刷新数据...');
        try {
          const mvuStore = useMvuStore();
          // 刷新 MVU 数据，使本地缓存与后台数据同步
          await mvuStore.loadMvuData();
          console.log('[useSave] mvuStore 数据已刷新，stat_data 键:', Object.keys(mvuStore.statData || {}));
        } catch (refreshErr) {
          console.error('[useSave] 刷新 mvuStore 数据失败:', refreshErr);
        }
      });

      isInitialized.value = true;
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 刷新存档列表
   */
  const refreshList = async (): Promise<void> => {
    try {
      saveList.value = await saveService.listSaves();
    } catch (err) {
      console.error('[useSave] 刷新列表失败:', err);
    }
  };

  /**
   * 刷新存档统计
   */
  const refreshStats = async (): Promise<void> => {
    try {
      saveStats.value = await saveService.getSaveStats();
    } catch (err) {
      console.error('[useSave] 刷新统计失败:', err);
    }
  };

  // ========== 公共方法 ==========

  /**
   * 创建新存档
   * @param name 存档名称
   * @param customData 自定义数据
   */
  const createSave = async (name: string, customData?: Record<string, any>): Promise<GameSaveData | null> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const save = await saveService.createSave(name, customData);

      if (save) {
        await refreshList();
        currentSave.value = {
          id: save.id,
          name: save.name,
          createdAt: save.createdAt,
          updatedAt: save.updatedAt,
          version: save.version,
        };
      }

      return save;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '创建存档失败';
      return null;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 更新存档
   * @param id 存档ID
   * @param customData 自定义数据更新
   */
  const updateSave = async (id: string, customData?: Record<string, any>): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const success = await saveService.updateSave(id, customData);

      if (success) {
        await refreshList();
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新存档失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 加载存档
   * @param id 存档ID
   */
  const loadSave = async (id: string): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const success = await saveService.loadSave(id);

      if (success) {
        const metadata = saveList.value.find(s => s.id === id);
        if (metadata) {
          currentSave.value = metadata;
        }
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载存档失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 删除存档
   * @param id 存档ID
   */
  const deleteSave = async (id: string): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const success = await saveService.deleteSave(id);

      if (success) {
        await refreshList();
        if (currentSave.value?.id === id) {
          currentSave.value = null;
        }
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '删除存档失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 导出存档
   * @param id 存档ID
   */
  const exportSave = async (id: string): Promise<string | null> => {
    try {
      isProcessing.value = true;
      error.value = null;

      return await saveService.exportSave(id);
    } catch (err) {
      error.value = err instanceof Error ? err.message : '导出存档失败';
      return null;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 导入存档
   * @param jsonString JSON字符串
   * @param newName 新名称
   */
  const importSave = async (jsonString: string, newName?: string): Promise<GameSaveData | null> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const save = await saveService.importSave(jsonString, newName);

      if (save) {
        await refreshList();
      }

      return save;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '导入存档失败';
      return null;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 快速保存
   */
  const quickSave = async (): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const success = await saveService.quickSave();

      if (success) {
        await refreshList();
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '快速保存失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 快速加载
   */
  const quickLoad = async (): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const success = await saveService.quickLoad();

      if (success) {
        await refreshList();
        if (saveList.value.length > 0) {
          currentSave.value = saveList.value[0];
        }
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '快速加载失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  // ========== 自动存档方法 ==========

  /**
   * 更新自动存档配置
   */
  const updateAutoSaveConfig = (config: Partial<AutoSaveConfig>): void => {
    saveService.updateAutoSaveConfig(config);
    autoSaveConfig.value = saveService.getAutoSaveConfig();
  };

  /**
   * 切换自动存档开关
   */
  const toggleAutoSave = (): void => {
    updateAutoSaveConfig({ enabled: !autoSaveConfig.value.enabled });
  };

  /**
   * 切换AI回复后自动存档
   */
  const toggleSaveOnAIResponse = (): void => {
    updateAutoSaveConfig({ saveOnAIResponse: !autoSaveConfig.value.saveOnAIResponse });
  };

  /**
   * 设置最大自动存档数量
   */
  const setMaxAutoSaves = (count: number): void => {
    if (count >= 1 && count <= 50) {
      updateAutoSaveConfig({ maxAutoSaves: count });
    }
  };

  /**
   * 设置自动存档前缀
   */
  const setAutoSavePrefix = (prefix: string): void => {
    updateAutoSaveConfig({ autoSavePrefix: prefix || '[自动]' });
  };

  /**
   * 重置自动存档配置
   */
  const resetAutoSaveConfig = (): void => {
    saveService.resetAutoSaveConfig();
    autoSaveConfig.value = saveService.getAutoSaveConfig();
  };

  /**
   * 手动触发自动存档（用于测试）
   */
  const triggerAutoSave = async (): Promise<GameSaveData | null> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const save = await saveService.autoSaveOnAIResponse();

      if (save) {
        await refreshList();
        await refreshStats();
      }

      return save;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '自动存档失败';
      return null;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 清理所有自动存档
   */
  const clearAllAutoSaves = async (): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const autoSaves = await saveService.listAutoSaves();

      for (const save of autoSaves) {
        await saveService.deleteSave(save.id);
      }

      await refreshList();
      await refreshStats();

      console.log('[useSave] 已清理所有自动存档，共', autoSaves.length, '个');
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '清理自动存档失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 将自动存档转换为手动存档
   */
  const convertAutoSaveToManual = async (id: string, newName?: string): Promise<boolean> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const save = await saveService.getSave(id);
      if (!save || !save.isAutoSave) {
        error.value = '存档不存在或不是自动存档';
        return false;
      }

      // 导出再导入，生成新的手动存档
      const json = await saveService.exportSave(id);
      if (!json) {
        error.value = '导出存档失败';
        return false;
      }

      const newSave = await saveService.importSave(json, newName || save.name.replace(/^\[自动\]\s*/, ''));

      if (newSave) {
        // 删除原自动存档
        await saveService.deleteSave(id);
        await refreshList();
        await refreshStats();
        return true;
      }

      return false;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '转换存档失败';
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 下载存档文件
   * @param id 存档ID
   * @param filename 文件名
   */
  const downloadSave = async (id: string, filename?: string): Promise<void> => {
    try {
      const json = await exportSave(id);
      if (!json) return;

      const metadata = saveList.value.find(s => s.id === id);
      const name = filename || `${metadata?.name || 'save'}_${new Date().toISOString().slice(0, 10)}.json`;

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      error.value = err instanceof Error ? err.message : '下载存档失败';
    }
  };

  /**
   * 从文件上传存档
   * @param file 文件对象
   * @param newName 新名称
   */
  const uploadSave = async (file: File, newName?: string): Promise<GameSaveData | null> => {
    try {
      isProcessing.value = true;
      error.value = null;

      const text = await file.text();
      return await importSave(text, newName);
    } catch (err) {
      error.value = err instanceof Error ? err.message : '上传存档失败';
      return null;
    } finally {
      isProcessing.value = false;
    }
  };

  // ========== 生命周期 ==========

  onMounted(() => {
    // 自动初始化
    initialize();
  });

  onUnmounted(() => {
    // 清理自动存档回调
    if (autoSaveUnsubscribe) {
      autoSaveUnsubscribe();
      autoSaveUnsubscribe = null;
    }
    // 清理存档加载完成回调
    if (loadCompleteUnsubscribe) {
      loadCompleteUnsubscribe();
      loadCompleteUnsubscribe = null;
    }
  });

  // ========== 返回公共接口 ==========

  return {
    // 状态
    isInitialized,
    isProcessing,
    error,
    saveList,
    currentSave,
    autoSaveConfig,
    saveStats,
    lastAutoSave,

    // 计算属性
    manualSaveList,
    autoSaveList,
    hasSaves,
    isAutoSaveEnabled,

    // 基本方法
    initialize,
    refreshList,
    refreshStats,
    createSave,
    updateSave,
    loadSave,
    deleteSave,
    exportSave,
    importSave,
    quickSave,
    quickLoad,
    downloadSave,
    uploadSave,

    // 自动存档方法
    updateAutoSaveConfig,
    toggleAutoSave,
    toggleSaveOnAIResponse,
    setMaxAutoSaves,
    setAutoSavePrefix,
    resetAutoSaveConfig,
    triggerAutoSave,
    clearAllAutoSaves,
    convertAutoSaveToManual,

    // 服务实例
    service: saveService,
  };
}
