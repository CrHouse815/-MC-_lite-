<!--
  MClite - 更新日志面板组件
  从 GitHub 仓库通过 jsdelivr CDN 抓取 CHANGELOG.md 并显示
  支持 Markdown 解析和版本号高亮
-->
<template>
  <div class="changelog-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <div class="header-left">
        <span class="header-icon">📋</span>
        <h3 class="header-title">更新日志</h3>
        <span class="version-badge">v{{ currentVersion }}</span>
      </div>
      <div class="header-right">
        <button class="btn-refresh" @click="fetchChangelog" :disabled="isLoading" title="刷新">
          <span class="refresh-icon" :class="{ spinning: isLoading }">🔄</span>
        </button>
        <button class="btn-close" @click="$emit('close')" title="关闭">✕</button>
      </div>
    </div>

    <!-- 面板内容 -->
    <div class="panel-body">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在加载更新日志...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <span class="error-icon">⚠️</span>
        <p class="error-message">{{ error }}</p>
        <button class="btn-retry" @click="fetchChangelog">重试</button>
      </div>

      <!-- 更新日志内容 -->
      <div v-else class="changelog-content" v-html="renderedContent"></div>
    </div>

    <!-- 面板底部 -->
    <div class="panel-footer">
      <div class="footer-info">
        <span class="update-time" v-if="lastUpdateTime"> 最后更新：{{ formatTime(lastUpdateTime) }} </span>
      </div>
      <div class="footer-actions">
        <a class="btn-github" :href="githubUrl" target="_blank" rel="noopener noreferrer" title="在 GitHub 上查看">
          <span class="github-icon">📂</span>
          <span>GitHub</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// ============ 配置 ============

/** 当前版本号 */
const CURRENT_VERSION = '0.3.0';

/** GitHub 仓库信息 */
const GITHUB_USER = 'CrHouse815';
const GITHUB_REPO = '-MC-_lite-';
const GITHUB_BRANCH = 'main';

/** CHANGELOG.md 文件路径（相对于仓库根目录） */
const CHANGELOG_PATH = 'CHANGELOG.md';

/** jsdelivr CDN 地址 */
const JSDELIVR_BASE_URL = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${GITHUB_BRANCH}`;

/** GitHub 仓库地址 */
const GITHUB_URL = `https://github.com/${GITHUB_USER}/${GITHUB_REPO}`;

// ============ Props & Emits ============

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// ============ 状态 ============

/** 是否正在加载 */
const isLoading = ref(false);

/** 错误信息 */
const error = ref<string | null>(null);

/** 原始 Markdown 内容 */
const rawContent = ref('');

/** 最后更新时间 */
const lastUpdateTime = ref<Date | null>(null);

// ============ 计算属性 ============

/** 当前版本号 */
const currentVersion = computed(() => CURRENT_VERSION);

/** GitHub 地址 */
const githubUrl = computed(() => GITHUB_URL);

/** 渲染后的 HTML 内容 */
const renderedContent = computed(() => {
  if (!rawContent.value) return '';
  return parseMarkdown(rawContent.value);
});

// ============ 方法 ============

/**
 * 从 jsdelivr 获取 CHANGELOG.md
 */
const fetchChangelog = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    // 添加时间戳避免缓存
    const timestamp = Date.now();
    const url = `${JSDELIVR_BASE_URL}/${CHANGELOG_PATH}?t=${timestamp}`;

    console.log('[ChangelogPanel] 正在获取更新日志:', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    rawContent.value = await response.text();
    lastUpdateTime.value = new Date();

    console.log('[ChangelogPanel] 更新日志获取成功, 长度:', rawContent.value.length);
  } catch (err: any) {
    console.error('[ChangelogPanel] 获取更新日志失败:', err);
    error.value = `获取更新日志失败: ${err.message || '网络错误'}`;

    // 如果网络获取失败，尝试显示本地内容
    rawContent.value = getLocalChangelog();
    if (rawContent.value) {
      error.value = null;
      console.log('[ChangelogPanel] 使用本地更新日志');
    }
  } finally {
    isLoading.value = false;
  }
};

/**
 * 获取本地更新日志（作为备用）
 */
