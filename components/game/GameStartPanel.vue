<!--
  MClite - 自定义开局面板组件
  允许玩家在游戏开始前自定义世界设定
  生成结构化提示词发送给AI，由AI生成对应的游戏初始内容
  v2: 优化UI设计，添加确认提示词预览功能
-->
<template>
  <div class="game-start-panel">
    <!-- 面板头部 - 优化设计 -->
    <header class="panel-header">
      <div class="header-content">
        <div class="header-icon-wrapper">
          <span class="header-icon">🎮</span>
        </div>
        <div class="header-text">
          <h2 class="header-title">自定义开局</h2>
          <p class="header-subtitle">配置你的游戏世界</p>
        </div>
      </div>
      <!-- 预设快捷操作 -->
      <div class="header-actions">
        <button class="preset-btn" title="管理预设" @click="openPresetPanel">
          <span class="preset-icon">📁</span>
          <span class="preset-text">预设</span>
          <span class="preset-count">{{ allPresets.length }}</span>
        </button>
      </div>
    </header>

    <!-- 面板主体 - 表单区域 -->
    <div class="panel-body">
      <!-- 进度指示器 -->
      <div class="form-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: formProgress + '%' }"></div>
        </div>
        <span class="progress-text">已填写 {{ formProgress }}%</span>
      </div>

      <!-- 场景设定区块 -->
      <section class="setting-section" :class="{ 'has-content': formData.sceneName }">
        <div class="section-header">
          <div class="section-header-left">
            <span class="section-icon">📍</span>
            <h3 class="section-title">场景设定</h3>
          </div>
          <span class="required-badge">必填</span>
        </div>
        <div class="section-content">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">
                场景类型
                <span class="required-mark">*</span>
              </label>
              <div class="scene-type-selector">
                <button
                  v-for="preset in sceneTypeOptions"
                  :key="preset.type"
                  class="scene-type-btn"
                  :class="{ active: formData.sceneType === preset.type }"
                  @click="handleSceneTypeChange(preset.type)"
                >
                  <span class="scene-icon">{{ preset.icon }}</span>
                  <span class="scene-label">{{ preset.label }}</span>
                  <span v-if="formData.sceneType === preset.type" class="check-icon">✓</span>
                </button>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">
                场景名称
                <span class="required-mark">*</span>
              </label>
              <input
                v-model="formData.sceneName"
                type="text"
                class="form-input"
                :class="{ 'has-error': getFieldError('sceneName'), 'has-value': formData.sceneName }"
                placeholder="例如：第七处、XX高中、市中心医院"
              />
              <span v-if="getFieldError('sceneName')" class="error-text">
                {{ getFieldError('sceneName') }}
              </span>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">
                场景描述
                <span class="optional-mark">可选</span>
              </label>
              <textarea
                v-model="formData.sceneDescription"
                class="form-textarea"
                :class="{ 'has-value': formData.sceneDescription }"
                rows="3"
                placeholder="对场景的详细描述（可选）"
              ></textarea>
              <span class="char-count">{{ formData.sceneDescription?.length || 0 }} 字</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 世界观设定区块 -->
      <section class="setting-section" :class="{ 'has-content': formData.worldView }">
        <div class="section-header">
          <div class="section-header-left">
            <span class="section-icon">🌍</span>
            <h3 class="section-title">世界观设定</h3>
          </div>
          <span class="optional-badge">可选</span>
        </div>
        <div class="section-content">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">世界观</label>
              <textarea
                v-model="formData.worldView"
                class="form-textarea"
                :class="{ 'has-value': formData.worldView }"
                rows="3"
                placeholder="描述这个世界的背景、规则、特色..."
              ></textarea>
              <span class="char-count">{{ formData.worldView?.length || 0 }} 字</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 玩家设定区块 -->
      <section class="setting-section" :class="{ 'has-content': formData.playerPosition }">
        <div class="section-header">
          <div class="section-header-left">
            <span class="section-icon">👤</span>
            <h3 class="section-title">玩家设定</h3>
          </div>
          <span class="required-badge">部分必填</span>
        </div>
        <div class="section-content">
          <div class="form-row form-row-2col">
            <div class="form-group">
              <label class="form-label">
                姓名
                <span class="optional-mark">可选</span>
              </label>
              <input
                v-model="formData.playerName"
                type="text"
                class="form-input"
                :class="{ 'has-value': formData.playerName }"
                placeholder="留空则使用 <user>"
              />
              <span class="help-text">💡 留空将使用酒馆用户名</span>
            </div>
            <div class="form-group">
              <label class="form-label">
                年龄
                <span class="optional-mark">可选</span>
              </label>
              <input
                v-model.number="formData.playerAge"
                type="number"
                class="form-input"
                :class="{ 'has-value': formData.playerAge }"
                placeholder="18"
                min="1"
                max="999"
              />
            </div>
          </div>
          <div class="form-row form-row-2col">
            <div class="form-group">
              <label class="form-label">
                身份/职位
                <span class="required-mark">*</span>
              </label>
              <input
                v-model="formData.playerPosition"
                type="text"
                class="form-input"
                :class="{ 'has-error': getFieldError('playerPosition'), 'has-value': formData.playerPosition }"
                placeholder="例如：科员、学生、护士"
              />
              <span v-if="getFieldError('playerPosition')" class="error-text">
                {{ getFieldError('playerPosition') }}
              </span>
            </div>
            <div class="form-group">
              <label class="form-label">
                所属部门
                <span class="optional-mark">可选</span>
              </label>
              <input
                v-model="formData.playerDepartment"
                type="text"
                class="form-input"
                :class="{ 'has-value': formData.playerDepartment }"
                placeholder="例如：行动一科、高二三班"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- 规章制度定义区块 -->
      <section class="setting-section rules-section" :class="{ 'has-content': rosterFieldTags.length > 0 }">
        <div class="section-header">
          <div class="section-header-left">
            <span class="section-icon">📋</span>
            <h3 class="section-title">规章制度定义</h3>
          </div>
          <span class="required-badge">关键</span>
        </div>
        <div class="section-content rules-content">
          <!-- 花名册字段定义 - 条目式UI -->
          <div class="rules-card roster-fields-card">
            <div class="card-header">
              <div class="card-title">
                <span class="card-icon">📊</span>
                <span>花名册字段定义</span>
                <span class="required-mark">*必填</span>
              </div>
              <span class="field-count">{{ rosterFieldTags.length }} 个字段</span>
            </div>
            <div class="card-body">
              <p class="card-desc">
                <span class="desc-icon">💡</span>
                定义人员档案需要记录哪些信息，点击预设字段快速添加，或手动输入
              </p>

              <!-- 预设字段快速添加 -->
              <div class="preset-fields">
                <span class="preset-label">常用字段：</span>
                <div class="preset-tags">
                  <button
                    v-for="field in availablePresetFields"
                    :key="field"
                    class="preset-tag"
                    @click="addRosterField(field)"
                  >
                    <span class="tag-icon">+</span>
                    {{ field }}
                  </button>
                </div>
              </div>

              <!-- 已选字段展示 -->
              <div class="selected-fields" :class="{ 'has-fields': rosterFieldTags.length > 0 }">
                <span v-if="rosterFieldTags.length === 0" class="empty-hint">
                  点击上方字段添加，或在下方输入自定义字段
                </span>
                <transition-group name="tag" tag="div" class="field-tags">
                  <div
                    v-for="(field, index) in rosterFieldTags"
                    :key="field"
                    class="field-tag"
                    :style="{ '--tag-index': index }"
                  >
                    <span class="tag-text">{{ field }}</span>
                    <button class="tag-remove" title="移除" @click="removeRosterField(index)">✕</button>
                  </div>
                </transition-group>
              </div>

              <!-- 手动添加字段 -->
              <div class="add-field-row">
                <input
                  v-model="newRosterField"
                  type="text"
                  class="add-field-input"
                  placeholder="输入自定义字段名称，按回车添加"
                  @keyup.enter="addCustomRosterField"
                />
                <button class="add-field-btn" :disabled="!newRosterField.trim()" @click="addCustomRosterField">
                  <span>添加</span>
                </button>
              </div>

              <span v-if="getFieldError('rosterFields')" class="error-text">
                {{ getFieldError('rosterFields') }}
              </span>
            </div>
          </div>

          <!-- 文档一：主规章制度（员工守则/校规等） -->
          <div class="rules-card main-document-card">
            <div class="card-header">
              <div class="card-title">
                <span class="card-icon">📜</span>
                <span>主规章制度</span>
                <span class="required-mark">*必填</span>
              </div>
              <span class="field-count">{{ mainDocumentItems.length }} 条规定</span>
            </div>
            <div class="card-body">
              <p class="card-desc">
                <span class="desc-icon">📋</span>
                定义场景的总览性规章制度（如员工守则、校规等），包含组织架构、工作规范、申请流程等核心内容
              </p>
              <p class="card-hint">💡 <strong>玩家可留空</strong>，AI会根据场景类型自动生成完整的规章制度文档</p>

              <!-- 已添加的规定 -->
              <div class="rule-items" :class="{ 'has-items': mainDocumentItems.length > 0 }">
                <transition-group name="rule" tag="div" class="rule-list">
                  <div v-for="item in mainDocumentItems" :key="item.id" class="rule-item">
                    <span class="rule-number">{{ mainDocumentItems.indexOf(item) + 1 }}</span>
                    <input
                      :value="item.content"
                      type="text"
                      class="rule-input"
                      placeholder="输入规章制度条目（如：第一章 总则、考勤制度、奖惩规定等）..."
                      @input="updateMainDocumentItem(item.id, ($event.target as HTMLInputElement).value)"
                      @blur="cleanupMainDocument"
                    />
                    <button class="rule-remove" title="删除" @click="removeMainDocumentItem(item.id)">✕</button>
                  </div>
                </transition-group>
              </div>

              <!-- 添加新规定 -->
              <button class="add-rule-btn" @click="addMainDocumentItem">
                <span class="btn-icon">+</span>
                <span>添加规章条目</span>
              </button>
            </div>
          </div>

          <!-- 文档二：人员着装及信息登记规定 -->
          <div class="rules-card dress-code-card">
            <div class="card-header">
              <div class="card-title">
                <span class="card-icon">👔</span>
                <span>着装及人员信息规定</span>
                <span class="required-mark">*必填</span>
              </div>
              <span class="field-count">{{ dressCodeItems.length }} 条规定</span>
            </div>
            <div class="card-body">
              <p class="card-desc">
                <span class="desc-icon">👗</span>
                定义人员着装要求和个人信息登记规范
              </p>
              <p class="card-hint">💡 <strong>玩家可留空</strong>，AI会根据场景生成详细的着装规范和人员档案登记要求</p>

              <!-- 已添加的规定 -->
              <div class="rule-items" :class="{ 'has-items': dressCodeItems.length > 0 }">
                <transition-group name="rule" tag="div" class="rule-list">
                  <div v-for="item in dressCodeItems" :key="item.id" class="rule-item">
                    <span class="rule-number">{{ dressCodeItems.indexOf(item) + 1 }}</span>
                    <input
                      :value="item.content"
                      type="text"
                      class="rule-input"
                      placeholder="输入着装或人员信息规定..."
                      @input="updateDressCodeItem(item.id, ($event.target as HTMLInputElement).value)"
                      @blur="cleanupDressCode"
                    />
                    <button class="rule-remove" title="删除" @click="removeDressCodeItem(item.id)">✕</button>
                  </div>
                </transition-group>
              </div>

              <!-- 添加新规定 -->
              <button class="add-rule-btn" @click="addDressCodeItem">
                <span class="btn-icon">+</span>
                <span>添加着装规定</span>
              </button>
            </div>
          </div>

          <!-- 文档三：申请表模板 -->
          <div class="rules-card application-form-card">
            <div class="card-header">
              <div class="card-title">
                <span class="card-icon">📝</span>
                <span>申请表模板</span>
                <span class="required-mark">*必填</span>
              </div>
              <span class="field-count">{{ applicationFormItems.length }} 个表单</span>
            </div>
            <div class="card-body">
              <p class="card-desc">
                <span class="desc-icon">📄</span>
                定义场景中可使用的各类申请表模板（如请假申请、物资申请、特殊事项申请等）
              </p>
              <p class="card-hint">💡 <strong>玩家可留空</strong>，AI会生成符合场景的基本申请表模板</p>

              <!-- 已添加的表单 -->
              <div class="rule-items" :class="{ 'has-items': applicationFormItems.length > 0 }">
                <transition-group name="rule" tag="div" class="rule-list">
                  <div v-for="item in applicationFormItems" :key="item.id" class="rule-item">
                    <span class="rule-number">{{ applicationFormItems.indexOf(item) + 1 }}</span>
                    <input
                      :value="item.content"
                      type="text"
                      class="rule-input"
                      placeholder="输入申请表名称或说明（如：请假申请表、物资领用申请等）..."
                      @input="updateApplicationFormItem(item.id, ($event.target as HTMLInputElement).value)"
                      @blur="cleanupApplicationForm"
                    />
                    <button class="rule-remove" title="删除" @click="removeApplicationFormItem(item.id)">✕</button>
                  </div>
                </transition-group>
              </div>

              <!-- 添加新表单 -->
              <button class="add-rule-btn" @click="addApplicationFormItem">
                <span class="btn-icon">+</span>
                <span>添加申请表</span>
              </button>
            </div>
          </div>

          <!-- 其他自定义规则（可选扩展） -->
          <div class="rules-card other-rules-card">
            <div class="card-header">
              <div class="card-title">
                <span class="card-icon">📖</span>
                <span>其他自定义规则</span>
                <span class="optional-mark">可选</span>
              </div>
              <span class="field-count">{{ otherRulesItems.length }} 条规则</span>
            </div>
            <div class="card-body">
              <p class="card-desc">
                <span class="desc-icon">✨</span>
                可自由添加其他需要AI遵守的规则或扩展设定
              </p>

              <!-- 已添加的规则 -->
              <div class="rule-items" :class="{ 'has-items': otherRulesItems.length > 0 }">
                <transition-group name="rule" tag="div" class="rule-list">
                  <div v-for="item in otherRulesItems" :key="item.id" class="rule-item">
                    <span class="rule-number">{{ otherRulesItems.indexOf(item) + 1 }}</span>
                    <input
                      :value="item.content"
                      type="text"
                      class="rule-input"
                      placeholder="输入自定义规则..."
                      @input="updateOtherRulesItem(item.id, ($event.target as HTMLInputElement).value)"
                      @blur="cleanupOtherRules"
                    />
                    <button class="rule-remove" title="删除" @click="removeOtherRulesItem(item.id)">✕</button>
                  </div>
                </transition-group>
              </div>

              <!-- 添加新规则 -->
              <button class="add-rule-btn" @click="addOtherRulesItem">
                <span class="btn-icon">+</span>
                <span>添加自定义规则</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 补充说明区块 -->
      <section class="setting-section" :class="{ 'has-content': formData.additionalNotes }">
        <div class="section-header">
          <div class="section-header-left">
            <span class="section-icon">📝</span>
            <h3 class="section-title">补充说明</h3>
          </div>
          <span class="optional-badge">可选</span>
        </div>
        <div class="section-content">
          <div class="form-row">
            <div class="form-group">
              <textarea
                v-model="formData.additionalNotes"
                class="form-textarea"
                :class="{ 'has-value': formData.additionalNotes }"
                rows="2"
                placeholder="其他想要告诉AI的内容..."
              ></textarea>
              <span class="char-count">{{ formData.additionalNotes?.length || 0 }} 字</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 面板底部 - 操作按钮 -->
    <footer class="panel-footer">
      <div class="footer-left">
        <button class="btn btn-secondary" :disabled="isSubmitting" @click="handleRandomFill">
          <span class="btn-icon">🎲</span>
          <span class="btn-text">随机填充</span>
        </button>
        <button class="btn btn-secondary" :disabled="isSubmitting" @click="handleReset">
          <span class="btn-icon">🔄</span>
          <span class="btn-text">重置</span>
        </button>
        <button class="btn btn-success" :disabled="isSubmitting" @click="openSavePresetDialog">
          <span class="btn-icon">💾</span>
          <span class="btn-text">保存预设</span>
        </button>
      </div>
      <div class="footer-right">
        <button class="btn btn-outline-primary" :disabled="isSubmitting || !isFormValid" @click="handlePreviewPrompt">
          <span class="btn-icon">👁️</span>
          <span class="btn-text">预览提示词</span>
        </button>
        <button class="btn btn-primary" :disabled="isSubmitting || !isFormValid" @click="handleStartGame">
          <span v-if="isSubmitting" class="btn-loading">
            <span class="loading-dot"></span>
            <span class="loading-dot"></span>
            <span class="loading-dot"></span>
          </span>
          <template v-else>
            <span class="btn-icon">🚀</span>
            <span class="btn-text">开始游戏</span>
          </template>
        </button>
      </div>
    </footer>

    <!-- 验证错误提示 -->
    <transition name="slide-up">
      <div v-if="validationErrors.length > 0 && showErrors" class="validation-errors">
        <div class="error-header">
          <span class="error-icon">⚠️</span>
          <span>请完善以下必填项：</span>
          <button class="error-close" @click="showErrors = false">✕</button>
        </div>
        <ul class="error-list">
          <li v-for="err in validationErrors" :key="err.field">{{ err.message }}</li>
        </ul>
      </div>
    </transition>

    <!-- 提示词预览模态框 -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="showPromptPreview" class="prompt-preview-overlay" @click.self="closePromptPreview">
          <div class="prompt-preview-modal">
            <div class="modal-header">
              <div class="modal-title">
                <span class="modal-icon">📋</span>
                <h3>提示词预览</h3>
              </div>
              <button class="modal-close" @click="closePromptPreview">✕</button>
            </div>
            <div class="modal-body">
              <div class="prompt-info">
                <span class="info-icon">💡</span>
                <span class="info-text">以下是将发送给AI的开局提示词，您可以在此预览和编辑</span>
              </div>
              <div class="prompt-content-wrapper">
                <textarea v-model="previewPromptText" class="prompt-textarea" rows="20"></textarea>
              </div>
              <div class="prompt-stats">
                <span class="stat-item">
                  <span class="stat-icon">📝</span>
                  字数：{{ previewPromptText?.length || 0 }}
                </span>
                <span class="stat-item">
                  <span class="stat-icon">📄</span>
                  行数：{{ (previewPromptText?.split('\n') || []).length }}
                </span>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" @click="closePromptPreview">
                <span class="btn-icon">✕</span>
                <span class="btn-text">取消</span>
              </button>
              <button class="btn btn-primary" @click="confirmAndStart">
                <span class="btn-icon">🚀</span>
                <span class="btn-text">确认并开始</span>
              </button>
            </div>
          </div>
        </div>
      </transition>

      <!-- 预设管理模态框 -->
      <transition name="modal">
        <div v-if="showPresetPanel" class="preset-panel-overlay" @click.self="closePresetPanel">
          <div class="preset-panel-modal">
            <div class="modal-header">
              <div class="modal-title">
                <span class="modal-icon">📁</span>
                <h3>预设管理</h3>
              </div>
              <button class="modal-close" @click="closePresetPanel">✕</button>
            </div>
            <div class="modal-body">
              <div class="preset-info">
                <span class="info-icon">💡</span>
                <span class="info-text">选择一个预设快速填充表单，或保存当前配置为新预设</span>
              </div>

              <!-- 预设列表 -->
              <div class="preset-list">
                <!-- 内置预设分组 -->
                <div class="preset-group">
                  <div class="group-header">
                    <span class="group-icon">⭐</span>
                    <span class="group-title">内置预设</span>
                    <span class="group-count">{{ allPresets.filter(p => p.isBuiltin).length }}</span>
                  </div>
                  <div class="group-items">
                    <div
                      v-for="preset in allPresets.filter(p => p.isBuiltin)"
                      :key="preset.id"
                      class="preset-item"
                      :class="{ active: selectedPresetId === preset.id }"
                      @click="loadPreset(preset)"
                    >
                      <div class="preset-item-icon">{{ getPresetIcon(preset) }}</div>
                      <div class="preset-item-content">
                        <div class="preset-item-name">{{ preset.name }}</div>
                        <div v-if="preset.description" class="preset-item-desc">{{ preset.description }}</div>
                      </div>
                      <div class="preset-item-badge builtin">内置</div>
                    </div>
                  </div>
                </div>

                <!-- 用户预设分组 -->
                <div class="preset-group">
                  <div class="group-header">
                    <span class="group-icon">👤</span>
                    <span class="group-title">我的预设</span>
                    <span class="group-count">{{ allPresets.filter(p => !p.isBuiltin).length }}</span>
                  </div>
                  <div v-if="allPresets.filter(p => !p.isBuiltin).length === 0" class="group-empty">
                    <span class="empty-icon">📝</span>
                    <span class="empty-text">暂无自定义预设，点击下方按钮保存当前配置</span>
                  </div>
                  <div v-else class="group-items">
                    <div
                      v-for="preset in allPresets.filter(p => !p.isBuiltin)"
                      :key="preset.id"
                      class="preset-item"
                      :class="{ active: selectedPresetId === preset.id }"
                    >
                      <div class="preset-item-icon" @click="loadPreset(preset)">{{ getPresetIcon(preset) }}</div>
                      <div class="preset-item-content" @click="loadPreset(preset)">
                        <div class="preset-item-name">{{ preset.name }}</div>
                        <div v-if="preset.description" class="preset-item-desc">{{ preset.description }}</div>
                        <div class="preset-item-meta">
                          <span class="meta-date">{{ formatDate(preset.updatedAt) }}</span>
                        </div>
                      </div>
                      <div class="preset-item-actions">
                        <button class="action-btn" title="复制" @click.stop="duplicatePreset(preset.id)">📋</button>
                        <button class="action-btn danger" title="删除" @click.stop="confirmDeletePreset(preset.id)">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" @click="closePresetPanel">
                <span class="btn-icon">✕</span>
                <span class="btn-text">关闭</span>
              </button>
              <button
                class="btn btn-success"
                @click="
                  closePresetPanel();
                  openSavePresetDialog();
                "
              >
                <span class="btn-icon">💾</span>
                <span class="btn-text">保存当前为预设</span>
              </button>
            </div>
          </div>
        </div>
      </transition>

      <!-- 保存预设对话框 -->
      <transition name="modal">
        <div v-if="showSavePresetDialog" class="save-preset-overlay" @click.self="closeSavePresetDialog">
          <div class="save-preset-modal">
            <div class="modal-header">
              <div class="modal-title">
                <span class="modal-icon">💾</span>
                <h3>保存预设</h3>
              </div>
              <button class="modal-close" @click="closeSavePresetDialog">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">
                  预设名称
                  <span class="required-mark">*</span>
                </label>
                <input
                  v-model="newPresetName"
                  type="text"
                  class="form-input"
                  :class="{ 'has-error': presetError && !newPresetName.trim() }"
                  placeholder="输入预设名称"
                  @keyup.enter="saveCurrentAsPreset"
                />
              </div>
              <div class="form-group">
                <label class="form-label">
                  预设描述
                  <span class="optional-mark">可选</span>
                </label>
                <textarea
                  v-model="newPresetDescription"
                  class="form-textarea"
                  rows="2"
                  placeholder="简要描述这个预设的用途..."
                ></textarea>
              </div>
              <div v-if="presetError" class="error-message">
                <span class="error-icon">⚠️</span>
                <span>{{ presetError }}</span>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" :disabled="isSavingPreset" @click="closeSavePresetDialog">
                <span class="btn-icon">✕</span>
                <span class="btn-text">取消</span>
              </button>
              <button
                class="btn btn-primary"
                :disabled="isSavingPreset || !newPresetName.trim()"
                @click="saveCurrentAsPreset"
              >
                <span v-if="isSavingPreset" class="btn-loading">
                  <span class="loading-dot"></span>
                  <span class="loading-dot"></span>
                  <span class="loading-dot"></span>
                </span>
                <template v-else>
                  <span class="btn-icon">✓</span>
                  <span class="btn-text">保存</span>
                </template>
              </button>
            </div>
          </div>
        </div>
      </transition>

      <!-- 删除确认对话框 -->
      <transition name="modal">
        <div v-if="showDeleteConfirm" class="delete-confirm-overlay" @click.self="cancelDeletePreset">
          <div class="delete-confirm-modal">
            <div class="modal-header danger">
              <div class="modal-title">
                <span class="modal-icon">⚠️</span>
                <h3>确认删除</h3>
              </div>
            </div>
            <div class="modal-body">
              <p class="confirm-text">确定要删除这个预设吗？此操作无法撤销。</p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" @click="cancelDeletePreset">
                <span class="btn-icon">✕</span>
                <span class="btn-text">取消</span>
              </button>
              <button class="btn btn-danger" @click="executeDeletePreset">
                <span class="btn-icon">🗑️</span>
                <span class="btn-text">删除</span>
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  DEFAULT_FORM_DATA,
  QUICK_START_PRESET,
  SCENE_TYPE_PRESETS,
  generateStartPrompt,
  randomFillFormData,
  validateFormData,
  type FormValidationError,
  type GameStartFormData,
  type GameStartPreset,
  type SceneType,
} from '../../types/gameStart';
import { presetService } from '../../services/PresetService';

