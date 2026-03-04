import { MainLayout } from '@/components/layout/MainLayout';
import { FeeManagerOverview } from '@/features/home/components/FeeManagerOverview';

export default function FeeDashboardPage() {
    return (
        <MainLayout>
            <FeeManagerOverview />
        </MainLayout>
    );
}
