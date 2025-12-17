/**
 * AI上下文过滤服务
 * 负责过滤和转换游戏数据，生成适合AI阅读的精简上下文
 */

import type {
  AIContextOptions,
  FilteredData,
  FilterPreset,
  FilterResult,
  FilterRuleConfig,
  FilterStats,
  FormattedOutput,
  FormSimplifyConfig,
  MetaTag,
  OutputFormat,
  OutputOptions,
  TableSimplifyConfig,
} from '../types/aiContext';

/**
 * 默认过滤规则配置
 */
const DEFAULT_FILTER_RULES: FilterRuleConfig = {
  removeMeta: true,
  removeHiddenNodes: true,
  simplifyStructures: true,
  removeEmptyNodes: true,
  excludeFields: [],
  includeFields: [],
  maxDepth: 0,
  maxArrayLength: 0,
};

/**
 * 新变量结构专用排除字段
 * 这些字段仅供前端使用，AI不需要看到
 */
const FRONTEND_ONLY_FIELDS = [
  '模板定义', // 人事系统模板定义
  '字段定义', // 模板中的字段定义
  '显示配置', // UI显示配置
  '通用字段组定义', // 可复用字段组
];

/**
 * 元数据相关的字段（用于更精确的过滤）
 */
const METADATA_FIELDS = ['修订记录', '版本', '生效日期', '编制单位', '文件编号', '所属大类', '类别代码'];

/**
 * 预设配置映射
 * 适配新变量结构：规章制度 + 人事系统 + 申请表记录
 */
const PRESET_CONFIGS: Record<FilterPreset, Partial<FilterRuleConfig>> = {
  /** 完整模式：保留所有AI可见内容 */
  full: {
    removeMeta: true,
    removeHiddenNodes: true,
    simplifyStructures: false,
    removeEmptyNodes: false,
    maxDepth: 0,
    maxArrayLength: 0,
  },
  /** 标准模式：移除元数据，简化结构 */
  standard: {
    removeMeta: true,
    removeHiddenNodes: true,
    simplifyStructures: true,
    removeEmptyNodes: true,
    maxDepth: 12,
    maxArrayLength: 20,
    excludeFields: [...FRONTEND_ONLY_FIELDS],
  },
  /** 紧凑模式：更激进的压缩，适合日常对话 */
  compact: {
    removeMeta: true,
    removeHiddenNodes: true,
    simplifyStructures: true,
    removeEmptyNodes: true,
    maxDepth: 8,
    maxArrayLength: 10,
    excludeFields: [
      ...FRONTEND_ONLY_FIELDS,
      ...METADATA_FIELDS,
      '附件', // 附件表单定义
      '页面定义', // 档案模板页面定义
      '档案元数据', // 档案元信息
    ],
  },
  /** 最小模式：仅保留核心内容，适合token受限场景 */
  minimal: {
    removeMeta: true,
    removeHiddenNodes: true,
    simplifyStructures: true,
    removeEmptyNodes: true,
    maxDepth: 5,
    maxArrayLength: 5,
    excludeFields: [
      ...FRONTEND_ONLY_FIELDS,
      ...METADATA_FIELDS,
      '附件',
      '页面定义',
      '档案元数据',
      '备注',
      '荣誉程度',
      '层级',
      '审批记录', // 详细审批历史
    ],
  },
};

/**
 * 预设表格配置映射
 */
const PRESET_TABLE_CONFIGS: Record<FilterPreset, Partial<TableSimplifyConfig>> = {
  full: {
    toDescription: false,
    compact: false,
    maxRows: 0,
  },
  standard: {
    toDescription: false,
    compact: true,
    maxRows: 10,
  },
  compact: {
    toDescription: true,
    compact: true,
    maxRows: 5,
  },
  minimal: {
    toDescription: true,
    compact: true,
    maxRows: 3,
  },
};

/**
 * 默认输出选项
 * 默认使用 markdown 格式，更适合预览和AI阅读
 */
const DEFAULT_OUTPUT_OPTIONS: OutputOptions = {
  format: 'markdown',
  pretty: true,
  indent: 2,
  includePaths: false,
  language: 'zh',
};

/**
 * 默认表格简化配置
 */
const DEFAULT_TABLE_CONFIG: TableSimplifyConfig = {
  toDescription: false,
  keepColumns: [],
  maxRows: 10,
  compact: true,
};

/**
 * 默认表单简化配置
 */
const DEFAULT_FORM_CONFIG: FormSimplifyConfig = {
  requiredOnly: false,
  removeTypeInfo: true,
  removeOptions: false,
  removeConditions: true,
};

export class AIContextFilterService {
  private rules: FilterRuleConfig;
  private outputOptions: OutputOptions;
  private tableConfig: TableSimplifyConfig;
  private formConfig: FormSimplifyConfig;
  private stats: FilterStats;
  private filteredPaths: string[];

  private currentPreset: FilterPreset = 'standard';

  constructor() {
    this.rules = { ...DEFAULT_FILTER_RULES };
    this.outputOptions = { ...DEFAULT_OUTPUT_OPTIONS };
    this.tableConfig = { ...DEFAULT_TABLE_CONFIG };
    this.formConfig = { ...DEFAULT_FORM_CONFIG };
    this.stats = this.createEmptyStats();
    this.filteredPaths = [];
  }

