/**
 * MC房子 - 应用状态Store
 * 管理应用级别的全局状态
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AppState } from '../types';
import { useMvuStore } from './mvuStore';

/**
 * 应用状态Store
 */
export const useAppStore = defineStore('app', () => {
  // ========== 状态 ==========

  /** 应用状态 */
  const state = ref<AppState>({
    isFullscreen: false,
    theme: 'dark',
    language: 'zh-CN',
    volume: 1.0,
    isMuted: false,
  });

  /** 流式传输开关（默认开启） */
  const streamingEnabled = ref(true);

  /** 是否已初始化 */
  const isInitialized = ref(false);

  /** 当前聊天ID */
  const currentChatId = ref<string | null>(null);

  /** 聊天切换回调函数列表 */
  const chatSwitchCallbacks = ref<Array<() => Promise<void> | void>>([]);

  // ========== 方法 ==========

  /**
   * 获取当前聊天ID
   */
  const getCurrentChatId = (): string | null => {
    try {
      if (typeof window !== 'undefined') {
        const st = (window as any).SillyTavern;
        if (st) {
          if (st.chatId) return String(st.chatId);
          if (typeof st.getCurrentChatId === 'function') {
            const chatId = st.getCurrentChatId();
            if (chatId) return String(chatId);
          }
        }
        if (typeof (window as any).getContext === 'function') {
          const context = (window as any).getContext();
          if (context?.chatId) return String(context.chatId);
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  /**
   * 处理聊天切换事件
   */
  const handleChatSwitch = async () => {
    const newChatId = getCurrentChatId();

    // 如果聊天ID没有变化，不处理
    if (newChatId === currentChatId.value) {
      console.log('[AppStore] 聊天ID未变化，跳过切换处理');
      return;
    }

    console.log('[AppStore] 检测到聊天切换:', currentChatId.value, '->', newChatId);
    currentChatId.value = newChatId;

    // 调用MVU Store的聊天切换处理
    const mvuStore = useMvuStore();
    if (mvuStore.isMvuAvailable) {
      try {
        await mvuStore.onChatSwitch();
        console.log('[AppStore] MVU Store聊天切换处理完成');
      } catch (err) {
        console.error('[AppStore] MVU Store聊天切换处理失败:', err);
      }
    }

    // 调用所有注册的回调函数
    for (const callback of chatSwitchCallbacks.value) {
      try {
        await callback();
      } catch (err) {
        console.error('[AppStore] 聊天切换回调执行失败:', err);
      }
    }
  };

  /**
   * 注册聊天切换回调
   */
  const onChatSwitch = (callback: () => Promise<void> | void) => {
    chatSwitchCallbacks.value.push(callback);
    // 返回取消注册的函数
    return () => {
      const index = chatSwitchCallbacks.value.indexOf(callback);
      if (index > -1) {
        chatSwitchCallbacks.value.splice(index, 1);
      }
    };
  };

  /**
   * 设置聊天切换事件监听器
   */
  const setupChatSwitchListener = () => {
    try {
      if (typeof window === 'undefined') return;

      // 使用 SillyTavern 的事件系统监听聊天切换
      if (typeof (window as any).eventOn === 'function') {
        if (typeof (window as any).iframe_events !== 'undefined') {
          const events = (window as any).iframe_events;
          if (events.CHAT_CHANGED) {
            (window as any).eventOn(events.CHAT_CHANGED, handleChatSwitch);
            console.log('[AppStore] 已注册聊天切换事件监听器 (CHAT_CHANGED)');
          }
        } else {
          (window as any).eventOn('js_chat_changed', handleChatSwitch);
          console.log('[AppStore] 已注册聊天切换事件监听器 (js_chat_changed)');
        }
      }

      // 备用方案：监听 SillyTavern.eventSource
      const st = (window as any).SillyTavern;
      if (st?.eventSource?.on) {
        if (st.eventTypes?.CHAT_CHANGED) {
          st.eventSource.on(st.eventTypes.CHAT_CHANGED, handleChatSwitch);
          console.log('[AppStore] 已通过SillyTavern.eventSource注册聊天切换监听器');
        }
      }
    } catch (error) {
      console.warn('[AppStore] 设置聊天切换监听器失败:', error);
    }
  };

  /** MVU初始化重试相关常量 */
  const MVU_INIT_MAX_RETRIES = 5;
  const MVU_INIT_RETRY_DELAY = 1000;

  /** MVU初始化重试状态 */
  const mvuInitRetryCount = ref(0);
  let mvuInitRetryTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 初始化应用
   * 【关键修复】增加了对 iframe 重新加载场景的支持
   * 当用户切换聊天时，iframe 会被重新加载，此时需要主动初始化而不是等待事件
   */
  const initialize = async () => {
    if (isInitialized.value) return;

    console.log('[AppStore] 正在初始化MC房子应用...');

    // 加载保存的设置
    try {
      const savedTheme = localStorage.getItem('mc-app-theme');
      if (savedTheme) {
        state.value.theme = savedTheme as 'dark' | 'light';
      }

      const savedLanguage = localStorage.getItem('mc-app-language');
      if (savedLanguage) {
        state.value.language = savedLanguage as 'zh-CN' | 'en-US';
      }

      const savedVolume = localStorage.getItem('mc-app-volume');
      if (savedVolume) {
        state.value.volume = parseFloat(savedVolume);
      }

      const savedMuted = localStorage.getItem('mc-app-muted');
      if (savedMuted) {
        state.value.isMuted = savedMuted === 'true';
      }

      // 加载流式传输设置
      const savedStreaming = localStorage.getItem('mc-app-streaming');
      if (savedStreaming !== null) {
        streamingEnabled.value = savedStreaming === 'true';
      }
    } catch (error) {
      console.warn('[AppStore] 加载设置失败:', error);
    }

    // 记录初始聊天ID
    currentChatId.value = getCurrentChatId();
    console.log('[AppStore] 初始聊天ID:', currentChatId.value);

    // 设置聊天切换事件监听器
    setupChatSwitchListener();

    // 【关键修复】等待酒馆环境完全就绪
    // iframe 重新加载后，酒馆的 API 可能需要一些时间才能完全初始化
    await waitForTavernEnvironment();

    // 初始化MVU Store（带重试机制）
    await initializeMvuWithRetry();

    isInitialized.value = true;
    console.log('[AppStore] MC房子应用初始化完成');
  };

  /**
   * 等待酒馆环境完全就绪
   * 在 iframe 重新加载后，各种 API 可能需要时间初始化
   */
  const waitForTavernEnvironment = async (
    maxWaitTime: number = 5000,
    checkInterval: number = 100,
  ): Promise<boolean> => {
    const startTime = Date.now();

    console.log('[AppStore] 等待酒馆环境就绪...');

    while (Date.now() - startTime < maxWaitTime) {
      // 检查关键 API 是否可用
      const hasEventOn = typeof (window as any).eventOn === 'function';
      const hasMvu = typeof (window as any).Mvu !== 'undefined';
      const hasGenerate = typeof (window as any).generate === 'function';
      const hasTavernHelper = typeof (window as any).TavernHelper !== 'undefined';

      // 检查聊天 ID 是否已设置（表示聊天已加载）
      const chatId = getCurrentChatId();
      const hasChatId = !!chatId;

      if (hasEventOn && hasMvu && hasGenerate && hasTavernHelper && hasChatId) {
        console.log('[AppStore] 酒馆环境已就绪:', {
          eventOn: hasEventOn,
          Mvu: hasMvu,
          generate: hasGenerate,
          TavernHelper: hasTavernHelper,
          chatId: chatId,
        });
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    console.warn('[AppStore] 等待酒馆环境超时，继续初始化（部分功能可能不可用）');
    return false;
  };

  /**
   * 初始化MVU Store（带重试机制）
   */
  const initializeMvuWithRetry = async (): Promise<void> => {
    const mvuStore = useMvuStore();

    // 如果在非浏览器环境，跳过
    if (typeof window === 'undefined') {
      console.log('[AppStore] 非浏览器环境，跳过MVU初始化');
      return;
    }

    try {
      await mvuStore.initialize();

      // 检查初始化是否真正成功
      if (mvuStore.isMvuAvailable && mvuStore.mvuData) {
        console.log('[AppStore] MVU Store初始化成功');
        mvuInitRetryCount.value = 0; // 重置重试计数
        return;
      }

      // 如果MVU不可用但没有报错，可能是框架还未加载
      if (!mvuStore.isMvuAvailable) {
        console.warn('[AppStore] MVU框架暂不可用，将安排重试...');
        scheduleMvuInitRetry();
      }
    } catch (err) {
      console.warn('[AppStore] MVU初始化失败，将安排重试:', err);
      scheduleMvuInitRetry();
    }
  };

  /**
   * 安排MVU初始化重试
   */
  const scheduleMvuInitRetry = (): void => {
    if (mvuInitRetryCount.value >= MVU_INIT_MAX_RETRIES) {
      console.error('[AppStore] MVU初始化重试已达最大次数，放弃重试');
      // 显示用户友好的错误提示
      if (typeof toastr !== 'undefined') {
        toastr.warning('变量系统初始化失败，部分功能可能不可用。请尝试刷新页面。', '初始化警告', {
          timeOut: 5000,
        });
      }
      return;
    }

    // 清除之前的重试定时器
    if (mvuInitRetryTimer) {
      clearTimeout(mvuInitRetryTimer);
    }

    mvuInitRetryCount.value++;
    const delay = MVU_INIT_RETRY_DELAY * mvuInitRetryCount.value; // 递增延迟

    console.log(`[AppStore] 将在 ${delay}ms 后进行第 ${mvuInitRetryCount.value} 次MVU初始化重试...`);

    mvuInitRetryTimer = setTimeout(async () => {
      const mvuStore = useMvuStore();

      try {
        // 重新初始化
        await mvuStore.initialize();

        if (mvuStore.isMvuAvailable && mvuStore.mvuData) {
          console.log('[AppStore] MVU Store重试初始化成功');
          mvuInitRetryCount.value = 0;

          // 成功后通知用户
          if (typeof toastr !== 'undefined') {
            toastr.success('变量系统已就绪', '初始化成功', { timeOut: 2000 });
          }
        } else {
          // 继续重试
          scheduleMvuInitRetry();
        }
      } catch (err) {
        console.warn(`[AppStore] 第 ${mvuInitRetryCount.value} 次MVU初始化重试失败:`, err);
        scheduleMvuInitRetry();
      }
    }, delay);
  };

  /**
   * 手动触发MVU重新初始化
   * 提供给用户手动重试的接口
   */
  const retryMvuInitialization = async (): Promise<boolean> => {
    console.log('[AppStore] 用户手动触发MVU重新初始化...');
    mvuInitRetryCount.value = 0; // 重置重试计数

    const mvuStore = useMvuStore();

    try {
      await mvuStore.initialize();

      if (mvuStore.isMvuAvailable && mvuStore.mvuData) {
        console.log('[AppStore] MVU Store手动重新初始化成功');
        return true;
      }

      return false;
    } catch (err) {
      console.error('[AppStore] MVU Store手动重新初始化失败:', err);
      return false;
    }
  };

  /**
   * 切换全屏
   */
  const toggleFullscreen = () => {
    state.value.isFullscreen = !state.value.isFullscreen;
  };

  /**
   * 切换主题
   */
  const toggleTheme = () => {
    state.value.theme = state.value.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('mc-app-theme', state.value.theme);

    // 更新document的主题类
    if (state.value.theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

  /**
   * 设置主题
   */
  const setTheme = (theme: 'dark' | 'light') => {
    state.value.theme = theme;
    localStorage.setItem('mc-app-theme', theme);

    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

  /**
   * 设置语言
   */
  const setLanguage = (lang: 'zh-CN' | 'en-US') => {
    state.value.language = lang;
    localStorage.setItem('mc-app-language', lang);
  };

  /**
   * 设置音量
   */
  const setVolume = (volume: number) => {
    state.value.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('mc-app-volume', String(state.value.volume));
  };

  /**
   * 切换静音
   */
  const toggleMute = () => {
    state.value.isMuted = !state.value.isMuted;
    localStorage.setItem('mc-app-muted', String(state.value.isMuted));
  };

  /**
   * 设置静音状态
   */
  const setMuted = (muted: boolean) => {
    state.value.isMuted = muted;
    localStorage.setItem('mc-app-muted', String(muted));
  };

  /**
   * 切换流式传输开关
   */
  const toggleStreaming = () => {
    streamingEnabled.value = !streamingEnabled.value;
    localStorage.setItem('mc-app-streaming', String(streamingEnabled.value));
    console.log('[AppStore] 流式传输:', streamingEnabled.value ? '开启' : '关闭');
  };

  /**
   * 设置流式传输状态
   */
  const setStreaming = (enabled: boolean) => {
    streamingEnabled.value = enabled;
    localStorage.setItem('mc-app-streaming', String(enabled));
    console.log('[AppStore] 流式传输:', enabled ? '开启' : '关闭');
  };

  // 返回公共接口
  return {
    // 状态
    state,
    isInitialized,
    currentChatId,
    streamingEnabled,
    mvuInitRetryCount, // 暴露重试计数，便于UI显示

    // 方法
    initialize,
    toggleFullscreen,
    toggleTheme,
    setTheme,
    setLanguage,
    setVolume,
    toggleMute,
    setMuted,
    toggleStreaming,
    setStreaming,
    onChatSwitch,
    handleChatSwitch,
    getCurrentChatId,
    retryMvuInitialization, // 新增：手动重试MVU初始化
  };
});
