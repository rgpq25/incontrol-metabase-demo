import { NextResponse } from 'next/server';

const DEFAULT_DASHBOARD_ID = '4ecd3350-2b80-4ac1-b1da-8819819f5f2f';
const QUICK_SIGHT_EMBED_ENDPOINT =
    'https://3had8hcyhg.execute-api.eu-south-2.amazonaws.com/embed-url';

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

function parseDashboardId(request: Request) {
    try {
        const url = new URL(request.url);
        return url.searchParams.get('dashboardId')?.trim() || DEFAULT_DASHBOARD_ID;
    } catch {
        return DEFAULT_DASHBOARD_ID;
    }
}

function normalizePayload(payload: unknown) {
    if (!payload || typeof payload !== 'object') return null;

    const candidate = payload as Record<string, unknown>;
    const embedUrl = candidate.embedUrl;
    const dashboardId = candidate.dashboardId;
    const expiresInMinutes = candidate.expiresInMinutes;

    if (
        typeof embedUrl !== 'string' ||
        typeof dashboardId !== 'string' ||
        typeof expiresInMinutes !== 'number'
    ) {
        return null;
    }

    return {
        embedUrl,
        dashboardId,
        expiresInMinutes,
    };
}

export async function GET(request: Request) {
    const dashboardId = parseDashboardId(request);

    try {
        const upstreamUrl = `${QUICK_SIGHT_EMBED_ENDPOINT}?dashboardId=${encodeURIComponent(dashboardId)}`;
        const upstreamResponse = await fetch(upstreamUrl, {
            method: 'GET',
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!upstreamResponse.ok) {
            return errorResponse(
                'Failed to fetch QuickSight embed URL',
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
