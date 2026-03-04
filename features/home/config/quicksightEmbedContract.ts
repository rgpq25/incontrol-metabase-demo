export type ExternalFilterParameter = { Name: string; Values: string[] };

export type EmbedVisualItem = {
    sheetId: string;
    visualId: string;
    embedUrl: string;
};

export type EmbedVisualError = {
    sheetId: string;
    visualId: string;
    code: string;
    message: string;
};

export type ExternalFilterContract = {
    scope: 'global';
    applyMethod: 'quicksight-sdk:setParameters';
    parameters: ExternalFilterParameter[];
};

export type EmbedVisualUrlsResponse = {
    dashboardId: string;
    expiresInMinutes: number;
    visuals: EmbedVisualItem[];
    errors: EmbedVisualError[];
    externalFilterContract?: ExternalFilterContract;
};

export type EmbedVisualErrorResponse = {
    error: string;
    detail?: {
        message?: string;
        required?: string[];
        [key: string]: unknown;
    };
};
