'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildQuickSightVisualQueryString, type QuickSightVisualQuery } from '../config/feeManagerFilters';
import type {
    EmbedVisualError,
    EmbedVisualItem,
    EmbedVisualUrlsResponse,
    ExternalFilterContract,
    ExternalFilterParameter,
} from '../config/quicksightEmbedContract';
import {
    GROUPED_HERO_VISUAL_KEYS,
    getQuickSightVisualMeta,
    toVisualKey,
    type QuickSightVisualSection,
    type QuickSightVisualKey,
} from '../config/quicksightVisualMeta';

interface QuickSightVisualGridProps {
    query: QuickSightVisualQuery;
}

const FILTER_REFRESH_DEBOUNCE_MS = 500;
const SESSION_REFRESH_BUFFER_MS = 60_000;
const MIN_SESSION_REFRESH_MS = 15_000;

interface VisualCard extends EmbedVisualItem {
    key: QuickSightVisualKey;
    title: string;
    order: number;
    minHeight: number;
    colSpan: 1 | 2;
    section: QuickSightVisualSection;
    desktopSpan: 1 | 2;
    heroHighlight?: boolean;
    loading: boolean;
    error: string | null;
}

type VisualFetchResult =
    | { data: EmbedVisualUrlsResponse; error: null; aborted: false }
    | { data: null; error: string; aborted: boolean };

function parseErrorMessage(payload: unknown) {
    if (!payload || typeof payload !== 'object') return null;

    const candidate = payload as Record<string, unknown>;
    const error = candidate.error;
    const detail = candidate.detail;
    const details = candidate.details;

    if (typeof error === 'string' && detail && typeof detail === 'object') {
        const detailMessage = (detail as Record<string, unknown>).message;
        if (typeof detailMessage === 'string') return `${error}: ${detailMessage}`;
    }
    if (typeof error === 'string' && typeof details === 'string') return `${error}: ${details}`;
    if (typeof error === 'string') return error;
    return null;
}

function normalizeExternalParameter(entry: unknown): ExternalFilterParameter | null {
    if (!entry || typeof entry !== 'object') return null;

    const candidate = entry as Record<string, unknown>;
    const name = candidate.Name;
    const values = candidate.Values;
    if (typeof name !== 'string' || !Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
        return null;
    }

    return {
        Name: name,
        Values: values,
    };
}

function normalizeExternalFilterContract(payload: unknown): ExternalFilterContract | null {
    if (!payload || typeof payload !== 'object') return null;

    const candidate = payload as Record<string, unknown>;
    const scope = candidate.scope;
    const applyMethod = candidate.applyMethod;
    const parameters = candidate.parameters;
    if (scope !== 'global' || applyMethod !== 'quicksight-sdk:setParameters' || !Array.isArray(parameters)) {
        return null;
    }

    const normalizedParameters: ExternalFilterParameter[] = [];
    for (const parameter of parameters) {
        const normalized = normalizeExternalParameter(parameter);
        if (!normalized) return null;
        normalizedParameters.push(normalized);
    }

    return {
        scope,
        applyMethod,
        parameters: normalizedParameters,
    };
}

function normalizeEmbedVisualError(entry: unknown): EmbedVisualError | null {
    if (!entry || typeof entry !== 'object') return null;

    const candidate = entry as Record<string, unknown>;
    const sheetId = candidate.sheetId;
    const visualId = candidate.visualId;
    const code = candidate.code;
    const message = candidate.message;
    if (
        typeof sheetId !== 'string' ||
        typeof visualId !== 'string' ||
        typeof code !== 'string' ||
        typeof message !== 'string'
    ) {
        return null;
    }

    return {
        sheetId,
        visualId,
        code,
        message,
    };
}

