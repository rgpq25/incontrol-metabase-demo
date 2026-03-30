# InControl Portal — QuickSight PoC

## Project Overview

Fee management portal for the payments industry. Embeds AWS QuickSight dashboards/visuals into a branded Next.js frontend. This is a PoC/demo — no test infrastructure.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 with CSS custom properties (see `app/globals.css`)
- **UI primitives:** Radix UI, lucide-react icons, class-variance-authority
- **Font:** Lato (400, 700)

## Architecture

```
Browser → Next.js API routes (proxy) → AWS API Gateway → Lambda → QuickSight
```

- Frontend never calls the Lambda directly
- API proxy routes live in `app/api/quicksight/*`
- Lambda base URL: `https://3had8hcyhg.execute-api.eu-south-2.amazonaws.com`
- Embed URLs are temporary and must not be cached (`Cache-Control: no-store`)

## Key Patterns

### Adding a new QuickSight page

1. Create proxy route in `app/api/quicksight/<endpoint>/route.ts` (copy from `embed-url` route)
2. Create component in `features/<domain>/components/`
3. Create page in `app/<route>/page.tsx`, wrap in `<MainLayout>`
4. Add sidebar entry in `components/layout/Sidebar.tsx`

### Existing embedding modes

| Mode | Page | Component | Proxy |
|------|------|-----------|-------|
| Visual grid | `/fee-dashboard` | `QuickSightVisualGrid` | `/api/quicksight/visual-embed-urls` |
| Full dashboard | `/fee-library` | `QuickSightDashboardEmbed` | `/api/quicksight/embed-url` |
| Console | `/analytics` | `QuickSightConsoleEmbed` | `/api/quicksight/console-url` |

### Styling conventions

- Use CSS variables from `globals.css` (e.g., `var(--color-brand-600)`, `var(--color-border-soft)`)
- Panel cards: `panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)]`
- Loading spinner: `animate-spin rounded-full border-4 border-[var(--color-brand-600)] border-t-transparent`

## Commands

```bash
npm run dev     # Start dev server
npx tsc --noEmit # Type-check (no test runner configured)
```

## Auth

Simple session-based auth with in-memory user store (`lib/users.tsx`). Cookie: `session_user_id`. Middleware protects all non-login routes.

## Reference Docs

Backend API details are in `HANDOVER-*.md` files at the project root (written in Spanish).
