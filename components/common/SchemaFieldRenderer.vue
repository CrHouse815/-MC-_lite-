<!--
  Schema 字段渲染器
  根据 field.type 自动选择渲染方式
  支持夜间模式适配
-->
<template>
  <div class="schema-field" :class="`field-type-${field.type}`">
    <span class="field-label">{{ field.label }}</span>
    <div class="field-value">
      <!-- string / number -->
      <template v-if="field.type === 'string' || field.type === 'number'">
        <span class="value-text">{{ displayValue }}</span>
      </template>

      <!-- text (多行文本) -->
      <template v-else-if="field.type === 'text'">
        <p class="text-content">{{ displayValue }}</p>
      </template>

      <!-- enum (枚举) -->
      <template v-else-if="field.type === 'enum'">
        <span class="enum-badge">{{ displayValue }}</span>
      </template>

      <!-- tags (标签数组) -->
      <template v-else-if="field.type === 'tags'">
        <div class="tags-container">
          <span v-for="(tag, idx) in tagValues" :key="idx" class="tag">{{ tag }}</span>
          <span v-if="tagValues.length === 0" class="empty-tags">无</span>
        </div>
      </template>

      <!-- boolean -->
      <template v-else-if="field.type === 'boolean'">
        <span class="boolean-value" :class="value ? 'is-true' : 'is-false'">
          <span class="boolean-icon">{{ value ? '✓' : '✗' }}</span>
          {{ value ? '是' : '否' }}
        </span>
      </template>

      <!-- 未知类型 -->
      <template v-else>
        <span class="value-text">{{ displayValue }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FieldDefinition } from '../../types/roster';

const props = defineProps<{
  field: FieldDefinition;
  value: unknown;
}>();

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined) return '-';
  if (typeof props.value === 'object') return JSON.stringify(props.value);
  return String(props.value);
});

const tagValues = computed(() => {
  if (!Array.isArray(props.value)) return [];
  return props.value.map(String);
});
</script>

<style lang="scss" scoped>
.schema-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-secondary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.field-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.field-value {
  font-size: 14px;
  color: var(--text-color);
  line-height: 1.4;
}

.value-text {
  word-break: break-word;
}

.text-content {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.6;
}

.enum-badge {
  display: inline-block;
  padding: 3px 10px;
  background: var(--primary-light);
  color: var(--primary-color);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  display: inline-block;
  padding: 3px 10px;
  background: var(--bg-tertiary);
  color: var(--text-color);
  border-radius: 12px;
  font-size: 12px;
  border: 1px solid var(--border-color);
}

.empty-tags {
  color: var(--text-disabled);
  font-style: italic;
  font-size: 13px;
}

.boolean-value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;

  .boolean-icon {
    font-size: 12px;
  }

  &.is-true {
    background: var(--success-light);
    color: var(--success-color);
  }

  &.is-false {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }
}

// ========== 字段类型特殊样式 ==========
.field-type-text {
  .field-value {
    font-size: 13px;
  }
}

.field-type-number {
  .value-text {
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-weight: 500;
  }
}
</style>
