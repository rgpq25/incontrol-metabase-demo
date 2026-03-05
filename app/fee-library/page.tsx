import { MainLayout } from '@/components/layout/MainLayout';
import { QuickSightDashboardEmbed } from '@/features/home/components/QuickSightDashboardEmbed';

const FEE_LIBRARY_DASHBOARD_ID = '5a53241b-0a3f-4b6a-a3c8-d0afc2e4e2cf';

export default function FeeLibraryPage() {
    return (
        <MainLayout>
            <QuickSightDashboardEmbed dashboardId={FEE_LIBRARY_DASHBOARD_ID} />
        </MainLayout>
    );
}
