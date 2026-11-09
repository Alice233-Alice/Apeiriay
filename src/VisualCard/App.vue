<template>
    <div class="visual-card-container">
        <Card v-for="(card, index) in cards" :key="index" :data="card" />
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Card from './Card.vue';

interface VisualCardData {
    name: string;
    img_code: string;
    back_text: string;
}

const cards = ref<VisualCardData[]>([]);

onMounted(async () => {
    // 获取当前消息 ID
    const messageId = getCurrentMessageId();
    if (messageId === undefined) return;

    // 获取消息内容
    // getChatMessages 返回的是数组，如果 messageId 是索引，需要确认 getChatMessages(messageId) 的行为
    // 根据定义：getChatMessages(range) 返回 ChatMessage[]
    // 如果 range 是数字，返回该楼层的消息数组（可能包含 swipes）
    const messages = getChatMessages(messageId);
    if (!messages || messages.length === 0) return;

    // 取第一条（当前显示的消息）
    const message = messages[0];
    const content = message.message; // ChatMessage 使用 message 字段，而不是 mes

    // 解析 content 中的 <visual_cards> 标签
    const regex = /<visual_cards>([\s\S]*?)<\/visual_cards>/;
    const match = content.match(regex);

    if (match && match[1]) {
        try {
            const jsonStr = match[1].trim();
            const parsedData = JSON.parse(jsonStr);
            if (Array.isArray(parsedData)) {
                cards.value = parsedData;
            }
        } catch (e) {
            console.error('Failed to parse visual cards JSON:', e);
        }
    }
});
</script>

<style scoped>
.visual-card-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
    padding: 20px;
    width: 100%;
}
</style>