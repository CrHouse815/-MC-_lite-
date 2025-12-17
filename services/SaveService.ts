/**
 * 存档服务
 * 整合MVU数据和上下文管理数据的存档/读档功能
 * 支持手动存档和自动存档功能
 */

import type { ContextManagerSaveData } from '../types/contextManager';
import type { MvuData } from '../types/mvu';
import { contextManagerService } from './ContextManagerService';

/**
 * AI回复内容数据
 */
export interface AIContentData {
  /** 当前显示的内容 */
  currentContent: string;
  /** 所有swipe选项 */
  swipes: string[];
  /** 当前swipe索引 */
  currentSwipeIndex: number;
  /** 最后的用户输入 */
  lastUserInput: string;
  /** 最后更新时间 */
  lastUpdateTime: string;
  /** 上一次AI回复的完整原始文本（用于注入到下一次请求的上下文） */
  lastAIResponse?: string;
}

/**
 * 完整的存档数据结构
 */
export interface GameSaveData {
  /** 存档ID */
  id: string;
  /** 存档名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** MVU数据 */
  mvuData: MvuData | null;
  /** 上下文管理数据 */
  contextData: ContextManagerSaveData;
  /** AI回复内容数据 */
  aiContentData?: AIContentData;
  /** 版本号 */
  version: string;
  /** 自定义数据 */
  customData?: Record<string, any>;
  /** 是否为自动存档 */
  isAutoSave?: boolean;
  /** 存档来源（manual/auto/ai_response） */
  saveSource?: 'manual' | 'auto' | 'ai_response';
  /** 存档时的消息ID */
  messageId?: number;
}

/**
 * 存档元数据
 */
export interface SaveMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  version: string;
  isAutoSave?: boolean;
  saveSource?: 'manual' | 'auto' | 'ai_response';
}

/**
 * 自动存档配置
 */
export interface AutoSaveConfig {
  /** 是否启用自动存档 */
  enabled: boolean;
  /** AI回复后自动存档 */
  saveOnAIResponse: boolean;
  /** 最大自动存档数量 */
  maxAutoSaves: number;
  /** 自动存档命名前缀 */
  autoSavePrefix: string;
  /** 自动存档间隔（毫秒），用于防抖 */
  debounceMs: number;
}

/**
 * 默认自动存档配置
 */
const DEFAULT_AUTO_SAVE_CONFIG: AutoSaveConfig = {
  enabled: true,
  saveOnAIResponse: true,
  maxAutoSaves: 10,
  autoSavePrefix: '[自动]',
  debounceMs: 1000,
};

/**
 * IndexedDB数据库名称和存储名称
 */
const DB_NAME = 'MC_House_SaveDB';
const STORE_NAME = 'saves';
const CONFIG_STORE_NAME = 'config';
const DB_VERSION = 2;
const CURRENT_SAVE_VERSION = '1.0.0';

/** LocalStorage键名 */
const AUTO_SAVE_CONFIG_KEY = 'mc_house_auto_save_config';

/**
 * 存档服务类
 */
export class SaveService {
  private db: IDBDatabase | null = null;
  private initialized: boolean = false;
  private autoSaveConfig: AutoSaveConfig = { ...DEFAULT_AUTO_SAVE_CONFIG };
  private autoSaveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAutoSaveTime: number = 0;

  /** 自动存档事件回调 */
  private onAutoSaveCallbacks: Array<(save: GameSaveData | null, error?: string) => void> = [];

  /** 存档加载完成后的回调（用于通知其他模块刷新数据） */
  private onLoadCompleteCallbacks: Array<(saveData: GameSaveData) => void> = [];

