/**
 * MC房子 - 历史输入记录 Composable
 * 参考归墟Plus的LocalStorage存储逻辑实现
 * 提供输入历史的记录、导航和持久化功能
 */

import { computed, onMounted, ref } from 'vue';

/**
 * 历史输入配置
 */
export interface InputHistoryConfig {
  /** 最大历史记录数量 */
  maxItems: number;
  /** 存储键名 */
  storageKey: string;
  /** 是否自动保存 */
  autoSave: boolean;
  /** 是否去重 */
  deduplicate: boolean;
}

/**
 * 历史输入记录项
 */
export interface InputHistoryItem {
  /** 输入内容 */
  content: string;
  /** 记录时间戳 */
  timestamp: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: InputHistoryConfig = {
  maxItems: 50,
  storageKey: 'mclite_input_history',
  autoSave: true,
  deduplicate: true,
};

/**
 * 历史输入记录 Composable
 * 提供类似命令行的上下箭头历史导航功能
 */
export function useInputHistory(options: Partial<InputHistoryConfig> = {}) {
  // ========== 配置合并 ==========
  const config = { ...DEFAULT_CONFIG, ...options };

  // ========== 响应式状态 ==========

  /** 历史记录列表（最新的在前面） */
  const historyList = ref<InputHistoryItem[]>([]);

  /** 当前导航索引（-1表示未在历史导航中） */
  const currentIndex = ref(-1);

  /** 临时保存的当前输入（用于从历史返回） */
  const tempInput = ref('');

  /** 是否已初始化 */
  const isInitialized = ref(false);

  // ========== 计算属性 ==========

  /** 历史记录数量 */
  const historyCount = computed(() => historyList.value.length);

  /** 是否有历史记录 */
  const hasHistory = computed(() => historyList.value.length > 0);

  /** 是否在历史导航中 */
  const isNavigating = computed(() => currentIndex.value >= 0);

  /** 是否可以向前（更旧的记录） */
  const canGoBack = computed(() => currentIndex.value < historyList.value.length - 1);

  /** 是否可以向后（更新的记录/返回当前输入） */
  const canGoForward = computed(() => currentIndex.value >= 0);

  /** 当前历史项 */
  const currentHistoryItem = computed(() => {
    if (currentIndex.value >= 0 && currentIndex.value < historyList.value.length) {
      return historyList.value[currentIndex.value];
    }
    return null;
  });

  /** 只包含内容的历史列表（用于简单显示） */
  const historyContents = computed(() => historyList.value.map(item => item.content));

  // ========== 持久化方法 ==========

  /**
   * 从LocalStorage加载历史记录
   */
  const loadFromStorage = (): void => {
    try {
      const stored = localStorage.getItem(config.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // 兼容旧格式（纯字符串数组）和新格式（对象数组）
          historyList.value = parsed.map(item => {
            if (typeof item === 'string') {
              return { content: item, timestamp: Date.now() };
            }
            return item as InputHistoryItem;
          });
          console.log('[useInputHistory] 已加载历史记录，共', historyList.value.length, '条');
        }
      }
    } catch (err) {
      console.error('[useInputHistory] 加载历史记录失败:', err);
      historyList.value = [];
    }
    isInitialized.value = true;
  };

  /**
   * 保存历史记录到LocalStorage
   */
  const saveToStorage = (): void => {
    try {
      localStorage.setItem(config.storageKey, JSON.stringify(historyList.value));
      console.log('[useInputHistory] 历史记录已保存');
    } catch (err) {
      console.error('[useInputHistory] 保存历史记录失败:', err);
    }
  };

  // ========== 核心方法 ==========

  /**
   * 添加新的输入到历史记录
   * @param content 输入内容
   */
  const addToHistory = (content: string): void => {
    if (!content || !content.trim()) return;

    const trimmedContent = content.trim();

    // 去重处理：移除已存在的相同记录
    if (config.deduplicate) {
      const existingIndex = historyList.value.findIndex(item => item.content === trimmedContent);
      if (existingIndex >= 0) {
        historyList.value.splice(existingIndex, 1);
      }
    }

    // 添加到列表头部
    historyList.value.unshift({
      content: trimmedContent,
      timestamp: Date.now(),
    });

    // 限制最大数量
    if (historyList.value.length > config.maxItems) {
      historyList.value = historyList.value.slice(0, config.maxItems);
    }

    // 重置导航状态
    resetNavigation();

    // 自动保存
    if (config.autoSave) {
      saveToStorage();
    }

    console.log('[useInputHistory] 新记录已添加:', trimmedContent.slice(0, 50) + '...');
  };

  /**
   * 开始历史导航（保存当前输入）
   * @param currentInput 当前输入框的内容
   */
  const startNavigation = (currentInput: string): void => {
    if (currentIndex.value === -1) {
      tempInput.value = currentInput;
    }
  };

  /**
   * 向前导航（获取更旧的记录）
   * @param currentInput 当前输入框的内容（首次导航时保存）
   * @returns 历史记录内容，如果没有则返回null
   */
  const navigateBack = (currentInput: string): string | null => {
    if (!hasHistory.value) return null;

    // 首次导航，保存当前输入
    if (currentIndex.value === -1) {
      tempInput.value = currentInput;
    }

    // 向前移动
    if (currentIndex.value < historyList.value.length - 1) {
      currentIndex.value++;
      return historyList.value[currentIndex.value].content;
    }

    // 已到最旧记录
    return null;
  };

