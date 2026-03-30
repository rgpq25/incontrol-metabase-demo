# QuickSight Console Embedding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Analytics & Reports" page at `/analytics` that embeds the QuickSight console in a full-viewport overlay with maximize/minimize toggle.

**Architecture:** A Next.js API proxy forwards requests to the existing Lambda endpoint. A client component manages the iframe in two CSS modes (fixed overlay vs. inline), with an opacity fade transition between them. The sidebar gets a new unblocked link.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, lucide-react icons

**Testing note:** This project has no test infrastructure (no Jest, Vitest, or Playwright configured). Steps are implementation-only. Manual verification instructions are provided instead.

**Spec:** `docs/superpowers/specs/2026-03-27-quicksight-console-embedding-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/api/quicksight/console-url/route.ts` | Create | API proxy — forwards GET to Lambda, normalizes response |
| `features/analytics/components/QuickSightConsoleEmbed.tsx` | Create | Main component — iframe, maximize/minimize, scroll lock, expiry banner |
| `app/analytics/page.tsx` | Create | Page route — wraps component in MainLayout |
| `components/layout/Sidebar.tsx` | Modify | Unblock "Analytics & Reports", add href |

---

### Task 1: API Proxy Route

**Files:**
- Create: `app/api/quicksight/console-url/route.ts`
- Reference: `app/api/quicksight/embed-url/route.ts`

- [ ] **Step 1: Create the proxy route**

```typescript
// app/api/quicksight/console-url/route.ts
import { NextResponse } from 'next/server';

const QUICKSIGHT_CONSOLE_ENDPOINT =
    'https://3had8hcyhg.execute-api.eu-south-2.amazonaws.com/quicksight/console-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function errorResponse(message: string, status = 500, details?: string) {
    return NextResponse.json(
        {
            error: message,
            ...(details ? { details } : {}),
        },
        {
            status,
            headers: { 'Cache-Control': 'no-store' },
        }
    );
}

function parseInitialPath(request: Request): string {
    try {
        const url = new URL(request.url);
        return url.searchParams.get('initialPath')?.trim() || '/start/analyses';
    } catch {
        return '/start/analyses';
    }
}

function normalizePayload(payload: unknown) {
    if (!payload || typeof payload !== 'object') return null;

    const candidate = payload as Record<string, unknown>;
    const embedUrl = candidate.embedUrl;
    const initialPath = candidate.initialPath;
    const expiresInMinutes = candidate.expiresInMinutes;

    if (
        typeof embedUrl !== 'string' ||
        typeof initialPath !== 'string' ||
        typeof expiresInMinutes !== 'number'
    ) {
        return null;
    }

    return { embedUrl, initialPath, expiresInMinutes };
}

export async function GET(request: Request) {
    const initialPath = parseInitialPath(request);

    try {
        const upstreamUrl = `${QUICKSIGHT_CONSOLE_ENDPOINT}?initialPath=${encodeURIComponent(initialPath)}`;
        const upstreamResponse = await fetch(upstreamUrl, {
            method: 'GET',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
        });

        if (!upstreamResponse.ok) {
            return errorResponse(
                'Failed to fetch QuickSight console URL',
                502,
                `Upstream status: ${upstreamResponse.status}`
            );
        }

        let upstreamPayload: unknown;
        try {
            upstreamPayload = await upstreamResponse.json();
        } catch {
            return errorResponse('Invalid JSON received from QuickSight endpoint', 502);
        }

        const normalizedPayload = normalizePayload(upstreamPayload);
        if (!normalizedPayload) {
            return errorResponse('QuickSight endpoint returned an invalid payload', 502);
        }

        return NextResponse.json(normalizedPayload, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        return errorResponse('Unable to reach QuickSight endpoint', 502, String(error));
    }
}
```

- [ ] **Step 2: Verify the proxy compiles**

