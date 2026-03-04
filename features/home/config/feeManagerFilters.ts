export type FeeManagerBrand = 'Visa' | 'Mastercard' | 'Amex';

export interface FeeManagerFilterState {
    groupViewLabel: 'Group View';
    dateRangeLabel: string;
    brands: Record<FeeManagerBrand, boolean>;
    business: string;
    appliedFilters: string[];
}

export type FeeManagerFilterAction =
    | { type: 'cycleDateRange' }
    | { type: 'toggleBrand'; brand: FeeManagerBrand }
    | { type: 'setBusiness'; business: string }
    | { type: 'removeAppliedFilter'; filter: string };

const DATE_RANGE_PRESETS = ['20 May, 2024 - 20 May, 2025', '01 Jan, 2025 - 31 Jan, 2026'] as const;
const DEFAULT_DASHBOARD_ID = '4ecd3350-2b80-4ac1-b1da-8819819f5f2f';

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
        dateRangeLabel: DATE_RANGE_PRESETS[0],
        brands: {
            Visa: true,
            Mastercard: true,
            Amex: true,
        },
        business: 'All Businesses',
        appliedFilters: ['Europa SEPA', 'Europa Non-SEPA', 'America'],
    };
}

export function feeManagerFilterReducer(
    state: FeeManagerFilterState,
    action: FeeManagerFilterAction
): FeeManagerFilterState {
    switch (action.type) {
        case 'cycleDateRange': {
            const currentIndex = DATE_RANGE_PRESETS.indexOf(
                state.dateRangeLabel as (typeof DATE_RANGE_PRESETS)[number]
            );
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % DATE_RANGE_PRESETS.length : 0;

            return {
                ...state,
                dateRangeLabel: DATE_RANGE_PRESETS[nextIndex],
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
        case 'removeAppliedFilter':
            return {
                ...state,
                appliedFilters: state.appliedFilters.filter((entry) => entry !== action.filter),
            };
        default:
            return state;
    }
}

export interface QuickSightVisualQuery {
    dashboardId: string;
    // Future-ready extension points:
    // dateRange?: { from: string; to: string };
    // brands?: FeeManagerBrand[];
    // business?: string;
}

export function buildQuickSightVisualQuery(filters: FeeManagerFilterState): QuickSightVisualQuery {
    void filters;
    return {
        dashboardId: DEFAULT_DASHBOARD_ID,
    };
}

export function buildQuickSightVisualQueryString(query: QuickSightVisualQuery): string {
    const params = new URLSearchParams();
    params.set('dashboardId', query.dashboardId);
    return params.toString();
}
