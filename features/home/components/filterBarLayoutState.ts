import { z } from 'zod';

export const FILTER_BAR_LAYOUT_STORAGE_KEY = 'feeManager.filterBarLayout.v1';

export const TOP_TOOLBAR_SECTION_IDS = ['group', 'date', 'brand', 'business'] as const;

export type TopToolbarSectionId = (typeof TOP_TOOLBAR_SECTION_IDS)[number];
export type ToolbarSectionId = TopToolbarSectionId | 'applied';

export interface PersistedFilterBarLayoutV1 {
    version: 1;
    topOrder: TopToolbarSectionId[];
    topWidths: Record<TopToolbarSectionId, number>;
    appliedWidthPct: number;
}

const topOrderSchema = z
    .array(z.enum(TOP_TOOLBAR_SECTION_IDS))
    .length(TOP_TOOLBAR_SECTION_IDS.length)
    .refine((order) => new Set(order).size === TOP_TOOLBAR_SECTION_IDS.length, {
        message: 'topOrder must include each section exactly once.',
    });

const topWidthsSchema = z.object({
    group: z.number().finite().positive(),
    date: z.number().finite().positive(),
    brand: z.number().finite().positive(),
    business: z.number().finite().positive(),
});

const persistedFilterBarLayoutSchema = z.object({
    version: z.literal(1),
    topOrder: topOrderSchema,
    topWidths: topWidthsSchema,
    appliedWidthPct: z.number().finite(),
});

export const FILTER_BAR_DEFAULT_LAYOUT: PersistedFilterBarLayoutV1 = {
    version: 1,
    topOrder: ['group', 'date', 'brand', 'business'],
    topWidths: {
        group: 0.16,
        date: 0.24,
        brand: 0.34,
        business: 0.26,
    },
    appliedWidthPct: 100,
};

export function createDefaultFilterBarLayout(): PersistedFilterBarLayoutV1 {
    return {
        version: FILTER_BAR_DEFAULT_LAYOUT.version,
        topOrder: [...FILTER_BAR_DEFAULT_LAYOUT.topOrder],
        topWidths: { ...FILTER_BAR_DEFAULT_LAYOUT.topWidths },
        appliedWidthPct: FILTER_BAR_DEFAULT_LAYOUT.appliedWidthPct,
    };
}

export function clampAppliedWidthPct(value: number) {
    if (!Number.isFinite(value)) return FILTER_BAR_DEFAULT_LAYOUT.appliedWidthPct;
    return Math.min(100, Math.max(55, value));
}

function normalizeTopWidths(input: Record<TopToolbarSectionId, number>) {
    const normalized = { ...input };
    for (const sectionId of TOP_TOOLBAR_SECTION_IDS) {
        const value = normalized[sectionId];
        if (!Number.isFinite(value) || value <= 0) {
            normalized[sectionId] = FILTER_BAR_DEFAULT_LAYOUT.topWidths[sectionId];
        }
    }

    const total = TOP_TOOLBAR_SECTION_IDS.reduce((sum, sectionId) => sum + normalized[sectionId], 0);
    if (!Number.isFinite(total) || total <= 0) {
        return { ...FILTER_BAR_DEFAULT_LAYOUT.topWidths };
    }

    return TOP_TOOLBAR_SECTION_IDS.reduce(
        (accumulator, sectionId) => {
            accumulator[sectionId] = normalized[sectionId] / total;
            return accumulator;
        },
        {} as Record<TopToolbarSectionId, number>
    );
}

export function sanitizeFilterBarLayout(
    layout: PersistedFilterBarLayoutV1
): PersistedFilterBarLayoutV1 {
    return {
        version: 1,
        topOrder: [...layout.topOrder],
        topWidths: normalizeTopWidths(layout.topWidths),
        appliedWidthPct: clampAppliedWidthPct(layout.appliedWidthPct),
    };
}

export function readStoredFilterBarLayout(): PersistedFilterBarLayoutV1 | null {
    if (typeof window === 'undefined') return null;

    try {
        const rawValue = localStorage.getItem(FILTER_BAR_LAYOUT_STORAGE_KEY);
        if (!rawValue) return null;

        const parsedJson: unknown = JSON.parse(rawValue);
        const parsedLayout = persistedFilterBarLayoutSchema.safeParse(parsedJson);
        if (!parsedLayout.success) return null;

        return sanitizeFilterBarLayout(parsedLayout.data);
    } catch {
        return null;
    }
}

export function writeStoredFilterBarLayout(layout: PersistedFilterBarLayoutV1) {
    if (typeof window === 'undefined') return;

    try {
        const sanitizedLayout = sanitizeFilterBarLayout(layout);
        localStorage.setItem(FILTER_BAR_LAYOUT_STORAGE_KEY, JSON.stringify(sanitizedLayout));
    } catch {
        // ignore persistence errors
    }
}

export function clearStoredFilterBarLayout() {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem(FILTER_BAR_LAYOUT_STORAGE_KEY);
    } catch {
        // ignore persistence errors
    }
}
