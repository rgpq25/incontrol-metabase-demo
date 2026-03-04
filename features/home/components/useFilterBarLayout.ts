'use client';

import { arrayMove } from '@dnd-kit/sortable';
import { useCallback, useEffect, useState } from 'react';
import {
    clearStoredFilterBarLayout,
    clampAppliedWidthPct,
    createDefaultFilterBarLayout,
    readStoredFilterBarLayout,
    sanitizeFilterBarLayout,
    type PersistedFilterBarLayoutV1,
    type TopToolbarSectionId,
    TOP_TOOLBAR_SECTION_IDS,
    writeStoredFilterBarLayout,
} from './filterBarLayoutState';

const DESKTOP_MEDIA_QUERY = '(min-width: 1536px)';

export const TOP_SECTION_MIN_WIDTH_PX: Record<TopToolbarSectionId, number> = {
    group: 160,
    date: 290,
    brand: 340,
    business: 280,
};

interface UseFilterBarLayoutResult {
    layout: PersistedFilterBarLayoutV1;
    hasCustomLayout: boolean;
    isDesktop: boolean;
    isEditMode: boolean;
    setEditMode: (enabled: boolean) => void;
    resetLayout: () => void;
    reorderTopSections: (activeId: TopToolbarSectionId, overId: TopToolbarSectionId) => void;
    resizeTopPairByDelta: (
        leftId: TopToolbarSectionId,
        rightId: TopToolbarSectionId,
        deltaX: number,
        leftWidthPx: number,
        rightWidthPx: number
    ) => void;
    resizeAppliedWidthByDelta: (deltaX: number, containerWidthPx: number) => void;
}

export function useFilterBarLayout(): UseFilterBarLayoutResult {
    const [layout, setLayout] = useState<PersistedFilterBarLayoutV1>(createDefaultFilterBarLayout);
    const [hasCustomLayout, setHasCustomLayout] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
        const syncDesktopFlag = () => setIsDesktop(mediaQuery.matches);
        const handleMediaChange = (event: MediaQueryListEvent) => {
            setIsDesktop(event.matches);
            if (!event.matches) setIsEditMode(false);
        };

        syncDesktopFlag();
        mediaQuery.addEventListener('change', handleMediaChange);

        return () => {
            mediaQuery.removeEventListener('change', handleMediaChange);
        };
    }, []);

    useEffect(() => {
        const storedLayout = readStoredFilterBarLayout();

        if (storedLayout) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLayout(storedLayout);
            setHasCustomLayout(true);
        }

        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;

        if (hasCustomLayout) {
            writeStoredFilterBarLayout(layout);
            return;
        }

        clearStoredFilterBarLayout();
    }, [layout, hasCustomLayout, hydrated]);

    const setEditMode = useCallback(
        (enabled: boolean) => {
            if (enabled && !isDesktop) return;
            setIsEditMode(enabled);
        },
        [isDesktop]
    );

    const resetLayout = useCallback(() => {
        setLayout(createDefaultFilterBarLayout());
        setHasCustomLayout(false);
    }, []);

    const reorderTopSections = useCallback((activeId: TopToolbarSectionId, overId: TopToolbarSectionId) => {
        if (activeId === overId) return;

        setLayout((previous) => {
            const sourceIndex = previous.topOrder.indexOf(activeId);
            const targetIndex = previous.topOrder.indexOf(overId);
            if (sourceIndex < 0 || targetIndex < 0) return previous;

            const nextOrder = arrayMove(previous.topOrder, sourceIndex, targetIndex);
            return { ...previous, topOrder: nextOrder };
        });
        setHasCustomLayout(true);
    }, []);

    const resizeTopPairByDelta = useCallback(
        (
            leftId: TopToolbarSectionId,
            rightId: TopToolbarSectionId,
            deltaX: number,
            leftWidthPx: number,
            rightWidthPx: number
        ) => {
            if (!Number.isFinite(deltaX) || deltaX === 0) return;
            if (!Number.isFinite(leftWidthPx) || !Number.isFinite(rightWidthPx)) return;
            if (leftWidthPx <= 0 || rightWidthPx <= 0) return;

            setLayout((previous) => {
                const pairWidthPx = leftWidthPx + rightWidthPx;
                const minLeft = TOP_SECTION_MIN_WIDTH_PX[leftId];
                const minRight = TOP_SECTION_MIN_WIDTH_PX[rightId];
                if (pairWidthPx <= minLeft + minRight) return previous;

                const leftCurrentPx = leftWidthPx;
                const nextLeftPx = Math.min(
                    pairWidthPx - minRight,
                    Math.max(minLeft, leftCurrentPx + deltaX)
                );
                const pairWeight = previous.topWidths[leftId] + previous.topWidths[rightId];
                if (!Number.isFinite(pairWeight) || pairWeight <= 0) return previous;

                const nextLeftWeight = pairWeight * (nextLeftPx / pairWidthPx);
                const nextRightWeight = pairWeight - nextLeftWeight;

                const nextLayout = sanitizeFilterBarLayout({
                    ...previous,
                    topWidths: {
                        ...previous.topWidths,
                        [leftId]: nextLeftWeight,
                        [rightId]: nextRightWeight,
                    },
                });

                return nextLayout;
            });

            setHasCustomLayout(true);
        },
        []
    );

    const resizeAppliedWidthByDelta = useCallback((deltaX: number, containerWidthPx: number) => {
        if (!Number.isFinite(deltaX) || deltaX === 0) return;
        if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) return;

        setLayout((previous) => {
            const nextWidthPct = clampAppliedWidthPct(previous.appliedWidthPct + (deltaX / containerWidthPx) * 100);
            return { ...previous, appliedWidthPct: nextWidthPct };
        });
        setHasCustomLayout(true);
    }, []);

    return {
        layout,
        hasCustomLayout,
        isDesktop,
        isEditMode,
        setEditMode,
        resetLayout,
        reorderTopSections,
        resizeTopPairByDelta,
        resizeAppliedWidthByDelta,
    };
}

export function isTopToolbarSectionId(value: string): value is TopToolbarSectionId {
    return TOP_TOOLBAR_SECTION_IDS.includes(value as TopToolbarSectionId);
}
