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
    transaction_type: string;
    per_page: number;
}

interface OptionItem {
    value: string;
    label: string;
}

interface ReportSummary {
    transactions_total: number;
    combined_total: number;
    rental_total: number;
    sale_total: number;
    manual_income_total: number;
    grand_total_amount: number;
    paid_total_amount: number;
    remaining_total_amount: number;
}

interface ReportItem {
    id: string;
    source_type: string;
    source_label: string;
    reference_no: string;
    occurred_at: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    items_count: number;
    summary: string;
    rental_total: string;
    sale_total: string;
    total_amount: string;
    paid_amount: string;
    remaining_amount: string;
    payment_status_label: string;
    payment_method_label: string;
    admin_name: string | null;
    detail_url: string | null;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan Keuangan', href: '/admin/reports/financial' },
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

export default function CombinedReportsIndex({
    combinedReportFilters,
    transactionTypeOptions,
    reportSummary,
    transactions,
    transactionPagination,
}: {
    combinedReportFilters: ReportFilters;
    transactionTypeOptions: OptionItem[];
    reportSummary: ReportSummary;
    transactions: ReportItem[];
    transactionPagination: PaginationMeta;
}) {
    const { flash } = usePage<SharedData>().props;

    const filterForm = useForm({
        search: combinedReportFilters.search,
        date_from: combinedReportFilters.date_from,
        date_to: combinedReportFilters.date_to,
        transaction_type: combinedReportFilters.transaction_type,
        per_page: String(combinedReportFilters.per_page),
    });

    useEffect(() => {
        filterForm.setData({
            search: combinedReportFilters.search,
            date_from: combinedReportFilters.date_from,
            date_to: combinedReportFilters.date_to,
            transaction_type: combinedReportFilters.transaction_type,
            per_page: String(combinedReportFilters.per_page),
        });
    }, [
        combinedReportFilters.date_from,
        combinedReportFilters.date_to,
        combinedReportFilters.per_page,
        combinedReportFilters.search,
        combinedReportFilters.transaction_type,
    ]);

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.financial-reports.index'),
            {
                search: filterForm.data.search || undefined,
                date_from: filterForm.data.date_from || undefined,
                date_to: filterForm.data.date_to || undefined,
                transaction_type: filterForm.data.transaction_type || undefined,
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
            date_from: combinedReportFilters.date_from,
            date_to: combinedReportFilters.date_to,
            transaction_type: 'all',
            per_page: '10',
        });

