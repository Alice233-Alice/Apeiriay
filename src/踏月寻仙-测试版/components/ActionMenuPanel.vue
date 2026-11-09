<template>
  <div class="action-menu-panel">
    <!-- 当前处境 -->
    <div v-if="store.当前处境" class="situation-section">
      <div class="section-title">
        <div class="title-left">
          <i class="fa-solid fa-compass"></i> 当前处境
        </div>
        <span v-if="situationBadgeText" class="section-badge" :class="`mode-${situationRefreshState}`">{{ situationBadgeText }}</span>
      </div>
      <div class="situation-content">
        {{ formatThirdPerson(store.当前处境) }}
      </div>
    </div>

    <!-- 可选行动列表 -->
    <div class="actions-section">
      <div class="section-title">
        <div class="title-left">
          <i class="fa-solid fa-list-check"></i> 可选行动
        </div>
        <div class="title-right">
          <button class="toggle-btn" :class="{ active: store.启用行动提示 }" :title="store.启用行动提示 ? '关闭行动提示生成' : '开启行动提示生成'" @click="store.toggleActionPrompt">
            <i class="fa-solid" :class="store.启用行动提示 ? 'fa-toggle-on' : 'fa-toggle-off'"></i>
            <span>{{ store.启用行动提示 ? '已开启' : '已关闭' }}</span>
          </button>
          <button v-if="store.启用行动提示" class="refresh-btn" title="重新解析本轮行动" @click="refreshActions">
            <i class="fa-solid fa-rotate-right" :class="{ 'fa-spin': isRefreshing }"></i>
          </button>
          <span v-if="store.启用行动提示" class="action-count">{{ actionSummaryLabel }}</span>
        </div>
      </div>

      <!-- 关闭提示 -->
      <div v-if="!store.启用行动提示" class="no-actions disabled-state">
        <i class="fa-solid fa-power-off"></i>
        <p>行动提示已关闭</p>
        <p class="hint">AI 将不再生成行动选项以节省 Token</p>
      </div>

      <template v-else>
        <div v-if="actionFeedMode === 'partial'" class="status-banner warn">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div class="banner-copy">
            <strong>本轮只刷新了部分机遇</strong>
            <span>已自动隐藏 {{ hiddenInheritedActionCount }} 项上一轮残留项，避免旧选项混入当前决策。</span>
          </div>
        </div>

        <div v-else-if="actionFeedMode === 'none'" class="status-banner info">
          <i class="fa-solid fa-sparkles"></i>
          <div class="banner-copy">
            <strong>本轮未检测到新的机遇更新</strong>
            <span>动态机遇不再沿用旧列表，下面保留稳妥动作供你直接推进剧情。</span>
          </div>
        </div>

        <div v-else-if="actionFeedMode === 'cleared'" class="status-banner info">
          <i class="fa-solid fa-broom"></i>
          <div class="banner-copy">
            <strong>本轮机遇已清空</strong>
            <span>这一轮暂无分明的新机缘，可顺势推演，或自行寻机探路。</span>
          </div>
        </div>

        <div class="actions-group">
          <div class="group-title">
            <span>本轮新机遇</span>
            <span class="group-meta">{{ freshSortedActions.length }} 项</span>
          </div>

          <div v-if="freshSortedActions.length === 0" class="no-actions compact">
            <i class="fa-solid fa-hourglass-half"></i>
            <p>这一轮暂无可信的新机遇</p>
            <p class="hint">{{ actionFeedMode === 'partial' ? '模型只改动了部分选项，其余残留项已被隐藏。' : '可先使用下方稳妥动作继续推进。' }}</p>
          </div>

          <div v-else class="action-list">
            <div
              v-for="(action, index) in freshSortedActions"
              :key="getActionKey(action, index)"
              class="action-card"
              :class="[
                `type-${action.类型}`,
                { urgent: action.时限 },
                detectNsfwSubType(action) ? `nsfw-${detectNsfwSubType(action)}` : '',
              ]"
              @click="selectAction(action)"
            >
              <div class="action-icon" :class="detectNsfwSubType(action) ? `icon-nsfw-${detectNsfwSubType(action)}` : `icon-${action.类型}`">
                <i :class="getActionIcon(action.类型, detectNsfwSubType(action))"></i>
              </div>

              <div class="action-info">
                <div class="action-header">
                  <span class="action-name">{{ action.名称 }}</span>
                  <span class="action-type-tag" :class="detectNsfwSubType(action) ? `tag-nsfw-${detectNsfwSubType(action)}` : ''">
                    {{ detectNsfwSubType(action) ? `红颜·${detectNsfwSubType(action)}` : action.类型 }}
                  </span>
                </div>

                <div v-if="action.来源" class="action-source">
                  <i class="fa-solid fa-location-dot"></i> {{ action.来源 }}
                </div>

                <div class="action-desc">{{ formatThirdPerson(action.描述) }}</div>

                <div class="action-meta">
                  <div v-if="action.回报预期" class="reward">
                    <i class="fa-solid fa-gift"></i>
                    <span>{{ formatThirdPerson(action.回报预期) }}</span>
                  </div>
                  <div v-if="action.风险评估 && !['无', '无风险', ''].includes(action.风险评估.trim())" class="risk">
                    <i class="fa-solid fa-skull"></i>
                    <span>{{ formatThirdPerson(action.风险评估) }}</span>
                  </div>
                </div>

                <div v-if="action.时限" class="time-limit">
                  <i class="fa-solid fa-clock"></i>
                  <span>{{ action.时限 }}</span>
                </div>
              </div>

              <div class="priority-indicator" :class="`priority-${action.优先级}`">
                <span v-for="n in action.优先级" :key="n">★</span>
              </div>
            </div>
          </div>
        </div>

        <div class="actions-group support-group">
          <div class="group-title">
            <span>稳妥动作</span>
            <span class="group-meta">{{ supportActions.length + 2 }} 项</span>
          </div>

          <div class="permanent-actions">
            <div
              v-for="(action, index) in supportActions"
              :key="`support-${getActionKey(action, index)}`"
              class="action-card support-action"
              :class="[
                `type-${action.类型}`,
                { urgent: action.时限 },
                detectNsfwSubType(action) ? `nsfw-${detectNsfwSubType(action)}` : '',
              ]"
              @click="selectAction(action)"
            >
              <div class="action-icon" :class="detectNsfwSubType(action) ? `icon-nsfw-${detectNsfwSubType(action)}` : `icon-${action.类型}`">
                <i :class="getActionIcon(action.类型, detectNsfwSubType(action))"></i>
              </div>
              <div class="action-info">
                <div class="action-header">
                  <span class="action-name">{{ action.名称 }}</span>
                  <span class="action-type-tag" :class="detectNsfwSubType(action) ? `tag-nsfw-${detectNsfwSubType(action)}` : ''">
                    {{ detectNsfwSubType(action) ? `红颜·${detectNsfwSubType(action)}` : action.类型 }}
                  </span>
                </div>
                <div v-if="action.来源" class="action-source">
                  <i class="fa-solid fa-location-dot"></i> {{ action.来源 }}
                </div>
                <div class="action-desc">{{ formatThirdPerson(action.描述) }}</div>
                <div class="action-meta">
                  <div v-if="action.回报预期" class="reward">
                    <i class="fa-solid fa-gift"></i>
                    <span>{{ formatThirdPerson(action.回报预期) }}</span>
                  </div>
                  <div v-if="action.风险评估 && !['无', '无风险', ''].includes(action.风险评估.trim())" class="risk">
                    <i class="fa-solid fa-skull"></i>
                    <span>{{ formatThirdPerson(action.风险评估) }}</span>
                  </div>
                </div>
                <div v-if="action.时限" class="time-limit">
                  <i class="fa-solid fa-clock"></i>
                  <span>{{ action.时限 }}</span>
                </div>
              </div>
              <div class="priority-indicator" :class="`priority-${action.优先级}`">
                <span v-for="n in action.优先级" :key="n">★</span>
              </div>
            </div>

            <div class="action-card story-action" @click="selectStoryAction">
              <div class="action-icon icon-剧情">
                <i class="fa-solid fa-book-open"></i>
              </div>
              <div class="action-info">
                <div class="action-header">
                  <span class="action-name">📖 顺势而为</span>
                  <span class="action-type-tag">推进</span>
                </div>
                <div class="action-desc">顺应当前局势发展，自然地推进下一步剧情，不刻意节外生枝。</div>
                <div class="action-meta">
                  <div class="reward">
                    <i class="fa-solid fa-forward-step"></i>
                    <span>剧情发展</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="action-card random-action" @click="selectRandomAction">
              <div class="action-icon icon-随机">
                <i class="fa-solid fa-dice"></i>
              </div>
              <div class="action-info">
                <div class="action-header">
                  <span class="action-name">🎲 随缘而行</span>
                  <span class="action-type-tag">随机</span>
                </div>
                <div class="action-desc">暂不定下细策，只循眼前局势随缘而行，也许另有机缘自现。</div>
                <div class="action-meta">
                  <div class="reward">
                    <i class="fa-solid fa-gift"></i>
                    <span>未知机遇</span>
                  </div>
                  <div class="risk">
                    <i class="fa-solid fa-skull"></i>
                    <span>不确定</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDataStore } from '../store';

