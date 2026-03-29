import AppLogoIcon from '@/components/app-logo-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Printer } from 'lucide-react';

interface SaleReceipt {
    id: number;
    sale_no: string;
    sold_at: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    subtotal: string;
    discount_amount: string;
    total_amount: string;
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
    sold_by: {
        name: string | null;
    };
    items: Array<{
        id: number;
        product_name_snapshot: string;
        sku_snapshot: string | null;
        selling_price_snapshot: string;
        qty: number;
        line_total: string;
    }>;
}

const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function SaleReceiptPage({ sale }: { sale: SaleReceipt }) {
    const { flash } = usePage<SharedData>().props;

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const issuedAt = sale.sold_at ? dateFormatter.format(new Date(sale.sold_at)) : '-';
    const customerName = sale.customer_name?.trim() ? sale.customer_name : 'Penjualan Umum';
    const customerRows = [
        { label: 'Nama', value: customerName },
        { label: 'No. Tlp', value: sale.customer_phone },
    ].filter((row): row is { label: string; value: string } => Boolean(row.value && row.value.trim()));
    const hasNotesSection = Boolean(sale.notes && sale.notes.trim());

    return (
        <>
            <Head title={`Invoice Penjualan ${sale.sale_no}`} />

            <div className="bg-neutral-100 px-4 py-6">
                <div className="mx-auto flex max-w-4xl flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <Button asChild variant="outline">
                            <Link href={route('admin.sales.index')}>
                                <ArrowLeft className="h-4 w-4" />
                                Kembali ke Penjualan
                            </Link>
                        </Button>

                        <Button type="button" onClick={() => window.print()}>
                            <Printer className="h-4 w-4" />
                            Print Invoice
                        </Button>
                    </div>

                    {flash.success && (
                        <Alert className="print:hidden">
                            <AlertTitle>Penjualan berhasil dibuat</AlertTitle>
                            <AlertDescription>{flash.success}</AlertDescription>
                        </Alert>
                    )}

                    <div className="overflow-hidden border border-neutral-300 bg-white shadow-sm print:shadow-none">
                        <div className="flex items-center justify-between gap-3 border-b border-neutral-300 bg-neutral-950 px-7 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white">Invoice Penjualan Roc Advanture</p>
                            <div className="bg-white px-3 py-0.5 text-xl font-semibold leading-none text-neutral-950">Invoice Penjualan</div>
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
                                    <div className="grid grid-cols-[6rem_1fr] gap-3">
                                        <span className="text-neutral-500">Invoice No.</span>
                                        <span className="font-medium text-neutral-950">{sale.sale_no}</span>
                                    </div>
                                    <div className="grid grid-cols-[6rem_1fr] gap-3">
                                        <span className="text-neutral-500">Tanggal</span>
                                        <span>{issuedAt}</span>
                                    </div>
                                    <div className="grid grid-cols-[6rem_1fr] gap-3">
                                        <span className="text-neutral-500">Admin</span>
                                        <span>{sale.sold_by.name ?? '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-[6rem_1fr] gap-3">
                                        <span className="text-neutral-500">Metode</span>
                                        <span>{sale.payment_method.name ?? '-'}</span>
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
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Pembayaran</p>
                                <div className="mt-3 space-y-2 text-[11px] text-neutral-800">
                                    <p className="font-medium">{sale.payment_method.name ?? '-'}</p>
                                    <p className="text-neutral-500">{sale.payment_method.type_label}</p>

                                    {sale.payment_method.type === 'transfer' && (
                                        <div className="rounded border border-neutral-200 px-2.5 py-2">
                                            <p>{sale.payment_method.bank_name}</p>
                                            <p className="font-medium">{sale.payment_method.account_number}</p>
                                            <p>{sale.payment_method.account_name}</p>
                                        </div>
                                    )}

                                    {sale.payment_method.type === 'qris' && sale.payment_method.qr_image_path && (
                                        <div className="rounded border border-neutral-200 p-2">
                                            <img src={sale.payment_method.qr_image_path} alt={sale.payment_method.name ?? 'QRIS'} className="h-36 w-36 object-contain" />
                                        </div>
                                    )}

                                    {sale.payment_method.instructions && <p>{sale.payment_method.instructions}</p>}
                                </div>
                            </section>
                        </div>

                        <div className="px-7 pb-3">
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
                                        {sale.items.map((item) => (
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

                        <div className="grid gap-3 border-t border-neutral-300 px-7 py-3 lg:grid-cols-[1.2fr_19rem]">
                            <div className="grid gap-3">
                                {hasNotesSection ? (
                                    <section className="rounded-md border border-neutral-300 p-3">
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Catatan</p>
                                        <p className="mt-2 text-[11px] leading-5 text-neutral-700">{sale.notes}</p>
                                    </section>
                                ) : (
                                    <div />
                                )}
                            </div>

                            <section className="rounded-xl border border-neutral-300">
                                <div className="border-b border-neutral-300 px-5 py-2.5">
                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Ringkasan Belanja</p>
                                </div>
                                <div className="space-y-2.5 px-5 py-4 text-[11px] text-neutral-800">
                                    <div className="flex items-center justify-between gap-4">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(sale.subtotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span>Diskon</span>
                                        <span>{formatCurrency(sale.discount_amount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-3 text-base font-semibold text-neutral-950">
                                        <span>Total</span>
                                        <span>{formatCurrency(sale.total_amount)}</span>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="grid gap-7 border-t border-neutral-300 px-7 py-4 text-center text-[11px] md:grid-cols-2">
                            <div>
                                <p className="text-neutral-600">Customer Signature</p>
                                <div className="mt-10 border-t border-neutral-400 pt-2">{customerName}</div>
                            </div>

                            <div>
                                <p className="text-neutral-600">Authorized By</p>
                                <div className="mt-10 border-t border-neutral-400 pt-2">{sale.sold_by.name ?? '(........................)'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
