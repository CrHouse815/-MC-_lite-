/**
 * 世界书条目管理服务
 * 封装与SillyTavern世界书的交互
 * 使用全局函数 getWorldbook, updateWorldbookWith, createWorldbookEntries 等
 */

import type { WorldbookEntryConfig } from '../types/contextManager';
import { WORLDBOOK_ENTRY_CONFIGS, WORLDBOOK_ENTRY_NAMES } from '../types/contextManager';

/**
 * 默认世界书名称
 */
const DEFAULT_LOREBOOK_NAME = '【MC房子】';

/**
 * 世界书管理服务
 */
export class WorldbookService {
  private lorebook: string = DEFAULT_LOREBOOK_NAME;
  private initialized: boolean = false;

  /**
   * 检查世界书服务是否可用
   */
  isAvailable(): boolean {
    return typeof getWorldbook === 'function' && typeof updateWorldbookWith === 'function';
  }

  /**
   * 初始化服务
   * @param lorebookName 要使用的世界书名称（可选，默认使用 "【MC房子】"）
   */
  async initialize(lorebookName?: string): Promise<boolean> {
    try {
      if (lorebookName) {
        this.lorebook = lorebookName;
      }

      // 检查API是否可用
      if (!this.isAvailable()) {
        console.warn('[WorldbookService] 世界书全局API不可用，可能不在酒馆环境中');
        this.initialized = true;
        return true;
      }

      // 【修复】只检查世界书是否存在，不自动创建
      // 这避免了在卡片导入时覆盖原有世界书的问题
      // 世界书会在真正需要写入内容时才创建（懒创建模式）
      try {
        const entries = await getWorldbook(this.lorebook);
        console.log(`[WorldbookService] 世界书"${this.lorebook}"已存在，包含${entries.length}个条目`);
      } catch {
        // 【修复】世界书不存在时，不再自动创建空世界书
        // 等到真正需要写入内容时再创建，避免覆盖导入卡片的绑定世界书
        console.log(`[WorldbookService] 世界书"${this.lorebook}"不存在，将在需要时创建`);
      }

      this.initialized = true;
      console.log('[WorldbookService] 初始化完成，世界书:', this.lorebook);
      return true;
    } catch (err) {
      console.error('[WorldbookService] 初始化失败:', err);
      return false;
    }
  }

  /**
   * 获取世界书条目
   * @param entryName 条目名称（用于查找name字段）
   */
  async getEntry(entryName: string): Promise<WorldbookEntry | null> {
    try {
      if (!this.isAvailable()) {
        console.warn('[WorldbookService] 世界书API不可用');
        return null;
      }

      // 获取所有条目
      const entries = await getWorldbook(this.lorebook);
      if (!entries || !Array.isArray(entries)) {
        return null;
      }

      // 通过name查找条目
      const entry = entries.find((e: WorldbookEntry) => e.name === entryName);
      return entry || null;
    } catch (err) {
      console.error(`[WorldbookService] 获取条目"${entryName}"失败:`, err);
      return null;
    }
  }

  /**
   * 获取世界书条目内容
   * @param entryName 条目名称
   */
  async getEntryContent(entryName: string): Promise<string> {
    const entry = await this.getEntry(entryName);
    return entry?.content || '';
  }

