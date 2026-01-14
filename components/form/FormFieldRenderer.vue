<!--
  表单字段渲染器
  根据字段定义动态渲染不同类型的表单控件
-->
<template>
  <div class="form-field" :class="{ 'has-error': error }">
    <label class="field-label">
      {{ field.label }}
      <span v-if="field.required" class="required-mark">*</span>
    </label>

    <!-- 只读字段 -->
    <template v-if="field.inputType === 'readonly'">
      <div class="readonly-value">{{ modelValue || '-' }}</div>
    </template>

    <!-- 文本输入 -->
    <template v-else-if="field.inputType === 'text'">
      <input
        type="text"
        class="text-input"
        :value="modelValue"
        :placeholder="field.placeholder"
        :maxlength="field.maxLength"
        @input="handleInput($event)"
      />
    </template>

    <!-- 多行文本 -->
    <template v-else-if="field.inputType === 'textarea'">
      <textarea
        class="textarea-input"
        :value="modelValue"
        :placeholder="field.placeholder"
        :maxlength="field.maxLength"
        rows="4"
        @input="handleInput($event)"
      ></textarea>
      <div v-if="field.maxLength" class="char-count">
        {{ (modelValue as string)?.length || 0 }} / {{ field.maxLength }}
      </div>
    </template>

    <!-- 数字输入 -->
    <template v-else-if="field.inputType === 'number'">
      <input
        type="number"
        class="number-input"
        :value="modelValue"
        :min="field.min"
        :max="field.max"
        @input="handleNumberInput($event)"
      />
    </template>

    <!-- 日期选择 -->
    <template v-else-if="field.inputType === 'date'">
      <input type="date" class="date-input" :value="modelValue" @input="handleInput($event)" />
    </template>

    <!-- 日期时间选择 -->
    <template v-else-if="field.inputType === 'datetime'">
      <input type="datetime-local" class="datetime-input" :value="modelValue" @input="handleInput($event)" />
    </template>

    <!-- 下拉选择 -->
    <template v-else-if="field.inputType === 'select'">
      <select class="select-input" :value="modelValue" @change="handleSelectChange($event)">
        <option value="">请选择...</option>
        <template v-if="isRosterSelect">
          <option v-for="entry in rosterEntries" :key="entry.id" :value="entry.name">
            {{ entry.name }}
          </option>
        </template>
        <template v-else>
          <option v-for="option in selectOptions" :key="getOptionValue(option)" :value="getOptionValue(option)">
            {{ getOptionLabel(option) }}
          </option>
        </template>
      </select>
    </template>

    <!-- 单选按钮组 -->
    <template v-else-if="field.inputType === 'radio'">
      <div class="radio-group">
        <label v-for="option in selectOptions" :key="getOptionValue(option)" class="radio-option">
          <input
            type="radio"
            :name="field.fieldId"
            :value="getOptionValue(option)"
            :checked="modelValue === getOptionValue(option)"
            @change="handleRadioChange(getOptionValue(option))"
          />
          <span class="radio-label">{{ getOptionLabel(option) }}</span>
        </label>
      </div>
    </template>

    <!-- 复选框 -->
    <template v-else-if="field.inputType === 'checkbox'">
      <label class="checkbox-option">
        <input type="checkbox" :checked="modelValue === true" @change="handleCheckboxChange($event)" />
        <span class="checkbox-label">{{ field.checkboxLabel || field.label }}</span>
      </label>
    </template>

    <!-- 表格输入 -->
    <template v-else-if="field.inputType === 'table'">
      <div class="table-input">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="col in field.columns" :key="col.key">
                {{ col.label }}
                <span v-if="col.required" class="required-mark">*</span>
              </th>
              <th class="action-col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in tableRows" :key="index">
              <td v-for="col in field.columns" :key="col.key">
                <input
                  v-if="col.type === 'text' || col.type === 'number'"
                  :type="col.type"
                  class="table-cell-input"
                  :value="row[col.key]"
                  :min="col.min"
                  :max="col.max"
                  @input="handleTableCellInput(index, col.key, $event)"
                />
                <select
                  v-else-if="col.type === 'select'"
                  class="table-cell-select"
                  :value="row[col.key]"
                  @change="handleTableCellSelect(index, col.key, $event)"
                >
                  <option value="">-</option>
                  <option v-for="opt in col.options" :key="opt" :value="opt">
                    {{ opt }}
                  </option>
                </select>
              </td>
              <td class="action-col">
                <button
                  v-if="tableRows.length > (field.minRows || 1)"
                  class="remove-row-btn"
                  title="删除行"
                  @click="removeTableRow(index)"
                >
                  ✕
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <button v-if="tableRows.length < (field.maxRows || 10)" class="add-row-btn" @click="addTableRow">
          + 添加行
        </button>
      </div>
    </template>

    <!-- 帮助文本 -->
    <div v-if="field.helpText" class="help-text">{{ field.helpText }}</div>

    <!-- 错误信息 -->
    <div v-if="error" class="error-text">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { FormFieldDef, FormFieldOption } from '../../types/form';
import { useFormStore } from '../../stores/formStore';

