/**
 * MClite - 预设存储服务
 * 管理开局面板预设的保存、加载、删除等操作
 * 使用 localStorage 进行持久化存储
 */

import {
  BUILTIN_PRESETS,
  createPreset,
  PRESET_STORAGE_KEY,
  PRESET_STORAGE_VERSION,
  type GameStartFormData,
  type GameStartPreset,
  type PresetStorageData,
} from '../types/gameStart';

/**
 * 预设服务类
 * 提供预设的 CRUD 操作和持久化功能
 */
export class PresetService {
  private static instance: PresetService | null = null;

  /** 缓存的预设数据 */
  private cachedData: PresetStorageData | null = null;

  private constructor() {
    // 私有构造函数，使用单例模式
  }

  /**
   * 获取服务实例（单例）
   */
  static getInstance(): PresetService {
    if (!PresetService.instance) {
      PresetService.instance = new PresetService();
    }
    return PresetService.instance;
  }

  /**
   * 从 localStorage 加载预设数据
   */
  private loadFromStorage(): PresetStorageData {
    if (this.cachedData) {
      return this.cachedData;
    }

    try {
      const stored = localStorage.getItem(PRESET_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as PresetStorageData;

        // 版本迁移（如果需要）
        if (data.version !== PRESET_STORAGE_VERSION) {
          console.log('[PresetService] 检测到旧版本数据，进行迁移...');
          return this.migrateData(data);
        }

        this.cachedData = data;
        return data;
      }
    } catch (err) {
      console.error('[PresetService] 加载预设数据失败:', err);
    }

    // 返回默认数据
    const defaultData: PresetStorageData = {
      version: PRESET_STORAGE_VERSION,
      presets: [],
      lastUsedPresetId: undefined,
    };

    this.cachedData = defaultData;
    return defaultData;
  }

