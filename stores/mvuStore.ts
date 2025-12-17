/**
 * MC房子 - MVU变量Store
 * 使用Pinia管理MVU变量的状态
 * 集成酒馆MVU框架的事件监听，实现自动响应后台变量变化
 */

import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type { BatchCommandResult, CommandExecutionResult, VariableCommand } from '../types';
import type { MvuData, VariableOption, VariableWatchCallback } from '../types/mvu';

/**
 * 获取全局 Mvu 对象
 */
function getMvuGlobal(): typeof Mvu | null {
  try {
    if (typeof window !== 'undefined' && (window as any).Mvu) {
      return (window as any).Mvu;
    }
  } catch {
    // 忽略错误
  }
  return null;
}

/**
 * 获取全局 eventOn 函数
 */
function getEventOn(): ((event: string, callback: (...args: any[]) => void) => void) | null {
  try {
    if (typeof window !== 'undefined' && typeof (window as any).eventOn === 'function') {
      return (window as any).eventOn;
    }
  } catch {
    // 忽略错误
  }
  return null;
}

/**
 * 获取全局 eventOff 函数
 */
function getEventOff(): ((event: string, callback: (...args: any[]) => void) => void) | null {
  try {
    if (typeof window !== 'undefined' && typeof (window as any).eventOff === 'function') {
      return (window as any).eventOff;
    }
  } catch {
    // 忽略错误
  }
  return null;
}

/**
 * MVU服务封装
 * 提供与酒馆MVU框架交互的方法，使用正确的 Mvu API
 */
const mvuService = {
  /**
   * 检查MVU是否可用
   */
  isMvuAvailable(): boolean {
    const mvu = getMvuGlobal();
    return !!(mvu && typeof mvu.getMvuData === 'function');
  },

  /**
   * 获取MVU数据
   */
  getMvuData(options?: VariableOption): MvuData | null {
    try {
      const mvu = getMvuGlobal();
      if (!mvu) return null;
      return mvu.getMvuData(options || { type: 'message', message_id: 'latest' }) || null;
    } catch (err) {
      console.error('[MvuService] 获取MVU数据失败:', err);
      return null;
    }
  },

  /**
   * 获取变量值
   */
  getVariable(path: string, options?: VariableOption & { default_value?: any }): any {
    try {
      const mvu = getMvuGlobal();
      if (!mvu) return options?.default_value;

      const mvuData = this.getMvuData(options);
      if (!mvuData) return options?.default_value;

      return mvu.getMvuVariable(mvuData, path, {
        category: 'stat',
        default_value: options?.default_value,
      });
    } catch (err) {
      console.error('[MvuService] 获取变量失败:', err);
      return options?.default_value;
    }
  },

  /**
   * 设置变量值
   * 支持创建新路径（MVU原生API不支持在不存在的路径设置值）
   */
  async setVariable(path: string, value: any, options?: VariableOption & { reason?: string }): Promise<boolean> {
    try {
      const mvu = getMvuGlobal();
      if (!mvu) {
        console.error('[MvuService] 设置变量失败: Mvu 对象不可用');
        return false;
      }

      const mvuData = this.getMvuData(options);
      if (!mvuData) {
        console.error('[MvuService] 设置变量失败: 无法获取 MvuData');
        return false;
      }

      // 确保 stat_data 和 display_data 存在
      if (!mvuData.stat_data) {
        console.warn('[MvuService] stat_data 为空，初始化为空对象');
        mvuData.stat_data = {};
      }
      if (!mvuData.display_data) {
        mvuData.display_data = {};
      }

      console.log('[MvuService] 尝试设置变量:', {
        path,
        valueType: typeof value,
        valuePreview: typeof value === 'object' ? JSON.stringify(value).substring(0, 100) + '...' : value,
        stat_data_keys: Object.keys(mvuData.stat_data || {}),
      });

      // 先尝试使用 MVU 原生 API
      let success = false;
      try {
        success = await mvu.setMvuVariable(mvuData, path, value, {
          reason: options?.reason,
          is_recursive: true,
        });
      } catch (apiErr) {
        console.warn('[MvuService] MVU原生API调用异常:', apiErr);
        success = false;
      }

      // 如果 MVU 原生 API 失败（可能是路径不存在），直接操作 stat_data
      if (!success) {
        console.log('[MvuService] MVU原生API失败，尝试直接设置 stat_data...');

        try {
          // 再次确保 stat_data 存在（可能在 API 调用过程中被修改）
          if (!mvuData.stat_data) {
            console.warn('[MvuService] stat_data 在 API 调用后变为空，重新初始化');
            mvuData.stat_data = {};
          }

          // 检查并创建路径的父级
          const pathParts = path.split('.');
          if (pathParts.length > 1) {
            // 确保父路径存在
            let current = mvuData.stat_data;
            for (let i = 0; i < pathParts.length - 1; i++) {
              const key = pathParts[i];
              if (current[key] === undefined || current[key] === null) {
                console.log(`[MvuService] 创建中间路径: ${pathParts.slice(0, i + 1).join('.')}`);
                current[key] = {};
              } else if (typeof current[key] !== 'object') {
                console.warn(`[MvuService] 路径 "${pathParts.slice(0, i + 1).join('.')}" 不是对象，无法继续`);
                return false;
              }
              current = current[key];
            }
          }

          // 使用 lodash 风格的路径设置（支持创建嵌套路径）
          this.setNestedValue(mvuData.stat_data, path, value);

          // 同时更新 display_data（用于显示变化）
          if (!mvuData.display_data) {
            mvuData.display_data = {};
          }
          const displayValue = options?.reason ? `新建 (${options.reason})` : `新建`;
          try {
            this.setNestedValue(mvuData.display_data, path, displayValue);
          } catch (displayErr) {
            // display_data 设置失败不影响主要功能
            console.warn('[MvuService] 设置 display_data 失败:', displayErr);
          }

          success = true;
          console.log('[MvuService] 直接设置 stat_data 成功');
        } catch (setErr) {
          console.error('[MvuService] 直接设置 stat_data 失败:', setErr);
          success = false;
        }
      }

      if (success) {
        // 替换更新后的数据
        try {
          await mvu.replaceMvuData(mvuData, options || { type: 'message', message_id: 'latest' });
          console.log('[MvuService] 数据已替换保存');
        } catch (replaceErr) {
          console.error('[MvuService] 替换数据失败:', replaceErr);
          return false;
        }
      } else {
        console.error('[MvuService] 变量设置失败');
      }

      return success;
    } catch (err) {
      console.error('[MvuService] 设置变量失败:', err);
      return false;
    }
  },

  /**
   * 在嵌套对象中设置值（支持创建不存在的路径）
   * 类似 lodash 的 _.set()
   */
  setNestedValue(obj: Record<string, any> | undefined | null, path: string, value: any): void {
    // 健壮性检查：如果 obj 为 undefined 或 null，抛出更明确的错误
    if (obj === undefined || obj === null) {
      throw new Error(`[setNestedValue] 目标对象为 ${obj}，无法设置路径 "${path}"`);
    }

    if (typeof obj !== 'object') {
      throw new Error(`[setNestedValue] 目标对象不是对象类型，无法设置路径 "${path}"`);
    }

    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      // 安全检查：确保 current 是对象
      if (current === null || current === undefined || typeof current !== 'object') {
        throw new Error(`[setNestedValue] 路径 "${keys.slice(0, i).join('.')}" 处的值不是对象，无法继续设置`);
      }
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        // 创建中间对象
        current[key] = {};
      }
      current = current[key];
    }

    // 设置最终值
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  },

  /**
   * 批量设置变量
   */
  async setVariables(variables: Record<string, any>, options?: VariableOption & { reason?: string }): Promise<boolean> {
    try {
      const mvu = getMvuGlobal();
      if (!mvu) return false;

      const mvuData = this.getMvuData(options);
      if (!mvuData) return false;

      // 批量设置每个变量
      for (const [path, value] of Object.entries(variables)) {
        await mvu.setMvuVariable(mvuData, path, value, {
          reason: options?.reason,
          is_recursive: false, // 批量设置时不每次触发事件
        });
      }

      // 替换更新后的数据
      await mvu.replaceMvuData(mvuData, options || { type: 'message', message_id: 'latest' });

      return true;
    } catch (err) {
      console.error('[MvuService] 批量设置变量失败:', err);
      return false;
    }
  },

  /**
   * 获取所有变量键
   */
  getAllVariableKeys(options?: VariableOption): string[] {
    try {
      const data = this.getMvuData(options);
      return data ? Object.keys(data.stat_data || {}) : [];
    } catch {
      return [];
    }
  },

  /**
   * 获取 MVU 事件常量
   */
  getEvents(): typeof Mvu.events | null {
    const mvu = getMvuGlobal();
    return mvu?.events || null;
  },
};

