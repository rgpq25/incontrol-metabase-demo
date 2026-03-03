'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, Eye, EyeOff, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showErrorDialog, setShowErrorDialog] = useState(false);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
            });

            if (!response.ok) {
                try {
                    const jsonData = await response.json();
                    setError(jsonData.error || 'Invalid credentials');
                } catch {
                    const text = await response.text();
                    setError(text || 'Invalid credentials');
                }
                setShowErrorDialog(true);
                return;
            }

            router.push('/');
            router.refresh();
        } catch (err) {
            setError('Server error. Please try again later.');
            setShowErrorDialog(true);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <div className="mx-auto w-full max-w-[420px]">
                <div className="mb-28">
                    <Image
                        src="/images/logo.png"
                        alt="inControl logo"
                        width={153}
                        height={46}
                        priority
                        className="h-auto w-[153px]"
                    />
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-2 text-center">
                        <h2 className="text-[40px] font-bold leading-[1.1] text-[var(--color-text-strong)]">
                            Log In
                        </h2>
                        <p className="text-base leading-7 text-[var(--color-text-primary)]">
                            Good to see you again - sign in to your account to continue.
                        </p>
                    </div>

                    <div className="mt-10 space-y-4">
                        <label htmlFor="email" className="sr-only">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            autoComplete="email"
                            placeholder="Email"
                            className="h-11 w-full rounded-lg border border-[var(--color-brand-300)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-100)]"
                        />

                        <label htmlFor="password" className="sr-only">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                autoComplete="current-password"
                                placeholder="Enter a password"
                                className="h-11 w-full rounded-lg border border-[var(--color-brand-300)] bg-[var(--color-surface)] px-4 pr-10 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-100)]"
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword((previous) => !previous)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-brand-600)]"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>

                        <button
                            type="button"
                            className="mx-auto block text-sm text-[var(--color-brand-600)] underline underline-offset-4"
                        >
                            Can&apos;t remember your password?
                        </button>
                    </div>

                    <button
                        type="submit"
                        className="mt-6 h-11 w-full rounded-lg bg-[var(--color-brand-600)] text-sm font-bold text-white transition-colors hover:bg-[#1f45af] disabled:cursor-not-allowed disabled:bg-[#9CA3BA]"
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-8 border-t border-[var(--color-border-soft)] pt-8 text-center">
                    <h3 className="text-3xl font-bold text-[var(--color-text-strong)]">First time?</h3>
                    <p className="mt-2 text-base text-[var(--color-text-primary)]">
                        Let&apos;s get you started - create your account.
                    </p>
                    <button
                        type="button"
                        className="mt-5 h-10 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-6 text-sm font-bold text-[var(--color-text-primary)]"
                    >
                        Sign Up
                    </button>
                </div>
            </div>

            <Dialog.Root open={showErrorDialog} onOpenChange={setShowErrorDialog}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/45 backdrop-blur-[1px]" />
                    <Dialog.Content className="panel-shadow fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-0">
                        <div className="flex items-center justify-between border-b border-[#F7CACA] bg-[#FDF2F2] px-7 py-5">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full bg-[#FCE8E8] p-2.5">
                                    <AlertCircle className="h-5 w-5 text-[#C61010]" />
                                </div>
                                <Dialog.Title className="text-base font-bold text-[var(--color-text-strong)]">
                                    Authentication error
                                </Dialog.Title>
                            </div>

                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    className="rounded-md p-1 text-[var(--color-text-muted)] transition-colors hover:bg-white hover:text-[var(--color-text-primary)]"
                                    aria-label="Close dialog"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </Dialog.Close>
                        </div>

                        <div className="px-7 py-5">
                            <Dialog.Description className="text-sm font-bold text-[var(--color-text-primary)]">
                                {error || 'An error occurred during sign in.'}
                            </Dialog.Description>
                            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
                                Please verify your email and password and try again.
                            </p>
                        </div>

                        <div className="border-t border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-7 py-4">
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    className="h-10 w-full rounded-lg bg-[var(--color-brand-600)] text-sm font-bold text-white transition-colors hover:bg-[#1f45af]"
                                >
                                    OK
                                </button>
                            </Dialog.Close>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}
