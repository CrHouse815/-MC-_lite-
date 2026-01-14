/**
 * MClite - AI响应审查服务
 *
 * 在AI输出结束后，对回复内容进行格式审查：
 * 1. 检查必需标签是否存在且正确闭合
 * 2. 解析并验证变量更新指令是否合规
 * 3. 生成审查报告供用户确认
 */

/**
 * 标签检查结果
 */
export interface TagCheckResult {
  /** 标签名称 */
  tagName: string;
  /** 是否存在 */
  exists: boolean;
  /** 是否正确闭合 */
  isClosed: boolean;
  /** 开始标签数量 */
  openCount: number;
  /** 结束标签数量 */
  closeCount: number;
  /** 标签内容（如果存在） */
  content?: string;
  /** 警告信息 */
  warning?: string;
}

/**
 * 变量指令解析结果
 */
export interface VariableCommandResult {
  /** 是否解析成功 */
  success: boolean;
  /** 原始指令文本 */
  rawContent: string;
  /** 解析后的指令列表 */
  commands: ParsedCommand[];
  /** 解析错误列表 */
  errors: string[];
  /** 警告列表 */
  warnings: string[];
}

/**
 * 解析后的单条指令
 */
export interface ParsedCommand {
  /** 变量路径 */
  path: string;
  /** 操作类型 */
  operation: 'set' | 'add' | 'subtract' | 'append' | 'remove' | 'unknown';
  /** 新值 */
  value: any;
  /** 注释 */
  comment?: string;
  /** 原始行 */
  rawLine: string;
}

/**
 * 完整审查结果
 */
export interface ReviewResult {
  /** 审查是否通过（所有必需检查都OK） */
  passed: boolean;
  /** 原始AI回复文本 */
  originalText: string;
  /** 标签检查结果 */
  tagChecks: TagCheckResult[];
  /** 变量指令检查结果 */
  variableCheck: VariableCommandResult | null;
  /** 提取的游戏文本内容 */
  gameTextContent: string;
  /** 提取的历史记录内容 */
  historyContent: string;
  /** 提取的思考内容 */
  thinkingContent: string;
  /** 总体问题列表 */
  issues: ReviewIssue[];
  /** 审查时间戳 */
  timestamp: number;
}

/**
 * 审查问题
 */
export interface ReviewIssue {
  /** 问题级别 */
  level: 'error' | 'warning' | 'info';
  /** 问题类别 */
  category: 'tag' | 'variable' | 'format' | 'other';
  /** 问题描述 */
  message: string;
  /** 相关标签或字段 */
  field?: string;
}

/**
 * 必需的标签列表
 */
const REQUIRED_TAGS = [
  { name: 'thinking', displayName: '思考过程', required: false },
  { name: 'gametxt', displayName: '游戏文本', required: true },
  { name: '历史记录', displayName: '历史记录', required: false },
  { name: 'UpdateVariable', displayName: '变量更新', required: false },
];

/**
 * AI响应审查服务类
 */
