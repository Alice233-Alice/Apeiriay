<template>
  <div class="panel skills-panel">
    <div v-if="allSkills.length > 0" class="skills-list">
      <div v-for="item in allSkills" :key="item.key" class="skill-strip" :class="`rank-tier-${item.rankTier}`">
        <div class="skill-header">
          <div class="skill-title-group">
            <span class="skill-name">{{ item.name }}</span>
            <span v-if="item.typeLabel !== '神通'" class="skill-type">· {{ item.typeLabel }}</span>
          </div>
          <span class="skill-rank">{{ item.rankLabel }}</span>
        </div>

        <div class="skill-desc">{{ item.description }}</div>

        <div class="skill-meta">
          <span class="skill-proficiency">熟练度：{{ item.proficiency }}</span>
          <span class="proficiency-pips" aria-hidden="true">
            <i v-for="step in 5" :key="step" class="pip" :class="{ filled: step <= item.proficiencyLevel }"></i>
          </span>
        </div>
      </div>
    </div>

    <div v-else class="empty-hint">尚未领悟任何神通</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDataStore } from '../store';

type RankTier = 'heaven' | 'earth' | 'mystic' | 'yellow' | 'mortal';

interface ParsedSkillItem {
  key: string;
  name: string;
  description: string;
  typeLabel: '功法' | '神通' | '秘术';
  rankLabel: string;
  rankTier: RankTier;
  proficiency: string;
  proficiencyLevel: number;
}

const store = useDataStore();

const PROFICIENCY_LEVELS: Record<string, number> = {
  入门: 1,
  初窥: 1,
  熟练: 2,
  小成: 2,
  精通: 3,
  融会: 3,
  大成: 4,
  炉火纯青: 4,
  圆满: 5,
  大圆满: 5,
  化境: 5,
  返璞归真: 5,
};

function resolveRankTier(rankRaw: string): RankTier {
  const text = rankRaw.trim();
  if (/先天|圣|仙|天|神|帝|至尊/u.test(text)) return 'heaven';
  if (/地|灵|上品|真/u.test(text)) return 'earth';
  if (/玄|中品|法/u.test(text)) return 'mystic';
  if (/黄|下品/u.test(text)) return 'yellow';
  return 'mortal';
}

function resolveProficiencyLevel(raw: string): number {
  const clean = raw.trim();
  if (PROFICIENCY_LEVELS[clean]) return PROFICIENCY_LEVELS[clean];
  for (const [label, level] of Object.entries(PROFICIENCY_LEVELS)) {
    if (clean.includes(label)) return level;
  }
  return 1;
}

const allSkills = computed<ParsedSkillItem[]>(() => {
  const rawMap = store.本尊.神通列表 ?? {};
  return Object.entries(rawMap)
    .filter(([key]) => Boolean(key && String(key).trim()))
    .map(([key, skill]) => {
      const name = String(skill?.名称 || key).trim();
      const rankLabel = String(skill?.品阶 || '凡').trim() || '凡';
      const rawType = String(skill?.类型 || '神通').trim();
      const typeLabel: '功法' | '神通' | '秘术' = rawType === '功法' || rawType === '秘术' ? rawType : '神通';
      const proficiency = String(skill?.熟练度 || '入门').trim() || '入门';
      return {
        key: String(key),
        name,
        description: String(skill?.描述 || '暂无描述').trim(),
        typeLabel,
        rankLabel,
        rankTier: resolveRankTier(rankLabel),
        proficiency,
        proficiencyLevel: resolveProficiencyLevel(proficiency),
      };
    });
});
</script>

<style lang="scss" scoped>
.skills-panel {
  color: var(--text-primary);
}

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-strip {
  --rank-color: var(--gold);

  position: relative;
  overflow: hidden;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--line-subtle) 55%, transparent);
  border-left: 2px solid color-mix(in srgb, var(--rank-color) 48%, transparent);
  border-radius: 5px;
  background:
    linear-gradient(100deg, color-mix(in srgb, var(--rank-color) 4%, transparent), transparent 44%),
    linear-gradient(90deg, color-mix(in srgb, var(--surface-inset) 24%, transparent), transparent);

  &::before {
    content: '';
    position: absolute;
    top: 17px;
    right: 0;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--rank-color);
  }

  &.rank-tier-heaven {
    --rank-color: var(--gold);
  }
  &.rank-tier-earth {
    --rank-color: var(--jade);
  }
  &.rank-tier-mystic {
    --rank-color: var(--semantic-info);
  }
  &.rank-tier-yellow {
    --rank-color: var(--semantic-warning);
  }
  &.rank-tier-mortal {
    --rank-color: var(--text-secondary);
  }
}

.skill-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.skill-title-group {
  min-width: 0;
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-name {
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 15px;
  font-weight: 700;
  color: var(--gold);
}

.skill-type {
  font-size: 11px;
  color: var(--text-secondary);
}

.skill-rank {
  flex: none;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--rank-color);
  background: color-mix(in srgb, var(--rank-color) 12%, transparent);
}

.skill-desc {
  margin: 7px 0 9px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--text-secondary);
}

.skill-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-proficiency {
  font-size: 11px;
  color: var(--text-accent);
}

.proficiency-pips {
  display: inline-flex;
  align-items: center;
  gap: 4px;

  .pip {
    width: 8px;
    height: 3px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--line-subtle) 85%, transparent);

    &.filled {
      background: var(--rank-color);
    }
  }
}

.empty-hint {
  padding: 20px 0;
  text-align: center;
  font-size: 12px;
  font-style: italic;
  color: var(--text-secondary);
}

@media screen and (max-width: 480px) {
  .skills-list {
    gap: 10px;
  }

  .skill-strip {
    padding: 10px 12px;
  }

  .skill-name {
    font-size: 14px;
  }

  .skill-desc {
    font-size: 12px;
  }
}
</style>
