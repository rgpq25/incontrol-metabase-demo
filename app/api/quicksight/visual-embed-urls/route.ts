import { NextResponse } from 'next/server';

const DEFAULT_DASHBOARD_ID = '4ecd3350-2b80-4ac1-b1da-8819819f5f2f';
const QUICK_SIGHT_VISUALS_ENDPOINT =
    'https://3had8hcyhg.execute-api.eu-south-2.amazonaws.com/embed-visual-urls';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface UpstreamVisual {
    sheetId: string;
    visualId: string;
    embedUrl: string;
}

interface UpstreamPayload {
    dashboardId: string;
    expiresInMinutes: number;
    visuals: UpstreamVisual[];
    errors?: string[];
}

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

function parseQuery(request: Request) {
    try {
        const url = new URL(request.url);
        return {
            dashboardId: url.searchParams.get('dashboardId')?.trim() || DEFAULT_DASHBOARD_ID,
            sheetId: url.searchParams.get('sheetId')?.trim() || null,
            visualId: url.searchParams.get('visualId')?.trim() || null,
        };
    } catch {
        return {
            dashboardId: DEFAULT_DASHBOARD_ID,
            sheetId: null,
            visualId: null,
        };
    }
}

function buildUpstreamUrl({
    dashboardId,
    sheetId,
    visualId,
}: {
    dashboardId: string;
    sheetId: string | null;
    visualId: string | null;
}) {
    const url = new URL(QUICK_SIGHT_VISUALS_ENDPOINT);
    url.searchParams.set('dashboardId', dashboardId);

    if (sheetId) url.searchParams.set('sheetId', sheetId);
    if (visualId) url.searchParams.set('visualId', visualId);

    return url.toString();
}

function normalizePayload(payload: unknown): UpstreamPayload | null {
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

    const normalizedVisuals: UpstreamVisual[] = [];
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

    const normalizedErrors =
        Array.isArray(errors) && errors.every((item) => typeof item === 'string')
            ? (errors as string[])
            : [];

    return {
        dashboardId,
        expiresInMinutes,
        visuals: normalizedVisuals,
        errors: normalizedErrors,
    };
}

export async function GET(request: Request) {
    const { dashboardId, sheetId, visualId } = parseQuery(request);

    try {
        const upstreamUrl = buildUpstreamUrl({ dashboardId, sheetId, visualId });
        const upstreamResponse = await fetch(upstreamUrl, {
            method: 'GET',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
        });

        if (!upstreamResponse.ok) {
            return errorResponse(
                'Failed to fetch QuickSight visual embed URLs',
                502,
                `Upstream status: ${upstreamResponse.status}`
            );
        }

        let upstreamPayload: unknown;
        try {
            upstreamPayload = await upstreamResponse.json();
        } catch {
            return errorResponse('Invalid JSON received from QuickSight visual endpoint', 502);
        }

        const normalizedPayload = normalizePayload(upstreamPayload);
        if (!normalizedPayload) {
            return errorResponse('QuickSight visual endpoint returned an invalid payload', 502);
        }

        return NextResponse.json(normalizedPayload, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        return errorResponse('Unable to reach QuickSight visual endpoint', 502, String(error));
    }
}