const store = useDataStore();
const isRefreshing = ref(false);
const currentMessageId = getCurrentMessageId();
const numericCurrentMessageId = typeof currentMessageId === 'number' ? currentMessageId : Number(currentMessageId);
const shouldShowCompanionSupportAction = Number.isFinite(numericCurrentMessageId) ? numericCurrentMessageId > 1 : true;

type OpportunityAction = {
  名称: string;
  来源: string;
  类型: string;
  描述: string;
  回报预期: string;
  风险评估: string;
  时限?: string;
  优先级: number;
};

type JsonPatchOperation = {
  op?: string;
  path?: string;
  value?: unknown;
};

type ActionFeedMode = 'full' | 'partial' | 'none' | 'cleared';
type SituationRefreshState = 'fresh' | 'stale';

const currentMessageContent = ref('');
const currentMessagePatch = ref<JsonPatchOperation[]>([]);
const patchListeners: Array<(() => void) | undefined> = [];
let patchPollTimer: number | null = null;

const ACTION_TYPE_MAP: Record<string, OpportunityAction['类型']> = {
  探索: '探索',
  任务: '任务',
  交易: '交易',
  结交: '结交',
  争夺: '争夺',
  修炼: '修炼',
  红颜: '红颜',
  随机: '随机',
  行动: '探索',
  冒险: '探索',
  机缘: '探索',
  奇遇: '探索',
  采购: '交易',
  邀约: '结交',
  社交: '结交',
  双修: '红颜',
  亲密: '红颜',
  调情: '红颜',
};

const inferActionType = (type: string, text: string): OpportunityAction['类型'] => {
  const mapped = ACTION_TYPE_MAP[type];
  if (mapped) return mapped;
  if (/双修|温存|缠绵|共寝|调情|佳人|道侣|红颜/.test(text)) return '红颜';
  if (/闭关|吐纳|冲关|破境|突破|稳固|悟道|渡劫|根基/.test(text)) return '修炼';
  if (/坊市|商会|交易|买卖|补给|收购|售卖/.test(text)) return '交易';
  if (/争夺|抢夺|斗法|厮杀|追杀|强敌|守擂|比斗/.test(text)) return '争夺';
  if (/任务|委托|悬赏|求援|调查|护送|赴约/.test(text)) return '任务';
  if (/结交|拜访|邀约|会面|结识|论道|同游/.test(text)) return '结交';
  if (/随缘|随机|听天由命/.test(text)) return '随机';
  return '探索';
};

