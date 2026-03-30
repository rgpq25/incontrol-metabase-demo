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