/**
 * 变量变化监听器类型
 */
interface VariableChangeListener {
  path: string;
  callback: VariableWatchCallback;
}

/**
 * 更新事件监听器类型
 */
type UpdateEventListener = (data: MvuData) => void;

/**
 * MVU Store
 */
export const useMvuStore = defineStore('mvu', () => {
  // ========== 状态 ==========

  /** 当前MVU数据 - 使用 shallowRef 提升性能 */
  const mvuData = shallowRef<MvuData | null>(null);

  /** MVU是否可用 */
  const isMvuAvailable = ref(false);

  /** 是否正在加载 */
  const isLoading = ref(false);

  /** 错误信息 */
  const error = ref<string | null>(null);

  /** 当前使用的变量选项 - 使用 'latest' 获取最新消息的MVU数据 */
  const currentOptions = ref<VariableOption>({ type: 'message', message_id: 'latest' });

  /** 变量监听器列表 */
  const variableListeners = ref<VariableChangeListener[]>([]);

  /** 更新结束事件监听器列表 */
  const updateEndListeners = ref<UpdateEventListener[]>([]);

  /** 是否已注册全局事件监听 */
  const isEventListenerRegistered = ref(false);

  /** 是否正在执行内部更新（防止事件处理覆盖数据） */
  const isInternalUpdate = ref(false);

  // ========== 内部事件处理函数 ==========

  /**
   * 处理变量更新开始事件
   */
  const handleVariableUpdateStarted = (variables: MvuData): void => {
    console.log('[MvuStore] 变量更新开始');
    // 更新本地数据（深拷贝确保响应式）
    if (variables) {
      try {
        mvuData.value = JSON.parse(JSON.stringify(variables));
      } catch (e) {
        mvuData.value = variables;
      }
    }
  };

  /**
   * 处理单个变量更新事件
   */
  const handleSingleVariableUpdated = (
    _statData: Record<string, any>,
    path: string,
    oldValue: any,
    newValue: any,
  ): void => {
    console.log(`[MvuStore] 变量更新: ${path}`, { oldValue, newValue });

    // 通知相关的监听器
    variableListeners.value.forEach(listener => {
      if (path === listener.path || path.startsWith(listener.path + '.')) {
        try {
          listener.callback(oldValue, newValue);
        } catch (err) {
          console.error(`[MvuStore] 变量监听器回调失败 (${listener.path}):`, err);
        }
      }
    });
  };

  /** 关键路径列表 - 这些路径必须存在（不能被意外删除） */
  const CRITICAL_PATHS = ['MC'];

  /**
   * 在嵌套对象中获取值
   * @param obj 对象
   * @param path 点分隔的路径
   */
  const getNestedValue = (obj: Record<string, any>, path: string): any => {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  };

  /**
   * 验证数据完整性
   * 参考归墟实现：检查关键路径和数据量变化
   * @param oldData 旧数据
   * @param newData 新数据
   */
  const validateDataIntegrity = (oldData: MvuData | null, newData: MvuData): boolean => {
    // 没有旧数据，接受新数据
    if (!oldData?.stat_data) return true;

    const oldKeys = Object.keys(oldData.stat_data);
    const newKeys = Object.keys(newData.stat_data || {});

    // 检查1：新数据不能丢失太多键（超过50%）
    if (oldKeys.length > 0 && newKeys.length < oldKeys.length * 0.5) {
      console.warn('[MvuStore] 数据验证失败：键数量减少过多', {
        oldCount: oldKeys.length,
        newCount: newKeys.length,
      });
      return false;
    }

    // 检查2：关键路径必须存在
    for (const path of CRITICAL_PATHS) {
      const oldValue = getNestedValue(oldData.stat_data, path);
      const newValue = getNestedValue(newData.stat_data || {}, path);

      // 如果旧数据有此路径，新数据不能丢失它
      if (oldValue !== undefined && newValue === undefined) {
        console.warn('[MvuStore] 数据验证失败：关键路径丢失', path);
        return false;
      }
    }

    return true;
  };

  /**
   * 处理变量更新结束事件
   * 参考归墟实现：优先信任 MVU 框架返回的数据，增强验证逻辑
   */
  const handleVariableUpdateEnded = (_variables: MvuData): void => {
    console.log('[MvuStore] 变量更新结束事件触发');

    // 如果正在执行内部更新，跳过事件处理
    // 因为 parseAndExecuteCommands 会自己正确更新数据
    if (isInternalUpdate.value) {
      console.log('[MvuStore] 正在执行内部更新，跳过事件处理（避免数据覆盖）');
      return;
    }

    // 从 MVU API 获取最新数据
    const latestData = mvuService.getMvuData(currentOptions.value);

    if (!latestData) {
      console.warn('[MvuStore] 获取到的最新数据为空，保持现有数据不变');
      return;
    }

    // 【增强】使用更完整的数据验证
    if (!validateDataIntegrity(mvuData.value, latestData)) {
      console.warn('[MvuStore] 数据验证失败，保持现有数据不变');
      return;
    }

    const newStatKeys = Object.keys(latestData.stat_data || {});

    // 正常更新数据 - 信任 MVU 框架返回的数据
    try {
      mvuData.value = JSON.parse(JSON.stringify(latestData));
      console.log('[MvuStore] 已从 MVU API 获取最新数据，stat_data 键:', newStatKeys);
    } catch (e) {
      mvuData.value = latestData;
    }

    // 通知所有更新结束监听器
    notifyUpdateEndListeners();
  };

  /**
   * 通知所有更新结束监听器
   * 提取为独立函数，方便在多处调用
   */
  const notifyUpdateEndListeners = (): void => {
    if (!mvuData.value) return;

    updateEndListeners.value.forEach(listener => {
      try {
        listener(mvuData.value!);
      } catch (err) {
        console.error('[MvuStore] 更新结束监听器回调失败:', err);
      }
    });
  };

  // ========== 计算属性 ==========

  /** stat_data（实际变量数据） */
  const statData = computed(() => mvuData.value?.stat_data || {});

  /** display_data（显示用的变量变化） */
  const displayData = computed(() => mvuData.value?.display_data || {});

  /** delta_data（最新变化的变量） */
  const deltaData = computed(() => mvuData.value?.delta_data || {});

  /** 已初始化的世界书列表 */
  const initializedLorebooks = computed(() => mvuData.value?.initialized_lorebooks || []);

  /** 所有变量键列表 */
  const allVariableKeys = computed(() => {
    if (!mvuData.value) return [];
    return mvuService.getAllVariableKeys(currentOptions.value);
  });

  // ========== Actions ==========

  /**
   * 注册全局MVU事件监听
   */
  const registerEventListeners = (): void => {
    if (isEventListenerRegistered.value) return;

    const eventOn = getEventOn();
    const events = mvuService.getEvents();

    if (!eventOn || !events) {
      console.warn('[MvuStore] 无法注册事件监听：eventOn 或 Mvu.events 不可用');
      return;
    }

    try {
      // 监听变量更新开始
      eventOn(events.VARIABLE_UPDATE_STARTED, handleVariableUpdateStarted);

      // 监听单个变量更新
      eventOn(events.SINGLE_VARIABLE_UPDATED, handleSingleVariableUpdated);

      // 监听变量更新结束
      eventOn(events.VARIABLE_UPDATE_ENDED, handleVariableUpdateEnded);

      isEventListenerRegistered.value = true;
      console.log('[MvuStore] 已注册 MVU 事件监听');
    } catch (err) {
      console.error('[MvuStore] 注册事件监听失败:', err);
    }
  };

  /**
   * 取消注册全局MVU事件监听
   */
  const unregisterEventListeners = (): void => {
    if (!isEventListenerRegistered.value) return;

    const eventOff = getEventOff();
    const events = mvuService.getEvents();

    if (!eventOff || !events) return;

    try {
      eventOff(events.VARIABLE_UPDATE_STARTED, handleVariableUpdateStarted);
      eventOff(events.SINGLE_VARIABLE_UPDATED, handleSingleVariableUpdated);
      eventOff(events.VARIABLE_UPDATE_ENDED, handleVariableUpdateEnded);

      isEventListenerRegistered.value = false;
      console.log('[MvuStore] 已取消 MVU 事件监听');
    } catch (err) {
      console.error('[MvuStore] 取消事件监听失败:', err);
    }
  };

  /** 初始化重试次数 */
  const MAX_INIT_RETRIES = 3;
  /** 初始化重试间隔（毫秒） */
  const INIT_RETRY_DELAY = 500;

  /**
   * 等待MVU框架可用
   * @param maxWaitTime 最大等待时间（毫秒）
   * @param checkInterval 检查间隔（毫秒）
   */
  const waitForMvuAvailable = async (maxWaitTime: number = 3000, checkInterval: number = 100): Promise<boolean> => {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      if (mvuService.isMvuAvailable()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return mvuService.isMvuAvailable();
  };

  /**
   * 初始化Store
   * 增强版：支持等待MVU框架加载和重试机制
   */
  const initialize = async (options?: VariableOption): Promise<void> => {
    try {
      isLoading.value = true;
      error.value = null;

      // 保存选项（在检查可用性之前保存，确保后续重试使用正确的选项）
      if (options) {
        currentOptions.value = options;
      }

      // 【关键修复】等待MVU框架可用，而不是立即检查
      console.log('[MvuStore] 等待MVU框架加载...');
      const mvuReady = await waitForMvuAvailable();

      // 检查MVU是否可用
      isMvuAvailable.value = mvuReady;

      if (!isMvuAvailable.value) {
        console.warn('[MvuStore] MVU变量框架未加载，使用模拟数据');
        // 使用模拟数据进行开发
        mvuData.value = {
          stat_data: {},
          display_data: {},
          delta_data: {},
          initialized_lorebooks: [],
        };
        // 【修复】设置一个延迟重试，以防MVU框架稍后加载
        scheduleInitRetry();
        return;
      }

      console.log('[MvuStore] MVU框架已就绪，开始初始化...');

      // 注册事件监听（带重试）
      await registerEventListenersWithRetry();

      // 从MVU框架加载数据（带重试）
      await loadMvuDataWithRetry();

      console.log('[MvuStore] 初始化完成');
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败';
      console.error('[MvuStore] 初始化失败:', err);
      // 【修复】初始化失败时也尝试重试
      scheduleInitRetry();
    } finally {
      isLoading.value = false;
    }
  };

  /** 初始化重试计数器 */
  let initRetryCount = 0;
  /** 初始化重试定时器 */
  let initRetryTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 调度初始化重试
   */
  const scheduleInitRetry = (): void => {
    if (initRetryCount >= MAX_INIT_RETRIES) {
      console.warn('[MvuStore] 已达到最大重试次数，停止重试');
      return;
    }

    if (initRetryTimer) {
      clearTimeout(initRetryTimer);
    }

    initRetryCount++;
    const delay = INIT_RETRY_DELAY * initRetryCount; // 递增延迟

    console.log(`[MvuStore] 将在 ${delay}ms 后进行第 ${initRetryCount} 次重试...`);

    initRetryTimer = setTimeout(async () => {
      // 再次检查MVU是否已可用
      if (mvuService.isMvuAvailable() && !isMvuAvailable.value) {
        console.log('[MvuStore] MVU框架现在可用，重新初始化...');
        isMvuAvailable.value = true;

        try {
          await registerEventListenersWithRetry();
          await loadMvuDataWithRetry();
          console.log('[MvuStore] 重试初始化成功');
          initRetryCount = 0; // 重置计数器
        } catch (err) {
          console.error('[MvuStore] 重试初始化失败:', err);
          scheduleInitRetry(); // 继续重试
        }
      } else if (!mvuService.isMvuAvailable()) {
        console.log('[MvuStore] MVU框架仍不可用，继续等待...');
        scheduleInitRetry(); // 继续重试
      }
    }, delay);
  };

  /**
   * 注册事件监听器（带重试）
   */
  const registerEventListenersWithRetry = async (): Promise<void> => {
    for (let i = 0; i < MAX_INIT_RETRIES; i++) {
      registerEventListeners();

      if (isEventListenerRegistered.value) {
        return;
      }

      console.log(`[MvuStore] 事件监听器注册失败，重试 ${i + 1}/${MAX_INIT_RETRIES}...`);
      await new Promise(resolve => setTimeout(resolve, INIT_RETRY_DELAY));
    }

    console.warn('[MvuStore] 事件监听器注册最终失败，部分功能可能不可用');
  };

  /**
   * 加载MVU数据（带重试）
   */
  const loadMvuDataWithRetry = async (): Promise<void> => {
    let lastError: Error | null = null;

    for (let i = 0; i < MAX_INIT_RETRIES; i++) {
      try {
        await loadMvuData();

        // 验证数据是否正确加载
        if (mvuData.value && mvuData.value.stat_data) {
          return;
        }

        console.log(`[MvuStore] 数据加载不完整，重试 ${i + 1}/${MAX_INIT_RETRIES}...`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[MvuStore] 加载数据失败，重试 ${i + 1}/${MAX_INIT_RETRIES}:`, err);
      }

      await new Promise(resolve => setTimeout(resolve, INIT_RETRY_DELAY));
    }

    if (lastError) {
      throw lastError;
    }
  };

  /**
   * 加载MVU数据
   * 注意：使用深拷贝创建新引用，确保 shallowRef 能触发响应式更新
   */
  const loadMvuData = async (): Promise<void> => {
    try {
      isLoading.value = true;
      error.value = null;

      const data = mvuService.getMvuData(currentOptions.value);

      // 深拷贝数据，创建新引用，确保 shallowRef 能触发响应式更新
      if (data) {
        mvuData.value = JSON.parse(JSON.stringify(data));
      } else {
        mvuData.value = null;
      }

      // 详细调试日志
      console.log('[MvuStore] 加载MVU数据完成:', {
        hasData: !!data,
        stat_data_keys: mvuData.value ? Object.keys(mvuData.value.stat_data || {}) : [],
        has_规章制度: mvuData.value?.stat_data?.['规章制度'] !== undefined,
        规章制度_type: mvuData.value?.stat_data?.['规章制度']
          ? typeof mvuData.value.stat_data['规章制度']
          : 'undefined',
        规章制度_keys: mvuData.value?.stat_data?.['规章制度'] ? Object.keys(mvuData.value.stat_data['规章制度']) : [],
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载MVU数据失败';
      console.error('[MvuStore] 加载MVU数据失败:', err);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 刷新MVU数据
   */
  const refresh = async (): Promise<void> => {
    await loadMvuData();
  };

  /**
   * 获取变量值
   * 优先从 MVU API 实时读取，确保获取最新数据
   */
  const getVariable = (path: string, defaultValue?: any): any => {
    try {
      // 优先使用 MVU API 获取最新数据（实时读取）
      const apiValue = mvuService.getVariable(path, {
        ...currentOptions.value,
        default_value: defaultValue,
      });

      // 如果 API 读取成功，直接返回
      if (apiValue !== undefined) {
        return apiValue;
      }

      // 回退：从本地缓存的 mvuData 中读取
      const directValue = path.split('.').reduce((obj, key) => {
        return obj && typeof obj === 'object' ? obj[key] : undefined;
      }, mvuData.value?.stat_data as any);

      if (directValue !== undefined) {
        return directValue;
      }

      return defaultValue;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取变量失败';
      console.error(`[MvuStore] getVariable("${path}") 失败:`, err);
      return defaultValue;
    }
  };

  /**
   * 设置变量值
   */
  const setVariable = async (path: string, value: any, reason?: string): Promise<boolean> => {
    try {
      error.value = null;

      const success = await mvuService.setVariable(path, value, {
        ...currentOptions.value,
        reason,
      });

      if (success) {
        await loadMvuData();
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置变量失败';
      return false;
    }
  };

  /**
   * 批量设置变量
   */
  const setVariables = async (variables: Record<string, any>, reason?: string): Promise<boolean> => {
    try {
      error.value = null;

      const success = await mvuService.setVariables(variables, {
        ...currentOptions.value,
        reason,
      });

      if (success) {
        await loadMvuData();
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '批量设置变量失败';
      return false;
    }
  };

  /**
   * 更新变量（基于当前值）
   */
  const updateVariable = async (
    path: string,
    updater: (currentValue: any) => any,
    reason?: string,
  ): Promise<boolean> => {
    try {
      error.value = null;

      const currentValue = getVariable(path);
      const newValue = updater(currentValue);

      return await setVariable(path, newValue, reason);
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新变量失败';
      return false;
    }
  };

  /**
   * 监听特定路径的变量变化
   * @param path 变量路径
   * @param callback 变化回调
   * @returns 取消监听的函数
   */
  const watchVariable = (path: string, callback: VariableWatchCallback): (() => void) => {
    const listener: VariableChangeListener = { path, callback };
    variableListeners.value.push(listener);

    // 返回取消监听的函数
    return () => {
      const index = variableListeners.value.indexOf(listener);
      if (index > -1) {
        variableListeners.value.splice(index, 1);
      }
    };
  };

  /**
   * 监听更新结束事件
   * @param callback 回调函数
   * @returns 取消监听的函数
   */
  const onUpdateEnd = (callback: UpdateEventListener): (() => void) => {
    updateEndListeners.value.push(callback);

    return () => {
      const index = updateEndListeners.value.indexOf(callback);
      if (index > -1) {
        updateEndListeners.value.splice(index, 1);
      }
    };
  };

  /**
   * 切换变量选项
   */
  const switchOptions = async (options: VariableOption): Promise<void> => {
    currentOptions.value = options;
    await loadMvuData();
  };

  /**
   * 清除错误
   */
  const clearError = (): void => {
    error.value = null;
  };

  /**
   * 当聊天切换时调用
   * 增强：等待 MVU 框架完成新聊天的数据加载
   */
  const onChatSwitch = async (): Promise<void> => {
    console.log('[MvuStore] 检测到聊天切换，重新初始化...');

    // 清除当前状态
    mvuData.value = null;
    error.value = null;
    isLoading.value = true;

    // 【关键修复】等待 MVU 框架完成重新注册和数据加载
    // CHAT_CHANGED 事件后，MVU 框架需要时间来：
    // 1. 重新注册工具 (Unregister -> Register)
    // 2. 加载新聊天的变量数据
    await waitForMvuDataReady();

    // 重新初始化
    if (isMvuAvailable.value) {
      await initialize(currentOptions.value);
    }

    isLoading.value = false;
  };

  /**
   * 等待 MVU 数据准备就绪
   * 在聊天切换后，需要等待新聊天的数据加载完成
   * @param maxWaitTime 最大等待时间（毫秒）
   * @param checkInterval 检查间隔（毫秒）
   */
  const waitForMvuDataReady = async (maxWaitTime: number = 5000, checkInterval: number = 200): Promise<boolean> => {
    const startTime = Date.now();
    let lastDataState: string | null = null;

    console.log('[MvuStore] 等待 MVU 数据准备就绪...');

    while (Date.now() - startTime < maxWaitTime) {
      // 首先检查 MVU 是否可用
      if (!mvuService.isMvuAvailable()) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }

      // 尝试获取数据
      const data = mvuService.getMvuData(currentOptions.value);
      const currentDataState = data ? JSON.stringify(Object.keys(data.stat_data || {})) : 'null';

      // 检查数据是否有效且稳定（连续两次相同说明加载完成）
      if (data && data.stat_data && Object.keys(data.stat_data).length > 0) {
        if (currentDataState === lastDataState) {
          console.log('[MvuStore] MVU 数据已稳定，键:', Object.keys(data.stat_data));
          return true;
        }
        lastDataState = currentDataState;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    // 超时但 MVU 可用，仍然尝试继续
    console.warn('[MvuStore] 等待 MVU 数据超时，尝试继续初始化...');
    return mvuService.isMvuAvailable();
  };

  /**
   * 销毁Store（清理事件监听）
   */
  const destroy = (): void => {
    unregisterEventListeners();
    variableListeners.value = [];
    updateEndListeners.value = [];
  };

  // ========== 变量命令解析和执行 ==========

  /**
   * 提取UpdateVariable标签内容
   */
  const extractUpdateVariableContent = (text: string): string | null => {
    if (!text || typeof text !== 'string') return null;

    const regex = /<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/gi;
    const matches = [...text.matchAll(regex)];

    if (matches.length > 0) {
      return matches[matches.length - 1][1].trim();
    }

    return null;
  };

  /**
   * 解析命令内容，支持多行JSON
   * 支持 lodash 风格格式：
   * - _.set('路径', [旧值], 新值)
   * - _.assign('路径', 键名, 值)
   * - _.add('路径', 增量)
   * - _.remove('路径', [键/索引])
   *
   * 也支持旧格式：
   * - SET('路径', 值)
   * - ADD('路径', 值)
   * 等
   */
  const parseCommands = (content: string): VariableCommand[] => {
    const commands: VariableCommand[] = [];
    if (!content || typeof content !== 'string') return commands;

    // 移除开头的注释行，但保留命令前的注释作为 comment
    const lines = content.split('\n');
    let currentComment: string | undefined = undefined;
    let commandBuffer = '';
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 空行跳过
      if (!line) continue;

      // 纯注释行，记录为下一个命令的注释
      if (line.startsWith('//')) {
        currentComment = line.slice(2).trim();
        continue;
      }

      // 开始累积命令
      commandBuffer += (commandBuffer ? '\n' : '') + line;

      // 计算括号平衡（需要处理字符串内的括号）
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const prevChar = j > 0 ? line[j - 1] : '';

        // 处理字符串
        if ((char === '"' || char === "'") && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
          continue;
        }

        if (inString) continue;

        // 计算括号
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }

      // 检查命令是否完整（括号平衡且以分号或闭括号结尾）
      const trimmedBuffer = commandBuffer.trim();
      const isComplete =
        braceCount === 0 && bracketCount === 0 && (trimmedBuffer.endsWith(');') || trimmedBuffer.endsWith(')'));

      if (isComplete) {
        // 解析完整的命令
        const parsed = parseSingleCommand(commandBuffer, currentComment);
        if (parsed) {
          commands.push(parsed);
        }
        // 重置
        commandBuffer = '';
        currentComment = undefined;
        braceCount = 0;
        bracketCount = 0;
        inString = false;
      }
    }

    // 处理最后可能未完成的命令
    if (commandBuffer.trim()) {
      const parsed = parseSingleCommand(commandBuffer, currentComment);
      if (parsed) {
        commands.push(parsed);
      }
    }

    return commands;
  };

  /**
   * 解析单个完整的命令字符串
   */
  const parseSingleCommand = (commandStr: string, comment?: string): VariableCommand | null => {
    if (!commandStr || typeof commandStr !== 'string') return null;

    // 清理命令字符串
    let cleanStr = commandStr.trim();

    // 移除末尾的分号
    if (cleanStr.endsWith(';')) {
      cleanStr = cleanStr.slice(0, -1).trim();
    }

    // 移除行内注释（但不移除字符串内的//）
    // 简单处理：查找最后一个不在JSON内的 //
    const lastCommentIndex = findLastCommentIndex(cleanStr);
    if (lastCommentIndex > -1) {
      const potentialComment = cleanStr.slice(lastCommentIndex + 2).trim();
      if (!comment && potentialComment) {
        comment = potentialComment;
      }
      cleanStr = cleanStr.slice(0, lastCommentIndex).trim();
    }

    if (!cleanStr) return null;

    // 尝试匹配 lodash 风格: _.xxx('path', ...)
    const lodashMatch = cleanStr.match(/^_\.(set|assign|add|remove)\s*\(\s*([\s\S]*)\s*\)$/i);

    if (lodashMatch) {
      return parseLodashCommand(lodashMatch[1].toLowerCase(), lodashMatch[2], comment);
    }

    // 尝试匹配旧格式: TYPE('path', value)
    const oldFormatMatch = cleanStr.match(
      /^(SET|ADD|SUB|MUL|DIV|APPEND|REMOVE|CLEAR|TOGGLE|INIT)\s*\(\s*([\s\S]*)\s*\)$/i,
    );

    if (oldFormatMatch) {
      return parseOldFormatCommand(oldFormatMatch[1].toUpperCase(), oldFormatMatch[2], comment);
    }

    console.warn('[MvuStore] 无法解析命令:', cleanStr.substring(0, 100) + (cleanStr.length > 100 ? '...' : ''));
    return null;
  };

  /**
   * 查找不在字符串内的最后一个注释位置
   */
  const findLastCommentIndex = (str: string): number => {
    let inString = false;
    let stringChar = '';
    let lastCommentIndex = -1;

    for (let i = 0; i < str.length - 1; i++) {
      const char = str[i];
      const nextChar = str[i + 1];
      const prevChar = i > 0 ? str[i - 1] : '';

      // 处理字符串
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      // 在字符串外找到 //
      if (!inString && char === '/' && nextChar === '/') {
        lastCommentIndex = i;
      }
    }

    return lastCommentIndex;
  };

  /**
   * 解析 lodash 风格命令
   * _.set('路径', [旧值], 新值)
   * _.assign('路径', 键名, 值)
   * _.add('路径', 增量)
   * _.remove('路径', [键/索引])
   */
  const parseLodashCommand = (method: string, argsStr: string, comment?: string): VariableCommand | null => {
    const args = parseArguments(argsStr);

    if (args.length < 1) {
      console.warn('[MvuStore] lodash命令参数不足:', method, argsStr.substring(0, 50));
      return null;
    }

    const path = typeof args[0] === 'string' ? args[0] : String(args[0]);

    switch (method) {
      case 'set': {
        // _.set('路径', [旧值], 新值) - 旧值是可选的
        // 如果有3个参数，第2个是旧值，第3个是新值
        // 如果有2个参数，第2个就是新值
        const newValue = args.length >= 3 ? args[2] : args[1];
        return {
          type: 'SET',
          path,
          value: newValue,
          comment,
        };
      }

      case 'assign': {
        // _.assign('父路径', '键名', 值) - 在父路径下添加新键
        if (args.length < 3) {
          console.warn('[MvuStore] _.assign需要3个参数:', argsStr.substring(0, 50));
          return null;
        }
        const key = typeof args[1] === 'string' ? args[1] : String(args[1]);
        const fullPath = `${path}.${key}`;
        return {
          type: 'SET',
          path: fullPath,
          value: args[2],
          comment,
        };
      }

      case 'add': {
        // _.add('路径', 增量)
        const increment = args.length >= 2 ? args[1] : 1;
        return {
          type: 'ADD',
          path,
          value: typeof increment === 'number' ? increment : parseFloat(increment) || 1,
          comment,
        };
      }

      case 'remove': {
        // _.remove('路径', [键/索引])
        // 如果有第二个参数，是要从数组/对象中移除的键或索引
        if (args.length >= 2) {
          return {
            type: 'REMOVE',
            path,
            value: args[1],
            comment,
          };
        }
        // 没有第二个参数，清除整个路径
        return {
          type: 'CLEAR',
          path,
          comment,
        };
      }

      default:
        console.warn('[MvuStore] 未知的lodash方法:', method);
        return null;
    }
  };

  /**
   * 解析旧格式命令
   */
  const parseOldFormatCommand = (type: string, argsStr: string, comment?: string): VariableCommand | null => {
    const args = parseArguments(argsStr);

    if (args.length < 1) {
      console.warn('[MvuStore] 命令参数不足:', type);
      return null;
    }

    const path = typeof args[0] === 'string' ? args[0] : String(args[0]);
    const value = args.length >= 2 ? args[1] : undefined;

    return {
      type: type as VariableCommand['type'],
      path,
      value,
      comment,
    };
  };

  /**
   * 解析函数参数字符串，支持多行JSON
   * 例如: "'路径', '键名', { complex: 'json' }"
   */
  const parseArguments = (argsStr: string): any[] => {
    const args: any[] = [];
    let current = '';
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let stringChar = '';

    const trimmed = argsStr.trim();

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      const prevChar = i > 0 ? trimmed[i - 1] : '';

      // 处理字符串
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        current += char;
        continue;
      }

      if (inString) {
        current += char;
        continue;
      }

      // 处理括号
      if (char === '{') {
        braceCount++;
        current += char;
        continue;
      }
      if (char === '}') {
        braceCount--;
        current += char;
        continue;
      }
      if (char === '[') {
        bracketCount++;
        current += char;
        continue;
      }
      if (char === ']') {
        bracketCount--;
        current += char;
        continue;
      }

      // 逗号分隔参数（只在顶层）
      if (char === ',' && braceCount === 0 && bracketCount === 0) {
        const trimmedArg = current.trim();
        if (trimmedArg) {
          args.push(parseValue(trimmedArg));
        }
        current = '';
        continue;
      }

      current += char;
    }

    // 处理最后一个参数
    const trimmedArg = current.trim();
    if (trimmedArg) {
      args.push(parseValue(trimmedArg));
    }

    return args;
  };

  /**
   * 解析单个值
   */
  const parseValue = (valueStr: string): any => {
    const trimmed = valueStr.trim();

    // 空值
    if (!trimmed) return undefined;

    // null
    if (trimmed === 'null') return null;

    // boolean
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // 数字
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // 字符串（单引号或双引号）
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return trimmed.slice(1, -1);
    }

    // JSON对象或数组
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // JSON解析失败，尝试修复常见问题
        try {
          // 尝试将单引号替换为双引号（简单情况）
          const fixed = trimmed.replace(/'/g, '"');
          return JSON.parse(fixed);
        } catch {
          console.warn('[MvuStore] JSON解析失败:', trimmed.substring(0, 100));
          return trimmed;
        }
      }
    }

    // 其他情况返回原字符串
    return trimmed;
  };

  /**
   * 解析单行变量命令（保留向后兼容）
   */
  const parseCommand = (line: string): VariableCommand | null => {
    const commands = parseCommands(line);
    return commands.length > 0 ? commands[0] : null;
  };

  /**
   * 执行单个变量命令
   */
  const executeCommand = async (command: VariableCommand): Promise<CommandExecutionResult> => {
    try {
      const { type, path, value } = command;

      console.log('[MvuStore] 执行命令:', {
        type,
        path,
        valueType: typeof value,
        valuePreview: typeof value === 'object' ? JSON.stringify(value).substring(0, 200) + '...' : value,
      });

      // 对于 SET 和 INIT，不需要获取当前值
      let currentValue: any;
      if (type !== 'SET' && type !== 'INIT') {
        currentValue = getVariable(path);
      }

      let newValue: any;

      switch (type) {
        case 'SET':
        case 'INIT':
          newValue = value;
          break;

        case 'ADD':
          if (typeof currentValue === 'number' && typeof value === 'number') {
            newValue = currentValue + value;
          } else {
            return { success: false, command, error: 'ADD操作需要数值类型' };
          }
          break;

        case 'SUB':
          if (typeof currentValue === 'number' && typeof value === 'number') {
            newValue = currentValue - value;
          } else {
            return { success: false, command, error: 'SUB操作需要数值类型' };
          }
          break;

        case 'MUL':
          if (typeof currentValue === 'number' && typeof value === 'number') {
            newValue = currentValue * value;
          } else {
            return { success: false, command, error: 'MUL操作需要数值类型' };
          }
          break;

        case 'DIV':
          if (typeof currentValue === 'number' && typeof value === 'number') {
            if (value === 0) {
              return { success: false, command, error: 'DIV操作不能除以零' };
            }
            newValue = currentValue / value;
          } else {
            return { success: false, command, error: 'DIV操作需要数值类型' };
          }
          break;

        case 'APPEND':
          if (Array.isArray(currentValue)) {
            newValue = [...currentValue, value];
          } else if (typeof currentValue === 'string' && typeof value === 'string') {
            newValue = currentValue + value;
          } else {
            return { success: false, command, error: 'APPEND操作需要数组或字符串类型' };
          }
          break;

        case 'REMOVE':
          if (Array.isArray(currentValue)) {
            newValue = currentValue.filter(item => item !== value);
          } else {
            return { success: false, command, error: 'REMOVE操作需要数组类型' };
          }
          break;

        case 'CLEAR':
          if (Array.isArray(currentValue)) {
            newValue = [];
          } else if (typeof currentValue === 'object' && currentValue !== null) {
            newValue = {};
          } else if (typeof currentValue === 'string') {
            newValue = '';
          } else if (typeof currentValue === 'number') {
            newValue = 0;
          } else {
            newValue = null;
          }
          break;

        case 'TOGGLE':
          if (typeof currentValue === 'boolean') {
            newValue = !currentValue;
          } else {
            return { success: false, command, error: 'TOGGLE操作需要布尔类型' };
          }
          break;

        default:
          return { success: false, command, error: `未知的命令类型: ${type}` };
      }

      // 执行变量设置
      const success = await setVariable(path, newValue, command.comment || `${type}操作`);

      return {
        success,
        command,
        oldValue: currentValue,
        newValue,
        error: success ? undefined : '设置变量失败',
      };
    } catch (err) {
      return {
        success: false,
        command,
        error: err instanceof Error ? err.message : '执行命令失败',
      };
    }
  };

  /**
   * 确保基础变量结构存在
   * 参考归墟实现：简化初始化逻辑，只确保顶级结构存在
   * MVU 原生 API 的 setMvuVariable 支持 is_recursive 选项，可以自动创建路径
   *
   * **重要**：此函数只在完全没有数据时才初始化基础结构
   *
   * @returns 是否成功初始化（用于调用者判断是否需要重试）
   */
  const ensureBasicStructure = async (existingData?: MvuData | null): Promise<boolean> => {
    const mvu = getMvuGlobal();
    if (!mvu) {
      console.warn('[MvuStore] ensureBasicStructure: MVU全局对象不可用');
      return false;
    }

    // 优先使用传入的数据或本地缓存
    let targetData = existingData || mvuData.value;
    if (!targetData) {
      // 最后才从 API 获取
      targetData = mvuService.getMvuData(currentOptions.value);
    }

    // 如果完全没有数据，创建空的 MVU 数据结构
    if (!targetData) {
      console.log('[MvuStore] 创建新的 MVU 数据结构...');
      targetData = {
        stat_data: {},
        display_data: {},
        delta_data: {},
        initialized_lorebooks: [],
      };
    }

    // 确保 stat_data 存在
    if (!targetData.stat_data) {
      targetData.stat_data = {};
    }

    // 如果 MC 对象已存在且有内容，直接返回（不做任何修改）
    const existingMC = targetData.stat_data.MC;
    if (existingMC && typeof existingMC === 'object' && Object.keys(existingMC).length > 0) {
      console.log('[MvuStore] MC 对象已存在，跳过初始化');
      return true;
    }

    // 只有当 MC 完全不存在时才初始化空对象
    if (!existingMC || typeof existingMC !== 'object') {
      console.log('[MvuStore] 初始化空的 MC 对象...');
      targetData.stat_data.MC = {};

      try {
        await mvu.replaceMvuData(targetData, currentOptions.value);
        // 同步更新本地缓存
        mvuData.value = JSON.parse(JSON.stringify(targetData));
        console.log('[MvuStore] MC 基础结构初始化完成');
        return true;
      } catch (err) {
        console.error('[MvuStore] 保存 MC 基础结构失败:', err);
        error.value = '初始化基础结构失败: ' + (err instanceof Error ? err.message : String(err));
        return false;
      }
    }

    return true;
  };

  /**
   * 解析并执行UpdateVariable标签中的所有命令
   * 优先使用 MVU 原生的 parseMessage 函数，如果不支持的命令则回退到自定义解析
   */
  const parseAndExecuteCommands = async (text: string): Promise<BatchCommandResult> => {
    const results: CommandExecutionResult[] = [];

    // **关键修复**：设置内部更新标志，防止事件处理覆盖数据
    isInternalUpdate.value = true;

    try {
      // 提取UpdateVariable内容
      const updateContent = extractUpdateVariableContent(text);
      if (!updateContent) {
        return { success: true, results, error: '未找到UpdateVariable标签' };
      }

      console.log('[MvuStore] 提取到UpdateVariable内容，长度:', updateContent.length);

      // **保存当前数据的快照**，用于回滚和传递给 ensureBasicStructure
      const dataSnapshot = mvuData.value ? JSON.parse(JSON.stringify(mvuData.value)) : null;

      // **关键修复：传入数据快照，避免 ensureBasicStructure 从 API 获取可能不完整的数据**
      // 这样可以确保使用的是我们已经缓存的完整数据
      const structureOk = await ensureBasicStructure(dataSnapshot);

      // 【新增】如果基础结构初始化失败，记录警告但继续执行（某些命令可能仍然有效）
      if (!structureOk) {
        console.warn('[MvuStore] 基础结构初始化失败，尝试继续执行命令...');
      }

      // **关键修复**：获取 ensureBasicStructure 处理后的最新本地数据
      // 这是最可靠的数据来源，因为它已经确保了基础结构存在
      const workingData = mvuData.value ? JSON.parse(JSON.stringify(mvuData.value)) : null;

      // 优先尝试使用 MVU 原生的 parseMessage 函数
      const mvu = getMvuGlobal();
      if (mvu && typeof mvu.parseMessage === 'function') {
        console.log('[MvuStore] 尝试使用 MVU 原生 parseMessage 解析...');

        // **关键修复**：使用本地缓存数据而不是从 API 获取
        // 因为 API 可能返回空数据，而本地缓存是完整的
        if (workingData) {
          try {
            // 使用本地缓存的完整数据
            const oldDataCopy = JSON.parse(JSON.stringify(workingData));

            console.log('[MvuStore] parseMessage 使用的数据，stat_data 键:', Object.keys(oldDataCopy.stat_data || {}));

            // MVU 的 parseMessage 直接处理整个内容
            const newData = await mvu.parseMessage(updateContent, oldDataCopy);

            if (newData) {
              // **验证新数据的完整性**
              const newStatKeys = Object.keys(newData.stat_data || {});
              const oldStatKeys = Object.keys(oldDataCopy.stat_data || {});

              console.log('[MvuStore] parseMessage 结果验证:', {
                oldKeys: oldStatKeys.length,
                newKeys: newStatKeys.length,
              });

              // 如果新数据丢失了大量键，可能是错误的
              if (oldStatKeys.length > 0 && newStatKeys.length === 0) {
                console.warn('[MvuStore] parseMessage 返回的数据丢失了所有键，尝试恢复...');
                // 恢复快照数据
                if (dataSnapshot) {
                  mvuData.value = dataSnapshot;
                }
                throw new Error('parseMessage 返回数据不完整');
              }

              // 有变量被更新，保存新数据
              await mvu.replaceMvuData(newData, currentOptions.value);

              // **关键修复**：直接使用返回的 newData 更新本地缓存
              // 而不是重新调用 loadMvuData（可能获取到不完整的数据）
              mvuData.value = JSON.parse(JSON.stringify(newData));

              console.log('[MvuStore] MVU parseMessage 执行成功，本地缓存已更新');
              console.log('[MvuStore] 更新后的 stat_data 键:', Object.keys(newData.stat_data || {}));

              // **关键修复**：通知所有监听器数据已更新
              notifyUpdateEndListeners();

              return {
                success: true,
                results: [
                  {
                    success: true,
                    command: { type: 'SET', path: 'MVU_NATIVE', value: null },
                  },
                ],
                error: undefined,
              };
            } else {
              console.log('[MvuStore] MVU parseMessage 返回 undefined，尝试自定义解析...');
            }
          } catch (parseErr) {
            console.warn('[MvuStore] MVU parseMessage 失败，回退到自定义解析:', parseErr);
          }
        }
      }

      // 回退到自定义解析器
      console.log('[MvuStore] 使用自定义解析器...');
      const commands = parseCommands(updateContent);
      console.log('[MvuStore] 解析到', commands.length, '条命令');

      // 执行每个命令
      for (const command of commands) {
        const result = await executeCommand(command);
        results.push(result);

        if (result.success) {
          console.log(`[MvuStore] 命令执行成功: ${command.type}('${command.path}')`);
        } else {
          console.warn(`[MvuStore] 命令执行失败: ${command.type}('${command.path}') - ${result.error}`);
        }
      }

      // 检查是否全部成功
      const allSuccess = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      // **关键修复**：重新从 MVU API 获取完整数据并直接更新本地缓存
      // 这确保本地数据与 MVU 后台数据完全同步
      const latestData = mvuService.getMvuData(currentOptions.value);
      if (latestData) {
        // **验证数据完整性**
        const latestStatKeys = Object.keys(latestData.stat_data || {});
        const currentStatKeys = Object.keys(mvuData.value?.stat_data || {});

        // 如果最新数据丢失了内容，保持现有数据
        if (currentStatKeys.length > 0 && latestStatKeys.length === 0) {
          console.warn('[MvuStore] 最新数据丢失了所有键，保持现有数据不变');
        } else {
          mvuData.value = JSON.parse(JSON.stringify(latestData));
          console.log('[MvuStore] 本地缓存已同步，stat_data 键:', latestStatKeys);
        }
      }

      console.log(`[MvuStore] 命令执行完成: ${successCount}成功, ${failCount}失败`);

      // **关键修复**：通知所有监听器数据已更新
      // 确保 rosterStore、documentStore 等能及时刷新
      notifyUpdateEndListeners();

      return {
        success: allSuccess,
        results,
        error: allSuccess ? undefined : `${failCount}条命令执行失败`,
      };
    } catch (err) {
      console.error('[MvuStore] 解析执行命令失败:', err);
      // 发生错误时也尝试刷新数据
      try {
        await loadMvuData();
      } catch (loadErr) {
        console.error('[MvuStore] 刷新MVU数据失败:', loadErr);
      }
      return {
        success: false,
        results,
        error: err instanceof Error ? err.message : '解析执行命令失败',
      };
    } finally {
      // 【优化】：使用事件监听而非固定延迟来清除内部更新标志
      // 这样可以确保在 MVU 事件处理完成后才允许外部更新
      const clearInternalFlag = (): void => {
        internalUpdateCount = Math.max(0, internalUpdateCount - 1);
        if (internalUpdateCount === 0) {
          isInternalUpdate.value = false;
          console.log('[MvuStore] 内部更新标志已清除');
        }
      };

      // 监听一次更新结束事件，而不是固定延迟
      let updateEndReceived = false;
      const unsubscribe = onUpdateEnd(() => {
        if (!updateEndReceived) {
          updateEndReceived = true;
          unsubscribe();
          clearInternalFlag();
        }
      });

      // 超时保护（最多等待500ms，如果没收到事件则强制清除）
      setTimeout(() => {
        if (!updateEndReceived) {
          unsubscribe();
          clearInternalFlag();
          console.log('[MvuStore] 内部更新标志超时清除');
        }
      }, 500);
    }
  };

  /** 内部更新计数器（支持嵌套） */
  let internalUpdateCount = 0;

  // 返回公共接口
  return {
    // 状态
    mvuData,
    isMvuAvailable,
    isLoading,
    error,
    currentOptions,

    // 计算属性
    statData,
    displayData,
    deltaData,
    initializedLorebooks,
    allVariableKeys,

    // Actions
    initialize,
    loadMvuData,
    refresh,
    getVariable,
    setVariable,
    setVariables,
    updateVariable,
    watchVariable,
    onUpdateEnd,
    switchOptions,
    clearError,
    onChatSwitch,
    destroy,
    registerEventListeners,
    unregisterEventListeners,

    // 命令解析和执行
    extractUpdateVariableContent,
    parseCommand,
    executeCommand,
    parseAndExecuteCommands,
  };
});