const normalizeAction = (action: Partial<OpportunityAction> | null | undefined): OpportunityAction | null => {
  const 名称 = String(action?.名称 ?? '').trim();
  const 描述 = String(action?.描述 ?? '').trim();
  if (!名称 || !描述) return null;

  const 来源 = String(action?.来源 ?? '').trim();
  const 回报预期 = String(action?.回报预期 ?? '').trim();
  const 风险评估 = String(action?.风险评估 ?? '').trim();
  const 时限 = String(action?.时限 ?? '').trim();
  const 类型原文 = String(action?.类型 ?? '').trim();
  const 类型 = inferActionType(类型原文, [名称, 描述, 来源, 回报预期, 风险评估, 时限].filter(Boolean).join('｜'));
  const 优先级 = _.clamp(Number(action?.优先级 ?? 3) || 3, 1, 5);

  return {
    名称,
    来源,
    类型,
    描述,
    回报预期,
    风险评估,
    时限: 时限 || undefined,
    优先级,
  };
};

const makeAction = (action: Partial<OpportunityAction> & Pick<OpportunityAction, '名称' | '描述'>): OpportunityAction => {
  const normalized = normalizeAction(action);
  if (!normalized) {
    throw new Error(`无效行动定义: ${JSON.stringify(action)}`);
  }
  return normalized;
};

const sortActions = (actions: OpportunityAction[]): OpportunityAction[] => {
  return [...actions].sort((a, b) => {
    if (a.时限 && !b.时限) return -1;
    if (!a.时限 && b.时限) return 1;
    return (b.优先级 || 3) - (a.优先级 || 3);
  });
};

const extractJsonPatch = (content: string): JsonPatchOperation[] => {
  const match = content.match(/<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>/i);
  if (!match) return [];

  const payload = match[1]
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[行动提示] 当前楼层 JSONPatch 解析失败', error);
    return [];
  }
};

const syncCurrentMessagePatch = () => {
  try {
    const messages = getChatMessages(currentMessageId);
    const content = String(messages?.[0]?.message ?? '');
    if (content === currentMessageContent.value) return;
    currentMessageContent.value = content;
    currentMessagePatch.value = extractJsonPatch(content);
  } catch (error) {
    console.warn('[行动提示] 读取当前楼层消息失败', error);
  }
};

// 刷新行动列表
const refreshActions = async () => {
  if (isRefreshing.value) return;
  
  isRefreshing.value = true;
  try {
    // 调用 store 中的强制刷新方法
    if (store.forceRefresh) {
      await store.forceRefresh();
      // toastr.success('行动列表已刷新', '行动提示'); // 用户反馈太烦了
    } else {
      // 回退方案：仅刷新数据
      store.refresh();
      // toastr.info('数据已重新加载', '行动提示'); // 用户反馈太烦了
    }
  } catch (e) {
    console.error('刷新行动列表失败', e);
    // 失败时还是提示一下比较好
    toastr.error('刷新失败', '行动提示');
  } finally {
    window.setTimeout(syncCurrentMessagePatch, 240);
    // 延迟一点结束动画，让用户感知到刷新过程
    setTimeout(() => {
      isRefreshing.value = false;
    }, 500);
  }
};

// 组件挂载时自动刷新一次，确保数据最新
onMounted(() => {
  syncCurrentMessagePatch();

  patchListeners.push(
    eventOn(tavern_events.MESSAGE_UPDATED, id => {
      if (id === currentMessageId) syncCurrentMessagePatch();
    }).stop,
  );
  patchListeners.push(
    eventOn(tavern_events.MESSAGE_RECEIVED, id => {
      if (id === currentMessageId) syncCurrentMessagePatch();
    }).stop,
  );
  patchListeners.push(
    eventOn(tavern_events.MESSAGE_DELETED, id => {
      if (id === currentMessageId) {
        currentMessageContent.value = '';
        currentMessagePatch.value = [];
      }
    }).stop,
  );

  patchPollTimer = window.setInterval(syncCurrentMessagePatch, 1500);

  // 延迟一点执行，避免与页面初始化冲突
  setTimeout(() => {
    refreshActions();
  }, 500);
});

onBeforeUnmount(() => {
  patchListeners.forEach(dispose => {
    try {
      dispose?.();
    } catch {
      // ignore cleanup errors
    }
  });

  if (patchPollTimer !== null) {
    window.clearInterval(patchPollTimer);
  }
});

// NSFW 子类检测：根据名称/描述关键词识别红颜类行动的 NSFW 子分类
type NsfwSubType = '双修' | '亲密' | '调情' | null;
const detectNsfwSubType = (action: { 名称: string; 描述: string; 类型: string }): NsfwSubType => {
  if (action.类型 !== '红颜') return null;
  const text = `${action.名称}${action.描述}`;
  // 双修关键词（修炼相关的亲密行为）
  if (/双修|阴阳交泰|合欢|采补|鼎炉|双生|交融|合道|合炉|共修|双运|欢好/.test(text)) return '双修';
  // 亲密关键词（身体接触、深度互动）
  if (/亲密|缠绵|温存|相拥|依偎|温养|抚慰|肌肤|贴身|共寝|同眠|入帐|春宵|云雨|巫山/.test(text)) return '亲密';
  // 调情关键词（语言/轻度互动）
  if (/调情|挑逗|撩拨|暧昧|情话|戏弄|勾引|媚眼|风情|轻薄|调戏|嬉闹/.test(text)) return '调情';
  return null;
};

