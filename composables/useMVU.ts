/**
 * MC房子 - MVU变量Composable
 * 在Vue组件中方便地使用MVU变量功能
 * 增强版 - 支持自动刷新、更新事件监听和初始化重试
 */

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useMvuStore } from '../stores/mvuStore';
import type { MvuData, VariableOption } from '../types/mvu';

/** 更新回调类型 */
type UpdateCallback = (data: MvuData) => void;

/** 初始化状态枚举 */
type InitState = 'pending' | 'initializing' | 'success' | 'failed' | 'retrying';

/**
 * 使用MVU Store
 * @param options 变量选项
 */
export function useMVU(options?: VariableOption) {
  const store = useMvuStore();

  /** 更新版本号（用于强制触发响应式更新） */
  const updateVersion = ref(0);

  /** 初始化状态 */
  const initState = ref<InitState>('pending');

  /** 初始化错误信息 */
  const initError = ref<string | null>(null);

  /** 取消更新监听的函数 */
  let unsubscribeUpdate: (() => void) | null = null;

  /** 重试定时器 */
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  /** 最大重试次数 */
  const MAX_RETRIES = 3;
  /** 重试间隔（毫秒） */
  const RETRY_DELAY = 1000;
  /** 当前重试次数 */
  let retryCount = 0;

  /**
   * 执行初始化
   */
  const doInitialize = async (): Promise<boolean> => {
    try {
      initState.value = 'initializing';
      initError.value = null;

      await store.initialize(options);

      // 验证初始化是否成功
      if (store.isMvuAvailable && store.mvuData) {
        initState.value = 'success';
        console.log('[useMVU] MVU初始化成功');
        return true;
      }

      // MVU框架不可用，但没有报错
      if (!store.isMvuAvailable) {
        initState.value = 'failed';
        initError.value = 'MVU框架不可用';
        console.warn('[useMVU] MVU框架不可用');
        return false;
      }

      // 数据为空
      if (!store.mvuData) {
        initState.value = 'failed';
        initError.value = 'MVU数据为空';
        console.warn('[useMVU] MVU数据为空');
        return false;
      }

      initState.value = 'success';
      return true;
    } catch (err) {
      initState.value = 'failed';
      initError.value = err instanceof Error ? err.message : '初始化失败';
      console.error('[useMVU] MVU初始化失败:', err);
      return false;
    }
  };

  /**
   * 安排重试
   */
  const scheduleRetry = (): void => {
    if (retryCount >= MAX_RETRIES) {
      console.warn('[useMVU] 已达最大重试次数，停止重试');
      initState.value = 'failed';
      return;
    }

    retryCount++;
    initState.value = 'retrying';
    const delay = RETRY_DELAY * retryCount;

    console.log(`[useMVU] 将在 ${delay}ms 后进行第 ${retryCount} 次重试...`);

    retryTimer = setTimeout(async () => {
      const success = await doInitialize();
      if (!success && retryCount < MAX_RETRIES) {
        scheduleRetry();
      }
    }, delay);
  };

  /**
   * 手动重试初始化
   */
  const retryInitialize = async (): Promise<boolean> => {
    // 清除之前的重试定时器
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    retryCount = 0;
    return await doInitialize();
  };

  // 初始化
  onMounted(async () => {
    console.log('[useMVU] onMounted, isMvuAvailable:', store.isMvuAvailable);

    // 如果store已经初始化成功，直接使用
    if (store.isMvuAvailable && store.mvuData) {
      console.log('[useMVU] Store已初始化，跳过初始化');
      initState.value = 'success';
    } else {
      // 执行初始化
      const success = await doInitialize();

      // 如果初始化失败，安排重试
      if (!success) {
        scheduleRetry();
      }
    }

    // 注册更新结束事件监听，自动刷新
    unsubscribeUpdate = store.onUpdateEnd(() => {
      console.log('[useMVU] 收到变量更新结束事件，触发刷新');
      updateVersion.value++;

      // 如果之前初始化失败，现在收到更新事件说明MVU已就绪
      if (initState.value === 'failed' || initState.value === 'retrying') {
        initState.value = 'success';
        initError.value = null;
        console.log('[useMVU] MVU已就绪（通过更新事件确认）');
      }
    });
  });

  onUnmounted(() => {
    // 取消更新监听
    if (unsubscribeUpdate) {
      unsubscribeUpdate();
      unsubscribeUpdate = null;
    }

    // 清除重试定时器
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  });

  /**
   * 手动触发刷新（强制更新版本号）
   */
  const forceRefresh = () => {
    updateVersion.value++;
    return store.refresh();
  };

  /**
   * 注册更新回调（当MVU数据更新时调用）
   * @param callback 回调函数
   * @returns 取消监听的函数
   */
  const onUpdate = (callback: UpdateCallback): (() => void) => {
    return store.onUpdateEnd(callback);
  };

  return {
    // 状态
    mvuData: computed(() => {
      updateVersion.value; // 依赖更新版本号
      return store.mvuData;
    }),
    statData: computed(() => {
      updateVersion.value; // 依赖更新版本号
      return store.statData;
    }),
    displayData: computed(() => {
      updateVersion.value;
      return store.displayData;
    }),
    deltaData: computed(() => {
      updateVersion.value;
      return store.deltaData;
    }),
    isLoading: computed(() => store.isLoading),
    error: computed(() => store.error),
    isMvuAvailable: computed(() => store.isMvuAvailable),
    updateVersion, // 暴露更新版本号，便于组件监听

    // 新增：初始化状态
    initState,
    initError,

    // 方法
    refresh: store.refresh,
    forceRefresh,
    getVariable: store.getVariable,
    setVariable: store.setVariable,
    setVariables: store.setVariables,
    updateVariable: store.updateVariable,
    clearError: store.clearError,
    onUpdate, // 暴露更新监听方法
    retryInitialize, // 新增：手动重试初始化
  };
}

