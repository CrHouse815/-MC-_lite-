/**
 * MClite - 内容块解析服务
 *
 * 负责解析AI回复文本中的格式化内容块
 * 支持以下格式：
 * - 「」 角色语言/对话
 * - *...* 角色心理描写
 * - 【】 景物描写
 * - 【【...】】 系统提示/强调显示
 */

import {
  ContentBlock,
  ContentBlockType,
  DEFAULT_PARSER_CONFIG,
  generateBlockId,
  ParserConfig,
  ParseResult,
  ParseStatistics,
} from '../types/contentBlock';

/**
 * 匹配结果接口
 */
interface MatchResult {
  /** 内容块类型 */
  type: ContentBlockType;
  /** 完整匹配（包含格式符号） */
  fullMatch: string;
  /** 内部内容（不包含格式符号） */
  innerContent: string;
  /** 起始位置 */
  startIndex: number;
  /** 结束位置 */
  endIndex: number;
  /** 优先级 */
  priority: number;
}

/**
 * 内容块解析服务
 * 单例模式实现
 */
class ContentBlockParserService {
  private static instance: ContentBlockParserService;
  private config: ParserConfig;

  private constructor() {
    this.config = { ...DEFAULT_PARSER_CONFIG };
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ContentBlockParserService {
    if (!ContentBlockParserService.instance) {
      ContentBlockParserService.instance = new ContentBlockParserService();
    }
    return ContentBlockParserService.instance;
  }

  /**
   * 更新解析器配置
   */
  public updateConfig(config: Partial<ParserConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  public getConfig(): ParserConfig {
    return { ...this.config };
  }

  /**
   * 解析文本内容
   * @param text 原始文本
   * @returns 解析结果
   */
  public parse(text: string): ParseResult {
    const startTime = performance.now();

    // 检查是否启用解析
    if (!this.config.enabled || !text) {
      return this.createEmptyResult(text, startTime);
    }

    try {
      // 1. 查找所有匹配
      const matches = this.findAllMatches(text);

      // 2. 解决重叠问题
      const resolvedMatches = this.resolveOverlaps(matches);

      // 3. 构建内容块列表（包含普通文本）
      const blocks = this.buildBlocks(text, resolvedMatches);

      // 4. 计算统计信息
      const statistics = this.calculateStatistics(blocks, text, startTime);

      return {
        blocks,
        originalText: text,
        success: true,
        statistics,
      };
    } catch (error) {
      console.error('[ContentBlockParser] 解析失败:', error);
      return {
        blocks: [this.createTextBlock(text, 0, text.length)],
        originalText: text,
        success: false,
        error: error instanceof Error ? error.message : '解析失败',
        statistics: this.calculateStatistics([], text, startTime),
      };
    }
  }

  /**
   * 查找所有格式匹配
   */
  private findAllMatches(text: string): MatchResult[] {
    const matches: MatchResult[] = [];

    for (const marker of this.config.formatMarkers) {
      // 重置正则表达式状态
      marker.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = marker.regex.exec(text)) !== null) {
        matches.push({
          type: marker.type,
          fullMatch: match[0],
          innerContent: match[1] || '',
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          priority: marker.priority,
        });
      }
    }

    // 按起始位置排序
    return matches.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * 解决重叠匹配问题
   * 优先级高的匹配优先保留
   */
  private resolveOverlaps(matches: MatchResult[]): MatchResult[] {
    if (matches.length === 0) return [];

    // 按优先级降序，起始位置升序排序
    const sortedMatches = [...matches].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.startIndex - b.startIndex;
    });

    const resolved: MatchResult[] = [];
    const usedRanges: Array<{ start: number; end: number }> = [];

    for (const match of sortedMatches) {
      // 检查是否与已选择的匹配重叠
      const hasOverlap = usedRanges.some(range => !(match.endIndex <= range.start || match.startIndex >= range.end));

      if (!hasOverlap) {
        resolved.push(match);
        usedRanges.push({ start: match.startIndex, end: match.endIndex });
      }
    }

    // 按起始位置重新排序
    return resolved.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * 构建完整的内容块列表
   * 将未匹配的部分作为普通文本块
   */
  private buildBlocks(text: string, matches: MatchResult[]): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    let currentIndex = 0;

    for (const match of matches) {
      // 添加匹配前的普通文本
      if (match.startIndex > currentIndex) {
        const textContent = text.slice(currentIndex, match.startIndex);
        if (textContent.trim()) {
          blocks.push(this.createTextBlock(textContent, currentIndex, match.startIndex));
        }
      }

      // 添加格式化块
      blocks.push(this.createFormattedBlock(match));
      currentIndex = match.endIndex;
    }

    // 添加最后的普通文本
    if (currentIndex < text.length) {
      const textContent = text.slice(currentIndex);
      if (textContent.trim()) {
        blocks.push(this.createTextBlock(textContent, currentIndex, text.length));
      }
    }

