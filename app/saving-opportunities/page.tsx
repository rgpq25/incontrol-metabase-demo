import { MainLayout } from '@/components/layout/MainLayout';

export default function SavingOpportunitiesPage() {
    return (
        <MainLayout>
            <section className="panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6">
                <h1 className="text-2xl font-bold text-[var(--color-brand-600)]">Saving Opportunities</h1>
                <p className="mt-2 text-sm text-[var(--color-text-primary)]">
                    Explore opportunities and controls for cost optimization.
                </p>
            </section>
        </MainLayout>
    );
}
