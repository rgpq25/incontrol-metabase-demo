import { MainLayout } from '@/components/layout/MainLayout';
import { QuickSightConsoleEmbed } from '@/features/analytics/components/QuickSightConsoleEmbed';

export default function AnalyticsPage() {
    return (
        <MainLayout>
            <QuickSightConsoleEmbed />
        </MainLayout>
    );
}
