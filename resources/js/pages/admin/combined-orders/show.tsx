import AppLogoIcon from '@/components/app-logo-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Printer } from 'lucide-react';

interface CombinedOrderReceipt {
    id: number;
    combined_no: string;
    ordered_at: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    subtotal: string;
    discount_amount: string;
    rental_total: string;
    sale_total: string;
    paid_amount: string;
    remaining_amount: string;
    payment_status_label: string;
    notes: string | null;
    payment_method: {
        name: string | null;
        type: string | null;
        type_label: string;
        qr_image_path: string | null;
        bank_name: string | null;
        account_number: string | null;
        account_name: string | null;
        instructions: string | null;
    };
    creator: {
        name: string | null;
    };
    rental: {
        rental_no: string;
        starts_at: string | null;
        due_at: string | null;
        total_days: number;
        guarantee_note: string | null;
        customer_address: string | null;
        paid_amount: string;
        remaining_amount: string;
        payment_status_label: string;
        items: Array<{
            id: number;
            product_name_snapshot: string;
            inventory_unit_code: string | null;
            daily_rate_snapshot: string;
            days: number;
            line_total: string;
            status_at_checkout_label: string;
        }>;
        payments: Array<{
            id: number;
            amount: string;
            paid_at: string | null;
            method_label: string;
            receiver_name: string | null;
            notes: string | null;
        }>;
    } | null;
    sale: {
        sale_no: string;
        sold_at: string | null;
        total_amount: string;
        items: Array<{
            id: number;
            product_name_snapshot: string;
            sku_snapshot: string | null;
            selling_price_snapshot: string;
            qty: number;
            line_total: string;
        }>;
    } | null;
}

const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
});

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
});

