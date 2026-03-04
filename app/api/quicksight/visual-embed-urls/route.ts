import { NextResponse } from 'next/server';
import type {
    EmbedVisualError,
    EmbedVisualErrorResponse,
    EmbedVisualUrlsResponse,
    ExternalFilterContract,
    ExternalFilterParameter,
} from '@/features/home/config/quicksightEmbedContract';

const DEFAULT_DASHBOARD_ID = '4ecd3350-2b80-4ac1-b1da-8819819f5f2f';
const QUICK_SIGHT_VISUALS_ENDPOINT =
    'https://3had8hcyhg.execute-api.eu-south-2.amazonaws.com/embed-visual-urls';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function errorResponse(error: string, status = 500, detail?: EmbedVisualErrorResponse['detail']) {
    return NextResponse.json(
        {
            error,
            ...(detail ? { detail } : {}),
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
            parameters: url.searchParams.get('parameters')?.trim() || null,
        };
    } catch {
        return {
            dashboardId: DEFAULT_DASHBOARD_ID,
            sheetId: null,
            visualId: null,
            parameters: null,
        };
    }
}

function buildUpstreamUrl({
    dashboardId,
    sheetId,
    visualId,
    parameters,
}: {
    dashboardId: string;
    sheetId: string | null;
    visualId: string | null;
    parameters: string | null;
}) {
    const url = new URL(QUICK_SIGHT_VISUALS_ENDPOINT);
    url.searchParams.set('dashboardId', dashboardId);

    if (sheetId) url.searchParams.set('sheetId', sheetId);
    if (visualId) url.searchParams.set('visualId', visualId);
    if (parameters) url.searchParams.set('parameters', parameters);

    return url.toString();
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

    const normalizedVisuals: EmbedVisualUrlsResponse['visuals'] = [];
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

function normalizeUpstreamErrorPayload(payload: unknown, fallbackMessage: string): EmbedVisualErrorResponse {
    if (!payload || typeof payload !== 'object') {
        return { error: 'UPSTREAM_ERROR', detail: { message: fallbackMessage } };
    }

    const candidate = payload as Record<string, unknown>;
    const error = typeof candidate.error === 'string' ? candidate.error : 'UPSTREAM_ERROR';

    if (candidate.detail && typeof candidate.detail === 'object') {
        return { error, detail: candidate.detail as EmbedVisualErrorResponse['detail'] };
    }

    if (typeof candidate.detail === 'string') {
        return { error, detail: { message: candidate.detail } };
    }

    if (typeof candidate.details === 'string') {
        return { error, detail: { message: candidate.details } };
    }

    if (typeof candidate.message === 'string') {
        return { error, detail: { message: candidate.message } };
    }

    return { error, detail: { message: fallbackMessage } };
}

export async function GET(request: Request) {
    const { dashboardId, sheetId, visualId, parameters } = parseQuery(request);

    try {
        const upstreamUrl = buildUpstreamUrl({ dashboardId, sheetId, visualId, parameters });
        const upstreamResponse = await fetch(upstreamUrl, {
            method: 'GET',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
        });

        let upstreamPayload: unknown;
        try {
            upstreamPayload = await upstreamResponse.json();
        } catch {
            if (!upstreamResponse.ok) {
                return errorResponse('UPSTREAM_ERROR', upstreamResponse.status, {
                    message: `Upstream status: ${upstreamResponse.status}`,
                });
            }

            return errorResponse('INVALID_UPSTREAM_JSON', 502, {
                message: 'Invalid JSON received from QuickSight visual endpoint',
            });
        }

        if (!upstreamResponse.ok) {
            const normalizedError = normalizeUpstreamErrorPayload(
                upstreamPayload,
                `Upstream status: ${upstreamResponse.status}`
            );
            return NextResponse.json(normalizedError, {
                status: upstreamResponse.status,
                headers: { 'Cache-Control': 'no-store' },
            });
        }

        const normalizedPayload = normalizePayload(upstreamPayload);
        if (!normalizedPayload) {
            return errorResponse('INVALID_UPSTREAM_PAYLOAD', 502, {
                message: 'QuickSight visual endpoint returned an invalid payload',
            });
        }

        return NextResponse.json(normalizedPayload, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        return errorResponse('UPSTREAM_UNREACHABLE', 502, {
            message: String(error),
        });
    }
}