  /**
   * 创建空的统计对象
   */
  private createEmptyStats(): FilterStats {
    return {
      totalNodes: 0,
      keptNodes: 0,
      filteredNodes: 0,
      simplifiedStructures: 0,
      processingTime: 0,
    };
  }

  /**
   * 应用预设配置
   */
  public applyPreset(preset: FilterPreset): void {
    this.currentPreset = preset;
    const presetConfig = PRESET_CONFIGS[preset];
    this.rules = { ...DEFAULT_FILTER_RULES, ...presetConfig };
    // 同时应用预设的表格配置
    const presetTableConfig = PRESET_TABLE_CONFIGS[preset];
    if (presetTableConfig) {
      this.tableConfig = { ...DEFAULT_TABLE_CONFIG, ...presetTableConfig };
    }
  }

  /**
   * 设置自定义规则
   */
  public setRules(rules: Partial<FilterRuleConfig>): void {
    this.rules = { ...this.rules, ...rules };
  }

  /**
   * 设置输出选项
   */
  public setOutputOptions(options: Partial<OutputOptions>): void {
    this.outputOptions = { ...this.outputOptions, ...options };
  }

  /**
   * 主过滤方法：处理完整数据对象
   */
  public filter(data: Record<string, any>, options?: AIContextOptions): FilterResult {
    const startTime = performance.now();

    // 应用选项
    if (options?.preset) {
      this.applyPreset(options.preset);
    }
    if (options?.customRules) {
      this.setRules(options.customRules);
    }
    if (options?.output) {
      this.setOutputOptions(options.output);
    }
    if (options?.tableConfig) {
      this.tableConfig = { ...DEFAULT_TABLE_CONFIG, ...options.tableConfig };
    }
    if (options?.formConfig) {
      this.formConfig = { ...DEFAULT_FORM_CONFIG, ...options.formConfig };
    }

    // 重置统计
    this.stats = this.createEmptyStats();
    this.filteredPaths = [];

    // 计算原始大小
    const originalJson = JSON.stringify(data);
    const originalSize = originalJson.length;

    // 执行过滤
    const filteredData = this.filterNode(data, '', 0);

    // 计算过滤后大小
    const filteredJson = JSON.stringify(filteredData);
    const filteredSize = filteredJson.length;

    // 构建过滤结果
    const filtered: FilteredData = {
      data: filteredData,
      originalSize,
      filteredSize,
      compressionRatio: originalSize > 0 ? (1 - filteredSize / originalSize) * 100 : 0,
      filteredPaths: this.filteredPaths,
      timestamp: Date.now(),
    };

    // 格式化输出
    const output = this.formatOutput(filteredData, filtered);

    // 完成统计
    this.stats.processingTime = performance.now() - startTime;

    return {
      filtered,
      output,
      stats: { ...this.stats },
    };
  }

  /**
   * 递归过滤节点
   * @param node 当前节点
   * @param path 当前路径
   * @param depth 当前深度
   * @param inheritedHidden 是否继承了父节点的隐藏状态（父节点aiVisible=false且当前节点未显式声明aiVisible=true）
   */
  private filterNode(node: any, path: string, depth: number, inheritedHidden: boolean = false): any {
    this.stats.totalNodes++;

    // 检查深度限制
    if (this.rules.maxDepth > 0 && depth > this.rules.maxDepth) {
      this.stats.filteredNodes++;
      this.filteredPaths.push(path);
      return '[已省略深层内容]';
    }

    // 处理null和undefined
    if (node === null || node === undefined) {
      if (this.rules.removeEmptyNodes) {
        this.stats.filteredNodes++;
        return undefined;
      }
      return node;
    }

    // 处理基本类型
    if (typeof node !== 'object') {
      // 如果继承了隐藏状态，基本类型值不应该暴露
      if (inheritedHidden) {
        this.stats.filteredNodes++;
        return undefined;
      }
      this.stats.keptNodes++;
      return node;
    }

    // 处理数组
    if (Array.isArray(node)) {
      return this.filterArray(node, path, depth, inheritedHidden);
    }

    // 处理对象
    return this.filterObject(node, path, depth, inheritedHidden);
  }

  /**
   * 过滤数组
   * 即使继承了隐藏状态，仍需递归处理每个元素，因为元素可能有显式的 aiVisible: true
   */
  private filterArray(
    arr: any[],
    path: string,
    depth: number,
    inheritedHidden: boolean = false,
  ): any[] | string | undefined {
    // 检查数组长度限制
    const maxLen = this.rules.maxArrayLength;
    const shouldTruncate = maxLen > 0 && arr.length > maxLen;
    const itemsToProcess = shouldTruncate ? arr.slice(0, maxLen) : arr;

    const result = itemsToProcess
      .map((item, index) => this.filterNode(item, `${path}[${index}]`, depth + 1, inheritedHidden))
      .filter(item => item !== undefined);

    // 如果截断了，添加省略提示
    if (shouldTruncate && result.length > 0) {
      result.push(`[...还有${arr.length - maxLen}项已省略]`);
    }

    // 如果结果为空且启用了空节点移除，返回 undefined
    if (this.rules.removeEmptyNodes && result.length === 0) {
      this.stats.filteredNodes++;
      return undefined;
    }

    this.stats.keptNodes++;
    return result;
  }

