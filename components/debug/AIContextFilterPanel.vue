<!--
  AI变量过滤控制面板
  用于控制和预览发送给AI的变量数据过滤效果
  预览内容与实际发送给AI的内容完全一致
-->
<template>
  <div class="filter-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <h3>🔧 AI变量过滤设置</h3>
      <button class="btn-close" @click="$emit('close')">✕</button>
    </div>

    <!-- 面板内容 -->
    <div class="panel-content">
      <!-- 左侧：控制区域 -->
      <div class="control-section">
        <!-- 启用开关 -->
        <div class="control-group main-toggle">
          <div class="toggle-header">
            <span class="toggle-label">🚀 启用变量过滤</span>
            <label class="switch">
              <input v-model="isEnabled" type="checkbox" @change="toggleInterceptor" />
              <span class="slider"></span>
            </label>
          </div>
          <p class="toggle-desc">
            {{ isEnabled ? '已启用：AI将只看到过滤后的精简变量数据' : '已禁用：AI将看到完整的原始变量数据' }}
          </p>
        </div>

        <!-- 状态指示 -->
        <div class="status-indicator" :class="{ active: isEnabled }">
          <span class="status-dot"></span>
          <span class="status-text">{{ isEnabled ? '拦截器运行中' : '拦截器已停止' }}</span>
        </div>

        <!-- 高级配置 -->
        <div class="config-section">
          <div class="section-title">📐 高级配置</div>

          <!-- 输出格式选择 -->
          <div class="control-group">
            <label>📄 输出格式</label>
            <div class="format-selector">
              <button
                v-for="fmt in formatOptions"
                :key="fmt.value"
                class="format-btn"
                :class="{ active: config.outputFormat === fmt.value }"
                @click="setOutputFormat(fmt.value)"
              >
                {{ fmt.icon }} {{ fmt.label }}
              </button>
            </div>
            <p class="config-hint">{{ currentFormatDesc }}</p>
          </div>

          <div class="control-group">
            <label>嵌套深度限制</label>
            <div class="slider-container">
              <input
                v-model.number="config.maxDepth"
                type="range"
                min="0"
                max="20"
                class="slider"
                @change="applyConfig"
              />
              <span class="slider-value">{{ config.maxDepth === 0 ? '无限制' : config.maxDepth }}</span>
            </div>
            <p class="config-hint">限制JSON嵌套层级，0表示不限制</p>
          </div>

          <div class="control-group">
            <label>数组长度限制</label>
            <div class="slider-container">
              <input
                v-model.number="config.maxArrayLength"
                type="range"
                min="0"
                max="50"
                class="slider"
                @change="applyConfig"
              />
              <span class="slider-value">{{ config.maxArrayLength === 0 ? '无限制' : config.maxArrayLength }}</span>
            </div>
            <p class="config-hint">限制数组元素数量，0表示不限制</p>
          </div>
        </div>

        <!-- 统计信息 -->
        <div v-if="interceptorStats" class="stats-section">
          <div class="section-title">📊 运行统计</div>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value">{{ interceptorStats.totalInterceptions }}</span>
              <span class="stat-label">总拦截次数</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ interceptorStats.successfulReplacements }}</span>
              <span class="stat-label">成功替换</span>
            </div>
            <div class="stat-item highlight">
              <span class="stat-value">{{ averageCompressionRatio.toFixed(1) }}%</span>
              <span class="stat-label">平均压缩比</span>
            </div>
          </div>
          <button class="btn-reset-stats" @click="resetStats">重置统计</button>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <button class="btn-save" :disabled="isSaving" @click="saveConfig">
            <span v-if="isSaving">⏳ 保存中...</span>
            <span v-else>💾 保存配置</span>
          </button>
          <button class="btn-refresh" @click="refreshPreview">
            <span>🔄 刷新预览</span>
          </button>
        </div>
      </div>

      <!-- 右侧：预览区域 -->
      <div class="preview-section">
        <div class="section-header">
          <span>👁️ 过滤预览</span>
          <span class="preview-hint">（此内容即AI实际接收的变量数据）</span>
        </div>

        <!-- 预览信息栏 -->
        <div class="preview-info">
          <div class="info-item">
            <span class="info-label">原始大小</span>
            <span class="info-value">{{ filterStats?.originalSize?.toLocaleString() || '-' }} 字符</span>
          </div>
          <div class="info-item">
            <span class="info-label">过滤后</span>
            <span class="info-value">{{ filterStats?.filteredSize?.toLocaleString() || '-' }} 字符</span>
          </div>
          <div class="info-item highlight">
            <span class="info-label">压缩比</span>
            <span class="info-value">{{ filterStats?.compressionRatio?.toFixed(1) || '-' }}%</span>
          </div>
          <div class="info-item">
            <span class="info-label">估算Token</span>
            <span class="info-value">{{ filterStats?.estimatedTokens?.toLocaleString() || '-' }}</span>
          </div>
        </div>

        <!-- 预览内容 -->
        <div class="preview-container">
          <div v-if="isLoading" class="loading-state">
            <span>⏳ 加载中...</span>
          </div>
          <div v-else-if="!previewContent" class="empty-state">
            <span>📭 暂无数据</span>
            <p>请确保MVU变量框架已加载</p>
            <button class="btn-sm" @click="refreshPreview">加载变量数据</button>
          </div>
          <!-- Markdown 格式使用特殊渲染 -->
          <div
            v-else-if="config.outputFormat === 'markdown'"
            class="preview-content markdown-content"
            v-html="renderedMarkdown"
          ></div>
          <!-- 其他格式使用 pre 标签 -->
          <pre v-else class="preview-content">{{ previewContent }}</pre>
        </div>

        <!-- 复制按钮 -->
        <div class="preview-actions">
          <button class="btn-sm" :disabled="!previewContent" @click="copyPreview">📋 复制内容</button>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-toast">
      <span>⚠️ {{ errorMessage }}</span>
      <button @click="errorMessage = ''">✕</button>
    </div>

    <!-- 成功提示 -->
    <div v-if="successMessage" class="success-toast">
      <span>✅ {{ successMessage }}</span>
      <button @click="successMessage = ''">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { aiContextFilterService, type OutputFormat } from '../../services/AIContextFilterService';
