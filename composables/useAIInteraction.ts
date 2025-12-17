/**
 * MC房子 - AI交互处理 Composable
 * 参考归墟Plus的AI交互逻辑实现
 * 只显示当前AI回复内容，而非消息列表模式
 * 集成上下文管理系统，自动提取和追加历史记录
 * 集成自动存档系统，AI回复结束后自动存档
 *
 * 变量注入方式：主动注入（不依赖酒馆宏解析）
 * 参考归墟的实现，在发送消息时直接将变量数据序列化后注入到prompt中
 */

import { computed, onMounted, onUnmounted, ref } from 'vue';
import { contextManagerService } from '../services/ContextManagerService';
import { saveService, type AIContentData } from '../services/SaveService';
import { useAppStore } from '../stores/appStore';
import { useMvuStore } from '../stores/mvuStore';

/**
 * 变量变化记录
 */
export interface VariableChange {
  path: string;
  oldValue?: any;
  newValue: any;
  comment?: string;
}

/**
 * AI响应格式验证结果
 */
export interface ResponseValidation {
  /** 是否有效（所有必需标签都存在） */
  isValid: boolean;
  /** 是否包含gametxt标签 */
  hasGameText: boolean;
  /** 是否包含UpdateVariable标签 */
  hasUpdateVariable: boolean;
  /** 是否包含历史记录标签 */
  hasHistoryRecord: boolean;
  /** 缺失的标签列表 */
  missingTags: string[];
}

/**
 * AI交互Composable
 * 提供完整的AI交互功能：发送消息、接收回复、解析变量更新
 */