/**
 * 使用单个MVU变量（响应式）
 * @param path 变量路径
 * @param defaultValue 默认值
 * @param options 变量选项
 */
export function useMvuVariable<T = any>(path: string, defaultValue?: T, options?: VariableOption) {
  const store = useMvuStore();
  const value = ref<T>(defaultValue as T);
  const isUpdating = ref(false);
  const error = ref<string | null>(null);

  // 初始化
  onMounted(async () => {
    if (!store.isMvuAvailable) {
      await store.initialize(options);
    }
    loadValue();
  });

  // 监听store变化
  watch(
    () => store.statData,
    () => {
      loadValue();
    },
    { deep: true },
  );

  // 加载变量值
  const loadValue = () => {
    try {
      const newValue = store.getVariable(path, defaultValue);
      value.value = newValue;
      error.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载变量失败';
    }
  };

  // 设置变量值
  const setValue = async (newValue: T, reason?: string): Promise<boolean> => {
    try {
      isUpdating.value = true;
      error.value = null;

      const success = await store.setVariable(path, newValue, reason);
      if (success) {
        value.value = newValue;
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置变量失败';
      return false;
    } finally {
      isUpdating.value = false;
    }
  };

  // 更新变量值（基于当前值）
  const updateValue = async (updater: (current: T) => T, reason?: string): Promise<boolean> => {
    try {
      isUpdating.value = true;
      error.value = null;

      const newValue = updater(value.value);
      const success = await store.setVariable(path, newValue, reason);
      if (success) {
        value.value = newValue;
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新变量失败';
      return false;
    } finally {
      isUpdating.value = false;
    }
  };

  return {
    value,
    isUpdating,
    error,
    setValue,
    updateValue,
    refresh: loadValue,
  };
}

/**
 * 使用多个MVU变量
 * @param paths 变量路径列表
 * @param options 变量选项
 */
export function useMvuVariables(paths: string[], options?: VariableOption) {
  const store = useMvuStore();
  const values = ref<Record<string, any>>({});
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 初始化
  onMounted(async () => {
    if (!store.isMvuAvailable) {
      await store.initialize(options);
    }
    loadValues();
  });

  // 监听store变化
  watch(
    () => store.statData,
    () => {
      loadValues();
    },
    { deep: true },
  );

  // 加载所有变量值
  const loadValues = () => {
    try {
      const newValues: Record<string, any> = {};
      for (const path of paths) {
        newValues[path] = store.getVariable(path);
      }
      values.value = newValues;
      error.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载变量失败';
    }
  };

  // 获取单个变量值
  const getValue = (path: string): any => {
    return values.value[path];
  };

  // 设置单个变量值
  const setValue = async (path: string, value: any, reason?: string): Promise<boolean> => {
    try {
      isLoading.value = true;
      error.value = null;

      const success = await store.setVariable(path, value, reason);
      if (success) {
        values.value[path] = value;
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置变量失败';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  // 批量设置变量
  const setValues = async (updates: Record<string, any>, reason?: string): Promise<boolean> => {
    try {
      isLoading.value = true;
      error.value = null;

      const success = await store.setVariables(updates, reason);
      if (success) {
        Object.assign(values.value, updates);
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '批量设置变量失败';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    values,
    isLoading,
    error,
    getValue,
    setValue,
    setValues,
    refresh: loadValues,
  };
}

/**
 * 使用全屏功能
 */
export function useFullscreen() {
  const isFullscreen = ref(false);
  const targetElement = ref<HTMLElement | null>(null);

  const enterFullscreen = async (element?: HTMLElement) => {
    try {
      const el = element || targetElement.value || document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      } else if ((el as any).mozRequestFullScreen) {
        await (el as any).mozRequestFullScreen();
      } else if ((el as any).msRequestFullscreen) {
        await (el as any).msRequestFullscreen();
      }
      isFullscreen.value = true;
    } catch (err) {
      console.error('[useFullscreen] 进入全屏失败:', err);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      isFullscreen.value = false;
    } catch (err) {
      console.error('[useFullscreen] 退出全屏失败:', err);
    }
  };

  const toggleFullscreen = async (element?: HTMLElement) => {
    if (isFullscreen.value) {
      await exitFullscreen();
    } else {
      await enterFullscreen(element);
    }
  };

  // 监听全屏变化
  const handleFullscreenChange = () => {
    isFullscreen.value = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  };

  onMounted(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  });

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
  });

  return {
    isFullscreen,
    targetElement,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}