function normalizePayload(payload: unknown): EmbedVisualUrlsResponse | null {
    if (!payload || typeof payload !== 'object') return null;

    const candidate = payload as Record<string, unknown>;
    const dashboardId = candidate.dashboardId;
    const expiresInMinutes = candidate.expiresInMinutes;
    const visuals = candidate.visuals;
    const errors = candidate.errors;

    if (
        typeof dashboardId !== 'string' ||
        typeof expiresInMinutes !== 'number' ||
        !Array.isArray(visuals)
    ) {
        return null;
    }

    const normalizedVisuals: EmbedVisualItem[] = [];
    for (const visual of visuals) {
        if (!visual || typeof visual !== 'object') return null;
        const record = visual as Record<string, unknown>;
        if (
            typeof record.sheetId !== 'string' ||
            typeof record.visualId !== 'string' ||
            typeof record.embedUrl !== 'string'
        ) {
            return null;
        }

        normalizedVisuals.push({
            sheetId: record.sheetId,
            visualId: record.visualId,
            embedUrl: record.embedUrl,
        });
    }

    let normalizedErrors: EmbedVisualError[] = [];
    if (errors !== undefined) {
        if (!Array.isArray(errors)) return null;

        normalizedErrors = [];
        for (const entry of errors) {
            const normalized = normalizeEmbedVisualError(entry);
            if (!normalized) return null;
            normalizedErrors.push(normalized);
        }
    }

    let externalFilterContract: ExternalFilterContract | undefined;
    if (candidate.externalFilterContract !== undefined) {
        const normalizedContract = normalizeExternalFilterContract(candidate.externalFilterContract);
        if (!normalizedContract) return null;
        externalFilterContract = normalizedContract;
    }

    return {
        dashboardId,
        expiresInMinutes,
        visuals: normalizedVisuals,
        errors: normalizedErrors,
        ...(externalFilterContract ? { externalFilterContract } : {}),
    };
}

function buildVisualCards(visuals: EmbedVisualItem[]): VisualCard[] {
    return visuals
        .map((visual, index) => {
            const meta = getQuickSightVisualMeta(visual.sheetId, visual.visualId, index + 1);
            return {
                ...visual,
                key: toVisualKey(visual.sheetId, visual.visualId),
                title: meta.title,
                order: meta.order,
                minHeight: meta.minHeight,
                colSpan: meta.colSpan,
                section: meta.section,
                desktopSpan: meta.desktopSpan,
                heroHighlight: meta.heroHighlight,
                loading: false,
                error: null,
            };
        })
        .sort((a, b) => a.order - b.order);
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
}

function getSessionRefreshDelayMs(expiresInMinutes: number): number {
    const ttlMs = expiresInMinutes * 60_000;
    return Math.max(ttlMs - SESSION_REFRESH_BUFFER_MS, MIN_SESSION_REFRESH_MS);
}