export function useAIInteraction() {
  // ========== 状态 ==========

  /** 当前显示的内容 */
  const currentContent = ref('');

  /** 上一次AI回复的完整原始文本（用于注入到下一次请求的上下文） */
  const lastAIResponse = ref('');

  /** 所有swipe选项 */
  const swipes = ref<string[]>([]);

  /** 当前swipe索引 */
  const currentSwipeIndex = ref(0);

  /** AI处理状态 */
  const isProcessing = ref(false);

  /** 是否正在流式传输 */
  const isStreaming = ref(false);

  /** 错误信息 */
  const error = ref<string | null>(null);

  /** 最后更新时间 */
  const lastUpdateTime = ref('');

  /** 变量变化列表 */
  const variableChanges = ref<VariableChange[]>([]);

  /** 最后的用户输入（用于重新生成） */
  const lastUserInput = ref('');

  /** 自动存档状态 */
  const autoSaveStatus = ref<'idle' | 'saving' | 'success' | 'error'>('idle');

  /** 最后一次自动存档的名称 */
  const lastAutoSaveName = ref<string | null>(null);

  // MVU拦截器已禁用
  /** MVU拦截器是否启用（已禁用，保持为false） */
  const isMvuInterceptorEnabled = ref(false);

  /** 当前过滤预设（已禁用） */
  const currentFilterPreset = ref<string>('standard');

  // ========== 事件监听器引用 ==========

  /** 流式传输处理函数 */
  let streamingHandler: ((text: string, id: string) => void) | null = null;

  /** 生成结束处理函数 */
  let streamEndHandler: ((text: string, id: string) => void) | null = null;

  /** 监听器绑定标记（防泄漏机制） */
  let listenersAttached = false;

  // ========== 计算属性 ==========

  /** 是否有内容 */
  const hasContent = computed(() => !!currentContent.value);

  /** 是否有多个swipe */
  const hasMultipleSwipes = computed(() => swipes.value.length > 1);

  // ========== 工具函数 ==========

  /**
   * 获取当前时间字符串
   */
  const getCurrentTime = (): string => {
    return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // ========== 文本提取函数 ==========

  /**
   * 提取gametxt标签内容
   * 这是显示给用户的主要文本内容
   */
  const extractGameText = (text: string): string => {
    if (!text || typeof text !== 'string') return '';

    // 提取 <gametxt> 的内容
    const regex = /<gametxt>([\s\S]*?)<\/gametxt>/gi;
    const matches = [...text.matchAll(regex)];

    if (matches.length > 0) {
      // 返回最后一个匹配项的内容
      const content = matches[matches.length - 1][1].trim();
      // 移除HTML注释
      return content.replace(/<!--[\s\S]*?-->/g, '').trim();
    }

    // 如果没有gametxt标签，返回原始文本（可能是普通对话）
    return text;
  };

  /**
   * 提取UpdateVariable标签内容
   */
  const extractUpdateVariableContent = (text: string): string | null => {
    if (!text || typeof text !== 'string') return null;

    const regex = /<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/gi;
    const matches = [...text.matchAll(regex)];

    if (matches.length > 0) {
      return matches[matches.length - 1][1].trim();
    }

    return null;
  };

  // ========== AI响应格式验证 ==========

  /**
   * 验证AI响应格式
   * 参考归墟的 validateResponseFormat() 实现
   * @param text AI响应文本
   * @param requiredTags 必需的标签列表（默认只要求gametxt）
   */
  const validateResponseFormat = (text: string, requiredTags: string[] = ['gametxt']): ResponseValidation => {
    const result: ResponseValidation = {
      isValid: true,
      hasGameText: /<gametxt>[\s\S]*?<\/gametxt>/i.test(text),
      hasUpdateVariable: /<UpdateVariable>[\s\S]*?<\/UpdateVariable>/i.test(text),
      hasHistoryRecord: /<历史记录>[\s\S]*?<\/历史记录>/i.test(text),
      missingTags: [],
    };

    // 检查必需标签
    if (requiredTags.includes('gametxt') && !result.hasGameText) {
      result.missingTags.push('gametxt');
    }
    if (requiredTags.includes('UpdateVariable') && !result.hasUpdateVariable) {
      result.missingTags.push('UpdateVariable');
    }
    if (requiredTags.includes('历史记录') && !result.hasHistoryRecord) {
      result.missingTags.push('历史记录');
    }

    result.isValid = result.missingTags.length === 0;

    return result;
  };

  // ========== 流式传输处理 ==========

  /**
   * 处理流式文本更新
   */
  const handleStreamingText = (text: string, _generationId: string): void => {
    if (!text) return;

    console.log('[useAIInteraction] 收到流式文本，长度:', text.length);

    // 提取显示文本
    const displayText = extractGameText(text);
    if (!displayText) return;

    // 更新当前内容
    isStreaming.value = true;
    isProcessing.value = false; // 开始显示内容后关闭"思考中"状态
    currentContent.value = displayText;
  };

  /**
   * 处理AI生成结束
   * 关键修复：保存完整的AI回复内容，用于注入到下一次请求的上下文
   * 增强：添加响应格式验证
   */
  const handleGenerationEnd = async (finalText: string, generationId: string): Promise<void> => {
    if (!finalText) {
      console.warn('[useAIInteraction] 收到空的AI回复');
      isProcessing.value = false;
      isStreaming.value = false;
      return;
    }

    console.log('[useAIInteraction] AI生成结束，ID:', generationId);
    console.log('[useAIInteraction] AI回复长度:', finalText.length);

    try {
      error.value = null;

      // 【增强】验证响应格式
      const validation = validateResponseFormat(finalText);

      if (!validation.isValid) {
        console.warn('[useAIInteraction] AI响应格式不完整:', validation.missingTags);
        // 显示用户提示
        if (typeof toastr !== 'undefined') {
          toastr.warning(`AI响应缺少: ${validation.missingTags.join(', ')}`, '格式警告', { timeOut: 3000 });
        }
      }

      // 【关键修复】保存完整的AI回复内容
      // 这将在下一次请求时被注入到上下文中，确保AI能看到上一次回复的所有内容
      lastAIResponse.value = finalText;
      console.log('[useAIInteraction] 已保存AI回复用于下次上下文注入');

      // 提取显示文本（优先提取gametxt内容）
      // 即使格式不完整也尝试处理（容错）
      const displayText = validation.hasGameText ? extractGameText(finalText) : '';

      if (displayText) {
        // 检查是否是为现有内容生成swipe
        const isSwipeGeneration = (window as any).__currentSwipeGeneration;

        if (isSwipeGeneration) {
          // 添加到swipes数组
          swipes.value.push(displayText);
          currentSwipeIndex.value = swipes.value.length - 1;
          currentContent.value = displayText;
          delete (window as any).__currentSwipeGeneration;
          console.log('[useAIInteraction] 新swipe已添加');
        } else {
          // 正常更新内容
          currentContent.value = displayText;
          swipes.value = [displayText];
          currentSwipeIndex.value = 0;
          console.log('[useAIInteraction] 内容已更新');
        }

        lastUpdateTime.value = getCurrentTime();
      } else if (!validation.hasGameText) {
        console.warn('[useAIInteraction] 未提取到有效的显示文本（缺少gametxt标签）');
      }

      // 解析并执行变量更新指令（只在有UpdateVariable标签时执行）
      if (validation.hasUpdateVariable) {
        await parseAndUpdateVariables(finalText);
      }

      // 处理上下文管理：提取历史记录和历史正文，自动更新分段
      await processContextManager(finalText);

      // 保存AI回复到酒馆聊天记录
      await saveAIReplyToChat(finalText);

      // 执行自动存档（AI回复结束后）
      await performAutoSave();

      isProcessing.value = false;
      isStreaming.value = false;
    } catch (err) {
      console.error('[useAIInteraction] 处理AI回复失败:', err);
      error.value = err instanceof Error ? err.message : '处理AI回复失败';
      isProcessing.value = false;
      isStreaming.value = false;
    }
  };

  // ========== 变量更新处理 ==========

  /**
   * 解析并更新变量
   * 参考归墟的MVU变量更新逻辑
   */
  const parseAndUpdateVariables = async (message: string): Promise<void> => {
    try {
      const mvuStore = useMvuStore();

      // 清空之前的变量变化
      variableChanges.value = [];

      // 检查MVU是否可用
      if (!mvuStore.isMvuAvailable) {
        console.log('[useAIInteraction] MVU不可用，跳过变量更新');
        return;
      }

      // 检查MVU数据是否已加载
      if (!mvuStore.mvuData) {
        console.warn('[useAIInteraction] MVU数据未加载，尝试初始化...');
        try {
          // 使用 'latest' 获取最新消息的MVU数据
          await mvuStore.initialize({ type: 'message', message_id: 'latest' });
          console.log('[useAIInteraction] MVU初始化成功');
        } catch (initError) {
          console.error('[useAIInteraction] MVU初始化失败:', initError);
          return;
        }
      }

      // 检查消息中是否包含UpdateVariable标签
      const updateContent = extractUpdateVariableContent(message);
      if (!updateContent) {
        console.log('[useAIInteraction] 未发现变量更新指令');
        return;
      }

      console.log('[useAIInteraction] 发现变量更新指令，开始解析执行...');

      // 解析并执行指令
      const result = await mvuStore.parseAndExecuteCommands(message);

      if (result.success) {
        console.log('[useAIInteraction] 变量更新成功，共执行', result.results.length, '条指令');

        // 记录变量变化
        result.results.forEach((r: any) => {
          if (r.success) {
            variableChanges.value.push({
              path: r.command.path,
              oldValue: r.oldValue,
              newValue: r.newValue,
              comment: r.command.comment,
            });
          }
        });
      } else {
        console.warn('[useAIInteraction] 变量更新失败:', result.error);
      }
    } catch (err) {
      console.error('[useAIInteraction] 解析变量更新失败:', err);
    }
  };

  // ========== 上下文管理处理 ==========

  /**
   * 处理上下文管理
   * 提取AI回复中的历史记录和历史正文，自动追加并更新分段
   */
  const processContextManager = async (message: string): Promise<void> => {
    try {
      // 调用上下文管理服务处理AI回复
      const updated = await contextManagerService.processAIResponse(message);

      if (updated) {
        const stats = contextManagerService.getStatistics();
        console.log('[useAIInteraction] 上下文已更新:', {
          历史记录数: stats.recordCount,
          历史正文数: stats.textCount,
          分段正文数: stats.segmentCount,
          小总结数: stats.smallSummaryCount,
          大总结数: stats.largeSummaryCount,
        });
      }
    } catch (err) {
      console.error('[useAIInteraction] 上下文管理处理失败:', err);
      // 不抛出错误，避免影响其他处理流程
    }
  };

  // ========== 自动存档处理 ==========

  /**
   * 执行自动存档
   * 在AI回复结束后调用
   */
  const performAutoSave = async (): Promise<void> => {
    try {
      // 检查自动存档配置
      const config = saveService.getAutoSaveConfig();
      if (!config.enabled || !config.saveOnAIResponse) {
        console.log('[useAIInteraction] 自动存档未启用，跳过');
        return;
      }

      autoSaveStatus.value = 'saving';
      console.log('[useAIInteraction] 开始执行自动存档...');

      // 获取当前消息ID（如果可用）
      let messageId: number | undefined;
      if (typeof (window as any).getLastMessageId === 'function') {
        messageId = (window as any).getLastMessageId();
      }

      // 调用存档服务的自动存档方法
      const save = await saveService.autoSaveOnAIResponse(messageId);

      if (save) {
        autoSaveStatus.value = 'success';
        lastAutoSaveName.value = save.name;
        console.log('[useAIInteraction] 自动存档成功:', save.name);

        // 可选：显示提示信息
        if (typeof toastr !== 'undefined') {
          toastr.info(`已自动存档: ${save.name}`, '自动存档', { timeOut: 2000 });
        }
      } else {
        // 可能是因为防抖被跳过，不算错误
        autoSaveStatus.value = 'idle';
      }
    } catch (err) {
      autoSaveStatus.value = 'error';
      console.error('[useAIInteraction] 自动存档失败:', err);
      // 不抛出错误，避免影响主流程
    }
  };

  /**
   * 手动触发自动存档（用于测试或手动触发）
   */
  const triggerManualAutoSave = async (): Promise<boolean> => {
    try {
      autoSaveStatus.value = 'saving';

      let messageId: number | undefined;
      if (typeof (window as any).getLastMessageId === 'function') {
        messageId = (window as any).getLastMessageId();
      }

      const save = await saveService.createAutoSave(
        `[手动触发] ${new Date().toLocaleTimeString('zh-CN')}`,
        'auto',
        messageId,
      );

      if (save) {
        autoSaveStatus.value = 'success';
        lastAutoSaveName.value = save.name;
        return true;
      }

      autoSaveStatus.value = 'error';
      return false;
    } catch (err) {
      autoSaveStatus.value = 'error';
      console.error('[useAIInteraction] 手动触发自动存档失败:', err);
      return false;
    }
  };

  // ========== 酒馆聊天记录操作 ==========

  /**
   * 保存AI回复到酒馆聊天记录（同层化核心）
   * 将AI回复覆盖到消息0，然后删除其他多余消息
   * 这确保聊天记录始终只有一条消息，MVU变量绑定到固定层级
   *
   * 增强：添加错误恢复和回滚机制
   */
  const saveAIReplyToChat = async (responseText: string): Promise<boolean> => {
    // 1. 先保存快照用于回滚
    let originalMessages: any[] = [];
    let snapshotSuccess = false;

    try {
      console.log('[useAIInteraction] 保存AI回复到酒馆聊天记录（同层化模式 + 错误恢复）');

      // 检查酒馆助手是否可用
      if (typeof (window as any).TavernHelper?.setChatMessages !== 'function') {
        console.warn('[useAIInteraction] TavernHelper不可用');
        return false;
      }

      // 【错误恢复】尝试保存当前消息快照用于回滚
      try {
        const lastId =
          typeof (window as any).getLastMessageId === 'function' ? ((window as any).getLastMessageId() ?? -1) : -1;
        if (lastId >= 0) {
          originalMessages = await (window as any).TavernHelper.getChatMessages(`0-${lastId}`);
          if (originalMessages && originalMessages.length > 0) {
            // 深拷贝以防止引用问题
            originalMessages = JSON.parse(JSON.stringify(originalMessages));
            snapshotSuccess = true;
            console.log('[useAIInteraction] 已创建消息快照，共', originalMessages.length, '条消息');
          }
        }
      } catch (snapshotErr) {
        console.warn('[useAIInteraction] 获取消息快照失败，继续执行（无回滚能力）:', snapshotErr);
      }

      // 2. 获取消息0（固定层级）
      const chatMessages = await (window as any).TavernHelper.getChatMessages('0');
      if (!chatMessages || chatMessages.length === 0) {
        throw new Error('消息0不存在，无法保存AI回复');
      }

      const messageZero = chatMessages[0];
      messageZero.message = responseText;

      // 3. 保存到消息0，但不刷新界面
      await (window as any).TavernHelper.setChatMessages([messageZero], { refresh: 'none' });
      console.log('[useAIInteraction] AI回复已保存到消息0');

      // 4. 【同层化关键】删除 generate 自动创建的多余消息
      // generate 会自动创建新消息，我们需要删除除消息0之外的所有消息
      await cleanupExtraMessages();

      console.log('[useAIInteraction] 同层化保存成功');
      return true;
    } catch (err) {
      console.error('[useAIInteraction] 保存AI回复失败，尝试回滚:', err);

      // 5. 【错误恢复】尝试回滚到原始状态
      if (snapshotSuccess && originalMessages.length > 0) {
        try {
          await (window as any).TavernHelper.setChatMessages(originalMessages, { refresh: 'none' });
          console.log('[useAIInteraction] 回滚成功，已恢复原始消息');

          // 显示用户提示
          if (typeof toastr !== 'undefined') {
            toastr.warning('保存失败，已回滚到原始状态', '同层化错误', { timeOut: 3000 });
          }
        } catch (rollbackErr) {
          console.error('[useAIInteraction] 回滚失败:', rollbackErr);

          // 显示严重错误提示
          if (typeof toastr !== 'undefined') {
            toastr.error('保存失败且无法回滚，消息可能已损坏', '严重错误', { timeOut: 5000 });
          }
        }
      }

      return false;
    }
  };

  /**
   * 清理多余消息（同层化核心）
   * 删除除消息0之外的所有消息，保持聊天记录始终只有一条
   *
   * 增强：添加重试机制
   */
  const cleanupExtraMessages = async (): Promise<boolean> => {
    const MAX_RETRIES = 3;
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
      try {
        if (typeof (window as any).getLastMessageId !== 'function') {
          return true; // 无法获取消息ID，跳过清理
        }

        const lastMessageId = (window as any).getLastMessageId?.() ?? -1;

        // 如果只有消息0或更少，无需清理
        if (lastMessageId <= 0) {
          console.log('[useAIInteraction] 无需清理多余消息，当前只有消息0');
          return true;
        }

        // 删除消息1及之后的所有消息
        if (typeof (window as any).deleteChatMessages === 'function') {
          const messageIdsToDelete = Array.from({ length: lastMessageId }, (_, i) => i + 1);
          console.log('[useAIInteraction] 删除多余消息:', messageIdsToDelete);

          await (window as any).deleteChatMessages(messageIdsToDelete, { refresh: 'none' });
          console.log('[useAIInteraction] 多余消息已删除，保持同层化');
          return true;
        }

        return true;
      } catch (err) {
        retryCount++;
        console.warn(`[useAIInteraction] 清理多余消息失败 (尝试 ${retryCount}/${MAX_RETRIES}):`, err);

        if (retryCount >= MAX_RETRIES) {
          console.error('[useAIInteraction] 清理多余消息最终失败，消息层级可能混乱');

          // 显示警告
          if (typeof toastr !== 'undefined') {
            toastr.warning('消息清理失败，层级可能混乱', '同层化警告', { timeOut: 3000 });
          }
          return false;
        }

        // 等待一小段时间后重试
        await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
      }
    }

    return false;
  };

  /**
   * 删除酒馆聊天记录中的最后一条AI消息
   */
  const deleteLastAIMessageFromTavern = async (): Promise<boolean> => {
    try {
      if (typeof (window as any).TavernHelper?.getChatMessages !== 'function') {
        return false;
      }

      const chatMessages = await (window as any).TavernHelper.getChatMessages();
      if (chatMessages && chatMessages.length > 0) {
        for (let i = 0; i < chatMessages.length; i++) {
          if (!chatMessages[i].is_user) {
            chatMessages.splice(i, 1);
            await (window as any).TavernHelper.setChatMessages(chatMessages, { refresh: 'none' });
            return true;
          }
        }
      }
      return false;
    } catch (err) {
      console.error('[useAIInteraction] 删除酒馆消息失败:', err);
      return false;
    }
  };

  /**
   * 从酒馆聊天记录加载最新内容
   * 【关键修复】同时恢复 lastAIResponse，确保上下文注入功能正常工作
   */
  const loadLatestFromTavern = async (): Promise<boolean> => {
    try {
      if (typeof (window as any).getChatMessages !== 'function') {
        console.warn('[useAIInteraction] getChatMessages函数不可用');
        return false;
      }

      const lastMessageId = (window as any).getLastMessageId?.() ?? -1;
      if (lastMessageId < 0) {
        console.log('[useAIInteraction] 酒馆聊天记录为空');
        return false;
      }

      // 获取最新的AI消息
      const chatMessages = await (window as any).getChatMessages(`0-${lastMessageId}`, {
        role: 'all',
        hide_state: 'unhidden',
        include_swipes: true,
      });

      // 找到最新的AI消息（从最后一条开始搜索，确保找到最新的）
      for (let i = chatMessages.length - 1; i >= 0; i--) {
        const msg = chatMessages[i];
        if (msg.role !== 'user') {
          // 获取完整的原始内容（用于上下文注入）
          const fullContent = msg.swipes?.[msg.swipe_id || 0] || msg.message || '';
          const displayContent = extractGameText(fullContent);

          if (displayContent) {
            currentContent.value = displayContent;
            swipes.value = msg.swipes ? msg.swipes.map((s: string) => extractGameText(s)) : [displayContent];
            currentSwipeIndex.value = msg.swipe_id || 0;
            lastUpdateTime.value = getCurrentTime();

            // 【关键修复】同时恢复 lastAIResponse
            // 这确保了组件重新挂载后，上下文注入功能能够正常工作
            lastAIResponse.value = fullContent;

            console.log('[useAIInteraction] 已加载最新内容，并恢复lastAIResponse，长度:', fullContent.length);
            return true;
          }
        }
      }

      return false;
    } catch (err) {
      console.error('[useAIInteraction] 从酒馆加载内容失败:', err);
      return false;
    }
  };

  // ========== 变量数据注入 ==========

  /**
   * 构建包含变量数据和上一次AI回复的完整prompt
   * 参考归墟的实现：主动将变量数据序列化后注入，不依赖酒馆宏解析
   * 这样可以确保变量数据始终被正确传递给AI
   *
   * 重要修复1：直接从 MVU API 获取最新数据，而不仅仅依赖 store 的缓存
   * 重要修复2：注入上一次AI回复的完整内容，确保上下文连续性
   */
  const buildPromptWithVariables = (userInput: string): string => {
    const mvuStore = useMvuStore();

    // 【关键修复】：优先从 MVU API 实时获取最新数据
    // store 的缓存可能不是最新的，或者 store 可能尚未初始化
    let statData: Record<string, any> = {};

    try {
      // 方法1：尝试从 MVU API 直接获取（最可靠）
      if (typeof window !== 'undefined' && (window as any).Mvu) {
        const mvu = (window as any).Mvu;
        if (typeof mvu.getMvuData === 'function') {
          // 使用 'latest' 获取最新消息的MVU数据
          const mvuData = mvu.getMvuData({ type: 'message', message_id: 'latest' });
          if (mvuData && mvuData.stat_data) {
            statData = mvuData.stat_data;
            console.log('[useAIInteraction] 从 MVU API 获取到变量数据，键数量:', Object.keys(statData).length);
          } else {
            console.warn('[useAIInteraction] MVU API 返回数据为空');
          }
        }
      }

      // 方法2：回退到 store 缓存
      if (Object.keys(statData).length === 0) {
        if (mvuStore.mvuData?.stat_data) {
          statData = mvuStore.mvuData.stat_data;
          console.log('[useAIInteraction] 从 store 缓存获取变量数据，键数量:', Object.keys(statData).length);
        } else {
          console.warn('[useAIInteraction] store 缓存中也没有变量数据');
        }
      }

      // 方法3：尝试强制刷新 store
      if (Object.keys(statData).length === 0 && mvuStore.isMvuAvailable) {
        console.log('[useAIInteraction] 尝试强制刷新 store...');
        // 异步刷新，但这里不等待（因为 generate 需要同步返回 prompt）
        mvuStore.refresh().catch(err => {
          console.error('[useAIInteraction] 刷新 store 失败:', err);
        });
        // 再次尝试获取
        if (mvuStore.mvuData?.stat_data) {
          statData = mvuStore.mvuData.stat_data;
        }
      }
    } catch (apiErr) {
      console.error('[useAIInteraction] 获取 MVU 数据失败:', apiErr);
    }

    // 序列化变量数据
    let statDataJson: string;
    try {
      statDataJson = JSON.stringify(statData, null, 2);
    } catch (err) {
      console.error('[useAIInteraction] 序列化变量数据失败:', err);
      statDataJson = '{}';
    }

    // 【关键修复】：构建包含变量数据和上一次AI回复的完整prompt
    // 格式与世界书中的期望格式保持一致
    // 上一次AI回复的内容对于保持上下文连续性至关重要
    let promptWithContext = '';

    // 1. 注入变量数据
    promptWithContext += `<status_current_variables>
${statDataJson}
</status_current_variables>

`;

    // 2. 【关键修复】注入上一次AI回复的完整内容
    // 这确保了AI能够看到上一次回复的所有标签内容（gametxt、历史记录、UpdateVariable等）
    if (lastAIResponse.value) {
      promptWithContext += `<last_ai_response>
${lastAIResponse.value}
</last_ai_response>

`;
      console.log('[useAIInteraction] 已注入上一次AI回复，长度:', lastAIResponse.value.length);
    }

    // 3. 用户输入
    promptWithContext += userInput;

    // 详细日志：显示变量数据内容摘要
    const statKeys = Object.keys(statData);
    console.log('[useAIInteraction] 已构建包含变量数据和上下文的prompt:', {
      变量数据大小: statDataJson.length + '字符',
      顶级键: statKeys,
      MC键: statData.MC ? Object.keys(statData.MC) : '无MC对象',
      用户输入长度: userInput.length + '字符',
      上一次AI回复长度: lastAIResponse.value ? lastAIResponse.value.length + '字符' : '无',
    });

    return promptWithContext;
  };

  // ========== AI生成操作 ==========

  /**
   * 发送消息给AI
   * 同层化实现：不创建新的消息层，而是覆盖固定层级
   * 参考归墟的实现方式
   *
   * 变量注入：主动将变量数据序列化后注入到prompt中
   * 不依赖 {{get_message_variable::stat_data}} 宏解析
   */
  const sendMessageToAI = async (userInput: string): Promise<boolean> => {
    if (!userInput.trim()) {
      error.value = '消息不能为空';
      return false;
    }

    try {
      console.log('[useAIInteraction] 发送消息给AI（同层化模式 + 主动变量注入）:', userInput);

      // 保存用户输入（用于重新生成）
      lastUserInput.value = userInput.trim();

      // 清空当前内容
      currentContent.value = '';
      swipes.value = [];
      currentSwipeIndex.value = 0;
      variableChanges.value = [];

      // 检查generate函数是否可用
      if (typeof (window as any).generate !== 'function') {
        throw new Error('generate函数不可用，请确保在酒馆环境中运行');
      }

      // 调用generate函数生成AI回复
      isProcessing.value = true;
      error.value = null;

      // 【主动变量注入】：构建包含变量数据的完整prompt
      const promptWithVariables = buildPromptWithVariables(userInput.trim());

      // 获取流式传输配置
      const appStore = useAppStore();
      const shouldStream = appStore.streamingEnabled;
      console.log('[useAIInteraction] 流式传输模式:', shouldStream ? '开启' : '关闭');

      // 【同层化核心】：
      // 1. 使用 user_input 参数传递用户输入，而不是先创建消息
      // 2. 设置 max_chat_history: 0 阻止创建新的聊天历史记录
      // 这样可以保持消息始终在固定层级，不会不断增加楼层
      await (window as any).generate({
        user_input: promptWithVariables,
        should_stream: shouldStream, // 使用配置的流式传输开关
        max_chat_history: 0, // 关键：不创建新的聊天历史
      });

      return true;
    } catch (err) {
      console.error('[useAIInteraction] 发送消息失败:', err);
      error.value = err instanceof Error ? err.message : '发送消息失败';
      isProcessing.value = false;
      return false;
    }
  };

  /**
   * 重新生成AI回复
   * 使用主动变量注入，确保变量数据是最新的
   */
  const regenerateAIResponse = async (): Promise<boolean> => {
    try {
      console.log('[useAIInteraction] 重新生成AI回复（主动变量注入）');

      if (!lastUserInput.value) {
        console.warn('[useAIInteraction] 没有可重新生成的用户输入');
        return false;
      }

      // 检查generate函数是否可用
      if (typeof (window as any).generate !== 'function') {
        throw new Error('generate函数不可用');
      }

      // 删除酒馆中的原AI消息
      await deleteLastAIMessageFromTavern();

      // 清空当前内容
      currentContent.value = '';
      swipes.value = [];
      currentSwipeIndex.value = 0;
      variableChanges.value = [];

      // 重新生成
      isProcessing.value = true;
      error.value = null;

      // 【主动变量注入】：重新构建包含最新变量数据的prompt
      const promptWithVariables = buildPromptWithVariables(lastUserInput.value);

      // 获取流式传输配置
      const appStore = useAppStore();
      const shouldStream = appStore.streamingEnabled;

      await (window as any).generate({
        user_input: promptWithVariables,
        should_stream: shouldStream, // 使用配置的流式传输开关
        max_chat_history: 0,
      });

      return true;
    } catch (err) {
      console.error('[useAIInteraction] 重新生成失败:', err);
      error.value = err instanceof Error ? err.message : '重新生成失败';
      isProcessing.value = false;
      return false;
    }
  };

  /**
   * 生成更多回复（swipe）
   * 使用主动变量注入，确保变量数据是最新的
   */
  const generateSwipe = async (): Promise<boolean> => {
    try {
      console.log('[useAIInteraction] 生成更多回复（主动变量注入）');

      if (!lastUserInput.value) {
        console.warn('[useAIInteraction] 没有可生成swipe的用户输入');
        return false;
      }

      // 检查generate函数是否可用
      if (typeof (window as any).generate !== 'function') {
        throw new Error('generate函数不可用');
      }

      // 删除酒馆中的原AI消息
      await deleteLastAIMessageFromTavern();

      // 标记当前正在生成swipe
      (window as any).__currentSwipeGeneration = true;

      // 生成新回复
      isProcessing.value = true;
      error.value = null;

      // 【主动变量注入】：重新构建包含最新变量数据的prompt
      const promptWithVariables = buildPromptWithVariables(lastUserInput.value);

      // 获取流式传输配置
      const appStore = useAppStore();
      const shouldStream = appStore.streamingEnabled;

      await (window as any).generate({
        user_input: promptWithVariables,
        should_stream: shouldStream, // 使用配置的流式传输开关
        max_chat_history: 0,
      });

      return true;
    } catch (err) {
      console.error('[useAIInteraction] 生成swipe失败:', err);
      error.value = err instanceof Error ? err.message : '生成swipe失败';
      isProcessing.value = false;
      delete (window as any).__currentSwipeGeneration;
      return false;
    }
  };

  /**
   * 切换swipe
   */
  const switchSwipe = (direction: 'prev' | 'next'): void => {
    if (swipes.value.length <= 1) return;

    let newIndex = currentSwipeIndex.value;

    if (direction === 'prev') {
      newIndex = newIndex > 0 ? newIndex - 1 : swipes.value.length - 1;
    } else {
      newIndex = newIndex < swipes.value.length - 1 ? newIndex + 1 : 0;
    }

    currentSwipeIndex.value = newIndex;
    currentContent.value = swipes.value[newIndex];
  };

  /**
   * 清空内容
   */
  const clearContent = async (): Promise<void> => {
    currentContent.value = '';
    swipes.value = [];
    currentSwipeIndex.value = 0;
    variableChanges.value = [];
    lastUserInput.value = '';
    lastAIResponse.value = ''; // 同时清空上一次AI回复
    error.value = null;
    lastUpdateTime.value = '';

    // 清除酒馆聊天记录
    if (typeof (window as any).deleteChatMessages === 'function') {
      try {
        const lastMessageId = (window as any).getLastMessageId?.() ?? -1;
        if (lastMessageId >= 0) {
          const messageIds = Array.from({ length: lastMessageId + 1 }, (_, i) => i);
          await (window as any).deleteChatMessages(messageIds, { refresh: 'none' });
        }
      } catch (err) {
        console.error('[useAIInteraction] 清除酒馆聊天记录失败:', err);
      }
    }
  };

  // ========== 事件监听器管理 ==========

  /**
   * 设置AI事件监听器
   * 增强：添加防重复绑定机制，参考归墟的四层防护
   */
  const setupAIListeners = (): boolean => {
    try {
      // 【防泄漏机制】防重复绑定
      if (listenersAttached) {
        console.log('[useAIInteraction] 监听器已存在，跳过重复绑定');
        return true;
      }

      console.log('[useAIInteraction] 设置AI事件监听器');

      if (typeof (window as any).eventOn !== 'function') {
        console.warn('[useAIInteraction] eventOn函数不可用');
        return false;
      }

      // 【防泄漏机制】先清理可能存在的旧监听器
      cleanupAIListeners();

      streamingHandler = (text: string, id: string) => handleStreamingText(text, id);
      streamEndHandler = (text: string, id: string) => handleGenerationEnd(text, id);

      if (typeof (window as any).iframe_events !== 'undefined') {
        (window as any).eventOn((window as any).iframe_events.STREAM_TOKEN_RECEIVED_FULLY, streamingHandler);
        (window as any).eventOn((window as any).iframe_events.GENERATION_ENDED, streamEndHandler);
      } else {
        (window as any).eventOn('js_stream_token_received_fully', streamingHandler);
        (window as any).eventOn('js_generation_ended', streamEndHandler);
      }

      // 【防泄漏机制】标记已绑定
      listenersAttached = true;
      console.log('[useAIInteraction] 监听器设置成功');

      return true;
    } catch (err) {
      console.error('[useAIInteraction] 设置AI监听器失败:', err);
      return false;
    }
  };

  /**
   * 清理AI事件监听器
   * 增强：添加标记清除机制
   */
  const cleanupAIListeners = (): void => {
    try {
      // 【防泄漏机制】检查是否需要清理
      if (!listenersAttached && !streamingHandler && !streamEndHandler) {
        return; // 无需清理
      }

      console.log('[useAIInteraction] 清理AI事件监听器');

      if (typeof (window as any).eventRemoveListener === 'function') {
        if (streamingHandler) {
          if (typeof (window as any).iframe_events !== 'undefined') {
            (window as any).eventRemoveListener(
              (window as any).iframe_events.STREAM_TOKEN_RECEIVED_FULLY,
              streamingHandler,
            );
          } else {
            (window as any).eventRemoveListener('js_stream_token_received_fully', streamingHandler);
          }
        }

        if (streamEndHandler) {
          if (typeof (window as any).iframe_events !== 'undefined') {
            (window as any).eventRemoveListener((window as any).iframe_events.GENERATION_ENDED, streamEndHandler);
          } else {
            (window as any).eventRemoveListener('js_generation_ended', streamEndHandler);
          }
        }
      }

      streamingHandler = null;
      streamEndHandler = null;
      // 【防泄漏机制】清除标记
      listenersAttached = false;
    } catch (err) {
      console.error('[useAIInteraction] 清理AI监听器失败:', err);
    }
  };

  // ========== AI内容数据提供者/恢复者 ==========

  /**
   * 获取当前AI内容数据（用于存档）
   * 关键修复：包含上一次AI回复的完整内容
   */
  const getAIContentData = (): AIContentData | null => {
    if (!currentContent.value && swipes.value.length === 0 && !lastAIResponse.value) {
      return null;
    }

    return {
      currentContent: currentContent.value,
      swipes: [...swipes.value],
      currentSwipeIndex: currentSwipeIndex.value,
      lastUserInput: lastUserInput.value,
      lastUpdateTime: lastUpdateTime.value,
      lastAIResponse: lastAIResponse.value, // 保存完整的AI回复
    };
  };

  /**
   * 恢复AI内容数据（读档时调用）
   * 关键修复：恢复上一次AI回复的完整内容
   */
  const restoreAIContentData = (data: AIContentData): void => {
    console.log('[useAIInteraction] 恢复AI内容数据');

    currentContent.value = data.currentContent || '';
    swipes.value = data.swipes || [];
    currentSwipeIndex.value = data.currentSwipeIndex || 0;
    lastUserInput.value = data.lastUserInput || '';
    lastUpdateTime.value = data.lastUpdateTime || '';
    lastAIResponse.value = data.lastAIResponse || ''; // 恢复完整的AI回复

    console.log('[useAIInteraction] AI内容已恢复:', {
      contentLength: currentContent.value.length,
      swipesCount: swipes.value.length,
      currentIndex: currentSwipeIndex.value,
      lastAIResponseLength: lastAIResponse.value.length,
    });
  };

  // ========== MVU拦截器管理（已禁用） ==========

  /**
   * 初始化MVU拦截器（已禁用）
   */
  const initializeMvuInterceptor = (): boolean => {
    console.log('[useAIInteraction] MVU拦截器已禁用，跳过初始化');
    return false;
  };

  /**
   * 切换MVU拦截器启用状态（已禁用）
   */
  const toggleMvuInterceptor = (): boolean => {
    console.log('[useAIInteraction] MVU拦截器已禁用');
    return false;
  };

  /**
   * 启用MVU拦截器（已禁用）
   */
  const enableMvuInterceptor = (): void => {
    console.log('[useAIInteraction] MVU拦截器已禁用');
  };

  /**
   * 禁用MVU拦截器（已禁用）
   */
  const disableMvuInterceptor = (): void => {
    console.log('[useAIInteraction] MVU拦截器已禁用');
  };

  /**
   * 设置过滤预设（已禁用）
   */
  const setFilterPreset = (preset: string): void => {
    console.log('[useAIInteraction] MVU拦截器已禁用，无法设置预设:', preset);
  };

  /**
   * 获取MVU拦截器统计信息（已禁用）
   */
  const getMvuInterceptorStats = () => {
    return null;
  };

  /**
   * 获取平均压缩比（已禁用）
   */
  const getAverageCompressionRatio = (): number => {
    return 0;
  };

  // ========== 生命周期 ==========

  onMounted(async () => {
    console.log('[useAIInteraction] Composable已挂载');
    setupAIListeners();

    // 注册AI内容数据提供者和恢复者到SaveService
    saveService.setAIContentDataProvider(getAIContentData);
    saveService.setAIContentDataRestorer(restoreAIContentData);

    // 初始化上下文管理服务
    await contextManagerService.initialize();

    // MVU拦截器已禁用
    // initializeMvuInterceptor();

    // 【关键修复】等待 MVU Store 初始化完成
    // 在新聊天时，MVU 数据可能还没准备好
    await waitForMvuStoreReady();

    // 尝试从酒馆聊天记录加载最新内容
    await loadLatestFromTavern();
  });

  /**
   * 等待 MVU Store 初始化完成
   * 在组件挂载时确保 MVU 数据已加载
   */
  const waitForMvuStoreReady = async (maxWaitTime: number = 3000, checkInterval: number = 100): Promise<void> => {
    const mvuStore = useMvuStore();
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      // 检查 MVU Store 是否已初始化且有数据
      if (mvuStore.isMvuAvailable && mvuStore.mvuData?.stat_data) {
        console.log('[useAIInteraction] MVU Store 已就绪');
        return;
      }

      // 如果正在加载，继续等待
      if (mvuStore.isLoading) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }

      // 如果不在加载且没数据，可能需要触发初始化
      if (!mvuStore.isLoading && !mvuStore.mvuData) {
        console.log('[useAIInteraction] 触发 MVU Store 初始化...');
        try {
          await mvuStore.initialize();
        } catch (err) {
          console.warn('[useAIInteraction] MVU Store 初始化失败:', err);
        }
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    console.warn('[useAIInteraction] 等待 MVU Store 超时，继续执行');
  };

  onUnmounted(() => {
    console.log('[useAIInteraction] Composable正在卸载');
    cleanupAIListeners();

    // MVU拦截器已禁用，无需销毁
    // mvuInterceptorService.destroy();
  });

  // ========== 返回公共接口 ==========

  return {
    // 状态
    currentContent,
    swipes,
    currentSwipeIndex,
    isProcessing,
    isStreaming,
    error,
    lastUpdateTime,
    variableChanges,
    lastAIResponse, // 导出上一次AI回复（用于调试和存档）

    // 计算属性
    hasContent,
    hasMultipleSwipes,

    // AI操作方法
    sendMessageToAI,
    regenerateAIResponse,
    generateSwipe,
    switchSwipe,
    clearContent,
    loadLatestFromTavern,

    // 事件监听方法
    setupAIListeners,
    cleanupAIListeners,

    // 工具函数
    extractGameText,
    extractUpdateVariableContent,
    buildPromptWithVariables,
    validateResponseFormat,

    // 上下文管理
    contextManagerService,

    // 自动存档
    autoSaveStatus,
    lastAutoSaveName,
    performAutoSave,
    triggerManualAutoSave,

    // AI内容数据管理
    getAIContentData,
    restoreAIContentData,

    // MVU拦截器管理（已禁用，保留接口兼容性）
    isMvuInterceptorEnabled,
    currentFilterPreset,
    initializeMvuInterceptor,
    toggleMvuInterceptor,
    enableMvuInterceptor,
    disableMvuInterceptor,
    setFilterPreset,
    getMvuInterceptorStats,
    getAverageCompressionRatio,
    // mvuInterceptorService 已禁用
    mvuInterceptorService: null,
  };
}
