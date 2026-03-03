'use client';

import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    horizontalListSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    BriefcaseBusiness,
    CalendarDays,
    ChevronDown,
    CreditCard,
    GripVertical,
    LayoutGrid,
    MoveHorizontal,
    SlidersHorizontal,
    X,
} from 'lucide-react';
import {
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
} from 'react';
import {
    buildQuickSightVisualQuery,
    createInitialFeeManagerFilters,
    feeManagerBrandOptions,
    feeManagerBusinessOptions,
    feeManagerFilterReducer,
} from '../config/feeManagerFilters';
import { type TopToolbarSectionId } from './filterBarLayoutState';
import { QuickSightVisualGrid } from './QuickSightVisualGrid';
import { isTopToolbarSectionId, TOP_SECTION_MIN_WIDTH_PX, useFilterBarLayout } from './useFilterBarLayout';

interface SortableToolbarSectionProps {
    id: TopToolbarSectionId;
    isEditMode: boolean;
    isFirst: boolean;
    widthWeight: number;
    minWidthPx: number;
    rightNeighborId?: TopToolbarSectionId;
    onStartResize?: (
        event: ReactMouseEvent<HTMLButtonElement>,
        leftId: TopToolbarSectionId,
        rightId: TopToolbarSectionId
    ) => void;
    children: ReactNode;
}