class AIResponseReviewService {
  private static instance: AIResponseReviewService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): AIResponseReviewService {
    if (!AIResponseReviewService.instance) {
      AIResponseReviewService.instance = new AIResponseReviewService();
    }
    return AIResponseReviewService.instance;
  }

  /**
   * 执行完整审查
   * @param aiResponse AI回复的原始文本
   * @returns 审查结果
   */
  public review(aiResponse: string): ReviewResult {
    const timestamp = Date.now();
    const issues: ReviewIssue[] = [];

    // 1. 检查所有标签
    const tagChecks = this.checkAllTags(aiResponse);

    // 收集标签问题
    for (const check of tagChecks) {
      const tagConfig = REQUIRED_TAGS.find(t => t.name === check.tagName);
      const displayName = tagConfig?.displayName || check.tagName;

      if (tagConfig?.required && !check.exists) {
        issues.push({
          level: 'error',
          category: 'tag',
          message: `缺少必需的 <${displayName}> 标签`,
          field: check.tagName,
        });
      } else if (check.exists && !check.isClosed) {
        issues.push({
          level: 'error',
          category: 'tag',
          message: `<${displayName}> 标签未正确闭合（开始:${check.openCount}, 结束:${check.closeCount}）`,
          field: check.tagName,
        });
      } else if (check.warning) {
        issues.push({
          level: 'warning',
          category: 'tag',
          message: check.warning,
          field: check.tagName,
        });
      }
    }

    // 2. 提取各标签内容
    const gameTextContent = this.extractTagContent(aiResponse, 'gametxt');
    const historyContent = this.extractTagContent(aiResponse, '历史记录');
    const thinkingContent = this.extractTagContent(aiResponse, 'thinking');

    // 3. 检查变量更新指令
    let variableCheck: VariableCommandResult | null = null;
    const updateVariableCheck = tagChecks.find(t => t.tagName === 'UpdateVariable');

    if (updateVariableCheck?.exists && updateVariableCheck.content) {
      variableCheck = this.parseVariableCommands(updateVariableCheck.content);

      // 收集变量解析问题
      for (const error of variableCheck.errors) {
        issues.push({
          level: 'error',
          category: 'variable',
          message: error,
          field: 'UpdateVariable',
        });
      }

      for (const warning of variableCheck.warnings) {
        issues.push({
          level: 'warning',
          category: 'variable',
          message: warning,
          field: 'UpdateVariable',
        });
      }
    }

    // 4. 额外格式检查
    if (gameTextContent && gameTextContent.length < 10) {
      issues.push({
        level: 'warning',
        category: 'format',
        message: '游戏文本内容过短，可能不完整',
        field: 'gametxt',
      });
    }

    // 5. 确定审查是否通过
    const hasErrors = issues.some(i => i.level === 'error');
    const passed = !hasErrors;

    return {
      passed,
      originalText: aiResponse,
      tagChecks,
      variableCheck,
      gameTextContent,
      historyContent,
      thinkingContent,
      issues,
      timestamp,
    };
  }

  /**
   * 检查所有必需标签
   */
  private checkAllTags(text: string): TagCheckResult[] {
    return REQUIRED_TAGS.map(tag => this.checkTag(text, tag.name));
  }

  /**
   * 检查单个标签
   */
  private checkTag(text: string, tagName: string): TagCheckResult {
    // 构建正则表达式（大小写不敏感）
    const openRegex = new RegExp(`<${this.escapeRegex(tagName)}>`, 'gi');
    const closeRegex = new RegExp(`</${this.escapeRegex(tagName)}>`, 'gi');

    const openMatches = text.match(openRegex) || [];
    const closeMatches = text.match(closeRegex) || [];

    const openCount = openMatches.length;
    const closeCount = closeMatches.length;
    const exists = openCount > 0;
    const isClosed = openCount === closeCount && openCount > 0;

    let content: string | undefined;
    let warning: string | undefined;

    if (exists) {
      // 提取内容
      content = this.extractTagContent(text, tagName);

      // 检查是否有多个同名标签
      if (openCount > 1) {
        warning = `存在多个 <${tagName}> 标签（${openCount}个），使用最后一个`;
      }
    }

    return {
      tagName,
      exists,
      isClosed,
      openCount,
      closeCount,
      content,
      warning,
    };
  }

  /**
   * 提取标签内容
   */
  private extractTagContent(text: string, tagName: string): string {
    if (!text || typeof text !== 'string') return '';

    const regex = new RegExp(`<${this.escapeRegex(tagName)}>([\\s\\S]*?)</${this.escapeRegex(tagName)}>`, 'gi');
    const matches = [...text.matchAll(regex)];

    if (matches.length > 0) {
      // 返回最后一个匹配的内容
      return matches[matches.length - 1][1].trim();
    }

    return '';
  }

  /**
   * 解析变量更新指令
   * 支持多种格式：
   * 1. MVU lodash 风格命令（_.set, _.assign, _.add, _.remove）
   * 2. 旧格式命令（SET, ADD, SUB 等）
   * 3. JSON格式
   * 4. 行格式（path = value）
   */
  private parseVariableCommands(content: string): VariableCommandResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const commands: ParsedCommand[] = [];

    if (!content || !content.trim()) {
      return {
        success: true,
        rawContent: content,
        commands: [],
        errors: [],
        warnings: ['变量更新内容为空'],
      };
    }

    // 优先尝试解析 MVU lodash 风格命令（这是最常用的格式）
    const mvuParseResult = this.tryParseAsMvuCommands(content);
    if (mvuParseResult.commands.length > 0) {
      return {
        success: mvuParseResult.errors.length === 0,
        rawContent: content,
        commands: mvuParseResult.commands,
        errors: mvuParseResult.errors,
        warnings: mvuParseResult.warnings,
      };
    }

    // 尝试解析为JSON格式
    const jsonParseResult = this.tryParseAsJson(content);
    if (jsonParseResult.success) {
      return {
        success: true,
        rawContent: content,
        commands: jsonParseResult.commands,
        errors: jsonParseResult.errors,
        warnings: jsonParseResult.warnings,
      };
    }

    // 尝试解析为行格式（path = value 或 path += value 等）
    const lineParseResult = this.tryParseAsLines(content);
    if (lineParseResult.commands.length > 0) {
      return {
        success: lineParseResult.errors.length === 0,
        rawContent: content,
        commands: lineParseResult.commands,
        errors: lineParseResult.errors,
        warnings: lineParseResult.warnings,
      };
    }

    // 都无法解析
    errors.push('无法解析变量更新指令格式，请检查是否符合MVU命令、JSON或行命令格式');

    return {
      success: false,
      rawContent: content,
      commands: [],
      errors,
      warnings,
    };
  }

  /**
   * 尝试解析 MVU lodash 风格命令
   * 支持格式：
   * - _.set('路径', [旧值], 新值)
   * - _.assign('父路径', '键名', 值)
   * - _.add('路径', 增量)
   * - _.remove('路径', [键/索引])
   * - SET('路径', 值)、ADD('路径', 值) 等旧格式
   */
  private tryParseAsMvuCommands(content: string): {
    commands: ParsedCommand[];
    errors: string[];
    warnings: string[];
  } {
    const commands: ParsedCommand[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // 按行分割，但需要处理多行JSON参数
    const lines = content.split('\n');
    let currentComment: string | undefined = undefined;
    let commandBuffer = '';
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let stringChar = '';

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex].trim();

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
        const parsed = this.parseMvuSingleCommand(commandBuffer, currentComment);
        if (parsed) {
          commands.push(parsed);
        } else if (commandBuffer.trim()) {
          // 无法解析的非空命令，记录警告
          const preview = commandBuffer.substring(0, 50) + (commandBuffer.length > 50 ? '...' : '');
          warnings.push(`无法解析命令: "${preview}"`);
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
      const parsed = this.parseMvuSingleCommand(commandBuffer, currentComment);
      if (parsed) {
        commands.push(parsed);
      } else {
        const preview = commandBuffer.substring(0, 50) + (commandBuffer.length > 50 ? '...' : '');
        warnings.push(`无法解析命令: "${preview}"`);
      }
    }

    return { commands, errors, warnings };
  }

  /**
   * 解析单个 MVU 命令
   */
  private parseMvuSingleCommand(commandStr: string, comment?: string): ParsedCommand | null {
    if (!commandStr || typeof commandStr !== 'string') return null;

    // 清理命令字符串
    let cleanStr = commandStr.trim();

    // 移除末尾的分号
    if (cleanStr.endsWith(';')) {
      cleanStr = cleanStr.slice(0, -1).trim();
    }

    // 移除行内注释（但不移除字符串内的//）
    const lastCommentIndex = this.findLastCommentIndex(cleanStr);
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
      return this.parseLodashStyleCommand(lodashMatch[1].toLowerCase(), lodashMatch[2], comment);
    }

    // 尝试匹配旧格式: TYPE('path', value)
    const oldFormatMatch = cleanStr.match(
      /^(SET|ADD|SUB|MUL|DIV|APPEND|REMOVE|CLEAR|TOGGLE|INIT)\s*\(\s*([\s\S]*)\s*\)$/i,
    );

    if (oldFormatMatch) {
      return this.parseOldStyleCommand(oldFormatMatch[1].toUpperCase(), oldFormatMatch[2], comment);
    }

    return null;
  }

  /**
   * 查找不在字符串内的最后一个注释位置
   */
  private findLastCommentIndex(str: string): number {
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
  }

  /**
   * 解析 lodash 风格命令
   * _.set('路径', [旧值], 新值)
   * _.assign('父路径', '键名', 值)
   * _.add('路径', 增量)
   * _.remove('路径', [键/索引])
   */
  private parseLodashStyleCommand(method: string, argsStr: string, comment?: string): ParsedCommand | null {
    const args = this.parseMvuArguments(argsStr);

    if (args.length < 1) {
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
          path,
          operation: 'set',
          value: newValue,
          comment,
          rawLine: `_.set('${path}', ${JSON.stringify(newValue)})`,
        };
      }

      case 'assign': {
        // _.assign('父路径', '键名', 值) - 在父路径下添加新键
        if (args.length < 3) {
          return null;
        }
        const key = typeof args[1] === 'string' ? args[1] : String(args[1]);
        const fullPath = `${path}.${key}`;
        return {
          path: fullPath,
          operation: 'set',
          value: args[2],
          comment,
          rawLine: `_.assign('${path}', '${key}', ${JSON.stringify(args[2])})`,
        };
      }

      case 'add': {
        // _.add('路径', 增量)
        const increment = args.length >= 2 ? args[1] : 1;
        return {
          path,
          operation: 'add',
          value: typeof increment === 'number' ? increment : parseFloat(String(increment)) || 1,
          comment,
          rawLine: `_.add('${path}', ${increment})`,
        };
      }

      case 'remove': {
        // _.remove('路径', [键/索引])
        return {
          path,
          operation: 'remove',
          value: args.length >= 2 ? args[1] : undefined,
          comment,
          rawLine: `_.remove('${path}'${args.length >= 2 ? ', ' + JSON.stringify(args[1]) : ''})`,
        };
      }

      default:
        return null;
    }
  }

  /**
   * 解析旧格式命令
   */
  private parseOldStyleCommand(type: string, argsStr: string, comment?: string): ParsedCommand | null {
    const args = this.parseMvuArguments(argsStr);

    if (args.length < 1) {
      return null;
    }

    const path = typeof args[0] === 'string' ? args[0] : String(args[0]);
    const value = args.length >= 2 ? args[1] : undefined;

    let operation: ParsedCommand['operation'];
    switch (type) {
      case 'SET':
      case 'INIT':
        operation = 'set';
        break;
      case 'ADD':
        operation = 'add';
        break;
      case 'SUB':
        operation = 'subtract';
        break;
      case 'APPEND':
        operation = 'append';
        break;
      case 'REMOVE':
      case 'CLEAR':
        operation = 'remove';
        break;
      default:
        operation = 'unknown';
    }

    return {
      path,
      operation,
      value,
      comment,
      rawLine: `${type}('${path}'${value !== undefined ? ', ' + JSON.stringify(value) : ''})`,
    };
  }

  /**
   * 解析 MVU 命令参数字符串，支持多行JSON
   * 例如: "'路径', '键名', { complex: 'json' }"
   */
  private parseMvuArguments(argsStr: string): any[] {
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
          args.push(this.parseMvuValue(trimmedArg));
        }
        current = '';
        continue;
      }

      current += char;
    }

    // 处理最后一个参数
    const trimmedArg = current.trim();
    if (trimmedArg) {
      args.push(this.parseMvuValue(trimmedArg));
    }

    return args;
  }

  /**
   * 解析 MVU 命令中的单个值
   */
  private parseMvuValue(valueStr: string): any {
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
          return trimmed;
        }
      }
    }

    // 其他情况返回原字符串
    return trimmed;
  }

  /**
   * 尝试将内容解析为JSON格式
   */
  private tryParseAsJson(content: string): {
    success: boolean;
    commands: ParsedCommand[];
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const commands: ParsedCommand[] = [];

    try {
      // 清理可能的注释和多余字符
      let cleanContent = content.trim();

      // 移除可能的注释行
      cleanContent = cleanContent
        .split('\n')
        .filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('#'))
        .join('\n');

      // 尝试解析JSON
      const parsed = JSON.parse(cleanContent);

      if (typeof parsed !== 'object' || parsed === null) {
        return { success: false, commands: [], errors: ['JSON解析结果不是对象'], warnings: [] };
      }

      // 递归提取所有变量设置
      this.extractJsonCommands(parsed, '', commands);

      if (commands.length === 0) {
        warnings.push('JSON格式正确但未检测到变量更新指令');
      }

      return { success: true, commands, errors, warnings };
    } catch (e) {
      // JSON解析失败，返回失败状态
      return { success: false, commands: [], errors: [], warnings: [] };
    }
  }

  /**
   * 递归提取JSON中的变量命令
   */
  private extractJsonCommands(obj: any, parentPath: string, commands: ParsedCommand[]): void {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = parentPath ? `${parentPath}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // 检查是否是命令格式 { operation: 'set', value: xxx }
        if ('operation' in value || 'value' in value || 'set' in value || 'add' in value) {
          commands.push(this.parseJsonCommand(currentPath, value));
        } else {
          // 递归处理嵌套对象
          this.extractJsonCommands(value, currentPath, commands);
        }
      } else {
        // 直接赋值
        commands.push({
          path: currentPath,
          operation: 'set',
          value: value,
          rawLine: `${currentPath} = ${JSON.stringify(value)}`,
        });
      }
    }
  }

  /**
   * 解析JSON格式的单条命令
   */
  private parseJsonCommand(path: string, cmdObj: any): ParsedCommand {
    let operation: ParsedCommand['operation'] = 'set';
    let value: any;
    let comment: string | undefined;

    if ('operation' in cmdObj) {
      operation = this.normalizeOperation(cmdObj.operation);
      value = cmdObj.value ?? cmdObj.newValue;
      comment = cmdObj.comment || cmdObj.reason;
    } else if ('set' in cmdObj) {
      operation = 'set';
      value = cmdObj.set;
    } else if ('add' in cmdObj) {
      operation = 'add';
      value = cmdObj.add;
    } else if ('subtract' in cmdObj || 'sub' in cmdObj) {
      operation = 'subtract';
      value = cmdObj.subtract ?? cmdObj.sub;
    } else if ('value' in cmdObj) {
      operation = 'set';
      value = cmdObj.value;
      comment = cmdObj.comment || cmdObj.reason;
    } else {
      // 未知格式，尝试直接使用
      operation = 'unknown';
      value = cmdObj;
    }

    return {
      path,
      operation,
      value,
      comment,
      rawLine: JSON.stringify({ [path]: cmdObj }),
    };
  }

  /**
   * 标准化操作类型
   */
  private normalizeOperation(op: string): ParsedCommand['operation'] {
    const normalized = op.toLowerCase().trim();
    switch (normalized) {
      case 'set':
      case '=':
      case 'assign':
        return 'set';
      case 'add':
      case '+':
      case '+=':
      case 'increase':
        return 'add';
      case 'subtract':
      case 'sub':
      case '-':
      case '-=':
      case 'decrease':
        return 'subtract';
      case 'append':
      case 'push':
        return 'append';
      case 'remove':
      case 'delete':
        return 'remove';
      default:
        return 'unknown';
    }
  }

  /**
   * 尝试将内容解析为行格式
   */
  private tryParseAsLines(content: string): {
    commands: ParsedCommand[];
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const commands: ParsedCommand[] = [];

    const lines = content.split('\n').filter(line => line.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // 跳过注释行
      if (line.startsWith('//') || line.startsWith('#') || line.startsWith('--')) {
        continue;
      }

      // 尝试解析行命令
      const parsed = this.parseLineCommand(line);

      if (parsed) {
        commands.push(parsed);
      } else if (line.length > 0) {
        // 无法解析的非空行
        warnings.push(`第${lineNum}行无法解析: "${line.substring(0, 50)}${line.length > 50 ? '...' : ''}"`);
      }
    }

    return { commands, errors, warnings };
  }

  /**
   * 解析单行命令
   * 支持格式：
   * - path = value
   * - path += value
   * - path -= value
   * - path: value
   */
  private parseLineCommand(line: string): ParsedCommand | null {
    // 匹配 path 操作符 value 的模式
    const patterns = [
      // path += value
      /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5.]*)\s*\+=\s*(.+)$/,
      // path -= value
      /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5.]*)\s*-=\s*(.+)$/,
      // path = value
      /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5.]*)\s*=\s*(.+)$/,
      // path: value (YAML风格)
      /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5.]*)\s*:\s*(.+)$/,
    ];

    const operations: ParsedCommand['operation'][] = ['add', 'subtract', 'set', 'set'];

    for (let i = 0; i < patterns.length; i++) {
      const match = line.match(patterns[i]);
      if (match) {
        const path = match[1].trim();
        let valueStr = match[2].trim();

        // 提取注释
        let comment: string | undefined;
        const commentMatch = valueStr.match(/\/\/\s*(.+)$/);
        if (commentMatch) {
          comment = commentMatch[1].trim();
          valueStr = valueStr.substring(0, commentMatch.index).trim();
        }

        // 解析值
        const value = this.parseValue(valueStr);

        return {
          path,
          operation: operations[i],
          value,
          comment,
          rawLine: line,
        };
      }
    }

    return null;
  }

  /**
   * 解析值字符串
   */
  private parseValue(valueStr: string): any {
    // 去除首尾空格
    valueStr = valueStr.trim();

    // null
    if (valueStr === 'null') return null;

    // undefined
    if (valueStr === 'undefined') return undefined;

    // 布尔值
    if (valueStr === 'true') return true;
    if (valueStr === 'false') return false;

    // 数字
    const num = Number(valueStr);
    if (!isNaN(num) && valueStr !== '') return num;

    // 字符串（带引号）
    if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
      return valueStr.slice(1, -1);
    }

    // JSON数组或对象
    if ((valueStr.startsWith('[') && valueStr.endsWith(']')) || (valueStr.startsWith('{') && valueStr.endsWith('}'))) {
      try {
        return JSON.parse(valueStr);
      } catch {
        // 解析失败，当作字符串
      }
    }

    // 默认当作字符串
    return valueStr;
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 快速检查：仅检查是否包含所有必需标签
   */
  public quickCheck(aiResponse: string): { passed: boolean; missingTags: string[] } {
    const missingTags: string[] = [];

    for (const tag of REQUIRED_TAGS) {
      if (tag.required) {
        const check = this.checkTag(aiResponse, tag.name);
        if (!check.exists || !check.isClosed) {
          missingTags.push(tag.displayName);
        }
      }
    }

    return {
      passed: missingTags.length === 0,
      missingTags,
    };
  }

  /**
   * 获取审查结果的摘要文本
   */
  public getSummary(result: ReviewResult): string {
    const lines: string[] = [];

    if (result.passed) {
      lines.push('✅ 格式审查通过');
    } else {
      lines.push('❌ 格式审查未通过');
    }

    const errorCount = result.issues.filter(i => i.level === 'error').length;
    const warningCount = result.issues.filter(i => i.level === 'warning').length;

    if (errorCount > 0) {
      lines.push(`  - ${errorCount} 个错误`);
    }
    if (warningCount > 0) {
      lines.push(`  - ${warningCount} 个警告`);
    }

    if (result.variableCheck) {
      lines.push(`  - ${result.variableCheck.commands.length} 条变量更新指令`);
    }

    return lines.join('\n');
  }
}

// 导出单例实例
export const aiResponseReviewService = AIResponseReviewService.getInstance();

// 也导出类（用于测试）
export { AIResponseReviewService };
