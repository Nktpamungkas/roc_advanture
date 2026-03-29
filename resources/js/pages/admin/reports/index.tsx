import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo } from 'react';

interface ReportFilters {
    search: string;
    date_from: string;
    date_to: string;
    rental_status: string;
    due_scope: string;
    per_page: number;
}

interface OptionItem {
    value: string;
    label: string;
}

interface ReportSummary {
    rentals_in_period: number;
    billed_in_period: number;
    payments_in_period: number;
    active_outstanding: number;
    overdue_count: number;
    due_today_count: number;
}

interface InventorySummary {
    ready_clean: number;
    ready_unclean: number;
    rented: number;
    maintenance: number;
}

interface RentalReportItem {
    id: number;
    rental_no: string;
    customer_name: string | null;
    customer_phone: string | null;
    starts_at: string | null;
    due_at: string | null;
    items_count: number;
    total_amount: string;
    paid_amount: string;
    remaining_amount: string;
    payment_status_label: string;
    rental_status_label: string;
    admin_name: string | null;
    is_overdue: boolean;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface DueSummary {
    active_rentals: number;
    due_today: number;
    due_tomorrow: number;
    overdue: number;
    shown_items: number;
}

interface DueItem {
    id: number;
    rental_no: string;
    customer_name: string | null;
    customer_phone: string | null;
    due_at: string | null;
    items_count: number;
    remaining_amount: string;
    rental_status_label: string;
    due_label: string;
    is_overdue: boolean;
}

interface StockReportItem {
    id: number;
    name: string;
    category: string | null;
    daily_rate: string;
    total_units_count: number;
    ready_clean_units_count: number;
    ready_unclean_units_count: number;
    rented_units_count: number;
    maintenance_units_count: number;
    retired_units_count: number;
}

interface MethodBreakdownItem {
    label: string;
    total: number;
}

interface PaymentSummary {
    total_received: number;
    dp_received: number;
    settlement_received: number;
    compensation_received: number;
    method_breakdown: MethodBreakdownItem[];
}

interface RecentPaymentItem {
    id: number;
    rental_no: string | null;
    customer_name: string | null;
    payment_kind_label: string;
    method_label: string;
    paid_at: string | null;
    amount: string;
    receiver_name: string | null;
    notes: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '/admin/reports' },
];

