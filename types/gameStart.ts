/**
 * MClite - 自定义开局面板类型定义
 * 定义开局面板表单、预设模板、提示词生成等相关类型
 */

/**
 * 场景类型枚举
 */
export type SceneType = 'office' | 'school' | 'hospital' | 'military' | 'custom';

/**
 * 场景类型配置
 */
export interface SceneTypeConfig {
  /** 场景类型标识 */
  type: SceneType;
  /** 显示名称 */
  label: string;
  /** 图标 */
  icon: string;
  /** 默认场景名称 */
  defaultName: string;
  /** 默认场景描述 */
  defaultDescription: string;
  /** 默认花名册字段 */
  defaultRosterFields: string;
  /** 默认服装规定 */
  defaultDressCode: string;
  /** 默认其他规章 */
  defaultOtherRules: string;
}

/**
 * 开局表单数据
 */
export interface GameStartFormData {
  // === 场景设定 ===
  /** 场景类型 */
  sceneType: SceneType;
  /** 场景名称 */
  sceneName: string;
  /** 场景描述 */
  sceneDescription: string;

  // === 世界观设定 ===
  /** 世界观描述 */
  worldView: string;

  // === 玩家设定 ===
  /** 玩家姓名 */
  playerName: string;
  /** 玩家年龄 */
  playerAge: number | null;
  /** 玩家身份/职位 */
  playerPosition: string;
  /** 玩家所属部门 */
  playerDepartment: string;

  // === 规章制度定义（三份必要文档） ===
  /** 花名册字段定义（必填） */
  rosterFields: string;
  /** 文档一：主规章制度（员工守则/校规等总览性文档） */
  mainDocument: string;
  /** 文档二：着装及人员信息登记规定 */
  dressCode: string;
  /** 文档三：申请表模板 */
  applicationForms: string;
  /** 其他自定义规则（可选扩展） */
  otherRules: string;

  // === 补充说明 ===
  /** 补充说明 */
  additionalNotes: string;
}

/**
 * 表单验证结果
 */
export interface FormValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误列表 */
  errors: FormValidationError[];
}

/**
 * 表单验证错误
 */
export interface FormValidationError {
  /** 字段名 */
  field: keyof GameStartFormData;
  /** 错误消息 */
  message: string;
}

/**
 * 开局配置
 */
export interface GameStartConfig {
  /** 是否使用快速开始 */
  useQuickStart: boolean;
  /** 是否随机填充 */
  useRandomFill: boolean;
  /** 选中的预设模板 */
  selectedPreset?: SceneType;
}

/**
 * 生成的提示词数据
 */
export interface GeneratedPrompt {
  /** 完整提示词文本 */
  text: string;
  /** 表单数据快照 */
  formData: GameStartFormData;
  /** 生成时间 */
  generatedAt: Date;
}

/**
 * 世界设定变量结构（存储在 MC.世界设定 中）
 */
export interface WorldSettingsVariable {
  /** 场景类型 */
  场景类型: string;
  /** 场景名称 */
  场景名称: string;
  /** 场景描述 */
  场景描述: string;
  /** 世界观 */
  世界观: string;
  /** 元数据 */
  $meta?: {
    extensible: boolean;
  };
}

/**
 * 场景类型预设配置表
 */
