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

interface SalesReportFilters {
    search: string;
    date_from: string;
    date_to: string;
    payment_method_config_id: string;
    per_page: number;
}

interface OptionItem {
    value: string;
    label: string;
}

interface ExportTarget {
    value: string;
    label: string;
}

interface SalesSummary {
    transactions_in_period: number;
    revenue_in_period: number;
    discount_in_period: number;
    items_sold_in_period: number;
    average_ticket: number;
    low_stock_count: number;
}

interface SalesReportItem {
    id: number;
    sale_no: string;
    sold_at: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    items_count: number;
    subtotal: string;
    discount_amount: string;
    total_amount: string;
    payment_method_name: string | null;
    sold_by_name: string | null;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface PaymentSummary {
    total_received: number;
    method_breakdown: Array<{
        label: string;
        transactions: number;
        total: number;
    }>;
}

interface TopProductSummary {
    total_product_rows: number;
    top_revenue: number;
    top_product_name: string | null;
}

interface TopProductItem {
    display_name: string;
    product_name: string;
    sku: string;
    transactions_count: number;
    qty_total: number;
    revenue_total: number;
}

interface LowStockProductItem {
    id: number;
    sku: string;
    name: string;
    category: string | null;
    stock_qty: number;
    min_stock_qty: number;
    selling_price: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan Penjualan', href: '/admin/reports/sales' },
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

export default function SalesReportsIndex({
    salesReportFilters,
    paymentMethodOptions,
    exportTargets,
    salesSummary,
    sales,
    salesPagination,
    paymentSummary,
    topProductSummary,
    topProducts,
    lowStockProducts,
}: {
    salesReportFilters: SalesReportFilters;
    paymentMethodOptions: OptionItem[];
    exportTargets: ExportTarget[];
    salesSummary: SalesSummary;
    sales: SalesReportItem[];
    salesPagination: PaginationMeta;
    paymentSummary: PaymentSummary;
    topProductSummary: TopProductSummary;
    topProducts: TopProductItem[];
    lowStockProducts: LowStockProductItem[];
}) {
    const { flash } = usePage<SharedData>().props;

    const filterForm = useForm({
        search: salesReportFilters.search,
        date_from: salesReportFilters.date_from,
        date_to: salesReportFilters.date_to,
        payment_method_config_id: salesReportFilters.payment_method_config_id,
        per_page: String(salesReportFilters.per_page),
    });

    useEffect(() => {
        filterForm.setData({
            search: salesReportFilters.search,
            date_from: salesReportFilters.date_from,
            date_to: salesReportFilters.date_to,
            payment_method_config_id: salesReportFilters.payment_method_config_id,
            per_page: String(salesReportFilters.per_page),
        });
    }, [
        salesReportFilters.date_from,
        salesReportFilters.date_to,
        salesReportFilters.payment_method_config_id,
        salesReportFilters.per_page,
        salesReportFilters.search,
    ]);

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.sales-reports.index'),
            {
                search: filterForm.data.search || undefined,
                date_from: filterForm.data.date_from || undefined,
                date_to: filterForm.data.date_to || undefined,
                payment_method_config_id: filterForm.data.payment_method_config_id || undefined,
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
            date_from: salesReportFilters.date_from,
            date_to: salesReportFilters.date_to,
            payment_method_config_id: '',
            per_page: '10',
        });