const getLocalChangelog = (): string => {
  return `# MClite 更新日志

## v${CURRENT_VERSION} (最新版本)

> 此为本地缓存版本，如需查看最新更新日志，请检查网络连接后重试。

**主要更新**：
- 新增更新日志面板
- 添加版本号显示
- 支持从 GitHub 远程获取更新日志

---

*完整更新日志请访问 [GitHub 仓库](${GITHUB_URL})*
`;
};

/**
 * 简单的 Markdown 解析器（纯字符串处理版本）
 * 不使用正则表达式，避免构建时的兼容性问题
 * 支持标题、列表、粗体、链接等基本语法
 */
const parseMarkdown = (markdown: string): string => {
  // 按行处理
  const lines = markdown.split('\n');
  const result: string[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 处理代码块
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        // 开始代码块
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeBlockContent = [];
      } else {
        // 结束代码块
        inCodeBlock = false;
        const langClass = codeBlockLang ? ' language-' + codeBlockLang : '';
        const escapedCode = escapeHtml(codeBlockContent.join('\n'));
        result.push('<pre class="code-block' + langClass + '"><code>' + escapedCode + '</code></pre>');
        codeBlockLang = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // 转义 HTML（在代码块外）
    line = escapeHtml(line);

    // 处理标题（必须在行首）
    if (line.startsWith('### ')) {
      result.push('<h4 class="md-h4">' + processInlineMarkdown(line.slice(4)) + '</h4>');
      continue;
    }
    if (line.startsWith('## ')) {
      result.push('<h3 class="md-h3">' + processInlineMarkdown(line.slice(3)) + '</h3>');
      continue;
    }
    if (line.startsWith('# ')) {
      result.push('<h2 class="md-h2">' + processInlineMarkdown(line.slice(2)) + '</h2>');
      continue;
    }

    // 处理水平线
    if (line === '---' || line === '----' || line === '-----') {
      result.push('<hr class="md-hr">');
      continue;
    }

    // 处理引用块
    if (line.startsWith('&gt; ')) {
      result.push('<blockquote class="md-quote">' + processInlineMarkdown(line.slice(5)) + '</blockquote>');
      continue;
    }

    // 处理无序列表
    if (line.startsWith('- ')) {
      result.push('<li class="md-li">' + processInlineMarkdown(line.slice(2)) + '</li>');
      continue;
    }

    // 处理有序列表（简单检测：数字.空格）
    const olMatch = matchOrderedList(line);
    if (olMatch) {
      result.push('<li class="md-li-ordered">' + processInlineMarkdown(olMatch) + '</li>');
      continue;
    }

    // 普通行：处理内联 markdown
    if (line.trim()) {
      result.push('<p class="md-p">' + processInlineMarkdown(line) + '</p>');
    } else {
      result.push('');
    }
  }

  // 合并连续的引用块
  let html = result.join('\n');
  html = html.split('</blockquote>\n<blockquote class="md-quote">').join('<br>');

  return html;
};

/**
 * 转义 HTML 特殊字符
 */
const escapeHtml = (text: string): string => {
  return text.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
};

/**
 * 检测有序列表（返回列表内容，否则返回 null）
 */
const matchOrderedList = (line: string): string | null => {
  // 简单检测：1-3位数字 + . + 空格
  for (let i = 1; i <= 3; i++) {
    const prefix = line.slice(0, i);
    if (isAllDigits(prefix) && line.charAt(i) === '.' && line.charAt(i + 1) === ' ') {
      return line.slice(i + 2);
    }
  }
  return null;
};

/**
 * 检查字符串是否全是数字
 */
const isAllDigits = (str: string): boolean => {
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 48 || c > 57) return false; // '0' = 48, '9' = 57
  }
  return str.length > 0;
};

/**
 * 处理内联 Markdown（粗体、斜体、行内代码、链接、版本号）
 * 使用简单的字符串扫描，不使用正则表达式
 */