  /**
   * 检测对象是否像表格数据（即使没有$meta标记）
   */
  private looksLikeTable(obj: Record<string, any>): boolean {
    // 检查是否有数组字段，且数组内容是相似结构的对象
    for (const value of Object.values(obj)) {
      if (Array.isArray(value) && value.length > 1) {
        // 检查数组元素是否都是相似结构的对象
        const firstItem = value[0];
        if (typeof firstItem === 'object' && firstItem !== null) {
          const keys = Object.keys(firstItem).filter(k => k !== '$meta');
          if (keys.length >= 2) {
            // 检查是否大多数元素都有相似的键
            const similarCount = value.filter(item => {
              if (typeof item !== 'object' || item === null) return false;
              const itemKeys = Object.keys(item).filter(k => k !== '$meta');
              return keys.every(k => itemKeys.includes(k));
            }).length;
            if (similarCount >= value.length * 0.8) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * 检查是否是需要过滤的模板字段
   * $meta.template 是前端用于动态生成表单的模板定义，AI不需要
   */
  private isTemplateField(key: string, value: any, parentMeta: MetaTag | undefined): boolean {
    // 1. $meta 内部的 template 字段
    if (key === 'template' && parentMeta !== undefined) {
      return true;
    }
    // 2. 值本身的 $meta 包含 template 结构（模板定义对象）
    if (typeof value === 'object' && value !== null && value.$meta?.template) {
      return true;
    }
    return false;
  }

  /**
   * 检查是否是仅前端使用的字段
   */
  private isFrontendOnlyField(key: string): boolean {
    return FRONTEND_ONLY_FIELDS.includes(key);
  }

  /**
   * 检查对象是否像字段组定义结构
   * 字段组格式：{ 组名称: string, 字段: [...] } 或 { 组名: string, 字段: [...] }
   */
  private looksLikeFieldGroup(obj: Record<string, any>): boolean {
    return (
      (obj['组名称'] !== undefined || obj['组名'] !== undefined) &&
      (Array.isArray(obj['字段']) || Array.isArray(obj['fields']))
    );
  }

  /**
   * 检查对象是否像表单附件定义（需要根据 aiVisible 过滤）
   */
  private looksLikeFormAttachment(obj: Record<string, any>): boolean {
    return obj['表单名称'] !== undefined && obj['字段组'] !== undefined;
  }

  /**
   * 过滤对象
   *
   * 核心逻辑（适配新变量结构）：
   * 1. aiVisible: false 会向下传递隐藏状态给子节点
   * 2. 子节点只有显式声明 aiVisible: true 才能覆盖继承的隐藏状态
   * 3. $meta 中的 template 定义会被过滤掉（仅前端使用）
   * 4. 模板定义、字段定义、显示配置等前端字段会被过滤
   * 5. 附件中的表单定义（aiVisible: false）会被过滤
   * @param inheritedHidden 是否继承了父节点的隐藏状态
   */
  private filterObject(
    obj: Record<string, any>,
    path: string,
    depth: number,
    inheritedHidden: boolean = false,
  ): Record<string, any> | undefined {
    // 检查$meta标签
    const meta: MetaTag | undefined = obj.$meta;

    // 计算当前节点的可见性：
    // 1. 如果当前节点显式声明 aiVisible: true，则可见（覆盖继承的隐藏状态）
    // 2. 如果当前节点显式声明 aiVisible: false，则隐藏
    // 3. 如果没有显式声明，则继承父节点的状态
    let isNodeHidden = inheritedHidden;
    if (this.rules.removeHiddenNodes && meta !== undefined) {
      if (meta.aiVisible === true) {
        // 显式声明可见，覆盖继承的隐藏状态
        isNodeHidden = false;
      } else if (meta.aiVisible === false) {
        // 显式声明隐藏
        isNodeHidden = true;
      }
      // 如果没有声明 aiVisible，保持继承的状态
    }

    // 如果节点完全隐藏（不需要递归查找可见子节点），直接返回
    // 注意：我们仍然需要递归处理，因为可能有子节点显式声明 aiVisible: true

    // 检查是否需要简化表格/表单结构（只在非隐藏节点上进行）
    if (this.rules.simplifyStructures && !isNodeHidden) {
      // 如果有明确的type标记
      if (meta?.type) {
        const simplified = this.simplifyStructure(obj, meta, path, depth);
        if (simplified !== null) {
          this.stats.simplifiedStructures++;
          return simplified;
        }
      }
      // 如果没有标记但看起来像表格，也进行简化
      else if (this.looksLikeTable(obj)) {
        const fakeTableMeta: MetaTag = { type: 'table' };
        const simplified = this.simplifyStructure(obj, fakeTableMeta, path, depth);
        if (simplified !== null) {
          this.stats.simplifiedStructures++;
          return simplified;
        }
      }
      // 检查是否像字段组结构（新变量结构中的字段组）
      else if (this.looksLikeFieldGroup(obj)) {
        const simplified = this.simplifyFieldGroupObject(obj);
        if (simplified !== null) {
          this.stats.simplifiedStructures++;
          return simplified;
        }
      }
    }

    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      // 跳过$meta字段
      if (this.rules.removeMeta && key === '$meta') {
        this.stats.filteredNodes++;
        continue;
      }

      // 检查是否是模板字段（$meta内的template或模板定义对象）
      if (this.rules.removeMeta && this.isTemplateField(key, value, meta)) {
        this.stats.filteredNodes++;
        this.filteredPaths.push(currentPath);
        continue;
      }

      // 检查是否是仅前端使用的字段
      if (this.rules.removeHiddenNodes && this.isFrontendOnlyField(key)) {
        this.stats.filteredNodes++;
        this.filteredPaths.push(currentPath);
        continue;
      }

      // 检查排除字段
      if (this.rules.excludeFields.length > 0 && this.rules.excludeFields.includes(key)) {
        // 但如果在包含列表中，则保留
        if (!this.rules.includeFields.includes(key)) {
          this.stats.filteredNodes++;
          this.filteredPaths.push(currentPath);
          continue;
        }
      }

      // 特殊处理：检查子对象的 $meta.aiVisible
      // 这对于附件这类结构很重要，它们的 $meta.aiVisible 设为 false
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const childMeta = value.$meta;
        if (childMeta && childMeta.aiVisible === false && this.rules.removeHiddenNodes) {
          // 子节点显式声明不可见，跳过整个子树
          this.stats.filteredNodes++;
          this.filteredPaths.push(currentPath);
          continue;
        }
      }

      // 如果当前节点标记为隐藏
      if (isNodeHidden) {
        // 对于非对象值，直接跳过
        if (typeof value !== 'object' || value === null) {
          this.stats.filteredNodes++;
          continue;
        }
        // 对于对象类型的子节点，检查是否有显式的 aiVisible: true
        // 如果没有，则跳过整个子树
        if (typeof value === 'object' && value !== null) {
          const childMeta = value.$meta;
          if (!childMeta || childMeta.aiVisible !== true) {
            this.stats.filteredNodes++;
            continue;
          }
        }
      }

      // 递归处理子节点，传递当前的隐藏状态
      const filteredValue = this.filterNode(value, currentPath, depth + 1, isNodeHidden);

      // 跳过undefined和空对象
      if (filteredValue === undefined) {
        continue;
      }
      if (
        this.rules.removeEmptyNodes &&
        typeof filteredValue === 'object' &&
        !Array.isArray(filteredValue) &&
        Object.keys(filteredValue).length === 0
      ) {
        this.stats.filteredNodes++;
        continue;
      }

      result[key] = filteredValue;
    }

    // 如果当前节点是隐藏的，记录被过滤的路径
    if (isNodeHidden && !inheritedHidden) {
      // 只记录首次变为隐藏的路径，不记录继承的
      this.filteredPaths.push(path);
    }

    // 检查结果是否为空
    if (this.rules.removeEmptyNodes && Object.keys(result).length === 0) {
      this.stats.filteredNodes++;
      return undefined;
    }

    this.stats.keptNodes++;
    return result;
  }

  /**
   * 简化字段组对象（新变量结构中的字段组）
   */
  private simplifyFieldGroupObject(obj: Record<string, any>): Record<string, any> | null {
    const groupName = obj['组名称'] || obj['组名'] || '未命名组';
    const fields = obj['字段'] || obj['fields'] || [];

    if (!Array.isArray(fields) || fields.length === 0) {
      return null;
    }

    // 根据预设选择简化程度
    if (this.currentPreset === 'minimal') {
      // 最小模式：只列出必填字段名
      const requiredFields = fields
        .filter((f: any) => f.必填 === true || f.required === true)
        .map((f: any) => f.键 || f.key || f.名称)
        .filter(Boolean);
      return {
        [groupName]: requiredFields.length > 0 ? `必填:${requiredFields.join('、')}` : '无必填项',
      };
    }

    if (this.currentPreset === 'compact') {
      // 紧凑模式：简化字段信息
      const simplifiedFields = fields.map((f: any) => {
        const name = f.键 || f.key || f.名称;
        const required = f.必填 === true ? '*' : '';
        return `${name}${required}`;
      });
      return {
        [groupName]: simplifiedFields.join('、'),
      };
    }

    // 标准模式：保留更多信息
    return {
      组名: groupName,
      字段: fields.map((f: any) => this.simplifyField(f)),
    };
  }

  /**
   * 简化特殊结构（表格、表单、流程）
   */
  private simplifyStructure(
    obj: Record<string, any>,
    meta: MetaTag,
    path: string,
    depth: number,
  ): Record<string, any> | null {
    switch (meta.type) {
      case 'table':
        return this.simplifyTable(obj, path, depth);
      case 'form':
        return this.simplifyForm(obj, path, depth);
      case 'flow':
        return this.simplifyFlow(obj, path, depth);
      default:
        return null;
    }
  }

  /**
   * 简化表格结构
   */
  private simplifyTable(obj: Record<string, any>, path: string, depth: number): Record<string, any> {
    const result: Record<string, any> = {};

    // 查找包含列表数据的字段
    for (const [key, value] of Object.entries(obj)) {
      if (key === '$meta') continue;

      if (Array.isArray(value) && value.length > 0) {
        // 这是表格数据
        if (this.tableConfig.toDescription) {
          // 转换为描述性文本
          result[key] = this.tableToDescription(value);
        } else if (this.tableConfig.compact) {
          // 紧凑格式：只保留关键列
          result[key] = this.compactTable(value);
        } else {
          // 保留但限制行数
          const maxRows = this.tableConfig.maxRows || this.rules.maxArrayLength || value.length;
          result[key] = value.slice(0, maxRows);
          if (value.length > maxRows) {
            result[`${key}_总数`] = value.length;
          }
        }
      } else {
        // 非数组字段，正常处理
        const filtered = this.filterNode(value, `${path}.${key}`, depth + 1);
        if (filtered !== undefined) {
          result[key] = filtered;
        }
      }
    }

    return result;
  }

  /**
   * 将表格转换为描述性文本（极简格式）
   */
  private tableToDescription(rows: any[]): string {
    if (rows.length === 0) return '（空表）';

    // 需要排除的字段
    const excludeKeys = ['$meta', '层级', '序号', '索引', '荣誉程度', 'index', 'order'];

    // 获取第一行的键作为列名，排除不重要的字段
    const columns = Object.keys(rows[0]).filter(k => !excludeKeys.includes(k));

    // 根据预设选择不同的格式
    if (this.currentPreset === 'minimal') {
      // 最小模式：只取名称和代码，用顿号分隔
      const maxRows = this.tableConfig.maxRows || 3;
      const items = rows
        .slice(0, maxRows)
        .map(row => {
          const name = row['名称'] || row['name'] || row['标题'] || row['title'];
          const code = row['代码'] || row['code'] || row['编号'] || '';
          return code ? `${name}(${code})` : name;
        })
        .filter(Boolean);

      let result = items.join('、');
      if (rows.length > maxRows) {
        result += `等共${rows.length}项`;
      }
      return result;
    }

    if (this.currentPreset === 'compact') {
      // 紧凑模式：简短描述
      const maxRows = this.tableConfig.maxRows || 5;
      const items = rows.slice(0, maxRows).map(row => {
        // 只保留2-3个最重要的字段
        const importantKeys = ['名称', 'name', '代码', 'code', '类型', 'type', '授奖权限'];
        const parts = columns
          .filter(col => importantKeys.some(k => col.includes(k) || k.includes(col)))
          .slice(0, 3)
          .map(col => `${col}:${row[col]}`)
          .filter(part => !part.includes('undefined'));
        return parts.join('，');
      });

      let result = items.join('；');
      if (rows.length > maxRows) {
        result += `...等共${rows.length}项`;
      }
      return result;
    }

    // 标准模式：保留更多字段
    const maxRows = this.tableConfig.maxRows || 10;
    const descriptions = rows.slice(0, maxRows).map(row => {
      const parts = columns
        .filter(col => this.tableConfig.keepColumns.length === 0 || this.tableConfig.keepColumns.includes(col))
        .map(col => {
          const val = row[col];
          if (val === null || val === undefined || val === '') return null;
          return `${col}:${val}`;
        })
        .filter(Boolean);
      return parts.join('，');
    });

    let result = descriptions.join('；');
    if (rows.length > maxRows) {
      result += `...等共${rows.length}项`;
    }
    return result;
  }

  /**
   * 紧凑化表格
   */
  private compactTable(rows: any[]): any[] {
    const maxRows = this.tableConfig.maxRows || this.rules.maxArrayLength || rows.length;
    // 排除的字段
    const excludeKeys = ['$meta', '层级', '序号', '索引', '荣誉程度', 'index', 'order'];

    return rows.slice(0, maxRows).map(row => {
      if (typeof row !== 'object') return row;

      // 移除冗余字段，保留核心信息
      const compact: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        // 跳过排除字段
        if (excludeKeys.includes(key)) continue;
        // 跳过纯数字索引类的字段
        if (/^(层级|序号|索引|index|order)$/i.test(key) && typeof value === 'number') continue;
        // 保留有意义的内容
        compact[key] = value;
      }
      return compact;
    });
  }

  /**
   * 简化表单结构
   */
  private simplifyForm(obj: Record<string, any>, path: string, depth: number): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (key === '$meta') continue;

      if (key === '字段组' && Array.isArray(value)) {
        // 简化字段组
        result['表单字段'] = this.simplifyFieldGroups(value);
      } else {
        const filtered = this.filterNode(value, `${path}.${key}`, depth + 1);
        if (filtered !== undefined) {
          result[key] = filtered;
        }
      }
    }

    return result;
  }

