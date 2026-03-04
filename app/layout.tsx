import type { Metadata } from 'next';
import { Lato } from 'next/font/google';
import './globals.css';

const lato = Lato({
    subsets: ['latin'],
    weight: ['400', '700'],
    variable: '--font-lato',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Incontrol Demo',
    description: 'Incontrol internal dashboard',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${lato.variable} font-[var(--font-lato)] antialiased`}>{children}</body>
        </html>
    );
}
