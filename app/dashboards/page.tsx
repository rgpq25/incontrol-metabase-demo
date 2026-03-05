import { MainLayout } from '@/components/layout/MainLayout';
import { DashboardsOverview } from '@/features/dashboards/components/DashboardsOverview';

export default function DashboardsPage() {
    return (
        <MainLayout>
            <DashboardsOverview />
        </MainLayout>
    );
}
