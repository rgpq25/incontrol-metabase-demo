import Image from 'next/image';
import Link from 'next/link';

const collections = [
    {
        name: 'Scheme Billing and Operational Performance Overview',
        description: 'Control your scheme fee billing by being ahead, watch how your money is being spent.',
        href: '/fee-dashboard',
        imageSrc: '/images/logo.png',
        imageAlt: 'Fee dashboard preview',
        badge: 'Current',
    },
    {
        name: 'Scheme Fees Library',
        description: 'Open the full Fee Library, detailing every scheme fee scoped.',
        href: '/fee-library',
        imageSrc: '/images/logo.png',
        imageAlt: 'Fee library preview',
        badge: 'New',
    },
];

export function CollectionsOverview() {
    return (
        <div className="space-y-6">
            <section className="panel-shadow rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6">
                <h1 className="text-2xl font-bold text-[var(--color-brand-600)]">Collections</h1>
                <p className="mt-2 text-sm text-[var(--color-text-primary)]">
                    {/* Choose a collection destination. */}
                </p>
            </section>

            <section className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
                {collections.map((collection) => (
                    <Link
                        key={collection.name}
                        href={collection.href}
                        className="panel-shadow mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-brand-300)]"
                    >
                        <div className="relative h-40 bg-gradient-to-br from-[var(--color-brand-100)] to-[#dce7ff]">
                            <Image
                                src={collection.imageSrc}
                                alt={collection.imageAlt}
                                fill
                                sizes="(max-width: 768px) 100vw, 360px"
                                className="object-contain p-8 opacity-75"
                            />
                            <span className="absolute left-3 top-3 rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-xs font-bold text-[var(--color-brand-600)]">
                                {collection.badge}
                            </span>
                        </div>

                        <div className="p-5">
                            <h2 className="text-base font-bold leading-tight text-[var(--color-brand-600)]">
                                {collection.name}
                            </h2>
                            <p className="mt-2 text-sm text-[var(--color-text-primary)]">{collection.description}</p>
                        </div>
                    </Link>
                ))}
            </section>
        </div>
    );
}