  /**
   * 保存预设数据到 localStorage
   */
  private saveToStorage(data: PresetStorageData): boolean {
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(data));
      this.cachedData = data;
      console.log('[PresetService] 预设数据已保存');
      return true;
    } catch (err) {
      console.error('[PresetService] 保存预设数据失败:', err);
      return false;
    }
  }

  /**
   * 数据迁移（用于版本升级）
   */
  private migrateData(oldData: PresetStorageData): PresetStorageData {
    // 目前只有版本1，暂无迁移逻辑
    // 未来版本升级时在此添加迁移代码
    const newData: PresetStorageData = {
      version: PRESET_STORAGE_VERSION,
      presets: oldData.presets || [],
      lastUsedPresetId: oldData.lastUsedPresetId,
    };

    this.saveToStorage(newData);
    return newData;
  }

  /**
   * 获取所有预设（包括内置预设和用户预设）
   */
  getAllPresets(): GameStartPreset[] {
    const data = this.loadFromStorage();
    // 内置预设在前，用户预设在后
    return [...BUILTIN_PRESETS, ...data.presets];
  }

  /**
   * 获取用户自定义预设（不包括内置预设）
   */
  getUserPresets(): GameStartPreset[] {
    const data = this.loadFromStorage();
    return data.presets;
  }

  /**
   * 获取内置预设
   */
  getBuiltinPresets(): GameStartPreset[] {
    return BUILTIN_PRESETS;
  }

  /**
   * 根据ID获取预设
   */
  getPresetById(id: string): GameStartPreset | null {
    const allPresets = this.getAllPresets();
    return allPresets.find(p => p.id === id) || null;
  }

  /**
   * 保存新预设
   * @param name 预设名称
   * @param formData 表单数据
   * @param description 预设描述（可选）
   * @returns 创建的预设，失败返回 null
   */
  savePreset(name: string, formData: GameStartFormData, description?: string): GameStartPreset | null {
    try {
      const data = this.loadFromStorage();
      const preset = createPreset(name, formData, description);

      data.presets.push(preset);
      data.lastUsedPresetId = preset.id;

      if (this.saveToStorage(data)) {
        console.log('[PresetService] 预设已保存:', preset.name);
        return preset;
      }

      return null;
    } catch (err) {
      console.error('[PresetService] 保存预设失败:', err);
      return null;
    }
  }

  /**
   * 更新现有预设
   * @param id 预设ID
   * @param updates 要更新的字段
   * @returns 是否成功
   */
  updatePreset(id: string, updates: Partial<Pick<GameStartPreset, 'name' | 'description' | 'formData'>>): boolean {
    try {
      const data = this.loadFromStorage();
      const index = data.presets.findIndex(p => p.id === id);

      if (index === -1) {
        // 检查是否是内置预设
        if (BUILTIN_PRESETS.some(p => p.id === id)) {
          console.warn('[PresetService] 无法修改内置预设');
          return false;
        }
        console.warn('[PresetService] 预设不存在:', id);
        return false;
      }

      const preset = data.presets[index];

      // 更新字段
      if (updates.name !== undefined) {
        preset.name = updates.name;
      }
      if (updates.description !== undefined) {
        preset.description = updates.description;
      }
      if (updates.formData !== undefined) {
        preset.formData = { ...updates.formData };
      }

      preset.updatedAt = new Date().toISOString();

      return this.saveToStorage(data);
    } catch (err) {
      console.error('[PresetService] 更新预设失败:', err);
      return false;
    }
  }

  /**
   * 删除预设
   * @param id 预设ID
   * @returns 是否成功
   */
  deletePreset(id: string): boolean {
    try {
      // 检查是否是内置预设
      if (BUILTIN_PRESETS.some(p => p.id === id)) {
        console.warn('[PresetService] 无法删除内置预设');
        return false;
      }

      const data = this.loadFromStorage();
      const index = data.presets.findIndex(p => p.id === id);

      if (index === -1) {
        console.warn('[PresetService] 预设不存在:', id);
        return false;
      }

      data.presets.splice(index, 1);

      // 如果删除的是最后使用的预设，清除记录
      if (data.lastUsedPresetId === id) {
        data.lastUsedPresetId = undefined;
      }

      return this.saveToStorage(data);
    } catch (err) {
      console.error('[PresetService] 删除预设失败:', err);
      return false;
    }
  }

  /**
   * 复制预设（创建副本）
   * @param id 要复制的预设ID
   * @param newName 新预设名称（可选，默认添加"副本"后缀）
   * @returns 创建的新预设，失败返回 null
   */
  duplicatePreset(id: string, newName?: string): GameStartPreset | null {
    const original = this.getPresetById(id);
    if (!original) {
      console.warn('[PresetService] 要复制的预设不存在:', id);
      return null;
    }

    const name = newName || `${original.name} (副本)`;
    return this.savePreset(name, original.formData, original.description);
  }

  /**
   * 设置最后使用的预设
   */
  setLastUsedPreset(id: string): void {
    const data = this.loadFromStorage();
    data.lastUsedPresetId = id;
    this.saveToStorage(data);
  }

  /**
   * 获取最后使用的预设ID
   */
  getLastUsedPresetId(): string | undefined {
    const data = this.loadFromStorage();
    return data.lastUsedPresetId;
  }

  /**
   * 获取最后使用的预设
   */
  getLastUsedPreset(): GameStartPreset | null {
    const lastId = this.getLastUsedPresetId();
    if (!lastId) return null;
    return this.getPresetById(lastId);
  }

  /**
   * 导出预设为 JSON 字符串
   * @param id 预设ID，不传则导出所有用户预设
   */
  exportPresets(id?: string): string {
    if (id) {
      const preset = this.getPresetById(id);
      if (!preset) {
        throw new Error('预设不存在');
      }
      return JSON.stringify(preset, null, 2);
    }

    const userPresets = this.getUserPresets();
    return JSON.stringify(userPresets, null, 2);
  }

  /**
   * 从 JSON 导入预设
   * @param jsonStr JSON 字符串
   * @returns 导入的预设数量
   */
  importPresets(jsonStr: string): number {
    try {
      const parsed = JSON.parse(jsonStr);
      let imported = 0;

      // 判断是单个预设还是预设数组
      const presets: GameStartPreset[] = Array.isArray(parsed) ? parsed : [parsed];

      for (const preset of presets) {
        // 验证预设数据结构
        if (!this.validatePresetData(preset)) {
          console.warn('[PresetService] 跳过无效预设:', preset);
          continue;
        }

        // 使用新ID保存，避免冲突
        const saved = this.savePreset(preset.name, preset.formData, preset.description);

        if (saved) {
          imported++;
        }
      }

      console.log(`[PresetService] 成功导入 ${imported} 个预设`);
      return imported;
    } catch (err) {
      console.error('[PresetService] 导入预设失败:', err);
      throw new Error('导入失败：无效的 JSON 格式');
    }
  }

  /**
   * 验证预设数据结构
   */
  private validatePresetData(data: unknown): data is GameStartPreset {
    if (!data || typeof data !== 'object') return false;

    const preset = data as Record<string, unknown>;

    // 检查必要字段
    if (typeof preset.name !== 'string' || !preset.name.trim()) return false;
    if (!preset.formData || typeof preset.formData !== 'object') return false;

    // 检查 formData 的必要字段
    const formData = preset.formData as Record<string, unknown>;
    if (typeof formData.sceneType !== 'string') return false;
    if (typeof formData.sceneName !== 'string') return false;

    return true;
  }

  /**
   * 清除所有用户预设
   * @returns 是否成功
   */
  clearAllUserPresets(): boolean {
    try {
      const data: PresetStorageData = {
        version: PRESET_STORAGE_VERSION,
        presets: [],
        lastUsedPresetId: undefined,
      };

      return this.saveToStorage(data);
    } catch (err) {
      console.error('[PresetService] 清除预设失败:', err);
      return false;
    }
  }

  /**
   * 获取预设数量统计
   */
  getPresetStats(): { total: number; builtin: number; user: number } {
    const userPresets = this.getUserPresets();
    return {
      total: BUILTIN_PRESETS.length + userPresets.length,
      builtin: BUILTIN_PRESETS.length,
      user: userPresets.length,
    };
  }

  /**
   * 刷新缓存（强制从 localStorage 重新加载）
   */
  refreshCache(): void {
    this.cachedData = null;
    this.loadFromStorage();
  }
}

// 导出单例实例
export const presetService = PresetService.getInstance();