// ============ Emits ============
const emit = defineEmits<{
  /** 开始游戏，发送提示词 */
  (e: 'start', prompt: string): void;
  /** 取消/关闭面板 */
  (e: 'cancel'): void;
}>();

// ============ 状态 ============

/** 表单数据 */
const formData = reactive<GameStartFormData>({ ...DEFAULT_FORM_DATA });

/** 是否正在提交 */
const isSubmitting = ref(false);

/** 是否显示错误 */
const showErrors = ref(false);

/** 验证错误列表 */
const validationErrors = ref<FormValidationError[]>([]);

/** 展开的子区块 */
const expandedSubsections = reactive({
  roster: true,
  dress: false,
  other: false,
});

/** 是否显示提示词预览 */
const showPromptPreview = ref(false);

/** 预览的提示词文本（可编辑） */
const previewPromptText = ref('');

// ============ 预设相关状态 ============

/** 是否显示预设管理面板 */
const showPresetPanel = ref(false);

/** 是否显示保存预设对话框 */
const showSavePresetDialog = ref(false);

/** 新预设名称 */
const newPresetName = ref('');

/** 新预设描述 */
const newPresetDescription = ref('');

/** 所有预设列表 */
const allPresets = ref<GameStartPreset[]>([]);

/** 当前选中的预设ID */
const selectedPresetId = ref<string | null>(null);