function SortableToolbarSection({
    id,
    isEditMode,
    isFirst,
    widthWeight,
    minWidthPx,
    rightNeighborId,
    onStartResize,
    children,
}: SortableToolbarSectionProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
        useSortable({
            id,
            disabled: !isEditMode,
        });

    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        flexGrow: widthWeight * 100,
        flexBasis: 0,
        minWidth: `${minWidthPx}px`,
    };

    return (
        <div
            ref={setNodeRef}
            data-toolbar-section={id}
            style={style}
            className={`relative flex min-w-0 items-center ${isDragging ? 'z-10 opacity-80' : ''} ${
                isFirst ? '' : 'border-l border-[var(--color-border-soft)] pl-5'
            }`}
        >
            {isEditMode && (
                <button
                    ref={setActivatorNodeRef}
                    type="button"
                    aria-label={`Drag ${id} section`}
                    className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-brand-600)]"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
            )}

            <div className="min-w-0 flex-1">{children}</div>

            {isEditMode && rightNeighborId && onStartResize && (
                <button
                    type="button"
                    aria-label={`Resize ${id} and ${rightNeighborId}`}
                    onMouseDown={(event) => onStartResize(event, id, rightNeighborId)}
                    className="absolute -right-3 top-1/2 z-20 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-text-muted)] shadow-sm hover:text-[var(--color-brand-600)]"
                >
                    <MoveHorizontal className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

export function FeeManagerOverview() {
    const [filters, dispatch] = useReducer(feeManagerFilterReducer, undefined, createInitialFeeManagerFilters);

    const quickSightQuery = useMemo(() => buildQuickSightVisualQuery(filters), [filters]);
    const {
        layout,
        hasCustomLayout,
        isDesktop,
        isEditMode,
        setEditMode,
        resetLayout,
        reorderTopSections,
        resizeTopPairByDelta,
        resizeAppliedWidthByDelta,
    } = useFilterBarLayout();

    const topRowContainerRef = useRef<HTMLDivElement | null>(null);
    const appliedRowContainerRef = useRef<HTMLDivElement | null>(null);
    const activeTopResizeRef = useRef<{
        leftId: TopToolbarSectionId;
        rightId: TopToolbarSectionId;
        lastClientX: number;
    } | null>(null);
    const activeAppliedResizeRef = useRef<{ lastClientX: number } | null>(null);

    const shouldUseCustomDesktopLayout = hasCustomLayout || isEditMode;

    const dndSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            if (!isEditMode) return;

            const activeId = String(event.active.id);
            const overId = event.over ? String(event.over.id) : null;
            if (!overId || activeId === overId) return;
            if (!isTopToolbarSectionId(activeId) || !isTopToolbarSectionId(overId)) return;

            reorderTopSections(activeId, overId);
        },
        [isEditMode, reorderTopSections]
    );

    const handleTopResizeStart = useCallback(
        (
            event: ReactMouseEvent<HTMLButtonElement>,
            leftId: TopToolbarSectionId,
            rightId: TopToolbarSectionId
        ) => {
            if (!isEditMode) return;

            event.preventDefault();
            activeTopResizeRef.current = { leftId, rightId, lastClientX: event.clientX };
        },
        [isEditMode]
    );

    const handleAppliedResizeStart = useCallback(
        (event: ReactMouseEvent<HTMLButtonElement>) => {
            if (!isEditMode) return;

            event.preventDefault();
            activeAppliedResizeRef.current = { lastClientX: event.clientX };
        },
        [isEditMode]
    );

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            const activeResize = activeTopResizeRef.current;
            if (!activeResize) return;

            const container = topRowContainerRef.current;
            if (!container) return;

            const leftNode = container.querySelector<HTMLElement>(
                `[data-toolbar-section="${activeResize.leftId}"]`
            );
            const rightNode = container.querySelector<HTMLElement>(
                `[data-toolbar-section="${activeResize.rightId}"]`
            );
            if (!leftNode || !rightNode) return;

            const deltaX = event.clientX - activeResize.lastClientX;
            if (deltaX === 0) return;

            activeResize.lastClientX = event.clientX;
            resizeTopPairByDelta(
                activeResize.leftId,
                activeResize.rightId,
                deltaX,
                leftNode.offsetWidth,
                rightNode.offsetWidth
            );
        };

        const clearResizeSession = () => {
            activeTopResizeRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', clearResizeSession);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', clearResizeSession);
        };
    }, [resizeTopPairByDelta]);

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            const activeResize = activeAppliedResizeRef.current;
            if (!activeResize) return;

            const container = appliedRowContainerRef.current;
            if (!container) return;

            const deltaX = event.clientX - activeResize.lastClientX;
            if (deltaX === 0) return;

            activeResize.lastClientX = event.clientX;
            resizeAppliedWidthByDelta(deltaX, container.offsetWidth);
        };

        const clearResizeSession = () => {
            activeAppliedResizeRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', clearResizeSession);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', clearResizeSession);
        };
    }, [resizeAppliedWidthByDelta]);

    const renderTopSectionContent = useCallback(
        (sectionId: TopToolbarSectionId) => {
            switch (sectionId) {
                case 'group':
                    return (
                        <button
                            type="button"
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text-primary)]"
                        >
                            <LayoutGrid className="h-4 w-4 text-[var(--color-brand-600)]" />
                            {filters.groupViewLabel}
                        </button>
                    );

                case 'date':
                    return (
                        <div className="flex flex-wrap items-center gap-2.5 2xl:flex-nowrap">
                            <div className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-[var(--color-text-primary)]">
                                <CalendarDays className="h-4 w-4 text-[var(--color-brand-600)]" />
                                Filter by date
                            </div>
                            <button
                                type="button"
                                onClick={() => dispatch({ type: 'cycleDateRange' })}
                                className="inline-flex h-10 items-center whitespace-nowrap rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text-primary)]"
                            >
                                {filters.dateRangeLabel}
                            </button>
                        </div>
                    );

                case 'brand':
                    return (
                        <div className="flex flex-wrap items-center gap-2.5 2xl:flex-nowrap">
                            <div className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-[var(--color-text-primary)]">
                                <CreditCard className="h-4 w-4 text-[var(--color-brand-600)]" />
                                Filter by brand
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {feeManagerBrandOptions.map((brand) => {
                                    const selected = filters.brands[brand];

                                    return (
                                        <button
                                            key={brand}
                                            type="button"
                                            onClick={() => dispatch({ type: 'toggleBrand', brand })}
                                            className={`h-10 rounded-xl border px-4 text-sm transition-colors ${
                                                selected
                                                    ? 'border-[var(--color-brand-600)] bg-[var(--color-surface)] text-[var(--color-brand-600)]'
                                                    : 'border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                                            }`}
                                        >
                                            {brand}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );

                case 'business':
                    return (
                        <div className="flex flex-wrap items-center gap-2.5 2xl:flex-nowrap">
                            <div className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-[var(--color-text-primary)]">
                                <BriefcaseBusiness className="h-4 w-4 text-[var(--color-brand-600)]" />
                                Filter by business
                            </div>
                            <label className="relative inline-flex">
                                <select
                                    value={filters.business}
                                    onChange={(event) =>
                                        dispatch({ type: 'setBusiness', business: event.target.value })
                                    }
                                    className="h-10 min-w-44 appearance-none rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] py-2 pl-4 pr-10 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-300)] focus:outline-none"
                                >
                                    {feeManagerBusinessOptions.map((businessOption) => (
                                        <option key={businessOption} value={businessOption}>
                                            {businessOption}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-brand-600)]" />
                            </label>
                        </div>
                    );
            }
        },
        [dispatch, filters]
    );

    const appliedFiltersContent = (
        <>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">Applied filters:</span>

            {filters.appliedFilters.length > 0 ? (
                filters.appliedFilters.map((entry) => (
                    <button
                        key={entry}
                        type="button"
                        onClick={() => dispatch({ type: 'removeAppliedFilter', filter: entry })}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-brand-300)] bg-[var(--color-brand-100)] px-3 py-1 text-xs text-[var(--color-brand-600)]"
                    >
                        {entry}
                        <X className="h-3 w-3" />
                    </button>
                ))
            ) : (
                <span className="text-xs text-[var(--color-text-muted)]">
                    No applied filters. (Visual-only toolbar for now)
                </span>
            )}
        </>
    );

    return (
        <div className="space-y-6">
            <section className="panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6">
                <h1 className="text-2xl font-bold text-[var(--color-brand-600)]">Scheme Fee Billing</h1>
            </section>

            <section className="panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4 md:p-5">
                <div className="mb-3 hidden items-center justify-end gap-2 2xl:flex">
                    {!isEditMode ? (
                        <button
                            type="button"
                            onClick={() => setEditMode(true)}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 text-xs font-bold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-brand-300)] hover:text-[var(--color-brand-600)]"
                            aria-label="Customize filter bar layout"
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            Customize layout
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={resetLayout}
                                className="inline-flex h-9 items-center rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 text-xs font-bold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-brand-300)] hover:text-[var(--color-brand-600)]"
                            >
                                Reset layout
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditMode(false)}
                                className="inline-flex h-9 items-center rounded-lg border border-[var(--color-brand-300)] bg-[var(--color-brand-100)] px-3 text-xs font-bold text-[var(--color-brand-600)] transition-colors hover:border-[var(--color-brand-600)] hover:bg-[var(--color-surface)]"
                            >
                                Done
                            </button>
                        </>
                    )}
                </div>

                <div
                    className={`grid gap-3 md:grid-cols-2 2xl:flex 2xl:flex-nowrap 2xl:items-center 2xl:justify-between 2xl:gap-0 ${
                        shouldUseCustomDesktopLayout ? '2xl:hidden' : ''
                    }`}
                >
                    <div className="flex items-center gap-2.5">{renderTopSectionContent('group')}</div>

                    <div className="flex flex-wrap items-center gap-2.5 2xl:flex-nowrap 2xl:border-l 2xl:border-[var(--color-border-soft)] 2xl:pl-5">
                        {renderTopSectionContent('date')}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 2xl:flex-nowrap 2xl:border-l 2xl:border-[var(--color-border-soft)] 2xl:pl-5">
                        {renderTopSectionContent('brand')}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 2xl:flex-nowrap 2xl:border-l 2xl:border-[var(--color-border-soft)] 2xl:pl-5">
                        {renderTopSectionContent('business')}
                    </div>
                </div>

                {shouldUseCustomDesktopLayout && (
                    <div className="hidden 2xl:block">
                        <DndContext
                            sensors={dndSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={layout.topOrder}
                                strategy={horizontalListSortingStrategy}
                            >
                                <div ref={topRowContainerRef} className="flex items-center">
                                    {layout.topOrder.map((sectionId, index) => (
                                        <SortableToolbarSection
                                            key={sectionId}
                                            id={sectionId}
                                            isEditMode={isEditMode}
                                            isFirst={index === 0}
                                            widthWeight={layout.topWidths[sectionId]}
                                            minWidthPx={TOP_SECTION_MIN_WIDTH_PX[sectionId]}
                                            rightNeighborId={layout.topOrder[index + 1]}
                                            onStartResize={handleTopResizeStart}
                                        >
                                            {renderTopSectionContent(sectionId)}
                                        </SortableToolbarSection>
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                )}

                <div className={`mt-4 flex flex-wrap items-center gap-2 ${shouldUseCustomDesktopLayout ? '2xl:hidden' : ''}`}>
                    {appliedFiltersContent}
                </div>

                {shouldUseCustomDesktopLayout && (
                    <div ref={appliedRowContainerRef} className="mt-4 hidden 2xl:flex">
                        <div
                            className="relative max-w-full"
                            style={{ width: `${layout.appliedWidthPct}%` }}
                        >
                            <div className={`flex flex-wrap items-center gap-2 ${isEditMode ? 'pr-4' : ''}`}>
                                {appliedFiltersContent}
                            </div>

                            {isEditMode && isDesktop && (
                                <button
                                    type="button"
                                    onMouseDown={handleAppliedResizeStart}
                                    aria-label="Resize applied filters section"
                                    className="absolute -right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-text-muted)] shadow-sm hover:text-[var(--color-brand-600)]"
                                >
                                    <MoveHorizontal className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </section>

            <QuickSightVisualGrid query={quickSightQuery} />
        </div>
    );
}
