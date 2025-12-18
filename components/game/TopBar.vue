<!--
  MClite - 顶部状态栏组件
  职场模拟游戏 - 显示玩家信息、游戏时间、地点和系统菜单
  重新设计的响应式布局，确保横竖屏都能稳定显示
-->
<template>
  <header class="top-bar">
    <!-- 左侧：玩家信息 -->
    <div class="top-bar-left">
      <!-- 玩家信息卡片 -->
      <div class="player-card">
        <div class="player-avatar">
          <span class="avatar-icon">👤</span>
        </div>
        <div class="player-info">
          <span class="player-name">{{ displayPlayerName }}</span>
          <span class="player-role">{{ displayPlayerRole }}</span>
        </div>
      </div>
    </div>

    <!-- 中间：游戏状态（日期时间 + 地点） -->
    <div class="top-bar-center">
      <!-- 日期时间组合显示 -->
      <div class="datetime-group">
        <div class="date-item">
          <span class="item-icon">📅</span>
          <span class="item-value">{{ displayDate }}</span>
        </div>
        <div class="time-item">
          <span class="period-badge" :class="periodClass">{{ displayPeriod }}</span>
        </div>
      </div>

      <!-- 地点显示 -->
      <div class="location-item">
        <span class="item-icon">📍</span>
        <span class="item-value location-text">{{ displayLocation }}</span>
      </div>
    </div>

    <!-- 右侧：状态指示 + 功能按钮 -->
    <div class="top-bar-right">
      <!-- 连接状态指示器 -->
      <div class="connection-indicator" :class="connectionStatus" :title="statusText">
        <span class="status-dot"></span>
      </div>

      <!-- 功能按钮组 -->
      <div class="action-buttons">
        <button
          class="action-btn"
          :title="isDarkTheme ? '切换到浅色模式' : '切换到深色模式'"
          @click="$emit('toggle-theme')"
        >
          <span class="btn-icon">{{ isDarkTheme ? '☀️' : '🌙' }}</span>
        </button>
        <button class="action-btn" :title="isFullscreen ? '退出全屏' : '全屏显示'" @click="$emit('toggle-fullscreen')">
          <span class="btn-icon">{{ isFullscreen ? '⬜' : '⛶' }}</span>
        </button>
      </div>
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
  /** 游戏时间（从MVU变量读取，24小时制HH:MM格式，如"09:30"、"14:00"） */
  gamePeriod?: string;
  /** 当前地点（从MVU变量读取，如"行动一科办公室"） */
  gameLocation?: string;
  /** 玩家姓名（从MVU变量读取） */
  playerName?: string;
  /** 玩家职位（从MVU变量读取） */
  playerPosition?: string;
  /** 玩家部门（从MVU变量读取） */
  playerDepartment?: string;
}

const props = withDefaults(defineProps<Props>(), {
  connectionStatus: 'connected',
  isFullscreen: false,
  isDarkTheme: false,
  gameDate: '',
  gamePeriod: '',
  gameLocation: '',
  playerName: '',
  playerPosition: '',
  playerDepartment: '',
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

/** 显示的玩家名称 */
const displayPlayerName = computed(() => {
  return props.playerName || '未登录';
});

/** 显示的玩家角色（职位 + 部门） */
const displayPlayerRole = computed(() => {
  if (props.playerPosition && props.playerDepartment) {
    return `${props.playerDepartment}·${props.playerPosition}`;
  }
  if (props.playerPosition) {
    return props.playerPosition;
  }
  if (props.playerDepartment) {
    return props.playerDepartment;
  }
  return '等待分配';
});

/** 显示的日期（如果没有后台数据则显示默认值） */
const displayDate = computed(() => {
  return props.gameDate || '等待数据...';
});

/** 显示的时间（如果没有后台数据则显示默认值，24小时制HH:MM格式） */
const displayPeriod = computed(() => {
  return props.gamePeriod || '--:--';
});

/** 显示的地点（如果没有后台数据则显示默认值） */
const displayLocation = computed(() => {
  return props.gameLocation || '未知地点';
});

/** 时段样式类 - 根据24小时制时间动态设置 */
const periodClass = computed(() => {
  const timeStr = props.gamePeriod || '';
  // 解析HH:MM格式的时间
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 'period-default';

  const hour = parseInt(match[1], 10);

  // 根据小时判断时段
  if (hour >= 6 && hour < 12) return 'period-morning'; // 06:00-11:59 上午
  if (hour >= 12 && hour < 14) return 'period-noon'; // 12:00-13:59 午休
  if (hour >= 14 && hour < 18) return 'period-afternoon'; // 14:00-17:59 下午
  if (hour >= 18 && hour < 21) return 'period-evening'; // 18:00-20:59 傍晚
  // 21:00-05:59 夜间/加班
  return 'period-night';
});
</script>

<style lang="scss" scoped>
// ============ 顶部栏容器 ============
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  height: 50px;
  padding: 0 var(--spacing-md);
  background: var(--office-header);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  position: relative;
  z-index: 100;
}

// ============ 左侧区域：玩家信息 ============
.top-bar-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  flex-shrink: 0;
}

