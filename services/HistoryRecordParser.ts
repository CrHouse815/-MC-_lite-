/**
 * 历史记录解析器服务
 * 负责解析和格式化历史记录条目
 */

import type { HistoryRecordEntry, HistoryTextEntry } from '../types/contextManager';
import { RECORD_SEPARATOR, TEXT_SEPARATOR } from '../types/contextManager';

/**
 * 历史记录解析器
 */
export class HistoryRecordParser {
  /**
   * 从AI回复中提取<历史记录>标签内容
   * @param text AI回复的完整文本
   * @returns 提取的历史记录文本，如果没有找到则返回null
   */
  static extractHistoryRecordTag(text: string): string | null {
    if (!text || typeof text !== 'string') return null;

    const regex = /<历史记录>([\s\S]*?)<\/历史记录>/gi;
    const matches = [...text.matchAll(regex)];

    if (matches.length > 0) {
      // 返回最后一个匹配项的内容
      return matches[matches.length - 1][1].trim();
    }

    return null;
  }

  /**
   * 从AI回复中提取<gametxt>标签内容
   * @param text AI回复的完整文本
   * @returns 提取的正文内容，如果没有找到则返回null
   */
  static extractGameTextTag(text: string): string | null {
    if (!text || typeof text !== 'string') return null;

    const regex = /<gametxt>([\s\S]*?)<\/gametxt>/gi;
    const matches = [...text.matchAll(regex)];

    if (matches.length > 0) {
      // 返回最后一个匹配项的内容
      const content = matches[matches.length - 1][1].trim();
      // 移除HTML注释
      return content.replace(/<!--[\s\S]*?-->/g, '').trim();
    }

    return null;
  }

  /**
   * 已知的字段名列表，用于判断一行是否为新字段的开始
   */
  private static readonly KNOWN_FIELDS = ['序号', '日期', '地点', '描述', '标签', '重要信息', '自动化系统'];

  /**
   * 判断一行是否为字段行（以 "字段名|" 开头）
   * @param line 要检查的行
   * @returns 如果是字段行返回字段名，否则返回null
   */
  private static isFieldLine(line: string): string | null {
    const pipeIndex = line.indexOf('|');
    if (pipeIndex === -1) return null;

    const fieldName = line.substring(0, pipeIndex).trim();
    if (this.KNOWN_FIELDS.includes(fieldName)) {
      return fieldName;
    }
    return null;
  }

  /**
   * 解析单条历史记录文本为结构化对象
   * 支持多行字段值（如自动化系统字段可能包含多行内容）
   * @param recordText 单条历史记录的原始文本
   * @returns 解析后的历史记录对象
   */
  static parseRecord(recordText: string): HistoryRecordEntry | null {
    if (!recordText || typeof recordText !== 'string') return null;

    const record: Partial<HistoryRecordEntry> = {
      _raw: recordText,
    };

    // 按行解析，但需要处理多行字段值
    const lines = recordText.split('\n');

    let currentField: string | null = null;
    let currentValue: string[] = [];

    // 处理当前累积的字段值
    const flushField = () => {
      if (currentField && currentValue.length > 0) {
        const value = currentValue.join('\n').trim();
        this.setFieldValue(record, currentField, value);
      }
      currentField = null;
      currentValue = [];
    };

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 检查是否是新字段的开始
      const fieldName = this.isFieldLine(trimmedLine);

      if (fieldName) {
        // 先保存之前的字段
        flushField();

        // 开始新字段
        currentField = fieldName;
        const pipeIndex = trimmedLine.indexOf('|');
        const fieldValue = trimmedLine.substring(pipeIndex + 1).trim();
        if (fieldValue) {
          currentValue.push(fieldValue);
        }
      } else if (currentField && trimmedLine) {
        // 当前行是上一个字段的续行
        currentValue.push(trimmedLine);
      }
      // 空行在多行字段值中保留（但trim后为空的行会被忽略）
    }

    // 处理最后一个字段
    flushField();

    // 验证必需字段
    if (typeof record.序号 !== 'number' || isNaN(record.序号)) {
      console.warn('[HistoryRecordParser] 解析失败：缺少有效的序号字段');
      return null;
    }

