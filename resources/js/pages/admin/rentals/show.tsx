import AppLogoIcon from '@/components/app-logo-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Printer } from 'lucide-react';

interface RentalReceipt {
    id: number;
    rental_no: string;
    starts_at: string | null;
    due_at: string | null;
    total_days: number;
    final_total_days: number | null;
    subtotal: string;
    final_subtotal: string | null;
    paid_amount: string;
    remaining_amount: string;
    dp_override_reason: string | null;
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
    customer: {
        name: string | null;
        phone_whatsapp: string | null;
        address: string | null;
    };
    creator: {
        name: string | null;
    };
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

export default function RentalReceiptPage({ rental }: { rental: RentalReceipt }) {
    const { flash } = usePage<SharedData>().props;

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDate = (value: string | null) => (value ? dateFormatter.format(new Date(value)) : '-');
    const formatTime = (value: string | null) => (value ? timeFormatter.format(new Date(value)) : '-');

    const paymentNotes = rental.payments
        .map((payment) => payment.notes)
        .filter((note): note is string => Boolean(note && note.trim()));
    const issuedDate = formatDate(rental.starts_at);
    const dueDate = formatDate(rental.due_at);
    const customerRows = [
        { label: 'Nama', value: rental.customer.name },
        { label: 'No. Tlp', value: rental.customer.phone_whatsapp },
        { label: 'Alamat', value: rental.customer.address },
    ].filter((row): row is { label: string; value: string } => Boolean(row.value && row.value.trim()));
    const paymentRows = rental.payments.map((payment) => ({
        id: payment.id,
        amount: formatCurrency(payment.amount),
        detail: `${formatDate(payment.paid_at)} ${formatTime(payment.paid_at)} | ${payment.method_label} | ${payment.receiver_name ?? '-'}`,
    }));
    const notesRows = [rental.notes, ...paymentNotes].filter((note): note is string => Boolean(note && note.trim()));
    const hasPaymentHistory = paymentRows.length > 0;
    const hasNotesSection = notesRows.length > 0;
    const hasPaymentMethodSection = Boolean(rental.payment_method.name);
    const hasDetailSections = hasPaymentHistory || hasNotesSection || hasPaymentMethodSection;
    const displayedSubtotal = rental.final_subtotal ?? rental.subtotal;
    const displayedDays = rental.final_total_days ?? rental.total_days;

    return (
        <>
            <Head title={`Bukti Sewa ${rental.rental_no}`} />

            <div className="bg-neutral-100 px-4 py-6">
                <div className="mx-auto flex max-w-4xl flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <Button asChild variant="outline">
                            <Link href={route('admin.rentals.index')}>
                                <ArrowLeft className="h-4 w-4" />
                                Kembali ke Penyewaan
                            </Link>
                        </Button>

                        <Button type="button" onClick={() => window.print()}>
                            <Printer className="h-4 w-4" />
                            Print Bukti Sewa
                        </Button>
                    </div>

                    {flash.success && (
                        <Alert className="print:hidden">
                            <AlertTitle>Transaksi berhasil dibuat</AlertTitle>
                            <AlertDescription>{flash.success}</AlertDescription>
                        </Alert>
                    )}

                    <div className="overflow-hidden border border-neutral-300 bg-white shadow-sm print:shadow-none">
                        <div className="flex items-center justify-between gap-3 border-b border-neutral-300 bg-neutral-950 px-7 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white">Invoice Sewa Roc Advanture</p>
                            <div className="bg-white px-3 py-0.5 text-xl font-semibold leading-none text-neutral-950">Invoice Sewa</div>
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
                                        <span className="font-medium text-neutral-950">{rental.rental_no}</span>
                                    </div>
                                    <div className="grid grid-cols-[6rem_1fr] gap-3">
                                        <span className="text-neutral-500">Tanggal Terbit</span>
                                        <span>{issuedDate}</span>
                                    </div>
                                    <div className="grid grid-cols-[6rem_1fr] gap-3">
                                        <span className="text-neutral-500">Jatuh Tempo</span>
                                        <span>{dueDate}</span>
                                    </div>
                                    <div className="grid grid-cols-[6rem_1fr] gap-3">
                                        <span className="text-neutral-500">Admin</span>
                                        <span>{rental.creator.name ?? '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 px-7 py-4 md:grid-cols-2">
                            <section className="rounded-xl border border-neutral-300 p-4">
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Bill To</p>
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
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Schedule</p>
                                <div className="mt-3 grid grid-cols-[6.5rem_1fr_6.5rem_1fr] gap-x-3 gap-y-1.5 text-[11px] text-neutral-800">
                                    <span className="text-neutral-500">Tanggal Sewa</span>
                                    <span>{formatDate(rental.starts_at)}</span>
                                    <span className="text-neutral-500">Jam Kembali</span>
                                    <span>{formatTime(rental.due_at)}</span>
                                    <span className="text-neutral-500">Jam Sewa</span>
                                    <span>{formatTime(rental.starts_at)}</span>
                                    <span className="text-neutral-500">Durasi</span>
                                    <span>{displayedDays} hari</span>
                                    <span className="text-neutral-500">Tanggal Kembali</span>
                                    <span>{formatDate(rental.due_at)}</span>
                                </div>
                            </section>
                        </div>

                        <div className="px-7 pb-3">
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
                                        {rental.items.map((item) => (
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

                        <div className="grid gap-3 border-t border-neutral-300 px-7 py-3 lg:grid-cols-[1.2fr_19rem]">
                            {hasDetailSections ? (
                                <div className="grid gap-3">
                                    {hasPaymentHistory && (
                                            <section className="rounded-md border border-neutral-300 p-3">
                                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Riwayat Pembayaran</p>
                                            <div className="mt-2 space-y-1.5 text-[11px] text-neutral-800">
                                                {paymentRows.map((payment) => (
                                                    <div key={payment.id} className="rounded border border-neutral-200 px-2.5 py-2">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="font-medium text-neutral-950">{payment.amount}</span>
                                                        </div>
                                                        <p className="mt-0.5 text-[10px] text-neutral-600">{payment.detail}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {hasNotesSection && (
                                        <section className="rounded-md border border-neutral-300 p-3">
                                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Notes</p>
                                            <div className="mt-2 space-y-1 text-[11px] leading-4.5 text-neutral-700">
                                                {notesRows.map((note, index) => (
                                                    <p key={`${note}-${index}`}>{note}</p>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {rental.payment_method.name && (
                                        <section className="rounded-md border border-neutral-300 p-3">
                                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Metode Pembayaran</p>
                                            <div className="mt-2 space-y-2 text-[11px] text-neutral-700">
                                                <p className="font-medium text-neutral-950">{rental.payment_method.name}</p>
                                                {rental.payment_method.type === 'transfer' && (
                                                    <div className="rounded border border-neutral-200 px-2.5 py-2">
                                                        <p>{rental.payment_method.bank_name}</p>
                                                        <p className="font-medium">{rental.payment_method.account_number}</p>
                                                        <p>{rental.payment_method.account_name}</p>
                                                    </div>
                                                )}
                                                {rental.payment_method.type === 'qris' && rental.payment_method.qr_image_path && (
                                                    <div className="rounded border border-neutral-200 p-2">
                                                        <img src={rental.payment_method.qr_image_path} alt={rental.payment_method.name} className="h-36 w-36 object-contain" />
                                                    </div>
                                                )}
                                                {rental.payment_method.instructions && <p>{rental.payment_method.instructions}</p>}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            ) : (
                                <div />
                            )}

                            <section className={cn('rounded-xl border border-neutral-300', !hasDetailSections && 'lg:col-start-2')}>
                                <div className="border-b border-neutral-300 px-5 py-2.5">
                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Amount Due</p>
                                </div>
                                <div className="space-y-2.5 px-5 py-4 text-[11px] text-neutral-800">
                                    <div className="flex items-center justify-between gap-4">
                                        <span>Total Sewa</span>
                                        <span>{formatCurrency(displayedSubtotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span>Dibayar</span>
                                        <span>{formatCurrency(rental.paid_amount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-3 text-base font-semibold text-neutral-950">
                                        <span>Sisa</span>
                                        <span>{formatCurrency(rental.remaining_amount)}</span>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="grid gap-7 border-t border-neutral-300 px-7 py-4 text-center text-[11px] md:grid-cols-2">
                            <div>
                                <p className="text-neutral-600">Customer Signature</p>
                                <div className="mt-10 border-t border-neutral-400 pt-2">{rental.customer.name ?? '(........................)'}</div>
                            </div>

                            <div>
                                <p className="text-neutral-600">Authorized By</p>
                                <div className="mt-10 border-t border-neutral-400 pt-2">{rental.creator.name ?? '(........................)'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
