import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

interface MainLayoutProps {
    children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
    return (
        <div className="min-h-screen bg-[var(--color-surface-muted)]">
            <Header />
            <Sidebar />
            <main className="min-h-screen px-4 pb-6 pt-24 md:pl-[296px] md:pr-6">{children}</main>
        </div>
    );
}