/** 是否正在保存预设 */
const isSavingPreset = ref(false);

/** 预设操作错误信息 */
const presetError = ref<string | null>(null);

/** 是否显示删除确认 */
const showDeleteConfirm = ref(false);

/** 待删除的预设ID */
const presetToDelete = ref<string | null>(null);

// ============ 条目式输入状态 ============

/** 条目项接口 - 使用稳定ID避免输入时刷新 */
interface RuleItem {
  id: string;
  content: string;
}

/** ID计数器 */
let itemIdCounter = 0;

/** 生成唯一ID */
const generateId = (): string => {
  return `item_${Date.now()}_${++itemIdCounter}`;
};

/** 花名册字段标签列表 */
const rosterFieldTags = ref<string[]>([]);

/** 新字段输入 */
const newRosterField = ref('');

/** 主规章制度条目列表 */
const mainDocumentItems = ref<RuleItem[]>([]);

/** 服装规定条目列表 */
const dressCodeItems = ref<RuleItem[]>([]);

/** 申请表模板条目列表 */
const applicationFormItems = ref<RuleItem[]>([]);

/** 其他规则条目列表 */
const otherRulesItems = ref<RuleItem[]>([]);

/** 预设字段列表 */
const PRESET_ROSTER_FIELDS = [
  '姓名',
  '性别',
  '年龄',
  '部门',
  '职位',
  '职级',
  '身高',
  '体重',
  '三围',
  '面容评分',
  '性格特征',
  '入职年限',
  '学历',
  '特长',
  '综合评级',
  '备注',
];

