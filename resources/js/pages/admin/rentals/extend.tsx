import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarClock, CreditCard, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface PaymentMethodOption {
    value: string;
    label: string;
    type: string;
    type_label: string;
    instructions: string | null;
    bank_name: string | null;
    account_number: string | null;
    account_name: string | null;
    qr_image_path: string | null;
}

interface RentalExtensionItem {
    id: number;
    product_name_snapshot: string;
    inventory_unit_code: string | null;
    daily_rate_snapshot: string;
}

interface RentalExtensionPayload {
    id: number;
    rental_no: string;
    starts_at: string | null;
    due_at: string | null;
    total_days: number;
    subtotal: string;
    paid_amount: string;
    remaining_amount: string;
    rental_status: string;
    rental_status_label: string;
    customer: {
        name: string | null;
        phone_whatsapp: string | null;
        address: string | null;
    };
    creator: {
        name: string | null;
    };
    items: RentalExtensionItem[];
}

interface ExtensionForm {
    due_at: string;
    extension_payment_amount: string;
    payment_method_config_id: string;
    payment_notes: string;
}

const toDateTimeLocalValue = (value: string | null) => {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const timezoneOffset = date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function RentalExtendPage({
    rental,
    paymentMethodOptions,
}: {
    rental: RentalExtensionPayload;
    paymentMethodOptions: PaymentMethodOption[];
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Penyewaan', href: '/admin/rentals' },
        { title: rental.rental_no, href: route('admin.rentals.show', rental.id) },
        { title: 'Perpanjang Sewa', href: route('admin.rentals.extend.edit', rental.id) },
    ];

    const { flash } = usePage<SharedData>().props;
    const [availablePaymentMethodOptions, setAvailablePaymentMethodOptions] = useState(paymentMethodOptions);
    const [isRefreshingPaymentMethods, setIsRefreshingPaymentMethods] = useState(false);

    const form = useForm<ExtensionForm>({
        due_at: toDateTimeLocalValue(rental.due_at),
        extension_payment_amount: '0',
        payment_method_config_id: paymentMethodOptions[0]?.value ?? '',
        payment_notes: '',
    });

    useEffect(() => {
        setAvailablePaymentMethodOptions(paymentMethodOptions);
    }, [paymentMethodOptions]);

    const startsAtDate = useMemo(() => (rental.starts_at ? new Date(rental.starts_at) : null), [rental.starts_at]);
    const currentDueAtDate = useMemo(() => (rental.due_at ? new Date(rental.due_at) : null), [rental.due_at]);
    const proposedDueAtDate = useMemo(() => {
        if (!form.data.due_at) {
            return null;
        }

        const date = new Date(form.data.due_at);

        return Number.isNaN(date.getTime()) ? null : date;
    }, [form.data.due_at]);

    const newTotalDays = useMemo(() => {
        if (!startsAtDate || !proposedDueAtDate || proposedDueAtDate.getTime() <= startsAtDate.getTime()) {
            return rental.total_days;
        }

        return Math.max(1, Math.ceil((proposedDueAtDate.getTime() - startsAtDate.getTime()) / (1000 * 60 * 60 * 24)));
    }, [proposedDueAtDate, rental.total_days, startsAtDate]);

    const currentSubtotal = Number(rental.subtotal || 0);
    const paidAmount = Number(rental.paid_amount || 0);
    const newSubtotal = useMemo(
        () => rental.items.reduce((sum, item) => sum + Number(item.daily_rate_snapshot || 0) * newTotalDays, 0),
        [newTotalDays, rental.items],
    );
    const additionalSubtotal = Math.max(0, newSubtotal - currentSubtotal);
    const remainingBeforeExtensionPayment = Math.max(0, newSubtotal - paidAmount);
    const extensionPaymentAmount = Number(form.data.extension_payment_amount || 0);
    const remainingAfterExtensionPayment = Math.max(0, remainingBeforeExtensionPayment - extensionPaymentAmount);

    const selectedPaymentMethod = useMemo(
        () => availablePaymentMethodOptions.find((option) => option.value === form.data.payment_method_config_id) ?? null,
        [availablePaymentMethodOptions, form.data.payment_method_config_id],
    );

    const refreshPaymentMethodOptions = async (open: boolean) => {
        if (!open || isRefreshingPaymentMethods) {
            return;
        }

        setIsRefreshingPaymentMethods(true);

        try {
            const response = await fetch('/admin/payment-methods/options', {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) {
                throw new Error('Gagal memuat metode pembayaran terbaru.');
            }

            const data = (await response.json()) as { payment_method_options?: PaymentMethodOption[] };
            const nextOptions = data.payment_method_options ?? [];

            setAvailablePaymentMethodOptions(nextOptions);

            if (nextOptions.length === 0) {
                form.setData('payment_method_config_id', '');

                return;
            }

            if (!nextOptions.some((option) => option.value === form.data.payment_method_config_id)) {
                form.setData('payment_method_config_id', nextOptions[0]?.value ?? '');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsRefreshingPaymentMethods(false);
        }
    };

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');
    const invalidDueAt = Boolean(currentDueAtDate && proposedDueAtDate && proposedDueAtDate.getTime() <= currentDueAtDate.getTime());
    const invalidPaymentAmount = extensionPaymentAmount > remainingBeforeExtensionPayment;

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        form.put(route('admin.rentals.extend.update', rental.id), {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Perpanjang Sewa ${rental.rental_no}`} />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Perpanjangan transaksi rental</p>
                    <h1 className="mt-2 text-2xl font-semibold">Perpanjang Sewa</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Ubah jatuh tempo rental aktif, hitung otomatis total tagihan baru, lalu catat pembayaran tambahan jika customer langsung bayar saat perpanjang.
                    </p>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Perpanjangan tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-wrap gap-3">
                    <Button asChild variant="outline">
                        <Link href={route('admin.rentals.show', rental.id)}>
                            <ArrowLeft className="h-4 w-4" />
                            Kembali ke Invoice
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Ringkasan Rental</CardTitle>
                            <CardDescription>{rental.rental_no} • {rental.rental_status_label}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="rounded-2xl border p-4">
                                <p className="font-medium">{rental.customer.name ?? '-'}</p>
                                <p className="text-muted-foreground mt-1">{rental.customer.phone_whatsapp ?? '-'}</p>
                                <p className="text-muted-foreground mt-1">{rental.customer.address ?? '-'}</p>
                            </div>

                            <div className="rounded-2xl border p-4">
                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Mulai Sewa</span><span>{formatDateTime(rental.starts_at)}</span></div>
                                    <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Jatuh Tempo Saat Ini</span><span>{formatDateTime(rental.due_at)}</span></div>
                                    <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Durasi Saat Ini</span><span>{rental.total_days} hari</span></div>
                                    <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Subtotal Saat Ini</span><span>{formatCurrency(rental.subtotal)}</span></div>
                                    <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Sudah Dibayar</span><span>{formatCurrency(rental.paid_amount)}</span></div>
                                    <div className="flex items-center justify-between gap-3 border-t pt-3 font-medium"><span>Sisa Saat Ini</span><span>{formatCurrency(rental.remaining_amount)}</span></div>
                                </div>
                            </div>

                            <div className="rounded-2xl border p-4">
                                <p className="text-muted-foreground text-xs uppercase tracking-wide">Item Rental</p>
                                <div className="mt-3 grid gap-3">
                                    {rental.items.map((item) => (
                                        <div key={item.id} className="rounded-xl border px-3 py-2">
                                            <p className="font-medium">{item.product_name_snapshot}</p>
                                            <p className="text-muted-foreground mt-1 text-xs">{item.inventory_unit_code ?? '-'} • {formatCurrency(item.daily_rate_snapshot)} / hari</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Form Perpanjangan</CardTitle>
                            <CardDescription>Reminder WhatsApp berikutnya akan mengikuti jatuh tempo baru yang kamu simpan di sini.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-6" onSubmit={submit}>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="due-at">Jatuh Tempo Baru</Label>
                                        <Input id="due-at" type="datetime-local" value={form.data.due_at} onChange={(event) => form.setData('due_at', event.target.value)} />
                                        {invalidDueAt && <p className="text-sm text-red-600">Tanggal/jam baru harus lebih besar dari jatuh tempo saat ini.</p>}
                                        <InputError message={form.errors.due_at} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="extension-payment-amount">Pembayaran Saat Perpanjang</Label>
                                        <Input
                                            id="extension-payment-amount"
                                            type="number"
                                            min="0"
                                            step="1000"
                                            value={form.data.extension_payment_amount}
                                            onChange={(event) => form.setData('extension_payment_amount', event.target.value)}
                                        />
                                        {invalidPaymentAmount && <p className="text-sm text-red-600">Pembayaran tidak boleh melebihi sisa tagihan terbaru.</p>}
                                        <InputError message={form.errors.extension_payment_amount} />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-[1fr_0.9fr]">
                                    <div className="grid gap-2">
                                        <Label htmlFor="payment-method-config-id">Metode Pembayaran</Label>
                                        <Select
                                            value={form.data.payment_method_config_id || 'none'}
                                            onValueChange={(value) => form.setData('payment_method_config_id', value === 'none' ? '' : value)}
                                            onOpenChange={(open) => void refreshPaymentMethodOptions(open)}
                                        >
                                            <SelectTrigger id="payment-method-config-id">
                                                <SelectValue placeholder="Pilih metode pembayaran" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Belum dipilih</SelectItem>
                                                {availablePaymentMethodOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label} • {option.type_label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-muted-foreground text-xs">{isRefreshingPaymentMethods ? 'Memuat metode pembayaran terbaru...' : 'Daftar akan dicek ulang saat dropdown dibuka.'}</p>
                                        <InputError message={form.errors.payment_method_config_id} />
                                    </div>

                                    {selectedPaymentMethod && (
                                        <div className="rounded-2xl border p-4 text-sm">
                                            <div className="mb-2 flex items-center gap-2 font-medium">
                                                <CreditCard className="h-4 w-4" />
                                                {selectedPaymentMethod.label}
                                            </div>
                                            {selectedPaymentMethod.type === 'transfer' && (
                                                <div className="rounded-xl border bg-muted/20 p-3">
                                                    <p>{selectedPaymentMethod.bank_name}</p>
                                                    <p className="font-medium">{selectedPaymentMethod.account_number}</p>
                                                    <p className="text-muted-foreground">{selectedPaymentMethod.account_name}</p>
                                                </div>
                                            )}
                                            {selectedPaymentMethod.type === 'qris' && selectedPaymentMethod.qr_image_path && (
                                                <img src={selectedPaymentMethod.qr_image_path} alt={selectedPaymentMethod.label} className="h-36 w-36 rounded-xl border object-contain p-2" />
                                            )}
                                            {selectedPaymentMethod.instructions && <p className="text-muted-foreground mt-2 leading-6">{selectedPaymentMethod.instructions}</p>}
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="payment-notes">Catatan Pembayaran</Label>
                                    <Textarea id="payment-notes" rows={3} value={form.data.payment_notes} onChange={(event) => form.setData('payment_notes', event.target.value)} />
                                    <InputError message={form.errors.payment_notes} />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-2xl border p-4 text-sm">
                                        <div className="mb-3 flex items-center gap-2 font-medium">
                                            <CalendarClock className="h-4 w-4" />
                                            Jadwal Baru
                                        </div>
                                        <div className="grid gap-2">
                                            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Jatuh Tempo Baru</span><span>{proposedDueAtDate ? formatDateTime(proposedDueAtDate.toISOString()) : '-'}</span></div>
                                            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Durasi Baru</span><span>{newTotalDays} hari</span></div>
                                            <div className="flex items-center justify-between gap-3 border-t pt-3 font-medium"><span>Tambahan Hari</span><span>{Math.max(0, newTotalDays - rental.total_days)} hari</span></div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border p-4 text-sm">
                                        <p className="mb-3 font-medium">Ringkasan Tagihan Baru</p>
                                        <div className="grid gap-2">
                                            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Subtotal Lama</span><span>{formatCurrency(currentSubtotal)}</span></div>
                                            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Tambahan Sewa</span><span>{formatCurrency(additionalSubtotal)}</span></div>
                                            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Subtotal Baru</span><span>{formatCurrency(newSubtotal)}</span></div>
                                            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Sudah Dibayar</span><span>{formatCurrency(paidAmount)}</span></div>
                                            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Sisa Sebelum Bayar</span><span>{formatCurrency(remainingBeforeExtensionPayment)}</span></div>
                                            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Bayar Sekarang</span><span>{formatCurrency(extensionPaymentAmount)}</span></div>
                                            <div className="flex items-center justify-between gap-3 border-t pt-3 text-base font-semibold"><span>Sisa Setelah Simpan</span><span>{formatCurrency(remainingAfterExtensionPayment)}</span></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={
                                            form.processing ||
                                            invalidDueAt ||
                                            invalidPaymentAmount ||
                                            (extensionPaymentAmount > 0 && form.data.payment_method_config_id === '')
                                        }
                                    >
                                        {form.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Simpan Perpanjangan
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