  /**
   * 设置世界书条目内容
   * @param entryName 条目名称
   * @param content 新内容
   */
  async setEntryContent(entryName: string, content: string): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        console.warn('[WorldbookService] 世界书API不可用');
        return false;
      }

      // 获取现有条目
      const entry = await this.getEntry(entryName);

      if (entry) {
        // 更新现有条目 - 使用 updateWorldbookWith
        await updateWorldbookWith(this.lorebook, entries => {
          return entries.map(e => {
            if (e.name === entryName) {
              return { ...e, content };
            }
            return e;
          });
        });
        console.log(`[WorldbookService] 更新条目"${entryName}"成功，内容长度: ${content.length}`);
      } else {
        // 创建新条目
        const config = WORLDBOOK_ENTRY_CONFIGS[entryName] || {
          name: entryName,
          enabled: true,
          depth: 2,
          order: 100,
          role: 'system',
        };

        await this.createEntry(entryName, content, config);
        console.log(`[WorldbookService] 创建条目"${entryName}"成功，内容长度: ${content.length}`);
      }

      return true;
    } catch (err) {
      console.error(`[WorldbookService] 设置条目"${entryName}"内容失败:`, err);
      return false;
    }
  }

  /**
   * 追加内容到世界书条目
   * @param entryName 条目名称
   * @param appendContent 要追加的内容
   * @param separator 分隔符
   */
  async appendToEntry(entryName: string, appendContent: string, separator: string = '\n'): Promise<boolean> {
    try {
      const currentContent = await this.getEntryContent(entryName);
      const newContent = currentContent ? `${currentContent}${separator}${appendContent}` : appendContent;

      return await this.setEntryContent(entryName, newContent);
    } catch (err) {
      console.error(`[WorldbookService] 追加内容到"${entryName}"失败:`, err);
      return false;
    }
  }

  /**
   * 确保世界书存在，如果不存在则创建
   * 【懒创建模式】只在真正需要写入时才创建世界书
   */
  private async ensureWorldbookExists(): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        return false;
      }

      // 检查世界书是否存在
      try {
        await getWorldbook(this.lorebook);
        return true; // 世界书已存在
      } catch {
        // 世界书不存在，创建它
        console.log(`[WorldbookService] 懒创建世界书"${this.lorebook}"`);
        await createWorldbook(this.lorebook, []);
        return true;
      }
    } catch (err) {
      console.error('[WorldbookService] 确保世界书存在失败:', err);
      return false;
    }
  }

  /**
   * 创建新的世界书条目
   * @param entryName 条目名称
   * @param content 内容
   * @param config 条目配置
   */
  async createEntry(entryName: string, content: string, config: WorldbookEntryConfig): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        console.warn('[WorldbookService] 世界书API不可用');
        return false;
      }

      // 【懒创建】确保世界书存在
      await this.ensureWorldbookExists();

      // 使用 createWorldbookEntries 创建新条目
      await createWorldbookEntries(this.lorebook, [
        {
          name: entryName,
          content: content,
          enabled: config.enabled,
          strategy: {
            type: 'constant', // 蓝灯，始终激活
            keys: [],
            keys_secondary: { logic: 'and_any', keys: [] },
            scan_depth: 'same_as_global',
          },
          position: {
            type: 'at_depth',
            role: config.role,
            depth: config.depth,
            order: config.order,
          },
          probability: 100,
          recursion: {
            prevent_incoming: false,
            prevent_outgoing: false,
            delay_until: null,
          },
          effect: {
            sticky: null,
            cooldown: null,
            delay: null,
          },
        },
      ]);
      console.log(`[WorldbookService] 创建条目"${entryName}"成功`);
      return true;
    } catch (err) {
      console.error(`[WorldbookService] 创建条目"${entryName}"失败:`, err);
      return false;
    }
  }

  /**
   * 启用或禁用世界书条目
   * @param entryName 条目名称
   * @param enabled 是否启用
   */
  async setEntryEnabled(entryName: string, enabled: boolean): Promise<boolean> {
    try {
      if (!this.isAvailable()) return false;

      const entry = await this.getEntry(entryName);
      if (!entry) {
        console.warn(`[WorldbookService] 条目"${entryName}"不存在`);
        return false;
      }

      // 使用 updateWorldbookWith 更新条目
      await updateWorldbookWith(this.lorebook, entries => {
        return entries.map(e => {
          if (e.name === entryName) {
            return { ...e, enabled };
          }
          return e;
        });
      });
      console.log(`[WorldbookService] ${enabled ? '启用' : '禁用'}条目"${entryName}"`);
      return true;
    } catch (err) {
      console.error(`[WorldbookService] 设置条目"${entryName}"启用状态失败:`, err);
      return false;
    }
  }

  /**
   * 检查条目是否存在
   * @param entryName 条目名称
   */
  async entryExists(entryName: string): Promise<boolean> {
    const entry = await this.getEntry(entryName);
    return entry !== null;
  }

  /**
   * 确保所有必需的条目都存在
   */
  async ensureAllEntries(): Promise<boolean> {
    try {
      const entryNames = Object.values(WORLDBOOK_ENTRY_NAMES);

      for (const name of entryNames) {
        const exists = await this.entryExists(name);
        if (!exists) {
          const config = WORLDBOOK_ENTRY_CONFIGS[name];
          if (config) {
            await this.createEntry(name, '', config);
            console.log(`[WorldbookService] 创建缺失的条目: ${name}`);
          }
        }
      }

      return true;
    } catch (err) {
      console.error('[WorldbookService] 确保条目存在失败:', err);
      return false;
    }
  }

  /**
   * 切换到全量模式（启用历史正文和历史记录，禁用分段相关条目）
   */
  async switchToFullMode(): Promise<boolean> {
    try {
      await this.setEntryEnabled(WORLDBOOK_ENTRY_NAMES.HISTORY_TEXT, true);
      await this.setEntryEnabled(WORLDBOOK_ENTRY_NAMES.HISTORY_RECORD, true);
      await this.setEntryEnabled(WORLDBOOK_ENTRY_NAMES.SEGMENTED_TEXT, false);
      await this.setEntryEnabled(WORLDBOOK_ENTRY_NAMES.SMALL_SUMMARY, false);
      await this.setEntryEnabled(WORLDBOOK_ENTRY_NAMES.LARGE_SUMMARY, false);
      console.log('[WorldbookService] 已切换到全量模式');
      return true;
    } catch (err) {
      console.error('[WorldbookService] 切换到全量模式失败:', err);
      return false;
    }
  }

  /**
   * 切换到分段模式（禁用历史正文和历史记录，启用分段相关条目）
   */
  async switchToSegmentedMode(): Promise<boolean> {
    try {
      await this.setEntryEnabled(WORLDBOOK_ENTRY_NAMES.HISTORY_TEXT, false);
      await this.setEntryEnabled(WORLDBOOK_ENTRY_NAMES.HISTORY_RECORD, false);
      await this.setEntryEnabled(WORLDBOOK_ENTRY_NAMES.SEGMENTED_TEXT, true);
      await this.setEntryEnabled(WORLDBOOK_ENTRY_NAMES.SMALL_SUMMARY, true);
      await this.setEntryEnabled(WORLDBOOK_ENTRY_NAMES.LARGE_SUMMARY, true);
      console.log('[WorldbookService] 已切换到分段模式');
      return true;
    } catch (err) {
      console.error('[WorldbookService] 切换到分段模式失败:', err);
      return false;
    }
  }

  /**
   * 获取所有上下文管理相关条目的内容快照
   */
  async getContextSnapshot(): Promise<Record<string, string>> {
    const snapshot: Record<string, string> = {};

    for (const name of Object.values(WORLDBOOK_ENTRY_NAMES)) {
      snapshot[name] = await this.getEntryContent(name);
    }

    return snapshot;
  }

  /**
   * 从快照恢复所有条目内容
   * @param snapshot 内容快照
   */
  async restoreFromSnapshot(snapshot: Record<string, string>): Promise<boolean> {
    try {
      for (const [name, content] of Object.entries(snapshot)) {
        await this.setEntryContent(name, content);
      }
      console.log('[WorldbookService] 从快照恢复完成');
      return true;
    } catch (err) {
      console.error('[WorldbookService] 从快照恢复失败:', err);
      return false;
    }
  }

  /**
   * 清空所有上下文管理相关条目的内容
   */
  async clearAllContextEntries(): Promise<boolean> {
    try {
      for (const name of Object.values(WORLDBOOK_ENTRY_NAMES)) {
        await this.setEntryContent(name, '');
      }
      console.log('[WorldbookService] 已清空所有上下文条目');
      return true;
    } catch (err) {
      console.error('[WorldbookService] 清空条目失败:', err);
      return false;
    }
  }
}

// 导出单例
export const worldbookService = new WorldbookService();
