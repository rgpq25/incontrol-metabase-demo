'use client';

import { Maximize2, Minimize2, Monitor, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ConsolePayload {
    embedUrl: string;
    initialPath: string;
    expiresInMinutes: number;
}

const SESSION_EXPIRY_WARNING_MS = 2 * 60_000; // show banner 2 min before expiry
const MIN_EXPIRY_TIMER_MS = 15_000;

function getExpiryWarningDelayMs(expiresInMinutes: number): number {
    const ttlMs = expiresInMinutes * 60_000;
    return Math.max(ttlMs - SESSION_EXPIRY_WARNING_MS, MIN_EXPIRY_TIMER_MS);
}

function parseErrorMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const candidate = payload as Record<string, unknown>;
    if (typeof candidate.error === 'string' && typeof candidate.details === 'string')
        return `${candidate.error}: ${candidate.details}`;
    if (typeof candidate.error === 'string') return candidate.error;
    return null;
}

export function QuickSightConsoleEmbed() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<ConsolePayload | null>(null);
    const [maximized, setMaximized] = useState(true);
    const [fading, setFading] = useState(false);
    const [expiryWarning, setExpiryWarning] = useState(false);
    const expiryTimerRef = useRef<number | null>(null);

    const fetchConsoleUrl = useCallback(async () => {
        setLoading(true);
        setError(null);
        setExpiryWarning(false);

        try {
            const response = await fetch('/api/quicksight/console-url', {
                method: 'GET',
                cache: 'no-store',
                headers: { Accept: 'application/json' },
                credentials: 'include',
            });

            let jsonPayload: unknown = null;
            try {
                jsonPayload = await response.json();
            } catch {
                jsonPayload = null;
            }

            if (!response.ok) {
                const message = parseErrorMessage(jsonPayload);
                setError(message ?? 'Could not load QuickSight console.');
                setPayload(null);
                return;
            }

            if (!jsonPayload || typeof jsonPayload !== 'object') {
                setError('Invalid response received from console service.');
                setPayload(null);
                return;
            }

            const candidate = jsonPayload as Record<string, unknown>;
            if (
                typeof candidate.embedUrl !== 'string' ||
                typeof candidate.initialPath !== 'string' ||
                typeof candidate.expiresInMinutes !== 'number'
            ) {
                setError('Console response is missing required fields.');
                setPayload(null);
                return;
            }

            const newPayload: ConsolePayload = {
                embedUrl: candidate.embedUrl as string,
                initialPath: candidate.initialPath as string,
                expiresInMinutes: candidate.expiresInMinutes as number,
            };

            setPayload(newPayload);

            // Schedule expiry warning
            if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current);
            const delay = getExpiryWarningDelayMs(newPayload.expiresInMinutes);
            expiryTimerRef.current = window.setTimeout(() => {
                setExpiryWarning(true);
            }, delay);
        } catch {
            setError('Network error while loading QuickSight console.');
            setPayload(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        void fetchConsoleUrl();
        return () => {
            if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current);
        };
    }, [fetchConsoleUrl]);

    // Scroll lock
    useEffect(() => {
        document.body.style.overflow = maximized ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [maximized]);

    const toggle = () => {
        setFading(true);
        setTimeout(() => {
            setMaximized((m) => !m);
            setFading(false);
        }, 200);
    };

    const handleRefresh = () => {
        void fetchConsoleUrl();
    };

    // ── Mobile gate ──
    const mobileGate = (
        <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center md:hidden">
            <Monitor size={48} className="mb-4 text-[var(--color-text-muted)]" />
            <p className="text-base font-bold text-[var(--color-text-strong)]">Desktop Required</p>
            <p className="mt-2 max-w-sm text-sm text-[var(--color-text-primary)]">
                The Analytics console requires a larger screen. Please switch to a desktop browser.
            </p>
        </div>
    );

    // ── Loading state ──
    if (loading) {
        return (
            <>
                {mobileGate}
                <section className="hidden md:block">
                    <div className="panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4">
                        <div className="flex h-[780px] flex-col items-center justify-center rounded-xl bg-[var(--color-surface-muted)]">
                            <div
                                role="status"
                                aria-label="Loading QuickSight console"
                                className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-brand-600)] border-t-transparent"
                            />
                            <p className="mt-4 text-sm text-[var(--color-text-primary)]">
                                Loading console...
                            </p>
                        </div>
                    </div>
                </section>
            </>
        );
    }

    // ── Error state ──
    if (error || !payload) {
        return (
            <>
                {mobileGate}
                <section className="hidden md:block">
                    <div className="panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4">
                        <div className="flex h-[780px] flex-col items-center justify-center rounded-xl bg-[var(--color-surface-muted)] px-6 text-center">
                            <p className="text-base font-bold text-[var(--color-text-strong)]">
                                Unable to load QuickSight console
                            </p>
                            <p className="mt-2 max-w-xl text-sm text-[var(--color-text-primary)]">
                                {error ?? 'Unexpected error while loading console.'}
                            </p>
                            <button
                                type="button"
                                onClick={handleRefresh}
                                className="mt-5 h-10 rounded-lg bg-[var(--color-brand-600)] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1f45af]"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </section>
            </>
        );
    }

    // ── Console embed ──
    const containerClasses = maximized
        ? 'fixed inset-0 z-[60] bg-white'
        : 'relative h-[780px] overflow-hidden rounded-2xl border border-[var(--color-border-soft)] panel-shadow';

    return (
        <>
            {mobileGate}
            <div
                className={`
                    hidden md:block
                    transition-opacity duration-200
                    ${fading ? 'opacity-0' : 'opacity-100'}
                    ${containerClasses}
                `}
            >
                <iframe
                    src={payload.embedUrl}
                    title="QuickSight Analytics Console"
                    className="h-full w-full border-0"
                    allowFullScreen
                />

                {/* Floating pill toggle */}
                <button
                    type="button"
                    onClick={toggle}
                    className={`
                        pointer-events-auto z-[70]
                        flex h-10 items-center gap-2 rounded-full
                        border border-[var(--color-border-soft)] bg-white/90
                        px-4 text-sm font-bold text-[var(--color-text-primary)]
                        shadow-md backdrop-blur-sm
                        transition-colors hover:bg-[var(--color-surface-muted)]
                        ${maximized ? 'fixed right-4 top-4' : 'absolute right-3 top-3'}
                    `}
                    aria-label={maximized ? 'Minimize console' : 'Maximize console'}
                >
                    {maximized ? (
                        <>
                            <Minimize2 size={16} />
                            <span>Minimize</span>
                        </>
                    ) : (
                        <>
                            <Maximize2 size={16} />
                            <span>Maximize</span>
                        </>
                    )}
                </button>

                {/* Session expiry banner */}
                {expiryWarning && (
                    <div
                        className={`
                            pointer-events-auto z-[70]
                            flex items-center gap-3 rounded-full
                            border border-amber-300 bg-amber-50/95 px-5 py-2.5
                            shadow-lg backdrop-blur-sm
                            ${maximized
                                ? 'fixed bottom-4 left-1/2 -translate-x-1/2'
                                : 'absolute bottom-3 left-1/2 -translate-x-1/2'}
                        `}
                    >
                        <span className="text-sm text-amber-800">
                            Session expiring — your current view will reset when refreshed.
                        </span>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="
                                flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1
                                text-xs font-bold text-white transition-colors hover:bg-amber-700
                            "
                        >
                            <RefreshCw size={12} />
                            Refresh
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
