'use client';

import { ArrowLeft, CircleAlert } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function MobileBlockedNotice() {
    const router = useRouter();

    return (
        <section className="flex min-h-screen items-center justify-center px-6 py-10">
            <div className="panel-shadow w-full max-w-sm rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-8 text-center">
                <Image
                    src="/images/logo.png"
                    alt="inControl logo"
                    width={146}
                    height={44}
                    priority
                    className="mx-auto h-auto w-[146px]"
                />

                <div className="mt-7 flex justify-center">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-100)] text-[var(--color-brand-600)]">
                        <CircleAlert className="h-7 w-7" />
                    </div>
                </div>

                <h1 className="mt-5 text-3xl font-bold text-[var(--color-brand-600)]">Oops!</h1>
                <p className="mt-3 text-sm leading-6 text-[var(--color-text-primary)]">
                    You can only enter this site from a computer
                </p>

                <button
                    type="button"
                    onClick={() => router.back()}
                    className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--color-brand-600)] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1f45af]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </button>
            </div>
        </section>
    );
}