// MVU拦截器已禁用 - 变量过滤功能已废止
// import { mvuInterceptorService } from '../../services/MVUInterceptorService';

// ============ Emits ============
defineEmits<{
  (e: 'close'): void;
}>();

// ============ 格式选项 ============
const formatOptions = [
  { value: 'markdown' as OutputFormat, label: 'Markdown', icon: '📝', desc: 'Markdown 格式，层级清晰，适合阅读' },
  { value: 'json' as OutputFormat, label: 'JSON', icon: '📋', desc: 'JSON 格式，结构化数据' },
  { value: 'summary' as OutputFormat, label: '摘要', icon: '📌', desc: '摘要格式，简洁的路径+值形式' },
  { value: 'structured' as OutputFormat, label: '结构化', icon: '🗂️', desc: '结构化文本，缩进层级' },
];

// ============ 状态 ============
const isEnabled = ref(true);
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const previewContent = ref('');

const config = ref({
  maxDepth: 0, // 默认无限制
  maxArrayLength: 0, // 默认无限制
  outputFormat: 'markdown' as OutputFormat, // 默认 markdown 格式
});

const filterStats = ref<{
  originalSize: number;
  filteredSize: number;
  compressionRatio: number;
  estimatedTokens: number;
} | null>(null);

// ============ 计算属性 ============

/**
 * 拦截器统计信息（已禁用）
 */
const interceptorStats = computed(() => {
  // MVU拦截器已禁用
  return null;
});

/**
 * 平均压缩比（已禁用）
 */
const averageCompressionRatio = computed(() => {
  // MVU拦截器已禁用
  return 0;
});

/**
 * 当前格式描述
 */
const currentFormatDesc = computed(() => {
  const fmt = formatOptions.find(f => f.value === config.value.outputFormat);
  return fmt?.desc || '';
});

/**
 * 渲染后的 Markdown（简单转换为 HTML）
 */
