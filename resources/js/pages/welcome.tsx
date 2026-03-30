import BrandWordmark from '@/components/brand-wordmark';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

export default function Welcome() {
    const { auth, can_register } = usePage<SharedData>().props;

    return (
        <>
            <Head title="Welcome" />

            <div className="min-h-screen bg-stone-950 text-stone-100">
                <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
                    <header className="flex items-center justify-between border-b border-white/10 pb-6">
                        <div className="max-w-md">
                            <div className="inline-flex rounded-[1.5rem] border border-white/10 bg-white px-4 py-3 shadow-xl shadow-black/10">
                                <BrandWordmark className="h-14 w-auto" />
                            </div>
                            <p className="mt-4 text-xs uppercase tracking-[0.35em] text-amber-400">Sistem Operasional Rental Outdoor</p>
                        </div>

                        <nav className="flex items-center gap-3">
                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    className="rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-stone-950 transition hover:bg-amber-400"
                                >
                                    Buka Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={route('login')}
                                        className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/5"
                                    >
                                        Login
                                    </Link>
                                    {can_register && (
                                        <Link
                                            href={route('register')}
                                            className="rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-stone-950 transition hover:bg-amber-400"
                                        >
                                            Register
                                        </Link>
                                    )}
                                </>
                            )}
                        </nav>
                    </header>

                    <main className="grid flex-1 gap-8 py-10 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
                        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/80 p-8 shadow-2xl shadow-black/20 lg:p-10">
                            <div className="inline-flex rounded-[1.5rem] border border-white/10 bg-white px-4 py-3 shadow-lg shadow-black/10">
                                <BrandWordmark className="h-16 w-auto" />
                            </div>
                            <p className="mt-6 text-sm font-medium text-amber-300">Fondasi aplikasi sudah disiapkan</p>
                            <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-white lg:text-5xl">
                                Shell SPA untuk operasional penyewaan dan penjualan Roc Advanture.
                            </h2>
                            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">
                                Project ini sekarang sudah memakai Laravel 12, Inertia, React, dan struktur awal yang
                                siap kita lanjutkan ke auth, role, alur rental, penjualan, dan operasional toko
                                harian dalam satu dashboard.
                            </p>

                            <div className="mt-8 grid gap-4 md:grid-cols-3">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-sm text-stone-400">Backend</p>
                                    <p className="mt-2 text-lg font-semibold text-white">Laravel 12</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-sm text-stone-400">SPA Layer</p>
                                    <p className="mt-2 text-lg font-semibold text-white">Inertia + React</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-sm text-stone-400">Status</p>
                                    <p className="mt-2 text-lg font-semibold text-white">Ready for operations</p>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
                                <p className="text-sm font-medium text-amber-300">Sudah siap</p>
                                <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                                    <li>Halaman login, bootstrap register pertama, reset password, dan settings dasar.</li>
                                    <li>Dashboard placeholder untuk area internal setelah user login.</li>
                                    <li>Folder admin, services, policies, dan docs untuk fondasi pengembangan.</li>
                                </ul>
                            </div>

                            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
                                <p className="text-sm font-medium text-amber-300">Tahap berikutnya</p>
                                <p className="mt-4 text-sm leading-6 text-stone-300">
                                    Setelah kamu jelaskan alur bisnisnya, kita bisa sambung ke role permission,
                                    manajemen user, dan navigasi admin tanpa membuat isian stock opname dulu.
                                </p>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </>
    );
}
