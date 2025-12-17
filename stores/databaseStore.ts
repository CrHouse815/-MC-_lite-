/**
 * MC房子 - 数据库Store
 * 管理顶层数据库结构和游戏状态
 */

import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type { SAMU7Database } from '../types/database';
import { createEmptyDatabase, DATABASE_PATHS } from '../types/database';
import { useMvuStore } from './mvuStore';

/**
 * 数据库Store
 */
export const useDatabaseStore = defineStore('database', () => {
  // ========== 状态 ==========

  /** 完整数据库数据 */
  const database = shallowRef<SAMU7Database>(createEmptyDatabase());

  /** 当前游戏时间 */
  const gameTime = ref<string>('');

  /** 当前场景 */
  const currentScene = ref<string>('');

  /** 是否正在加载 */
  const isLoading = ref(false);

  /** 错误信息 */
  const error = ref<string | null>(null);

  /** 是否已初始化 */
  const isInitialized = ref(false);

  /** 取消监听函数 */
  let unsubscribeGameTime: (() => void) | null = null;
  let unsubscribeScene: (() => void) | null = null;

  // ========== 计算属性 ==========

  /** 数据库元数据 */
  const meta = computed(() => database.value.$meta);

  /** 数据库版本 */
  const version = computed(() => database.value.$meta?.version || '1.0');

  /** 解析后的游戏时间 */
  const parsedGameTime = computed(() => {
    const timeStr = gameTime.value;
    if (!timeStr) return null;

    // 尝试解析格式如 "2024年6月15日 09:00" 或 ISO 格式
    const match = timeStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/);
    if (match) {
      return {
        year: parseInt(match[1]),
        month: parseInt(match[2]),
        day: parseInt(match[3]),
        hour: parseInt(match[4]),
        minute: parseInt(match[5]),
        raw: timeStr,
      };
    }

    // ISO 格式
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        raw: timeStr,
      };
    }

    return null;
  });

  /** 格式化的游戏时间显示 */
  const formattedGameTime = computed(() => {
    const time = parsedGameTime.value;
    if (!time) return gameTime.value || '未设置';

    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const date = new Date(time.year, time.month - 1, time.day);
    const weekday = weekdays[date.getDay()];

    return `${time.year}年${time.month}月${time.day}日 星期${weekday} ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
  });

  /** 当前时段 */
  const currentPeriod = computed((): 'morning' | 'afternoon' | 'evening' | 'night' => {
    const time = parsedGameTime.value;
    if (!time) return 'morning';

    const hour = time.hour;
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  });

  // ========== 数据加载方法 ==========

  /**
   * 从MVU加载游戏时间
   */
  const loadGameTimeFromMvu = (): void => {
    const mvuStore = useMvuStore();

    if (!mvuStore.isMvuAvailable) return;

    try {
      const time = mvuStore.getVariable(DATABASE_PATHS.GAME_TIME, '');
      gameTime.value = time || '';
      console.log('[DatabaseStore] 加载游戏时间:', gameTime.value);
    } catch (err) {
      console.error('[DatabaseStore] 加载游戏时间失败:', err);
    }
  };

  /**
   * 从MVU加载当前场景
   */
  const loadCurrentSceneFromMvu = (): void => {
    const mvuStore = useMvuStore();

    if (!mvuStore.isMvuAvailable) return;

    try {
      const scene = mvuStore.getVariable(DATABASE_PATHS.CURRENT_SCENE, '');
      currentScene.value = scene || '';
      console.log('[DatabaseStore] 加载当前场景:', currentScene.value);
    } catch (err) {
      console.error('[DatabaseStore] 加载当前场景失败:', err);
    }
  };

  /**
   * 从MVU加载完整数据库（可选，主要用于调试）
   */
  const loadFullDatabaseFromMvu = (): void => {
    const mvuStore = useMvuStore();

    if (!mvuStore.isMvuAvailable) return;

    try {
      const statData = mvuStore.statData;
      if (statData) {
        database.value = statData as SAMU7Database;
        console.log('[DatabaseStore] 加载完整数据库，键:', Object.keys(statData));
      }
    } catch (err) {
      console.error('[DatabaseStore] 加载完整数据库失败:', err);
    }
  };

  // ========== Actions ==========

  /**
   * 初始化Store
   */
  const initialize = async () => {
    if (isInitialized.value) {
      console.log('[DatabaseStore] 已初始化，跳过');
      return;
    }

    try {
      isLoading.value = true;
      error.value = null;

      const mvuStore = useMvuStore();

      // 确保mvuStore已初始化
      if (!mvuStore.isMvuAvailable) {
        await mvuStore.initialize();
      }

      // 加载数据
      loadGameTimeFromMvu();
      loadCurrentSceneFromMvu();
      loadFullDatabaseFromMvu();

      // 注册变量变化监听
      if (mvuStore.isMvuAvailable) {
        unsubscribeGameTime = mvuStore.watchVariable(DATABASE_PATHS.GAME_TIME, () => {
          console.log('[DatabaseStore] 游戏时间变量发生变化');
          loadGameTimeFromMvu();
        });

        unsubscribeScene = mvuStore.watchVariable(DATABASE_PATHS.CURRENT_SCENE, () => {
          console.log('[DatabaseStore] 当前场景变量发生变化');
          loadCurrentSceneFromMvu();
        });
      }

      isInitialized.value = true;
      console.log('[DatabaseStore] 初始化完成');
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败';
      console.error('[DatabaseStore] 初始化失败:', err);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 刷新数据
   */
  const refresh = async () => {
    try {
      isLoading.value = true;
      error.value = null;

      const mvuStore = useMvuStore();
      await mvuStore.refresh();

      loadGameTimeFromMvu();
      loadCurrentSceneFromMvu();
      loadFullDatabaseFromMvu();

      console.log('[DatabaseStore] 刷新完成');
    } catch (err) {
      error.value = err instanceof Error ? err.message : '刷新失败';
      console.error('[DatabaseStore] 刷新失败:', err);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 设置游戏时间
   */
  const setGameTime = async (time: string, reason?: string): Promise<boolean> => {
    try {
      const mvuStore = useMvuStore();
      const success = await mvuStore.setVariable(DATABASE_PATHS.GAME_TIME, time, reason);

      if (success) {
        gameTime.value = time;
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置游戏时间失败';
      return false;
    }
  };

  /**
   * 设置当前场景
   */
  const setCurrentScene = async (scene: string, reason?: string): Promise<boolean> => {
    try {
      const mvuStore = useMvuStore();
      const success = await mvuStore.setVariable(DATABASE_PATHS.CURRENT_SCENE, scene, reason);

      if (success) {
        currentScene.value = scene;
      }

      return success;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置当前场景失败';
      return false;
    }
  };

  /**
   * 推进游戏时间（分钟）
   */
  const advanceTime = async (minutes: number, reason?: string): Promise<boolean> => {
    const time = parsedGameTime.value;
    if (!time) {
      console.warn('[DatabaseStore] 无法推进时间：当前时间未设置');
      return false;
    }

    const date = new Date(time.year, time.month - 1, time.day, time.hour, time.minute);
    date.setMinutes(date.getMinutes() + minutes);

    const newTimeStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    return await setGameTime(newTimeStr, reason || `时间推进${minutes}分钟`);
  };

  /**
   * 获取指定路径的数据库值
   */
  const getValue = (path: string): any => {
    const mvuStore = useMvuStore();
    return mvuStore.getVariable(path, null);
  };

  /**
   * 设置指定路径的数据库值
   */
  const setValue = async (path: string, value: any, reason?: string): Promise<boolean> => {
    const mvuStore = useMvuStore();
    return await mvuStore.setVariable(path, value, reason);
  };

  /**
   * 清除错误
   */
  const clearError = () => {
    error.value = null;
  };

  /**
   * 销毁Store
   */
  const destroy = () => {
    if (unsubscribeGameTime) {
      unsubscribeGameTime();
      unsubscribeGameTime = null;
    }
    if (unsubscribeScene) {
      unsubscribeScene();
      unsubscribeScene = null;
    }
    isInitialized.value = false;
  };

  // 返回公共接口
  return {
    // 状态
    database,
    gameTime,
    currentScene,
    isLoading,
    error,
    isInitialized,

    // 计算属性
    meta,
    version,
    parsedGameTime,
    formattedGameTime,
    currentPeriod,

    // Actions
    initialize,
    refresh,
    setGameTime,
    setCurrentScene,
    advanceTime,
    getValue,
    setValue,
    clearError,
    destroy,
  };
});