// ============ 计算属性 ============

/** 场景类型选项 */
const sceneTypeOptions = computed(() => Object.values(SCENE_TYPE_PRESETS));

/** 表单是否有效 */
const isFormValid = computed(() => {
  const result = validateFormData(formData);
  return result.isValid;
});

/** 表单填写进度 */
const formProgress = computed(() => {
  const fields = [
    { value: formData.sceneType, weight: 10 },
    { value: formData.sceneName, weight: 15 },
    { value: formData.sceneDescription, weight: 5 },
    { value: formData.worldView, weight: 5 },
    { value: formData.playerName, weight: 5 },
    { value: formData.playerAge, weight: 5 },
    { value: formData.playerPosition, weight: 10 },
    { value: formData.playerDepartment, weight: 5 },
    { value: rosterFieldTags.value.length > 0, weight: 10 },
    { value: mainDocumentItems.value.filter(i => i.content.trim()).length > 0, weight: 10 },
    { value: dressCodeItems.value.filter(i => i.content.trim()).length > 0, weight: 10 },
    { value: applicationFormItems.value.filter(i => i.content.trim()).length > 0, weight: 10 },
  ];

  let totalWeight = 0;
  let filledWeight = 0;

  fields.forEach(field => {
    totalWeight += field.weight;
    if (field.value) {
      filledWeight += field.weight;
    }
  });

  return Math.round((filledWeight / totalWeight) * 100);
});

/** 可用的预设字段（排除已添加的） */
const availablePresetFields = computed(() => {
  return PRESET_ROSTER_FIELDS.filter(field => !rosterFieldTags.value.includes(field));
});

// ============ 方法 ============

/**
 * 获取字段错误信息
 */
const getFieldError = (field: keyof GameStartFormData): string | null => {
  if (!showErrors.value) return null;
  const error = validationErrors.value.find(e => e.field === field);
  return error?.message || null;
};

/**
 * 切换子区块展开状态
 */
const toggleSubsection = (key: 'roster' | 'dress' | 'other'): void => {
  expandedSubsections[key] = !expandedSubsections[key];
};

/**
 * 处理场景类型变更
 */
const handleSceneTypeChange = (type: SceneType): void => {
  formData.sceneType = type;

  // 自动填充预设内容
  const preset = SCENE_TYPE_PRESETS[type];
  if (preset && type !== 'custom') {
    formData.sceneName = preset.defaultName;
    formData.sceneDescription = preset.defaultDescription;

    // 解析预设字段到标签
    if (preset.defaultRosterFields) {
      rosterFieldTags.value = preset.defaultRosterFields
        .split(/[,，、]/)
        .map(s => s.trim())
        .filter(s => s);
    }

    // 解析主规章制度（从预设中获取，如果没有则使用空数组）
    mainDocumentItems.value = [];

    // 解析服装规定
    if (preset.defaultDressCode) {
      dressCodeItems.value = preset.defaultDressCode
        .split(/[。；;]/)
        .map(s => s.trim())
        .filter(s => s)
        .map(content => ({ id: generateId(), content }));
    } else {
      dressCodeItems.value = [];
    }

    // 解析申请表模板（从预设中获取，如果没有则使用空数组）
    applicationFormItems.value = [];

    // 解析其他规则
    if (preset.defaultOtherRules) {
      otherRulesItems.value = preset.defaultOtherRules
        .split(/[。；;]/)
        .map(s => s.trim())
        .filter(s => s)
        .map(content => ({ id: generateId(), content }));
    } else {
      otherRulesItems.value = [];
    }

    // 同步到formData
    syncTagsToFormData();
  }
};

// ============ 条目式输入方法 ============

/**
 * 添加花名册字段
 */
const addRosterField = (field: string): void => {
  if (!rosterFieldTags.value.includes(field)) {
    rosterFieldTags.value.push(field);
    syncTagsToFormData();
  }
};

/**
 * 添加自定义花名册字段
 */
const addCustomRosterField = (): void => {
  const field = newRosterField.value.trim();
  if (field && !rosterFieldTags.value.includes(field)) {
    rosterFieldTags.value.push(field);
    newRosterField.value = '';
    syncTagsToFormData();
  }
};

/**
 * 移除花名册字段
 */
const removeRosterField = (index: number): void => {
  rosterFieldTags.value.splice(index, 1);
  syncTagsToFormData();
};

// ============ 主规章制度条目方法 ============

/**
 * 添加主规章制度条目
 */
const addMainDocumentItem = (): void => {
  mainDocumentItems.value.push({ id: generateId(), content: '' });
};

/**
 * 更新主规章制度条目
 */
const updateMainDocumentItem = (id: string, content: string): void => {
  const item = mainDocumentItems.value.find(i => i.id === id);
  if (item) {
    item.content = content;
  }
};

/**
 * 移除主规章制度条目
 */
const removeMainDocumentItem = (id: string): void => {
  const index = mainDocumentItems.value.findIndex(i => i.id === id);
  if (index !== -1) {
    mainDocumentItems.value.splice(index, 1);
    syncTagsToFormData();
  }
};

/**
 * 清理主规章制度（同步到formData）
 */