  /**
   * 简化字段组
   * 适配新变量结构：字段组可能是对象映射而不是数组
   */
  private simplifyFieldGroups(groups: any[] | Record<string, any>): any[] | Record<string, string> | string {
    // 处理对象映射格式（新变量结构）
    if (!Array.isArray(groups) && typeof groups === 'object') {
      const result: Record<string, string> = {};
      for (const [key, group] of Object.entries(groups)) {
        if (key === '$meta') continue;
        if (typeof group !== 'object' || group === null) continue;

        const groupName = group['组名称'] || group['组名'] || key;
        const fields = group['字段'] || [];

        if (this.currentPreset === 'minimal') {
          // 最小模式：只列出必填字段名
          const requiredFields = fields
            .filter((f: any) => f.必填 === true)
            .map((f: any) => f.键 || f.名称)
            .filter(Boolean);
          result[groupName] = requiredFields.length > 0 ? `必填:${requiredFields.join('、')}` : '无必填';
        } else if (this.currentPreset === 'compact') {
          // 紧凑模式
          const fieldNames = fields.map((f: any) => {
            const name = f.键 || f.名称;
            const required = f.必填 ? '*' : '';
            return `${name}${required}`;
          });
          result[groupName] = fieldNames.join('、');
        } else {
          // 标准模式：保留更多信息
          result[groupName] = fields
            .map((f: any) => {
              const name = f.键 || f.名称;
              const type = f.类型 || 'text';
              const required = f.必填 ? '(必填)' : '';
              return `${name}[${type}]${required}`;
            })
            .join('、');
        }
      }
      return result;
    }

    // 处理数组格式（兼容旧格式）
    const simplified = groups.map(group => {
      const groupName = group.组名 || group.组名称 || group.name || '未命名';
      const fields = group.字段 || group.fields || [];

      if (this.formConfig.requiredOnly) {
        // 只保留必填字段
        const requiredFields = fields.filter((f: any) => f.必填 === true || f.required === true);
        if (requiredFields.length === 0) return null;

        return {
          组: groupName,
          字段: requiredFields.map((f: any) => this.simplifyField(f)),
        };
      }

      return {
        组: groupName,
        字段: fields.map((f: any) => this.simplifyField(f)),
      };
    });

    return simplified.filter(g => g !== null);
  }