Run: `npx next build --no-lint 2>&1 | head -30` (or start dev server and hit `http://localhost:3000/api/quicksight/console-url` — expect a 502 since there's no Lambda access locally, but the route should resolve without a build error).

- [ ] **Step 3: Commit**

```bash
git add app/api/quicksight/console-url/route.ts
git commit -m "feat: add API proxy for QuickSight console-url endpoint"
```

---

### Task 2: QuickSightConsoleEmbed Component

**Files:**
- Create: `features/analytics/components/QuickSightConsoleEmbed.tsx`
- Reference: `features/home/components/QuickSightDashboardEmbed.tsx` (loading/error patterns)
- Reference: `features/home/components/QuickSightVisualGrid.tsx:217-263,472-489` (session expiry timer)

- [ ] **Step 1: Create the component file with types and fetch logic**

```typescript
// features/analytics/components/QuickSightConsoleEmbed.tsx
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
    // On small screens, show a message instead of the console
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
```

- [ ] **Step 2: Verify the component compiles**

Run the dev server. The component won't render yet (no page route), but import errors would show in the terminal.

- [ ] **Step 3: Commit**

```bash
git add features/analytics/components/QuickSightConsoleEmbed.tsx
git commit -m "feat: add QuickSightConsoleEmbed component with maximize/minimize toggle"
```

---

### Task 3: Page Route

**Files:**
- Create: `app/analytics/page.tsx`
- Reference: `app/fee-library/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/analytics/page.tsx
import { MainLayout } from '@/components/layout/MainLayout';
import { QuickSightConsoleEmbed } from '@/features/analytics/components/QuickSightConsoleEmbed';

export default function AnalyticsPage() {
    return (
        <MainLayout>
            <QuickSightConsoleEmbed />
        </MainLayout>
    );
}
```

- [ ] **Step 2: Verify the page renders**

Open `http://localhost:3000/analytics` in the browser. Expected:
- If Lambda is unreachable: you see the error state with "Unable to load QuickSight console" and a Retry button — confirms the component renders correctly.
- If Lambda is reachable: you see the console iframe in maximized mode (full viewport, no header/sidebar), with the floating pill button top-right.
- On a narrow viewport (< 768px): you see the "Desktop Required" message instead.

- [ ] **Step 3: Commit**

```bash
git add app/analytics/page.tsx
git commit -m "feat: add /analytics page route for QuickSight console embedding"
```

---

### Task 4: Sidebar Navigation

**Files:**
- Modify: `components/layout/Sidebar.tsx:42`

- [ ] **Step 1: Unblock "Analytics & Reports" and add href**

In `components/layout/Sidebar.tsx`, find this line (currently line 42):

```typescript
    { icon: BarChart3, label: 'Analytics & Reports', blocked: true },
```

Replace with:

```typescript
    { icon: BarChart3, label: 'Analytics & Reports', href: '/analytics' },
```

- [ ] **Step 2: Verify sidebar navigation**

Open `http://localhost:3000/dashboards` in the browser. Expected:
- "Analytics & Reports" in the sidebar is no longer grayed out
- Clicking it navigates to `/analytics`
- The menu item highlights when on the `/analytics` route
- Other sidebar items are unaffected

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: unblock Analytics & Reports sidebar link to /analytics"
```

---

### Task 5: Final Verification

- [ ] **Step 1: End-to-end manual walkthrough**

1. Start the dev server: `npm run dev`
2. Log in with any test user
3. Click "Analytics & Reports" in the sidebar → should navigate to `/analytics`
4. Page should load in **maximized** mode (full viewport, no header/sidebar visible)
5. The floating pill button should show "Minimize" in the top-right
6. Click "Minimize" → opacity fades, then header + sidebar appear, console shrinks to content area
7. Click "Maximize" → opacity fades, then console covers viewport again
8. Body should not scroll when maximized
9. Resize browser below 768px → "Desktop Required" message appears
10. If session expires: amber banner appears at bottom with "Refresh" button

- [ ] **Step 2: Commit all (if any uncommitted cleanup)**

```bash
git status
# If clean, no action needed.
# If there are fixes from the walkthrough, commit them:
git add -A
git commit -m "fix: address issues found during manual verification"
```
