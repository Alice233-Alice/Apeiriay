import { Schema } from '../踏月寻仙-测试版/schema';

const SCRIPT_NAME = '难度系统控制';

let isWriting = false;
let ignoreNextForMessageKey: string | null = null;
const processedSignatures = new Set<string>();

function addProcessedSignature(signature: string) {
    processedSignatures.add(signature);
    if (processedSignatures.size > 200) {
        const first = processedSignatures.values().next().value as string | undefined;
        if (first) processedSignatures.delete(first);
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function buildWarning(finalFactor: number): string {
    if (finalFactor <= 0.82) return '天道垂青，风浪稍息，可稳步行事。';
    if (finalFactor <= 0.95) return '阻力稍缓，仍需谨慎，切莫贪进。';
    if (finalFactor < 1.08) return '天道运转如常，万物循理。';
    if (finalFactor < 1.2) return '天道隐有压迫，行事宜稳，勿露锋芒。';
    return '天道排斥加剧，强敌环伺，宜避其锋。';
}

function processDifficultyState(difficulty: ReturnType<typeof Schema.parse>['难度系统']) {
    const next = _.cloneDeep(difficulty);

    const balance = next._难度系统内部数据.平衡保护;
    const strategy = next._难度系统内部数据.动态策略;
    const snapshot = next._难度系统内部数据.难度结算快照;

    const probe = next.天道感应;

    if (balance.冷却剩余回合 > 0) balance.冷却剩余回合 -= 1;
    if (balance.生效剩余回合 > 0) balance.生效剩余回合 -= 1;

    if (probe === '受挫') {
        if (balance.冷却剩余回合 <= 0) {
            balance.连续受挫计数 += 1;
        }
    } else if (probe === '顺遂') {
        balance.连续受挫计数 = 0;
    }

    if (balance.连续受挫计数 >= balance.触发阈值 && balance.冷却剩余回合 <= 0 && balance.生效剩余回合 <= 0) {
        balance.生效剩余回合 = 2;
        balance.冷却剩余回合 = 3;
        balance.连续受挫计数 = 0;
    }

    const baseline = snapshot.回合基线系数 || 1.0;
    const prevFinal = snapshot.本回合最终系数 || 1.0;

    let target = baseline;
    if (probe === '顺遂') target += 0.08;
    if (probe === '受挫') target -= 0.08;
    if (balance.生效剩余回合 > 0) target -= 0.12;

    target = clamp(target, 0.7, 1.3);

    // 平滑限幅：单回合变化受控，避免断崖跳变
    const maxDelta = clamp(strategy.单回合改变量上限, 0.01, 0.3);
    let finalFactor = clamp(target, prevFinal - maxDelta, prevFinal + maxDelta);

    // 无探针时自然向基线回落
    if (probe === '平稳') {
        const fallback = clamp(strategy.自然回落速度, 0.005, 0.2);
        if (finalFactor > baseline) finalFactor = Math.max(baseline, finalFactor - fallback);
        if (finalFactor < baseline) finalFactor = Math.min(baseline, finalFactor + fallback);
    }

    snapshot.分层来源.世界叙事层 = 1.0;
    snapshot.分层来源.玩家偏好层 = 1.0;
    snapshot.分层来源.短期状态层 = clamp(finalFactor, 0.7, 1.3);
    snapshot.本回合最终系数 = clamp(finalFactor, 0.7, 1.3);
    next.环境高压警告 = buildWarning(snapshot.本回合最终系数);

    // 消费探针，避免重复计数
    if (probe !== '平稳') {
        next.天道感应 = '平稳';
    }

    return next;
}

async function handleDifficultyUpdate() {
    if (isWriting) return;

    const latest = getChatMessages(-1)[0];
    if (!latest || latest.role !== 'assistant' || latest.is_hidden) return;

    const chatId = SillyTavern.getCurrentChatId();
    const messageId = latest.message_id;
    const messageKey = `${chatId}:${messageId}`;

    if (ignoreNextForMessageKey === messageKey) {
        ignoreNextForMessageKey = null;
        return;
    }

    const variableOption: { type: 'message'; message_id: number } = { type: 'message', message_id: messageId };
    const variables = getVariables(variableOption);
    const statData = _.get(variables, 'stat_data', null);
    if (!statData || typeof statData !== 'object') return;

    let parsed: ReturnType<typeof Schema.parse>;
    try {
        parsed = Schema.parse(statData);
    } catch (e) {
        console.warn(`[${SCRIPT_NAME}] stat_data 解析失败，跳过本轮`, e);
        return;
    }

    const oldDifficulty = _.cloneDeep(parsed.难度系统);
    const signature = `${messageKey}:${oldDifficulty.天道感应}`;
    if (processedSignatures.has(signature)) return;

    const nextDifficulty = processDifficultyState(oldDifficulty);
    if (_.isEqual(oldDifficulty, nextDifficulty)) return;

    _.set(variables, 'stat_data.难度系统', nextDifficulty);

    isWriting = true;
    try {
        addProcessedSignature(signature);
        ignoreNextForMessageKey = messageKey;
        replaceVariables(variables, variableOption);
        console.info(`[${SCRIPT_NAME}] 已更新难度状态`, {
            消息楼层: messageId,
            最终系数: nextDifficulty._难度系统内部数据.难度结算快照.本回合最终系数,
            受挫计数: nextDifficulty._难度系统内部数据.平衡保护.连续受挫计数,
            缓冲剩余: nextDifficulty._难度系统内部数据.平衡保护.生效剩余回合,
        });
    } finally {
        // 轻微延后释放，规避同一轮连锁事件递归
        setTimeout(() => {
            isWriting = false;
        }, 60);
    }
}

$(() => {
    errorCatched(async () => {
        await waitGlobalInitialized('Mvu');
        console.info(`[${SCRIPT_NAME}] MVU 已初始化，开始监听变量更新`);

        const off = eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, async () => {
            await handleDifficultyUpdate();
        });

        $(window).on('pagehide', () => {
            off.stop();
        });
    })();
});
