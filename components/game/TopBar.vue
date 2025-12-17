<!--
  MClite - 顶部状态栏组件
  职场模拟游戏 - 显示游戏时间、地点和系统菜单
  从后台MVU变量读取时间和地点信息
-->
<template>
  <header class="top-bar">
    <!-- 左侧：游戏状态信息 -->
    <div class="top-bar-left">
      <!-- 日期显示 -->
      <div class="status-item date-display">
        <span class="status-icon">📅</span>
        <span class="status-value">{{ displayDate }}</span>
      </div>

      <!-- 时段显示 -->
      <div class="status-item period-display">
        <span class="status-icon">🕐</span>
        <span class="period-badge" :class="periodClass">{{ displayPeriod }}</span>
      </div>

      <!-- 地点显示 -->
      <div class="status-item location-display">
        <span class="status-icon">📍</span>
        <span class="status-value location-value">{{ displayLocation }}</span>
      </div>

      <!-- 连接状态 -->
      <div class="status-item connection-status" :class="connectionStatus">
        <span class="status-dot"></span>
        <span class="status-text">{{ statusText }}</span>
      </div>
    </div>

    <!-- 中间：版本号（仅显示，不可点击） -->
    <div class="top-bar-center">
      <div class="version-info">
        <span class="version-text">MClite</span>
        <span class="version-number">v0.3.0</span>
      </div>
    </div>

    <!-- 右侧：主题切换 + 全屏按钮 -->
    <div class="top-bar-right">
      <button
        class="tool-btn theme-btn"
        :title="isDarkTheme ? '切换到浅色模式' : '切换到深色模式'"
        @click="$emit('toggle-theme')"
      >
        <span class="btn-icon">{{ isDarkTheme ? '☀️' : '🌙' }}</span>
      </button>
      <button class="tool-btn" :title="isFullscreen ? '退出全屏' : '全屏显示'" @click="$emit('toggle-fullscreen')">
        <span class="btn-icon">{{ isFullscreen ? '⬜' : '⛶' }}</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// ============ Props ============
interface Props {
  /** 连接状态 */
  connectionStatus?: 'connected' | 'connecting' | 'disconnected';
  /** 是否全屏 */
  isFullscreen?: boolean;
  /** 是否深色主题 */
  isDarkTheme?: boolean;
  /** 游戏日期（从MVU变量读取，格式如"2024年3月15日"） */
  gameDate?: string;
  /** 游戏时段（从MVU变量读取，如"上午"、"午休"、"下午"、"加班时间"） */
  gamePeriod?: string;
  /** 当前地点（从MVU变量读取，如"行动一科办公室"） */
  gameLocation?: string;
}

const props = withDefaults(defineProps<Props>(), {
  connectionStatus: 'connected',
  isFullscreen: false,
  isDarkTheme: false,
  gameDate: '',
  gamePeriod: '',
  gameLocation: '',
});

// ============ Emits ============
defineEmits<{
  (e: 'toggle-fullscreen'): void;
  (e: 'toggle-theme'): void;
}>();

// ============ 计算属性 ============

/** 状态文本 */
const statusText = computed(() => {
  switch (props.connectionStatus) {
    case 'connected':
      return '在线';
    case 'connecting':
      return '连接中...';
    case 'disconnected':
      return '离线';
    default:
      return '未知';
  }
});

/** 显示的日期（如果没有后台数据则显示默认值） */
const displayDate = computed(() => {
  return props.gameDate || '等待数据...';
});

/** 显示的时段（如果没有后台数据则显示默认值） */
const displayPeriod = computed(() => {
  return props.gamePeriod || '---';
});

/** 显示的地点（如果没有后台数据则显示默认值） */
const displayLocation = computed(() => {
  return props.gameLocation || '未知地点';
});

/** 时段样式类 - 根据时段文本动态设置 */
const periodClass = computed(() => {
  const period = props.gamePeriod || '';
  if (period.includes('上午') || period.includes('早')) return 'period-morning';
  if (period.includes('午休') || period.includes('中午')) return 'period-noon';
  if (period.includes('下午')) return 'period-afternoon';
  if (period.includes('傍晚') || period.includes('晚')) return 'period-evening';
  if (period.includes('加班') || period.includes('夜') || period.includes('深夜')) return 'period-night';
  return 'period-default';
});
</script>

<style lang="scss" scoped>
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 var(--spacing-md);
  background: var(--office-header);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  position: relative;
  z-index: 100;
}

// ============ 左侧区域 ============
.top-bar-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

// ============ 通用状态项样式 ============
.status-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .status-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .status-value {
    font-size: var(--font-sm);
    font-weight: 500;
    color: #ffffff;
    white-space: nowrap;
  }
}

// ============ 日期显示 ============
.date-display {
  min-width: 110px;
}

// ============ 时段显示 ============
.period-display {
  min-width: 70px;
}

