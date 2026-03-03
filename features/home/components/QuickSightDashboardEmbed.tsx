'use client';

import { useCallback, useEffect, useState } from 'react';

const DASHBOARD_ID = '74f4df53-cee7-4a93-a268-41fd0495b9d2';

interface EmbedPayload {
    embedUrl: string;
    dashboardId: string;
    expiresInMinutes: number;
}

function parseErrorMessage(payload: unknown) {
    if (!payload || typeof payload !== 'object') return null;

    const candidate = payload as Record<string, unknown>;
    const error = candidate.error;
    const details = candidate.details;

    if (typeof error === 'string' && typeof details === 'string') return `${error}: ${details}`;
    if (typeof error === 'string') return error;
    return null;
}

export function QuickSightDashboardEmbed() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<EmbedPayload | null>(null);

    const fetchEmbedUrl = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/quicksight/embed-url?dashboardId=${encodeURIComponent(DASHBOARD_ID)}`,
                {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                }
            );

            let jsonPayload: unknown = null;
            try {
                jsonPayload = await response.json();
            } catch {
                jsonPayload = null;
            }

            if (!response.ok) {
                const message = parseErrorMessage(jsonPayload);
                setError(message ?? 'Could not load QuickSight dashboard.');
                setPayload(null);
                return;
            }

            if (!jsonPayload || typeof jsonPayload !== 'object') {
                setError('Invalid response received from dashboard service.');
                setPayload(null);
                return;
            }

            const candidate = jsonPayload as Record<string, unknown>;
            if (
                typeof candidate.embedUrl !== 'string' ||
                typeof candidate.dashboardId !== 'string' ||
                typeof candidate.expiresInMinutes !== 'number'
            ) {
                setError('Dashboard response is missing required fields.');
                setPayload(null);
                return;
            }

            setPayload({
                embedUrl: candidate.embedUrl,
                dashboardId: candidate.dashboardId,
                expiresInMinutes: candidate.expiresInMinutes,
            });
        } catch {
            setError('Network error while loading QuickSight dashboard.');
            setPayload(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchEmbedUrl();
    }, [fetchEmbedUrl]);

    if (loading) {
        return (
            <section className="panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4">
                <div className="flex h-[780px] flex-col items-center justify-center rounded-xl bg-[var(--color-surface-muted)]">
                    <div
                        role="status"
                        aria-label="Loading QuickSight dashboard"
                        className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-brand-600)] border-t-transparent"
                    />
                    <p className="mt-4 text-sm text-[var(--color-text-primary)]">Loading dashboard...</p>
                </div>
            </section>
        );
    }

    if (error || !payload) {
        return (
            <section className="panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4">
                <div className="flex h-[780px] flex-col items-center justify-center rounded-xl bg-[var(--color-surface-muted)] px-6 text-center">
                    <p className="text-base font-bold text-[var(--color-text-strong)]">
                        Unable to load QuickSight dashboard
                    </p>
                    <p className="mt-2 max-w-xl text-sm text-[var(--color-text-primary)]">
                        {error ?? 'Unexpected error while loading dashboard.'}
                    </p>
                    <button
                        type="button"
                        onClick={() => void fetchEmbedUrl()}
                        className="mt-5 h-10 rounded-lg bg-[var(--color-brand-600)] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1f45af]"
                    >
                        Retry
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4">
            <div className="h-[780px] overflow-hidden rounded-xl border border-[var(--color-border-soft)]">
                <iframe
                    src={payload.embedUrl}
                    title={`QuickSight Dashboard ${payload.dashboardId}`}
                    className="h-full w-full border-0"
                    allowFullScreen
                />
            </div>
        </section>
    );
}