const renderedMarkdown = computed(() => {
  if (!previewContent.value) return '';
  // 简单的 Markdown 转 HTML
  return previewContent.value
    .replace(/^######\s(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^-\s(.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
});

// ============ 方法 ============

/**
 * 切换拦截器启用状态（已禁用）
 */
const toggleInterceptor = () => {
  // MVU拦截器已禁用 - 变量过滤功能已废止
  showSuccess('变量过滤功能已废止');
};

/**
 * 设置输出格式
 */
const setOutputFormat = (format: OutputFormat) => {
  config.value.outputFormat = format;
  refreshPreview();
};

/**
 * 应用配置到拦截器（已禁用）
 */
const applyConfig = () => {
  // MVU拦截器已禁用 - 只刷新预览
  refreshPreview();
};

/**
 * 刷新预览
 */
const refreshPreview = async () => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    // 从MVU获取数据
    const mvuData = await loadMvuData();

    if (!mvuData || Object.keys(mvuData).length === 0) {
      previewContent.value = '';
      filterStats.value = null;
      return;
    }

    // 使用与拦截器相同的过滤逻辑
    const result = aiContextFilterService.filter(mvuData, {
      preset: 'minimal', // 固定使用最小模式
      output: {
        format: config.value.outputFormat, // 使用用户选择的格式
        pretty: true,
        indent: 2,
        includePaths: false,
        language: 'zh',
      },
      customRules: {
        maxDepth: config.value.maxDepth,
        maxArrayLength: config.value.maxArrayLength,
        removeMeta: true,
        removeHiddenNodes: true,
        simplifyStructures: true,
        removeEmptyNodes: true,
        excludeFields: ['修订记录', '附件表单', '版本', '生效日期', '编制单位', '备注', '说明', '荣誉程度', '层级'],
      },
    });

    // 更新预览内容
    previewContent.value = result.output.content;

    // 更新统计
    filterStats.value = {
      originalSize: result.filtered.originalSize,
      filteredSize: result.filtered.filteredSize,
      compressionRatio: result.filtered.compressionRatio,
      estimatedTokens: result.output.estimatedTokens,
    };
  } catch (err) {
    console.error('[AIContextFilterPanel] 刷新预览失败:', err);
    errorMessage.value = err instanceof Error ? err.message : '刷新预览失败';
    setTimeout(() => (errorMessage.value = ''), 5000);
  } finally {
    isLoading.value = false;
  }
};

/**
 * 从MVU加载数据
 */
const loadMvuData = async (): Promise<Record<string, any> | null> => {
  // 方法1: 尝试使用 Mvu 全局对象
  if (typeof (window as any).Mvu?.getMvuData === 'function') {
    const mvuData = (window as any).Mvu.getMvuData({ type: 'chat' });
    if (mvuData && mvuData.stat_data && Object.keys(mvuData.stat_data).length > 0) {
      return mvuData.stat_data;
    }
  }

  // 方法2: 尝试使用 getMvuVariable 全局函数
  if (typeof (window as any).getMvuVariable === 'function') {
    const mvuData = (window as any).getMvuVariable('', { type: 'chat' });
    if (mvuData && Object.keys(mvuData).length > 0) {
      return mvuData;
    }
  }

  // 方法3: 尝试从父窗口获取
  if (window.parent && window.parent !== window) {
    try {
      const parentMvu = (window.parent as any).Mvu;
      if (parentMvu?.getMvuData) {
        const mvuData = parentMvu.getMvuData({ type: 'chat' });
        if (mvuData && mvuData.stat_data && Object.keys(mvuData.stat_data).length > 0) {
          return mvuData.stat_data;
        }
      }
    } catch (e) {
      // 无法访问父窗口
    }
  }

  return null;
};

/**
 * 复制预览内容
 */
const copyPreview = async () => {
  if (!previewContent.value) return;

  try {
    await navigator.clipboard.writeText(previewContent.value);
    showSuccess('已复制到剪贴板');
  } catch (err) {
    errorMessage.value = '复制失败';
    setTimeout(() => (errorMessage.value = ''), 3000);
  }
};

/**
 * 重置统计（已禁用）
 */
const resetStats = () => {
  // MVU拦截器已禁用
  showSuccess('变量过滤功能已废止');
};

/**
 * 保存配置（已禁用）
 */
const saveConfig = async () => {
  // MVU拦截器已禁用 - 变量过滤功能已废止
  showSuccess('变量过滤功能已废止，无需保存配置');
};

/**
 * 显示成功提示
 */
const showSuccess = (message: string) => {
  successMessage.value = message;
  setTimeout(() => (successMessage.value = ''), 2000);
};

// ============ 监听配置变化 ============
watch(
  () => config.value,
  () => {
    applyConfig();
  },
  { deep: true },
);

// ============ 生命周期 ============
onMounted(async () => {
  // MVU拦截器已禁用 - 变量过滤功能已废止
  isEnabled.value = false;
  config.value.maxDepth = 0;
  config.value.maxArrayLength = 0;

  // 初始加载预览
  await refreshPreview();
});
</script>

<style lang="scss" scoped>
.filter-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--bg-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

// ============ 头部 ============
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);

  h3 {
    margin: 0;
    font-size: var(--font-lg);
    color: var(--text-color);
  }
}

.btn-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--font-lg);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-color);
  }
}

// ============ 内容区 ============
.panel-content {
  flex: 1;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  min-height: 0;
  overflow: hidden;
}

// ============ 控制区 ============
.control-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  overflow-y: auto;
}

.main-toggle {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.toggle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.toggle-label {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-color);
}