    return blocks;
  }

  /**
   * 创建普通文本块
   */
  private createTextBlock(content: string, start: number, end: number): ContentBlock {
    return {
      id: generateBlockId(),
      type: ContentBlockType.TEXT,
      rawContent: content,
      displayContent: this.processContent(content),
      startIndex: start,
      endIndex: end,
    };
  }

  /**
   * 创建格式化内容块
   */
  private createFormattedBlock(match: MatchResult): ContentBlock {
    return {
      id: generateBlockId(),
      type: match.type,
      rawContent: match.fullMatch,
      displayContent: this.processContent(this.config.preserveMarkers ? match.fullMatch : match.innerContent),
      startIndex: match.startIndex,
      endIndex: match.endIndex,
    };
  }

  /**
   * 处理内容（转义HTML等）
   */
  private processContent(content: string): string {
    let processed = content;

    // HTML转义
    if (this.config.escapeHtml) {
      processed = this.escapeHtml(processed);
    }

    // 处理换行符
    processed = processed.replace(/\n/g, '<br>');

    return processed;
  }

  /**
   * HTML转义
   * 注意：不转义单引号，因为在 iframe srcdoc 环境中可能导致问题
   */
  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
    };
    return text.replace(/[&<>"]/g, char => htmlEntities[char] || char);
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(blocks: ContentBlock[], text: string, startTime: number): ParseStatistics {
    const blockCounts: Record<ContentBlockType, number> = {
      [ContentBlockType.TEXT]: 0,
      [ContentBlockType.DIALOGUE]: 0,
      [ContentBlockType.THOUGHT]: 0,
      [ContentBlockType.SCENERY]: 0,
      [ContentBlockType.SYSTEM]: 0,
    };

    for (const block of blocks) {
      blockCounts[block.type]++;
    }

    return {
      totalBlocks: blocks.length,
      blockCounts,
      originalLength: text.length,
      parseTime: performance.now() - startTime,
    };
  }

  /**
   * 创建空结果
   */
  private createEmptyResult(text: string, startTime: number): ParseResult {
    const blocks = text ? [this.createTextBlock(text, 0, text.length)] : [];
    return {
      blocks,
      originalText: text,
      success: true,
      statistics: this.calculateStatistics(blocks, text, startTime),
    };
  }

  // ========== 工具方法 ==========

  /**
   * 检查文本是否包含格式化内容
   */
  public hasFormattedContent(text: string): boolean {
    if (!text) return false;

    for (const marker of this.config.formatMarkers) {
      marker.regex.lastIndex = 0;
      if (marker.regex.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取文本中所有的格式类型
   */
  public getContentTypes(text: string): ContentBlockType[] {
    if (!text) return [];

    const types: Set<ContentBlockType> = new Set();

    for (const marker of this.config.formatMarkers) {
      marker.regex.lastIndex = 0;
      if (marker.regex.test(text)) {
        types.add(marker.type);
      }
    }

    return Array.from(types);
  }

  /**
   * 提取指定类型的所有内容
   */
  public extractByType(text: string, type: ContentBlockType): string[] {
    const result = this.parse(text);
    return result.blocks.filter(block => block.type === type).map(block => block.displayContent);
  }

  /**
   * 移除所有格式符号，返回纯文本
   */
  public stripFormatting(text: string): string {
    if (!text) return '';

    let result = text;

    // 按优先级从高到低处理
    const sortedMarkers = [...this.config.formatMarkers].sort((a, b) => b.priority - a.priority);

    for (const marker of sortedMarkers) {
      result = result.replace(marker.regex, '$1');
    }

    return result;
  }

  /**
   * 验证文本格式是否正确（检查未闭合的标记）
   */
  public validateFormat(text: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查各种格式符号的配对
    const pairs = [
      { open: '「', close: '」', name: '对话标记' },
      { open: '【【', close: '】】', name: '系统提示标记' },
      { open: '【', close: '】', name: '景物描写标记' },
    ];

    for (const pair of pairs) {
      const openCount = (text.match(new RegExp(this.escapeRegex(pair.open), 'g')) || []).length;
      const closeCount = (text.match(new RegExp(this.escapeRegex(pair.close), 'g')) || []).length;

      if (openCount !== closeCount) {
        errors.push(`${pair.name}未正确配对：开始${openCount}个，结束${closeCount}个`);
      }
    }

    // 检查心理描写标记（*）
    // 使用简化的正则表达式，不使用 lookahead
    const thoughtMatches = text.match(/\*[^*]+\*/g) || [];
    const singleAsterisks = (text.match(/\*/g) || []).length;
    const expectedAsterisks = thoughtMatches.length * 2;

    // 这个检查比较宽松，只是警告
    if (singleAsterisks > expectedAsterisks && singleAsterisks % 2 !== 0) {
      errors.push('可能存在未配对的心理描写标记(*)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 将解析结果转换为HTML字符串
   * 用于快速渲染（不使用Vue组件）
   */
  public toHtml(result: ParseResult): string {
    if (!result.success || result.blocks.length === 0) {
      return result.originalText.replace(/\n/g, '<br>');
    }

    return result.blocks
      .map(block => {
        const className = `content-block content-block--${block.type}`;
        return `<span class="${className}" data-block-id="${block.id}">${block.displayContent}</span>`;
      })
      .join('');
  }

  /**
   * 重置解析器配置为默认值
   */
  public resetConfig(): void {
    this.config = { ...DEFAULT_PARSER_CONFIG };
  }
}

// 导出单例实例
export const contentBlockParserService = ContentBlockParserService.getInstance();

// 也导出类（用于测试或特殊场景）
export { ContentBlockParserService };
