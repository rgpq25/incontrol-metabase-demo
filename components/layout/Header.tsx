'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { Bell, Search, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type SessionState = {
    authenticated: boolean;
    user?: { id: number; email: string; firstName: string; lastName: string };
};

const shellButtonClass =
    'inline-flex h-8 min-w-24 items-center justify-center rounded-lg border px-3 text-sm font-normal transition-colors';

export function Header() {
    const router = useRouter();
    const pathname = usePathname();
    const [searchValue, setSearchValue] = useState('');
    const [activeTab, setActiveTab] = useState<'Products' | 'Alerts'>('Products');
    const [session, setSession] = useState<SessionState | null>(null);

    useEffect(() => {
        let mounted = true;

        async function check() {
            try {
                const res = await fetch('/api/auth/status', { credentials: 'include' });
                if (!mounted) return;

                if (res.ok) {
                    const data = await res.json();
                    setSession(data);
                } else {
                    setSession({ authenticated: false });
                }
            } catch (err) {
                console.error('Error fetching auth status', err);
                setSession({ authenticated: false });
            }
        }

        check();
        return () => {
            mounted = false;
        };
    }, []);

    async function handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            setSession({ authenticated: false });
            router.refresh();
            router.push('/login');
        } catch (err) {
            console.error('Logout failed', err);
        }
    }

    const userInitials = session?.user
        ? `${session.user.firstName?.[0] ?? ''}${session.user.lastName?.[0] ?? ''}`.toUpperCase()
        : '';
    const isCollectionsRoute = pathname.startsWith('/collections') || pathname.startsWith('/fee-library');

    return (
        <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]">
            <div className="flex h-16 items-center gap-4 px-4 md:px-6">
                <div className="flex items-center gap-4 md:gap-6">
                    <button
                        type="button"
                        className="flex items-center"
                        onClick={() => router.push('/')}
                        aria-label="Go to home"
                    >
                        <Image
                            src="/images/logo.png"
                            alt="inControl logo"
                            width={118}
                            height={36}
                            priority
                            className="h-9 w-auto"
                        />
                    </button>

                    <nav className="hidden items-center gap-2 lg:flex">
                        {(['Products', 'Alerts'] as const).map((tab) => {
                            const isActive = activeTab === tab;
                            return (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`${shellButtonClass} ${
                                        isActive
                                            ? 'border-[var(--color-brand-600)] bg-[var(--color-surface)] text-[var(--color-brand-600)]'
                                            : 'border-transparent bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:border-[var(--color-border-soft)] hover:bg-[var(--color-surface)]'
                                    }`}
                                >
                                    {tab}
                                </button>
                            );
                        })}

                        <Link
                            href="/collections"
                            className={`${shellButtonClass} ${
                                isCollectionsRoute
                                    ? 'border-[var(--color-brand-600)] bg-[var(--color-surface)] text-[var(--color-brand-600)]'
                                    : 'border-transparent bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:border-[var(--color-border-soft)] hover:bg-[var(--color-surface)]'
                            }`}
                        >
                            Collections
                        </Link>
                    </nav>
                </div>

                <div className="flex flex-1 justify-center">
                    <label className="relative w-full max-w-[560px]">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-brand-600)]"
                            aria-hidden
                        />
                        <input
                            type="text"
                            placeholder="Search Fees Reports & Dashboards"
                            value={searchValue}
                            onChange={(event) => setSearchValue(event.target.value)}
                            className="h-8 w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] py-1 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-300)] focus:outline-none"
                        />
                    </label>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <button
                        type="button"
                        className="hidden h-8 items-center rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 text-xs text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-muted)] md:inline-flex"
                    >
                        File Sharing
                    </button>

                    <button
                        type="button"
                        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-muted)]"
                        aria-label="Notifications"
                    >
                        <Bell className="h-4 w-4" />
                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--color-notification)]" />
                    </button>

                    {session?.authenticated ? (
                        <>
                            <Tooltip.Provider>
                                <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                        <button
                                            type="button"
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface)] text-xs font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]"
                                            aria-label="User profile"
                                        >
                                            {userInitials || <User className="h-4 w-4" />}
                                        </button>
                                    </Tooltip.Trigger>

                                    <Tooltip.Content
                                        side="bottom"
                                        className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-primary)] panel-shadow"
                                    >
                                        {session.user?.firstName ?? session.user?.email}
                                        <Tooltip.Arrow className="fill-[var(--color-surface)]" />
                                    </Tooltip.Content>
                                </Tooltip.Root>
                            </Tooltip.Provider>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="hidden h-8 items-center rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 text-xs text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-muted)] md:inline-flex"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <Link
                            href="/login"
                            className="inline-flex h-8 items-center rounded-lg border border-[var(--color-brand-600)] bg-[var(--color-brand-100)] px-3 text-xs text-[var(--color-brand-600)] transition-colors hover:bg-[var(--color-surface)]"
                        >
                            Login
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
