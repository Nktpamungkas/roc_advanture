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
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FileText, LoaderCircle, Search } from 'lucide-react';
import { FormEventHandler, useMemo, useState } from 'react';

interface CustomerOption {
    id: number;
    name: string;
    phone_whatsapp: string;
}

interface AvailableUnitItem {
    id: number;
    product_id: number;
    product_name: string | null;
    unit_code: string;
    status: string;
    status_label: string;
    daily_rate: string;
    notes: string | null;
}

interface SeasonRuleItem {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    dp_required: boolean;
    dp_type: string | null;
    dp_value: string | null;
    notes: string | null;
}

interface PaymentMethodOption {
    value: string;
    label: string;
}

interface RecentRentalItem {
    id: number;
    rental_no: string;
    customer_name: string | null;
    starts_at: string | null;
    due_at: string | null;
    items_count: number;
    subtotal: string;
    paid_amount: string;
    remaining_amount: string;
    payment_status: string;
    payment_status_label: string;
    rental_status: string;
    rental_status_label: string;
}

interface RentalSummary {
    total_available_units: number;
    ready_clean_units: number;
    ready_unclean_units: number;
    active_rentals: number;
}

interface RentalForm {
    customer_id: string;
    starts_at: string;
    due_at: string;
    inventory_unit_ids: number[];
    paid_amount: string;
    payment_method: string;
    payment_notes: string;
    notes: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Penyewaan', href: '/admin/rentals' },
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

const buildDefaultStartAt = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);

    return now;
};

const buildDefaultDueAt = (startAt: Date) => {
    const dueAt = new Date(startAt);
    dueAt.setDate(dueAt.getDate() + 1);

    return dueAt;
};

