import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DASHBOARD_HOME_PATH } from '@/features/dashboards/config/availableDashboards';
import { users } from '@/lib/users';

const LOGIN_PATH = '/login';
const DEFAULT_AUTHENTICATED_PATH = DASHBOARD_HOME_PATH;

function hasValidSession(request: NextRequest): boolean {
    const sessionUserId = Number(request.cookies.get('session_user_id')?.value ?? '');
    return Number.isFinite(sessionUserId) && users.some((user) => user.id === sessionUserId);
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isAuthenticated = hasValidSession(request);

    if (pathname === LOGIN_PATH) {
        if (isAuthenticated) {
            return NextResponse.redirect(new URL(DEFAULT_AUTHENTICATED_PATH, request.url));
        }
        return NextResponse.next();
    }

    if (!isAuthenticated) {
        return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