// 行动类型图标映射（支持 NSFW 子类覆盖）
const getActionIcon = (type: string, nsfwSub?: NsfwSubType): string => {
  // NSFW 子类优先使用专属图标
  if (nsfwSub) {
    const nsfwIconMap: Record<string, string> = {
      双修: 'fa-solid fa-fire',
      亲密: 'fa-solid fa-hand-holding-heart',
      调情: 'fa-solid fa-kiss-wink-heart',
    };
    return nsfwIconMap[nsfwSub] || 'fa-solid fa-heart';
  }
  const iconMap: Record<string, string> = {
    探索: 'fa-solid fa-mountain-sun',
    任务: 'fa-solid fa-scroll',
    交易: 'fa-solid fa-coins',
    结交: 'fa-solid fa-handshake',
    争夺: 'fa-solid fa-swords',
    修炼: 'fa-solid fa-yin-yang',
    红颜: 'fa-solid fa-heart',
    随机: 'fa-solid fa-dice',
  };
  return iconMap[type] || 'fa-solid fa-question';
};

const hasSituationRefresh = computed(() => {
  return currentMessagePatch.value.some(operation => operation.op === 'replace' && operation.path === '/当前处境');
});

const situationRefreshState = computed<SituationRefreshState>(() => {
  return hasSituationRefresh.value ? 'fresh' : 'stale';
});

const situationBadgeText = computed(() => {
  if (!store.当前处境) return '';
  return hasSituationRefresh.value ? '本轮更新' : '沿用参考';
});

const freshActionState = computed<{ mode: ActionFeedMode; actions: OpportunityAction[] }>(() => {
  const operations = currentMessagePatch.value.filter(operation => typeof operation.path === 'string');
  const replaceAll = operations.find(operation => operation.op === 'replace' && operation.path === '/可参与机遇');

  if (replaceAll) {
    const actions = sortActions(
      (store.可参与机遇 as OpportunityAction[])
        .map(action => normalizeAction(action))
        .filter((action): action is OpportunityAction => !!action),
    );

    return {
      mode: actions.length > 0 ? 'full' : 'cleared',
      actions,
    };
  }

  const clearActionList = operations.some(operation => operation.path === '/可参与机遇' && operation.op === 'remove');
  if (clearActionList) {
    return { mode: 'cleared', actions: [] };
  }

  const touchedIndices: number[] = [];
  operations.forEach(operation => {
    const match = String(operation.path).match(/^\/可参与机遇\/(\d+)$/);
    if (!match) return;
    const index = Number(match[1]);
    if (Number.isInteger(index) && !touchedIndices.includes(index)) {
      touchedIndices.push(index);
    }
  });

  if (touchedIndices.length > 0) {
    const actions = sortActions(
      touchedIndices
        .map(index => normalizeAction((store.可参与机遇 as OpportunityAction[])[index]))
        .filter((action): action is OpportunityAction => !!action),
    );

    return {
      mode: actions.length > 0 ? 'partial' : 'none',
      actions,
    };
  }

  return { mode: 'none', actions: [] };
});

const actionFeedMode = computed<ActionFeedMode>(() => freshActionState.value.mode);
const freshSortedActions = computed(() => freshActionState.value.actions);

const hiddenInheritedActionCount = computed(() => {
  if (actionFeedMode.value !== 'partial') return 0;
  return Math.max(store.可参与机遇.length - freshSortedActions.value.length, 0);
});

const actionSummaryLabel = computed(() => {
  switch (actionFeedMode.value) {
    case 'full':
      return `${freshSortedActions.value.length} 项本轮机遇`;
    case 'partial':
      return `${freshSortedActions.value.length} 项已刷新`;
    case 'cleared':
      return '本轮机遇已清空';
    default:
      return '仅保留稳妥动作';
  }
});