        router.get(
            route('admin.sales-reports.index'),
            {
                date_from: salesReportFilters.date_from,
                date_to: salesReportFilters.date_to,
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
            route('admin.sales-reports.index'),
            {
                search: salesReportFilters.search || undefined,
                date_from: salesReportFilters.date_from,
                date_to: salesReportFilters.date_to,
                payment_method_config_id: salesReportFilters.payment_method_config_id || undefined,
                per_page: salesReportFilters.per_page,
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
        if (salesPagination.last_page <= 1) {
            return [1];
        }

        const pages = new Set<number>([1, salesPagination.last_page]);

        for (let page = salesPagination.current_page - 1; page <= salesPagination.current_page + 1; page += 1) {
            if (page >= 1 && page <= salesPagination.last_page) {
                pages.add(page);
            }
        }

        return Array.from(pages).sort((left, right) => left - right);
    }, [salesPagination.current_page, salesPagination.last_page]);

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');
    const buildExportUrl = (report: string, format: 'csv' | 'excel') =>
        route('admin.sales-reports.export', {
            report,
            format,
            search: salesReportFilters.search || undefined,
            date_from: salesReportFilters.date_from,
            date_to: salesReportFilters.date_to,
            payment_method_config_id: salesReportFilters.payment_method_config_id || undefined,
        });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Laporan Penjualan" />

            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Laporan Penjualan</h1>
                    <p className="text-muted-foreground text-sm">Laporan khusus jual-beli untuk memantau transaksi, omzet, produk terlaris, dan stok menipis.</p>
                </div>

                {flash.success && <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{flash.success}</div>}

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>Filter Laporan Penjualan</CardTitle>
                        <CardDescription>Atur periode, pencarian, dan metode pembayaran untuk membaca performa penjualan.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submitFilters} className="grid gap-4 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
                            <div className="grid gap-2 lg:col-span-1">
                                <Label htmlFor="search">Cari Penjualan / Customer / Produk</Label>
                                <div className="relative">
                                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                    <Input
                                        id="search"
                                        value={filterForm.data.search}
                                        onChange={(event) => filterForm.setData('search', event.target.value)}
                                        placeholder="No penjualan, customer, SKU, atau produk"
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
                                <Label htmlFor="payment-method">Metode Pembayaran</Label>
                                <Select
                                    value={filterForm.data.payment_method_config_id || 'all'}
                                    onValueChange={(value) => filterForm.setData('payment_method_config_id', value === 'all' ? '' : value)}
                                >
                                    <SelectTrigger id="payment-method">
                                        <SelectValue placeholder="Semua metode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua metode</SelectItem>
                                        {paymentMethodOptions.map((option) => (
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

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>Export Laporan Penjualan</CardTitle>
                        <CardDescription>Unduh transaksi, produk paling laku, atau stok menipis sesuai filter aktif.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {exportTargets.map((target) => (
                                <div key={target.value} className="rounded-2xl border p-4">
                                    <p className="font-medium">{target.label}</p>
                                    <div className="mt-3 flex gap-2">
                                        <Button asChild size="sm" variant="outline" className="flex-1">
                                            <a href={buildExportUrl(target.value, 'csv')}>CSV</a>
                                        </Button>
                                        <Button asChild size="sm" className="flex-1">
                                            <a href={buildExportUrl(target.value, 'excel')}>Excel</a>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <SummaryCard label="Transaksi" value={salesSummary.transactions_in_period} description="Total transaksi jual-beli pada periode aktif." />
                    <SummaryCard label="Omzet Bersih" value={formatCurrency(salesSummary.revenue_in_period)} description="Nominal akhir setelah diskon." />
                    <SummaryCard label="Total Diskon" value={formatCurrency(salesSummary.discount_in_period)} description="Akumulasi diskon penjualan periode ini." />
                    <SummaryCard label="Qty Terjual" value={salesSummary.items_sold_in_period} description="Total item keluar dari semua penjualan." />
                    <SummaryCard label="Stok Menipis" value={salesSummary.low_stock_count} description="Produk jual yang perlu segera direstok." />
                </div>

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>Transaksi Penjualan</CardTitle>
                        <CardDescription>Daftar transaksi penjualan pada periode aktif, lengkap dengan metode bayar dan invoice.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border p-4">
                                <p className="text-muted-foreground text-xs uppercase tracking-wide">Rata-rata Transaksi</p>
                                <p className="mt-2 text-xl font-semibold">{formatCurrency(salesSummary.average_ticket)}</p>
                            </div>
                            <div className="rounded-2xl border p-4">
                                <p className="text-muted-foreground text-xs uppercase tracking-wide">Baris Tampil</p>
                                <p className="mt-2 text-xl font-semibold">
                                    {salesPagination.from ?? 0}-{salesPagination.to ?? 0}
                                </p>
                            </div>
                            <div className="rounded-2xl border p-4">
                                <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Data</p>
                                <p className="mt-2 text-xl font-semibold">{salesPagination.total}</p>
                            </div>
                            <div className="rounded-2xl border p-4">
                                <p className="text-muted-foreground text-xs uppercase tracking-wide">Per Halaman</p>
                                <p className="mt-2 text-xl font-semibold">{salesPagination.per_page}</p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border">
                            <div className="max-h-[32rem] overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/40 sticky top-0">
                                        <tr className="border-b text-left">
                                            <th className="px-4 py-3 font-medium">No Penjualan</th>
                                            <th className="px-4 py-3 font-medium">Waktu</th>
                                            <th className="px-4 py-3 font-medium">Customer</th>
                                            <th className="px-4 py-3 font-medium">Ringkasan</th>
                                            <th className="px-4 py-3 font-medium">Pembayaran</th>
                                            <th className="px-4 py-3 font-medium">Kasir</th>
                                            <th className="px-4 py-3 font-medium text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sales.length > 0 ? (
                                            sales.map((sale) => (
                                                <tr key={sale.id} className="border-b align-top">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">{sale.sale_no}</p>
                                                    </td>
                                                    <td className="px-4 py-3">{formatDateTime(sale.sold_at)}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">{sale.customer_name || 'Penjualan Umum'}</p>
                                                        <p className="text-muted-foreground mt-1 text-xs">{sale.customer_phone || '-'}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">{sale.items_count} item</p>
                                                        <p className="text-muted-foreground mt-1 text-xs">
                                                            Subtotal {formatCurrency(sale.subtotal)} • Diskon {formatCurrency(sale.discount_amount)}
                                                        </p>
                                                        <p className="mt-1 text-sm font-semibold">{formatCurrency(sale.total_amount)}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">{sale.payment_method_name || '-'}</p>
                                                    </td>
                                                    <td className="px-4 py-3">{sale.sold_by_name || '-'}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button asChild size="sm" variant="outline">
                                                            <Link href={route('admin.sales.show', sale.id)}>Buka Invoice</Link>
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={7} className="text-muted-foreground px-4 py-6 text-center">
                                                    Belum ada transaksi penjualan pada periode ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
                            <p className="text-muted-foreground text-sm">
                                Menampilkan {salesPagination.from ?? 0}-{salesPagination.to ?? 0} dari {salesPagination.total} transaksi.
                            </p>

                            <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => goToPage(salesPagination.current_page - 1)} disabled={salesPagination.current_page <= 1}>
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Prev
                                </Button>

                                <div className="hidden items-center gap-2 md:flex">
                                    {paginationPages.map((page) => (
                                        <Button
                                            key={page}
                                            type="button"
                                            size="sm"
                                            variant={page === salesPagination.current_page ? 'default' : 'outline'}
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
                                    onClick={() => goToPage(salesPagination.current_page + 1)}
                                    disabled={salesPagination.current_page >= salesPagination.last_page}
                                >
                                    Next
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                    <Card className="rounded-3xl">
                        <CardHeader>
                            <CardTitle>Pembayaran Penjualan</CardTitle>
                            <CardDescription>Ringkasan omzet penjualan berdasarkan metode pembayaran pada periode aktif.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-2xl border p-4">
                                <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Masuk</p>
                                <p className="mt-2 text-2xl font-semibold">{formatCurrency(paymentSummary.total_received)}</p>
                            </div>

                            <div className="overflow-hidden rounded-2xl border">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/40">
                                        <tr className="border-b text-left">
                                            <th className="px-4 py-3 font-medium">Metode</th>
                                            <th className="px-4 py-3 font-medium">Transaksi</th>
                                            <th className="px-4 py-3 font-medium text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paymentSummary.method_breakdown.length > 0 ? (
                                            paymentSummary.method_breakdown.map((item) => (
                                                <tr key={item.label} className="border-b">
                                                    <td className="px-4 py-3">{item.label}</td>
                                                    <td className="px-4 py-3">{item.transactions}</td>
                                                    <td className="px-4 py-3 text-right">{formatCurrency(item.total)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={3} className="text-muted-foreground px-4 py-6 text-center">
                                                    Belum ada data pembayaran penjualan pada periode ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl">
                        <CardHeader>
                            <CardTitle>Produk Jual Paling Laku</CardTitle>
                            <CardDescription>Ranking produk jual berdasarkan omzet dan total qty terjual pada periode aktif.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Baris Produk</p>
                                    <p className="mt-2 text-xl font-semibold">{topProductSummary.total_product_rows}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Top Product</p>
                                    <p className="mt-2 text-lg font-semibold">{topProductSummary.top_product_name ?? '-'}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Top Revenue</p>
                                    <p className="mt-2 text-xl font-semibold">{formatCurrency(topProductSummary.top_revenue)}</p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border">
                                <div className="max-h-[28rem] overflow-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-muted/40 sticky top-0">
                                            <tr className="border-b text-left">
                                                <th className="px-4 py-3 font-medium">Produk</th>
                                                <th className="px-4 py-3 font-medium">Transaksi</th>
                                                <th className="px-4 py-3 font-medium">Qty</th>
                                                <th className="px-4 py-3 font-medium">Omzet</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topProducts.length > 0 ? (
                                                topProducts.map((item) => (
                                                    <tr key={item.display_name} className="border-b">
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium">{item.product_name}</p>
                                                            <p className="text-muted-foreground mt-1 text-xs">{item.sku}</p>
                                                        </td>
                                                        <td className="px-4 py-3">{item.transactions_count}</td>
                                                        <td className="px-4 py-3">{item.qty_total}</td>
                                                        <td className="px-4 py-3">{formatCurrency(item.revenue_total)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                                                        Belum ada data produk terjual pada periode ini.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>Stok Menipis</CardTitle>
                        <CardDescription>Monitor produk jual yang stoknya sudah menyentuh batas minimum atau sudah habis.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-hidden rounded-2xl border">
                            <div className="max-h-[28rem] overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/40 sticky top-0">
                                        <tr className="border-b text-left">
                                            <th className="px-4 py-3 font-medium">Produk</th>
                                            <th className="px-4 py-3 font-medium">Kategori</th>
                                            <th className="px-4 py-3 font-medium">Stok</th>
                                            <th className="px-4 py-3 font-medium">Minimum</th>
                                            <th className="px-4 py-3 font-medium">Harga Jual</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lowStockProducts.length > 0 ? (
                                            lowStockProducts.map((product) => (
                                                <tr key={product.id} className="border-b">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">{product.name}</p>
                                                        <p className="text-muted-foreground mt-1 text-xs">{product.sku}</p>
                                                    </td>
                                                    <td className="px-4 py-3">{product.category ?? '-'}</td>
                                                    <td className="px-4 py-3">{product.stock_qty}</td>
                                                    <td className="px-4 py-3">{product.min_stock_qty}</td>
                                                    <td className="px-4 py-3">{formatCurrency(product.selling_price)}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={product.stock_qty === 0 ? 'destructive' : 'secondary'}>
                                                            {product.stock_qty === 0 ? 'Habis' : 'Segera Restok'}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="text-muted-foreground px-4 py-6 text-center">
                                                    Belum ada produk jual yang masuk kategori stok menipis.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
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
