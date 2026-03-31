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
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, FileText, LoaderCircle, Search, UserRoundSearch, X } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface CustomerRating {
    score: number;
    label: string;
    total_rentals: number;
    overdue_returns: number;
    damaged_returns: number;
}

interface CustomerOption {
    id: number;
    name: string;
    phone_whatsapp: string;
    address: string | null;
    rating: CustomerRating | null;
}

interface AvailableUnitItem {
    id: number;
    product_name: string | null;
    unit_code: string;
    status: string;
    status_label: string;
    daily_rate: string;
    notes: string | null;
}

interface SeasonRuleItem {
    name: string;
    start_date: string;
    end_date: string;
    dp_required: boolean;
    dp_type: string | null;
    dp_value: string | null;
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
    payment_status_label: string;
    rental_status_label: string;
}

interface RentalSummary {
    total_available_units: number;
    ready_clean_units: number;
    ready_unclean_units: number;
    active_rentals: number;
}

interface RentalFilters {
    recent_search: string;
    recent_per_page: number;
}

interface RecentRentalPagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface RentalForm {
    customer_id: string;
    customer_name: string;
    customer_phone_whatsapp: string;
    customer_address: string;
    guarantee_note: string;
    starts_at: string;
    rental_days: string;
    due_at: string;
    inventory_unit_ids: number[];
    paid_amount: string;
    payment_method_config_id: string;
    payment_notes: string;
    dp_override_reason: string;
    notes: string;
}

type RentalDurationInputSource = 'rental_days' | 'due_at';

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

const defaultStartAt = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);

    return toDateTimeLocalValue(now);
};

const calculateDueAtValue = (startsAtValue: string, rentalDaysValue: string) => {
    const startsAt = new Date(startsAtValue);
    const rentalDays = Number(rentalDaysValue);

    if (Number.isNaN(startsAt.getTime()) || rentalDays <= 0) {
        return '';
    }

    startsAt.setDate(startsAt.getDate() + rentalDays);

    return toDateTimeLocalValue(startsAt);
};

const calculateRentalDaysValue = (startsAtValue: string, dueAtValue: string) => {
    const startsAt = new Date(startsAtValue);
    const dueAt = new Date(dueAtValue);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(dueAt.getTime()) || dueAt.getTime() <= startsAt.getTime()) {
        return '';
    }

    return String(Math.max(1, Math.ceil((dueAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60 * 24))));
};