export function QuickSightVisualGrid({ query }: QuickSightVisualGridProps) {
    const [cards, setCards] = useState<VisualCard[]>([]);
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<EmbedVisualError[]>([]);
    const [sessionRefreshAtMs, setSessionRefreshAtMs] = useState<number | null>(null);

    const hasLoadedRef = useRef(false);
    const sessionExpiresAtRef = useRef<number | null>(null);

    const baseQueryString = useMemo(() => buildQuickSightVisualQueryString(query), [query]);

    const groupedHeroCards = useMemo(() => {
        const cardByKey = new Map(cards.map((card) => [card.key, card] as const));
        return GROUPED_HERO_VISUAL_KEYS.map((key) => cardByKey.get(key)).filter(
            (card): card is VisualCard => Boolean(card)
        );
    }, [cards]);

    const categoryCard = useMemo(
        () => cards.find((card) => card.section === 'category') ?? null,
        [cards]
    );
    const jurisdictionCard = useMemo(
        () => cards.find((card) => card.section === 'jurisdiction') ?? null,
        [cards]
    );
    const evolutionCard = useMemo(
        () => cards.find((card) => card.section === 'evolution') ?? null,
        [cards]
    );
    const monthlyCard = useMemo(() => cards.find((card) => card.section === 'monthly') ?? null, [cards]);
    const fallbackCards = useMemo(
        () => cards.filter((card) => card.section === 'fallback'),
        [cards]
    );

    const trackSessionExpiry = useCallback((expiresInMinutes: number) => {
        const now = Date.now();
        sessionExpiresAtRef.current = now + expiresInMinutes * 60_000;
        setSessionRefreshAtMs(now + getSessionRefreshDelayMs(expiresInMinutes));
    }, []);

    const applySuccessfulPayload = useCallback(
        (payload: EmbedVisualUrlsResponse) => {
            setCards(buildVisualCards(payload.visuals));
            setWarnings(payload.errors);
            setGlobalError(null);
            trackSessionExpiry(payload.expiresInMinutes);
        },
        [trackSessionExpiry]
    );

    const fetchVisualPayload = useCallback(
        async (params?: {
            sheetId?: string;
            visualId?: string;
            signal?: AbortSignal;
        }): Promise<VisualFetchResult> => {
            const queryParams = new URLSearchParams(baseQueryString);
            if (params?.sheetId) queryParams.set('sheetId', params.sheetId);
            if (params?.visualId) queryParams.set('visualId', params.visualId);

            try {
                const response = await fetch(`/api/quicksight/visual-embed-urls?${queryParams.toString()}`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                    signal: params?.signal,
                });

                let jsonPayload: unknown = null;
                try {
                    jsonPayload = await response.json();
                } catch {
                    jsonPayload = null;
                }

                if (!response.ok) {
                    const message = parseErrorMessage(jsonPayload);
                    return {
                        data: null,
                        error: message ?? 'Unable to load QuickSight visual URLs.',
                        aborted: false,
                    };
                }

                const normalizedPayload = normalizePayload(jsonPayload);
                if (!normalizedPayload) {
                    return {
                        data: null,
                        error: 'QuickSight visual payload has an invalid format.',
                        aborted: false,
                    };
                }

                return { data: normalizedPayload, error: null, aborted: false };
            } catch (error) {
                if (isAbortError(error)) return { data: null, error: 'Request aborted.', aborted: true };

                return {
                    data: null,
                    error: 'Network error while loading QuickSight visual URLs.',
                    aborted: false,
                };
            }
        },
        [baseQueryString]
    );

    const loadAllVisuals = useCallback(
        async ({
            showInitialLoader = false,
            preserveCardsOnError = true,
            signal,
        }: {
            showInitialLoader?: boolean;
            preserveCardsOnError?: boolean;
            signal?: AbortSignal;
        } = {}) => {
            if (showInitialLoader) setLoadingInitial(true);
            setGlobalError(null);

            const result = await fetchVisualPayload({ signal });
            if (result.aborted) {
                if (showInitialLoader) setLoadingInitial(false);
                return false;
            }

            if (!result.data) {
                if (!preserveCardsOnError) setCards([]);
                setWarnings([]);
                setGlobalError(result.error);
                if (showInitialLoader) setLoadingInitial(false);
                return false;
            }

            applySuccessfulPayload(result.data);
            if (showInitialLoader) setLoadingInitial(false);
            return true;
        },
        [applySuccessfulPayload, fetchVisualPayload]
    );

    const reloadAllVisuals = useCallback(async () => {
        await loadAllVisuals({ showInitialLoader: true, preserveCardsOnError: false });
    }, [loadAllVisuals]);

    const retryCard = useCallback(
        async (sheetId: string, visualId: string) => {
            const sessionExpired =
                sessionExpiresAtRef.current !== null && Date.now() >= sessionExpiresAtRef.current;
            if (sessionExpired) {
                await loadAllVisuals({ showInitialLoader: false, preserveCardsOnError: true });
                return;
            }

            const targetKey = toVisualKey(sheetId, visualId);
            setCards((previous) =>
                previous.map((card) =>
                    card.key === targetKey ? { ...card, loading: true, error: null } : card
                )
            );

            let refreshedVisual: EmbedVisualItem | null = null;
            let errorMessage: string | null = null;

            const singleResult = await fetchVisualPayload({ sheetId, visualId });
            if (!singleResult.aborted && singleResult.data) {
                refreshedVisual =
                    singleResult.data.visuals.find(
                        (entry) => entry.sheetId === sheetId && entry.visualId === visualId
                    ) ?? null;
                if (!refreshedVisual) errorMessage = 'Requested visual was not returned by single refresh.';
                setWarnings(singleResult.data.errors);
                trackSessionExpiry(singleResult.data.expiresInMinutes);
            } else if (!singleResult.aborted) {
                errorMessage = singleResult.error;
            }

            if (!refreshedVisual) {
                const batchResult = await fetchVisualPayload();
                if (!batchResult.aborted && batchResult.data) {
                    refreshedVisual =
                        batchResult.data.visuals.find(
                            (entry) => entry.sheetId === sheetId && entry.visualId === visualId
                        ) ?? null;
                    if (!refreshedVisual) {
                        errorMessage = 'Requested visual was not returned by batch refresh.';
                    } else {
                        setWarnings(batchResult.data.errors);
                    }
                    trackSessionExpiry(batchResult.data.expiresInMinutes);
                } else if (!batchResult.aborted) {
                    errorMessage = batchResult.error;
                }
            }

            if (refreshedVisual) {
                setCards((previous) =>
                    previous.map((card) =>
                        card.key === targetKey
                            ? {
                                  ...card,
                                  embedUrl: refreshedVisual.embedUrl,
                                  loading: false,
                                  error: null,
                              }
                            : card
                    )
                );
                return;
            }

            setCards((previous) =>
                previous.map((card) =>
                    card.key === targetKey
                        ? {
                              ...card,
                              loading: false,
                              error: errorMessage ?? 'Unable to refresh this visual.',
                          }
                        : card
                )
            );
        },
        [fetchVisualPayload, loadAllVisuals, trackSessionExpiry]
    );

    useEffect(() => {
        const abortController = new AbortController();
        const isInitialLoad = !hasLoadedRef.current;
        const delay = isInitialLoad ? 0 : FILTER_REFRESH_DEBOUNCE_MS;

        const timerId = window.setTimeout(() => {
            void loadAllVisuals({
                showInitialLoader: isInitialLoad,
                preserveCardsOnError: !isInitialLoad,
                signal: abortController.signal,
            }).then((succeeded) => {
                if (succeeded) hasLoadedRef.current = true;
            });
        }, delay);

        return () => {
            abortController.abort();
            window.clearTimeout(timerId);
        };
    }, [baseQueryString, loadAllVisuals]);

    useEffect(() => {
        if (sessionRefreshAtMs === null || !hasLoadedRef.current) return;

        const abortController = new AbortController();
        const delay = Math.max(0, sessionRefreshAtMs - Date.now());
        const timerId = window.setTimeout(() => {
            void loadAllVisuals({
                showInitialLoader: false,
                preserveCardsOnError: true,
                signal: abortController.signal,
            });
        }, delay);

        return () => {
            abortController.abort();
            window.clearTimeout(timerId);
        };
    }, [loadAllVisuals, sessionRefreshAtMs]);

    const getFrameLayout = (card: VisualCard) => {
        switch (card.section) {
            case 'hero':
                return { height: 200, maxWidth: 740 };
            case 'monthly':
                return { height: 520, maxWidth: 1480 };
            case 'category':
            case 'jurisdiction':
            case 'evolution':
                return { height: 360, maxWidth: 740 };
            default:
                return { height: Math.max(360, card.minHeight), maxWidth: undefined };
        }
    };

    const renderVisualBody = (card: VisualCard) => {
        const { height: frameHeight, maxWidth } = getFrameLayout(card);

        return (
            <div className="flex w-full items-center justify-center px-2 py-2" style={{ minHeight: `${frameHeight}px` }}>
                {card.loading ? (
                    <div
                        role="status"
                        aria-label={`Refreshing ${card.title}`}
                        className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-brand-600)] border-t-transparent"
                    />
                ) : card.error ? (
                    <div className="px-5 text-center">
                        <p className="text-sm font-bold text-[var(--color-text-strong)]">Visual unavailable</p>
                        <p className="mt-2 text-xs text-[var(--color-text-primary)]">{card.error}</p>
                        <button
                            type="button"
                            onClick={() => void retryCard(card.sheetId, card.visualId)}
                            className="mt-4 h-9 rounded-lg bg-[var(--color-brand-600)] px-4 text-xs font-bold text-white transition-colors hover:bg-[#1f45af]"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <iframe
                        src={card.embedUrl}
                        title={`QuickSight visual ${card.title}`}
                        className="w-full border-0"
                        style={{
                            height: `${frameHeight}px`,
                            maxWidth: maxWidth ? `${maxWidth}px` : undefined,
                        }}
                        loading="lazy"
                        scrolling="no"
                        allowFullScreen
                    />
                )}
            </div>
        );
    };

    if (loadingInitial) {
        return (
            <section className="mx-auto w-full max-w-[1560px] space-y-4">
                <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                    <article className="panel-shadow overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
                        <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                            <div className="h-4 w-72 animate-pulse rounded bg-[var(--color-brand-100)]" />
                        </div>
                        <div className="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div
                                    key={`qs-hero-skeleton-${index}`}
                                    className="h-[220px] animate-pulse rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]"
                                />
                            ))}
                        </div>
                    </article>

                    <article className="panel-shadow overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
                        <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                            <div className="h-4 w-56 animate-pulse rounded bg-[var(--color-brand-100)]" />
                        </div>
                        <div className="h-[320px] animate-pulse rounded-b-2xl bg-[var(--color-surface-muted)]" />
                    </article>

                    <article className="panel-shadow overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
                        <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                            <div className="h-4 w-56 animate-pulse rounded bg-[var(--color-brand-100)]" />
                        </div>
                        <div className="h-[320px] animate-pulse rounded-b-2xl bg-[var(--color-surface-muted)]" />
                    </article>

                    <article className="panel-shadow overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
                        <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                            <div className="h-4 w-56 animate-pulse rounded bg-[var(--color-brand-100)]" />
                        </div>
                        <div className="h-[320px] animate-pulse rounded-b-2xl bg-[var(--color-surface-muted)]" />
                    </article>

                    <article className="panel-shadow overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] lg:col-span-2">
                        <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                            <div className="h-4 w-56 animate-pulse rounded bg-[var(--color-brand-100)]" />
                        </div>
                        <div className="h-[280px] animate-pulse rounded-b-2xl bg-[var(--color-surface-muted)]" />
                    </article>
                </div>
            </section>
        );
    }

    if (globalError && cards.length === 0) {
        return (
            <section className="panel-shadow mx-auto w-full max-w-[1560px] rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6">
                <div className="flex min-h-[460px] flex-col items-center justify-center rounded-xl bg-[var(--color-surface-muted)] px-6 text-center">
                    <p className="text-base font-bold text-[var(--color-text-strong)]">
                        Unable to load QuickSight visuals
                    </p>
                    <p className="mt-2 max-w-xl text-sm text-[var(--color-text-primary)]">{globalError}</p>
                    <button
                        type="button"
                        onClick={() => void reloadAllVisuals()}
                        className="mt-5 h-10 rounded-lg bg-[var(--color-brand-600)] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1f45af]"
                    >
                        Retry
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="mx-auto w-full max-w-[1560px] space-y-4">
            {globalError && cards.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
                    Refresh failed. Showing the latest loaded visuals. {globalError}
                </div>
            )}

            {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    {warnings.length === 1
                        ? '1 visual could not be generated by QuickSight and may be missing from this view.'
                        : `${warnings.length} visuals could not be generated by QuickSight and may be missing from this view.`}
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                {groupedHeroCards.length > 0 && (
                    <article className="panel-shadow overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
                        <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                            <h3 className="text-base font-bold text-[var(--color-brand-600)]">
                                1 - Gross Fees by Scheme and Business Unit
                            </h3>
                        </div>

                        <div className="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-4">
                            {groupedHeroCards.map((card) => (
                                <article
                                    key={`hero-${card.key}`}
                                    className={`overflow-hidden rounded-lg border ${
                                        card.heroHighlight
                                            ? 'border-[var(--color-brand-300)] bg-[var(--color-brand-100)]'
                                            : 'border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]'
                                    }`}
                                >
                                    <div
                                        className={`border-b px-3 py-2 ${
                                            card.heroHighlight
                                                ? 'border-[var(--color-brand-300)] bg-[var(--color-brand-100)]'
                                                : 'border-[var(--color-border-soft)] bg-[var(--color-surface)]'
                                        }`}
                                    >
                                        <p className="text-xs font-bold text-[var(--color-brand-600)]">
                                            {card.title}
                                        </p>
                                    </div>
                                    {renderVisualBody(card)}
                                </article>
                            ))}
                        </div>
                    </article>
                )}

                {categoryCard && (
                    <article className="panel-shadow overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
                        <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                            <h3 className="text-sm font-bold text-[var(--color-brand-600)]">{categoryCard.title}</h3>
                        </div>
                        <div className="bg-[var(--color-surface-muted)]">{renderVisualBody(categoryCard)}</div>
                    </article>
                )}

                {jurisdictionCard && (
                    <article className="panel-shadow overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
                        <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                            <h3 className="text-sm font-bold text-[var(--color-brand-600)]">
                                {jurisdictionCard.title}
                            </h3>
                        </div>
                        <div className="bg-[var(--color-surface-muted)]">{renderVisualBody(jurisdictionCard)}</div>
                    </article>
                )}

                {evolutionCard && (
                    <article className="panel-shadow overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
                        <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                            <h3 className="text-sm font-bold text-[var(--color-brand-600)]">{evolutionCard.title}</h3>
                        </div>
                        <div className="bg-[var(--color-surface-muted)]">{renderVisualBody(evolutionCard)}</div>
                    </article>
                )}

                {monthlyCard && (
                    <article className="panel-shadow overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] lg:col-span-2">
                        <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                            <h3 className="text-sm font-bold text-[var(--color-brand-600)]">{monthlyCard.title}</h3>
                        </div>
                        <div className="bg-[var(--color-surface-muted)]">{renderVisualBody(monthlyCard)}</div>
                    </article>
                )}

                {fallbackCards.length > 0 && (
                    <article className="panel-shadow overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] lg:col-span-2">
                        <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                            <h3 className="text-sm font-bold text-[var(--color-brand-600)]">Additional visuals</h3>
                        </div>
                        <div className="grid gap-4 p-4 md:grid-cols-2">
                            {fallbackCards.map((card) => (
                                <article
                                    key={card.key}
                                    className={`overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] ${
                                        card.desktopSpan === 2 || card.colSpan === 2 ? 'md:col-span-2' : ''
                                    }`}
                                >
                                    <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
                                        <h3 className="text-sm font-bold text-[var(--color-brand-600)]">
                                            {card.title}
                                        </h3>
                                    </div>
                                    {renderVisualBody(card)}
                                </article>
                            ))}
                        </div>
                    </article>
                )}
            </div>
        </section>
    );
}