const supportActions = computed<OpportunityAction[]>(() => {
  const actions: OpportunityAction[] = [];
  const protagonist = store.本尊 as Record<string, any>;
  const currentArea = String(protagonist?.行踪?.当前区域 ?? '').trim();
  const cultivationStage = String(protagonist?.修炼状态?.阶段 ?? '').trim();
  const threshold = Number(protagonist?.突破阈值 ?? 0) || 0;
  const currentCultivation = Number(protagonist?.修为 ?? 0) || 0;
  const cultivationRatio = threshold > 0 ? currentCultivation / threshold : 0;
  const currentEnemies = protagonist?.当前敌人 ?? [];

  if (protagonist?.战斗状态?.正在战斗) {
    const enemyNames = currentEnemies.map((enemy: any) => enemy?.名称).filter(Boolean).join('、') || '眼前强敌';
    return [
      makeAction({
        名称: '稳住战局',
        类型: '争夺',
        来源: '战斗态势',
        描述: `先稳住与${enemyNames}的攻守节奏，试探破绽，再顺势出手。`,
        回报预期: '守住主动，不至于被一波打乱节奏',
        风险评估: '稍有迟疑便可能露出空门',
        优先级: 5,
      }),
      makeAction({
        名称: '逼出底牌',
        类型: '争夺',
        来源: '战斗态势',
        描述: `借几次虚实变化逼${enemyNames}先交底牌，再决定下一步压制方向。`,
        回报预期: '看清敌手手段',
        风险评估: '若试探失手，战局会更凶险',
        优先级: 4,
      }),
    ];
  }

  if (protagonist?.渡劫状态?.正在渡劫) {
    return [
      makeAction({
        名称: '稳住劫势',
        类型: '修炼',
        来源: '渡劫进程',
        描述: '收束心神与灵力，先把眼前劫势稳住，不急着硬碰硬抢节奏。',
        回报预期: '减轻后续天劫连锁压力',
        风险评估: '若气机再乱，后面只会更难接',
        优先级: 5,
      }),
      makeAction({
        名称: '借劫炼体',
        类型: '修炼',
        来源: '渡劫进程',
        描述: '趁雷火未散，将一部分劫力引入肉身与经脉，试着把危机炼成根基。',
        回报预期: '渡劫后根基更稳，或能留下额外裨益',
        风险评估: '承受过头便会伤及本源',
        优先级: 4,
      }),
    ];
  }

  if (cultivationStage === '突破中' || cultivationStage === '瓶颈中' || cultivationRatio >= 0.85) {
    actions.push(
      makeAction({
        名称: cultivationStage === '突破中' ? '一鼓作气冲关' : '收束心神破瓶颈',
        类型: '修炼',
        来源: '修炼进程',
        描述:
          cultivationStage === '突破中'
            ? '把散开的心念重新拢住，顺着最稳的气机一路冲关，不再分心旁顾。'
            : '暂且压下杂念，把积累一点点捋顺，看看这一层关窍到底卡在何处。',
        回报预期: cultivationStage === '突破中' ? '尽快见到破境结果' : '理清瓶颈脉络，为真正冲关做准备',
        风险评估: cultivationStage === '突破中' ? '急躁冒进反而容易岔气' : '若操之过急，只会让瓶颈更紧',
        优先级: 5,
      }),
    );
  } else {
    actions.push(
      makeAction({
        名称: '静心运转周天',
        类型: '修炼',
        来源: '修炼进程',
        描述: '先不急着折腾旁枝，将眼前气息与周天运转重新理顺，稳扎稳打地积蓄修为。',
        回报预期: '修为缓步增长，根基更稳',
        风险评估: '无',
        优先级: 4,
      }),
    );
  }

  const activeQuests = Object.values(store.任务列表 || {}) as Array<{
    名称?: string;
    类型?: string;
    目标?: string;
    状态?: string;
  }>;
  const targetQuest =
    activeQuests.find(quest => quest.类型 === '主线' && quest.状态 === '进行中') ||
    activeQuests.find(quest => quest.状态 === '进行中');

  if (targetQuest?.名称) {
    const questName = String(targetQuest.名称).trim();
    const questTarget = String(targetQuest.目标 ?? '').trim();
    actions.push(
      makeAction({
        名称: `推进${questName}`,
        类型: '任务',
        来源: '进行中任务',
        描述: questTarget ? `先沿着“${questTarget}”这条线往前推，别让当前主线在这里断掉。`
          : `把“${questName}”这件事继续往前推，先让局势动起来再看新的岔口。`,
        回报预期: '剧情主线继续展开',
        风险评估: '若判断失误，可能会提前撞上新的麻烦',
        优先级: 5,
      }),
    );
  }

  const topCompanion = _(store.红颜 || {})
    .entries()
    .sortBy(([, companion]) => -(Number(companion?.好感度 ?? 0) || 0))
    .head();

  if (shouldShowCompanionSupportAction && topCompanion?.[0]) {
    actions.push(
      makeAction({
        名称: `探问${topCompanion[0]}心意`,
        类型: '红颜',
        来源: '人物关系',
        描述: `顺着眼前话头与${topCompanion[0]}多言几句，试看她此刻心绪与态度究竟偏向何方。`,
        回报预期: '看清彼此情分深浅，或引出新的转机',
        风险评估: '若时机拿捏不好，也可能引来误会',
        优先级: 3,
      }),
    );
  }

  if (currentArea) {
    const isMarketArea = /坊|市|城|楼|阁|商会|渡口|集/.test(currentArea);
    actions.push(
      makeAction({
        名称: isMarketArea ? '整备所需' : `察看${currentArea}周遭`,
        类型: isMarketArea ? '交易' : '探索',
        来源: currentArea,
        描述: isMarketArea
          ? `既已身在${currentArea}，不妨将所缺丹药、符箓与消息门路一并补备妥当。`
          : `不必急于远行，先将${currentArea}周遭细细查看一遍，或有先前遗漏的线索与暗门。`,
        回报预期: isMarketArea ? '补齐所需资源，顺势探得消息' : '发现隐线，或逢细微机缘',
        风险评估: isMarketArea ? '无' : '若惊动暗伏之物，可能平地起波澜',
        优先级: 3,
      }),
    );
  }

  return _(actions)
    .uniqBy(action => action.名称)
    .take(4)
    .value();
});

const getActionKey = (action: unknown, index: number): string => {
  return `${JSON.stringify(action)}|${index}`;
};

// 写入本轮回应草稿
const writeReplyDraft = (text: string) => {
  const parent$ = (window.parent as typeof window & { $: typeof $ }).$;
  const $textarea = parent$('#send_textarea');
  if ($textarea.length) {
    const textarea = $textarea[0] as HTMLTextAreaElement | undefined;
    if (!textarea) return;
    textarea.value = text;

    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));

    $textarea.trigger('input');
    $textarea.trigger('change');

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;

    let retry = 0;
    const maxRetry = 20;
    const restoreHeightWhenCleared = () => {
      if (!textarea.value) {
        textarea.style.height = '';
        return;
      }
      retry += 1;
      if (retry < maxRetry) {
        window.setTimeout(restoreHeightWhenCleared, 300);
      }
    };
    window.setTimeout(restoreHeightWhenCleared, 300);

    textarea.focus();
    console.info('[行动提示] 已写入回应草稿:', text);
    toastr.success('已写入回应草稿', '行动选择');
  } else {
    console.warn('[行动提示] 未找到回应输入框');
    toastr.warning('未找到回应输入框', '行动选择');
  }
};

