import LoginForm from '../../features/auth/components/LoginForm';
import MobileBlockedNotice from '../../features/auth/components/MobileBlockedNotice';

export const metadata = {
    title: 'Login - inControl',
};

export default function LoginPage() {
    return (
        <main className="min-h-screen bg-[var(--color-surface-muted)]">
            <div className="lg:hidden">
                <MobileBlockedNotice />
            </div>

            <div className="hidden min-h-screen lg:grid lg:grid-cols-[46%_54%]">
                <section className="flex items-center justify-center px-10 py-12 xl:px-16">
                    <div className="w-full max-w-[520px]">
                        <LoginForm />
                    </div>
                </section>

                <section className="relative overflow-hidden bg-[#1E397E]">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        className="absolute inset-0 h-full w-full object-cover"
                    >
                        <source src="/videos/login-hero.mp4" type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-[#1E397E]/45" />
                </section>
            </div>
        </main>
    );
}