  /**
   * 向后导航（获取更新的记录或返回原始输入）
   * @returns 历史记录内容或原始输入，如果已在最前则返回null
   */
  const navigateForward = (): string | null => {
    if (currentIndex.value < 0) return null;

    // 向后移动
    currentIndex.value--;

    if (currentIndex.value >= 0) {
      return historyList.value[currentIndex.value].content;
    }

    // 返回到原始输入
    return tempInput.value;
  };

  /**
   * 重置导航状态
   */
  const resetNavigation = (): void => {
    currentIndex.value = -1;
    tempInput.value = '';
  };

  /**
   * 获取指定索引的历史记录
   * @param index 索引
   */
  const getHistoryAt = (index: number): InputHistoryItem | null => {
    if (index >= 0 && index < historyList.value.length) {
      return historyList.value[index];
    }
    return null;
  };

  /**
   * 删除指定索引的历史记录
   * @param index 索引
   */
  const removeHistoryAt = (index: number): boolean => {
    if (index >= 0 && index < historyList.value.length) {
      historyList.value.splice(index, 1);

      // 调整当前索引
      if (currentIndex.value >= index && currentIndex.value > 0) {
        currentIndex.value--;
      }

      if (config.autoSave) {
        saveToStorage();
      }

      return true;
    }
    return false;
  };

  /**
   * 删除指定内容的历史记录
   * @param content 内容
   */
  const removeHistoryByContent = (content: string): boolean => {
    const index = historyList.value.findIndex(item => item.content === content);
    if (index >= 0) {
      return removeHistoryAt(index);
    }
    return false;
  };

  /**
   * 清空所有历史记录
   */
  const clearHistory = (): void => {
    historyList.value = [];
    resetNavigation();

    if (config.autoSave) {
      saveToStorage();
    }

    console.log('[useInputHistory] 历史记录已清空');
  };

  /**
   * 搜索历史记录
   * @param query 搜索关键词
   * @returns 匹配的历史记录列表
   */
  const searchHistory = (query: string): InputHistoryItem[] => {
    if (!query || !query.trim()) {
      return historyList.value;
    }

    const lowerQuery = query.toLowerCase();
    return historyList.value.filter(item => item.content.toLowerCase().includes(lowerQuery));
  };

  /**
   * 处理键盘事件（绑定到输入框）
   * @param event 键盘事件
   * @param currentInput 当前输入
   * @returns 新的输入内容，如果不需要更改则返回null
   */
  const handleKeyboardNavigation = (event: KeyboardEvent, currentInput: string): string | null => {
    // 上箭头：向前导航（更旧的记录）
    if (event.key === 'ArrowUp') {
      // 只有在输入框内容为空或已在导航中时才触发
      if (!currentInput.trim() || isNavigating.value) {
        const result = navigateBack(currentInput);
        if (result !== null) {
          event.preventDefault();
          return result;
        }
      }
    }

    // 下箭头：向后导航（更新的记录/返回原始输入）
    if (event.key === 'ArrowDown') {
      if (isNavigating.value) {
        const result = navigateForward();
        if (result !== null) {
          event.preventDefault();
          return result;
        }
      }
    }

    // Escape：取消导航，恢复原始输入
    if (event.key === 'Escape' && isNavigating.value) {
      const original = tempInput.value;
      resetNavigation();
      event.preventDefault();
      return original;
    }

    return null;
  };

  /**
   * 导出历史记录为JSON
   */
  const exportHistory = (): string => {
    return JSON.stringify(historyList.value, null, 2);
  };

  /**
   * 导入历史记录
   * @param json JSON字符串
   * @param merge 是否合并（true）还是替换（false）
   */
  const importHistory = (json: string, merge: boolean = false): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        throw new Error('无效的历史记录格式');
      }

      const items: InputHistoryItem[] = parsed.map(item => {
        if (typeof item === 'string') {
          return { content: item, timestamp: Date.now() };
        }
        return item as InputHistoryItem;
      });

      if (merge) {
        // 合并模式：添加不重复的记录
        items.forEach(item => {
          if (!historyList.value.some(existing => existing.content === item.content)) {
            historyList.value.push(item);
          }
        });
        // 按时间戳排序（最新的在前）
        historyList.value.sort((a, b) => b.timestamp - a.timestamp);
        // 限制数量
        if (historyList.value.length > config.maxItems) {
          historyList.value = historyList.value.slice(0, config.maxItems);
        }
      } else {
        // 替换模式
        historyList.value = items.slice(0, config.maxItems);
      }

      if (config.autoSave) {
        saveToStorage();
      }

      console.log('[useInputHistory] 历史记录已导入');
      return true;
    } catch (err) {
      console.error('[useInputHistory] 导入历史记录失败:', err);
      return false;
    }
  };

  // ========== 生命周期 ==========

  onMounted(() => {
    loadFromStorage();
  });

  // ========== 返回公共接口 ==========

  return {
    // 状态
    historyList,
    currentIndex,
    tempInput,
    isInitialized,

    // 计算属性
    historyCount,
    hasHistory,
    isNavigating,
    canGoBack,
    canGoForward,
    currentHistoryItem,
    historyContents,

    // 核心方法
    addToHistory,
    navigateBack,
    navigateForward,
    startNavigation,
    resetNavigation,
    handleKeyboardNavigation,

    // 历史管理方法
    getHistoryAt,
    removeHistoryAt,
    removeHistoryByContent,
    clearHistory,
    searchHistory,

    // 持久化方法
    loadFromStorage,
    saveToStorage,
    exportHistory,
    importHistory,

    // 配置
    config,
  };
}