const cleanupMainDocument = (): void => {
  syncTagsToFormData();
};

// ============ 服装规定条目方法 ============

/**
 * 添加服装规定条目
 */
const addDressCodeItem = (): void => {
  dressCodeItems.value.push({ id: generateId(), content: '' });
};

/**
 * 更新服装规定条目
 */
const updateDressCodeItem = (id: string, content: string): void => {
  const item = dressCodeItems.value.find(i => i.id === id);
  if (item) {
    item.content = content;
  }
};

/**
 * 移除服装规定条目
 */
const removeDressCodeItem = (id: string): void => {
  const index = dressCodeItems.value.findIndex(i => i.id === id);
  if (index !== -1) {
    dressCodeItems.value.splice(index, 1);
    syncTagsToFormData();
  }
};

/**
 * 清理服装规定（同步到formData）
 */
const cleanupDressCode = (): void => {
  syncTagsToFormData();
};

// ============ 申请表模板条目方法 ============

/**
 * 添加申请表模板条目
 */
const addApplicationFormItem = (): void => {
  applicationFormItems.value.push({ id: generateId(), content: '' });
};

/**
 * 更新申请表模板条目
 */
const updateApplicationFormItem = (id: string, content: string): void => {
  const item = applicationFormItems.value.find(i => i.id === id);
  if (item) {
    item.content = content;
  }
};

/**
 * 移除申请表模板条目
 */
const removeApplicationFormItem = (id: string): void => {
  const index = applicationFormItems.value.findIndex(i => i.id === id);
  if (index !== -1) {
    applicationFormItems.value.splice(index, 1);
    syncTagsToFormData();
  }
};

/**
 * 清理申请表模板（同步到formData）
 */
const cleanupApplicationForm = (): void => {
  syncTagsToFormData();
};

// ============ 其他规则条目方法 ============

/**
 * 添加其他规则条目
 */
const addOtherRulesItem = (): void => {
  otherRulesItems.value.push({ id: generateId(), content: '' });
};

/**
 * 更新其他规则条目
 */
const updateOtherRulesItem = (id: string, content: string): void => {
  const item = otherRulesItems.value.find(i => i.id === id);
  if (item) {
    item.content = content;
  }
};

/**
 * 移除其他规则条目
 */
const removeOtherRulesItem = (id: string): void => {
  const index = otherRulesItems.value.findIndex(i => i.id === id);
  if (index !== -1) {
    otherRulesItems.value.splice(index, 1);
    syncTagsToFormData();
  }
};

/**
 * 清理其他规则（同步到formData）
 */
const cleanupOtherRules = (): void => {
  syncTagsToFormData();
};

/**
 * 同步标签数据到formData
 */
const syncTagsToFormData = (): void => {
  formData.rosterFields = rosterFieldTags.value.join('、');
  formData.mainDocument = mainDocumentItems.value
    .filter(i => i.content.trim())
    .map(i => i.content)
    .join('；');
  formData.dressCode = dressCodeItems.value
    .filter(i => i.content.trim())
    .map(i => i.content)
    .join('；');
  formData.applicationForms = applicationFormItems.value
    .filter(i => i.content.trim())
    .map(i => i.content)
    .join('；');
  formData.otherRules = otherRulesItems.value
    .filter(i => i.content.trim())
    .map(i => i.content)
    .join('；');
};

/**
 * 从formData同步到标签（初始化时）
 */
const syncFormDataToTags = (): void => {
  if (formData.rosterFields) {
    rosterFieldTags.value = formData.rosterFields
      .split(/[,，、]/)
      .map(s => s.trim())
      .filter(s => s);
  }
  if (formData.mainDocument) {
    mainDocumentItems.value = formData.mainDocument
      .split(/[。；;]/)
      .map(s => s.trim())
      .filter(s => s)
      .map(content => ({ id: generateId(), content }));
  }
  if (formData.dressCode) {
    dressCodeItems.value = formData.dressCode
      .split(/[。；;]/)
      .map(s => s.trim())
      .filter(s => s)
      .map(content => ({ id: generateId(), content }));
  }
  if (formData.applicationForms) {
    applicationFormItems.value = formData.applicationForms
      .split(/[。；;]/)
      .map(s => s.trim())
      .filter(s => s)
      .map(content => ({ id: generateId(), content }));
  }
  if (formData.otherRules) {
    otherRulesItems.value = formData.otherRules
      .split(/[。；;]/)
      .map(s => s.trim())
      .filter(s => s)
      .map(content => ({ id: generateId(), content }));
  }
};

// 初始化时同步
syncFormDataToTags();

// ============ 预设相关方法 ============

/**
 * 加载预设列表
 */
const loadPresets = (): void => {
  allPresets.value = presetService.getAllPresets();

  // 尝试加载最后使用的预设
  const lastUsedId = presetService.getLastUsedPresetId();
  if (lastUsedId) {
    selectedPresetId.value = lastUsedId;
  }
};

/**
 * 打开预设管理面板
 */
const openPresetPanel = (): void => {
  loadPresets();
  showPresetPanel.value = true;
};

/**
 * 关闭预设管理面板
 */
const closePresetPanel = (): void => {
  showPresetPanel.value = false;
  presetError.value = null;
};

/**
 * 打开保存预设对话框
 */
const openSavePresetDialog = (): void => {
  // 根据当前场景类型生成默认名称
  const sceneLabel = SCENE_TYPE_PRESETS[formData.sceneType]?.label || '自定义';
  const timestamp = new Date().toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  newPresetName.value = `${sceneLabel} - ${formData.sceneName || '未命名'} (${timestamp})`;
  newPresetDescription.value = '';
  showSavePresetDialog.value = true;
};

/**
 * 关闭保存预设对话框
 */
const closeSavePresetDialog = (): void => {
  showSavePresetDialog.value = false;
  newPresetName.value = '';
  newPresetDescription.value = '';
  presetError.value = null;
};

/**
 * 保存当前表单为预设
 */
const saveCurrentAsPreset = async (): Promise<void> => {
  if (!newPresetName.value.trim()) {
    presetError.value = '请输入预设名称';
    return;
  }

  isSavingPreset.value = true;
  presetError.value = null;

  try {
    // 同步标签数据到 formData
    syncTagsToFormData();

    const preset = presetService.savePreset(
      newPresetName.value.trim(),
      formData,
      newPresetDescription.value.trim() || undefined,
    );

    if (preset) {
      // 刷新预设列表
      loadPresets();
      selectedPresetId.value = preset.id;
      closeSavePresetDialog();

      if (typeof toastr !== 'undefined') {
        toastr.success(`预设"${preset.name}"已保存`, '保存成功', { timeOut: 2000 });
      }
    } else {
      presetError.value = '保存预设失败，请重试';
    }
  } catch (err) {
    console.error('[GameStartPanel] 保存预设失败:', err);
    presetError.value = err instanceof Error ? err.message : '保存失败';
  } finally {
    isSavingPreset.value = false;
  }
};

/**
 * 加载预设到表单
 */
const loadPreset = (preset: GameStartPreset): void => {
  // 复制预设数据到表单
  Object.assign(formData, preset.formData);

  // 同步到条目式UI
  syncFormDataToTags();

  // 记录最后使用的预设
  presetService.setLastUsedPreset(preset.id);
  selectedPresetId.value = preset.id;

  // 关闭预设面板
  closePresetPanel();

  if (typeof toastr !== 'undefined') {
    toastr.info(`已加载预设"${preset.name}"`, '加载成功', { timeOut: 2000 });
  }
};

/**
 * 快速加载预设（从下拉选择器）
 */
const quickLoadPreset = (presetId: string): void => {
  const preset = presetService.getPresetById(presetId);
  if (preset) {
    loadPreset(preset);
  }
};

/**
 * 确认删除预设
 */
const confirmDeletePreset = (presetId: string): void => {
  presetToDelete.value = presetId;
  showDeleteConfirm.value = true;
};

/**
 * 执行删除预设
 */
const executeDeletePreset = (): void => {
  if (!presetToDelete.value) return;

  const preset = presetService.getPresetById(presetToDelete.value);
  const success = presetService.deletePreset(presetToDelete.value);

  if (success) {
    loadPresets();

    // 如果删除的是当前选中的预设，清除选中状态
    if (selectedPresetId.value === presetToDelete.value) {
      selectedPresetId.value = null;
    }

    if (typeof toastr !== 'undefined' && preset) {
      toastr.success(`预设"${preset.name}"已删除`, '删除成功', { timeOut: 2000 });
    }
  } else if (typeof toastr !== 'undefined') {
    toastr.error('删除预设失败', '错误', { timeOut: 3000 });
  }

  showDeleteConfirm.value = false;
  presetToDelete.value = null;
};