export default function CombinedOrderShow({ combinedOrder }: { combinedOrder: CombinedOrderReceipt }) {
    const { flash } = usePage<SharedData>().props;

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDate = (value: string | null) => (value ? dateFormatter.format(new Date(value)) : '-');
    const formatTime = (value: string | null) => (value ? timeFormatter.format(new Date(value)) : '-');
    const formatDateTime = (value: string | null) => (value ? `${formatDate(value)} ${formatTime(value)}` : '-');

    const customerRows = [
        { label: 'Nama', value: combinedOrder.customer_name },
        { label: 'No. Tlp', value: combinedOrder.customer_phone },
        { label: 'Alamat', value: combinedOrder.rental?.customer_address ?? null },
        { label: 'Jaminan', value: combinedOrder.rental?.guarantee_note ?? null },
    ].filter((row): row is { label: string; value: string } => Boolean(row.value && row.value.trim()));

    const paymentHistory = combinedOrder.rental?.payments ?? [];
    const hasNotesSection = Boolean(combinedOrder.notes && combinedOrder.notes.trim());

    return (
        <>
            <Head title={`Invoice Gabungan ${combinedOrder.combined_no}`} />

            <div className="bg-neutral-100 px-4 py-6">
                <div className="mx-auto flex max-w-5xl flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <Button asChild variant="outline">
                            <Link href={route('admin.combined-orders.index')}>
                                <ArrowLeft className="h-4 w-4" />
                                Kembali ke Transaksi Gabungan
                            </Link>
                        </Button>

                        <Button type="button" onClick={() => window.print()}>
                            <Printer className="h-4 w-4" />
                            Print Invoice Gabungan
                        </Button>
                    </div>

                    {flash.success && (
                        <Alert className="print:hidden">
                            <AlertTitle>Berhasil</AlertTitle>
                            <AlertDescription>{flash.success}</AlertDescription>
                        </Alert>
                    )}

                    <div className="overflow-hidden border border-neutral-300 bg-white shadow-sm print:shadow-none">
                        <div className="flex items-center justify-between gap-3 border-b border-neutral-300 bg-neutral-950 px-7 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white">Invoice Gabungan Roc Advanture</p>
                            <div className="bg-white px-3 py-0.5 text-xl font-semibold leading-none text-neutral-950">Transaksi Gabungan</div>
                        </div>

                        <div className="border-b border-neutral-300 px-7 py-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="flex items-start gap-3">
                                    <AppLogoIcon className="h-12 w-12 rounded-full border border-neutral-200" />
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-neutral-500">Roc Advanture</p>
                                        <div className="max-w-2xl space-y-0.5 text-[10px] leading-5 text-neutral-500">
                                            <p>Alamat: Jl. Raya Serang Km 16,8. Kp. Desa Talaga Rt 006/002, Cikupa, Tangerang, Kabupaten Tangerang, Banten 15710</p>
                                            <p>Telepon: 0887-1711-042</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-1.5 text-[11px] text-neutral-700 md:min-w-80">
                                    <div className="grid grid-cols-[7rem_1fr] gap-3">
                                        <span className="text-neutral-500">Invoice No.</span>
                                        <span className="font-medium text-neutral-950">{combinedOrder.combined_no}</span>
                                    </div>
                                    <div className="grid grid-cols-[7rem_1fr] gap-3">
                                        <span className="text-neutral-500">Tanggal</span>
                                        <span>{formatDateTime(combinedOrder.ordered_at)}</span>
                                    </div>
                                    <div className="grid grid-cols-[7rem_1fr] gap-3">
                                        <span className="text-neutral-500">Status Bayar</span>
                                        <span>{combinedOrder.payment_status_label}</span>
                                    </div>
                                    <div className="grid grid-cols-[7rem_1fr] gap-3">
                                        <span className="text-neutral-500">Admin</span>
                                        <span>{combinedOrder.creator.name ?? '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 px-7 py-4 md:grid-cols-[0.95fr_1.05fr]">
                            <section className="rounded-xl border border-neutral-300 p-4">
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Customer</p>
                                <div className="mt-3 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-[11px] text-neutral-800">
                                    {customerRows.map((row) => (
                                        <div key={row.label} className="contents">
                                            <span className="text-neutral-500">{row.label}</span>
                                            <span>{row.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-xl border border-neutral-300 p-4">
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Jadwal Sewa & Pembayaran</p>
                                <div className="mt-3 grid grid-cols-[7rem_1fr_7rem_1fr] gap-x-3 gap-y-1.5 text-[11px] text-neutral-800">
                                    <span className="text-neutral-500">Mulai Sewa</span>
                                    <span>{formatDate(combinedOrder.rental?.starts_at ?? null)}</span>
                                    <span className="text-neutral-500">Jam Sewa</span>
                                    <span>{formatTime(combinedOrder.rental?.starts_at ?? null)}</span>
                                    <span className="text-neutral-500">Harus Kembali</span>
                                    <span>{formatDate(combinedOrder.rental?.due_at ?? null)}</span>
                                    <span className="text-neutral-500">Jam Kembali</span>
                                    <span>{formatTime(combinedOrder.rental?.due_at ?? null)}</span>
                                    <span className="text-neutral-500">Durasi</span>
                                    <span>{combinedOrder.rental?.total_days ?? 0} hari</span>
                                    <span className="text-neutral-500">Metode</span>
                                    <span>{combinedOrder.payment_method.name ?? '-'}</span>
                                </div>
                            </section>
                        </div>

                        {combinedOrder.rental && combinedOrder.rental.items.length > 0 && (
                            <div className="px-7 pb-3">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold text-neutral-900">Item Sewa</h2>
                                    <span className="text-xs text-neutral-500">{combinedOrder.rental.rental_no}</span>
                                </div>
                                <div className="overflow-hidden rounded-xl border border-neutral-300">
                                    <table className="min-w-full border-collapse text-[11px]">
                                        <thead>
                                            <tr className="bg-neutral-100 text-left text-neutral-700">
                                                <th className="px-4 py-2.5 font-medium">Deskripsi</th>
                                                <th className="px-4 py-2.5 font-medium">Nomor Unit</th>
                                                <th className="px-4 py-2.5 font-medium">Durasi</th>
                                                <th className="px-4 py-2.5 font-medium">Tarif</th>
                                                <th className="px-4 py-2.5 text-right font-medium">Jumlah</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {combinedOrder.rental.items.map((item) => (
                                                <tr key={item.id}>
                                                    <td className="border-t border-neutral-300 px-4 py-2.5 text-neutral-900">
                                                        <div className="font-medium">{item.product_name_snapshot}</div>
                                                        <div className="mt-0.5 text-[10px] text-neutral-500">{item.status_at_checkout_label}</div>
                                                    </td>
                                                    <td className="border-t border-neutral-300 px-4 py-2.5 text-neutral-700">{item.inventory_unit_code ?? '-'}</td>
                                                    <td className="border-t border-neutral-300 px-4 py-2.5 text-neutral-700">{item.days} hari</td>
                                                    <td className="border-t border-neutral-300 px-4 py-2.5 text-neutral-700">{formatCurrency(item.daily_rate_snapshot)}</td>
                                                    <td className="border-t border-neutral-300 px-4 py-2.5 text-right text-neutral-900">{formatCurrency(item.line_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {combinedOrder.sale && combinedOrder.sale.items.length > 0 && (
                            <div className="px-7 pb-3">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold text-neutral-900">Item Jual</h2>
                                    <span className="text-xs text-neutral-500">{combinedOrder.sale.sale_no}</span>
                                </div>
                                <div className="overflow-hidden rounded-xl border border-neutral-300">
                                    <table className="min-w-full border-collapse text-[11px]">
                                        <thead>
                                            <tr className="bg-neutral-100 text-left text-neutral-700">
                                                <th className="px-4 py-2.5 font-medium">Deskripsi</th>
                                                <th className="px-4 py-2.5 font-medium">SKU</th>
                                                <th className="px-4 py-2.5 font-medium">Qty</th>
                                                <th className="px-4 py-2.5 font-medium">Harga</th>
                                                <th className="px-4 py-2.5 text-right font-medium">Jumlah</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {combinedOrder.sale.items.map((item) => (
                                                <tr key={item.id}>
                                                    <td className="border-t border-neutral-300 px-4 py-2.5 text-neutral-900">{item.product_name_snapshot}</td>
                                                    <td className="border-t border-neutral-300 px-4 py-2.5 text-neutral-700">{item.sku_snapshot ?? '-'}</td>
                                                    <td className="border-t border-neutral-300 px-4 py-2.5 text-neutral-700">{item.qty}</td>
                                                    <td className="border-t border-neutral-300 px-4 py-2.5 text-neutral-700">{formatCurrency(item.selling_price_snapshot)}</td>
                                                    <td className="border-t border-neutral-300 px-4 py-2.5 text-right text-neutral-900">{formatCurrency(item.line_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-3 border-t border-neutral-300 px-7 py-3 lg:grid-cols-[1.2fr_19rem]">
                            <div className="grid gap-3">
                                {paymentHistory.length > 0 && (
                                    <section className="rounded-md border border-neutral-300 p-3">
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Riwayat Pembayaran Sewa</p>
                                        <div className="mt-2 space-y-1.5 text-[11px] text-neutral-800">
                                            {paymentHistory.map((payment) => (
                                                <div key={payment.id} className="rounded border border-neutral-200 px-2.5 py-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="font-medium text-neutral-950">{formatCurrency(payment.amount)}</span>
                                                    </div>
                                                    <p className="mt-0.5 text-[10px] text-neutral-600">
                                                        {formatDate(payment.paid_at)} {formatTime(payment.paid_at)} | {payment.method_label} | {payment.receiver_name ?? '-'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {combinedOrder.payment_method.name && (
                                    <section className="rounded-md border border-neutral-300 p-3">
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Metode Pembayaran</p>
                                        <div className="mt-2 space-y-2 text-[11px] text-neutral-700">
                                            <p className="font-medium text-neutral-950">{combinedOrder.payment_method.name}</p>
                                            <p className="text-neutral-500">{combinedOrder.payment_method.type_label}</p>
                                            {combinedOrder.payment_method.type === 'transfer' && (
                                                <div className="rounded border border-neutral-200 px-2.5 py-2">
                                                    <p>{combinedOrder.payment_method.bank_name}</p>
                                                    <p className="font-medium">{combinedOrder.payment_method.account_number}</p>
                                                    <p>{combinedOrder.payment_method.account_name}</p>
                                                </div>
                                            )}
                                            {combinedOrder.payment_method.type === 'qris' && combinedOrder.payment_method.qr_image_path && (
                                                <div className="rounded border border-neutral-200 p-2">
                                                    <img src={combinedOrder.payment_method.qr_image_path} alt={combinedOrder.payment_method.name} className="h-36 w-36 object-contain" />
                                                </div>
                                            )}
                                            {combinedOrder.payment_method.instructions && <p>{combinedOrder.payment_method.instructions}</p>}
                                        </div>
                                    </section>
                                )}

                                {hasNotesSection && (
                                    <section className="rounded-md border border-neutral-300 p-3">
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Catatan</p>
                                        <p className="mt-2 text-[11px] leading-5 text-neutral-700">{combinedOrder.notes}</p>
                                    </section>
                                )}
                            </div>

                            <section className="rounded-xl border border-neutral-300">
                                <div className="border-b border-neutral-300 px-5 py-2.5">
                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Ringkasan Gabungan</p>
                                </div>
                                <div className="space-y-2.5 px-5 py-4 text-[11px] text-neutral-800">
                                    <div className="flex items-center justify-between gap-4">
                                        <span>Total Sewa</span>
                                        <span>{formatCurrency(combinedOrder.rental_total)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span>Total Jual</span>
                                        <span>{formatCurrency(combinedOrder.sale_total)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span>Dibayar</span>
                                        <span>{formatCurrency(combinedOrder.paid_amount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-3 text-base font-semibold text-neutral-950">
                                        <span>Sisa</span>
                                        <span>{formatCurrency(combinedOrder.remaining_amount)}</span>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="grid gap-7 border-t border-neutral-300 px-7 py-4 text-center text-[11px] md:grid-cols-2">
                            <div>
                                <p className="text-neutral-600">Customer Signature</p>
                                <div className="mt-10 border-t border-neutral-400 pt-2">{combinedOrder.customer_name ?? '(........................)'}</div>
                            </div>

                            <div>
                                <p className="text-neutral-600">Authorized By</p>
                                <div className="mt-10 border-t border-neutral-400 pt-2">{combinedOrder.creator.name ?? '(........................)'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
