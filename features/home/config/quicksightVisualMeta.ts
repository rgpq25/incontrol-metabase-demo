export type QuickSightVisualKey = `${string}:${string}`;

export type QuickSightVisualSection =
    | 'hero'
    | 'category'
    | 'jurisdiction'
    | 'evolution'
    | 'monthly'
    | 'fallback';

export interface QuickSightVisualMeta {
    title: string;
    order: number;
    minHeight: number;
    colSpan: 1 | 2;
    section: QuickSightVisualSection;
    desktopSpan: 1 | 2;
    heroHighlight?: boolean;
}

const DEFAULT_MIN_HEIGHT = 360;

const SHEET_ID = '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_0b05ba09-806d-4a93-9834-e82bb5e3c475';

export function toVisualKey(sheetId: string, visualId: string): QuickSightVisualKey {
    return `${sheetId}:${visualId}`;
}

export const quickSightVisualMeta: Record<QuickSightVisualKey, QuickSightVisualMeta> = {
    [toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_5881346a-b982-485d-91c1-d7ff0c133d63')]:
        {
            title: 'Total',
            order: 1,
            minHeight: 420,
            colSpan: 2,
            section: 'hero',
            desktopSpan: 1,
            heroHighlight: true,
        },
    [toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_f82d4b33-8ed1-4940-ad97-881e1d04b6ab')]:
        {
            title: 'Acquirer Cash',
            order: 2,
            minHeight: 360,
            colSpan: 1,
            section: 'hero',
            desktopSpan: 1,
        },
    [toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_9f023952-2c3a-4f50-8c9e-67e9d0d98473')]:
        {
            title: 'Acquirer Merchant',
            order: 3,
            minHeight: 360,
            colSpan: 1,
            section: 'hero',
            desktopSpan: 1,
        },
    [toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_9fe19a65-bd9b-42e8-9093-9a3fa47a6790')]:
        {
            title: 'Gross Fees by Category',
            order: 4,
            minHeight: 380,
            colSpan: 1,
            section: 'category',
            desktopSpan: 1,
        },
    [toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_755f2714-d085-4bf0-9d3a-31c44ec4f490')]:
        {
            title: 'Gross Fees by Jurisdiction',
            order: 5,
            minHeight: 380,
            colSpan: 1,
            section: 'jurisdiction',
            desktopSpan: 1,
        },
    [toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_9d672775-56a9-4fa3-a119-881a68c7d70a')]:
        {
            title: 'Monthly gross Fees',
            order: 6,
            minHeight: 360,
            colSpan: 1,
            section: 'monthly',
            desktopSpan: 2,
        },
    [toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_47080a60-f743-44d2-adde-3a553918e5e2')]:
        {
            title: 'Issuer',
            order: 7,
            minHeight: 360,
            colSpan: 1,
            section: 'hero',
            desktopSpan: 1,
        },
    [toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_b43463a2-57a6-4292-a225-f36a3b5b657b')]:
        {
            title: 'Gross Fees by Evolution',
            order: 8,
            minHeight: 400,
            colSpan: 2,
            section: 'evolution',
            desktopSpan: 1,
        },
};

export const GROUPED_HERO_VISUAL_KEYS: QuickSightVisualKey[] = [
    toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_47080a60-f743-44d2-adde-3a553918e5e2'),
    toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_f82d4b33-8ed1-4940-ad97-881e1d04b6ab'),
    toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_9f023952-2c3a-4f50-8c9e-67e9d0d98473'),
    toVisualKey(SHEET_ID, '4ecd3350-2b80-4ac1-b1da-8819819f5f2f_5881346a-b982-485d-91c1-d7ff0c133d63'),
];

const groupedHeroVisualKeySet = new Set<QuickSightVisualKey>(GROUPED_HERO_VISUAL_KEYS);

export function isGroupedHeroVisualKey(key: QuickSightVisualKey): boolean {
    return groupedHeroVisualKeySet.has(key);
}

function fallbackTitle(visualId: string) {
    const shortId = visualId.split('_').pop()?.slice(0, 8) ?? visualId.slice(0, 8);
    return `Visual ${shortId}`;
}

export function getQuickSightVisualMeta(
    sheetId: string,
    visualId: string,
    fallbackOrder: number
): QuickSightVisualMeta {
    const key = toVisualKey(sheetId, visualId);
    const configured = quickSightVisualMeta[key];

    if (configured) return configured;

    return {
        title: fallbackTitle(visualId),
        order: fallbackOrder,
        minHeight: DEFAULT_MIN_HEIGHT,
        colSpan: 1,
        section: 'fallback',
        desktopSpan: 1,
    };
}