const processInlineMarkdown = (text: string): string => {
  let result = '';
  let i = 0;

  while (i < text.length) {
    // 检测行内代码 `code`
    if (text.charAt(i) === '`') {
      const endIndex = text.indexOf('`', i + 1);
      if (endIndex > i) {
        const code = text.slice(i + 1, endIndex);
        result += '<code class="inline-code">' + code + '</code>';
        i = endIndex + 1;
        continue;
      }
    }

    // 检测粗体 **text**
    if (text.charAt(i) === '*' && text.charAt(i + 1) === '*') {
      const endIndex = findDoubleAsterisk(text, i + 2);
      if (endIndex > i) {
        const boldText = text.slice(i + 2, endIndex);
        result += '<strong>' + boldText + '</strong>';
        i = endIndex + 2;
        continue;
      }
    }

    // 检测斜体 *text*（单个星号，且不是粗体的一部分）
    if (text.charAt(i) === '*' && text.charAt(i + 1) !== '*') {
      const endIndex = findSingleAsterisk(text, i + 1);
      if (endIndex > i) {
        const italicText = text.slice(i + 1, endIndex);
        result += '<em>' + italicText + '</em>';
        i = endIndex + 1;
        continue;
      }
    }

    // 检测链接 [text](url)
    if (text.charAt(i) === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket > i && text.charAt(closeBracket + 1) === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen > closeBracket) {
          const linkText = text.slice(i + 1, closeBracket);
          const linkUrl = text.slice(closeBracket + 2, closeParen);
          result += '<a href="' + linkUrl + '" target="_blank" rel="noopener">' + linkText + '</a>';
          i = closeParen + 1;
          continue;
        }
      }
    }

    // 检测版本号 v数字.数字.数字
    if (text.charAt(i) === 'v' && isDigit(text.charAt(i + 1))) {
      const versionEnd = findVersionEnd(text, i + 1);
      if (versionEnd > i + 1) {
        const version = text.slice(i, versionEnd);
        // 验证版本号格式（至少 vX.X）
        if (isValidVersion(version)) {
          result += '<span class="version-highlight">' + version + '</span>';
          i = versionEnd;
          continue;
        }
      }
    }

    // 普通字符
    result += text.charAt(i);
    i++;
  }

  return result;
};

/**
 * 查找双星号 ** 的结束位置
 */
const findDoubleAsterisk = (text: string, startIndex: number): number => {
  for (let i = startIndex; i < text.length - 1; i++) {
    if (text.charAt(i) === '*' && text.charAt(i + 1) === '*') {
      return i;
    }
  }
  return -1;
};

/**
 * 查找单星号 * 的结束位置（排除双星号）
 */
const findSingleAsterisk = (text: string, startIndex: number): number => {
  for (let i = startIndex; i < text.length; i++) {
    if (text.charAt(i) === '*' && text.charAt(i + 1) !== '*' && (i === 0 || text.charAt(i - 1) !== '*')) {
      return i;
    }
  }
  return -1;
};

/**
 * 检查字符是否是数字
 */
const isDigit = (char: string): boolean => {
  const c = char.charCodeAt(0);
  return c >= 48 && c <= 57;
};

/**
 * 查找版本号的结束位置
 */
const findVersionEnd = (text: string, startIndex: number): number => {
  let i = startIndex;
  let dotCount = 0;

  while (i < text.length) {
    const c = text.charAt(i);
    if (isDigit(c)) {
      i++;
    } else if (c === '.' && dotCount < 2 && i > startIndex && isDigit(text.charAt(i - 1))) {
      dotCount++;
      i++;
    } else {
      break;
    }
  }

  return i;
};

/**
 * 验证版本号格式（vX.X 或 vX.X.X）
 */
const isValidVersion = (version: string): boolean => {
  // 简单验证：包含至少一个点
  let dotCount = 0;
  for (let i = 0; i < version.length; i++) {
    if (version.charAt(i) === '.') dotCount++;
  }
  return dotCount >= 1;
};

/**
 * 格式化时间
 */
const formatTime = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============ 生命周期 ============

onMounted(() => {
  fetchChangelog();
});
</script>

<style lang="scss" scoped>
.changelog-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  overflow: hidden;
}

// ============ 面板头部 ============
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.header-icon {
  font-size: 20px;
}

.header-title {
  margin: 0;
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--text-color);
}