const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
});

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function ReportsIndex({
    reportFilters,
    rentalStatusOptions,
    dueScopeOptions,
    reportSummary,
    inventorySummary,
    rentals,
    rentalPagination,
    dueSummary,
    dueItems,
    stockReport,
    paymentSummary,
    recentPayments,
}: {
    reportFilters: ReportFilters;
    rentalStatusOptions: OptionItem[];
    dueScopeOptions: OptionItem[];
    reportSummary: ReportSummary;
    inventorySummary: InventorySummary;
    rentals: RentalReportItem[];
    rentalPagination: PaginationMeta;
    dueSummary: DueSummary;
    dueItems: DueItem[];
    stockReport: StockReportItem[];
    paymentSummary: PaymentSummary;
    recentPayments: RecentPaymentItem[];
}) {
    const { flash } = usePage<SharedData>().props;

    const filterForm = useForm({
        search: reportFilters.search,
        date_from: reportFilters.date_from,
        date_to: reportFilters.date_to,
        rental_status: reportFilters.rental_status,
        due_scope: reportFilters.due_scope,
        per_page: String(reportFilters.per_page),
    });

    useEffect(() => {
        filterForm.setData({
            search: reportFilters.search,
            date_from: reportFilters.date_from,
            date_to: reportFilters.date_to,
            rental_status: reportFilters.rental_status,
            due_scope: reportFilters.due_scope,
            per_page: String(reportFilters.per_page),
        });
    }, [reportFilters.date_from, reportFilters.date_to, reportFilters.due_scope, reportFilters.per_page, reportFilters.rental_status, reportFilters.search]);

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.reports.index'),
            {
                search: filterForm.data.search || undefined,
                date_from: filterForm.data.date_from || undefined,
                date_to: filterForm.data.date_to || undefined,
                rental_status: filterForm.data.rental_status || undefined,
                due_scope: filterForm.data.due_scope || undefined,
                per_page: filterForm.data.per_page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const resetFilters = () => {
        filterForm.setData({
            search: '',
            date_from: reportFilters.date_from,
            date_to: reportFilters.date_to,
            rental_status: '',
            due_scope: 'all',
            per_page: '10',
        });

        router.get(
            route('admin.reports.index'),
            {
                date_from: reportFilters.date_from,
                date_to: reportFilters.date_to,
                due_scope: 'all',
                per_page: 10,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const goToPage = (page: number) => {
        router.get(
            route('admin.reports.index'),
            {
                search: reportFilters.search || undefined,
                date_from: reportFilters.date_from,
                date_to: reportFilters.date_to,
                rental_status: reportFilters.rental_status || undefined,
                due_scope: reportFilters.due_scope || undefined,
                per_page: reportFilters.per_page,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const paginationPages = useMemo(() => {
        if (rentalPagination.last_page <= 1) {
            return [1];
        }

        const pages = new Set<number>([1, rentalPagination.last_page]);

        for (let page = rentalPagination.current_page - 1; page <= rentalPagination.current_page + 1; page += 1) {
            if (page >= 1 && page <= rentalPagination.last_page) {
                pages.add(page);
            }
        }

        return Array.from(pages).sort((left, right) => left - right);
    }, [rentalPagination.current_page, rentalPagination.last_page]);

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Laporan" />

            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Laporan Operasional</h1>
                    <p className="text-muted-foreground text-sm">Ringkasan cepat untuk penyewaan, jatuh tempo, posisi stok, dan pembayaran masuk Roc Advanture.</p>
                </div>

                {flash.success && (
                    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{flash.success}</div>
                )}

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>Filter Laporan</CardTitle>
                        <CardDescription>Atur periode dan pencarian untuk membaca laporan operasional dari satu halaman.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submitFilters} className="grid gap-4 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))]">
                            <div className="grid gap-2 lg:col-span-1">
                                <Label htmlFor="search">Cari Rental / Customer</Label>
                                <div className="relative">
                                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                    <Input
                                        id="search"
                                        value={filterForm.data.search}
                                        onChange={(event) => filterForm.setData('search', event.target.value)}
                                        placeholder="No rental, nama, atau no. WA"
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="date-from">Tanggal Mulai</Label>
                                <Input id="date-from" type="date" value={filterForm.data.date_from} onChange={(event) => filterForm.setData('date_from', event.target.value)} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="date-to">Tanggal Akhir</Label>
                                <Input id="date-to" type="date" value={filterForm.data.date_to} onChange={(event) => filterForm.setData('date_to', event.target.value)} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="rental-status">Status Rental</Label>
                                <Select value={filterForm.data.rental_status || 'all'} onValueChange={(value) => filterForm.setData('rental_status', value === 'all' ? '' : value)}>
                                    <SelectTrigger id="rental-status">
                                        <SelectValue placeholder="Semua status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua status</SelectItem>
                                        {rentalStatusOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="due-scope">Fokus Jatuh Tempo</Label>
                                <Select value={filterForm.data.due_scope || 'all'} onValueChange={(value) => filterForm.setData('due_scope', value)}>
                                    <SelectTrigger id="due-scope">
                                        <SelectValue placeholder="Semua aktif" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dueScopeOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="per-page">Baris / Halaman</Label>
                                <Select value={filterForm.data.per_page} onValueChange={(value) => filterForm.setData('per_page', value)}>
                                    <SelectTrigger id="per-page">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['10', '15', '25', '50'].map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-wrap items-end justify-end gap-3 lg:col-span-5">
                                <Button type="button" variant="outline" onClick={resetFilters}>
                                    <X className="mr-2 h-4 w-4" />
                                    Reset
                                </Button>
                                <Button type="submit">Terapkan Filter</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-muted-foreground text-sm">Penyewaan Periode</p><p className="mt-2 text-2xl font-semibold">{reportSummary.rentals_in_period}</p><p className="text-muted-foreground mt-2 text-xs">Total rental dalam rentang tanggal yang dipilih.</p></CardContent></Card>
                    <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-muted-foreground text-sm">Tagihan Periode</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(reportSummary.billed_in_period)}</p><p className="text-muted-foreground mt-2 text-xs">Nilai sewa dari transaksi yang masuk ke periode laporan.</p></CardContent></Card>
                    <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-muted-foreground text-sm">Pembayaran Masuk</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(reportSummary.payments_in_period)}</p><p className="text-muted-foreground mt-2 text-xs">Akumulasi pembayaran DP, pelunasan, dan ganti rugi.</p></CardContent></Card>
                    <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-muted-foreground text-sm">Piutang Aktif</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(reportSummary.active_outstanding)}</p><p className="text-muted-foreground mt-2 text-xs">{reportSummary.overdue_count} overdue, {reportSummary.due_today_count} jatuh tempo hari ini.</p></CardContent></Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-muted-foreground text-sm">Ready Bersih</p><p className="mt-2 text-2xl font-semibold">{inventorySummary.ready_clean}</p></CardContent></Card>
                    <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-muted-foreground text-sm">Ready Belum Dicuci</p><p className="mt-2 text-2xl font-semibold">{inventorySummary.ready_unclean}</p></CardContent></Card>
                    <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-muted-foreground text-sm">Sedang Disewa</p><p className="mt-2 text-2xl font-semibold">{inventorySummary.rented}</p></CardContent></Card>
                    <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-muted-foreground text-sm">Maintenance</p><p className="mt-2 text-2xl font-semibold">{inventorySummary.maintenance}</p></CardContent></Card>
                </div>

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>Laporan Penyewaan</CardTitle>
                        <CardDescription>Daftar transaksi sewa pada periode laporan, lengkap dengan status pembayaran dan sisa tagihan.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="overflow-hidden rounded-2xl border">
                            <div className="max-h-[30rem] overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/40 sticky top-0">
                                        <tr className="border-b text-left">
                                            <th className="px-4 py-3 font-medium">Rental</th>
                                            <th className="px-4 py-3 font-medium">Customer</th>
                                            <th className="px-4 py-3 font-medium">Jadwal</th>
                                            <th className="px-4 py-3 font-medium">Nilai</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                            <th className="px-4 py-3 font-medium">Admin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rentals.length > 0 ? (
                                            rentals.map((rental) => (
                                                <tr key={rental.id} className="border-b align-top">
                                                    <td className="px-4 py-3">
                                                        <Link href={route('admin.rentals.show', rental.id)} className="font-medium underline-offset-4 hover:underline">
                                                            {rental.rental_no}
                                                        </Link>
                                                        <p className="text-muted-foreground mt-1 text-xs">{rental.items_count} item</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">{rental.customer_name ?? '-'}</p>
                                                        <p className="text-muted-foreground mt-1 text-xs">{rental.customer_phone ?? '-'}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p>{formatDateTime(rental.starts_at)}</p>
                                                        <p className="text-muted-foreground mt-1 text-xs">Kembali: {formatDateTime(rental.due_at)}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">{formatCurrency(rental.total_amount)}</p>
                                                        <p className="text-muted-foreground mt-1 text-xs">Dibayar {formatCurrency(rental.paid_amount)}</p>
                                                        <p className="text-muted-foreground text-xs">Sisa {formatCurrency(rental.remaining_amount)}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap gap-2">
                                                            <Badge variant="outline">{rental.rental_status_label}</Badge>
                                                            <Badge variant={rental.remaining_amount === '0' ? 'default' : 'secondary'}>{rental.payment_status_label}</Badge>
                                                            {rental.is_overdue && <Badge variant="destructive">Overdue</Badge>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">{rental.admin_name ?? '-'}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="text-muted-foreground px-4 py-6 text-center">
                                                    Belum ada transaksi penyewaan yang cocok dengan filter ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <p className="text-muted-foreground text-sm">
                                Menampilkan {rentalPagination.from ?? 0} - {rentalPagination.to ?? 0} dari {rentalPagination.total} transaksi.
                            </p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => goToPage(rentalPagination.current_page - 1)} disabled={rentalPagination.current_page <= 1}>
                                    <ChevronLeft className="mr-1 h-4 w-4" />
                                    Prev
                                </Button>
                                {paginationPages.map((page) => (
                                    <Button key={page} variant={page === rentalPagination.current_page ? 'default' : 'outline'} size="sm" onClick={() => goToPage(page)}>
                                        {page}
                                    </Button>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => goToPage(rentalPagination.current_page + 1)}
                                    disabled={rentalPagination.current_page >= rentalPagination.last_page}
                                >
                                    Next
                                    <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <Card className="rounded-3xl">
                        <CardHeader>
                            <CardTitle>Jatuh Tempo & Keterlambatan</CardTitle>
                            <CardDescription>Monitor rental aktif yang harus segera di-follow up ke customer.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">Aktif</p><p className="mt-2 text-xl font-semibold">{dueSummary.active_rentals}</p></div>
                                <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">Hari Ini</p><p className="mt-2 text-xl font-semibold">{dueSummary.due_today}</p></div>
                                <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">Besok</p><p className="mt-2 text-xl font-semibold">{dueSummary.due_tomorrow}</p></div>
                                <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">Overdue</p><p className="mt-2 text-xl font-semibold">{dueSummary.overdue}</p></div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border">
                                <div className="max-h-[26rem] overflow-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-muted/40 sticky top-0">
                                            <tr className="border-b text-left">
                                                <th className="px-4 py-3 font-medium">Rental</th>
                                                <th className="px-4 py-3 font-medium">Customer</th>
                                                <th className="px-4 py-3 font-medium">Deadline</th>
                                                <th className="px-4 py-3 font-medium">Sisa Tagihan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dueItems.length > 0 ? (
                                                dueItems.map((item) => (
                                                    <tr key={item.id} className="border-b align-top">
                                                        <td className="px-4 py-3">
                                                            <Link href={route('admin.rentals.show', item.id)} className="font-medium underline-offset-4 hover:underline">
                                                                {item.rental_no}
                                                            </Link>
                                                            <p className="text-muted-foreground mt-1 text-xs">{item.items_count} item • {item.rental_status_label}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium">{item.customer_name ?? '-'}</p>
                                                            <p className="text-muted-foreground mt-1 text-xs">{item.customer_phone ?? '-'}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p>{formatDateTime(item.due_at)}</p>
                                                            <div className="mt-2">
                                                                <Badge variant={item.is_overdue ? 'destructive' : 'outline'}>{item.due_label}</Badge>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">{formatCurrency(item.remaining_amount)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                                                        Tidak ada rental aktif yang cocok dengan fokus jatuh tempo saat ini.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