// 从候选池中随机选一个
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// 辅助函数：移除字符串末尾的标点符号
const trimPunctuation = (str: string) => {
  return str.replace(/[，。！？；：、,.!?;:]+$/, '').trim();
};

const trimLeadWords = (str: string) => {
  return String(str)
    .trim()
    .replace(/^(?:眼下|此刻|这时|当下|现下|眼前|一时间)[，,、\s]*/, '')
    .trim();
};

const compareClause = (str: string) => {
  return trimLeadWords(str).replace(/[，。！？；：、,.!?;:\s]/g, '');
};

// 获取玩家名字
const getUserName = () => {
  try {
    // 尝试从酒馆全局变量中获取玩家名字
    const name = SillyTavern.name1;
    return name || '本尊';
  } catch (e) {
    console.warn('[行动提示] 获取玩家名字失败，回退到默认称呼', e);
    return '本尊';
  }
};

// 转换为第三人称
const formatThirdPerson = (text: string) => {
  if (!text) return '';
  const userName = getUserName();
  return text.replace(/你/g, userName);
};

const buildSceneLead = () => {
  if (store.当前处境) {
    return trimPunctuation(trimLeadWords(formatThirdPerson(store.当前处境)));
  }
  if (store.本尊?.行踪?.当前区域) {
    return `身在${store.本尊.行踪.当前区域}`;
  }
  return '';
};

const normalizeActionDescription = (text: string, sceneLead: string) => {
  const clauses = trimPunctuation(formatThirdPerson(text))
    .split(/[，。！？；：、]/)
    .map(clause => trimLeadWords(clause))
    .filter(Boolean);

  const sceneCompare = compareClause(sceneLead);
  const filteredClauses = clauses.filter(clause => {
    const current = compareClause(clause);
    return current && current !== sceneCompare && !sceneCompare.includes(current);
  });

  const normalized = (filteredClauses.length > 0 ? filteredClauses : clauses)
    .join('，')
    .replace(/^(?:可先|可与|可往|可去|可沿着|可循着)/, match => match.replace(/^可/, ''))
    .replace(/^(?:可|不妨|宜|先可)/, '');

  return trimPunctuation(normalized);
};

const narrateRewardExpectation = (reward: string) => {
  const normalized = trimPunctuation(formatThirdPerson(reward));
  if (!normalized) return '';

  if (/^(?:获得|推进|稳住|稳固|看清|理清|发现|补齐|减轻|尽快|守住|带出|结下|见到|探明|探得|冲开|缓和|引出|避开|寻到|找到|争来)/.test(normalized)) {
    return pick([
      `，借此${normalized}`,
      `，也好${normalized}`,
      `，看能不能${normalized}`,
    ]);
  }

  return pick([
    `，兴许能换来${normalized}`,
    `，也算图个${normalized}`,
    `，看看能否换得${normalized}`,
  ]);
};

const composeActionNarration = (action: OpportunityAction) => {
  const userName = getUserName();
  const name = trimPunctuation(action.名称);
  const sceneLead = buildSceneLead();
  const desc = normalizeActionDescription(action.描述, sceneLead);
  const parts: string[] = [];

  if (sceneLead) {
    parts.push(`${sceneLead}。`);
  }

  if (!desc) {
    parts.push(
      pick([
        `${userName}没有继续迟疑，便沿着这条线索往前探去`,
        `${userName}把心神一收，先从这一步着手`,
        `${userName}顺着当下脉络，先把这件事接了下来`,
      ]),
    );
  } else if (desc.includes(name)) {
    parts.push(
      pick([
        `${userName}便顺势而动，${desc}`,
        `${userName}不再旁观，${desc}`,
        `${userName}心念一定，${desc}`,
      ]),
    );
  } else {
    parts.push(
      pick([
        `${userName}先把心思落到${name}上，${desc}`,
        `${userName}顺着${name}这条线往前探去，${desc}`,
        `${userName}略作权衡，还是先从${name}这一着起手，${desc}`,
      ]),
    );
  }

  if (action.回报预期) {
    parts.push(narrateRewardExpectation(action.回报预期));
  }

  if (action.时限) {
    const timeLimit = trimPunctuation(action.时限);
    parts.push(`。此事拖不得，最好在${timeLimit}前见个分晓`);
  }

  parts.push(pick(['。', '，再看局势如何回转。', '，余下便看后势如何应声而动。']));
  return parts.join('');
};

// 选择行动
const selectAction = (action: OpportunityAction) => {
  const actionText = composeActionNarration(action);
  writeReplyDraft(actionText);
  console.info('[行动提示] 选择行动:', action, '文本长度:', actionText.length);
};

