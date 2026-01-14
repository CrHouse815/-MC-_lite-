# MClite 更新日志

本文件记录 MClite 项目的所有重要更新。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本控制](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

<!-- 开发中的新功能将记录在此 -->

---

## [0.7.4] - 2026-01-15-00:47

> 🔧 **Bug修复**：文档存储字符串化问题修复

### Fixed

- **修复文档被存储为JSON字符串而非对象的问题** ([`documentStore.ts`](src/MClite/stores/documentStore.ts))
  - 问题：当文档内容包含嵌套转义引号（如 `placeholder: "填写涉及人员姓名，如无则填\"无\""`）时，MVU框架可能将整个文档对象序列化为JSON字符串存储
  - 症状：文档在列表中可见，但点击时报错 `尝试选择不存在的文档`，控制台显示 `doc 内容: "{ \"title\": ...}"`（注意外层引号）
  - 修复：
    - 新增 `tryParseStringifiedValue()` 函数，自动检测并解析被字符串化的JSON数据
    - 新增 `fixStringifiedDocuments()` 函数，遍历文档容器修复所有字符串化的文档条目
    - 在 `documentsContainer` 计算属性中集成自动修复逻辑
    - 在 `selectDocument()` 方法中添加字符串类型检测和即时解析

### 技术细节

```typescript
// 问题：文档被存储为字符串
{
  "MC.文档": {
    "人事档案管理规定": { ... },  // 正常对象
    "个人需求申请管理办法": "{ \"title\": \"个人需求申请管理办法\", ... }"  // 错误：字符串
  }
}

// 修复后：自动解析字符串化的文档
fixStringifiedDocuments(container) → 所有文档都是对象
```

---

## [0.7.3] - 2026-01-14-23:45

> 🔧 **Bug修复 & 功能优化**：开局面板规章制度定义重构

### Fixed

- **修复规章制度输入框输入时失焦的bug** ([`GameStartPanel.vue`](src/MClite/components/game/GameStartPanel.vue))
  - 问题：在规章制度区块的输入框中输入一个字符后，输入框会刷新导致失去焦点，无法正常输入
  - 原因：使用 `:key="item + index"` 作为列表项的key，当item内容改变时key随之改变，Vue认为是新元素从而重新渲染DOM
  - 修复：引入 `RuleItem` 接口（包含稳定的 `id` 和 `content` 字段），使用 `generateId()` 生成唯一稳定ID，`:key="item.id"` 确保编辑时不触发重新渲染

### Changed

- **规章制度区块重构为三份必要文档**
  - 参考示例变量中的员工守则结构，将开局时的规章制度拆分为三份必要文档
  - **文档一：主规章制度** - 总览性规章（员工守则、校规等），包含组织架构、工作规范、申请流程等核心内容
  - **文档二：着装及人员信息规定** - 着装要求和人员档案登记规范
  - **文档三：申请表模板** - 各类申请表（请假、物资、特殊事项等）
  - **其他自定义规则** - 可选扩展，玩家可自由添加
  - 每个文档区块添加"玩家可留空"提示，AI会根据场景类型自动生成

- **表单数据结构扩展** ([`gameStart.ts`](src/MClite/types/gameStart.ts))
  - 新增 `mainDocument` 字段：主规章制度内容
  - 新增 `applicationForms` 字段：申请表模板内容
  - 更新 `DEFAULT_FORM_DATA` 和 `QUICK_START_PRESET` 包含新字段

- **提示词生成逻辑优化** ([`generateStartPrompt()`](src/MClite/types/gameStart.ts:275))
  - 明确要求AI必须生成三份基本规章制度文档
  - 玩家填写的内容作为"参考要点"，留空时由AI自动生成完整文档
  - 为每份文档提供详细的结构说明和必填项目列表
  - 任务要求更新：创建三份基本规章制度文档（主规章、着装及人员信息规定、申请表模板集）

- **表单进度计算调整**
  - 调整各字段权重分配，新增三份文档的进度权重
  - 花名册字段、主规章制度、着装规定、申请表各占10%权重

### UI 交互说明

```
┌─────────────────────────────────────────────┐
│ 📋 规章制度定义                     [关键]   │
├─────────────────────────────────────────────┤
│ 📊 花名册字段定义                 *必填      │
│    定义人员档案需要记录哪些信息              │
├─────────────────────────────────────────────┤
│ 📜 主规章制度                     *必填      │
│    💡 玩家可留空，AI自动生成完整文档        │
│    定义总览性规章（员工守则、校规等）        │
├─────────────────────────────────────────────┤
│ 👔 着装及人员信息规定             *必填      │
│    💡 玩家可留空，AI自动生成完整文档        │
│    定义着装要求和人员档案登记规范            │
├─────────────────────────────────────────────┤
│ 📝 申请表模板                     *必填      │
│    💡 玩家可留空，AI自动生成完整文档        │
│    定义各类申请表模板                        │
├─────────────────────────────────────────────┤
│ 📖 其他自定义规则                 [可选]     │
│    可自由添加其他规则或扩展设定              │
└─────────────────────────────────────────────┘
```

---

## [0.7.2] - 2026-01-14-22:48

> 🎨 **UI优化**：开局面板功能优化与确认提示词功能

### Added

- **确认提示词功能** ([`GameStartPanel.vue`](src/MClite/components/game/GameStartPanel.vue))
  - 新增"预览提示词"按钮，发送前可查看和编辑生成的提示词
  - 提示词预览模态框，使用 Teleport 渲染到 body 层级
  - 支持在模态框内直接编辑提示词内容
  - 确认后发送编辑后的提示词，取消则返回表单继续修改

- **表单填写进度指示器**
  - 头部显示填写进度条和百分比
  - 统计已填写字段数/总字段数
  - 视觉反馈帮助用户了解表单完成度

### Changed

- **规章制度区块 UI 重构**
  - 将原有的 textarea 文本域改为条目式交互 UI
  - **档案信息字段**：预设标签点击添加，已选字段以可删除标签展示
  - **着装规范**：输入框 + 添加按钮，条目以列表形式展示，支持删除
  - **其他规定**：同上，输入框 + 列表条目管理
  - 使用 `transition-group` 实现列表动画效果

- **面板头部简化**
  - 移除"快速开始"按钮，简化顶部布局
  - 缩短副标题文字："自定义开始设置"
  - 保持简洁的单行标题+描述设计

- **预设字段交互优化**
  - 档案字段预设：姓名、年龄、性别、身高、体重、发色、瞳色等
  - 点击预设标签直接添加到已选列表
  - 已选字段显示为带删除按钮的标签

### UI 交互说明

```
┌─────────────────────────────────────────┐
│ 🎮 开局设定            填写进度 [████░░] 67% │
│ 自定义开始设置                              │
├─────────────────────────────────────────┤
│ 📋 档案信息字段                            │
│ ┌──────────────────────────────────────┐│
│ │ 姓名  年龄  性别  身高  ... (预设标签) ││
│ └──────────────────────────────────────┘│
│ 已选字段: [姓名 ×] [年龄 ×] [性别 ×]      │
├─────────────────────────────────────────┤
│ 👗 着装规范                               │
│ [输入框________________] [添加]          │
│ • 商务正装                    [删除]     │
│ • 职业套装                    [删除]     │
├─────────────────────────────────────────┤
│        [预览提示词]  [开始游戏]          │
└─────────────────────────────────────────┘
```

---

## [0.7.1] - 2026-01-14-17:48

> 📝 **文档更新**：AI变量提示词重写适配v3结构

### Changed

- **AI变量提示词重写** ([`MClite变量描述与规则v3`](src/MClite/想法集/AI提示词/MClite变量描述与规则v3))
  - 按照归墟变量参考的简洁风格重写，去除冗余内容
  - 适配v3版本扁平结构：花名册条目直接在花名册下，无entries层
  - 更新路径规则：`MC.花名册.No001` 替代旧版 `MC.花名册.entries.No001`
  - 新增花名册修改准则：分步添加新角色的流程说明
  - 完善字段类型说明：
    - 花名册字段类型（type）：string/number/text/enum/tags/boolean
    - 表单字段类型（inputType）：text/textarea/number/date/datetime/select/radio/checkbox/readonly/table
  - 新增分布式定义说明：$rosterMeta、$formMeta、$groupDef、$fieldDef 的格式和用法
  - 新增可扩展性机制说明：$meta.extensible、$schemaRef、$formRef

---

## [0.7.0] - 2026-01-14-17:24

> 🎉 **重大更新**：人事系统面板适配新版重构变量结构

### Added

- **新版变量结构支持** ([`roster.ts`](src/MClite/types/roster.ts))
  - 新增 `RosterV3` 类型定义，支持条目直接在花名册下的扁平结构
  - 新增 `$schemaRef` 支持，允许花名册引用规章制度中的 Schema 定义
  - 新增 `FieldDefInDoc`、`GroupDefInDoc`、`RosterMetaInDoc` 类型，用于规章制度中的分布式定义
  - 新增 `ParsedRosterSchema` 类型，表示从规章制度解析出的完整 Schema
  - 新增辅助函数：`extractEntriesFromV3()`、`isRosterV3()`、`isRosterV2()`、`buildFieldsContainer()`

- **花名册 Schema 解析服务** ([`RosterSchemaParserService.ts`](src/MClite/services/RosterSchemaParserService.ts))
  - 从规章制度中提取花名册的字段和分组定义
  - 支持 `$rosterMeta`（花名册元数据）、`$groupDef`（分组定义）、`$fieldDef`（字段定义）
  - `parseAllRosterSchemas()` - 解析所有花名册 Schema
  - `getSchemaFromRef()` - 从 `$schemaRef` 路径获取 Schema
  - `toRosterSchema()` - 将解析结果转换为兼容旧版的 `RosterSchema` 格式

### Changed

- **花名册 Store 重构** ([`rosterStore.ts`](src/MClite/stores/rosterStore.ts))
  - 自动检测花名册版本（v2 旧版 / v3 新版）
  - 新版格式：条目直接在 `MC.花名册.No001` 下，无 `entries` 层
  - 新版格式：Schema 通过 `$schemaRef` 引用 `MC.文档.人事档案管理规定`
  - 兼容旧版格式：保持 `MC.花名册.entries.No001` 和内嵌 `$schema` 的支持
  - 条目操作（添加/更新/删除）自动适配新旧版本路径
  - 新增 `isV3Format` 计算属性，暴露当前版本检测结果
  - 新增 `rosterV3` 计算属性，直接访问新版花名册数据

- **花名册面板更新** ([`RosterPanel.vue`](src/MClite/components/roster/RosterPanel.vue))
  - 显示版本标识徽章（v3）
  - 动态面板标题，新版显示"人事档案"
  - 增强调试日志，显示当前格式版本

- **表单解析服务增强** ([`FormParserService.ts`](src/MClite/services/FormParserService.ts))
  - 新增 `getRosterSchemaFromRef()` 方法，支持从 `$schemaRef` 路径获取花名册 Schema
  - 新增 `getAvailableRosters()` 方法，获取所有可用的花名册列表
  - 自动为没有 `$rosterMeta` 的花名册创建默认元数据

### 新版变量结构说明

新版变量结构的主要变化：

1. **花名册条目扁平化**

   ```json
   // 旧版（v2）
   {
     "MC.花名册": {
       "$schema": { ... },
       "entries": {
         "No001": { "name": "沈凌汐", ... }
       }
     }
   }
   
   // 新版（v3）
   {
     "MC.花名册": {
       "$schemaRef": "MC.文档.人事档案管理规定",
       "No001": { "name": "沈凌汐", ... }
     }
   }
   ```

2. **Schema 分布式定义**
   - Schema 不再内嵌在花名册中，而是分布在规章制度的各个章节
   - 每个字段定义（`$fieldDef`）包含 `belongsTo: "花名册"` 标识归属
   - 每个分组定义（`$groupDef`）同样包含 `belongsTo` 标识

3. **向后兼容**
   - 系统自动检测变量结构版本
   - 旧版格式继续正常工作
   - 新版格式自动转换为兼容格式供现有组件使用

---

## [0.6.2] - 2026-01-14-16:46

> 🎉 **新功能版本**：申请记录管理系统

### Added

- **申请记录查看功能** ([`ApplicationRecordsViewer.vue`](src/MClite/components/form/ApplicationRecordsViewer.vue))
  - 在表单面板头部添加"填写申请"/"申请记录"视图切换按钮
  - 申请记录按钮显示当前表单类型的记录数量徽章
  - 卡片式展示申请记录，支持状态筛选（待审批/审批中/已批准/已拒绝）
  - 支持关键词搜索（申请编号、内容、申请人）
  - 点击卡片展开查看详情，包括完整摘要文本
  - 根据状态显示不同颜色标识（待审批黄色、已批准绿色、已拒绝红色）

- **快速通过功能**
  - 单个快速通过：展开记录详情后显示"⚡ 快速通过"按钮
  - 批量快速通过：头部"全部通过"按钮，显示待审批数量徽章
  - 通过后状态变为"已批准（快速通过）"
  - 使用自定义确认对话框（[`ConfirmDialog.vue`](src/MClite/components/common/ConfirmDialog.vue)）替代浏览器原生 confirm()

- **删除记录功能**
  - 单个删除：展开记录详情后显示"🗑️ 删除"按钮
  - 批量删除：头部"清空记录"按钮，删除当前表单类型的所有记录
  - 删除操作使用危险类型确认对话框，防止误操作

- **操作反馈**
  - 操作完成后显示 Toast 提示（成功绿色、失败红色）
  - 3秒后自动消失

- **类型定义** ([`form.ts`](src/MClite/types/form.ts:167))
  - 新增 `ApplicationRecord` 接口，用于表示解析后的申请记录

- **Store 层支持** ([`formStore.ts`](src/MClite/stores/formStore.ts:440))
  - `getCurrentFormApplications` - 获取当前表单类型的申请记录
  - `getAllApplications` - 获取所有申请记录
  - `applicationCount` / `totalApplicationCount` - 统计数量
  - `quickApproveApplication()` - 单个申请快速通过
  - `quickApproveAllPending()` - 批量通过所有待审批申请
  - `deleteApplication()` - 删除单个申请记录
  - `deleteAllApplications()` - 批量删除所有申请记录

### Changed

- **FormPanel.vue 视图切换**
  - 头部添加视图切换按钮组，支持在表单填写和申请记录之间切换
  - 切换视图时保持侧栏表单列表可用

---

## [0.6.1] - 2026-01-14-16:40

> 🔧 **Bug修复**：表单面板切换不生效问题

### Fixed

- **修复表单面板切换表单时显示不更新的问题**
  - 问题：在表单申请面板中点击切换不同表单时，右侧内容区不会更新，必须关闭面板重新打开才能看到新表单
  - 原因：使用 `storeToRefs` 解构 Pinia store 的计算属性（getters）时，Vue 的响应式追踪存在问题
  - 修复：参考 [`DocumentPanel.vue`](src/MClite/components/document/DocumentPanel.vue) 的实现方式，将计算属性改为直接通过 `computed()` 包装访问

### Changed

- **FormPanel.vue 计算属性访问方式重构**

  ```typescript
  // 之前（有问题）
  const { currentForm, currentFields, ... } = storeToRefs(formStore);
  
  // 之后（正确）
  const currentForm = computed(() => formStore.currentForm);
  const currentFields = computed(() => formStore.currentFields);
  ```

- **formStore.ts 优化**
  - `selectForm` 方法添加相同表单检查，避免重复操作
  - 强制递增 `dataVersion` 触发响应式更新
  - `effectiveFormId` 计算属性显式依赖 `dataVersion`

- **添加调试 watch**
  - 监听 `effectiveFormId`、`currentForm`、`currentFields`、`currentFormMeta` 变化
  - 便于追踪响应式更新流程

---

## [0.6.0] - 2026-01-14-16:20

> 🎉 **重大新功能**：分布式表单定义系统 & 变量结构重构

### Added

- **分布式表单定义系统**
  - 新的变量结构设计：将表单/花名册字段定义嵌入规章制度文档
  - 每个字段定义（`$fieldDef`）包含 `belongsTo` 属性，标识所属表单/花名册
  - 支持 `$formMeta` 和 `$rosterMeta` 元数据定义表单/花名册配置
  - 实现了"文档即规则、定义即条款"的设计理念

- **表单解析服务** ([`FormParserService.ts`](src/MClite/services/FormParserService.ts))
  - 递归遍历规章制度文档，提取所有 `$fieldDef` 和 `$groupDef`
  - 按 `belongsTo` 属性自动分组字段定义
  - 提取表单元数据（`$formMeta`）和花名册元数据（`$rosterMeta`）
  - 支持字段组定义（`$groupDef`）用于分组显示

- **表单状态管理** ([`formStore.ts`](src/MClite/stores/formStore.ts))
  - Pinia store 管理表单数据和状态
  - 监听 MVU 更新事件，响应式同步表单数据
  - 支持表单验证（必填、最小值、最大值、正则等规则）
  - 表单提交生成摘要文本并写入 `MC.申请记录`

- **表单面板组件** ([`FormPanel.vue`](src/MClite/components/form/FormPanel.vue))
  - 左侧边栏显示可用表单列表
  - 右侧内容区渲染选中表单的字段
  - 支持按字段组分组显示
  - 表单提交和重置功能

- **表单字段渲染器** ([`FormFieldRenderer.vue`](src/MClite/components/form/FormFieldRenderer.vue))
  - 支持多种输入类型：text、textarea、number、select、date、table
  - 动态渲染字段标签、描述、必填标记
  - 验证错误提示显示

- **类型定义** ([`form.ts`](src/MClite/types/form.ts))
  - `FormFieldDef`：表单字段定义类型
  - `RosterFieldDef`：花名册字段定义类型
  - `FormMeta`/`RosterMeta`：元数据类型
  - `ParsedDefinitions`：解析结果类型

- **设计文档**
  - [`分布式表单系统设计文档.md`](src/MClite/想法集/设计文档/分布式表单系统设计文档.md)：完整的架构设计说明
  - [`分布式表单定义示例.json`](src/MClite/想法集/设计文档/分布式表单定义示例.json)：分布式定义的示例结构
  - [`MClite重构变量结构示例.json`](src/MClite/想法集/设计文档/MClite重构变量结构示例.json)：MClite 项目完整变量结构示例

### Changed

- **变量结构重构**
  - 新增 `MC.文档` 路径存放规章制度文档
  - 调整变量顺序：系统 → 玩家 → 文档 → 花名册 → 申请记录
  - 申请记录按表单类型分类存储（如 `MC.申请记录.物资申请`、`MC.申请记录.个人需求`）

- **侧边栏菜单更新** ([`Sidebar.vue`](src/MClite/components/game/Sidebar.vue))
  - 新增"📝 表单申请"菜单项

- **游戏布局更新** ([`GameLayout.vue`](src/MClite/components/game/GameLayout.vue))
  - 集成表单面板组件
  - 支持表单面板的模态框显示

### 设计亮点

- **字段与规则一一对应**：每个表单字段都对应规章制度中的一个条款
- **AI 可读性**：移除 `$hidden` 标记，让 AI 能够理解技术定义
- **动态扩展**：通过规章制度文档即可扩展表单字段，无需修改前端代码
- **类型安全**：完整的 TypeScript 类型定义确保类型安全

---

## [0.5.7] - 2025-01-14-15:30

> 🔧 **优化更新**：AI响应审查功能优化

### Fixed

- **修复变量更新指令判断逻辑**
  - 问题：所有变量更新指令都被判定为"无法解析"，导致审查总是显示错误
  - 原因：审查服务只支持JSON格式和简单行格式，无法识别MVU的lodash风格命令
  - 修复：新增 `tryParseAsMvuCommands` 方法，支持以下MVU命令格式：
    - `_.set('路径', [旧值], 新值)` - 设置变量
    - `_.assign('父路径', '键名', 值)` - 在父路径下添加新键
    - `_.add('路径', 增量)` - 数值增加
    - `_.remove('路径', [键/索引])` - 移除元素
    - 旧格式命令：`SET()`, `ADD()`, `SUB()` 等

- **修复回退时内容被清空的问题**
  - 问题：玩家选择回退AI回复时，前端显示的内容会被清空
  - 期望：回退后应保留上一次的回复内容，方便玩家重新构思行为
  - 修复：新增 `preReviewContentSnapshot` 状态，在审查开始时保存内容快照，回退时恢复

### Changed

- **审查回退逻辑优化**
  - 回退时恢复审查前的内容快照，而不是清空或从酒馆重新加载
  - 同时恢复 `lastAIResponse`，确保下次发送消息时上下文注入正确

---

## [0.5.6] - 2025-01-14-14:00

> 🎉 **新功能版本**：AI响应审查系统

### Added

- **AI响应审查服务** ([`AIResponseReviewService.ts`](src/MClite/services/AIResponseReviewService.ts))
  - AI输出结束后自动进行格式审查
  - 检查必需标签是否存在且正确闭合（gametxt、UpdateVariable、历史记录、thinking）
  - 解析并验证变量更新指令是否合规
  - 生成详细的审查报告

- **审查对话框** ([`AIResponseReviewDialog.vue`](src/MClite/components/common/AIResponseReviewDialog.vue))
  - 显示审查结果摘要（通过/未通过状态）
  - 标签检查状态一览（存在/缺失/未闭合）
  - 问题列表（错误/警告/信息）
  - 变量更新预览（显示解析出的变量指令）
  - AI回复内容预览（支持原始/解析内容切换）
  - 确认应用/回退取消按钮

- **审查流程集成**
  - 在 `useAIInteraction` 中集成审查流程
  - 审查模式开关（默认启用）
  - 审查通过后才执行变量更新、上下文管理、自动存档等后续操作
  - 审查未通过时可选择强制应用或回退取消

### Changed

- **AI回复处理流程重构**
  - 将原有的直接处理逻辑提取为 `processAIResponseDirectly` 函数
  - 审查模式下先缓存AI回复，等待用户确认后再执行后续操作
  - 非审查模式保持原有行为

---

## [0.5.5] - 2025-12-18-16:08

> ⚠️ **世界书更新**：本版本包含员工守则和花名册变量结构的重要更新，请从原帖获取新版世界书！

### Added

- **完整员工守则内容**
  - 将旧版员工守则全部11章内容迁移至新版文档结构
  - 完整保留第一章（总则）至第十一章（附则）所有条款
  - 附件一：常见申请事项填写示例（4个示例）
  - 附件二：常见问题解答FAQ（9个问答）
  - 结尾说明

- **新开场白**
  - 更新了一段新的开场白内容

### Changed

- **花名册变量结构重构**
  - 将嵌套对象结构改为扁平字段结构，符合 MClite schema 规范
  - 新增体态评估字段：`height`、`weight`、`measurements`、`bustRating`、`waistHipRatio`、`legRating`、`faceScore`、`sensitivityLevel`、`sensitivityType`、`sensitivityDesc`
  - 新增外貌特征字段：`hair`、`eyes`、`face`、`skin`、`aura`
  - 新增身材特征字段：`bust`、`waist`、`hips`、`legs`
  - 新增着装详情字段：`attireTop`、`attireBottom`、`attireAccessories`、`attireUnderwear`
  - 更新 schema groups 配置，按类别分组显示字段
  - 三个示例员工（沈凌汐、苏淼雨、白清妍）数据已按新结构更新

---

## [0.5.4] - 2025-12-18-15:28

### Fixed

- **修复竖屏模式下时间和版本号布局问题**
  - 问题：在 768px 以下屏幕宽度时，时间和版本号挤在一起而不是分居两头
  - 修复：保持 `flex-direction: row` 和 `justify-content: space-between`
  - 适配优化：缩小字体和内边距以适应窄屏显示

---

## [0.5.3] - 2025-12-18-15:20

> ⚠️ **世界书更新**：本版本包含变量结构和 AI 提示词的重要修改，请从原帖获取新版世界书！

### Changed

- **变量结构更新**
  - 优化变量结构设计，添加了玩家相关变量，并且修改了时段变量，现在会显示具体时间了
  - 更新提示词规则，提升 AI 理解和使用效率，改进变量更新指令格式

- **AI 提示词优化**
  - 更新基础设定，防止 AI 将角色机器人化
  - 改进文风指导，避免生硬的平淡叙事
  - 更新 CoT（Chain of Thought）引导，提升 AI 推理质量

- **顶部状态栏 UI 重构**
  - 新增玩家信息卡片显示（姓名、职位、部门）
  - 将版本徽章移至主内容区域 content-header
  - 改用 flexbox 布局，确保时间组件居中稳定
  - 优化横竖屏适配，各组件不再互相挤占覆盖

### Fixed

- 修复时间组件在不同屏幕宽度下无法稳定居中的问题
- 修复横竖屏切换时组件位置错乱的问题

---

## [0.5.2] - 2025-12-18-14:15

> 🎨 **UI 优化**：变量管理器重构为树状结构 & 主题色彩适配

### Changed

- **变量管理器 UI 重构**
  - 改为 IDE 风格的树状结构布局
  - 使用新的 [`TreeItem.vue`](src/MClite/components/variable/TreeItem.vue) 递归组件
  - 完整保留变量层级关系，清晰展示嵌套结构
  - 紧凑的条目式显示，每行一个键值对

- **类型颜色高亮优化**
  - 日间模式使用深色饱和色（高对比度）：
    - 字符串：深橙色 `#b35000`
    - 数字：深绿色 `#2e7d32`
    - 布尔：深蓝色 `#0d47a1`
    - 数组：深青色 `#00695c`
    - 对象：深棕色 `#5d4037`
    - null/undefined：深灰色 `#455a64`
  - 夜间模式使用浅色（舒适护眼）：
    - 字符串：浅橙色 `#e9a178`
    - 数字：浅绿色 `#b8d7a3`
    - 布尔：浅蓝色 `#82b1ff`
    - 数组：浅青色 `#80cbc4`
    - 对象：浅棕色 `#bcaaa4`
    - null/undefined：浅灰色 `#90a4ae`

- **主题切换支持**
  - 使用 CSS 变量实现主题适配
  - 通过 `:root.dark-theme` 选择器自动切换深浅色方案
  - 背景色、边框色、文字色全面适配双主题

### Fixed

- 修复日间模式下类型颜色对比度过低、难以辨认的问题
- 修复变量结构被卡片式布局拆散、无法查看层级关系的问题

---

## [0.5.1] - 2025-12-18-13:35

> 🔧 **重大更新**：变量管理器 v2 - UI 重新设计 & 字段名编辑功能

### Added

- **字段名编辑功能**
  - 双击字段名可直接编辑（数组索引除外）
  - 点击 🏷️ 按钮编辑字段名
  - 支持变量重命名：自动处理新路径创建和旧路径删除

- **添加变量功能**
  - 顶部添加 ➕ 按钮，支持添加新的根级变量
  - 对象/数组节点新增 ➕ 按钮，支持添加子项
  - 添加对话框：选择变量类型（string/number/boolean/object/array/null）并设置初始值

### Changed

- **UI 布局重新设计**
  - 更紧凑的节点显示，减少视觉干扰
  - 优化颜色方案，深色主题更友好
  - 操作按钮悬停时才显示，保持界面整洁
  - 改进类型图标显示

- **编辑器体验优化**
  - 编辑值时自动聚焦并选中文本
  - 布尔值编辑使用按钮切换而非下拉选择
  - JSON 编辑器添加语法错误提示
  - 快捷键提示更清晰

- **树形结构显示优化**
  - 缩进层级更清晰
  - 折叠节点时显示子元素数量
  - 搜索匹配高亮更明显

### Fixed

- 修复深层嵌套对象无法正确显示的问题
- 修复编辑取消时状态未正确重置的问题
- 改进深拷贝逻辑，避免修改原始数据

---

## [0.5.0] - 2025-12-18-13:00

> 🎉 **新功能版本**：内置变量管理器

### Added

- **变量管理器面板** ([`VariableManagerPanel.vue`](src/MClite/components/variable/VariableManagerPanel.vue))
  - 在侧边栏添加"变量管理器"入口按钮（橙色高亮样式）
  - 显示 MVU 连接状态和总变量数统计
  - 支持刷新数据功能
  - 支持全部展开/折叠操作

- **搜索和过滤功能**
  - 支持按路径或值搜索变量，匹配文本自动高亮
  - 可过滤 `$meta` 元数据键
  - 可过滤空值（null、undefined、空字符串、空对象、空数组）
  - 按类型筛选：字符串、数字、布尔、数组、对象

- **树形结构展示** ([`VariableTreeNode.vue`](src/MClite/components/variable/VariableTreeNode.vue))
  - 递归展示嵌套的对象/数组结构
  - 不同类型显示不同的图标和颜色（字符串红色、数字蓝色、布尔紫色、数组青色、对象黄色）
  - 根据嵌套深度自动缩进显示
  - 折叠时显示子元素数量

- **变量编辑器** ([`VariableEditor.vue`](src/MClite/components/variable/VariableEditor.vue))
  - 双击叶子节点的值进入编辑模式
  - 字符串：普通文本输入框
  - 数字：数字输入框
  - 布尔值：true/false 按钮切换
  - 数组/对象：JSON 编辑器，带实时语法验证
  - null/undefined：下拉选择转换为其他类型
  - 快捷键：Enter 保存，Esc 取消，Ctrl+Enter 保存 JSON

- **变量操作功能**
  - 点击复制按钮复制变量完整路径
  - 删除变量（需确认）
  - 编辑变量值

### Changed

- 深色主题适配优化
- 响应式设计改进，移动端可用
- 状态栏显示最后刷新时间

---

## [0.4.0] - 2025-12-18-04:55

> 🎉 **新功能版本**：缓存清理系统

### Added

- **缓存清理系统**
  - 在更新日志面板底部添加"清理缓存"按钮
  - 缓存清理对话框，支持两种操作：
    - 浏览器缓存清理（Cache API、localStorage、sessionStorage）
    - 强制刷新（使用 `cache: 'no-store'` 和 `Cache-Control: no-cache`）
  - 清理状态反馈：动态加载提示、成功提示（3秒后自动消失）

---

## [0.3.1] - 2025-12-18-04:40

### Changed

- **顶部状态栏竖屏模式布局优化**
  - 768px 以下：隐藏地点显示，左侧区域可收缩，右侧按钮区域固定
  - 480px 以下：隐藏版本信息，顶栏高度减至 44px，按钮尺寸 32×32
  - 360px 以下：顶栏高度减至 40px，按钮尺寸 28×28
  - 使用 `flex-shrink: 0` 确保右侧按钮区域不会被压缩
  - 响应式断点：768px → 480px → 360px 三级适配

### Removed

- 移除版本号的点击事件，不再作为按钮使用
- 更新日志功能改为通过侧边栏菜单访问

---

## [0.3.0] - 2025-12-18-02:35

> 🎉 **新功能版本**：更新日志面板 & 版本号显示

### Added

- **更新日志面板** ([`ChangelogPanel.vue`](src/MClite/components/common/ChangelogPanel.vue))
  - 从 GitHub 仓库通过 jsdelivr CDN 远程获取 `CHANGELOG.md`
  - 内置 Markdown 解析器，支持标题、列表、代码块、引用等语法
  - 版本号自动高亮显示
  - 刷新按钮重新获取最新日志
  - 一键跳转到 GitHub 仓库
  - 网络失败时显示本地备用内容

- **顶部栏版本号显示**
  - 在顶部栏中央显示 "MClite vX.X.X" 标识
  - 响应式设计，适配移动端显示

- **侧边栏更新日志入口**
  - 在侧边栏底部菜单添加"📋 更新日志"入口

---

## [0.2.9] - 2025-12-18-02:26

> ⚠️ **世界书更新**：本版本包含 AI 提示词和变量模板的重要修改，请从原帖获取新版世界书！

### Fixed

- **修复 SCHEMA VIOLATION 错误**
  - 问题：向已存在的花名册条目添加新字段时报错 `SCHEMA VIOLATION: Cannot assign new key into non-extensible object`
  - 原因：MVU 框架的 schema 验证机制阻止向不可扩展的对象添加新键

### Changed

- **更新 AI 提示词规则**
  - 在"正确做法总结"中明确标注为条目添加新字段的正确方法
  - 添加详细说明段落，解释 MVU schema 验证机制
  - 更新示例代码，展示正确的新字段添加方式

- **更新变量模板**
  - 为 `entries.$meta` 添加 `template: { "$meta": { "extensible": true } }` 配置
  - 为示例数据中的每个 entry 添加 `$meta: { extensible: true }` 标记

### 正确用法示例

```javascript
// ❌ 错误：直接添加新字段
_.assign('MC.花名册.entries.No001', 'bust', '新字段值');

// ✅ 正确：覆盖整个条目对象
_.assign('MC.花名册.entries', 'No001', {
  "id": "No001",
  "name": "沈凌汐",
  // ... 所有原有字段 ...
  "bust": "新字段值"
});
```

---

## [0.2.8] - 2025-12-18-02:15

> ⚠️ **世界书更新**：本版本包含 AI 提示词和示例变量的重要修改，请从原帖获取新版世界书！

### Fixed

- **修复键名包含点号导致的路径解析错误**
  - 问题：条目 ID 包含点号（如 `No.001`）时变量更新失败
  - 原因：MVU 框架使用点号作为路径分隔符

### Changed

- 更新示例变量：`No.001` → `No001`，`No.002` → `No002`，`No.003` → `No003`
- 更新 AI 提示词规则：
  - 在关键约束部分首位强调"键名不能包含点号"
  - 添加正确/错误键名格式对比表

### 键名格式规范

| 状态 | 格式 | 说明 |
|------|------|------|
| ✅ | `No001`、`员工001`、`entry_001` | 正确格式 |
| ❌ | `No.001` | 点号会被解析为路径分隔符 |

---

## [0.2.7] - 2025-12-18-01:54

### Fixed

- 修复 `_.assign` 命令在父路径不存在时报错的问题，现在会自动预创建缺失的路径结构

---
