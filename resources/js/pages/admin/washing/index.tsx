import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Bath, CheckCheck, ChevronLeft, ChevronRight, LoaderCircle, Search, Sparkles, X } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface DirtyUnitItem {
    id: number;
    product_name: string | null;
    unit_code: string;
    notes: string | null;
}

interface Option {
    value: string;
    label: string;
}

interface WashingFilters {
    search: string;
    product: string;
    per_page: number;
}

interface WashingPagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface WashingSummary {
    total_dirty_units: number;
    filtered_dirty_units: number;
    products_with_dirty_units: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Proses Cuci', href: '/admin/washing' },
];

export default function WashingIndex({
    dirtyUnits,
    washingFilters,
    washingPagination,
    washingSummary,
    productOptions,
}: {
    dirtyUnits: DirtyUnitItem[];
    washingFilters: WashingFilters;
    washingPagination: WashingPagination;
    washingSummary: WashingSummary;
    productOptions: Option[];
}) {
    const { flash } = usePage<SharedData>().props;
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const filterForm = useForm({
        search: washingFilters.search,
        product: washingFilters.product,
        per_page: String(washingFilters.per_page),
    });

    const cleaningForm = useForm<{
        unit_ids: number[];
    }>({
        unit_ids: [],
    });

    useEffect(() => {
        filterForm.setData({
            search: washingFilters.search,
            product: washingFilters.product,
            per_page: String(washingFilters.per_page),
        });
    }, [washingFilters.per_page, washingFilters.product, washingFilters.search]);

    useEffect(() => {
        setSelectedIds([]);
        cleaningForm.setData('unit_ids', []);
        cleaningForm.clearErrors();
    }, [dirtyUnits]);

    const selectedCount = selectedIds.length;
    const allCurrentPageSelected = dirtyUnits.length > 0 && dirtyUnits.every((unit) => selectedIds.includes(unit.id));

    const paginationPages = useMemo(() => {
        if (washingPagination.last_page <= 1) {
            return [1];
        }

        const start = Math.max(1, washingPagination.current_page - 2);
        const end = Math.min(washingPagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);

        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [washingPagination.current_page, washingPagination.last_page]);

    const toggleUnit = (unitId: number, checked: boolean) => {
        setSelectedIds((current) => {
            const nextSelectedIds = checked ? Array.from(new Set([...current, unitId])) : current.filter((id) => id !== unitId);

            cleaningForm.setData('unit_ids', nextSelectedIds);

            return nextSelectedIds;
        });
    };

    const toggleCurrentPage = () => {
        const nextSelectedIds = allCurrentPageSelected ? [] : dirtyUnits.map((unit) => unit.id);

        setSelectedIds(nextSelectedIds);
        cleaningForm.setData('unit_ids', nextSelectedIds);
    };

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.washing.index'),
            {
                search: filterForm.data.search || undefined,
                product: filterForm.data.product || undefined,
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
            product: '',
            per_page: '15',
        });

        router.get(
            route('admin.washing.index'),
            { per_page: 15 },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const goToPage = (page: number) => {
        router.get(
            route('admin.washing.index'),
            {
                search: washingFilters.search || undefined,
                product: washingFilters.product || undefined,
                per_page: washingFilters.per_page,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const submitCleaning: FormEventHandler = (event) => {
        event.preventDefault();

        cleaningForm.post(route('admin.washing.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setSelectedIds([]);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Proses Cuci" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Operasional kebersihan stok</p>
                    <h1 className="mt-2 text-2xl font-semibold">Proses Cuci</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Pilih beberapa unit dengan status <span className="font-medium">Ready Belum Dicuci</span>, lalu tandai sekaligus setelah proses cuci selesai.
                    </p>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Proses cuci tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Belum Dicuci</p>
                        <p className="mt-2 text-2xl font-semibold">{washingSummary.total_dirty_units}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Hasil Filter</p>
                        <p className="mt-2 text-2xl font-semibold">{washingSummary.filtered_dirty_units}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Produk Terdampak</p>
                        <p className="mt-2 text-2xl font-semibold">{washingSummary.products_with_dirty_units}</p>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.92fr_1.4fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Filter Antrian Cuci</CardTitle>
                            <CardDescription>Fokuskan daftar unit berdasarkan produk atau kata kunci kode unit.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <form onSubmit={submitFilters} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="washing-search">Cari Unit / Produk</Label>
                                    <div className="relative">
                                        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                        <Input
                                            id="washing-search"
                                            value={filterForm.data.search}
                                            onChange={(event) => filterForm.setData('search', event.target.value)}
                                            className="pl-9"
                                            placeholder="Contoh: TND4P-001"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="washing-product">Filter Produk</Label>
                                    <Select value={filterForm.data.product || 'all'} onValueChange={(value) => filterForm.setData('product', value === 'all' ? '' : value)}>
                                        <SelectTrigger id="washing-product">
                                            <SelectValue placeholder="Semua produk" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua produk</SelectItem>
                                            {productOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="washing-per-page">Baris / Halaman</Label>
                                    <Select value={filterForm.data.per_page} onValueChange={(value) => filterForm.setData('per_page', value)}>
                                        <SelectTrigger id="washing-per-page">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[10, 15, 25, 50].map((option) => (
                                                <SelectItem key={option} value={String(option)}>
                                                    {option} baris
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <Button type="submit">Terapkan Filter</Button>
                                    <Button type="button" variant="outline" onClick={resetFilters}>
                                        <X className="mr-2 h-4 w-4" />
                                        Reset
                                    </Button>
                                </div>
                            </form>

                            <div className="rounded-2xl border border-dashed p-4 text-sm">
                                <div className="flex items-start gap-3">
                                    <Sparkles className="mt-0.5 h-4 w-4" />
                                    <div>
                                        <p className="font-medium">Saran operasional</p>
                                        <p className="text-muted-foreground mt-1 leading-6">
                                            Gunakan halaman ini setelah sesi cuci selesai agar admin tidak perlu mengubah status unit satu-satu dari menu inventaris.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <CardTitle>Antrian Unit Belum Dicuci</CardTitle>
                                    <CardDescription>
                                        Centang beberapa unit lalu klik <span className="font-medium">Tandai Sudah Dicuci</span>.
                                    </CardDescription>
                                </div>
                                <div className="text-muted-foreground text-sm">
                                    {washingPagination.total > 0
                                        ? `Menampilkan ${washingPagination.from}-${washingPagination.to} dari ${washingPagination.total} unit`
                                        : 'Belum ada unit yang menunggu cuci'}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <form onSubmit={submitCleaning} className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
                                    <div className="space-y-1">
                                        <p className="font-medium">Pilihan saat ini</p>
                                        <p className="text-muted-foreground text-sm">{selectedCount} unit dipilih untuk ditandai siap sewa kembali.</p>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <Button type="button" variant="outline" onClick={toggleCurrentPage} disabled={dirtyUnits.length === 0}>
                                            <CheckCheck className="mr-2 h-4 w-4" />
                                            {allCurrentPageSelected ? 'Batal Pilih Halaman Ini' : 'Pilih Halaman Ini'}
                                        </Button>
                                        <Button type="submit" disabled={selectedCount === 0 || cleaningForm.processing}>
                                            {cleaningForm.processing ? (
                                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Bath className="mr-2 h-4 w-4" />
                                            )}
                                            Tandai Sudah Dicuci
                                        </Button>
                                    </div>
                                </div>

                                <InputError message={cleaningForm.errors.unit_ids} />

                                <div className="overflow-hidden rounded-2xl border">
                                    <div className="max-h-[32rem] overflow-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/40 sticky top-0">
                                                <tr className="border-b text-left">
                                                    <th className="w-14 px-4 py-3">
                                                        <span className="sr-only">Pilih</span>
                                                    </th>
                                                    <th className="px-4 py-3 font-medium">Kode Unit</th>
                                                    <th className="px-4 py-3 font-medium">Produk</th>
                                                    <th className="px-4 py-3 font-medium">Catatan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dirtyUnits.length > 0 ? (
                                                    dirtyUnits.map((unit) => (
                                                        <tr key={unit.id} className="border-b align-top last:border-b-0">
                                                            <td className="px-4 py-3">
                                                                <Checkbox
                                                                    checked={selectedIds.includes(unit.id)}
                                                                    onCheckedChange={(checked) => toggleUnit(unit.id, checked === true)}
                                                                    aria-label={`Pilih ${unit.unit_code}`}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 font-medium">{unit.unit_code}</td>
                                                            <td className="px-4 py-3">{unit.product_name ?? '-'}</td>
                                                            <td className="text-muted-foreground px-4 py-3">{unit.notes || '-'}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={4} className="text-muted-foreground px-4 py-10 text-center">
                                                            Semua unit sudah bersih. Belum ada antrian cuci saat ini.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </form>

                            {washingPagination.last_page > 1 && (
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-muted-foreground text-sm">
                                        Halaman {washingPagination.current_page} dari {washingPagination.last_page}
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            disabled={washingPagination.current_page <= 1}
                                            onClick={() => goToPage(washingPagination.current_page - 1)}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>

                                        {paginationPages.map((page) => (
                                            <Button
                                                key={page}
                                                type="button"
                                                variant={page === washingPagination.current_page ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => goToPage(page)}
                                            >
                                                {page}
                                            </Button>
                                        ))}

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            disabled={washingPagination.current_page >= washingPagination.last_page}
                                            onClick={() => goToPage(washingPagination.current_page + 1)}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
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