export default function RentalsIndex({
    customers,
    availableUnits,
    seasonRules,
    paymentMethodOptions,
    recentRentals,
    rentalFilters,
    recentRentalPagination,
    rentalSummary,
}: {
    customers: CustomerOption[];
    availableUnits: AvailableUnitItem[];
    seasonRules: SeasonRuleItem[];
    paymentMethodOptions: PaymentMethodOption[];
    recentRentals: RecentRentalItem[];
    rentalFilters: RentalFilters;
    recentRentalPagination: RecentRentalPagination;
    rentalSummary: RentalSummary;
}) {
    const { flash } = usePage<SharedData>().props;
    const [unitSearch, setUnitSearch] = useState('');
    const [durationInputSource, setDurationInputSource] = useState<RentalDurationInputSource>('rental_days');
    const [availablePaymentMethodOptions, setAvailablePaymentMethodOptions] = useState(paymentMethodOptions);
    const [isRefreshingPaymentMethods, setIsRefreshingPaymentMethods] = useState(false);
    const startsAtDefault = defaultStartAt();
    const dueAtDefault = calculateDueAtValue(startsAtDefault, '1');

    const createForm = useForm<RentalForm>({
        customer_id: '',
        customer_name: '',
        customer_phone_whatsapp: '',
        customer_address: '',
        guarantee_note: '',
        starts_at: startsAtDefault,
        rental_days: '1',
        due_at: dueAtDefault,
        inventory_unit_ids: [],
        paid_amount: '0',
        payment_method_config_id: paymentMethodOptions[0]?.value ?? '',
        payment_notes: '',
        dp_override_reason: '',
        notes: '',
    });

    const recentFilterForm = useForm({
        recent_search: rentalFilters.recent_search,
        recent_per_page: String(rentalFilters.recent_per_page),
    });

    const computedDueAt = useMemo(() => {
        if (durationInputSource !== 'rental_days') {
            return createForm.data.due_at;
        }

        return calculateDueAtValue(createForm.data.starts_at, createForm.data.rental_days);
    }, [createForm.data.due_at, createForm.data.rental_days, createForm.data.starts_at, durationInputSource]);

    const computedRentalDays = useMemo(() => {
        if (durationInputSource !== 'due_at') {
            return createForm.data.rental_days;
        }

        return calculateRentalDaysValue(createForm.data.starts_at, createForm.data.due_at);
    }, [createForm.data.due_at, createForm.data.rental_days, createForm.data.starts_at, durationInputSource]);

    useEffect(() => {
        setAvailablePaymentMethodOptions(paymentMethodOptions);
    }, [paymentMethodOptions]);

    useEffect(() => {
        if (durationInputSource === 'rental_days' && computedDueAt !== createForm.data.due_at) {
            createForm.setData('due_at', computedDueAt);
        }
    }, [computedDueAt, createForm, createForm.data.due_at, durationInputSource]);

    useEffect(() => {
        if (durationInputSource === 'due_at' && computedRentalDays !== createForm.data.rental_days) {
            createForm.setData('rental_days', computedRentalDays);
        }
    }, [computedRentalDays, createForm, createForm.data.rental_days, durationInputSource]);

    const exactCustomerMatch = useMemo(
        () => customers.find((customer) => customer.phone_whatsapp.trim() === createForm.data.customer_phone_whatsapp.trim()) ?? null,
        [createForm.data.customer_phone_whatsapp, customers],
    );

    useEffect(() => {
        createForm.setData('customer_id', exactCustomerMatch ? String(exactCustomerMatch.id) : '');
    }, [exactCustomerMatch]);

    const customerSuggestions = useMemo(() => {
        const query = `${createForm.data.customer_name} ${createForm.data.customer_phone_whatsapp}`.trim().toLowerCase();

        if (query.length < 2) {
            return [];
        }

        return customers
            .filter((customer) => `${customer.name} ${customer.phone_whatsapp}`.toLowerCase().includes(query))
            .slice(0, 5);
    }, [createForm.data.customer_name, createForm.data.customer_phone_whatsapp, customers]);

    const filteredUnits = useMemo(() => {
        const query = unitSearch.trim().toLowerCase();

        return availableUnits.filter((unit) =>
            query === ''
                ? true
                : [unit.product_name ?? '', unit.unit_code, unit.status_label, unit.notes ?? ''].join(' ').toLowerCase().includes(query),
        );
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

    const totalDays = Math.max(0, Number(createForm.data.rental_days || 0));
    const selectedPaymentMethod = useMemo(
        () => availablePaymentMethodOptions.find((option) => option.value === createForm.data.payment_method_config_id) ?? null,
        [availablePaymentMethodOptions, createForm.data.payment_method_config_id],
    );

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
    const dpRequirementUnmet = isDpSeason && selectedUnits.length > 0 && totalDays > 0 && subtotal > 0 && paidAmount < requiredDpAmount;
    const noMasterData = availableUnits.length === 0;

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');

    const pickSuggestedCustomer = (customer: CustomerOption) => {
        createForm.setData({
            ...createForm.data,
            customer_id: String(customer.id),
            customer_name: customer.name,
            customer_phone_whatsapp: customer.phone_whatsapp,
            customer_address: customer.address ?? '',
        });
    };

    const toggleUnit = (unitId: number, checked: boolean) => {
        if (checked) {
            createForm.setData('inventory_unit_ids', [...createForm.data.inventory_unit_ids, unitId]);
            return;
        }

        createForm.setData('inventory_unit_ids', createForm.data.inventory_unit_ids.filter((selectedId) => selectedId !== unitId));
    };

    const updateStartsAt = (value: string) => {
        createForm.setData('starts_at', value);
    };

    const updateRentalDays = (value: string) => {
        setDurationInputSource('rental_days');
        createForm.setData('rental_days', value);
    };

    const updateDueAt = (value: string) => {
        setDurationInputSource('due_at');
        createForm.setData('due_at', value);
    };

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
                createForm.setData('payment_method_config_id', '');

                return;
            }

            if (! nextOptions.some((option) => option.value === createForm.data.payment_method_config_id)) {
                createForm.setData('payment_method_config_id', nextOptions[0]?.value ?? '');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsRefreshingPaymentMethods(false);
        }
    };

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();

        createForm.post(route('admin.rentals.store'), {
            preserveScroll: true,
        });
    };

    const submitRecentFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.rentals.index'),
            {
                recent_search: recentFilterForm.data.recent_search || undefined,
                recent_per_page: recentFilterForm.data.recent_per_page,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const resetRecentFilters = () => {
        recentFilterForm.setData({
            recent_search: '',
            recent_per_page: '10',
        });

        router.get(route('admin.rentals.index'), { recent_per_page: 10 }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const goToRecentPage = (page: number) => {
        router.get(
            route('admin.rentals.index'),
            {
                recent_search: rentalFilters.recent_search || undefined,
                recent_per_page: rentalFilters.recent_per_page,
                page,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const rentalPaginationPages = useMemo(() => {
        if (recentRentalPagination.last_page <= 1) {
            return [1];
        }

        const start = Math.max(1, recentRentalPagination.current_page - 2);
        const end = Math.min(recentRentalPagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);

        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [recentRentalPagination.current_page, recentRentalPagination.last_page]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Penyewaan" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Transaksi rental outdoor</p>
                    <h1 className="mt-2 text-2xl font-semibold">Penyewaan</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Customer bisa langsung diinput dari form sewa, lalu sistem akan menyesuaikan tanggal kembali otomatis berdasarkan durasi.
                    </p>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Transaksi tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                {noMasterData && (
                    <Alert variant="destructive">
                        <AlertTitle>Unit inventaris belum tersedia</AlertTitle>
                        <AlertDescription>Pastikan ada unit inventaris yang ready sebelum membuat penyewaan.</AlertDescription>
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

                <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Buat Penyewaan</CardTitle>
                            <CardDescription>Unit belum dicuci tetap bisa dipilih jika customer setuju.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-6" onSubmit={submitCreate}>
                                <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="customer-name">Nama Customer</Label>
                                            <Input id="customer-name" value={createForm.data.customer_name} onChange={(event) => createForm.setData('customer_name', event.target.value)} />
                                            <InputError message={createForm.errors.customer_name} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="customer-phone">Nomor WhatsApp</Label>
                                            <Input id="customer-phone" value={createForm.data.customer_phone_whatsapp} onChange={(event) => createForm.setData('customer_phone_whatsapp', event.target.value)} />
                                            <InputError message={createForm.errors.customer_phone_whatsapp} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="customer-address">Alamat</Label>
                                            <Textarea id="customer-address" rows={3} value={createForm.data.customer_address} onChange={(event) => createForm.setData('customer_address', event.target.value)} />
                                            <InputError message={createForm.errors.customer_address} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="guarantee-note">Jaminan</Label>
                                            <Input
                                                id="guarantee-note"
                                                value={createForm.data.guarantee_note}
                                                onChange={(event) => createForm.setData('guarantee_note', event.target.value)}
                                                placeholder="Contoh: KTP, SIM C, STNK motor"
                                            />
                                            <p className="text-muted-foreground text-xs">Jaminan ini fisik dan hanya dicatat di sistem untuk dikembalikan saat proses return.</p>
                                            <InputError message={createForm.errors.guarantee_note} />
                                        </div>

                                        {customerSuggestions.length > 0 && (
                                            <div className="rounded-2xl border border-dashed p-4">
                                                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                                                    <UserRoundSearch className="h-4 w-4" />
                                                    Gunakan customer lama
                                                </div>
                                                <div className="grid gap-2">
                                                    {customerSuggestions.map((customer) => (
                                                        <button key={customer.id} type="button" onClick={() => pickSuggestedCustomer(customer)} className="hover:border-primary/40 rounded-xl border p-3 text-left transition">
                                                            <p className="font-medium">{customer.name}</p>
                                                            <p className="text-muted-foreground text-sm">{customer.phone_whatsapp}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-2xl border p-4 text-sm">
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Penilaian Customer</p>
                                        {exactCustomerMatch ? (
                                            <div className="mt-3 space-y-2">
                                                <p className="font-medium">{exactCustomerMatch.name}</p>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">Rating</span>
                                                    <Badge variant="outline">{exactCustomerMatch.rating?.label ?? 'Cukup'}</Badge>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">Skor</span>
                                                    <span>{exactCustomerMatch.rating?.score ?? 60}/100</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">Overdue</span>
                                                    <span>{exactCustomerMatch.rating?.overdue_returns ?? 0}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">Reject/Rusak</span>
                                                    <span>{exactCustomerMatch.rating?.damaged_returns ?? 0}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground mt-3 leading-6">Kalau nomor WhatsApp cocok dengan customer lama, rating historinya akan tampil di sini.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="grid gap-2">
                                        <Label htmlFor="starts-at">Mulai Sewa</Label>
                                        <Input id="starts-at" type="datetime-local" value={createForm.data.starts_at} onChange={(event) => updateStartsAt(event.target.value)} />
                                        <InputError message={createForm.errors.starts_at} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="rental-days">Lama Sewa (Hari)</Label>
                                        <Input id="rental-days" type="number" min="1" value={createForm.data.rental_days} onChange={(event) => updateRentalDays(event.target.value)} />
                                        <InputError message={createForm.errors.rental_days} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="due-at">Harus Kembali</Label>
                                        <Input id="due-at" type="datetime-local" value={createForm.data.due_at} onChange={(event) => updateDueAt(event.target.value)} />
                                        <InputError message={createForm.errors.due_at} />
                                    </div>
                                </div>

                                {isDpSeason && (
                                    <Alert variant={dpRequirementUnmet ? 'destructive' : 'default'}>
                                        <AlertTitle>{dpRequirementUnmet ? 'High Season: DP Di Bawah Rekomendasi' : 'High Season Aktif'}</AlertTitle>
                                        <AlertDescription>
                                            {dpRequirementUnmet
                                                ? `Masuk season ${matchedSeasonRule?.name}. Rekomendasi DP ${formatCurrency(requiredDpAmount)}. Isi alasan override kalau mau lanjut.`
                                                : `Masuk season ${matchedSeasonRule?.name}. Rekomendasi DP ${formatCurrency(requiredDpAmount)}.`}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid gap-3 rounded-2xl border p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold">Pilih Unit Inventaris</h2>
                                            <p className="text-muted-foreground text-sm">Tersedia {availableUnits.length} unit ready dari stok saat ini.</p>
                                        </div>
                                        <div className="relative w-full md:max-w-xs">
                                            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
                                                                    <label
                                                                        key={unit.id}
                                                                        className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                                                                            isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/40'
                                                                        }`}
                                                                    >
                                                                        <Checkbox checked={isSelected} onCheckedChange={(checked) => toggleUnit(unit.id, checked === true)} />
                                                                        <div className="grid flex-1 gap-2">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <p className="font-medium">{unit.unit_code}</p>
                                                                                <InventoryStatusBadge status={unit.status} label={unit.status_label} />
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

                                <div className="grid gap-4 md:grid-cols-[1fr_0.9fr]">
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="payment-method-config">Metode Pembayaran</Label>
                                            <Select value={createForm.data.payment_method_config_id || 'none'} onValueChange={(value) => createForm.setData('payment_method_config_id', value === 'none' ? '' : value)} onOpenChange={(open) => void refreshPaymentMethodOptions(open)}>
                                                <SelectTrigger id="payment-method-config">
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
                                            <InputError message={createForm.errors.payment_method_config_id} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="paid-amount">Pembayaran Awal</Label>
                                            <Input id="paid-amount" type="number" min="0" step="1000" value={createForm.data.paid_amount} onChange={(event) => createForm.setData('paid_amount', event.target.value)} />
                                            <InputError message={createForm.errors.paid_amount} />
                                        </div>

                                        {dpRequirementUnmet && (
                                            <div className="grid gap-2">
                                                <Label htmlFor="dp-override-reason">Alasan Override DP</Label>
                                                <Textarea id="dp-override-reason" rows={3} value={createForm.data.dp_override_reason} onChange={(event) => createForm.setData('dp_override_reason', event.target.value)} />
                                                <InputError message={createForm.errors.dp_override_reason} />
                                            </div>
                                        )}

                                        <div className="grid gap-2">
                                            <Label htmlFor="payment-notes">Catatan Pembayaran</Label>
                                            <Textarea id="payment-notes" rows={3} value={createForm.data.payment_notes} onChange={(event) => createForm.setData('payment_notes', event.target.value)} />
                                            <InputError message={createForm.errors.payment_notes} />
                                        </div>
                                    </div>

                                    <div className="grid gap-4">
                                        <div className="rounded-2xl border p-4 text-sm">
                                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Metode Terpilih</p>
                                            {selectedPaymentMethod ? (
                                                <div className="mt-3 space-y-2">
                                                    <p className="font-medium">{selectedPaymentMethod.label}</p>
                                                    {selectedPaymentMethod.type === 'transfer' && (
                                                        <div className="rounded-xl border bg-muted/20 p-3">
                                                            <p>{selectedPaymentMethod.bank_name}</p>
                                                            <p className="font-medium">{selectedPaymentMethod.account_number}</p>
                                                            <p className="text-muted-foreground">{selectedPaymentMethod.account_name}</p>
                                                        </div>
                                                    )}
                                                    {selectedPaymentMethod.type === 'qris' && selectedPaymentMethod.qr_image_path && (
                                                        <img src={selectedPaymentMethod.qr_image_path} alt={selectedPaymentMethod.label} className="h-40 w-40 rounded-xl border object-contain p-2" />
                                                    )}
                                                    {selectedPaymentMethod.instructions && <p className="text-muted-foreground leading-6">{selectedPaymentMethod.instructions}</p>}
                                                </div>
                                            ) : (
                                                <p className="text-muted-foreground mt-3">Pilih metode pembayaran agar instruksi tampil di invoice.</p>
                                            )}
                                        </div>

                                        <div className="rounded-2xl border p-4 text-sm">
                                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Ringkasan Sewa</p>
                                            <div className="mt-3 grid gap-2">
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Unit Dipilih</span><span>{selectedUnits.length}</span></div>
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Durasi</span><span>{totalDays} hari</span></div>
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Total</span><span>{formatCurrency(subtotal)}</span></div>
                                                {isDpSeason && <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">DP Rekomendasi</span><span>{formatCurrency(requiredDpAmount)}</span></div>}
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Dibayar</span><span>{formatCurrency(paidAmount)}</span></div>
                                                <div className="flex items-center justify-between gap-3 border-t pt-3 font-medium"><span>Sisa</span><span>{formatCurrency(remainingAmount)}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="rental-notes">Catatan Transaksi</Label>
                                    <Textarea id="rental-notes" rows={3} value={createForm.data.notes} onChange={(event) => createForm.setData('notes', event.target.value)} />
                                    <InputError message={createForm.errors.notes} />
                                </div>

                                <div className="flex justify-end">
                                    <Button type="submit" disabled={createForm.processing || noMasterData || selectedUnits.length === 0 || totalDays <= 0 || (dpRequirementUnmet && createForm.data.dp_override_reason.trim() === '')}>
                                        {createForm.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                        Simpan Penyewaan
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="gap-4">
                            <div>
                                <CardTitle>Rental Terbaru</CardTitle>
                                <CardDescription>Atur jumlah baris dan cari transaksi terbaru dengan cepat.</CardDescription>
                            </div>
                            <form className="grid gap-3 md:grid-cols-[1fr_10rem_auto_auto]" onSubmit={submitRecentFilters}>
                                <div className="relative">
                                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                    <Input value={recentFilterForm.data.recent_search} onChange={(event) => recentFilterForm.setData('recent_search', event.target.value)} className="pl-9" placeholder="Cari rental / customer" />
                                </div>
                                <Select value={recentFilterForm.data.recent_per_page} onValueChange={(value) => recentFilterForm.setData('recent_per_page', value)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {[10, 15, 25, 50].map((option) => <SelectItem key={option} value={String(option)}>{option} baris</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Button type="submit">Terapkan</Button>
                                <Button type="button" variant="outline" onClick={resetRecentFilters}><X className="mr-2 h-4 w-4" />Reset</Button>
                            </form>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-muted-foreground text-sm">
                                {recentRentalPagination.total > 0 ? `Menampilkan ${recentRentalPagination.from}-${recentRentalPagination.to} dari ${recentRentalPagination.total} rental` : 'Belum ada transaksi rental'}
                            </div>
                            <div className="grid max-h-[32rem] gap-3 overflow-auto">
                                {recentRentals.length > 0 ? recentRentals.map((rental) => (
                                    <div key={rental.id} className="rounded-2xl border p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold">{rental.rental_no}</p>
                                                <p className="text-muted-foreground mt-1 text-sm">{rental.customer_name ?? '-'} • {rental.items_count} item</p>
                                            </div>
                                            <Badge variant="outline">{rental.rental_status_label}</Badge>
                                        </div>
                                        <div className="text-muted-foreground mt-3 grid gap-1 text-xs">
                                            <p>{formatDateTime(rental.starts_at)} sampai {formatDateTime(rental.due_at)}</p>
                                            <p>Total {formatCurrency(rental.subtotal)} • Dibayar {formatCurrency(rental.paid_amount)} • Sisa {formatCurrency(rental.remaining_amount)}</p>
                                            <p>Status bayar: {rental.payment_status_label}</p>
                                        </div>
                                        <Button asChild variant="outline" className="mt-4 w-full">
                                            <Link href={route('admin.rentals.show', rental.id)}>Buka Invoice</Link>
                                        </Button>
                                    </div>
                                )) : <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">Belum ada rental yang cocok dengan filter saat ini.</div>}
                            </div>

                            {recentRentalPagination.last_page > 1 && (
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-muted-foreground text-sm">Halaman {recentRentalPagination.current_page} dari {recentRentalPagination.last_page}</p>
                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="outline" size="icon" disabled={recentRentalPagination.current_page <= 1} onClick={() => goToRecentPage(recentRentalPagination.current_page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                                        {rentalPaginationPages.map((page) => <Button key={page} type="button" variant={page === recentRentalPagination.current_page ? 'default' : 'outline'} size="sm" onClick={() => goToRecentPage(page)}>{page}</Button>)}
                                        <Button type="button" variant="outline" size="icon" disabled={recentRentalPagination.current_page >= recentRentalPagination.last_page} onClick={() => goToRecentPage(recentRentalPagination.current_page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

function InventoryStatusBadge({ status, label }: { status: string; label: string }) {
    const tone = inventoryStatusTone(status);

    return (
        <Badge variant="outline" className={`gap-2 border ${tone.badgeClass}`}>
            <span className={`size-2 rounded-full ${tone.dotClass}`} />
            {label}
        </Badge>
    );
}

function inventoryStatusTone(status: string): { badgeClass: string; dotClass: string } {
    switch (status) {
        case 'ready_clean':
            return {
                badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                dotClass: 'bg-emerald-500',
            };
        case 'ready_unclean':
            return {
                badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
                dotClass: 'bg-amber-500',
            };
        case 'rented':
            return {
                badgeClass: 'border-sky-200 bg-sky-50 text-sky-800',
                dotClass: 'bg-sky-500',
            };
        case 'maintenance':
            return {
                badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
                dotClass: 'bg-rose-500',
            };
        case 'retired':
            return {
                badgeClass: 'border-slate-300 bg-slate-100 text-slate-700',
                dotClass: 'bg-slate-500',
            };
        default:
            return {
                badgeClass: 'border-zinc-200 bg-zinc-50 text-zinc-700',
                dotClass: 'bg-zinc-400',
            };
    }
}
