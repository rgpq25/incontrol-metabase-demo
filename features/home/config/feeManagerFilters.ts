export type FeeManagerBrand = 'Visa' | 'Mastercard' | 'Amex';

export interface FeeManagerFilterState {
    groupViewLabel: 'Group View';
    startDate: string;
    endDate: string;
    brands: Record<FeeManagerBrand, boolean>;
    business: string;
}

export type FeeManagerFilterAction =
    | { type: 'setStartDate'; value: string }
    | { type: 'setEndDate'; value: string }
    | { type: 'toggleBrand'; brand: FeeManagerBrand }
    | { type: 'setBusiness'; business: string };

const DEFAULT_DASHBOARD_ID = '4ecd3350-2b80-4ac1-b1da-8819819f5f2f';
const DEFAULT_START_DATE = '2023-01-01';
const DEFAULT_END_DATE = '2023-01-31';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const feeManagerBrandOptions: FeeManagerBrand[] = ['Visa', 'Mastercard', 'Amex'];

export const feeManagerBusinessOptions = [
    'All Businesses',
    'Issuer',
    'Acquirer Merchant',
    'Acquirer Cash',
] as const;

export function createInitialFeeManagerFilters(): FeeManagerFilterState {
    return {
        groupViewLabel: 'Group View',
        startDate: DEFAULT_START_DATE,
        endDate: DEFAULT_END_DATE,
        brands: {
            Visa: true,
            Mastercard: true,
            Amex: true,
        },
        business: 'All Businesses',
    };
}

function isIsoDate(value: string): boolean {
    if (!ISO_DATE_PATTERN.test(value)) return false;

    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.toISOString().slice(0, 10) === value;
}

function normalizeDateValue(candidate: string, fallback: string): string {
    const trimmed = candidate.trim();
    return isIsoDate(trimmed) ? trimmed : fallback;
}

export function feeManagerFilterReducer(
    state: FeeManagerFilterState,
    action: FeeManagerFilterAction
): FeeManagerFilterState {
    switch (action.type) {
        case 'setStartDate': {
            const startDate = normalizeDateValue(action.value, state.startDate);
            const endDate = startDate > state.endDate ? startDate : state.endDate;

            return {
                ...state,
                startDate,
                endDate,
            };
        }
        case 'setEndDate': {
            const endDate = normalizeDateValue(action.value, state.endDate);
            const startDate = endDate < state.startDate ? endDate : state.startDate;

            return {
                ...state,
                startDate,
                endDate,
            };
        }
        case 'toggleBrand':
            return {
                ...state,
                brands: {
                    ...state.brands,
                    [action.brand]: !state.brands[action.brand],
                },
            };
        case 'setBusiness':
            return {
                ...state,
                business: action.business,
            };
        default:
            return state;
    }
}

export type QuickSightParameterValue = string | string[];

export interface QuickSightVisualQuery {
    dashboardId: string;
    parameters: Record<string, QuickSightParameterValue>;
}

function getSelectedBrands(filters: FeeManagerFilterState): FeeManagerBrand[] {
    return feeManagerBrandOptions.filter((brand) => filters.brands[brand]);
}

export function buildQuickSightVisualQuery(filters: FeeManagerFilterState): QuickSightVisualQuery {
    const selectedBrands = getSelectedBrands(filters);
    const parameters: Record<string, QuickSightParameterValue> = {
        StartDate: filters.startDate,
        EndDate: filters.endDate,
    };

    if (selectedBrands.length > 0) parameters.Brand = selectedBrands;

    return {
        dashboardId: DEFAULT_DASHBOARD_ID,
        parameters,
    };
}

export function buildQuickSightVisualQueryString(query: QuickSightVisualQuery): string {
    const params = new URLSearchParams();
    params.set('dashboardId', query.dashboardId);
    params.set('parameters', JSON.stringify(query.parameters));
    return params.toString();
}
