import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ArrowUpDown, CheckCheck, ChevronLeft, ChevronRight, CreditCard, LoaderCircle, Search, ShieldAlert, X } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface RentalItemSummary {
    id: number;
    product_name: string;
    inventory_unit_code: string | null;
    daily_rate_snapshot: string;
    status_at_checkout_label: string;
}

interface ActiveRentalItem {
    id: number;
    rental_no: string;
    customer_name: string | null;
    customer_phone: string | null;
    starts_at: string | null;
    due_at: string | null;
    total_days: number;
    subtotal: string;
    paid_amount: string;
    remaining_amount: string;
    guarantee_note: string | null;
    is_overdue: boolean;
    items: RentalItemSummary[];
}

interface RecentReturnItem {
    id: number;
    rental_no: string | null;
    customer_name: string | null;
    returned_at: string | null;
    items_count: number;
}

interface ReturnSummary {
    active_rentals: number;
    overdue_rentals: number;
    returned_today: number;
    rented_units: number;
}

interface Option {
    value: string;
    label: string;
}

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

interface ReturnFilters {
    search: string;
    overdue: string;
    per_page: number;
}

interface ReturnPagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface ReturnFormItem {
    rental_item_id: number;
    next_unit_status: string;
    notes: string;
}

interface ReturnForm {
    rental_id: string;
    returned_at: string;
    settlement_basis: string;
    guarantee_returned: boolean;
    payment_method_config_id: string;
    payment_notes: string;
    notes: string;
    items: ReturnFormItem[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pengembalian', href: '/admin/returns' },
];

const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const toDateTimeLocalValue = (date: Date) => {
    const timezoneOffset = date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const buildReturnedAt = (startsAtValue?: string | null) => {
    const now = new Date();
    now.setSeconds(0, 0);

    if (!startsAtValue) {
        return toDateTimeLocalValue(now);
    }

    const startsAt = new Date(startsAtValue);

    if (Number.isNaN(startsAt.getTime())) {
        return toDateTimeLocalValue(now);
    }

    return toDateTimeLocalValue(now.getTime() > startsAt.getTime() ? now : startsAt);
};

export default function ReturnsIndex({
    activeRentals,
    recentReturns,
    returnSummary,
    returnFilters,
    returnPagination,
    returnStatusOptions,
    settlementBasisOptions,
    paymentMethodOptions,
    returnConditionLabels,
}: {
    activeRentals: ActiveRentalItem[];
    recentReturns: RecentReturnItem[];
    returnSummary: ReturnSummary;
    returnFilters: ReturnFilters;
    returnPagination: ReturnPagination;
    returnStatusOptions: Option[];
    settlementBasisOptions: Option[];
    paymentMethodOptions: PaymentMethodOption[];
    returnConditionLabels: Record<string, string>;
}) {
    const { flash } = usePage<SharedData>().props;
    const [selectedRentalId, setSelectedRentalId] = useState<number | null>(activeRentals[0]?.id ?? null);

    const selectedRental = useMemo(
        () => activeRentals.find((rental) => rental.id === selectedRentalId) ?? null,
        [activeRentals, selectedRentalId],
    );

    const returnForm = useForm<ReturnForm>({
        rental_id: selectedRental ? String(selectedRental.id) : '',
        returned_at: buildReturnedAt(selectedRental?.starts_at),
        settlement_basis: settlementBasisOptions[0]?.value ?? 'contract',
        guarantee_returned: false,
        payment_method_config_id: paymentMethodOptions[0]?.value ?? '',
        payment_notes: '',
        notes: '',
        items: selectedRental
            ? selectedRental.items.map((item) => ({
                  rental_item_id: item.id,
                  next_unit_status: 'ready_unclean',
                  notes: '',
              }))
            : [],
    });

    const filterForm = useForm({
        search: returnFilters.search,
        overdue: returnFilters.overdue,
        per_page: String(returnFilters.per_page),
    });

    useEffect(() => {
        if (activeRentals.some((rental) => rental.id === selectedRentalId)) {
            return;
        }

        setSelectedRentalId(activeRentals[0]?.id ?? null);
    }, [activeRentals, selectedRentalId]);

    useEffect(() => {
        if (!selectedRental) {
            returnForm.setData({
                rental_id: '',
                returned_at: buildReturnedAt(),
                settlement_basis: settlementBasisOptions[0]?.value ?? 'contract',
                guarantee_returned: false,
                payment_method_config_id: paymentMethodOptions[0]?.value ?? '',
                payment_notes: '',
                notes: '',
                items: [],
            });
            return;
        }

        returnForm.setData({
            rental_id: String(selectedRental.id),
            returned_at: buildReturnedAt(selectedRental.starts_at),
            settlement_basis: settlementBasisOptions[0]?.value ?? 'contract',
            guarantee_returned: false,
            payment_method_config_id: paymentMethodOptions[0]?.value ?? '',
            payment_notes: '',
            notes: '',
            items: selectedRental.items.map((item) => ({
                rental_item_id: item.id,
                next_unit_status: 'ready_unclean',
                notes: '',
            })),
        });
        returnForm.clearErrors();
    }, [selectedRental]);

    useEffect(() => {
        filterForm.setData({
            search: returnFilters.search,
            overdue: returnFilters.overdue,
            per_page: String(returnFilters.per_page),
        });
    }, [returnFilters.overdue, returnFilters.per_page, returnFilters.search]);

    const updateItem = (index: number, updater: (item: ReturnFormItem) => ReturnFormItem) => {
        returnForm.setData(
            'items',
            returnForm.data.items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)),
        );
    };