.period-badge {
  padding: 3px 10px;
  border-radius: var(--radius-xs);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;

  &.period-morning {
    background: rgba(255, 193, 7, 0.25);
    color: #ffc107;
    box-shadow: inset 0 0 0 1px rgba(255, 193, 7, 0.3);
  }

  &.period-noon {
    background: rgba(255, 152, 0, 0.25);
    color: #ff9800;
    box-shadow: inset 0 0 0 1px rgba(255, 152, 0, 0.3);
  }

  &.period-afternoon {
    background: rgba(255, 87, 34, 0.25);
    color: #ff7043;
    box-shadow: inset 0 0 0 1px rgba(255, 87, 34, 0.3);
  }

  &.period-evening {
    background: rgba(156, 39, 176, 0.25);
    color: #ce93d8;
    box-shadow: inset 0 0 0 1px rgba(156, 39, 176, 0.3);
  }

  &.period-night {
    background: rgba(63, 81, 181, 0.25);
    color: #9fa8da;
    box-shadow: inset 0 0 0 1px rgba(63, 81, 181, 0.3);
  }

  &.period-default {
    background: rgba(158, 158, 158, 0.25);
    color: #bdbdbd;
    box-shadow: inset 0 0 0 1px rgba(158, 158, 158, 0.3);
  }
}

// ============ 地点显示 ============
.location-display {
  max-width: 180px;

  .location-value {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// ============ 连接状态 ============
.connection-status {
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transition: background-color var(--transition-normal);
  }

  .status-text {
    font-size: var(--font-xs);
    color: rgba(255, 255, 255, 0.8);
  }

  &.connected .status-dot {
    background: var(--success-color);
    box-shadow: 0 0 6px var(--success-color);
  }

  &.connecting .status-dot {
    background: var(--warning-color);
    animation: pulse 1.5s ease-in-out infinite;
  }

  &.disconnected .status-dot {
    background: var(--error-color);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

// ============ 中间区域 ============
.top-bar-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.version-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: var(--radius-sm);

  .version-text {
    font-size: var(--font-sm);
    font-weight: 600;
    color: #ffffff;
    letter-spacing: 0.5px;
  }

  .version-number {
    font-size: var(--font-xs);
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    padding: 1px 6px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    font-family: monospace;
  }
}

// ============ 右侧区域 ============
.top-bar-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);

  .btn-icon {
    font-size: 18px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.25);
  }

  &:active {
    transform: scale(0.95);
  }

  &.theme-btn {
    .btn-icon {
      font-size: 16px;
    }
  }
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .top-bar {
    height: 48px;
    padding: 0 var(--spacing-sm);
  }

  .top-bar-left {
    gap: 4px;
    flex: 1;
    min-width: 0; // 允许收缩
    overflow: hidden;
  }

  .status-item {
    padding: 4px 8px;
    flex-shrink: 1;
    min-width: 0;

    .status-icon {
      font-size: 12px;
    }

    .status-value {
      font-size: var(--font-xs);
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .date-display {
    min-width: auto;
    flex-shrink: 1;
  }

  .period-display {
    min-width: auto;
    flex-shrink: 1;
  }

  .period-badge {
    font-size: 10px;
    padding: 2px 6px;
  }

  .location-display {
    max-width: 100px;
    // 平板竖屏时隐藏地点
    display: none;
  }

  .connection-status {
    display: none;
  }

  .top-bar-center {
    flex: 0 0 auto; // 不要自动扩展
  }

  .top-bar-right {
    flex-shrink: 0; // 确保右侧按钮不会被压缩
  }

  .tool-btn {
    width: 36px;
    height: 36px;
    flex-shrink: 0;

    .btn-icon {
      font-size: 16px;
    }
  }

  .version-info {
    padding: 3px 6px;
    gap: 3px;

    .version-text {
      font-size: var(--font-xs);
    }

    .version-number {
      font-size: 10px;
      padding: 1px 4px;
    }
  }
}

// ============ 超小屏幕响应式（手机竖屏） ============
@media (max-width: 480px) {
  .top-bar {
    height: 44px;
    padding: 0 var(--spacing-xs);
  }

  .top-bar-left {
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .status-item {
    padding: 2px 4px;

    .status-icon {
      font-size: 10px;
    }

    .status-value {
      font-size: 10px;
    }
  }

  // 超小屏只显示日期和时段
  .date-display {
    flex-shrink: 1;
    min-width: 0;

    .status-value {
      max-width: 70px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .period-display {
    flex-shrink: 0;
  }

  .period-badge {
    font-size: 9px;
    padding: 2px 4px;
  }

  .location-display {
    display: none;
  }

  .top-bar-center {
    // 超小屏隐藏版本信息，腾出空间给按钮
    display: none;
  }

  .top-bar-right {
    flex-shrink: 0;
    gap: 4px;
  }

  .tool-btn {
    width: 32px;
    height: 32px;

    .btn-icon {
      font-size: 14px;
    }
  }
}

// ============ 极小屏幕响应式（<360px） ============
@media (max-width: 360px) {
  .top-bar {
    height: 40px;
    padding: 0 4px;
  }

  .top-bar-left {
    gap: 2px;
  }

  .status-item {
    padding: 2px 3px;

    .status-icon {
      font-size: 9px;
    }

    .status-value {
      font-size: 9px;
    }
  }

  .date-display {
    .status-value {
      max-width: 60px;
    }
  }

  .period-badge {
    font-size: 8px;
    padding: 1px 3px;
  }

  .tool-btn {
    width: 28px;
    height: 28px;

    .btn-icon {
      font-size: 12px;
    }
  }
}
</style>