// 玩家信息卡片
.player-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-sm);
  min-width: 0;
  flex: 1;
  max-width: 180px;
}

.player-avatar {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(99, 102, 241, 0.3);
  border-radius: 50%;

  .avatar-icon {
    font-size: 13px;
  }
}

.player-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.15;
}

.player-name {
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-role {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// ============ 中间区域：游戏状态 ============
.top-bar-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
}

// 日期时间组
.datetime-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.date-item,
.time-item,
.location-item {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-xs);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.item-icon {
  font-size: 11px;
  flex-shrink: 0;
}

.item-value {
  font-size: 11px;
  font-weight: 500;
  color: #ffffff;
  white-space: nowrap;
}

.location-text {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

// 时段徽章
.period-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  font-family: monospace;
  letter-spacing: 0.3px;

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

// ============ 右侧区域：状态 + 按钮 ============
.top-bar-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

// 连接状态指示器（仅显示小点）
.connection-indicator {
  padding: 4px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transition: background-color var(--transition-normal);
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

// 功能按钮组
.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);

  .btn-icon {
    font-size: 15px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.25);
  }

  &:active {
    transform: scale(0.95);
  }
}

// ============ 响应式：平板横屏 (768px - 1024px) ============
@media (max-width: 1024px) {
  .top-bar {
    gap: var(--spacing-xs);
  }

  .player-card {
    max-width: 150px;
  }

  .location-text {
    max-width: 100px;
  }
}

// ============ 响应式：平板竖屏 (480px - 768px) ============
@media (max-width: 768px) {
  .top-bar {
    height: 46px;
    padding: 0 var(--spacing-sm);
    gap: 6px;
  }

  // 左侧：简化玩家信息
  .top-bar-left {
    gap: 4px;
  }

  .player-card {
    max-width: 120px;
    padding: 3px 6px;
  }

  .player-avatar {
    width: 22px;
    height: 22px;

    .avatar-icon {
      font-size: 11px;
    }
  }

  .player-name {
    font-size: 11px;
  }

  .player-role {
    font-size: 8px;
  }

  // 中间：简化日期时间
  .top-bar-center {
    gap: 4px;
    justify-content: flex-start;
  }

  .datetime-group {
    gap: 3px;
  }

  .date-item,
  .time-item {
    padding: 2px 4px;
  }

  .item-icon {
    font-size: 10px;
  }

  .item-value {
    font-size: 10px;
  }

  .period-badge {
    font-size: 9px;
    padding: 2px 4px;
  }

  .location-item {
    display: none; // 平板竖屏隐藏地点
  }

  // 右侧：保持按钮
  .connection-indicator {
    padding: 2px;

    .status-dot {
      width: 6px;
      height: 6px;
    }
  }

  .action-btn {
    width: 30px;
    height: 30px;

    .btn-icon {
      font-size: 13px;
    }
  }
}

// ============ 响应式：手机竖屏 (< 480px) ============
@media (max-width: 480px) {
  .top-bar {
    height: 42px;
    padding: 0 6px;
    grid-template-columns: auto 1fr auto;
    gap: 4px;
  }

  // 左侧：只显示头像和名字
  .player-card {
    max-width: 100px;
    padding: 2px 4px;
    gap: 4px;
  }

  .player-avatar {
    width: 20px;
    height: 20px;

    .avatar-icon {
      font-size: 10px;
    }
  }

  .player-info {
    display: flex;
    flex-direction: column;
  }

  .player-name {
    font-size: 10px;
  }

  .player-role {
    display: none; // 手机竖屏隐藏角色信息
  }

  // 中间：只显示时间
  .top-bar-center {
    justify-content: center;
  }

  .datetime-group {
    gap: 2px;
  }

  .date-item {
    display: none; // 手机竖屏隐藏日期，只显示时间
  }

  .time-item {
    padding: 2px 4px;
  }

  .period-badge {
    font-size: 9px;
    padding: 2px 5px;
  }

  // 右侧：紧凑按钮
  .action-buttons {
    gap: 2px;
  }

  .action-btn {
    width: 28px;
    height: 28px;

    .btn-icon {
      font-size: 12px;
    }
  }
}

// ============ 响应式：极小屏幕 (< 360px) ============
@media (max-width: 360px) {
  .top-bar {
    height: 38px;
    padding: 0 4px;
    gap: 2px;
  }

  .player-card {
    max-width: 80px;
    padding: 2px 3px;
  }

  .player-avatar {
    width: 18px;
    height: 18px;

    .avatar-icon {
      font-size: 9px;
    }
  }

  .player-name {
    font-size: 9px;
  }

  .period-badge {
    font-size: 8px;
    padding: 1px 3px;
  }

  .connection-indicator {
    display: none; // 极小屏隐藏连接状态
  }

  .action-btn {
    width: 26px;
    height: 26px;

    .btn-icon {
      font-size: 11px;
    }
  }
}
</style>
