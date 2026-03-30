import BrandWordmark from '@/components/brand-wordmark';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

export default function Dashboard() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-[2rem] border border-black/5 bg-gradient-to-br from-stone-50 via-white to-amber-50/80 p-6 shadow-sm">
                    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                        <div>
                            <div className="inline-flex rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 shadow-sm">
                                <BrandWordmark className="h-16 w-auto" />
                            </div>
                            <p className="text-muted-foreground mt-5 text-sm">Dashboard operasional terpadu</p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">Kelola rental outdoor dan penjualan toko dalam satu tempat.</h1>
                            <p className="text-muted-foreground mt-4 max-w-3xl text-sm leading-6">
                                Area ini sekarang sudah siap dipakai untuk operasional harian Roc Advanture, mulai dari
                                penyewaan, pengembalian, proses cuci, produk jual, stok masuk, sampai laporan dasar.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl border border-black/5 bg-white/90 p-5">
                                <p className="text-muted-foreground text-sm">Rental</p>
                                <p className="mt-2 text-lg font-semibold">Siap Dipakai</p>
                                <p className="text-muted-foreground mt-2 text-sm">Penyewaan, pengembalian, proses cuci, invoice, dan reminder flow sudah terarah.</p>
                            </div>
                            <div className="rounded-2xl border border-black/5 bg-white/90 p-5">
                                <p className="text-muted-foreground text-sm">Penjualan</p>
                                <p className="mt-2 text-lg font-semibold">Siap Dipakai</p>
                                <p className="text-muted-foreground mt-2 text-sm">Produk jual, stok masuk, penjualan cepat, dan invoice penjualan sudah tersedia.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="border-sidebar-border/70 dark:border-sidebar-border rounded-2xl border p-5">
                        <p className="text-muted-foreground text-sm">Authentication</p>
                        <p className="mt-2 text-lg font-semibold">Ready</p>
                        <p className="text-muted-foreground mt-2 text-sm">Login, register bootstrap pertama, reset password, dan profile settings sudah tersedia.</p>
                    </div>

                    <div className="border-sidebar-border/70 dark:border-sidebar-border rounded-2xl border p-5">
                        <p className="text-muted-foreground text-sm">Role & Permission</p>
                        <p className="mt-2 text-lg font-semibold">Active</p>
                        <p className="text-muted-foreground mt-2 text-sm">Super-admin, admin toko, dan staff sudah punya alur akses dasar yang terpisah.</p>
                    </div>

                    <div className="border-sidebar-border/70 dark:border-sidebar-border rounded-2xl border p-5">
                        <p className="text-muted-foreground text-sm">Laporan</p>
                        <p className="mt-2 text-lg font-semibold">Growing</p>
                        <p className="text-muted-foreground mt-2 text-sm">Laporan operasional dasar sudah ada dan siap kita lanjutkan sesuai kebutuhan toko.</p>
                    </div>
                </section>

                <section className="border-sidebar-border/70 dark:border-sidebar-border rounded-2xl border p-6">
                    <p className="text-sm font-medium">Catatan Sistem</p>
                    <div className="text-muted-foreground mt-4 grid gap-3 text-sm leading-6 md:grid-cols-2">
                        <div className="rounded-xl bg-black/3 p-4 dark:bg-white/5">
                            Frontend memakai Inertia + React + TypeScript di atas Laravel 12 agar operasional tetap terasa cepat seperti SPA.
                        </div>
                        <div className="rounded-xl bg-black/3 p-4 dark:bg-white/5">
                            Sidebar sekarang sudah dipisah antara operasional rental, operasional penjualan, master rental, dan master penjualan.
                        </div>
                        <div className="rounded-xl bg-black/3 p-4 dark:bg-white/5">
                            Sistem rental dan penjualan tetap satu aplikasi, tapi model stoknya dibedakan supaya operasional tidak ribet.
                        </div>
                        <div className="rounded-xl bg-black/3 p-4 dark:bg-white/5">
                            Branding wordmark Roc Advanture sekarang sudah dipasang untuk dashboard, welcome, dan auth.
                        </div>
                    </div>
                </section>
            </div>
        </AppLayout>
    );
}
