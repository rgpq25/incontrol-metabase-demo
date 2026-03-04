import { MainLayout } from '@/components/layout/MainLayout';
import { CollectionsOverview } from '@/features/collections/components/CollectionsOverview';

export default function CollectionsPage() {
    return (
        <MainLayout>
            <CollectionsOverview />
        </MainLayout>
    );
}