// 选择顺势而为（推剧情）
const selectStoryAction = () => {
  let actionText = '';
  const userName = getUserName();
  
  // 1. 优先判断紧急状态（战斗/渡劫）
  if (store.本尊?.战斗状态?.正在战斗) {
    const enemies = store.本尊.当前敌人 || [];
    const enemyNames = enemies.map(e => e.名称).join('、') || '强敌';
    actionText = `眼下正与${enemyNames}鏖战不休，${userName}无暇旁顾，只得把全部心神都收回眼前攻守之间，先稳住节奏，再寻那一线破局之机。`;
  } else if (store.本尊?.渡劫状态?.正在渡劫) {
    actionText = `天威浩荡，劫云压顶，${userName}不敢有半分分心，只把气机与灵力一并调匀，先撑过眼前劫势，再图后续破境之机。`;
  } else {
    const sceneLead = buildSceneLead();
    if (sceneLead) {
      actionText += `${sceneLead}。`;
    }

    const quests = Object.values(store.任务列表 || {});
    const mainQuest = quests.find(q => q.类型 === '主线' && q.状态 === '进行中');
    const anyQuest = quests.find(q => q.状态 === '进行中');
    const targetQuest = mainQuest || anyQuest;

    if (targetQuest) {
      const questName = trimPunctuation(targetQuest.名称);
      const questTarget = trimPunctuation(targetQuest.目标);
      const questPhrases = [
        `${userName}心中仍记挂着“${questName}”这条线，索性顺着局势继续往“${questTarget}”上推进，不另起枝节。`,
        `${userName}暂且不绕远路，只把心思放回“${questName}”一事，沿着“${questTarget}”稳稳往前推去。`,
      ];
      actionText += pick(questPhrases);
    } else {
      const storyPhrases = [
        `${userName}并不急着另起波澜，只顺着眼前局势自然往前走，先把手头这一层事情稳稳接住。`,
        `${userName}把多余念头暂且按下，只照着眼前最顺的一条路往前行，见招拆招，让事情自己显出下一步脉络。`,
        `${userName}静观其变，不作过激之举，只循着事情原本的走势继续前行，看看局势会往哪边自然倾斜。`,
      ];
      actionText += pick(storyPhrases);
    }
  }
  
  writeReplyDraft(actionText);
  console.info('[行动提示] 选择顺势而为，文本长度:', actionText.length);
};

// 选择随缘而行
const selectRandomAction = () => {
  let actionText = '';
  const userName = getUserName();
  
  const sceneLead = buildSceneLead();
  if (sceneLead) {
    actionText += `${sceneLead}。`;
  }
  
  const randomPhrases = [
    `${userName}一时也无甚明确打算，索性顺着眼前天地随缘走一遭。不刻意强求机缘，只看这一路上会不会自有波澜与造化浮出水面。`,
    `${userName}暂且把杂念放下，不先设定死路数，只顺其自然在周遭缓步细察，看看暗处是否藏着未被点破的线索。`,
    `${userName}不拘泥于既定盘算，只放松心神，随缘而动。若这一程里真有机缘与变数，多半也会自己露出端倪。`,
  ];
  
  actionText += pick(randomPhrases);
  
  writeReplyDraft(actionText);
  console.info('[行动提示] 选择随缘而行，文本长度:', actionText.length);
};
</script>

<style lang="scss" scoped>
.action-menu-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px;
}

// 区块通用样式
.situation-section,
.actions-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-accent);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  .title-left {
    display: flex;
    align-items: center;
    gap: 8px;
    
    i {
      color: var(--accent-color);
    }
  }

  .title-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toggle-btn {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 12px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;

    i {
      font-size: 14px;
    }

    &:hover {
      border-color: var(--border-active);
      color: var(--text-primary);
    }

    &.active {
      color: #4ade80;
      border-color: rgba(74, 222, 128, 0.3);
      background: rgba(74, 222, 128, 0.05);
    }
  }

  .refresh-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: var(--button-bg);
      color: var(--accent-color);
    }
    
    i {
      font-size: 12px;
      color: inherit;
    }
  }

  .action-count {
    font-size: 12px;
    font-weight: normal;
    color: var(--text-secondary);
    background: var(--button-bg);
    padding: 2px 8px;
    border-radius: 10px;
  }
}

.section-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: normal;
  line-height: 1;
  border: 1px solid transparent;

  &.mode-fresh {
    color: #93c5fd;
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(96, 165, 250, 0.25);
  }

  &.mode-stale {
    color: var(--text-secondary);
    background: rgba(148, 163, 184, 0.12);
    border-color: rgba(148, 163, 184, 0.2);
  }
}

// 当前处境
.situation-content {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.6;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.status-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid transparent;

  i {
    font-size: 14px;
    margin-top: 2px;
  }

  &.warn {
    background: rgba(245, 158, 11, 0.08);
    border-color: rgba(245, 158, 11, 0.2);

    i,
    strong {
      color: #f59e0b;
    }
  }

  &.info {
    background: rgba(96, 165, 250, 0.08);
    border-color: rgba(96, 165, 250, 0.18);

    i,
    strong {
      color: #93c5fd;
    }
  }
}

.banner-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  strong {
    font-size: 12px;
    font-weight: 700;
  }

  span {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
  }
}

.actions-group {
  display: flex;
  flex-direction: column;
  gap: 10px;

  & + & {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px dashed var(--border-color);
  }
}

.group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}

.group-meta {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
}

// 无行动提示
.no-actions {
  text-align: center;
  padding: 30px 20px;
  color: var(--text-secondary);

  i {
    font-size: 36px;
    margin-bottom: 12px;
    color: var(--accent-color);
    opacity: 0.5;
  }

  p {
    margin: 4px 0;
    font-size: 14px;
  }

  .hint {
    font-size: 12px;
    color: var(--text-secondary);
    opacity: 0.8;
  }

  &.disabled-state {
    i {
      color: var(--text-secondary);
      opacity: 0.3;
    }
  }

  &.compact {
    padding: 20px 16px;

    i {
      font-size: 24px;
      margin-bottom: 8px;
    }

    p {
      font-size: 13px;
    }
  }
}

// 行动卡片列表
.action-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