    const applyStatusToAll = (status: string) => {
        returnForm.setData(
            'items',
            returnForm.data.items.map((item) => ({
                ...item,
                next_unit_status: status,
            })),
        );
    };

    const submitReturn: FormEventHandler = (event) => {
        event.preventDefault();

        returnForm.post(route('admin.returns.store'), {
            preserveScroll: true,
        });
    };

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.returns.index'),
            {
                search: filterForm.data.search || undefined,
                overdue: filterForm.data.overdue || undefined,
                per_page: filterForm.data.per_page,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const resetFilters = () => {
        filterForm.setData({
            search: '',
            overdue: '',
            per_page: '10',
        });

        router.get(route('admin.returns.index'), { per_page: 10 }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const goToPage = (page: number) => {
        router.get(
            route('admin.returns.index'),
            {
                search: returnFilters.search || undefined,
                overdue: returnFilters.overdue || undefined,
                per_page: returnFilters.per_page,
                page,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');

    const selectedPaymentMethod = useMemo(
        () => paymentMethodOptions.find((option) => option.value === returnForm.data.payment_method_config_id) ?? null,
        [paymentMethodOptions, returnForm.data.payment_method_config_id],
    );

    const computedSettlementDays = useMemo(() => {
        if (!selectedRental) {
            return 0;
        }

        if (returnForm.data.settlement_basis !== 'actual' || !selectedRental.starts_at || !returnForm.data.returned_at) {
            return selectedRental.total_days;
        }

        const startsAt = new Date(selectedRental.starts_at);
        const returnedAt = new Date(returnForm.data.returned_at);

        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(returnedAt.getTime())) {
            return selectedRental.total_days;
        }

        return Math.max(1, Math.ceil((returnedAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60 * 24)));
    }, [returnForm.data.returned_at, returnForm.data.settlement_basis, selectedRental]);

    const computedFinalSubtotal = useMemo(() => {
        if (!selectedRental) {
            return 0;
        }

        if (returnForm.data.settlement_basis !== 'actual') {
            return Number(selectedRental.subtotal || 0);
        }

        return selectedRental.items.reduce(
            (sum, item) => sum + Number(item.daily_rate_snapshot || 0) * computedSettlementDays,
            0,
        );
    }, [computedSettlementDays, returnForm.data.settlement_basis, selectedRental]);

    const computedSettlementAmount = useMemo(() => {
        if (!selectedRental) {
            return 0;
        }

        return Math.max(0, computedFinalSubtotal - Number(selectedRental.paid_amount || 0));
    }, [computedFinalSubtotal, selectedRental]);
    const guaranteeStillHeld = Boolean(selectedRental?.guarantee_note && !returnForm.data.guarantee_returned);

    const paginationPages = useMemo(() => {
        if (returnPagination.last_page <= 1) {
            return [1];
        }

        const start = Math.max(1, returnPagination.current_page - 2);
        const end = Math.min(returnPagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);

        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [returnPagination.current_page, returnPagination.last_page]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pengembalian" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Operasional return rental</p>
                    <h1 className="mt-2 text-2xl font-semibold">Pengembalian</h1>
                </section>

                {flash.success && <Alert><AlertTitle>Pengembalian tersimpan</AlertTitle><AlertDescription>{flash.success}</AlertDescription></Alert>}

                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">Rental Aktif</p><p className="mt-2 text-2xl font-semibold">{returnSummary.active_rentals}</p></div>
                    <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">Overdue</p><p className="mt-2 text-2xl font-semibold">{returnSummary.overdue_rentals}</p></div>
                    <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">Kembali Hari Ini</p><p className="mt-2 text-2xl font-semibold">{returnSummary.returned_today}</p></div>
                    <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">Unit Disewa</p><p className="mt-2 text-2xl font-semibold">{returnSummary.rented_units}</p></div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
                    <div className="grid gap-6">
                        <Card>
                            <CardHeader className="gap-4">
                                <div><CardTitle>Rental Aktif</CardTitle><CardDescription>Pilih transaksi yang ingin dikembalikan.</CardDescription></div>
                                <form className="grid gap-3 md:grid-cols-[1fr_10rem_10rem_auto]" onSubmit={submitFilters}>
                                    <div className="relative"><Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" /><Input value={filterForm.data.search} onChange={(event) => filterForm.setData('search', event.target.value)} className="pl-9" placeholder="Cari rental / customer" /></div>
                                    <Select value={filterForm.data.overdue || 'all'} onValueChange={(value) => filterForm.setData('overdue', value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem><SelectItem value="yes">Overdue</SelectItem><SelectItem value="no">Tidak overdue</SelectItem></SelectContent></Select>
                                    <Select value={filterForm.data.per_page} onValueChange={(value) => filterForm.setData('per_page', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[10, 15, 25, 50].map((option) => <SelectItem key={option} value={String(option)}>{option} baris</SelectItem>)}</SelectContent></Select>
                                    <Button type="button" variant="outline" onClick={resetFilters}><X className="mr-2 h-4 w-4" />Reset</Button>
                                </form>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid max-h-[32rem] gap-3 overflow-auto">
                                    {activeRentals.length > 0 ? activeRentals.map((rental) => (
                                        <button key={rental.id} type="button" onClick={() => setSelectedRentalId(rental.id)} className={`rounded-2xl border p-4 text-left transition ${selectedRentalId === rental.id ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}>
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold">{rental.rental_no}</p>
                                                    <p className="text-muted-foreground mt-1 text-sm">{rental.customer_name ?? '-'} • {rental.items.length} item</p>
                                                    <p className="text-muted-foreground mt-1 text-xs">{formatDateTime(rental.starts_at)} sampai {formatDateTime(rental.due_at)}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {rental.is_overdue && <Badge variant="destructive"><ShieldAlert className="h-3.5 w-3.5" />Overdue</Badge>}
                                                    <Badge variant="outline">{formatCurrency(rental.subtotal)}</Badge>
                                                </div>
                                            </div>
                                            <div className="mt-4 grid gap-1 text-xs text-muted-foreground">
                                                <p>Dibayar: {formatCurrency(rental.paid_amount)}</p>
                                                <p>Sisa: {formatCurrency(rental.remaining_amount)}</p>
                                                <p>Kontak: {rental.customer_phone ?? '-'}</p>
                                            </div>
                                        </button>
                                    )) : <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">Tidak ada transaksi aktif yang perlu diproses pengembaliannya sekarang.</div>}
                                </div>

                                {returnPagination.last_page > 1 && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-muted-foreground text-sm">Halaman {returnPagination.current_page} dari {returnPagination.last_page}</p><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" disabled={returnPagination.current_page <= 1} onClick={() => goToPage(returnPagination.current_page - 1)}><ChevronLeft className="h-4 w-4" /></Button>{paginationPages.map((page) => <Button key={page} type="button" variant={page === returnPagination.current_page ? 'default' : 'outline'} size="sm" onClick={() => goToPage(page)}>{page}</Button>)}<Button type="button" variant="outline" size="icon" disabled={returnPagination.current_page >= returnPagination.last_page} onClick={() => goToPage(returnPagination.current_page + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Pengembalian Terbaru</CardTitle></CardHeader>
                            <CardContent>
                                {recentReturns.length > 0 ? <div className="grid gap-3">{recentReturns.map((returnRecord) => <div key={returnRecord.id} className="rounded-2xl border p-4 text-sm"><p className="font-medium">{returnRecord.rental_no ?? '-'}</p><p className="text-muted-foreground mt-1">{returnRecord.customer_name ?? '-'} • {returnRecord.items_count} item</p><p className="text-muted-foreground mt-1 text-xs">{formatDateTime(returnRecord.returned_at)}</p></div>)}</div> : <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">Belum ada pengembalian yang diproses.</div>}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader><CardTitle>Form Pengembalian</CardTitle><CardDescription>{selectedRental ? `Proses pengembalian untuk transaksi ${selectedRental.rental_no}.` : 'Pilih salah satu rental aktif di sisi kiri untuk mulai memproses pengembalian.'}</CardDescription></CardHeader>
                        <CardContent>
                            {selectedRental ? (
                                <form className="grid gap-6" onSubmit={submitReturn}>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="rounded-2xl border p-4 text-sm"><p className="text-muted-foreground text-xs uppercase tracking-wide">Customer</p><p className="mt-2 font-medium">{selectedRental.customer_name ?? '-'}</p><p className="text-muted-foreground mt-1">{selectedRental.customer_phone ?? '-'}</p>{selectedRental.guarantee_note && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><p className="font-medium">Jaminan dititipkan</p><p className="mt-1 leading-5">{selectedRental.guarantee_note}</p></div>}<p className="text-muted-foreground mt-3 text-xs">Kontrak {formatCurrency(selectedRental.subtotal)} • Dibayar {formatCurrency(selectedRental.paid_amount)}</p></div>
                                        <div className="grid gap-4">
                                            <div className="grid gap-2"><Label htmlFor="returned-at">Waktu Pengembalian</Label><Input id="returned-at" type="datetime-local" min={selectedRental.starts_at ? selectedRental.starts_at.slice(0, 16) : undefined} value={returnForm.data.returned_at} onChange={(event) => returnForm.setData('returned_at', event.target.value)} /><InputError message={returnForm.errors.returned_at} /></div>
                                            <div className="grid gap-2"><Label htmlFor="settlement-basis">Perhitungan Pelunasan</Label><Select value={returnForm.data.settlement_basis} onValueChange={(value) => returnForm.setData('settlement_basis', value)}><SelectTrigger id="settlement-basis"><SelectValue /></SelectTrigger><SelectContent>{settlementBasisOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><InputError message={returnForm.errors.settlement_basis} /></div>
                                        </div>
                                    </div>

                                    {selectedRental.guarantee_note && <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"><p className="text-xs font-medium uppercase tracking-wide text-amber-900">Pengembalian Jaminan</p><p className="mt-2 text-sm text-amber-950">Sistem mencatat jaminan fisik penyewa berupa <span className="font-semibold">{selectedRental.guarantee_note}</span>. Pastikan jaminan ini benar-benar sudah dikembalikan ke customer sebelum transaksi return disimpan.</p><div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-white/80 px-3 py-3"><Checkbox id="guarantee-returned" checked={returnForm.data.guarantee_returned} onCheckedChange={(checked) => returnForm.setData('guarantee_returned', checked === true)} /><div className="grid gap-1"><Label htmlFor="guarantee-returned" className="cursor-pointer text-sm font-medium text-amber-950">Jaminan sudah dikembalikan ke penyewa</Label><p className="text-xs text-amber-800">Centang ini setelah admin menyerahkan kembali jaminan fisik ke customer.</p></div></div><InputError message={returnForm.errors.guarantee_returned} /></div>}

                                    <div className="grid gap-4 md:grid-cols-[1fr_0.9fr]">
                                        <div className="grid gap-4">
                                            <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => applyStatusToAll('ready_unclean')}><ArrowUpDown className="h-4 w-4" />Semua Ready Belum Dicuci</Button><Button type="button" variant="outline" onClick={() => applyStatusToAll('ready_clean')}><CheckCheck className="h-4 w-4" />Semua Ready Bersih</Button></div>
                                            <div className="grid gap-4">
                                                {selectedRental.items.map((item, index) => {
                                                    const formItem = returnForm.data.items[index];
                                                    const nextStatus = formItem?.next_unit_status ?? 'ready_unclean';
                                                    const requiresAttention = ['maintenance', 'retired'].includes(nextStatus);
                                                    const nextStatusError = returnForm.errors[`items.${index}.next_unit_status` as keyof typeof returnForm.errors];
                                                    const notesError = returnForm.errors[`items.${index}.notes` as keyof typeof returnForm.errors];

                                                    return <div key={item.id} className="rounded-2xl border p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="font-medium">{item.product_name}</p><p className="text-muted-foreground mt-1 text-sm">{item.inventory_unit_code ?? '-'} • keluar sebagai {item.status_at_checkout_label}</p></div>{requiresAttention && <Badge variant="secondary">{returnConditionLabels.damaged}</Badge>}</div><div className="mt-4 grid gap-4 md:grid-cols-[0.95fr_1.05fr]"><div className="grid gap-2"><Label htmlFor={`item-status-${item.id}`}>Status Setelah Kembali</Label><Select value={nextStatus} onValueChange={(value) => updateItem(index, (currentItem) => ({ ...currentItem, next_unit_status: value }))}><SelectTrigger id={`item-status-${item.id}`}><SelectValue /></SelectTrigger><SelectContent>{returnStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><InputError message={nextStatusError as string | undefined} /></div><div className="grid gap-2"><Label htmlFor={`item-notes-${item.id}`}>Catatan Item{requiresAttention ? ' (Wajib)' : ''}</Label><Textarea id={`item-notes-${item.id}`} value={formItem?.notes ?? ''} onChange={(event) => updateItem(index, (currentItem) => ({ ...currentItem, notes: event.target.value }))} /><InputError message={notesError as string | undefined} /></div></div></div>;
                                                })}
                                            </div>
                                        </div>

                                        <div className="grid gap-4">
                                            <div className="rounded-2xl border p-4 text-sm"><p className="text-muted-foreground text-xs uppercase tracking-wide">Pelunasan Return</p><div className="mt-3 grid gap-2"><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Dasar</span><span>{returnForm.data.settlement_basis === 'actual' ? 'Aktual' : 'Kontrak'}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Hari Ditagihkan</span><span>{computedSettlementDays}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Total Akhir</span><span>{formatCurrency(computedFinalSubtotal)}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Sudah Dibayar</span><span>{formatCurrency(selectedRental.paid_amount)}</span></div><div className="flex items-center justify-between gap-3 border-t pt-3 font-medium"><span>Pelunasan Saat Ini</span><span>{formatCurrency(computedSettlementAmount)}</span></div></div></div>
                                            <div className="grid gap-2"><Label htmlFor="return-payment-method">Metode Pelunasan</Label><Select value={returnForm.data.payment_method_config_id || 'none'} onValueChange={(value) => returnForm.setData('payment_method_config_id', value === 'none' ? '' : value)}><SelectTrigger id="return-payment-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Belum dipilih</SelectItem>{paymentMethodOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label} • {option.type_label}</SelectItem>)}</SelectContent></Select><InputError message={returnForm.errors.payment_method_config_id} /></div>
                                            {selectedPaymentMethod && <div className="rounded-2xl border p-4 text-sm"><div className="mb-2 flex items-center gap-2 font-medium"><CreditCard className="h-4 w-4" />{selectedPaymentMethod.label}</div>{selectedPaymentMethod.type === 'transfer' && <div className="rounded-xl border bg-muted/20 p-3"><p>{selectedPaymentMethod.bank_name}</p><p className="font-medium">{selectedPaymentMethod.account_number}</p><p className="text-muted-foreground">{selectedPaymentMethod.account_name}</p></div>}{selectedPaymentMethod.type === 'qris' && selectedPaymentMethod.qr_image_path && <img src={selectedPaymentMethod.qr_image_path} alt={selectedPaymentMethod.label} className="h-40 w-40 rounded-xl border object-contain p-2" />}{selectedPaymentMethod.instructions && <p className="text-muted-foreground mt-2 leading-6">{selectedPaymentMethod.instructions}</p>}</div>}
                                            <div className="grid gap-2"><Label htmlFor="payment-notes">Catatan Pelunasan</Label><Textarea id="payment-notes" value={returnForm.data.payment_notes} onChange={(event) => returnForm.setData('payment_notes', event.target.value)} /><InputError message={returnForm.errors.payment_notes} /></div>
                                        </div>
                                    </div>

                                    <div className="grid gap-2"><Label htmlFor="return-notes">Catatan Pengembalian</Label><Textarea id="return-notes" value={returnForm.data.notes} onChange={(event) => returnForm.setData('notes', event.target.value)} /><InputError message={returnForm.errors.notes} /></div>
                                    <InputError message={returnForm.errors.items as string | undefined} />
                                    <InputError message={returnForm.errors.rental_id} />
                                    <Button type="submit" className="w-full md:w-auto" disabled={returnForm.processing || (computedSettlementAmount > 0 && returnForm.data.payment_method_config_id === '') || guaranteeStillHeld}>{returnForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}Proses Pengembalian & Pelunasan</Button>
                                </form>
                            ) : <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">Belum ada rental aktif yang bisa diproses.</div>}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