  /**
   * 简化单个字段
   */
  private simplifyField(field: any): any {
    const result: Record<string, any> = {
      名称: field.键 || field.key || field.名称 || '未知',
    };

    // 可选：保留类型信息
    if (!this.formConfig.removeTypeInfo) {
      result.类型 = field.类型 || field.type;
    }

    // 标记必填
    if (field.必填 === true || field.required === true) {
      result.必填 = true;
    }

    // 可选：保留选项
    if (!this.formConfig.removeOptions && field.选项) {
      result.选项 = Array.isArray(field.选项)
        ? field.选项.map((o: any) => (typeof o === 'object' ? o.标签 || o.值 || o : o))
        : field.选项;
    }

    return result;
  }

  /**
   * 简化流程结构
   * 适配新变量结构：流程步骤可能包含执行人、选项等信息
   */
  private simplifyFlow(obj: Record<string, any>, path: string, depth: number): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (key === '$meta') continue;

      if (key === '流程步骤' && Array.isArray(value)) {
        // 根据预设选择简化程度
        if (this.currentPreset === 'minimal') {
          // 最小模式：只保留步骤名称，用箭头连接
          result['流程'] = value.map((step: any) => step.名称 || step.name).join('→');
        } else if (this.currentPreset === 'compact') {
          // 紧凑模式：步骤号+名称+执行人
          result['流程'] = value.map((step: any) => {
            const stepNum = step.步骤 || step.step;
            const name = step.名称 || step.name;
            const executor = step.执行人 || '';
            return executor ? `${stepNum}.${name}(${executor})` : `${stepNum}.${name}`;
          });
        } else {
          // 标准模式：保留更多信息，包括选项
          result['流程'] = value.map((step: any) => {
            const stepNum = step.步骤 || step.step;
            const name = step.名称 || step.name;
            const executor = step.执行人 || '';
            const options = step.选项 || [];
            let desc = `${stepNum}.${name}`;
            if (executor) desc += `(执行:${executor})`;
            if (options.length > 0) desc += `[${options.join('/')}]`;
            return desc;
          });
        }
      } else {
        const filtered = this.filterNode(value, `${path}.${key}`, depth + 1);
        if (filtered !== undefined) {
          result[key] = filtered;
        }
      }
    }

    return result;
  }

  /**
   * 格式化输出
   */
  private formatOutput(data: Record<string, any>, filtered: FilteredData): FormattedOutput {
    let content: string;

    switch (this.outputOptions.format) {
      case 'markdown':
        content = this.toMarkdown(data);
        break;
      case 'summary':
        content = this.toSummary(data);
        break;
      case 'structured':
        content = this.toStructured(data);
        break;
      case 'json':
      default:
        content = this.outputOptions.pretty
          ? JSON.stringify(data, null, this.outputOptions.indent)
          : JSON.stringify(data);
        break;
    }

    return {
      content,
      format: this.outputOptions.format,
      estimatedTokens: Math.ceil(content.length / 4),
      metadata: {
        sourceSize: filtered.originalSize,
        outputSize: content.length,
        compressionRatio: filtered.compressionRatio,
        timestamp: filtered.timestamp,
      },
    };
  }

  /**
   * 转换为Markdown格式
   */
  private toMarkdown(data: Record<string, any>, level: number = 1): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;

      const heading = '#'.repeat(Math.min(level, 6));

      if (typeof value === 'object' && !Array.isArray(value)) {
        lines.push(`${heading} ${key}`);
        lines.push('');
        lines.push(this.toMarkdown(value, level + 1));
      } else if (Array.isArray(value)) {
        lines.push(`${heading} ${key}`);
        lines.push('');
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            lines.push(`**${index + 1}.** ${JSON.stringify(item)}`);
          } else {
            lines.push(`- ${item}`);
          }
        });
        lines.push('');
      } else {
        lines.push(`- **${key}**: ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 转换为摘要格式
   */
  private toSummary(data: Record<string, any>): string {
    const lines: string[] = [];

    const extractSummary = (obj: any, prefix: string = '') => {
      if (typeof obj !== 'object' || obj === null) {
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = prefix ? `${prefix}/${key}` : key;

        if (typeof value === 'string' && value.length > 0) {
          // 对于长文本，只取前100个字符
          const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
          lines.push(`【${currentPath}】${displayValue}`);
        } else if (Array.isArray(value)) {
          lines.push(`【${currentPath}】共${value.length}项`);
        } else if (typeof value === 'object' && value !== null) {
          extractSummary(value, currentPath);
        }
      }
    };

    extractSummary(data);
    return lines.join('\n');
  }

  /**
   * 转换为结构化文本格式
   */
  private toStructured(data: Record<string, any>): string {
    const lines: string[] = [];

    const renderStructured = (obj: any, indent: number = 0) => {
      const spaces = '  '.repeat(indent);

      if (typeof obj !== 'object' || obj === null) {
        return String(obj);
      }

      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          if (typeof item === 'object') {
            lines.push(`${spaces}[${index + 1}]`);
            renderStructured(item, indent + 1);
          } else {
            lines.push(`${spaces}- ${item}`);
          }
        });
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          lines.push(`${spaces}${key}:`);
          renderStructured(value, indent + 1);
        } else {
          lines.push(`${spaces}${key}: ${value}`);
        }
      }
    };

    renderStructured(data);
    return lines.join('\n');
  }

  /**
   * 快速过滤方法：使用预设直接获取结果
   * @param data 要过滤的数据
   * @param preset 预设模式 (full/standard/compact/minimal)
   * @param format 输出格式 (markdown/json/summary/structured)，默认 markdown
   */
  public quickFilter(
    data: Record<string, any>,
    preset: FilterPreset = 'standard',
    format: OutputFormat = 'markdown',
  ): string {
    const result = this.filter(data, {
      preset,
      output: { format },
    });
    return result.output.content;
  }

  /**
   * 快速过滤为 JSON 格式（便捷方法）
   */
  public quickFilterJSON(data: Record<string, any>, preset: FilterPreset = 'standard'): string {
    return this.quickFilter(data, preset, 'json');
  }

  /**
   * 快速过滤为 Markdown 格式（便捷方法）
   */
  public quickFilterMarkdown(data: Record<string, any>, preset: FilterPreset = 'standard'): string {
    return this.quickFilter(data, preset, 'markdown');
  }

  /**
   * 快速过滤为摘要格式（便捷方法）
   */
  public quickFilterSummary(data: Record<string, any>, preset: FilterPreset = 'standard'): string {
    return this.quickFilter(data, preset, 'summary');
  }

  /**
   * 获取上次过滤的统计信息
   */
  public getStats(): FilterStats {
    return { ...this.stats };
  }

  /**
   * 估算Token数量
   */
  public estimateTokens(text: string): number {
    // 简单估算：中文约2字符/token，英文约4字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }

  // ========== 新变量结构专用方法 ==========

  /**
   * 过滤规章制度模块
   * 适配新变量结构：总纲 + Ⅰ-Ⅳ类分类
   */
  public filterRegulations(regulations: Record<string, any>, preset: FilterPreset = 'standard'): Record<string, any> {
    this.applyPreset(preset);
    return this.filterNode(regulations, '规章制度', 0) || {};
  }

  /**
   * 过滤人事系统模块
   * 适配新变量结构：模板定义(过滤) + 组织架构 + 人员数据
   */
  public filterPersonnelSystem(
    personnelSystem: Record<string, any>,
    preset: FilterPreset = 'standard',
  ): Record<string, any> {
    this.applyPreset(preset);

    // 人事系统需要特殊处理：模板定义应该被完全过滤
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(personnelSystem)) {
      if (key === '$meta') continue;
      if (key === '模板定义') continue; // 完全过滤模板定义

      const filtered = this.filterNode(value, `人事系统.${key}`, 1);
      if (filtered !== undefined) {
        result[key] = filtered;
      }
    }

    return result;
  }

  /**
   * 过滤申请表记录模块
   * 适配新变量结构：按来源制度分类的申请记录
   */
  public filterApplicationRecords(
    records: Record<string, any>,
    preset: FilterPreset = 'standard',
  ): Record<string, any> {
    this.applyPreset(preset);
    return this.filterNode(records, '申请表记录', 0) || {};
  }

  /**
   * 过滤系统变量模块
   * 包含当前时间、地点、玩家信息
   */
  public filterSystemVariables(systemVars: Record<string, any>): Record<string, any> {
    // 系统变量通常很小，使用 full 预设保留完整信息
    this.applyPreset('full');
    return this.filterNode(systemVars, '系统变量', 0) || {};
  }

  /**
   * 过滤完整数据库（新变量结构）
   * 按模块分别处理，优化过滤效果
   * @param database 完整数据库对象
   * @param preset 预设模式
   * @param format 输出格式，默认 markdown
   */
  public filterDatabase(
    database: Record<string, any>,
    preset: FilterPreset = 'standard',
    format: OutputFormat = 'markdown',
  ): FilterResult {
    const startTime = performance.now();
    this.stats = this.createEmptyStats();
    this.filteredPaths = [];
    this.applyPreset(preset);

    const originalJson = JSON.stringify(database);
    const originalSize = originalJson.length;

    const result: Record<string, any> = {};

    // 1. 系统变量 - 保留完整
    if (database['系统变量']) {
      result['系统变量'] = this.filterSystemVariables(database['系统变量']);
    }

    // 2. 规章制度 - 按预设过滤
    if (database['规章制度']) {
      result['规章制度'] = this.filterRegulations(database['规章制度'], preset);
    }

    // 3. 人事系统 - 特殊处理（过滤模板定义）
    if (database['人事系统']) {
      result['人事系统'] = this.filterPersonnelSystem(database['人事系统'], preset);
    }

    // 4. 申请表记录 - 按预设过滤
    if (database['申请表记录']) {
      result['申请表记录'] = this.filterApplicationRecords(database['申请表记录'], preset);
    }

    // 过滤其他可能的顶级字段（不包括 $meta 和已处理的模块）
    for (const [key, value] of Object.entries(database)) {
      if (key === '$meta') continue;
      if (['系统变量', '规章制度', '人事系统', '申请表记录', '通用字段组定义'].includes(key)) continue;

      const filtered = this.filterNode(value, key, 0);
      if (filtered !== undefined) {
        result[key] = filtered;
      }
    }

    const filteredJson = JSON.stringify(result);
    const filteredSize = filteredJson.length;

    const filtered: FilteredData = {
      data: result,
      originalSize,
      filteredSize,
      compressionRatio: originalSize > 0 ? (1 - filteredSize / originalSize) * 100 : 0,
      filteredPaths: this.filteredPaths,
      timestamp: Date.now(),
    };

    // 设置输出格式
    this.outputOptions.format = format;
    const output = this.formatOutput(result, filtered);
    this.stats.processingTime = performance.now() - startTime;

    return {
      filtered,
      output,
      stats: { ...this.stats },
    };
  }

  /**
   * 获取人员工作证信息（简化版）
   * 适用于快速查询人员基本信息
   */
  public getStaffBrief(
    personnelSystem: Record<string, any>,
    staffId?: string,
  ): Record<string, any> | Record<string, any>[] {
    const workCards = personnelSystem?.['人员数据']?.['工作证库'] || {};

    if (staffId) {
      // 返回指定人员的工作证
      const card = workCards[staffId];
      if (!card) return {};

      // 简化工作证信息
      return {
        工号: card.工号,
        姓名: card.姓名,
        所属科室: card.所属科室,
        职级: card.职级,
        状态: card.状态,
      };
    }

    // 返回所有人员的简化信息
    const result: Record<string, any>[] = [];
    for (const [id, card] of Object.entries(workCards)) {
      if (id === '$meta') continue;
      const c = card as Record<string, any>;
      result.push({
        工号: c.工号,
        姓名: c.姓名,
        科室: c.所属科室,
        职级: c.职级,
        状态: c.状态,
      });
    }
    return result;
  }

  /**
   * 获取组织架构摘要
   */
  public getOrganizationSummary(personnelSystem: Record<string, any>): string {
    const org = personnelSystem?.['组织架构'] || {};
    const summaries: string[] = [];

    for (const [code, dept] of Object.entries(org)) {
      if (code === '$meta') continue;
      const d = dept as Record<string, any>;
      summaries.push(`${d.科室名称}(${code}): ${d.科室职责?.substring(0, 20)}...`);
    }

    return summaries.join('\n');
  }
}

// 导出单例实例
export const aiContextFilterService = new AIContextFilterService();

// 导出便捷函数
export function filterForAI(
  data: Record<string, any>,
  preset: FilterPreset = 'standard',
  format: OutputFormat = 'markdown',
): string {
  return aiContextFilterService.quickFilter(data, preset, format);
}

/**
 * 过滤并输出为 JSON 格式
 */
export function filterForAIAsJSON(data: Record<string, any>, preset: FilterPreset = 'standard'): string {
  return aiContextFilterService.quickFilterJSON(data, preset);
}

/**
 * 过滤并输出为 Markdown 格式
 */
export function filterForAIAsMarkdown(data: Record<string, any>, preset: FilterPreset = 'standard'): string {
  return aiContextFilterService.quickFilterMarkdown(data, preset);
}

export function filterWithOptions(data: Record<string, any>, options: AIContextOptions): FilterResult {
  return aiContextFilterService.filter(data, options);
}

/**
 * 过滤新变量结构数据库（便捷函数）
 * @param database 完整数据库对象
 * @param preset 预设模式
 * @param format 输出格式，默认 markdown
 */
export function filterDatabase(
  database: Record<string, any>,
  preset: FilterPreset = 'standard',
  format: OutputFormat = 'markdown',
): FilterResult {
  return aiContextFilterService.filterDatabase(database, preset, format);
}

/**
 * 获取人员简要信息（便捷函数）
 */
export function getStaffBrief(
  personnelSystem: Record<string, any>,
  staffId?: string,
): Record<string, any> | Record<string, any>[] {
  return aiContextFilterService.getStaffBrief(personnelSystem, staffId);
}
