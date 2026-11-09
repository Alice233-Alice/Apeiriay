<template>
    <div class="visual-card" :class="{ flipped: isFlipped }" @click="toggleFlip">
        <div class="card-inner">
            <div class="card-front">
                <img :src="getImageSrc(data.img_code)" :alt="data.name" class="card-image" />
                <div class="card-name">{{ data.name }}</div>
            </div>
            <div class="card-back">
                <div class="back-content">
                    <p class="back-text">{{ data.back_text }}</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface VisualCardData {
    name: string;
    img_code: string;
    back_text: string;
}

const props = defineProps<{
    data: VisualCardData;
}>();

const isFlipped = ref(false);

const toggleFlip = () => {
    isFlipped.value = !isFlipped.value;
};

// 这里需要一个映射表或者根据 img_code 生成路径的逻辑
// 假设图片放在 public/visual_cards/ 或者某个特定的 URL 下
// 根据用户需求，这里应该有一个预设列表，但目前先用占位符或者简单的路径映射
const getImageSrc = (code: string) => {
    // 实际项目中可能需要根据 code 映射到具体的图片 URL
    // 这里暂时假设图片名为 code.png，放在 assets 目录下（需要 webpack 处理）
    // 或者直接返回一个占位图 URL
    // 由于我们不知道用户的具体图片资源，这里先返回一个基于 name 和 code 的占位图服务，或者留空待填
    return `https://placehold.co/200x300?text=${encodeURIComponent(props.data.name + '\n' + code)}`;
};
</script>

<style scoped lang="scss">
.visual-card {
    width: 150px;
    height: 220px;
    perspective: 1000px;
    cursor: pointer;
    margin: 10px;

    .card-inner {
        position: relative;
        width: 100%;
        height: 100%;
        text-align: center;
        transition: transform 0.6s;
        transform-style: preserve-3d;
    }

    &.flipped .card-inner {
        transform: rotateY(180deg);
    }

    .card-front,
    .card-back {
        position: absolute;
        width: 100%;
        height: 100%;
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
        border-radius: 10px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .card-front {
        background-color: #fff;

        .card-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .card-name {
            position: absolute;
            bottom: 0;
            width: 100%;
            background: rgba(0, 0, 0, 0.5);
            color: white;
            padding: 5px 0;
            font-size: 14px;
        }
    }

    .card-back {
        background-color: #f8f9fa;
        color: #333;
        transform: rotateY(180deg);
        padding: 15px;

        .back-content {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
        }

        .back-text {
            font-size: 14px;
            line-height: 1.4;
        }
    }
}
</style>