.toggle-desc {
  margin: 0;
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

// 开关样式
.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--bg-tertiary);
    transition: 0.3s;
    border-radius: 26px;

    &:before {
      position: absolute;
      content: '';
      height: 20px;
      width: 20px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }
  }

  input:checked + .slider {
    background-color: var(--primary-color);
  }

  input:checked + .slider:before {
    transform: translateX(22px);
  }
}

// 状态指示器
.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--text-muted);
  }

  .status-text {
    font-size: var(--font-sm);
    color: var(--text-secondary);
  }

  &.active {
    border-color: var(--success-color);

    .status-dot {
      background: var(--success-color);
      box-shadow: 0 0 8px var(--success-color);
      animation: pulse 2s infinite;
    }

    .status-text {
      color: var(--success-color);
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

// 配置区
.config-section {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.section-title {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: var(--spacing-md);
}

.control-group {
  margin-bottom: var(--spacing-md);

  &:last-child {
    margin-bottom: 0;
  }

  > label {
    display: block;
    font-size: var(--font-sm);
    font-weight: 500;
    color: var(--text-color);
    margin-bottom: var(--spacing-xs);
  }
}

.slider-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.slider {
  flex: 1;
  height: 4px;
  appearance: none;
  background: var(--bg-tertiary);
  border-radius: var(--radius-xs);

  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: var(--primary-color);
    border-radius: 50%;
    cursor: pointer;
  }
}

.slider-value {
  min-width: 60px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
}

.config-hint {
  margin: var(--spacing-xs) 0 0;
  font-size: 11px;
  color: var(--text-muted);
}

// 格式选择器
.format-selector {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}

.format-btn {
  padding: 6px 12px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-color);
  }

  &.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }
}

// 统计区
.stats-section {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-sm);
  background: var(--bg-color);
  border-radius: var(--radius-xs);

  .stat-value {
    font-size: var(--font-lg);
    font-weight: 600;
    color: var(--text-color);
  }

  .stat-label {
    font-size: 10px;
    color: var(--text-muted);
  }

  &.highlight {
    background: rgba(var(--primary-rgb), 0.1);

    .stat-value {
      color: var(--primary-color);
    }
  }
}

.btn-reset-stats {
  width: 100%;
  padding: var(--spacing-sm);
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-color);
  }
}

// 操作按钮
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: auto;
}

.btn-save {
  width: 100%;
  padding: var(--spacing-md);
  background: var(--success-color);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  font-size: var(--font-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-refresh {
  width: 100%;
  padding: var(--spacing-md);
  background: var(--primary-color);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  font-size: var(--font-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: var(--primary-hover);
  }
}

// ============ 预览区 ============
.preview-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
  font-weight: 500;
  color: var(--text-color);
  font-size: var(--font-sm);

  .preview-hint {
    font-weight: normal;
    font-size: 11px;
    color: var(--text-muted);
  }
}

.preview-info {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.info-item {
  display: flex;
  flex-direction: column;

  .info-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .info-value {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-color);
  }

  &.highlight .info-value {
    color: var(--primary-color);
    font-weight: bold;
  }
}

.preview-container {
  flex: 1;
  overflow: auto;
  background: var(--bg-color);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);

  span {
    font-size: var(--font-lg);
    margin-bottom: var(--spacing-sm);
  }

  p {
    margin: 0 0 var(--spacing-md);
    font-size: var(--font-sm);
  }
}

.preview-content {
  margin: 0;
  padding: var(--spacing-md);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-color);
  white-space: pre-wrap;
  word-break: break-word;
}

// Markdown 内容样式
.markdown-content {
  font-family: var(--font-family);
  font-size: var(--font-sm);

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: var(--spacing-md) 0 var(--spacing-sm);
    color: var(--text-color);
    font-weight: 600;
  }

  h1 {
    font-size: 1.5em;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: var(--spacing-xs);
  }
  h2 {
    font-size: 1.3em;
  }
  h3 {
    font-size: 1.1em;
  }
  h4,
  h5,
  h6 {
    font-size: 1em;
  }

  strong {
    color: var(--primary-color);
  }

  li {
    margin-left: var(--spacing-md);
    list-style-type: disc;
  }

  p {
    margin: var(--spacing-xs) 0;
  }
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
}

.btn-sm {
  padding: 6px 12px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// ============ 提示框 ============
.error-toast,
.success-toast {
  position: absolute;
  bottom: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-lg);
  color: white;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  animation: slideUp 0.3s ease;
  z-index: 100;

  button {
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    opacity: 0.8;

    &:hover {
      opacity: 1;
    }
  }
}

.error-toast {
  background: var(--error-color);
}

.success-toast {
  background: var(--success-color);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .panel-content {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .control-section {
    max-height: 300px;
  }
}
</style>