/**
 * 取消删除
 */
const cancelDeletePreset = (): void => {
  showDeleteConfirm.value = false;
  presetToDelete.value = null;
};

/**
 * 复制预设
 */
const duplicatePreset = (presetId: string): void => {
  const newPreset = presetService.duplicatePreset(presetId);
  if (newPreset) {
    loadPresets();
    if (typeof toastr !== 'undefined') {
      toastr.success(`已创建预设副本"${newPreset.name}"`, '复制成功', { timeOut: 2000 });
    }
  }
};

/**
 * 获取预设的场景图标
 */
const getPresetIcon = (preset: GameStartPreset): string => {
  return SCENE_TYPE_PRESETS[preset.formData.sceneType]?.icon || '✨';
};

/**
 * 格式化日期显示
 */
const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

// 组件挂载时加载预设
onMounted(() => {
  loadPresets();
});

/**
 * 处理随机填充
 */
const handleRandomFill = (): void => {
  const randomData = randomFillFormData({
    playerName: formData.playerName,
    worldView: formData.worldView,
    additionalNotes: formData.additionalNotes,
  });

  Object.assign(formData, randomData);
  // 同步到条目式UI
  syncFormDataToTags();
  showErrors.value = false;

  if (typeof toastr !== 'undefined') {
    toastr.info('已随机填充表单', '随机填充', { timeOut: 2000 });
  }
};

/**
 * 处理重置
 */
const handleReset = (): void => {
  Object.assign(formData, DEFAULT_FORM_DATA);
  // 重置条目式UI
  rosterFieldTags.value = [];
  mainDocumentItems.value = [];
  dressCodeItems.value = [];
  applicationFormItems.value = [];
  otherRulesItems.value = [];
  // 同步默认数据到条目式UI
  syncFormDataToTags();
  showErrors.value = false;
  validationErrors.value = [];

  if (typeof toastr !== 'undefined') {
    toastr.info('表单已重置', '重置', { timeOut: 2000 });
  }
};

/**
 * 处理预览提示词
 */
const handlePreviewPrompt = (): void => {
  // 验证表单
  const result = validateFormData(formData);
  validationErrors.value = result.errors;

  if (!result.isValid) {
    showErrors.value = true;
    if (typeof toastr !== 'undefined') {
      toastr.warning('请完善必填项', '表单验证', { timeOut: 3000 });
    }
    return;
  }

  // 生成提示词并显示预览
  const prompt = generateStartPrompt(formData);
  previewPromptText.value = prompt.text;
  showPromptPreview.value = true;
};

/**
 * 关闭提示词预览
 */
const closePromptPreview = (): void => {
  showPromptPreview.value = false;
};

/**
 * 确认并开始游戏（从预览模态框）
 */
const confirmAndStart = async (): Promise<void> => {
  showPromptPreview.value = false;
  isSubmitting.value = true;

  try {
    console.log('[GameStartPanel] 确认开局提示词，长度:', previewPromptText.value.length);
    emit('start', previewPromptText.value);
  } catch (err) {
    console.error('[GameStartPanel] 开始游戏失败:', err);
    if (typeof toastr !== 'undefined') {
      toastr.error('开始游戏失败，请重试', '错误', { timeOut: 3000 });
    }
  } finally {
    isSubmitting.value = false;
  }
};

/**
 * 处理开始游戏
 */
const handleStartGame = async (): Promise<void> => {
  await startGame();
};

/**
 * 开始游戏核心逻辑
 */
const startGame = async (): Promise<void> => {
  // 验证表单
  const result = validateFormData(formData);
  validationErrors.value = result.errors;

  if (!result.isValid) {
    showErrors.value = true;
    if (typeof toastr !== 'undefined') {
      toastr.warning('请完善必填项', '表单验证', { timeOut: 3000 });
    }
    return;
  }

  isSubmitting.value = true;
  showErrors.value = false;

  try {
    // 生成提示词
    const prompt = generateStartPrompt(formData);
    console.log('[GameStartPanel] 生成开局提示词:', prompt.text.substring(0, 200) + '...');

    // 发送提示词给父组件处理
    emit('start', prompt.text);
  } catch (err) {
    console.error('[GameStartPanel] 开始游戏失败:', err);
    if (typeof toastr !== 'undefined') {
      toastr.error('开始游戏失败，请重试', '错误', { timeOut: 3000 });
    }
  } finally {
    isSubmitting.value = false;
  }
};

// ============ 监听 ============

// 监听表单变化，清除对应字段的错误
watch(
  formData,
  () => {
    if (showErrors.value) {
      const result = validateFormData(formData);
      validationErrors.value = result.errors;
    }
  },
  { deep: true },
);
</script>

<style lang="scss" scoped>
.game-start-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

// ============ 面板头部 - 保持紧凑 ============
.panel-header {
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%);
  color: white;
  position: relative;
  overflow: hidden;

  .header-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-md);
    position: relative;
    z-index: 1;
  }

  .header-icon-wrapper {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm);
  }

  .header-icon {
    font-size: 18px;
  }

  .header-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-title {
    margin: 0;
    font-size: var(--font-md);
    font-weight: 600;
  }

  .header-subtitle {
    margin: 0;
    font-size: var(--font-xs);
    opacity: 0.8;
  }
}

// ============ 进度指示器 ============
.form-progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
  margin-bottom: var(--spacing-sm);

  .progress-bar {
    flex: 1;
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-xs);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary-color), var(--success-color));
    border-radius: var(--radius-xs);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: var(--font-xs);
    color: var(--text-secondary);
    white-space: nowrap;
  }
}

// ============ 面板主体 ============
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

// ============ 设定区块 ============
.setting-section {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-md);
  overflow: hidden;
  transition: all var(--transition-fast);

  &:last-child {
    margin-bottom: 0;
  }

  &.has-content {
    border-color: var(--primary-color);
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);

  .section-header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .section-icon {
    font-size: 16px;
  }

  .section-title {
    margin: 0;
    font-size: var(--font-md);
    font-weight: 600;
    color: var(--text-color);
  }
}

.required-badge,
.optional-badge {
  padding: 2px 8px;
  font-size: var(--font-xs);
  font-weight: 600;
  border-radius: var(--radius-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.required-badge {
  background: var(--error-light);
  color: var(--error-color);
}

.optional-badge {
  background: var(--info-light);
  color: var(--info-color);
}

.section-content {
  padding: var(--spacing-md);
}

// ============ 表单样式 ============
.form-row {
  margin-bottom: var(--spacing-md);

  &:last-child {
    margin-bottom: 0;
  }
}

.form-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  position: relative;
}

.form-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-sm);
  font-weight: 500;
  color: var(--text-color);

  .required-mark {
    color: var(--error-color);
    font-weight: 700;
  }

  .optional-mark {
    font-size: var(--font-xs);
    color: var(--text-disabled);
    font-weight: 400;
  }
}

.form-input,
.form-textarea {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--text-color);
  background: var(--bg-secondary);
  transition: all var(--transition-fast);

  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-light);
  }

  &::placeholder {
    color: var(--text-disabled);
  }

  &.has-error {
    border-color: var(--error-color);
    background: var(--error-light);
  }

  &.has-value {
    border-color: var(--success-color);
    background: var(--success-light);
  }
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  line-height: 1.5;
}