.version-badge {
  padding: 2px 8px;
  background: var(--primary-color);
  color: white;
  font-size: var(--font-xs);
  font-weight: 600;
  border-radius: var(--radius-sm);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.btn-refresh,
.btn-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 16px;
  color: var(--text-secondary);

  &:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-color);
    border-color: var(--border-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.refresh-icon {
  display: inline-block;
  transition: transform 0.3s ease;

  &.spinning {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// ============ 面板内容 ============
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

// 加载状态
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: var(--spacing-md);
  color: var(--text-secondary);

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  p {
    margin: 0;
    font-size: var(--font-sm);
  }
}

// 错误状态
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: var(--spacing-sm);
  text-align: center;

  .error-icon {
    font-size: 40px;
  }

  .error-message {
    margin: 0;
    color: var(--error-color);
    font-size: var(--font-sm);
  }

  .btn-retry {
    padding: var(--spacing-xs) var(--spacing-md);
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--font-sm);
    transition: background var(--transition-fast);

    &:hover {
      background: var(--primary-hover);
    }
  }
}

// ============ Markdown 内容样式 ============
.changelog-content {
  line-height: 1.6;
  color: var(--text-color);

  :deep(.md-h2) {
    font-size: var(--font-xl);
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 var(--spacing-lg);
    padding-bottom: var(--spacing-sm);
    border-bottom: 2px solid var(--primary-color);
  }

  :deep(.md-h3) {
    font-size: var(--font-lg);
    font-weight: 600;
    color: var(--text-color);
    margin: var(--spacing-lg) 0 var(--spacing-md);
    padding-left: var(--spacing-sm);
    border-left: 3px solid var(--primary-color);
  }

  :deep(.md-h4) {
    font-size: var(--font-md);
    font-weight: 600;
    color: var(--text-secondary);
    margin: var(--spacing-md) 0 var(--spacing-sm);
  }

  :deep(.md-p) {
    margin: var(--spacing-sm) 0;
    font-size: var(--font-sm);
  }

  :deep(.md-quote) {
    margin: var(--spacing-md) 0;
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(99, 102, 241, 0.1);
    border-left: 3px solid var(--primary-color);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    font-size: var(--font-sm);
    color: var(--text-secondary);
  }

  :deep(.md-ul),
  :deep(.md-ol) {
    margin: var(--spacing-sm) 0;
    padding-left: var(--spacing-lg);
  }

  :deep(.md-li),
  :deep(.md-li-ordered) {
    margin: var(--spacing-xs) 0;
    font-size: var(--font-sm);
  }

  :deep(.md-hr) {
    margin: var(--spacing-lg) 0;
    border: none;
    border-top: 1px solid var(--border-color);
  }

  :deep(.code-block) {
    margin: var(--spacing-md) 0;
    padding: var(--spacing-md);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    overflow-x: auto;

    code {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: var(--font-xs);
      line-height: 1.5;
      white-space: pre;
    }
  }

  :deep(.inline-code) {
    padding: 1px 4px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.9em;
    color: var(--primary-color);
  }

  :deep(a) {
    color: var(--primary-color);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(strong) {
    font-weight: 600;
    color: var(--text-color);
  }

  :deep(.version-highlight) {
    padding: 1px 6px;
    background: rgba(99, 102, 241, 0.15);
    color: var(--primary-color);
    border-radius: 3px;
    font-weight: 600;
    font-family: monospace;
  }

  :deep(.emoji-success) {
    color: var(--success-color);
  }

  :deep(.emoji-error) {
    color: var(--error-color);
  }

  :deep(.emoji-warning) {
    color: var(--warning-color);
  }

  :deep(.emoji-alert) {
    color: var(--error-color);
  }
}

// ============ 面板底部 ============
.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.footer-info {
  .update-time {
    font-size: var(--font-xs);
    color: var(--text-muted);
  }
}

.footer-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.btn-github {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  color: var(--text-secondary);
  text-decoration: none;
  transition: all var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-color);
    border-color: var(--border-hover);
  }

  .github-icon {
    font-size: 14px;
  }
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .panel-header {
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .header-title {
    font-size: var(--font-md);
  }

  .panel-body {
    padding: var(--spacing-md);
  }

  .changelog-content {
    :deep(.md-h2) {
      font-size: var(--font-lg);
    }

    :deep(.md-h3) {
      font-size: var(--font-md);
    }

    :deep(.code-block) {
      padding: var(--spacing-sm);

      code {
        font-size: 11px;
      }
    }
  }

  .panel-footer {
    padding: var(--spacing-xs) var(--spacing-md);
  }
}
</style>
