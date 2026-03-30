# QuickSight Console Embedding Page

**Date:** 2026-03-27
**Status:** Approved

## Overview

A new "Analytics & Reports" page at `/analytics` that embeds the AWS QuickSight console in a full-viewport overlay. The page starts maximized by default, giving the user an immersive experience. A floating pill button lets the user toggle between maximized (full viewport, no portal chrome) and minimized (standard portal layout with header + sidebar).

The backend endpoint `GET /quicksight/console-url` already exists and generates embed URLs for the QuickSight console. This spec covers the frontend proxy route, page component, and sidebar integration.

## Routing & Navigation

- **Route:** `app/analytics/page.tsx`
- **Sidebar:** Unblock the existing "Analytics & Reports" menu item in `components/layout/Sidebar.tsx`, link it to `/analytics`
- The `availableDashboards` config is not modified — this is a standalone top-level menu item, not a dashboard entry

## API Proxy

**New route:** `app/api/quicksight/console-url/route.ts`

Follows the same pattern as `app/api/quicksight/embed-url/route.ts`:

- `GET` handler with `force-dynamic` and `revalidate = 0`
- Forwards optional `initialPath` query param (defaults to `/start/analyses`)
- Upstream URL: `https://3had8hcyhg.execute-api.eu-south-2.amazonaws.com/quicksight/console-url`
- Response shape:
  ```typescript
  {
    embedUrl: string;
    initialPath: string;
    expiresInMinutes: number;
  }
  ```
- Same error normalization and `no-store` cache headers as existing proxies

## Page Component

**File:** `features/analytics/components/QuickSightConsoleEmbed.tsx`

### State Machine

Two modes, toggled by a single boolean (`maximized`):

| Mode | Layout | Iframe sizing |
|------|--------|---------------|
| **Maximized** (default) | Fixed overlay covering entire viewport (`position: fixed`, `inset: 0`, `z-[60]`). Header (`z-50`) and sidebar hidden underneath. Body scroll locked. | 100vw x 100vh |
| **Minimized** | Standard `MainLayout` wrapper (header + sidebar visible). Console inside normal content area with panel styling. | Content area width x 780px |

### Key Behaviors

- **Default state:** Maximized on mount
- **Iframe persistence (maximize/minimize only):** The iframe is never remounted when toggling between maximized and minimized. It stays in the DOM and gets repositioned via CSS. This preserves QuickSight console state across layout toggles. This guarantee does **not** extend to session refresh — see below.
- **Transition:** Switching between `fixed` and `relative` positioning cannot be smoothly CSS-transitioned. Instead, use a simple **opacity fade** (~200ms): fade out, swap position classes, fade in. No transform or FLIP choreography needed.
- **Session expiry handling:** Changing the iframe `src` **reloads the QuickSight console entirely** — the user loses their current navigation state within the console and lands back at the initial path. This is unavoidable. Instead of auto-refreshing silently, show a non-intrusive banner 2 minutes before expiry: "Session expiring — your current view will reset when refreshed." The user clicks to reload when ready. On refresh, the proxy is called **without** `initialPath` so the Lambda uses its default (`/start/analyses`). Reference `QuickSightVisualGrid` (line ~472) for the timer pattern, not `QuickSightDashboardEmbed` (which has no timer).
- **Loading state:** Full-height skeleton with spinner, matching existing pattern (`panel-shadow` container, centered spinner + text)
- **Error state:** Error panel with message and retry button, matching existing pattern

## Floating Pill Button

- Small rounded pill, ~40px tall
- Styling: `bg-white/90 backdrop-blur-sm` with `panel-shadow` and `border-[var(--color-border-soft)]`
- Icons: `Maximize2` (when minimized) / `Minimize2` (when maximized) from lucide-react, plus short label text
- Position: `top-4 right-4` — `fixed` in maximized mode, `absolute` in minimized mode
- **Stacking:** The pill must have `z-[70]` and `pointer-events-auto` to sit above the iframe. Iframes capture pointer events and can obscure sibling elements without an explicit stacking contract. The pill is rendered as a sibling to the iframe, not inside it.
- Always visible (not hover-only) since in maximized mode there's no other portal UI
- Hover state: slight background darken

## Iframe Persistence Strategy

The iframe must not be remounted when toggling modes (remounting reloads the QuickSight console). The technique:

- The iframe lives inside a single persistent `<div>` container
- In **maximized** mode: the container gets `position: fixed; inset: 0; z-[60]` — it covers the viewport (z-[60] clears the header's z-50)
- In **minimized** mode: the container gets `position: relative; height: 780px` — it flows inside the content area
- `MainLayout` is **always rendered** around the page content. In maximized mode, the fixed overlay simply covers it visually. In minimized mode, the layout is visible as normal.
- This means the sidebar/header are always in the DOM — they're just hidden behind the overlay when maximized. No conditional mounting of `MainLayout`.

## Maximized Mode: Scroll Lock & Isolation

When maximized, the full portal shell (header at `z-50`, sidebar, main content) remains mounted underneath the `z-[60]` overlay.

**Pointer isolation:** The overlay at `z-[60]` fully covers the viewport. The header (`z-50`) and sidebar (`z-40`) are behind it and unreachable by pointer. No additional pointer-event blocking needed.

**Scroll lock:** Set `document.body.style.overflow = 'hidden'` on maximize, remove on minimize.

**Keyboard/focus:** The iframe captures its own tab order internally. The only other focusable element is the pill button at `z-[70]`. Since the iframe and pill are the only interactive elements in the overlay, tabbing is naturally contained. No explicit focus trap or `inert` attribute needed — the `z-[60]` overlay makes the background visually and practically unreachable.

**Why not `inert`:** Using `inert` on MainLayout would require either (a) rendering the overlay outside MainLayout via a portal (breaks minimized-mode positioning) or (b) restructuring the page to render siblings (unnecessary complexity). The z-index layering provides sufficient isolation for this use case.

## Page Structure (Pseudocode)

```tsx
// Page at app/analytics/page.tsx
export default function AnalyticsPage() {
  return (
    <MainLayout>
      <QuickSightConsoleEmbed />
    </MainLayout>
  );
}
```

```tsx
function QuickSightConsoleEmbed() {
  const [maximized, setMaximized] = useState(true);
  const [embedUrl, setEmbedUrl] = useState(null);
  const [fading, setFading] = useState(false);
  // ... loading, error, expiry states

  // Toggle with fade transition
  function toggle() {
    setFading(true);                       // start fade-out (~200ms)
    setTimeout(() => {
      setMaximized(m => !m);               // swap position classes
      setFading(false);                     // fade-in
    }, 200);
  }

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = maximized ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [maximized]);

  return (
    <div className={`
      ${maximized ? "fixed inset-0 z-[60] bg-white" : "relative h-[780px] panel-shadow rounded-2xl ..."}
      transition-opacity duration-200
      ${fading ? "opacity-0" : "opacity-100"}
    `}>
      <iframe src={embedUrl} className="h-full w-full border-0" />
      <button
        onClick={toggle}
        className="fixed top-4 right-4 z-[70] pointer-events-auto ..."
      >
        {maximized ? <Minimize2 /> : <Maximize2 />}
      </button>
      {expiryWarning && <SessionExpiryBanner onRefresh={refetch} />}
    </div>
  );
}
```

No portal needed. The iframe container is a direct child within MainLayout's content area. When maximized, `position: fixed` takes it out of flow and covers the viewport. When minimized, `position: relative` puts it back in the content flow. The iframe DOM node is the same in both cases — no remount.

## Sidebar Changes

In `components/layout/Sidebar.tsx`, the "Analytics & Reports" entry currently has `blocked: true` and no `href`. Changes:

- Remove `blocked: true`
- Add `href: '/analytics'`

## Scope Decisions

- **`initialPath` deep linking:** Not exposed as a page-level query param for now. The proxy supports it, but the page always starts at `/start/analyses`. Can be added later as `/analytics?path=...` if needed.
- **Mobile/responsive:** Desktop-only. The QuickSight console is not usable on small screens. On viewports below `md`, show a message suggesting the user switch to desktop. This matches the existing sidebar behavior (hidden below `md`).

## Files to Create/Modify

| File | Action |
|------|--------|
| `app/analytics/page.tsx` | Create — page route |
| `app/api/quicksight/console-url/route.ts` | Create — API proxy |
| `features/analytics/components/QuickSightConsoleEmbed.tsx` | Create — main component |
| `components/layout/Sidebar.tsx` | Modify — unblock Analytics & Reports, add href |