        router.get(
            route('admin.financial-reports.index'),
            {
                date_from: combinedReportFilters.date_from,
                date_to: combinedReportFilters.date_to,
                transaction_type: 'all',
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
            route('admin.financial-reports.index'),
            {
                search: combinedReportFilters.search || undefined,
                date_from: combinedReportFilters.date_from,
                date_to: combinedReportFilters.date_to,
                transaction_type: combinedReportFilters.transaction_type || undefined,
                per_page: combinedReportFilters.per_page,
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
        if (transactionPagination.last_page <= 1) {
            return [1];
        }

        const pages = new Set<number>([1, transactionPagination.last_page]);

        for (let page = transactionPagination.current_page - 1; page <= transactionPagination.current_page + 1; page += 1) {
            if (page >= 1 && page <= transactionPagination.last_page) {
                pages.add(page);
            }
        }

        return Array.from(pages).sort((left, right) => left - right);
    }, [transactionPagination.current_page, transactionPagination.last_page]);

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Laporan Keuangan" />

            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Laporan Keuangan</h1>
                    <p className="text-muted-foreground text-sm">Ringkasan pemasukan dari penyewaan, penjualan, dan transaksi gabungan dalam satu periode.</p>
                </div>

                {flash.success && <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{flash.success}</div>}

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>Filter Laporan Keuangan</CardTitle>
                        <CardDescription>Atur periode dan jenis transaksi untuk membaca seluruh aktivitas bisnis dari satu halaman.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submitFilters} className="grid gap-4 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
                            <div className="grid gap-2 lg:col-span-1">
                                <Label htmlFor="search">Cari Transaksi / Customer / Item</Label>
                                <div className="relative">
                                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                    <Input
                                        id="search"
                                        value={filterForm.data.search}
                                        onChange={(event) => filterForm.setData('search', event.target.value)}
                                        placeholder="No transaksi, customer, atau item"
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
                                <Label htmlFor="transaction-type">Jenis Transaksi</Label>
                                <Select value={filterForm.data.transaction_type || 'all'} onValueChange={(value) => filterForm.setData('transaction_type', value === 'all' ? '' : value)}>
                                    <SelectTrigger id="transaction-type">
                                        <SelectValue placeholder="Semua transaksi" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {transactionTypeOptions.map((option) => (
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
                    <SummaryCard label="Total Transaksi" value={reportSummary.transactions_total} description="Semua transaksi yang lolos filter periode dan jenis transaksi." />
                    <SummaryCard label="Transaksi Gabungan" value={reportSummary.combined_total} description="Nota gabungan rental dan penjualan." />
                    <SummaryCard label="Transaksi Sewa" value={reportSummary.rental_total} description="Transaksi rental yang masih berdiri sendiri." />
                    <SummaryCard label="Transaksi Jual" value={reportSummary.sale_total} description="Transaksi penjualan yang masih berdiri sendiri." />
                    <SummaryCard label="Pemasukan Manual" value={reportSummary.manual_income_total} description="Pemasukan yang dicatat di luar master sewa atau jual." />
                    <SummaryCard label="Omzet Total" value={formatCurrency(reportSummary.grand_total_amount)} description="Akumulasi total akhir dari seluruh transaksi terfilter." />
                    <SummaryCard label="Sisa Piutang" value={formatCurrency(reportSummary.remaining_total_amount)} description="Total sisa pembayaran yang belum lunas." />
                </div>

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>Daftar Transaksi Keuangan</CardTitle>
                        <CardDescription>Lihat seluruh transaksi pemasukan dari sewa, jual, dan transaksi gabungan dalam satu tabel.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border p-4">
                                <p className="text-muted-foreground text-xs uppercase tracking-wide">Baris Tampil</p>
                                <p className="mt-2 text-xl font-semibold">
                                    {transactionPagination.from ?? 0}-{transactionPagination.to ?? 0}
                                </p>
                            </div>
                            <div className="rounded-2xl border p-4">
                                <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Data</p>
                                <p className="mt-2 text-xl font-semibold">{transactionPagination.total}</p>
                            </div>
                            <div className="rounded-2xl border p-4">
                                <p className="text-muted-foreground text-xs uppercase tracking-wide">Per Halaman</p>
                                <p className="mt-2 text-xl font-semibold">{transactionPagination.per_page}</p>
                            </div>
                            <div className="rounded-2xl border p-4">
                                <p className="text-muted-foreground text-xs uppercase tracking-wide">Dibayar</p>
                                <p className="mt-2 text-xl font-semibold">{formatCurrency(reportSummary.paid_total_amount)}</p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border">
                            <div className="max-h-[32rem] overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/40 sticky top-0">
                                        <tr className="border-b text-left">
                                            <th className="px-4 py-3 font-medium">Jenis</th>
                                            <th className="px-4 py-3 font-medium">Referensi</th>
                                            <th className="px-4 py-3 font-medium">Waktu</th>
                                            <th className="px-4 py-3 font-medium">Customer</th>
                                            <th className="px-4 py-3 font-medium">Ringkasan</th>
                                            <th className="px-4 py-3 font-medium">Sewa</th>
                                            <th className="px-4 py-3 font-medium">Jual</th>
                                            <th className="px-4 py-3 font-medium">Total</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                            <th className="px-4 py-3 font-medium text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.length > 0 ? (
                                            transactions.map((transaction) => (
                                                <tr key={transaction.id} className="border-b align-top">
                                                    <td className="px-4 py-3">
                                                        <Badge variant={badgeVariantForSource(transaction.source_type)}>{transaction.source_label}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">{transaction.reference_no}</p>
                                                        <p className="text-muted-foreground mt-1 text-xs">{transaction.items_count} item</p>
                                                    </td>
                                                    <td className="px-4 py-3">{formatDateTime(transaction.occurred_at)}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">{transaction.customer_name ?? '-'}</p>
                                                        <p className="text-muted-foreground mt-1 text-xs">{transaction.customer_phone ?? '-'}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p>{transaction.summary}</p>
                                                        <p className="text-muted-foreground mt-1 text-xs">Admin: {transaction.admin_name ?? '-'}</p>
                                                    </td>
                                                    <td className="px-4 py-3">{formatCurrency(transaction.rental_total)}</td>
                                                    <td className="px-4 py-3">{formatCurrency(transaction.sale_total)}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold">{formatCurrency(transaction.total_amount)}</p>
                                                        <p className="text-muted-foreground mt-1 text-xs">Dibayar {formatCurrency(transaction.paid_amount)}</p>
                                                        <p className="text-muted-foreground text-xs">Sisa {formatCurrency(transaction.remaining_amount)}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={badgeVariantForStatus(transaction.payment_status_label)}>{transaction.payment_status_label}</Badge>
                                                        <p className="text-muted-foreground mt-1 text-xs">{transaction.payment_method_label}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {transaction.detail_url ? (
                                                            <Button asChild size="sm" variant="outline">
                                                                <Link href={transaction.detail_url}>Buka Detail</Link>
                                                            </Button>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">Belum ada detail</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={10} className="text-muted-foreground px-4 py-6 text-center">
                                                    Belum ada transaksi keuangan pada periode ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
                            <p className="text-muted-foreground text-sm">
                                Menampilkan {transactionPagination.from ?? 0}-{transactionPagination.to ?? 0} dari {transactionPagination.total} transaksi.
                            </p>

                            <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => goToPage(transactionPagination.current_page - 1)} disabled={transactionPagination.current_page <= 1}>
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Prev
                                </Button>

                                <div className="hidden items-center gap-2 md:flex">
                                    {paginationPages.map((page) => (
                                        <Button
                                            key={page}
                                            type="button"
                                            size="sm"
                                            variant={page === transactionPagination.current_page ? 'default' : 'outline'}
                                            onClick={() => goToPage(page)}
                                        >
                                            {page}
                                        </Button>
                                    ))}
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => goToPage(transactionPagination.current_page + 1)}
                                    disabled={transactionPagination.current_page >= transactionPagination.last_page}
                                >
                                    Next
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

function SummaryCard({ label, value, description }: { label: string; value: string | number; description: string }) {
    return (
        <Card className="rounded-3xl">
            <CardContent className="p-5">
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
                <p className="text-muted-foreground mt-2 text-xs">{description}</p>
            </CardContent>
        </Card>
    );
}

function badgeVariantForSource(sourceType: string): 'default' | 'secondary' | 'outline' {
    if (sourceType === 'combined') {
        return 'default';
    }

    if (sourceType === 'sale' || sourceType === 'manual_income') {
        return 'secondary';
    }

    return 'outline';
}

function badgeVariantForStatus(statusLabel: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (statusLabel === 'Lunas') {
        return 'default';
    }

    if (statusLabel === 'Dibayar Sebagian') {
        return 'secondary';
    }

    if (statusLabel === 'Belum Dibayar') {
        return 'destructive';
    }

    return 'outline';
}
