<template><JourneyTrail /><AffairsActions inline /></template>
<script setup lang="ts">
import AffairsActions from './AffairsActions.vue';
import JourneyTrail from './JourneyTrail.vue';
defineProps<{ rawMessage: string }>();
</script>