  /**
   * 初始化数据库
   */
  async initialize(): Promise<boolean> {
    if (this.initialized && this.db) return true;

    // 加载自动存档配置
    this.loadAutoSaveConfig();

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[SaveService] 打开数据库失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        console.log('[SaveService] 数据库初始化成功');
        resolve(true);
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // 创建存档存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('isAutoSave', 'isAutoSave', { unique: false });
          store.createIndex('saveSource', 'saveSource', { unique: false });
        } else if (oldVersion < 2) {
          // 数据库升级：为旧版本添加新索引
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const store = transaction.objectStore(STORE_NAME);
            if (!store.indexNames.contains('isAutoSave')) {
              store.createIndex('isAutoSave', 'isAutoSave', { unique: false });
            }
            if (!store.indexNames.contains('saveSource')) {
              store.createIndex('saveSource', 'saveSource', { unique: false });
            }
          }
        }

        // 创建配置存储
        if (!db.objectStoreNames.contains(CONFIG_STORE_NAME)) {
          db.createObjectStore(CONFIG_STORE_NAME, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * 生成唯一ID
   */
  private generateId(prefix: string = 'save'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========== 自动存档配置管理 ==========

  /**
   * 加载自动存档配置
   */
  private loadAutoSaveConfig(): void {
    try {
      const saved = localStorage.getItem(AUTO_SAVE_CONFIG_KEY);
      if (saved) {
        const config = JSON.parse(saved);
        this.autoSaveConfig = { ...DEFAULT_AUTO_SAVE_CONFIG, ...config };
      }
    } catch (err) {
      console.warn('[SaveService] 加载自动存档配置失败，使用默认配置:', err);
      this.autoSaveConfig = { ...DEFAULT_AUTO_SAVE_CONFIG };
    }
  }

  /**
   * 保存自动存档配置
   */
  private saveAutoSaveConfigToStorage(): void {
    try {
      localStorage.setItem(AUTO_SAVE_CONFIG_KEY, JSON.stringify(this.autoSaveConfig));
    } catch (err) {
      console.error('[SaveService] 保存自动存档配置失败:', err);
    }
  }

  /**
   * 获取自动存档配置
   */
  getAutoSaveConfig(): AutoSaveConfig {
    return { ...this.autoSaveConfig };
  }

  /**
   * 更新自动存档配置
   */
  updateAutoSaveConfig(config: Partial<AutoSaveConfig>): void {
    this.autoSaveConfig = { ...this.autoSaveConfig, ...config };
    this.saveAutoSaveConfigToStorage();
    console.log('[SaveService] 自动存档配置已更新:', this.autoSaveConfig);
  }

  /**
   * 重置自动存档配置为默认值
   */
  resetAutoSaveConfig(): void {
    this.autoSaveConfig = { ...DEFAULT_AUTO_SAVE_CONFIG };
    this.saveAutoSaveConfigToStorage();
  }

  /**
   * 注册自动存档事件回调
   */
  onAutoSave(callback: (save: GameSaveData | null, error?: string) => void): () => void {
    this.onAutoSaveCallbacks.push(callback);
    return () => {
      const index = this.onAutoSaveCallbacks.indexOf(callback);
      if (index > -1) {
        this.onAutoSaveCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 触发自动存档事件
   */
  private emitAutoSaveEvent(save: GameSaveData | null, error?: string): void {
    this.onAutoSaveCallbacks.forEach(callback => {
      try {
        callback(save, error);
      } catch (err) {
        console.error('[SaveService] 自动存档回调执行失败:', err);
      }
    });
  }

  /**
   * 注册存档加载完成事件回调
   * 当存档加载成功后，会调用这些回调函数，允许其他模块（如 mvuStore）刷新数据
   */
  onLoadComplete(callback: (saveData: GameSaveData) => void): () => void {
    this.onLoadCompleteCallbacks.push(callback);
    return () => {
      const index = this.onLoadCompleteCallbacks.indexOf(callback);
      if (index > -1) {
        this.onLoadCompleteCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 触发存档加载完成事件
   */
  private emitLoadCompleteEvent(saveData: GameSaveData): void {
    console.log('[SaveService] 触发存档加载完成事件，通知', this.onLoadCompleteCallbacks.length, '个回调');
    this.onLoadCompleteCallbacks.forEach(callback => {
      try {
        callback(saveData);
      } catch (err) {
        console.error('[SaveService] 存档加载完成回调执行失败:', err);
      }
    });
  }

  /**
   * 获取MVU数据
   */
  private getMvuData(): MvuData | null {
    try {
      if (typeof window !== 'undefined' && (window as any).Mvu) {
        return (window as any).Mvu.getMvuData({ type: 'message', message_id: 'latest' }) || null;
      }
      return null;
    } catch (err) {
      console.error('[SaveService] 获取MVU数据失败:', err);
      return null;
    }
  }

  /**
   * 恢复MVU数据
   */
  private async restoreMvuData(data: MvuData): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && (window as any).Mvu) {
        await (window as any).Mvu.replaceMvuData(data, { type: 'message', message_id: 'latest' });
        return true;
      }
      return false;
    } catch (err) {
      console.error('[SaveService] 恢复MVU数据失败:', err);
      return false;
    }
  }

  // ========== AI内容数据管理 ==========

  /** AI内容数据提供者回调 */
  private aiContentDataProvider: (() => AIContentData | null) | null = null;

  /** AI内容数据恢复者回调 */
  private aiContentDataRestorer: ((data: AIContentData) => void) | null = null;

  /**
   * 注册AI内容数据提供者
   * 由useAIInteraction调用来设置获取当前AI内容的方法
   */
  setAIContentDataProvider(provider: () => AIContentData | null): void {
    this.aiContentDataProvider = provider;
    console.log('[SaveService] AI内容数据提供者已注册');
  }

  /**
   * 注册AI内容数据恢复者
   * 由useAIInteraction调用来设置恢复AI内容的方法
   */
  setAIContentDataRestorer(restorer: (data: AIContentData) => void): void {
    this.aiContentDataRestorer = restorer;
    console.log('[SaveService] AI内容数据恢复者已注册');
  }

  /**
   * 获取当前AI内容数据
   */
  private getAIContentData(): AIContentData | null {
    if (this.aiContentDataProvider) {
      try {
        return this.aiContentDataProvider();
      } catch (err) {
        console.error('[SaveService] 获取AI内容数据失败:', err);
      }
    }
    return null;
  }

  /**
   * 恢复AI内容数据
   * 增强：支持异步恢复
   */
  private async restoreAIContentData(data: AIContentData): Promise<boolean> {
    if (this.aiContentDataRestorer && data) {
      try {
        // 调用恢复者（同步调用）
        this.aiContentDataRestorer(data);

        // 等待一小段时间确保 Vue 响应式更新完成
        await new Promise(resolve => setTimeout(resolve, 10));

        console.log('[SaveService] AI内容数据已恢复');
        return true;
      } catch (err) {
        console.error('[SaveService] 恢复AI内容数据失败:', err);
      }
    }
    return false;
  }

  /**
   * 创建新存档
   * @param name 存档名称
   * @param customData 自定义数据
   */
  async createSave(name: string, customData?: Record<string, any>): Promise<GameSaveData | null> {
    try {
      await this.initialize();

      // 收集所有数据
      const mvuData = this.getMvuData();
      const contextData = await contextManagerService.getSaveData();
      const aiContentData = this.getAIContentData();

      const saveData: GameSaveData = {
        id: this.generateId(),
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mvuData,
        contextData,
        aiContentData: aiContentData || undefined,
        version: CURRENT_SAVE_VERSION,
        customData,
      };

      // 保存到IndexedDB
      await this.putSave(saveData);

      console.log('[SaveService] 存档创建成功:', saveData.id, aiContentData ? '(含AI内容)' : '');
      return saveData;
    } catch (err) {
      console.error('[SaveService] 创建存档失败:', err);
      return null;
    }
  }

  /**
   * 更新存档
   * @param id 存档ID
   * @param customData 自定义数据更新
   */
  async updateSave(id: string, customData?: Record<string, any>): Promise<boolean> {
    try {
      await this.initialize();

      const existingSave = await this.getSave(id);
      if (!existingSave) {
        console.warn('[SaveService] 存档不存在:', id);
        return false;
      }

      // 更新数据
      const mvuData = this.getMvuData();
      const contextData = await contextManagerService.getSaveData();
      const aiContentData = this.getAIContentData();

      const updatedSave: GameSaveData = {
        ...existingSave,
        updatedAt: Date.now(),
        mvuData,
        contextData,
        aiContentData: aiContentData || existingSave.aiContentData,
        customData: customData || existingSave.customData,
      };

      await this.putSave(updatedSave);

      console.log('[SaveService] 存档更新成功:', id);
      return true;
    } catch (err) {
      console.error('[SaveService] 更新存档失败:', err);
      return false;
    }
  }

  // ========== 自动存档功能 ==========

  /**
   * AI回复后自动存档
   * 在AI生成结束后调用此方法
   * @param messageId 当前消息ID（可选）
   */
  async autoSaveOnAIResponse(messageId?: number): Promise<GameSaveData | null> {
    if (!this.autoSaveConfig.enabled || !this.autoSaveConfig.saveOnAIResponse) {
      console.log('[SaveService] 自动存档未启用');
      return null;
    }

    // 防抖处理
    const now = Date.now();
    if (now - this.lastAutoSaveTime < this.autoSaveConfig.debounceMs) {
      console.log('[SaveService] 自动存档防抖中，跳过');
      return null;
    }

    this.lastAutoSaveTime = now;

    try {
      console.log('[SaveService] 开始AI回复后自动存档...');

      // 生成自动存档名称
      const timestamp = new Date().toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const name = `${this.autoSaveConfig.autoSavePrefix} ${timestamp}`;

      // 创建自动存档
      const save = await this.createAutoSave(name, 'ai_response', messageId);

      if (save) {
        // 清理过多的自动存档
        await this.cleanupAutoSaves();
        this.emitAutoSaveEvent(save);
      }

      return save;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '自动存档失败';
      console.error('[SaveService] AI回复后自动存档失败:', err);
      this.emitAutoSaveEvent(null, errorMsg);
      return null;
    }
  }

  /**
   * 创建自动存档
   * @param name 存档名称
   * @param source 存档来源
   * @param messageId 消息ID
   */
  async createAutoSave(
    name: string,
    source: 'auto' | 'ai_response' = 'auto',
    messageId?: number,
  ): Promise<GameSaveData | null> {
    try {
      await this.initialize();

      const mvuData = this.getMvuData();
      const contextData = await contextManagerService.getSaveData();
      const aiContentData = this.getAIContentData();

      const saveData: GameSaveData = {
        id: this.generateId('auto'),
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mvuData,
        contextData,
        aiContentData: aiContentData || undefined,
        version: CURRENT_SAVE_VERSION,
        isAutoSave: true,
        saveSource: source,
        messageId,
      };

      await this.putSave(saveData);

      console.log('[SaveService] 自动存档创建成功:', saveData.id, aiContentData ? '(含AI内容)' : '');
      return saveData;
    } catch (err) {
      console.error('[SaveService] 创建自动存档失败:', err);
      return null;
    }
  }

  /**
   * 清理过多的自动存档
   * 只保留最新的maxAutoSaves个自动存档
   */
  async cleanupAutoSaves(): Promise<void> {
    try {
      const autoSaves = await this.listAutoSaves();

      if (autoSaves.length <= this.autoSaveConfig.maxAutoSaves) {
        return;
      }

      // 按更新时间排序，删除最旧的
      const toDelete = autoSaves.sort((a, b) => b.updatedAt - a.updatedAt).slice(this.autoSaveConfig.maxAutoSaves);

      for (const save of toDelete) {
        await this.deleteSave(save.id);
        console.log('[SaveService] 清理旧的自动存档:', save.id);
      }

      console.log('[SaveService] 自动存档清理完成，删除了', toDelete.length, '个旧存档');
    } catch (err) {
      console.error('[SaveService] 清理自动存档失败:', err);
    }
  }

  /**
   * 获取所有自动存档列表
   */
  async listAutoSaves(): Promise<SaveMetadata[]> {
    const allSaves = await this.listSaves();
    return allSaves.filter(save => save.isAutoSave === true);
  }

  /**
   * 获取所有手动存档列表
   */
  async listManualSaves(): Promise<SaveMetadata[]> {
    const allSaves = await this.listSaves();
    return allSaves.filter(save => save.isAutoSave !== true);
  }

  /**
   * 带防抖的自动存档（用于定时触发等场景）
   */
  debouncedAutoSave(messageId?: number): void {
    if (this.autoSaveDebounceTimer) {
      clearTimeout(this.autoSaveDebounceTimer);
    }

    this.autoSaveDebounceTimer = setTimeout(async () => {
      await this.autoSaveOnAIResponse(messageId);
    }, this.autoSaveConfig.debounceMs);
  }

  /**
   * 取消待执行的防抖存档
   */
  cancelDebouncedAutoSave(): void {
    if (this.autoSaveDebounceTimer) {
      clearTimeout(this.autoSaveDebounceTimer);
      this.autoSaveDebounceTimer = null;
    }
  }

  /**
   * 加载存档
   * 增强：确保所有恢复操作完成后才触发事件
   * @param id 存档ID
   */
  async loadSave(id: string): Promise<boolean> {
    try {
      await this.initialize();

      const saveData = await this.getSave(id);
      if (!saveData) {
        console.warn('[SaveService] 存档不存在:', id);
        return false;
      }

      console.log('[SaveService] 开始加载存档:', id);

      // 跟踪恢复结果
      const restoreResults = {
        mvu: false,
        context: false,
        aiContent: false,
      };

      // 1. 恢复MVU数据（await 确保完成）
      if (saveData.mvuData) {
        try {
          restoreResults.mvu = await this.restoreMvuData(saveData.mvuData);
          if (restoreResults.mvu) {
            console.log('[SaveService] MVU数据恢复成功，stat_data键:', Object.keys(saveData.mvuData.stat_data || {}));
          } else {
            console.warn('[SaveService] MVU数据恢复失败');
          }
        } catch (mvuErr) {
          console.error('[SaveService] MVU数据恢复异常:', mvuErr);
        }
      } else {
        restoreResults.mvu = true; // 无数据视为成功
      }

      // 2. 恢复上下文管理数据（await 确保完成）
      if (saveData.contextData) {
        try {
          await contextManagerService.restoreFromSaveData(saveData.contextData);
          restoreResults.context = true;
          console.log('[SaveService] 上下文管理数据恢复成功');
        } catch (contextErr) {
          console.error('[SaveService] 上下文管理数据恢复异常:', contextErr);
        }
      } else {
        restoreResults.context = true; // 无数据视为成功
      }

      // 3. 恢复AI内容数据（await 确保完成）
      if (saveData.aiContentData) {
        try {
          restoreResults.aiContent = await this.restoreAIContentData(saveData.aiContentData);
          console.log('[SaveService] AI内容数据恢复成功');
        } catch (aiErr) {
          console.error('[SaveService] AI内容数据恢复异常:', aiErr);
        }
      } else {
        restoreResults.aiContent = true; // 无数据视为成功
      }

      // 4. 等待一小段时间，确保所有异步操作完全落地
      // 这是一个安全措施，防止某些框架的异步回调还未完成
      await new Promise(resolve => setTimeout(resolve, 50));

      // 5. 检查恢复结果
      const allSuccess = restoreResults.mvu && restoreResults.context && restoreResults.aiContent;

      console.log('[SaveService] 存档加载完成:', {
        id,
        mvu: restoreResults.mvu ? '成功' : '失败',
        context: restoreResults.context ? '成功' : '失败',
        aiContent: restoreResults.aiContent ? '成功' : '失败',
        overall: allSuccess ? '全部成功' : '部分失败',
      });

      // 6. 触发存档加载完成事件，通知 mvuStore 等模块刷新数据
      // 即使部分失败也触发事件，让其他模块有机会处理
      this.emitLoadCompleteEvent(saveData);

      // 7. 如果部分恢复失败，显示警告
      if (!allSuccess && typeof toastr !== 'undefined') {
        toastr.warning('部分数据恢复失败，请检查控制台', '存档加载警告', { timeOut: 3000 });
      }

      return allSuccess;
    } catch (err) {
      console.error('[SaveService] 加载存档失败:', err);
      return false;
    }
  }

  /**
   * 获取存档
   * @param id 存档ID
   */
  async getSave(id: string): Promise<GameSaveData | null> {
    if (!this.db) await this.initialize();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /**
   * 保存数据到IndexedDB
   * @param saveData 存档数据
   */
  private async putSave(saveData: GameSaveData): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('数据库未初始化');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(saveData);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 删除存档
   * @param id 存档ID
   */
  async deleteSave(id: string): Promise<boolean> {
    if (!this.db) await this.initialize();
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('[SaveService] 存档删除成功:', id);
        resolve(true);
      };
    });
  }

  /**
   * 获取所有存档列表（仅元数据）
   */
  async listSaves(): Promise<SaveMetadata[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const saves = request.result as GameSaveData[];
        // 只返回元数据，按更新时间降序排列
        const metadata: SaveMetadata[] = saves
          .map(save => ({
            id: save.id,
            name: save.name,
            createdAt: save.createdAt,
            updatedAt: save.updatedAt,
            version: save.version,
            isAutoSave: save.isAutoSave,
            saveSource: save.saveSource,
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(metadata);
      };
    });
  }

  /**
   * 获取存档统计信息
   */
  async getSaveStats(): Promise<{
    total: number;
    manual: number;
    auto: number;
    oldestSave: SaveMetadata | null;
    newestSave: SaveMetadata | null;
  }> {
    const allSaves = await this.listSaves();
    const manualSaves = allSaves.filter(s => !s.isAutoSave);
    const autoSaves = allSaves.filter(s => s.isAutoSave);

    return {
      total: allSaves.length,
      manual: manualSaves.length,
      auto: autoSaves.length,
      oldestSave: allSaves.length > 0 ? allSaves[allSaves.length - 1] : null,
      newestSave: allSaves.length > 0 ? allSaves[0] : null,
    };
  }

  /**
   * 导出存档为JSON
   * @param id 存档ID
   */
  async exportSave(id: string): Promise<string | null> {
    try {
      const saveData = await this.getSave(id);
      if (!saveData) return null;

      return JSON.stringify(saveData, null, 2);
    } catch (err) {
      console.error('[SaveService] 导出存档失败:', err);
      return null;
    }
  }

  /**
   * 从JSON导入存档
   * @param jsonString JSON字符串
   * @param newName 新名称（可选，覆盖原名称）
   */
  async importSave(jsonString: string, newName?: string): Promise<GameSaveData | null> {
    try {
      await this.initialize();

      const saveData: GameSaveData = JSON.parse(jsonString);

      // 生成新ID避免冲突
      saveData.id = this.generateId();
      if (newName) {
        saveData.name = newName;
      }
      saveData.updatedAt = Date.now();

      await this.putSave(saveData);

      console.log('[SaveService] 存档导入成功:', saveData.id);
      return saveData;
    } catch (err) {
      console.error('[SaveService] 导入存档失败:', err);
      return null;
    }
  }

  /**
   * 快速保存（自动覆盖最近的存档或创建新存档）
   */
  async quickSave(): Promise<boolean> {
    try {
      const saves = await this.listSaves();

      if (saves.length > 0) {
        // 更新最近的存档
        return await this.updateSave(saves[0].id);
      } else {
        // 创建新存档
        const save = await this.createSave('快速存档');
        return save !== null;
      }
    } catch (err) {
      console.error('[SaveService] 快速保存失败:', err);
      return false;
    }
  }

  /**
   * 快速加载（加载最近的存档）
   */
  async quickLoad(): Promise<boolean> {
    try {
      const saves = await this.listSaves();

      if (saves.length === 0) {
        console.warn('[SaveService] 没有可加载的存档');
        return false;
      }

      return await this.loadSave(saves[0].id);
    } catch (err) {
      console.error('[SaveService] 快速加载失败:', err);
      return false;
    }
  }
}

// 导出单例
export const saveService = new SaveService();