// 行动卡片
.action-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    border-color: var(--border-active);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0);
  }

  // 紧急任务样式
  &.urgent {
    border-color: #ff6b6b;
    background: linear-gradient(135deg, var(--bg-primary) 0%, rgba(255, 107, 107, 0.1) 100%);

    .time-limit {
      animation: pulse 2s infinite;
    }
  }

  // NSFW 子类卡片边框发光
  &.nsfw-双修 {
    border-color: rgba(219, 39, 119, 0.4);
    &:hover {
      border-color: #db2777;
      box-shadow: 0 4px 16px rgba(219, 39, 119, 0.25);
    }
  }
  &.nsfw-亲密 {
    border-color: rgba(192, 38, 211, 0.3);
    &:hover {
      border-color: #c026d3;
      box-shadow: 0 4px 16px rgba(192, 38, 211, 0.2);
    }
  }
  &.nsfw-调情 {
    border-color: rgba(225, 29, 72, 0.3);
    &:hover {
      border-color: #e11d48;
      box-shadow: 0 4px 16px rgba(225, 29, 72, 0.2);
    }
  }

  // 随缘而行特殊样式
  &.random-action {
    border-style: dashed;
    opacity: 0.85;

    &:hover {
      opacity: 1;
      border-style: solid;
    }
  }

  // 顺势而为特殊样式
  &.story-action {
    border-color: rgba(168, 85, 247, 0.4);
    background: linear-gradient(135deg, var(--bg-primary) 0%, rgba(168, 85, 247, 0.05) 100%);

    &:hover {
      border-color: #a855f7;
      box-shadow: 0 4px 12px rgba(168, 85, 247, 0.15);
    }
  }
}

// 常驻选项区域
.permanent-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.support-action {
  border-style: dashed;
  opacity: 0.92;

  &:hover {
    opacity: 1;
    border-style: solid;
  }
}

// 行动图标
.action-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  i {
    font-size: 18px;
    color: #fff;
  }

  // 不同类型的颜色
  &.icon-探索 {
    background: linear-gradient(135deg, #4ade80, #22c55e);
  }
  &.icon-任务 {
    background: linear-gradient(135deg, #60a5fa, #3b82f6);
  }
  &.icon-交易 {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
  }
  &.icon-结交 {
    background: linear-gradient(135deg, #a78bfa, #8b5cf6);
  }
  &.icon-争夺 {
    background: linear-gradient(135deg, #f87171, #ef4444);
  }
  &.icon-修炼 {
    background: linear-gradient(135deg, #38bdf8, #0ea5e9);
  }
  &.icon-红颜 {
    background: linear-gradient(135deg, #fb7185, #f43f5e);
  }
  // NSFW 子类图标样式
  &.icon-nsfw-双修 {
    background: linear-gradient(135deg, #f472b6, #db2777);
    box-shadow: 0 0 8px rgba(219, 39, 119, 0.4);
  }
  &.icon-nsfw-亲密 {
    background: linear-gradient(135deg, #e879f9, #c026d3);
    box-shadow: 0 0 8px rgba(192, 38, 211, 0.4);
  }
  &.icon-nsfw-调情 {
    background: linear-gradient(135deg, #ff6b9d, #e11d48);
    box-shadow: 0 0 8px rgba(225, 29, 72, 0.3);
  }
  &.icon-随机 {
    background: linear-gradient(135deg, #94a3b8, #64748b);
  }
  &.icon-剧情 {
    background: linear-gradient(135deg, #c084fc, #9333ea);
  }
}

// 行动信息
.action-info {
  flex: 1;
  min-width: 0;
}

.action-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.action-name {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.action-type-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--button-bg);
  color: var(--text-secondary);
  border-radius: 4px;

  // NSFW 子类标签样式
  &.tag-nsfw-双修 {
    background: linear-gradient(135deg, rgba(244, 114, 182, 0.2), rgba(219, 39, 119, 0.2));
    color: #f472b6;
    border: 1px solid rgba(219, 39, 119, 0.3);
  }
  &.tag-nsfw-亲密 {
    background: linear-gradient(135deg, rgba(232, 121, 249, 0.2), rgba(192, 38, 211, 0.2));
    color: #e879f9;
    border: 1px solid rgba(192, 38, 211, 0.3);
  }
  &.tag-nsfw-调情 {
    background: linear-gradient(135deg, rgba(255, 107, 157, 0.2), rgba(225, 29, 72, 0.2));
    color: #ff6b9d;
    border: 1px solid rgba(225, 29, 72, 0.3);
  }
}

.action-source {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;

  i {
    margin-right: 4px;
    color: var(--accent-color);
  }
}

.action-desc {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// 回报与风险
.action-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;

  .reward,
  .risk {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .reward {
    color: #4ade80;

    i {
      color: #fbbf24;
    }
  }

  .risk {
    color: #f87171;

    i {
      color: #ef4444;
    }
  }
}

// 时限警告
.time-limit {
  margin-top: 6px;
  font-size: 11px;
  color: #ff6b6b;
  display: flex;
  align-items: center;
  gap: 4px;

  i {
    color: #ff6b6b;
  }
}

// 优先级指示器
.priority-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  color: var(--accent-color);
  opacity: 0.6;

  &.priority-5 {
    color: #fbbf24;
    opacity: 1;
  }
  &.priority-4 {
    color: #fb923c;
  }
  &.priority-3 {
    color: var(--accent-color);
  }
}

// 脉冲动画
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

// 手机端适配
@media screen and (max-width: 480px) {
  .action-menu-panel {
    gap: 12px;
  }

  .situation-section,
  .actions-section {
    padding: 12px;
  }

  .section-title {
    font-size: 13px;
    margin-bottom: 10px;
    align-items: flex-start;

    .title-right {
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  }

  .action-card {
    padding: 10px;
    gap: 10px;
  }

  .action-icon {
    width: 36px;
    height: 36px;

    i {
      font-size: 16px;
    }
  }

  .action-name {
    font-size: 13px;
  }

  .action-desc {
    font-size: 11px;
  }

  .action-meta {
    font-size: 10px;
    gap: 8px;
  }

  .status-banner {
    padding: 10px;
  }

  .group-title {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}
</style>