    // 设置默认值
    return {
      序号: record.序号,
      日期: record.日期 || '',
      地点: record.地点 || '',
      描述: record.描述 || '',
      标签: record.标签 || [],
      重要信息: record.重要信息 || '',
      自动化系统: record.自动化系统 || '',
      _raw: record._raw,
    };
  }

  /**
   * 设置字段值到记录对象
   * @param record 记录对象
   * @param fieldName 字段名
   * @param value 字段值
   */
  private static setFieldValue(record: Partial<HistoryRecordEntry>, fieldName: string, value: string): void {
    switch (fieldName) {
      case '序号':
        record.序号 = parseInt(value, 10);
        break;
      case '日期':
        record.日期 = value;
        break;
      case '地点':
        record.地点 = value;
        break;
      case '描述':
        record.描述 = value;
        break;
      case '标签':
        // 标签使用|分隔
        record.标签 = value
          .split('|')
          .map(tag => tag.trim())
          .filter(tag => tag);
        break;
      case '重要信息':
        record.重要信息 = value;
        break;
      case '自动化系统':
        record.自动化系统 = value;
        break;
    }
  }

  /**
   * 解析多条历史记录
   * @param allRecordsText 包含多条记录的完整文本
   * @returns 解析后的历史记录数组
   */
  static parseRecords(allRecordsText: string): HistoryRecordEntry[] {
    if (!allRecordsText || typeof allRecordsText !== 'string') return [];

    const records: HistoryRecordEntry[] = [];

    // 优先尝试按分隔符分割（新格式）
    const parts = allRecordsText.split(RECORD_SEPARATOR).filter(p => p.trim());
    for (const part of parts) {
      const parsed = this.parseRecord(part.trim());
      if (parsed) {
        records.push(parsed);
      }
    }

    // 如果没有解析到任何记录，尝试按<历史记录>标签分割（兼容旧格式）
    if (records.length === 0) {
      const tagRegex = /<历史记录>([\s\S]*?)<\/历史记录>/gi;
      const tagMatches = [...allRecordsText.matchAll(tagRegex)];

      for (const match of tagMatches) {
        const parsed = this.parseRecord(match[1].trim());
        if (parsed) {
          records.push(parsed);
        }
      }
    }

    // 按序号排序
    records.sort((a, b) => a.序号 - b.序号);

    return records;
  }

  /**
   * 解析历史正文列表
   * @param allTextsStr 包含多条正文的完整文本
   * @returns 解析后的历史正文数组
   */
  static parseHistoryTexts(allTextsStr: string): HistoryTextEntry[] {
    if (!allTextsStr || typeof allTextsStr !== 'string') return [];

    const texts: HistoryTextEntry[] = [];

    // 优先尝试按分隔符分割（新格式）
    const parts = allTextsStr.split(TEXT_SEPARATOR).filter(p => p.trim());
    for (let i = 0; i < parts.length; i++) {
      const content = parts[i]
        .trim()
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim();
      if (content) {
        texts.push({
          序号: i + 1,
          内容: content,
        });
      }
    }

    // 如果没有解析到任何内容，尝试按<gametxt>标签分割（兼容旧格式）
    if (texts.length === 0) {
      const tagRegex = /<gametxt>([\s\S]*?)<\/gametxt>/gi;
      const tagMatches = [...allTextsStr.matchAll(tagRegex)];

      for (let i = 0; i < tagMatches.length; i++) {
        const content = tagMatches[i][1]
          .trim()
          .replace(/<!--[\s\S]*?-->/g, '')
          .trim();
        if (content) {
          texts.push({
            序号: i + 1,
            内容: content,
          });
        }
      }
    }

    return texts;
  }

  /**
   * 从历史记录中提取指定字段，格式化为字符串
   * @param record 历史记录对象
   * @param fields 要提取的字段名列表
   * @returns 格式化后的字符串
   */
  static formatRecordFields(record: HistoryRecordEntry, fields: (keyof HistoryRecordEntry)[]): string {
    const parts: string[] = [];

    for (const field of fields) {
      if (field === '_raw') continue; // 跳过原始文本字段

      const value = record[field];
      if (value === undefined || value === null || value === '') continue;

      if (field === '标签' && Array.isArray(value)) {
        if (value.length > 0) {
          parts.push(value.join('|'));
        }
      } else if (field === '日期') {
        // 日期单独显示，不带字段名
        parts.push(String(value));
      } else if (field === '描述') {
        // 描述直接拼接在日期后面
        parts.push(String(value));
      } else if (field === '自动化系统') {
        // 自动化系统保留字段名
        parts.push(`自动化系统|${value}`);
      } else {
        // 其他字段直接显示值
        parts.push(String(value));
      }
    }

    return parts.join(' ');
  }

  /**
   * 格式化为小总结格式（日期+重要信息+自动化系统）
   * @param records 历史记录数组
   * @returns 格式化后的小总结文本
   */
  static formatSmallSummary(records: HistoryRecordEntry[]): string {
    if (!records || records.length === 0) return '';

    const formatted = records.map(record => {
      const parts: string[] = [];

      // 日期
      if (record.日期) {
        parts.push(record.日期);
      }

      // 重要信息
      if (record.重要信息) {
        parts.push(record.重要信息);
      }

      // 自动化系统
      if (record.自动化系统) {
        parts.push(`自动化系统|${record.自动化系统}`);
      }

      return parts.join(' ');
    });

    return formatted.join(RECORD_SEPARATOR);
  }

  /**
   * 格式化为大总结格式（日期+描述）
   * @param records 历史记录数组
   * @returns 格式化后的大总结文本
   */
  static formatLargeSummary(records: HistoryRecordEntry[]): string {
    if (!records || records.length === 0) return '';

    const formatted = records.map(record => {
      const parts: string[] = [];

      // 日期
      if (record.日期) {
        parts.push(record.日期);
      }

      // 描述
      if (record.描述) {
        parts.push(record.描述);
      }

      return parts.join(' ');
    });

    return formatted.join(RECORD_SEPARATOR);
  }

  /**
   * 格式化历史正文为分段正文格式
   * @param texts 历史正文数组
   * @returns 格式化后的分段正文文本
   */
  static formatSegmentedText(texts: HistoryTextEntry[]): string {
    if (!texts || texts.length === 0) return '';

    return texts.map(t => t.内容).join(TEXT_SEPARATOR);
  }

  /**
   * 将历史记录数组序列化为存储格式
   * 使用分隔符而非标签，便于阅读
   * @param records 历史记录数组
   * @returns 序列化后的字符串
   */
  static serializeRecords(records: HistoryRecordEntry[]): string {
    if (!records || records.length === 0) return '';

    return records
      .map(record => {
        const lines: string[] = [];
        lines.push(`序号|${record.序号}`);
        if (record.日期) lines.push(`日期|${record.日期}`);
        if (record.地点) lines.push(`地点|${record.地点}`);
        if (record.描述) lines.push(`描述|${record.描述}`);
        if (record.标签 && record.标签.length > 0) lines.push(`标签|${record.标签.join('|')}`);
        if (record.重要信息) lines.push(`重要信息|${record.重要信息}`);
        if (record.自动化系统) lines.push(`自动化系统|${record.自动化系统}`);
        return lines.join('\n');
      })
      .join(RECORD_SEPARATOR);
  }

  /**
   * 将历史正文数组序列化为存储格式
   * 使用分隔符而非标签，便于阅读
   * @param texts 历史正文数组
   * @returns 序列化后的字符串
   */
  static serializeTexts(texts: HistoryTextEntry[]): string {
    if (!texts || texts.length === 0) return '';

    return texts.map(t => t.内容).join(TEXT_SEPARATOR);
  }

  /**
   * 获取记录数量
   * @param recordsText 历史记录文本
   * @returns 记录数量
   */
  static getRecordCount(recordsText: string): number {
    if (!recordsText) return 0;

    // 优先按分隔符计数（新格式）
    const parts = recordsText.split(RECORD_SEPARATOR).filter(p => p.trim());
    if (parts.length > 0) {
      return parts.length;
    }

    // 兼容旧格式：按<历史记录>标签计数
    const tagMatches = recordsText.match(/<历史记录>/gi);
    if (tagMatches && tagMatches.length > 0) {
      return tagMatches.length;
    }

    return 0;
  }

  /**
   * 获取正文数量
   * @param textsStr 历史正文文本
   * @returns 正文数量
   */
  static getTextCount(textsStr: string): number {
    if (!textsStr) return 0;

    // 优先按分隔符计数（新格式）
    const parts = textsStr.split(TEXT_SEPARATOR).filter(p => p.trim());
    if (parts.length > 0) {
      return parts.length;
    }

    // 兼容旧格式：按<gametxt>标签计数
    const tagMatches = textsStr.match(/<gametxt>/gi);
    if (tagMatches && tagMatches.length > 0) {
      return tagMatches.length;
    }

    return 0;
  }

  /**
   * 获取最新的序号
   * @param records 历史记录数组
   * @returns 最新序号，如果没有记录返回0
   */
  static getLatestSequence(records: HistoryRecordEntry[]): number {
    if (!records || records.length === 0) return 0;
    return Math.max(...records.map(r => r.序号));
  }

  /**
   * 追加新的历史记录
   * 使用分隔符而非标签
   * @param existingText 现有的历史记录文本
   * @param newRecordText 新的历史记录文本（AI生成的原始文本）
   * @returns 合并后的文本
   */
  static appendRecord(existingText: string, newRecordText: string): string {
    if (!existingText || !existingText.trim()) {
      return newRecordText;
    }

    return `${existingText}${RECORD_SEPARATOR}${newRecordText}`;
  }

  /**
   * 追加新的历史正文
   * 使用分隔符而非标签
   * @param existingText 现有的历史正文文本
   * @param newTextContent 新的正文内容
   * @returns 合并后的文本
   */
  static appendText(existingText: string, newTextContent: string): string {
    if (!existingText || !existingText.trim()) {
      return newTextContent;
    }

    return `${existingText}${TEXT_SEPARATOR}${newTextContent}`;
  }
}

// 导出单例方便使用
export const historyRecordParser = HistoryRecordParser;
