import type { DynamicWorldbookSettings } from './settings';

export type DynamicWorldbookUpdateMode = 'enable' | 'disable';

export type DynamicWorldbookContextSnapshot = {
    currentRegion: string;
    currentLayer: string;
    environmentDesc: string;
    recentMessages: string[];
    domainName: string;
    factionName: string;
};

export type DynamicWorldbookEntryChange = {
    name: string;
    from: string;
    to: string;
    mode: DynamicWorldbookUpdateMode;
};

export type DynamicWorldbookDecisionTrace = {
    name: string;
    category: string;
    score: number;
    threshold: number;
    matched: boolean;
    source: 'score' | 'rule' | 'override';
    forced: '' | 'enable' | 'disable';
    reasons: string[];
};

export type DynamicWorldbookDiagnostics = {
    checkedAt: number;
    totalEntries: number;
    managedEntries: number;
    unmanagedEntries: number;
    mapEntries: number;
    characterEntries: number;
    unmappedMapEntries: string[];
    unknownCharacterEntries: string[];
    unmanagedSamples: string[];
    overrideConflicts: string[];
    orphanOverrideEntries: string[];
};

export type DynamicWorldbookPreviewInput = {
    currentRegion: string;
    currentLayer: string;
    environmentDesc: string;
    recentMessages: string[];
};

export type DynamicWorldbookPreviewSnapshot = {
    checkedAt: number;
    input: DynamicWorldbookPreviewInput | null;
    matchedEntries: string[];
    topScoredEntries: DynamicWorldbookDecisionTrace[];
};

export type DynamicWorldbookRuntimeSnapshot = {
    bootStatus: 'idle' | 'initializing' | 'ready' | 'waiting_mvu';
    processing: boolean;
    pendingReason: string;
    queuedReason: string;
    lastReason: string;
    lastMode: DynamicWorldbookUpdateMode | '';
    lastUpdatedAt: number;
    lastMessage: string;
    lastError: string;
    generationMessage: string;
    worldbookName: string;
    settings: DynamicWorldbookSettings;
    context: DynamicWorldbookContextSnapshot | null;
    summary: {
        enabledCount: number;
        disabledCount: number;
        totalProcessed: number;
        activeEntries: string[];
        changedEntries: DynamicWorldbookEntryChange[];
        decisionTraces: DynamicWorldbookDecisionTrace[];
        topScoredEntries: DynamicWorldbookDecisionTrace[];
    };
    diagnostics: DynamicWorldbookDiagnostics | null;
    preview: DynamicWorldbookPreviewSnapshot | null;
};

type RuntimeActions = {
    manualRefresh?: (mode: DynamicWorldbookUpdateMode) => Promise<DynamicWorldbookRuntimeSnapshot>;
    refreshSnapshot?: () => Promise<DynamicWorldbookRuntimeSnapshot>;
    runDiagnostics?: () => Promise<DynamicWorldbookRuntimeSnapshot>;
    runPreview?: (input: DynamicWorldbookPreviewInput) => Promise<DynamicWorldbookRuntimeSnapshot>;
};

let runtimeSnapshot: DynamicWorldbookRuntimeSnapshot = {
    bootStatus: 'idle',
    processing: false,
    pendingReason: '',
    queuedReason: '',
    lastReason: '',
    lastMode: '',
    lastUpdatedAt: 0,
    lastMessage: '',
    lastError: '',
    generationMessage: '',
    worldbookName: '',
    settings: {
        enabled: true,
        auto_apply: true,
        debug: true,
        show_toasts: true,
        context_window: 2,
        debounce_delay: 500,
        map_sticky_cycles: 3,
        character_context_window: 2,
        forced_enable_entries: [],
        forced_disable_entries: [],
    },
    context: null,
    summary: {
        enabledCount: 0,
        disabledCount: 0,
        totalProcessed: 0,
        activeEntries: [],
        changedEntries: [],
        decisionTraces: [],
        topScoredEntries: [],
    },
    diagnostics: null,
    preview: null,
};

let runtimeActions: RuntimeActions = {};
const listeners = new Set<(snapshot: DynamicWorldbookRuntimeSnapshot) => void>();

function notifyRuntimeSnapshot(): void {
    const snapshot = klona(runtimeSnapshot);
    listeners.forEach(listener => listener(snapshot));
}

export function getRuntimeSnapshot(): DynamicWorldbookRuntimeSnapshot {
    return klona(runtimeSnapshot);
}

export function updateRuntimeSnapshot(patch: Partial<DynamicWorldbookRuntimeSnapshot>): DynamicWorldbookRuntimeSnapshot {
    runtimeSnapshot = {
        ...runtimeSnapshot,
        ...klona(patch),
    };
    notifyRuntimeSnapshot();
    return getRuntimeSnapshot();
}

export function replaceRuntimeSnapshot(nextSnapshot: DynamicWorldbookRuntimeSnapshot): DynamicWorldbookRuntimeSnapshot {
    runtimeSnapshot = klona(nextSnapshot);
    notifyRuntimeSnapshot();
    return getRuntimeSnapshot();
}

export function onRuntimeSnapshotChange(listener: (snapshot: DynamicWorldbookRuntimeSnapshot) => void): () => void {
    listeners.add(listener);
    listener(getRuntimeSnapshot());
    return () => listeners.delete(listener);
}

export function registerRuntimeActions(actions: RuntimeActions): void {
    runtimeActions = actions;
}

export async function runManualRefresh(mode: DynamicWorldbookUpdateMode = 'enable'): Promise<DynamicWorldbookRuntimeSnapshot> {
    if (!runtimeActions.manualRefresh) {
        return getRuntimeSnapshot();
    }
    return runtimeActions.manualRefresh(mode);
}

export async function refreshRuntimeSnapshot(): Promise<DynamicWorldbookRuntimeSnapshot> {
    if (!runtimeActions.refreshSnapshot) {
        return getRuntimeSnapshot();
    }
    return runtimeActions.refreshSnapshot();
}

export async function runRuntimeDiagnostics(): Promise<DynamicWorldbookRuntimeSnapshot> {
    if (!runtimeActions.runDiagnostics) {
        return getRuntimeSnapshot();
    }
    return runtimeActions.runDiagnostics();
}

export async function runPreviewSimulation(input: DynamicWorldbookPreviewInput): Promise<DynamicWorldbookRuntimeSnapshot> {
    if (!runtimeActions.runPreview) {
        return getRuntimeSnapshot();
    }
    return runtimeActions.runPreview(input);
}
