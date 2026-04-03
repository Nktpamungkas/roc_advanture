import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Ban, LoaderCircle } from 'lucide-react';

interface CancelRentalPageProps {
    rental: {
        id: number;
        rental_no: string;
        starts_at: string | null;
        due_at: string | null;
        subtotal: string;
        paid_amount: string;
        remaining_amount: string;
        rental_status_label: string;
        customer: { name: string | null; phone_whatsapp: string | null };
        items: Array<{ id: number; product_name_snapshot: string; inventory_unit_code: string | null }>;
    };
}

const currencyFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export default function CancelRentalPage({ rental }: CancelRentalPageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Penyewaan', href: '/admin/rentals' },
        { title: rental.rental_no, href: route('admin.rentals.show', rental.id) },
        { title: 'Batalkan Transaksi', href: route('admin.rentals.cancel.edit', rental.id) },
    ];
    const form = useForm({ cancel_reason: '' });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Batalkan ${rental.rental_no}`} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-muted-foreground text-sm">Pembatalan transaksi aktif</p>
                            <h1 className="mt-2 text-2xl font-semibold">Batalkan Transaksi Rental</h1>
                            <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">Saat transaksi dibatalkan, stok unit akan dikembalikan ke status sebelum disewa dan reminder WA yang masih pending akan dibersihkan.</p>
                        </div>
                        <Button asChild variant="outline"><Link href={route('admin.rentals.show', rental.id)}><ArrowLeft className="h-4 w-4" />Kembali ke Invoice</Link></Button>
                    </div>
                </section>

                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Pastikan pembatalan ini memang final</AlertTitle>
                    <AlertDescription>Sistem tidak menghapus riwayat pembayaran. Fitur ini fokus untuk menghentikan transaksi rental dan mengembalikan ketersediaan unit ke stok.</AlertDescription>
                </Alert>

                <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                    <div className="rounded-2xl border p-6">
                        <h2 className="text-lg font-semibold">Ringkasan Transaksi</h2>
                        <div className="mt-4 grid gap-3 text-sm">
                            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">No. Rental</span><span className="font-medium">{rental.rental_no}</span></div>
                            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Customer</span><span>{rental.customer.name ?? '-'}</span></div>
                            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">No. WhatsApp</span><span>{rental.customer.phone_whatsapp ?? '-'}</span></div>
                            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Mulai Sewa</span><span>{rental.starts_at ? dateTimeFormatter.format(new Date(rental.starts_at)) : '-'}</span></div>
                            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Harus Kembali</span><span>{rental.due_at ? dateTimeFormatter.format(new Date(rental.due_at)) : '-'}</span></div>
                            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Status Rental</span><span>{rental.rental_status_label}</span></div>
                            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Total</span><span>{currencyFormatter.format(Number(rental.subtotal || 0))}</span></div>
                            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Sudah Dibayar</span><span>{currencyFormatter.format(Number(rental.paid_amount || 0))}</span></div>
                            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Sisa</span><span>{currencyFormatter.format(Number(rental.remaining_amount || 0))}</span></div>
                        </div>

                        <div className="mt-6 rounded-xl border p-4">
                            <p className="text-sm font-medium">Unit yang akan dibebaskan kembali</p>
                            <div className="mt-3 grid gap-2 text-sm">
                                {rental.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"><span>{item.product_name_snapshot}</span><span className="text-muted-foreground">{item.inventory_unit_code ?? '-'}</span></div>)}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border p-6">
                        <div className="grid gap-2">
                            <Label htmlFor="cancel-reason">Alasan pembatalan</Label>
                            <Textarea id="cancel-reason" rows={8} value={form.data.cancel_reason} onChange={(event) => form.setData('cancel_reason', event.target.value)} placeholder="Contoh: customer batal berangkat, transaksi duplikat, salah input unit, dll." />
                            <InputError message={form.errors.cancel_reason} />
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button type="button" variant="destructive" onClick={() => form.put(route('admin.rentals.cancel.update', rental.id))} disabled={form.processing || form.data.cancel_reason.trim() === ''}>
                                {form.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                                Batalkan Transaksi
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