export default function RentalsIndex({
    customers,
    availableUnits,
    seasonRules,
    paymentMethodOptions,
    recentRentals,
    rentalSummary,
}: {
    customers: CustomerOption[];
    availableUnits: AvailableUnitItem[];
    seasonRules: SeasonRuleItem[];
    paymentMethodOptions: PaymentMethodOption[];
    recentRentals: RecentRentalItem[];
    rentalSummary: RentalSummary;
}) {
    const { flash } = usePage<SharedData>().props;
    const [unitSearch, setUnitSearch] = useState('');
    const defaultStartAt = buildDefaultStartAt();
    const defaultDueAt = buildDefaultDueAt(defaultStartAt);
    const noMasterData = customers.length === 0 || availableUnits.length === 0;
    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');

    const createForm = useForm<RentalForm>({
        customer_id: customers[0] ? String(customers[0].id) : '',
        starts_at: toDateTimeLocalValue(defaultStartAt),
        due_at: toDateTimeLocalValue(defaultDueAt),
        inventory_unit_ids: [],
        paid_amount: '0',
        payment_method: paymentMethodOptions[0]?.value ?? '',
        payment_notes: '',
        notes: '',
    });

    const selectedCustomer = useMemo(
        () => customers.find((customer) => String(customer.id) === createForm.data.customer_id) ?? null,
        [createForm.data.customer_id, customers],
    );

    const filteredUnits = useMemo(() => {
        const query = unitSearch.trim().toLowerCase();

        return availableUnits.filter((unit) => {
            if (query === '') {
                return true;
            }

            return [unit.product_name ?? '', unit.unit_code, unit.status_label, unit.notes ?? ''].join(' ').toLowerCase().includes(query);
        });
    }, [availableUnits, unitSearch]);

    const groupedUnits = useMemo(
        () =>
            filteredUnits.reduce<Record<string, AvailableUnitItem[]>>((groups, unit) => {
                const key = unit.product_name ?? 'Produk tanpa nama';
                groups[key] ??= [];
                groups[key].push(unit);
                return groups;
            }, {}),
        [filteredUnits],
    );

    const selectedUnits = useMemo(
        () => availableUnits.filter((unit) => createForm.data.inventory_unit_ids.includes(unit.id)),
        [availableUnits, createForm.data.inventory_unit_ids],
    );

    const totalDays = useMemo(() => {
        if (!createForm.data.starts_at || !createForm.data.due_at) {
            return 0;
        }

        const startsAt = new Date(createForm.data.starts_at);
        const dueAt = new Date(createForm.data.due_at);
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(dueAt.getTime()) || dueAt <= startsAt) {
            return 0;
        }

        return Math.max(1, Math.ceil((dueAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60 * 24)));
    }, [createForm.data.due_at, createForm.data.starts_at]);

    const matchedSeasonRule = useMemo(() => {
        const rentalDate = createForm.data.starts_at.slice(0, 10);
        const matches = seasonRules.filter((seasonRule) => rentalDate >= seasonRule.start_date && rentalDate <= seasonRule.end_date);

        return matches.length > 0 ? matches[matches.length - 1] : null;
    }, [createForm.data.starts_at, seasonRules]);

    const subtotal = useMemo(
        () => selectedUnits.reduce((sum, unit) => sum + Number(unit.daily_rate || 0) * totalDays, 0),
        [selectedUnits, totalDays],
    );

    const requiredDpAmount = useMemo(() => {
        if (!matchedSeasonRule?.dp_required) {
            return 0;
        }

        if (matchedSeasonRule.dp_type === 'fixed_amount') {
            return Math.min(subtotal, Number(matchedSeasonRule.dp_value || 0));
        }

        return Math.min(subtotal, subtotal * (Number(matchedSeasonRule.dp_value || 0) / 100));
    }, [matchedSeasonRule, subtotal]);

    const paidAmount = Number(createForm.data.paid_amount || 0);
    const remainingAmount = Math.max(0, subtotal - paidAmount);
    const isDpSeason = matchedSeasonRule?.dp_required === true;
    const hasRentalDraft = selectedUnits.length > 0 && totalDays > 0 && subtotal > 0;
    const dpRequirementUnmet = isDpSeason && hasRentalDraft && paidAmount < requiredDpAmount;
    const dpAlertTitle = isDpSeason
        ? dpRequirementUnmet
            ? 'High Season Aktif: DP Belum Cukup'
            : 'High Season Aktif: DP Wajib'
        : null;
    const dpAlertDescription = !isDpSeason
        ? null
        : !hasRentalDraft
          ? `Tanggal sewa masuk season ${matchedSeasonRule?.name}. DP akan diwajibkan setelah unit dan durasi sewa dipilih.`
          : dpRequirementUnmet
            ? `Tanggal sewa masuk season ${matchedSeasonRule?.name}. Minimal pembayaran awal ${formatCurrency(requiredDpAmount)} dan saat ini baru ${formatCurrency(paidAmount)}.`
            : `Tanggal sewa masuk season ${matchedSeasonRule?.name}. Minimal pembayaran awal ${formatCurrency(requiredDpAmount)} dan pembayaran awal sudah memenuhi syarat.`;

    const toggleUnit = (unitId: number, checked: boolean) => {
        if (checked) {
            createForm.setData('inventory_unit_ids', [...createForm.data.inventory_unit_ids, unitId]);
            return;
        }

        createForm.setData(
            'inventory_unit_ids',
            createForm.data.inventory_unit_ids.filter((selectedId) => selectedId !== unitId),
        );
    };

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();
        createForm.post(route('admin.rentals.store'), {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Penyewaan" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Transaksi rental outdoor</p>
                    <h1 className="mt-2 text-2xl font-semibold">Penyewaan</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Pilih customer, tentukan durasi sewa, ambil unit yang ready, lalu sistem otomatis menyiapkan bukti sewa dan mengurangi stok yang tersedia.
                    </p>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Transaksi tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                {noMasterData && (
                    <Alert>
                        <AlertTitle>Master data belum lengkap</AlertTitle>
                        <AlertDescription>Pastikan customer dan unit inventaris yang ready sudah tersedia sebelum membuat penyewaan.</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Unit Tersedia</p>
                        <p className="mt-2 text-2xl font-semibold">{rentalSummary.total_available_units}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Ready Bersih</p>
                        <p className="mt-2 text-2xl font-semibold">{rentalSummary.ready_clean_units}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Belum Dicuci</p>
                        <p className="mt-2 text-2xl font-semibold">{rentalSummary.ready_unclean_units}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Rental Aktif</p>
                        <p className="mt-2 text-2xl font-semibold">{rentalSummary.active_rentals}</p>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.4fr_0.95fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Buat Penyewaan</CardTitle>
                            <CardDescription>Unit dengan status belum dicuci tetap bisa dipilih jika customer setuju.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-6" onSubmit={submitCreate}>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="rental-customer">Customer</Label>
                                        <Select value={createForm.data.customer_id || 'placeholder'} onValueChange={(value) => createForm.setData('customer_id', value === 'placeholder' ? '' : value)} disabled={customers.length === 0}>
                                            <SelectTrigger id="rental-customer">
                                                <SelectValue placeholder="Pilih customer" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {customers.length > 0 ? customers.map((customer) => (
                                                    <SelectItem key={customer.id} value={String(customer.id)}>
                                                        {customer.name} • {customer.phone_whatsapp}
                                                    </SelectItem>
                                                )) : <SelectItem value="placeholder" disabled>Belum ada customer</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={createForm.errors.customer_id} />
                                    </div>

                                    <div className="grid gap-2 rounded-2xl border p-4 text-sm">
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Customer Terpilih</p>
                                        <p className="mt-2 font-medium">{selectedCustomer?.name ?? 'Belum dipilih'}</p>
                                        <p className="text-muted-foreground">{selectedCustomer?.phone_whatsapp ?? '-'}</p>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="starts-at">Mulai Sewa</Label>
                                        <Input id="starts-at" type="datetime-local" value={createForm.data.starts_at} onChange={(event) => createForm.setData('starts_at', event.target.value)} />
                                        <InputError message={createForm.errors.starts_at} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="due-at">Harus Kembali</Label>
                                        <Input id="due-at" type="datetime-local" value={createForm.data.due_at} onChange={(event) => createForm.setData('due_at', event.target.value)} />
                                        <InputError message={createForm.errors.due_at} />
                                    </div>
                                </div>

                                {isDpSeason && dpAlertTitle && dpAlertDescription && (
                                    <Alert variant={dpRequirementUnmet ? 'destructive' : 'default'}>
                                        <AlertTitle>{dpAlertTitle}</AlertTitle>
                                        <AlertDescription>{dpAlertDescription}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid gap-3 rounded-2xl border p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold">Pilih Unit Inventaris</h2>
                                            <p className="text-muted-foreground text-sm">Tersedia {availableUnits.length} unit ready dari stok saat ini.</p>
                                        </div>

                                        <div className="relative w-full md:max-w-xs">
                                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Cari unit atau produk" className="pl-9" />
                                        </div>
                                    </div>

                                    <InputError message={createForm.errors.inventory_unit_ids} />

                                    <div className="max-h-[28rem] overflow-auto rounded-xl border">
                                        {filteredUnits.length > 0 ? (
                                            <div className="grid gap-4 p-4">
                                                {Object.entries(groupedUnits).map(([productName, units]) => (
                                                    <div key={productName} className="rounded-2xl border p-4">
                                                        <div className="mb-3">
                                                            <h3 className="font-medium">{productName}</h3>
                                                            <p className="text-muted-foreground text-sm">{units.length} unit tersedia</p>
                                                        </div>

                                                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                            {units.map((unit) => {
                                                                const isSelected = createForm.data.inventory_unit_ids.includes(unit.id);

                                                                return (
                                                                    <label key={unit.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}>
                                                                        <Checkbox checked={isSelected} onCheckedChange={(checked) => toggleUnit(unit.id, checked === true)} />

                                                                        <div className="grid flex-1 gap-2">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <p className="font-medium">{unit.unit_code}</p>
                                                                                <Badge variant={unit.status === 'ready_unclean' ? 'secondary' : 'outline'}>{unit.status_label}</Badge>
                                                                            </div>
                                                                            <p className="text-muted-foreground text-sm">{formatCurrency(unit.daily_rate)} / hari</p>
                                                                            {unit.notes && <p className="text-muted-foreground text-xs leading-5">{unit.notes}</p>}
                                                                        </div>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-muted-foreground p-6 text-sm">Tidak ada unit yang cocok dengan pencarian saat ini.</div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="paid-amount">Pembayaran Awal</Label>
                                        <Input id="paid-amount" type="number" min="0" step="1000" value={createForm.data.paid_amount} onChange={(event) => createForm.setData('paid_amount', event.target.value)} placeholder="0" />
                                        <p className="text-muted-foreground text-xs">Bisa nol untuk regular season, atau minimal sesuai DP saat high season.</p>
                                        <InputError message={createForm.errors.paid_amount} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="payment-method">Metode Pembayaran</Label>
                                        <Select value={createForm.data.payment_method || 'placeholder'} onValueChange={(value) => createForm.setData('payment_method', value === 'placeholder' ? '' : value)}>
                                            <SelectTrigger id="payment-method">
                                                <SelectValue placeholder="Pilih metode" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {paymentMethodOptions.length > 0 ? paymentMethodOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                )) : <SelectItem value="placeholder" disabled>Belum ada metode</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={createForm.errors.payment_method} />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="payment-notes">Catatan Pembayaran</Label>
                                        <Textarea id="payment-notes" value={createForm.data.payment_notes} onChange={(event) => createForm.setData('payment_notes', event.target.value)} placeholder="Contoh: DP via transfer" />
                                        <InputError message={createForm.errors.payment_notes} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="rental-notes">Catatan Transaksi</Label>
                                        <Textarea id="rental-notes" value={createForm.data.notes} onChange={(event) => createForm.setData('notes', event.target.value)} placeholder="Catatan tambahan untuk admin" />
                                        <InputError message={createForm.errors.notes} />
                                    </div>
                                </div>

                                <Button type="submit" className="w-full md:w-auto" disabled={createForm.processing || noMasterData || dpRequirementUnmet}>
                                    {createForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                    Simpan Penyewaan
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="grid gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ringkasan Transaksi</CardTitle>
                                <CardDescription>Perhitungan akan mengikuti tanggal sewa, pilihan unit, dan season aktif.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Unit Dipilih</p>
                                    <p className="mt-2 text-2xl font-semibold">{selectedUnits.length}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Hari</p>
                                    <p className="mt-2 text-2xl font-semibold">{totalDays}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Subtotal</p>
                                    <p className="mt-2 text-2xl font-semibold">{formatCurrency(subtotal)}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Season Aktif</p>
                                    <p className="mt-2 font-semibold">{matchedSeasonRule?.name ?? 'Regular Season / tanpa rule'}</p>
                                    <p className="text-muted-foreground mt-2 text-sm">{matchedSeasonRule?.dp_required ? `DP wajib ${matchedSeasonRule.dp_type === 'percentage' ? `${matchedSeasonRule.dp_value}%` : formatCurrency(matchedSeasonRule.dp_value ?? 0)}` : 'Tidak wajib DP'}</p>
                                </div>
                                <div className="rounded-2xl border p-4 text-sm">
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-muted-foreground">Minimal DP</span>
                                        <span className="font-medium">{formatCurrency(requiredDpAmount)}</span>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-4">
                                        <span className="text-muted-foreground">Dibayar Sekarang</span>
                                        <span className="font-medium">{formatCurrency(paidAmount)}</span>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-4">
                                        <span className="text-muted-foreground">Sisa Tagihan</span>
                                        <span className="font-medium">{formatCurrency(remainingAmount)}</span>
                                    </div>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="font-medium">Daftar Unit</p>
                                    {selectedUnits.length > 0 ? (
                                        <div className="mt-3 grid gap-2">
                                            {selectedUnits.map((unit) => (
                                                <div key={unit.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                                                    <div>
                                                        <p className="font-medium">{unit.unit_code}</p>
                                                        <p className="text-muted-foreground text-xs">{unit.product_name}</p>
                                                    </div>
                                                    <Badge variant={unit.status === 'ready_unclean' ? 'secondary' : 'outline'}>{unit.status_label}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground mt-3 text-sm">Belum ada unit yang dipilih.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Rental Terbaru</CardTitle>
                                <CardDescription>Bukti sewa yang baru dibuat akan muncul di daftar ini.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {recentRentals.length > 0 ? (
                                    <div className="grid gap-3">
                                        {recentRentals.map((rental) => (
                                            <div key={rental.id} className="rounded-2xl border p-4">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                    <div>
                                                        <p className="font-semibold">{rental.rental_no}</p>
                                                        <p className="text-muted-foreground mt-1 text-sm">{rental.customer_name ?? '-'} • {rental.items_count} item</p>
                                                        <p className="text-muted-foreground mt-1 text-xs">{formatDateTime(rental.starts_at)} sampai {formatDateTime(rental.due_at)}</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge variant="outline">{rental.rental_status_label}</Badge>
                                                        <Badge variant={rental.payment_status === 'paid' ? 'default' : 'secondary'}>{rental.payment_status_label}</Badge>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid gap-2 text-sm">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-muted-foreground">Subtotal</span>
                                                        <span>{formatCurrency(rental.subtotal)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-muted-foreground">Sudah Dibayar</span>
                                                        <span>{formatCurrency(rental.paid_amount)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-muted-foreground">Sisa</span>
                                                        <span>{formatCurrency(rental.remaining_amount)}</span>
                                                    </div>
                                                </div>

                                                <Button asChild variant="outline" className="mt-4 w-full">
                                                    <Link href={route('admin.rentals.show', rental.id)}>
                                                        <FileText className="h-4 w-4" />
                                                        Lihat Bukti Sewa
                                                    </Link>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">Belum ada transaksi penyewaan.</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
