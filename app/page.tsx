import { MainLayout } from '@/components/layout/MainLayout';
import { FeeManagerOverview } from '@/features/home/components/FeeManagerOverview';

export default function HomePage() {
    return (
        <MainLayout>
            <FeeManagerOverview />
        </MainLayout>
    );
}