export const SCENE_TYPE_PRESETS: Record<SceneType, SceneTypeConfig> = {
  office: {
    type: 'office',
    label: '办公室',
    icon: '🏢',
    defaultName: '第七处',
    defaultDescription: '国家特别事务管理局第七执行处，负责处理各类特殊事务。',
    defaultRosterFields:
      '员工编号、姓名、性别、年龄、部门、职位、职级、入职年限、身高、体重、三围、面容评分、性格特征、综合评级、备注',
    defaultDressCode: '工作日着正装，女性员工需穿高跟鞋，裙装长度不得超过膝上10cm',
    defaultOtherRules: '每日9:00打卡上班，18:00下班。迟到早退按规定处理。',
  },
  school: {
    type: 'school',
    label: '学校',
    icon: '🏫',
    defaultName: '市立第一高中',
    defaultDescription: '一所普通的市立高中，学风优良，环境优美。',
    defaultRosterFields: '学号、姓名、性别、年龄、班级、职务、身高、体重、三围、成绩排名、性格特征、特长、备注',
    defaultDressCode: '在校期间须穿着校服，体育课穿运动服',
    defaultOtherRules: '每日7:30早自习，17:00放学。禁止携带手机进入教室。',
  },
  hospital: {
    type: 'hospital',
    label: '医院',
    icon: '🏥',
    defaultName: '市中心医院',
    defaultDescription: '一所三级甲等综合医院，拥有先进的医疗设备和优秀的医护团队。',
    defaultRosterFields: '工号、姓名、性别、年龄、科室、职称、身高、体重、三围、专业技能、性格特征、备注',
    defaultDressCode: '工作时间穿着白大褂或护士服',
    defaultOtherRules: '实行三班倒制度，严格遵守医疗规范和职业道德。',
  },
  military: {
    type: 'military',
    label: '军队',
    icon: '🎖️',
    defaultName: '某部队驻地',
    defaultDescription: '一处军事驻地，纪律严明，战斗力强。',
    defaultRosterFields: '军号、姓名、性别、年龄、部队、军衔、身高、体重、三围、体能评级、专业技能、性格特征、备注',
    defaultDressCode: '在营区内穿着军装，训练时穿作训服',
    defaultOtherRules: '每日6:00起床，22:00熄灯。严格遵守军规军纪。',
  },
  custom: {
    type: 'custom',
    label: '自定义',
    icon: '✨',
    defaultName: '',
    defaultDescription: '',
    defaultRosterFields: '',
    defaultDressCode: '',
    defaultOtherRules: '',
  },
};

/**
 * 默认表单数据
 */
export const DEFAULT_FORM_DATA: GameStartFormData = {
  sceneType: 'office',
  sceneName: SCENE_TYPE_PRESETS.office.defaultName,
  sceneDescription: SCENE_TYPE_PRESETS.office.defaultDescription,
  worldView: '',
  playerName: '',
  playerAge: null,
  playerPosition: '',
  playerDepartment: '',
  rosterFields: SCENE_TYPE_PRESETS.office.defaultRosterFields,
  mainDocument: '',
  dressCode: SCENE_TYPE_PRESETS.office.defaultDressCode,
  applicationForms: '',
  otherRules: SCENE_TYPE_PRESETS.office.defaultOtherRules,
  additionalNotes: '',
};

/**
 * 快速开始预设（办公室场景）
 */
export const QUICK_START_PRESET: GameStartFormData = {
  sceneType: 'office',
  sceneName: '第七处',
  sceneDescription: '国家特别事务管理局第七执行处，是一个神秘的政府部门，负责处理各类特殊事务。',
  worldView: '现代都市背景，存在一些不为人知的特殊事务需要专门机构处理。',
  playerName: '',
  playerAge: 25,
  playerPosition: '科员',
  playerDepartment: '行动一科',
  rosterFields: SCENE_TYPE_PRESETS.office.defaultRosterFields,
  mainDocument: '',
  dressCode: SCENE_TYPE_PRESETS.office.defaultDressCode,
  applicationForms: '',
  otherRules: SCENE_TYPE_PRESETS.office.defaultOtherRules,
  additionalNotes: '',
};

/**
 * 必填字段列表
 */
export const REQUIRED_FIELDS: (keyof GameStartFormData)[] = [
  'sceneType',
  'sceneName',
  'playerPosition',
  'rosterFields',
];

/**
 * 验证表单数据
 * @param formData 表单数据
 * @returns 验证结果
 */