.help-text {
  font-size: var(--font-xs);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.error-text {
  font-size: var(--font-xs);
  color: var(--error-color);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.char-count {
  font-size: var(--font-xs);
  color: var(--text-disabled);
  text-align: right;
  margin-top: var(--spacing-xs);
}

// ============ 场景类型选择器 ============
.scene-type-selector {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: var(--spacing-sm);
}

.scene-type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;

  &:hover {
    border-color: var(--primary-color);
    background: var(--primary-light);
  }

  &.active {
    border-color: var(--primary-color);
    background: var(--primary-light);

    .scene-label {
      color: var(--primary-color);
      font-weight: 600;
    }

    .check-icon {
      opacity: 1;
      transform: scale(1);
    }
  }

  .scene-icon {
    font-size: 24px;
  }

  .scene-label {
    font-size: var(--font-xs);
    color: var(--text-secondary);
    transition: all var(--transition-fast);
    text-align: center;
    line-height: 1.2;
  }

  .check-icon {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 16px;
    height: 16px;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: scale(0);
    transition: all var(--transition-fast);
  }
}

// ============ 规章制度区块 - 条目式UI ============
.rules-section .section-content {
  padding: var(--spacing-md);
}

.rules-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.rules-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: all var(--transition-fast);

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);

    .card-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      font-size: var(--font-sm);
      font-weight: 600;
      color: var(--text-color);

      .card-icon {
        font-size: 16px;
      }

      .required-mark {
        color: var(--error-color);
        font-size: var(--font-xs);
        font-weight: 600;
        padding: 2px 6px;
        background: var(--error-light);
        border-radius: var(--radius-xs);
      }

      .optional-mark {
        font-size: var(--font-xs);
        color: var(--text-disabled);
        font-weight: 400;
      }
    }

    .field-count {
      font-size: var(--font-xs);
      color: var(--text-secondary);
      background: var(--bg-color);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
    }
  }

  .card-body {
    padding: var(--spacing-md);
  }

  .card-desc {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    margin: 0 0 var(--spacing-sm);
    font-size: var(--font-sm);
    color: var(--text-secondary);
    line-height: 1.5;

    .desc-icon {
      flex-shrink: 0;
      font-size: 14px;
    }
  }

  .card-hint {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin: 0 0 var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-sm);
    color: var(--info-color);
    background: var(--info-light);
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--info-color);

    strong {
      color: var(--primary-color);
    }
  }
}

// ============ 预设字段 ============
.preset-fields {
  margin-bottom: var(--spacing-md);

  .preset-label {
    display: block;
    font-size: var(--font-sm);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  .preset-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }
}

.preset-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-tertiary);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: var(--primary-light);
    border-color: var(--primary-color);
    border-style: solid;
    color: var(--primary-color);
  }

  .tag-icon {
    font-size: var(--font-sm);
    font-weight: 700;
  }
}

// ============ 已选字段 ============
.selected-fields {
  min-height: 48px;
  padding: var(--spacing-sm);
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-md);

  &.has-fields {
    background: var(--success-light);
    border-color: var(--success-color);
  }

  .empty-hint {
    display: block;
    text-align: center;
    color: var(--text-disabled);
    font-size: var(--font-sm);
    padding: var(--spacing-sm);
  }
}

.field-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.field-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--primary-color);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  font-weight: 500;
  animation: tagAppear 0.2s ease-out;
  animation-delay: calc(var(--tag-index) * 0.03s);

  .tag-text {
    white-space: nowrap;
  }

  .tag-remove {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);

    &:hover {
      background: rgba(255, 255, 255, 0.4);
    }
  }
}

@keyframes tagAppear {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

// ============ 添加字段行 ============
.add-field-row {
  display: flex;
  gap: var(--spacing-sm);

  .add-field-input {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    font-size: var(--font-sm);
    color: var(--text-color);
    background: var(--bg-secondary);

    &:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px var(--primary-light);
    }

    &::placeholder {
      color: var(--text-disabled);
    }
  }

  .add-field-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--font-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);

    &:hover:not(:disabled) {
      background: var(--primary-hover);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

// ============ 规则条目 ============
.rule-items {
  min-height: 40px;
  margin-bottom: var(--spacing-md);

  &:empty,
  &:not(.has-items) {
    display: none;
  }
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.rule-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs);
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  animation: ruleSlideIn 0.2s ease-out;

  .rule-number {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary-light);
    color: var(--primary-color);
    border-radius: 50%;
    font-size: var(--font-sm);
    font-weight: 600;
    flex-shrink: 0;
  }

  .rule-input {
    flex: 1;
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font-size: var(--font-sm);
    color: var(--text-color);
    background: transparent;
    transition: all var(--transition-fast);

    &:focus {
      outline: none;
      background: var(--bg-secondary);
      border-color: var(--primary-color);
    }

    &::placeholder {
      color: var(--text-disabled);
    }
  }

  .rule-remove {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-disabled);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
    font-size: 14px;

    &:hover {
      background: var(--error-light);
      color: var(--error-color);
    }
  }
}

@keyframes ruleSlideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

// ============ 添加规则按钮 ============
.add-rule-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  width: 100%;

  &:hover {
    background: var(--primary-light);
    border-color: var(--primary-color);
    border-style: solid;
    color: var(--primary-color);
  }

  .btn-icon {
    font-size: 16px;
    font-weight: 700;
  }
}

// ============ 标签过渡动画 ============
.tag-enter-active,
.tag-leave-active {
  transition: all 0.2s ease;
}

.tag-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.tag-leave-to {
  opacity: 0;
  transform: scale(0.8) translateX(-10px);
}

.tag-move {
  transition: transform 0.2s ease;
}

// ============ 规则过渡动画 ============
.rule-enter-active,
.rule-leave-active {
  transition: all 0.2s ease;
}

.rule-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.rule-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.rule-move {
  transition: transform 0.2s ease;
}

// ============ 面板底部 - 保持紧凑 ============
.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
  gap: var(--spacing-sm);
  flex-wrap: wrap;

  .footer-left,
  .footer-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .btn-text {
    white-space: nowrap;
  }
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  color: white;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }
}

.btn-outline-primary {
  background: transparent;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);

  &:hover:not(:disabled) {
    background: var(--primary-light);
  }
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-color);
  border: 1px solid var(--border-color);

  &:hover:not(:disabled) {
    background: var(--bg-hover);
  }
}

// ============ 加载动画 ============
.btn-loading {
  display: flex;
  align-items: center;
  gap: 4px;

  .loading-dot {
    width: 6px;
    height: 6px;
    background: currentColor;
    border-radius: 50%;
    animation: loadingPulse 1.4s ease-in-out infinite;

    &:nth-child(1) {
      animation-delay: 0s;
    }
    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
}

@keyframes loadingPulse {
  0%,
  80%,
  100% {
    opacity: 0.4;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

// ============ 验证错误提示 ============
.validation-errors {
  position: absolute;
  bottom: 80px;
  left: var(--spacing-md);
  right: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--error-light);
  border: 1px solid var(--error-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 10;

  .error-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--error-color);
    margin-bottom: var(--spacing-sm);

    .error-icon {
      font-size: 16px;
    }

    .error-close {
      margin-left: auto;
      background: none;
      border: none;
      color: var(--error-color);
      cursor: pointer;
      font-size: 14px;
      padding: 2px;
      opacity: 0.7;

      &:hover {
        opacity: 1;
      }
    }
  }

  .error-list {
    margin: 0;
    padding-left: var(--spacing-lg);

    li {
      font-size: var(--font-sm);
      color: var(--error-color);
      line-height: 1.6;
    }
  }
}

// ============ 提示词预览模态框 ============
.prompt-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10030; // 确保在全屏模式下也能显示在最上层
  padding: var(--spacing-md);
  overflow-y: auto;
}

.prompt-preview-modal {
  width: 100%;
  max-width: 800px;
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px); // 使用动态视口高度，更好地适配移动端和全屏模式
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: auto; // 确保在滚动容器中居中

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
    color: white;

    .modal-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);

      .modal-icon {
        font-size: 20px;
      }

      h3 {
        margin: 0;
        font-size: var(--font-lg);
        font-weight: 600;
      }
    }

    .modal-close {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);

      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    }
  }

  .modal-body {
    flex: 1;
    padding: var(--spacing-md);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    min-height: 0; // 允许flex子元素收缩

    .prompt-info {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--info-light);
      border: 1px solid var(--info-color);
      border-radius: var(--radius-sm);
      color: var(--info-color);
      font-size: var(--font-sm);
      flex-shrink: 0;

      .info-icon {
        flex-shrink: 0;
        font-size: 16px;
      }

      .info-text {
        line-height: 1.5;
      }
    }

    .prompt-content-wrapper {
      flex: 1;
      min-height: 150px; // 减小最小高度以适应小屏幕
      display: flex;
      flex-direction: column;
    }

    .prompt-textarea {
      width: 100%;
      flex: 1;
      min-height: 150px; // 减小最小高度
      padding: var(--spacing-md);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: var(--font-sm);
      font-family: 'Consolas', 'Monaco', monospace;
      line-height: 1.6;
      color: var(--text-color);
      background: var(--bg-color);
      resize: vertical;

      &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px var(--primary-light);
      }
    }

    .prompt-stats {
      display: flex;
      gap: var(--spacing-lg);
      padding-top: var(--spacing-sm);
      border-top: 1px solid var(--border-light);
      flex-shrink: 0;

      .stat-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        font-size: var(--font-sm);
        color: var(--text-secondary);

        .stat-icon {
          font-size: 14px;
        }
      }
    }
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-tertiary);
    border-top: 1px solid var(--border-color);
    flex-shrink: 0;
  }
}

