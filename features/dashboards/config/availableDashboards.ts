export const DASHBOARD_HOME_PATH = '/dashboards';

export type AvailableDashboard = {
    id: string;
    name: string;
    sidebarLabel?: string;
    description: string;
    href: string;
    imageSrc: string;
    imageAlt: string;
    badge: string;
};

export const availableDashboards: AvailableDashboard[] = [
    {
        id: 'scheme-billing-overview',
        name: 'Scheme Billing and Operational Performance Overview',
        sidebarLabel: 'Fee Dashboard',
        description: 'Control your scheme fee billing by being ahead, watch how your money is being spent.',
        href: '/fee-dashboard',
        imageSrc: '/images/logo.png',
        imageAlt: 'Fee dashboard preview',
        badge: 'Standard',
    },
    {
        id: 'scheme-fees-library',
        name: 'Scheme Fees Library',
        sidebarLabel: 'Fee Library',
        description: 'Open the full Fee Library, detailing every scheme fee scoped.',
        href: '/fee-library',
        imageSrc: '/images/logo.png',
        imageAlt: 'Fee library preview',
        badge: 'Custom',
    },
];

const dashboardRoutePrefixes = [DASHBOARD_HOME_PATH, ...availableDashboards.map((dashboard) => dashboard.href)];

const matchesRoute = (pathname: string, routePrefix: string) =>
    pathname === routePrefix || pathname.startsWith(`${routePrefix}/`);

export const isDashboardRoute = (pathname: string) =>
    dashboardRoutePrefixes.some((routePrefix) => matchesRoute(pathname, routePrefix));
