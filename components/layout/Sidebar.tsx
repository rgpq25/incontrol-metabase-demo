'use client';

import {
    BarChart3,
    Book,
    BookOpen,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    FileText,
    LayoutDashboard,
    PiggyBank,
    Settings,
    ShieldCheck,
    Star,
    type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface MenuItem {
    icon: LucideIcon;
    label: string;
    href?: string;
    blocked?: boolean;
    children?: MenuItem[];
}

const menuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Fee Dashboard', href: '/' },
    { icon: FileText, label: 'Incontrol Panel', blocked: true },
    { icon: BookOpen, label: 'Fee Library', href: '/collections' },
    { icon: BarChart3, label: 'Analytics & Reports', blocked: true },
    {
        icon: PiggyBank,
        label: 'Saving Opportunities',
        children: [
            { icon: ShieldCheck, label: 'Data integrity', blocked: true },
            { icon: CheckCircle, label: 'Visa Mar', blocked: true },
            { icon: Settings, label: 'TPE', blocked: true },
            { icon: Settings, label: 'Opt Outs', blocked: true },
        ],
    },
    { icon: ShieldCheck, label: 'Fee Validation', blocked: true },
    { icon: Book, label: 'Resources', blocked: true },
    { icon: Star, label: 'Favorites', blocked: true },
];

export function Sidebar() {
    const pathname = usePathname();
    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    const toggleExpand = (item: MenuItem) => {
        if (!item.children || item.blocked) return;

        setExpandedItems((prev) =>
            prev.includes(item.label) ? prev.filter((entry) => entry !== item.label) : [...prev, item.label]
        );
    };

    const renderMenuItem = (item: MenuItem, level = 0) => {
        const hasChildren = Boolean(item.children?.length);
        const isExpanded = expandedItems.includes(item.label);
        const isBlocked = item.blocked;
        const isActive = item.href
            ? item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
            : false;
        const Icon = item.icon;
        const iconSize = level === 0 ? 16 : 14;

        const className = `
            group flex w-full items-center gap-2 rounded-lg py-2 text-left text-sm leading-5 transition-colors
            ${level === 0 ? 'px-3' : 'pl-8 pr-3'}
            ${
                isBlocked
                    ? 'cursor-not-allowed text-[var(--color-text-muted)] opacity-70'
                    : isActive
                      ? 'bg-[var(--color-brand-100)] text-[var(--color-brand-600)]'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]'
            }
        `;

        return (
            <div key={item.label}>
                {item.href && !isBlocked ? (
                    <Link href={item.href} className={className}>
                        <span className="shrink-0 text-[var(--color-brand-600)]">
                            <Icon size={iconSize} />
                        </span>

                        <span className="flex-1">{item.label}</span>

                        {hasChildren && (
                            <span className="mr-1 text-[var(--color-text-muted)]">
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                        )}
                    </Link>
                ) : (
                    <button
                        type="button"
                        onClick={() => toggleExpand(item)}
                        className={className}
                        disabled={isBlocked}
                    >
                        <span className="shrink-0 text-[var(--color-brand-600)]">
                            <Icon size={iconSize} />
                        </span>

                        <span className="flex-1">{item.label}</span>

                        {hasChildren && (
                            <span className="mr-1 text-[var(--color-text-muted)]">
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                        )}
                    </button>
                )}

                {hasChildren && isExpanded && (
                    <div className="mt-1 space-y-1">
                        {item.children?.map((child) => renderMenuItem(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside
            className="
              fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-[272px]
              px-4 py-4 md:block
            "
        >
            <div
                className="
                  panel-shadow flex h-full flex-col rounded-2xl border
                  border-[var(--color-border-soft)] bg-[var(--color-surface)] p-2
                "
            >
                <nav className="flex-1 space-y-1 overflow-y-auto px-1 py-1">
                    {menuItems.map((item) => renderMenuItem(item))}
                </nav>

                <div className="border-t border-[var(--color-border-soft)] px-3 py-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-primary)]">
                        Last update
                    </p>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex h-5 w-8 items-center justify-center rounded bg-[#1434cb]">
                                <span className="text-[10px] font-bold text-white">V</span>
                            </div>
                            <span className="text-xs text-[var(--color-text-primary)]">15 Jun 2025</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex h-5 w-8 items-center justify-center rounded bg-[#f79e1b]">
                                <span className="text-[10px] font-bold text-white">M</span>
                            </div>
                            <span className="text-xs text-[var(--color-text-primary)]">31 May 2025</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex h-5 w-8 items-center justify-center rounded bg-[#006fcf]">
                                <span className="text-[10px] font-bold text-white">A</span>
                            </div>
                            <span className="text-xs text-[var(--color-text-primary)]">28 May 2025</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