// ============ 提示词预览模态框 - 小屏幕适配 ============
@media (max-height: 600px) {
  .prompt-preview-overlay {
    padding: var(--spacing-xs);
    align-items: flex-start;
  }

  .prompt-preview-modal {
    max-height: calc(100vh - 16px);
    max-height: calc(100dvh - 16px);
    border-radius: var(--radius-md);

    .modal-header {
      padding: var(--spacing-sm) var(--spacing-md);

      .modal-title h3 {
        font-size: var(--font-md);
      }
    }

    .modal-body {
      padding: var(--spacing-sm);

      .prompt-content-wrapper {
        min-height: 100px;
      }

      .prompt-textarea {
        min-height: 100px;
        padding: var(--spacing-sm);
        font-size: var(--font-xs);
      }
    }

    .modal-footer {
      padding: var(--spacing-xs) var(--spacing-sm);

      .btn {
        padding: var(--spacing-xs) var(--spacing-sm);
        font-size: var(--font-xs);
      }
    }
  }
}

// ============ 提示词预览模态框 - 极小屏幕适配 ============
@media (max-height: 400px) {
  .prompt-preview-modal {
    max-height: calc(100vh - 8px);
    max-height: calc(100dvh - 8px);

    .modal-header {
      padding: var(--spacing-xs) var(--spacing-sm);

      .modal-close {
        width: 24px;
        height: 24px;
        font-size: 12px;
      }
    }

    .modal-body {
      padding: var(--spacing-xs);
      gap: var(--spacing-xs);

      .prompt-info {
        padding: var(--spacing-xs);
        font-size: var(--font-xs);
      }

      .prompt-content-wrapper {
        min-height: 80px;
      }

      .prompt-textarea {
        min-height: 80px;
      }

      .prompt-stats {
        padding-top: var(--spacing-xs);
        gap: var(--spacing-sm);

        .stat-item {
          font-size: var(--font-xs);
        }
      }
    }
  }
}

// ============ 过渡动画 ============
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 500px;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .prompt-preview-modal {
    transform: scale(0.9) translateY(20px);
  }
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .prompt-preview-modal {
    max-height: 95vh;
    margin: var(--spacing-sm);
  }

  .form-row-2col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .panel-body {
    padding: var(--spacing-sm);
  }

  .section-content {
    padding: var(--spacing-sm);
  }

  .panel-footer {
    padding: var(--spacing-xs) var(--spacing-sm);
    gap: var(--spacing-xs);
    justify-content: center;

    .footer-left,
    .footer-right {
      gap: var(--spacing-xs);
    }
  }

  .btn {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-xs);

    .btn-icon {
      font-size: 12px;
    }
  }

  .scene-type-selector {
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  }
}

// ============ 极小屏幕（宽度小于360px） ============
@media (max-width: 360px) {
  .panel-footer {
    flex-direction: column;
    padding: var(--spacing-xs);
    gap: var(--spacing-xs);

    .footer-left,
    .footer-right {
      width: 100%;
      justify-content: center;
    }
  }

  .btn {
    padding: var(--spacing-xs);
    font-size: var(--font-xs);

    .btn-icon {
      font-size: 11px;
    }
  }
}

// ============ 预设相关样式 ============

// 头部预设按钮
.header-actions {
  margin-left: auto;
}

.preset-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-sm);
  color: white;
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .preset-icon {
    font-size: 14px;
  }

  .preset-text {
    font-weight: 500;
  }

  .preset-count {
    background: rgba(255, 255, 255, 0.3);
    padding: 1px 6px;
    border-radius: var(--radius-xs);
    font-size: var(--font-xs);
    font-weight: 600;
  }
}

// 成功按钮样式
.btn-success {
  background: linear-gradient(135deg, var(--success-color), #28a745);
  color: white;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }
}

// 危险按钮样式
.btn-danger {
  background: linear-gradient(135deg, var(--error-color), #dc3545);
  color: white;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }
}

// 预设管理模态框
.preset-panel-overlay,
.save-preset-overlay,
.delete-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10030;
  padding: var(--spacing-md);
  overflow-y: auto;
}

.preset-panel-modal {
  width: 100%;
  max-width: 600px;
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: auto;
}

.save-preset-modal,
.delete-confirm-modal {
  width: 100%;
  max-width: 400px;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: auto;
}

// 预设信息提示
.preset-info {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--info-light);
  border: 1px solid var(--info-color);
  border-radius: var(--radius-sm);
  color: var(--info-color);
  font-size: var(--font-sm);
  margin-bottom: var(--spacing-md);

  .info-icon {
    flex-shrink: 0;
    font-size: 16px;
  }

  .info-text {
    line-height: 1.5;
  }
}

// 预设列表
.preset-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-height: 400px;
  overflow-y: auto;
}

// 预设分组
.preset-group {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;

  .group-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);

    .group-icon {
      font-size: 14px;
    }

    .group-title {
      font-size: var(--font-sm);
      font-weight: 600;
      color: var(--text-color);
    }

    .group-count {
      margin-left: auto;
      background: var(--primary-light);
      color: var(--primary-color);
      padding: 2px 8px;
      border-radius: var(--radius-xs);
      font-size: var(--font-xs);
      font-weight: 600;
    }
  }

  .group-items {
    padding: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .group-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg);
    color: var(--text-disabled);

    .empty-icon {
      font-size: 32px;
      opacity: 0.5;
    }

    .empty-text {
      font-size: var(--font-sm);
      text-align: center;
    }
  }
}

// 预设项
.preset-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    border-color: var(--primary-color);
    background: var(--primary-light);
  }

  &.active {
    border-color: var(--primary-color);
    background: var(--primary-light);

    .preset-item-name {
      color: var(--primary-color);
    }
  }

  .preset-item-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: 20px;
    flex-shrink: 0;
  }

  .preset-item-content {
    flex: 1;
    min-width: 0;

    .preset-item-name {
      font-size: var(--font-sm);
      font-weight: 600;
      color: var(--text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .preset-item-desc {
      font-size: var(--font-xs);
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    .preset-item-meta {
      display: flex;
      gap: var(--spacing-sm);
      margin-top: 4px;

      .meta-date {
        font-size: var(--font-xs);
        color: var(--text-disabled);
      }
    }
  }

  .preset-item-badge {
    padding: 2px 8px;
    border-radius: var(--radius-xs);
    font-size: var(--font-xs);
    font-weight: 600;
    flex-shrink: 0;

    &.builtin {
      background: var(--info-light);
      color: var(--info-color);
    }
  }

  .preset-item-actions {
    display: flex;
    gap: var(--spacing-xs);
    flex-shrink: 0;

    .action-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: 14px;
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        border-color: var(--primary-color);
      }

      &.danger:hover {
        background: var(--error-light);
        border-color: var(--error-color);
      }
    }
  }
}

// 错误消息
.error-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--error-light);
  border: 1px solid var(--error-color);
  border-radius: var(--radius-sm);
  color: var(--error-color);
  font-size: var(--font-sm);
  margin-top: var(--spacing-sm);

  .error-icon {
    flex-shrink: 0;
    font-size: 14px;
  }
}

// 确认文本
.confirm-text {
  font-size: var(--font-sm);
  color: var(--text-color);
  line-height: 1.6;
  margin: 0;
  text-align: center;
  padding: var(--spacing-md);
}

// 危险头部
.modal-header.danger {
  background: linear-gradient(135deg, var(--error-color), #dc3545);
}

// 预设模态框响应式
@media (max-width: 480px) {
  .preset-panel-modal {
    max-width: 100%;
    margin: var(--spacing-sm);
  }

  .preset-item {
    flex-wrap: wrap;

    .preset-item-actions {
      width: 100%;
      justify-content: flex-end;
      margin-top: var(--spacing-xs);
      padding-top: var(--spacing-xs);
      border-top: 1px solid var(--border-light);
    }
  }

  .preset-btn {
    .preset-text {
      display: none;
    }
  }
}
</style>