export function validateFormData(formData: GameStartFormData): FormValidationResult {
  const errors: FormValidationError[] = [];

  // 场景类型验证
  if (!formData.sceneType) {
    errors.push({ field: 'sceneType', message: '请选择场景类型' });
  }

  // 场景名称验证
  if (!formData.sceneName?.trim()) {
    errors.push({ field: 'sceneName', message: '请输入场景名称' });
  }

  // 玩家职位验证
  if (!formData.playerPosition?.trim()) {
    errors.push({ field: 'playerPosition', message: '请输入玩家身份/职位' });
  }

  // 花名册字段验证（最重要的必填项）
  if (!formData.rosterFields?.trim()) {
    errors.push({ field: 'rosterFields', message: '请定义花名册字段（这是人事系统的核心）' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 生成开局提示词
 * @param formData 表单数据
 * @returns 生成的提示词
 */
export function generateStartPrompt(formData: GameStartFormData): GeneratedPrompt {
  // 获取玩家姓名，如果为空则使用 <user> 宏
  const playerName = formData.playerName?.trim() || '<user>';

  // 构建提示词文本
  const promptParts: string[] = [];

  promptParts.push('请根据以下设定开始游戏，初始化所有变量：');
  promptParts.push('');

  // 场景设定
  promptParts.push('## 场景设定');
  promptParts.push(`- 场景类型：${SCENE_TYPE_PRESETS[formData.sceneType]?.label || formData.sceneType}`);
  promptParts.push(`- 场景名称：${formData.sceneName}`);
  if (formData.sceneDescription?.trim()) {
    promptParts.push(`- 场景描述：${formData.sceneDescription}`);
  }
  if (formData.worldView?.trim()) {
    promptParts.push(`- 世界观：${formData.worldView}`);
  }
  promptParts.push('');

  // 玩家信息
  promptParts.push('## 玩家信息');
  promptParts.push(`- 姓名：${playerName}`);
  if (formData.playerAge) {
    promptParts.push(`- 年龄：${formData.playerAge}`);
  }
  promptParts.push(`- 职位：${formData.playerPosition}`);
  if (formData.playerDepartment?.trim()) {
    promptParts.push(`- 部门：${formData.playerDepartment}`);
  }
  promptParts.push('');

  // 规章制度要求
  promptParts.push('## 规章制度要求');
  promptParts.push('');
  promptParts.push('开局需生成以下规章制度文档（存储在`MC.文档`中），采用递归自相似节点结构撰写：');
  promptParts.push('');

  // 文档一：主规章制度
  promptParts.push('### 1. 主规章制度（员工守则/校规等）');
  promptParts.push('');
  if (formData.mainDocument?.trim()) {
    promptParts.push('**要点**：' + formData.mainDocument);
    promptParts.push('');
  }
  promptParts.push('纯文本规章制度，采用递归自相似节点结构（`_t`正文 + `_s`子节点），包含总则、工作规范、行为准则等。');
  promptParts.push('');
  if (formData.dressCode?.trim()) {
    promptParts.push('**着装相关规定要点**：');
    promptParts.push(formData.dressCode);
    promptParts.push('');
  }

  // 文档二：申请表管理办法
  promptParts.push('### 2. 申请表管理办法');
  promptParts.push('');
  promptParts.push('**必须包含`$formMeta`元数据**（位于文档根级别）：');
  promptParts.push('```json');
  promptParts.push('"$formMeta": {');
  promptParts.push('  "formName": "表单名称",');
  promptParts.push('  "description": "表单描述",');
  promptParts.push('  "targetPath": "MC.申请记录.类别名",');
  promptParts.push('  "workflow": [{ "step": 1, "name": "步骤名", "handler": "处理人", "canReject": true }]');
  promptParts.push('}');
  promptParts.push('```');
  promptParts.push('');
  promptParts.push('**各条款使用`$fieldDef`定义表单字段**（与`_t`、`_s`并列放在分支节点中）：');
  promptParts.push('- 支持的inputType：text、textarea、number、date、datetime、select、radio、checkbox、readonly、table');
  promptParts.push('- 花名册选择器：`sourceType: "roster"`, `sourcePath: "MC.花名册"`, `displayField: "name"`');
  promptParts.push('- 条件显示：`showWhen: { field: "fieldId", equals: "value" }`');
  promptParts.push('- 条件必填：`conditionalRequired: { when: { field: "fieldId", equals: "value" }, required: true }`');
  promptParts.push('');
  if (formData.applicationForms?.trim()) {
    promptParts.push('**需要的申请表类型**：' + formData.applicationForms);
  } else {
    promptParts.push('至少包含：物资申请表、个人需求申请表');
  }
  promptParts.push('');

  // 其他规则
  if (formData.otherRules?.trim()) {
    promptParts.push('### 3. 其他规则');
    promptParts.push(formData.otherRules);
    promptParts.push('');
  }

  // 补充说明
  if (formData.additionalNotes?.trim()) {
    promptParts.push('## 补充说明');
    promptParts.push(formData.additionalNotes);
    promptParts.push('');
  }

  // 变量结构要求
  promptParts.push('---');
  promptParts.push('');
  promptParts.push('## 变量初始化要求');
  promptParts.push('');
  promptParts.push('使用`<UpdateVariable>`标签输出，遵循以下结构：');
  promptParts.push('');
  promptParts.push('**1. MC.系统**：`{ "当前地点": "xxx", "当前时间": { "日期": "YYYY年M月D日", "时间": "HH:MM" } }`');
  promptParts.push('');
  promptParts.push('**2. MC.玩家**：`{ "姓名": "<user>", "年龄": 数字, "职位": "xxx", "部门": "xxx" }`');
  promptParts.push('');
  promptParts.push('**3. MC.世界设定**：保存场景类型、名称、描述、世界观');
  promptParts.push('');
  promptParts.push('**4. MC.文档**：规章制度文档，采用递归自相似节点结构');
  promptParts.push('  - 层级按key直接嵌套：`第一章 总则` → `第一节 机构概述` → `第一条`');
  promptParts.push('  - 叶子节点为字符串，分支节点为 `{ _t: "正文", _s: { 编号key: 子节点 } }` 对象');
  promptParts.push('  - `_s` 始终为对象（不是数组），key为编号');
  promptParts.push('  - 层级编号体系：章>节>条>款(一二三…)>项(123…)>目(abc…)');
  promptParts.push('  - 表单文档需包含`$formMeta`和`$fieldDef`');
  promptParts.push('  - 每个文档根需包含`"$meta": { "extensible": true }`');
  promptParts.push('');
  promptParts.push('**5. MC.花名册**（内联Schema + entries结构）：');
  promptParts.push('  - 内联`$schema`定义字段结构：');
  promptParts.push('    ```json');
  promptParts.push('    "$schema": {');
  promptParts.push('      "primaryKey": "id",');
  promptParts.push('      "displayField": "name",');
  promptParts.push('      "groupByField": "department",');
  promptParts.push('      "fields": { "id": "员工编号", "name": "姓名", ... }');
  promptParts.push('    }');
  promptParts.push('    ```');
  promptParts.push('  - 花名册字段定义：' + formData.rosterFields);
  promptParts.push('  - 条目在`entries`子对象下，键名格式`NoXXX`（禁止包含点号）');
  promptParts.push('  - 每个条目需包含`"$meta": { "extensible": true }`');
  promptParts.push('  - 创建2-3个初始NPC');
  promptParts.push('');
  promptParts.push('**6. MC.申请记录**：');
  promptParts.push('  - 按表单类型分类：`MC.申请记录.物资申请`、`MC.申请记录.个人需求`等');
  promptParts.push('  - 记录以摘要文本存储：`【表单名】申请人：xxx（部门）| 字段：值 | 状态：xxx`');
  promptParts.push('');
  promptParts.push('---');
  promptParts.push('');
  promptParts.push('请生成开局场景描述，并输出完整的变量初始化命令。');

  return {
    text: promptParts.join('\n'),
    formData: { ...formData },
    generatedAt: new Date(),
  };
}

/**
 * 随机填充表单数据
 * @param currentData 当前表单数据（可选，用于保留部分用户输入）
 * @returns 随机填充后的表单数据
 */
export function randomFillFormData(currentData?: Partial<GameStartFormData>): GameStartFormData {
  // 随机选择场景类型（排除 custom）
  const sceneTypes: SceneType[] = ['office', 'school', 'hospital', 'military'];
  const randomSceneType = sceneTypes[Math.floor(Math.random() * sceneTypes.length)];
  const preset = SCENE_TYPE_PRESETS[randomSceneType];

  // 随机年龄
  const randomAge = 18 + Math.floor(Math.random() * 30);

  // 根据场景类型生成默认职位
  const positionsByScene: Record<SceneType, string[]> = {
    office: ['科员', '主任科员', '副科长', '科长', '处长助理'],
    school: ['学生', '班长', '学习委员', '体育委员', '文艺委员'],
    hospital: ['实习医生', '住院医师', '主治医师', '护士', '护士长'],
    military: ['列兵', '下士', '中士', '上士', '少尉'],
    custom: ['成员'],
  };

  const positions = positionsByScene[randomSceneType];
  const randomPosition = positions[Math.floor(Math.random() * positions.length)];

  // 根据场景类型生成默认部门
  const departmentsByScene: Record<SceneType, string[]> = {
    office: ['行动一科', '行动二科', '后勤部', '人事部', '财务部'],
    school: ['高一(1)班', '高二(2)班', '高三(3)班', '学生会'],
    hospital: ['内科', '外科', '妇产科', '儿科', '急诊科'],
    military: ['一连', '二连', '三连', '通信连', '侦察连'],
    custom: ['默认部门'],
  };

  const departments = departmentsByScene[randomSceneType];
  const randomDepartment = departments[Math.floor(Math.random() * departments.length)];

  return {
    sceneType: randomSceneType,
    sceneName: preset.defaultName,
    sceneDescription: preset.defaultDescription,
    worldView: currentData?.worldView || '',
    playerName: currentData?.playerName || '',
    playerAge: randomAge,
    playerPosition: randomPosition,
    playerDepartment: randomDepartment,
    rosterFields: preset.defaultRosterFields,
    mainDocument: '',
    dressCode: preset.defaultDressCode,
    applicationForms: '',
    otherRules: preset.defaultOtherRules,
    additionalNotes: currentData?.additionalNotes || '',
  };
}

// ============ 预设相关类型定义 ============

/**
 * 开局预设数据
 * 保存玩家在开局面板输入的内容，可以重复使用
 */
export interface GameStartPreset {
  /** 预设唯一ID */
  id: string;
  /** 预设名称（用户自定义） */
  name: string;
  /** 预设描述（可选） */
  description?: string;
  /** 表单数据 */
  formData: GameStartFormData;
  /** 创建时间 */
  createdAt: string;
  /** 最后修改时间 */
  updatedAt: string;
  /** 是否为内置预设（内置预设不可删除） */
  isBuiltin?: boolean;
}

/**
 * 预设存储数据结构
 * 用于 localStorage 持久化
 */
export interface PresetStorageData {
  /** 版本号，用于数据迁移 */
  version: number;
  /** 预设列表 */
  presets: GameStartPreset[];
  /** 最后使用的预设ID */
  lastUsedPresetId?: string;
}

/**
 * 预设存储的 localStorage key
 */
export const PRESET_STORAGE_KEY = 'mclite_game_start_presets';

/**
 * 预设存储版本号
 */
export const PRESET_STORAGE_VERSION = 1;

/**
 * 生成预设ID
 */
export function generatePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 创建新预设
 * @param name 预设名称
 * @param formData 表单数据
 * @param description 预设描述（可选）
 */
export function createPreset(name: string, formData: GameStartFormData, description?: string): GameStartPreset {
  const now = new Date().toISOString();
  return {
    id: generatePresetId(),
    name,
    description,
    formData: { ...formData },
    createdAt: now,
    updatedAt: now,
    isBuiltin: false,
  };
}

/**
 * 内置预设列表
 * 提供一些常用的开局配置供用户快速选择
 */
export const BUILTIN_PRESETS: GameStartPreset[] = [
  {
    id: 'builtin_office_default',
    name: '办公室 - 标准配置',
    description: '第七处标准开局配置，适合办公室场景',
    formData: QUICK_START_PRESET,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isBuiltin: true,
  },
  {
    id: 'builtin_school_default',
    name: '学校 - 标准配置',
    description: '高中校园标准开局配置',
    formData: {
      ...DEFAULT_FORM_DATA,
      sceneType: 'school',
      sceneName: SCENE_TYPE_PRESETS.school.defaultName,
      sceneDescription: SCENE_TYPE_PRESETS.school.defaultDescription,
      playerPosition: '学生',
      playerDepartment: '高二(1)班',
      playerAge: 17,
      rosterFields: SCENE_TYPE_PRESETS.school.defaultRosterFields,
      dressCode: SCENE_TYPE_PRESETS.school.defaultDressCode,
      otherRules: SCENE_TYPE_PRESETS.school.defaultOtherRules,
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isBuiltin: true,
  },
  {
    id: 'builtin_hospital_default',
    name: '医院 - 标准配置',
    description: '医院场景标准开局配置',
    formData: {
      ...DEFAULT_FORM_DATA,
      sceneType: 'hospital',
      sceneName: SCENE_TYPE_PRESETS.hospital.defaultName,
      sceneDescription: SCENE_TYPE_PRESETS.hospital.defaultDescription,
      playerPosition: '实习医生',
      playerDepartment: '内科',
      playerAge: 24,
      rosterFields: SCENE_TYPE_PRESETS.hospital.defaultRosterFields,
      dressCode: SCENE_TYPE_PRESETS.hospital.defaultDressCode,
      otherRules: SCENE_TYPE_PRESETS.hospital.defaultOtherRules,
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isBuiltin: true,
  },
];
