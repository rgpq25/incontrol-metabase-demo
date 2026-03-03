import { QuickSightDashboardEmbed } from './QuickSightDashboardEmbed';

export function FeeManagerOverview() {
    return (
        <div className="space-y-6">
            {/* <section className="panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6">
                <h1 className="text-2xl font-bold text-[var(--color-brand-600)]">Fee Manager</h1>
            </section> */}

            <QuickSightDashboardEmbed />
        </div>
    );
}
