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
                <section className="border-sidebar-border/70 dark:border-sidebar-border rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Project foundation</p>
                    <h1 className="mt-2 text-2xl font-semibold">Roc Advanture Stock Opname</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Dashboard ini masih berupa fondasi awal. Auth bawaan starter kit sudah aktif, dan struktur
                        proyek sudah disiapkan untuk role, user management, dan modul stock opname yang akan kita
                        definisikan setelah alur bisnisnya kamu jelaskan.
                    </p>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="border-sidebar-border/70 dark:border-sidebar-border rounded-2xl border p-5">
                        <p className="text-muted-foreground text-sm">Authentication</p>
                        <p className="mt-2 text-lg font-semibold">Ready</p>
                        <p className="text-muted-foreground mt-2 text-sm">Login, register, reset password, dan profile settings sudah tersedia.</p>
                    </div>

                    <div className="border-sidebar-border/70 dark:border-sidebar-border rounded-2xl border p-5">
                        <p className="text-muted-foreground text-sm">Role & Permission</p>
                        <p className="mt-2 text-lg font-semibold">Next Step</p>
                        <p className="text-muted-foreground mt-2 text-sm">Area admin dan struktur backend sudah siap untuk dipasang permission layer.</p>
                    </div>

                    <div className="border-sidebar-border/70 dark:border-sidebar-border rounded-2xl border p-5">
                        <p className="text-muted-foreground text-sm">Stock Opname Module</p>
                        <p className="mt-2 text-lg font-semibold">Not Started</p>
                        <p className="text-muted-foreground mt-2 text-sm">Belum dibuat supaya kita tetap menunggu konfirmasi detail alur dari kamu.</p>
                    </div>
                </section>

                <section className="border-sidebar-border/70 dark:border-sidebar-border rounded-2xl border p-6">
                    <p className="text-sm font-medium">Catatan fondasi</p>
                    <div className="text-muted-foreground mt-4 grid gap-3 text-sm leading-6 md:grid-cols-2">
                        <div className="rounded-xl bg-black/3 p-4 dark:bg-white/5">
                            Frontend menggunakan Inertia + React + TypeScript dari starter kit resmi Laravel.
                        </div>
                        <div className="rounded-xl bg-black/3 p-4 dark:bg-white/5">
                            Struktur folder admin, services, policies, dan docs sudah ditambahkan untuk tahap berikutnya.
                        </div>
                        <div className="rounded-xl bg-black/3 p-4 dark:bg-white/5">
                            Routing dipisah supaya nanti area admin dan area operasional bisa lebih mudah dibagi.
                        </div>
                        <div className="rounded-xl bg-black/3 p-4 dark:bg-white/5">
                            Database bisnis stock opname belum disentuh sama sekali pada tahap ini.
                        </div>
                    </div>
                </section>
            </div>
        </AppLayout>
    );
}
