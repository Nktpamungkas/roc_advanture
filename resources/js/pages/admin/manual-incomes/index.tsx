import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, CircleDollarSign, LoaderCircle, Search, X } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo } from 'react';

interface ManualIncomeItem {
    id: number;
    income_no: string;
    recorded_at: string | null;
    category: string;
    category_label: string;
    title: string;
    amount: string;
    notes: string | null;
    recorder_name: string | null;
}

interface OptionItem {
    value: string;
    label: string;
}

interface Filters {
    search: string;
    category: string;
    per_page: number;
}

interface Pagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface Summary {
    total_entries: number;
    total_amount: number;
    filtered_entries: number;
    filtered_amount: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pemasukan Manual', href: '/admin/manual-incomes' },
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

export default function ManualIncomesIndex({
    manualIncomes,
    manualIncomeFilters,
    manualIncomePagination,
    manualIncomeSummary,
    categoryOptions,
    defaultRecordedAt,
}: {
    manualIncomes: ManualIncomeItem[];
    manualIncomeFilters: Filters;
    manualIncomePagination: Pagination;
    manualIncomeSummary: Summary;
    categoryOptions: OptionItem[];
    defaultRecordedAt: string;
}) {
    const { flash } = usePage<SharedData>().props;

    const createForm = useForm({
        recorded_at: defaultRecordedAt,
        category: categoryOptions[0]?.value ?? '',
        title: '',
        amount: '',
        notes: '',
    });

    const filterForm = useForm({
        search: manualIncomeFilters.search,
        category: manualIncomeFilters.category,
        per_page: String(manualIncomeFilters.per_page),
    });

    useEffect(() => {
        filterForm.setData({
            search: manualIncomeFilters.search,
            category: manualIncomeFilters.category,
            per_page: String(manualIncomeFilters.per_page),
        });
    }, [manualIncomeFilters.category, manualIncomeFilters.per_page, manualIncomeFilters.search]);

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();

        createForm.post(route('admin.manual-incomes.store'), {
            preserveScroll: true,
            onSuccess: () =>
                createForm.reset(
                    'title',
                    'amount',
                    'notes',
                ),
        });
    };

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.manual-incomes.index'),
            {
                search: filterForm.data.search || undefined,
                category: filterForm.data.category || undefined,
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
            category: '',
            per_page: '10',
        });

        router.get(
            route('admin.manual-incomes.index'),
            {
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
            route('admin.manual-incomes.index'),
            {
                search: manualIncomeFilters.search || undefined,
                category: manualIncomeFilters.category || undefined,
                per_page: manualIncomeFilters.per_page,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const pages = useMemo(() => {
        if (manualIncomePagination.last_page <= 1) return [1];
        const start = Math.max(1, manualIncomePagination.current_page - 2);
        const end = Math.min(manualIncomePagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);

        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [manualIncomePagination.current_page, manualIncomePagination.last_page]);

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pemasukan Manual" />

            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground text-sm">Operasional umum</p>
                    <h1 className="text-2xl font-semibold tracking-tight">Pemasukan Manual</h1>
                    <p className="text-muted-foreground text-sm">Catat pemasukan di luar master penyewaan atau penjualan agar tetap masuk ke laporan keuangan.</p>
                </div>

                {flash.success && (
                    <Alert className="border-green-200 bg-green-50 text-green-700">
                        <AlertTitle>Berhasil</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard label="Total Catatan" value={manualIncomeSummary.total_entries} description="Semua pemasukan manual yang pernah dicatat." />
                    <SummaryCard label="Nominal Total" value={formatCurrency(manualIncomeSummary.total_amount)} description="Akumulasi seluruh pemasukan manual." />
                    <SummaryCard label="Hasil Filter" value={manualIncomeSummary.filtered_entries} description="Jumlah data yang tampil sesuai filter aktif." />
                    <SummaryCard label="Nominal Filter" value={formatCurrency(manualIncomeSummary.filtered_amount)} description="Akumulasi nominal data yang sedang tampil." />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
                    <Card className="rounded-3xl">
                        <CardHeader>
                            <CardTitle>Catat Pemasukan</CardTitle>
                            <CardDescription>Gunakan untuk sewa barang non-master, penjualan non-master, atau pemasukan lain yang tetap ingin masuk laporan keuangan.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitCreate} className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="recorded_at">Waktu Masuk</Label>
                                        <Input
                                            id="recorded_at"
                                            type="datetime-local"
                                            value={createForm.data.recorded_at}
                                            onChange={(event) => createForm.setData('recorded_at', event.target.value)}
                                        />
                                        <InputError message={createForm.errors.recorded_at} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="category">Kategori</Label>
                                        <Select value={createForm.data.category} onValueChange={(value) => createForm.setData('category', value)}>
                                            <SelectTrigger id="category">
                                                <SelectValue placeholder="Pilih kategori" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categoryOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={createForm.errors.category} />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="title">Judul / Sumber</Label>
                                    <Input
                                        id="title"
                                        value={createForm.data.title}
                                        onChange={(event) => createForm.setData('title', event.target.value)}
                                        placeholder="Contoh: Sewa headlamp pribadi"
                                    />
                                    <InputError message={createForm.errors.title} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="amount">Nominal</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        min="1"
                                        step="1000"
                                        value={createForm.data.amount}
                                        onChange={(event) => createForm.setData('amount', event.target.value)}
                                        placeholder="50000"
                                    />
                                    <InputError message={createForm.errors.amount} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="notes">Catatan</Label>
                                    <Textarea
                                        id="notes"
                                        value={createForm.data.notes}
                                        onChange={(event) => createForm.setData('notes', event.target.value)}
                                        placeholder="Contoh: Barang milik pribadi pemilik, tidak masuk master rental."
                                        rows={4}
                                    />
                                    <InputError message={createForm.errors.notes} />
                                </div>

                                <Button type="submit" disabled={createForm.processing}>
                                    {createForm.processing && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan Pemasukan
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl">
                        <CardHeader>
                            <CardTitle>Riwayat Pemasukan Manual</CardTitle>
                            <CardDescription>Lihat catatan pemasukan manual yang sudah masuk dan pastikan semuanya ikut terbaca di laporan keuangan.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <form onSubmit={submitFilters} className="grid gap-4 md:grid-cols-[1.4fr_1fr_140px]">
                                <div className="grid gap-2">
                                    <Label htmlFor="search">Cari Catatan</Label>
                                    <div className="relative">
                                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                        <Input
                                            id="search"
                                            value={filterForm.data.search}
                                            onChange={(event) => filterForm.setData('search', event.target.value)}
                                            placeholder="Nomor, judul, atau catatan"
                                            className="pl-9"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="category-filter">Kategori</Label>
                                    <Select value={filterForm.data.category || 'all'} onValueChange={(value) => filterForm.setData('category', value === 'all' ? '' : value)}>
                                        <SelectTrigger id="category-filter">
                                            <SelectValue placeholder="Semua kategori" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua kategori</SelectItem>
                                            {categoryOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="per-page">Baris</Label>
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

                                <div className="flex flex-wrap items-end justify-end gap-3 md:col-span-3">
                                    <Button type="button" variant="outline" onClick={resetFilters}>
                                        <X className="mr-2 h-4 w-4" />
                                        Reset
                                    </Button>
                                    <Button type="submit">Terapkan</Button>
                                </div>
                            </form>

                            <div className="overflow-hidden rounded-2xl border">
                                <div className="max-h-[34rem] overflow-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-muted/40 sticky top-0">
                                            <tr className="border-b text-left">
                                                <th className="px-4 py-3 font-medium">Nomor</th>
                                                <th className="px-4 py-3 font-medium">Waktu</th>
                                                <th className="px-4 py-3 font-medium">Kategori</th>
                                                <th className="px-4 py-3 font-medium">Judul</th>
                                                <th className="px-4 py-3 font-medium">Nominal</th>
                                                <th className="px-4 py-3 font-medium">Admin</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {manualIncomes.length > 0 ? (
                                                manualIncomes.map((income) => (
                                                    <tr key={income.id} className="border-b align-top">
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium">{income.income_no}</p>
                                                        </td>
                                                        <td className="px-4 py-3">{formatDateTime(income.recorded_at)}</td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant={badgeVariantForCategory(income.category)}>{income.category_label}</Badge>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium">{income.title}</p>
                                                            <p className="text-muted-foreground mt-1 text-xs">{income.notes || '-'}</p>
                                                        </td>
                                                        <td className="px-4 py-3 font-semibold">{formatCurrency(income.amount)}</td>
                                                        <td className="px-4 py-3">{income.recorder_name ?? '-'}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="text-muted-foreground px-4 py-6 text-center">
                                                        Belum ada pemasukan manual yang tercatat.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
                                <p className="text-muted-foreground text-sm">
                                    Menampilkan {manualIncomePagination.from ?? 0}-{manualIncomePagination.to ?? 0} dari {manualIncomePagination.total} catatan.
                                </p>

                                <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => goToPage(manualIncomePagination.current_page - 1)} disabled={manualIncomePagination.current_page <= 1}>
                                        <ChevronLeft className="mr-2 h-4 w-4" />
                                        Prev
                                    </Button>

                                    <div className="hidden items-center gap-2 md:flex">
                                        {pages.map((page) => (
                                            <Button
                                                key={page}
                                                type="button"
                                                size="sm"
                                                variant={page === manualIncomePagination.current_page ? 'default' : 'outline'}
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
                                        onClick={() => goToPage(manualIncomePagination.current_page + 1)}
                                        disabled={manualIncomePagination.current_page >= manualIncomePagination.last_page}
                                    >
                                        Next
                                        <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

function SummaryCard({ label, value, description }: { label: string; value: string | number; description: string }) {
    return (
        <Card className="rounded-3xl">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-muted-foreground text-sm">{label}</p>
                        <p className="mt-2 text-2xl font-semibold">{value}</p>
                        <p className="text-muted-foreground mt-2 text-xs">{description}</p>
                    </div>
                    <CircleDollarSign className="text-muted-foreground h-5 w-5" />
                </div>
            </CardContent>
        </Card>
    );
}

function badgeVariantForCategory(category: string): 'default' | 'secondary' | 'outline' {
    if (category === 'rental_non_master') {
        return 'default';
    }

    if (category === 'sale_non_master') {
        return 'secondary';
    }

    return 'outline';
}
