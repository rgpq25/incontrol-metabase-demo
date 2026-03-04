const collections = [
    {
        name: 'Card Processing Fees',
        owner: 'Operations',
        updatedAt: '2 hours ago',
        status: 'In Review',
    },
    {
        name: 'ACH Network Costs',
        owner: 'Finance',
        updatedAt: 'Yesterday',
        status: 'Approved',
    },
    {
        name: 'Merchant Service Adjustments',
        owner: 'Revenue Ops',
        updatedAt: '3 days ago',
        status: 'Draft',
    },
];

export function CollectionsOverview() {
    return (
        <div className="space-y-6">
            <section className="panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6">
                <h1 className="text-2xl font-bold text-[var(--color-brand-600)]">Fee Library</h1>
                <p className="mt-2 text-sm text-[var(--color-text-primary)]">
                    Route-based collections view that keeps the shared app shell and navigation.
                </p>
            </section>

            <section className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
                <div className="border-b border-[var(--color-border-soft)] px-6 py-4">
                    <h2 className="text-lg font-bold text-[var(--color-brand-600)]">Saved Collections</h2>
                </div>

                <div className="divide-y divide-[var(--color-border-soft)]">
                    {collections.map((collection) => (
                        <article key={collection.name} className="px-6 py-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="font-bold text-[var(--color-text-primary)]">{collection.name}</h3>
                                    <p className="text-sm text-[var(--color-text-primary)]">Owner: {collection.owner}</p>
                                </div>
                                <div className="text-sm text-[var(--color-text-primary)]">
                                    <p
                                        className={
                                            collection.status === 'Approved'
                                                ? 'text-green-700'
                                                : collection.status === 'In Review'
                                                  ? 'text-[var(--color-brand-600)]'
                                                  : 'text-[var(--color-text-muted)]'
                                        }
                                    >
                                        Status: {collection.status}
                                    </p>
                                    <p>Updated: {collection.updatedAt}</p>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}