interface Props {
  field: FormFieldDef;
  value?: unknown;
  error?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update', fieldId: string, value: unknown): void;
}>();

const formStore = useFormStore();

/** 模型值 */
const modelValue = computed(() => props.value);

/** 是否为花名册选择器 */
const isRosterSelect = computed(() => props.field.sourceType === 'roster');

/** 花名册条目 */
const rosterEntries = computed(() => {
  if (isRosterSelect.value && props.field.sourcePath) {
    return formStore.getRosterEntries(props.field.sourcePath);
  }
  return [];
});

/** 选项列表 */
const selectOptions = computed(() => props.field.options || []);

/** 表格行数据 */
const tableRows = ref<Array<Record<string, unknown>>>([{}]);

// 初始化表格数据
watch(
  () => props.value,
  newValue => {
    if (props.field.inputType === 'table' && Array.isArray(newValue)) {
      tableRows.value = newValue.length > 0 ? [...newValue] : [{}];
    }
  },
  { immediate: true },
);

/** 获取选项值 */
const getOptionValue = (option: string | FormFieldOption): string => {
  if (typeof option === 'string') return option;
  return option.value;
};

/** 获取选项标签 */
const getOptionLabel = (option: string | FormFieldOption): string => {
  if (typeof option === 'string') return option;
  return option.label;
};

/** 处理文本输入 */
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  emit('update', props.field.fieldId, target.value);
};

/** 处理数字输入 */
const handleNumberInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = target.value ? Number(target.value) : undefined;
  emit('update', props.field.fieldId, value);
};

/** 处理选择框变化 */
const handleSelectChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  emit('update', props.field.fieldId, target.value);
};

/** 处理单选按钮变化 */
const handleRadioChange = (value: string) => {
  emit('update', props.field.fieldId, value);
};

/** 处理复选框变化 */
const handleCheckboxChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update', props.field.fieldId, target.checked);
};

/** 处理表格单元格输入 */
const handleTableCellInput = (rowIndex: number, colKey: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  const newRows = [...tableRows.value];
  newRows[rowIndex] = { ...newRows[rowIndex], [colKey]: target.value };
  tableRows.value = newRows;
  emit('update', props.field.fieldId, newRows);
};

/** 处理表格单元格选择 */
const handleTableCellSelect = (rowIndex: number, colKey: string, event: Event) => {
  const target = event.target as HTMLSelectElement;
  const newRows = [...tableRows.value];
  newRows[rowIndex] = { ...newRows[rowIndex], [colKey]: target.value };
  tableRows.value = newRows;
  emit('update', props.field.fieldId, newRows);
};

/** 添加表格行 */
const addTableRow = () => {
  tableRows.value = [...tableRows.value, {}];
  emit('update', props.field.fieldId, tableRows.value);
};

/** 删除表格行 */
const removeTableRow = (index: number) => {
  const newRows = tableRows.value.filter((_, i) => i !== index);
  tableRows.value = newRows;
  emit('update', props.field.fieldId, newRows);
};
</script>

<style lang="scss" scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &.has-error {
    .text-input,
    .textarea-input,
    .number-input,
    .date-input,
    .datetime-input,
    .select-input {
      border-color: var(--error-color, #ef4444);
    }
  }
}

.field-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);

  .required-mark {
    color: var(--error-color, #ef4444);
    margin-left: 2px;
  }
}

// ========== 只读字段 ==========
.readonly-value {
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 14px;
}

// ========== 基础输入框 ==========
.text-input,
.textarea-input,
.number-input,
.date-input,
.datetime-input,
.select-input {
  padding: 10px 12px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-color);
  font-size: 14px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
  }

  &::placeholder {
    color: var(--text-disabled);
  }
}

.textarea-input {
  resize: vertical;
  min-height: 100px;
}

.number-input {
  width: 150px;
}

.char-count {
  font-size: 12px;
  color: var(--text-disabled);
  text-align: right;
}

// ========== 单选/复选框 ==========
.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.radio-option,
.checkbox-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  input[type='radio'],
  input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--primary-color);
  }

  .radio-label,
  .checkbox-label {
    font-size: 14px;
    color: var(--text-color);
  }
}

// ========== 表格输入 ==========
.table-input {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }

  th {
    background: var(--bg-tertiary);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);

    .required-mark {
      color: var(--error-color, #ef4444);
    }
  }

  td {
    background: var(--bg-color);
  }

  .action-col {
    width: 60px;
    text-align: center;
  }
}

.table-cell-input,
.table-cell-select {
  width: 100%;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-color);
  font-size: 13px;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
}

.remove-row-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--error-light, rgba(239, 68, 68, 0.1));
  border: none;
  border-radius: 4px;
  color: var(--error-color, #ef4444);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &:hover {
    background: var(--error-color, #ef4444);
    color: white;
  }
}

.add-row-btn {
  width: 100%;
  padding: 10px;
  background: var(--bg-tertiary);
  border: none;
  border-top: 1px solid var(--border-color);
  color: var(--primary-color);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-hover);
  }
}

// ========== 帮助和错误文本 ==========
.help-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.error-text {
  font-size: 12px;
  color: var(--error-color, #ef4444);
}
</style>
