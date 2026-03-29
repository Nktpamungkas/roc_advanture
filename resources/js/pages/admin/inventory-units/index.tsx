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
import { ChevronLeft, ChevronRight, LoaderCircle, Search, X } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface InventoryUnitItem {
    id: number;
    product_id: number;
    product_name: string | null;
    unit_code: string;
    status: string;
    status_label: string;
    notes: string | null;
}

interface Option {
    value: string;
    label: string;
}

interface ProductOption extends Option {
    prefix_code: string | null;
    next_number: number;
}

interface InventoryUnitForm {
    product_id: string;
    unit_code: string;
    status: string;
    notes: string;
}

interface BulkGenerateForm {
    product_id: string;
    quantity: string;
    start_number: string;
    status: string;
    notes: string;
}

interface InventoryFilters {
    search: string;
    product: string;
    status: string;
    per_page: number;
}

interface InventoryPagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface InventorySummaryItem {
    value: string;
    label: string;
    count: number;
}

interface InventorySummary {
    total_units: number;
    total_products: number;
    filtered_units: number;
    statuses: InventorySummaryItem[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Unit Inventaris', href: '/admin/inventory-units' },
];

export default function InventoryUnitsIndex({
    inventoryUnits,
    inventoryFilters,
    inventoryPagination,
    inventorySummary,
    productOptions,
    statusOptions,
}: {
    inventoryUnits: InventoryUnitItem[];
    inventoryFilters: InventoryFilters;
    inventoryPagination: InventoryPagination;
    inventorySummary: InventorySummary;
    productOptions: ProductOption[];
    statusOptions: Option[];
}) {
    const { flash } = usePage<SharedData>().props;
    const [selectedUnitId, setSelectedUnitId] = useState<number | null>(inventoryUnits[0]?.id ?? null);

    const selectedUnit = useMemo(() => inventoryUnits.find((unit) => unit.id === selectedUnitId) ?? null, [inventoryUnits, selectedUnitId]);

    const createForm = useForm<InventoryUnitForm>({
        product_id: productOptions[0]?.value ?? '',
        unit_code: '',
        status: statusOptions[0]?.value ?? '',
        notes: '',
    });

    const bulkForm = useForm<BulkGenerateForm>({
        product_id: productOptions[0]?.value ?? '',
        quantity: '1',
        start_number: productOptions[0] ? String(productOptions[0].next_number) : '',
        status: statusOptions[0]?.value ?? '',
        notes: '',
    });

    const updateForm = useForm<InventoryUnitForm>({
        product_id: '',
        unit_code: '',
        status: '',
        notes: '',
    });

    const filterForm = useForm({
        search: inventoryFilters.search,
        product: inventoryFilters.product,
        status: inventoryFilters.status,
        per_page: String(inventoryFilters.per_page),
    });

    const selectedCreateProduct = useMemo(
        () => productOptions.find((product) => product.value === createForm.data.product_id) ?? null,
        [createForm.data.product_id, productOptions],
    );

    const selectedBulkProduct = useMemo(
        () => productOptions.find((product) => product.value === bulkForm.data.product_id) ?? null,
        [bulkForm.data.product_id, productOptions],
    );

    useEffect(() => {
        if (!selectedUnit) {
            updateForm.reset();
            return;
        }

        updateForm.setData({
            product_id: String(selectedUnit.product_id),
            unit_code: selectedUnit.unit_code,
            status: selectedUnit.status,
            notes: selectedUnit.notes ?? '',
        });
        updateForm.clearErrors();
    }, [selectedUnit]);

    useEffect(() => {
        if (inventoryUnits.some((unit) => unit.id === selectedUnitId)) {
            return;
        }

        setSelectedUnitId(inventoryUnits[0]?.id ?? null);
    }, [inventoryUnits, selectedUnitId]);

    useEffect(() => {
        filterForm.setData({
            search: inventoryFilters.search,
            product: inventoryFilters.product,
            status: inventoryFilters.status,
            per_page: String(inventoryFilters.per_page),
        });
    }, [inventoryFilters.per_page, inventoryFilters.product, inventoryFilters.search, inventoryFilters.status]);

    useEffect(() => {
        if (!selectedBulkProduct) {
            return;
        }

        bulkForm.setData('start_number', String(selectedBulkProduct.next_number));
    }, [selectedBulkProduct]);

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();

        createForm.post(route('admin.inventory-units.store'), {
            preserveScroll: true,
            onSuccess: () => createForm.reset('unit_code', 'notes'),
        });
    };

    const submitBulk: FormEventHandler = (event) => {
        event.preventDefault();

        bulkForm.post(route('admin.inventory-units.generate'), {
            preserveScroll: true,
            errorBag: 'generateInventoryUnits',
            onSuccess: () =>
                bulkForm.reset(
                    'quantity',
                    'notes',
                ),
        });
    };

    const submitUpdate: FormEventHandler = (event) => {
        event.preventDefault();

        if (!selectedUnit) {
            return;
        }

        updateForm.patch(route('admin.inventory-units.update', selectedUnit.id), {
            preserveScroll: true,
        });
    };

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.inventory-units.index'),
            {
                search: filterForm.data.search || undefined,
                product: filterForm.data.product || undefined,
                status: filterForm.data.status || undefined,
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
            status: '',
            per_page: '15',
        });

        router.get(
            route('admin.inventory-units.index'),
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
            route('admin.inventory-units.index'),
            {
                search: inventoryFilters.search || undefined,
                product: inventoryFilters.product || undefined,
                status: inventoryFilters.status || undefined,
                per_page: inventoryFilters.per_page,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const noProductsYet = productOptions.length === 0;
    const bulkStartNumber = Number(bulkForm.data.start_number || selectedBulkProduct?.next_number || 1);
    const bulkQuantity = Number(bulkForm.data.quantity || 0);
    const bulkPreviewEnd = bulkQuantity > 0 ? bulkStartNumber + bulkQuantity - 1 : bulkStartNumber;

    const previewCode = (sequence: number) => {
        if (!selectedBulkProduct?.prefix_code) {
            return '-';
        }

        return `${selectedBulkProduct.prefix_code}-${String(sequence).padStart(3, '0')}`;
    };

    const paginationPages = useMemo(() => {
        if (inventoryPagination.last_page <= 1) {
            return [1];
        }

        const start = Math.max(1, inventoryPagination.current_page - 2);
        const end = Math.min(inventoryPagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);

        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [inventoryPagination.current_page, inventoryPagination.last_page]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Unit Inventaris" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Tracking per unit fisik</p>
                    <h1 className="mt-2 text-2xl font-semibold">Unit Inventaris</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Setiap unit barang punya kode unik dan statusnya sendiri agar alur rental dan kebersihan stok bisa dipantau akurat.
                    </p>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Perubahan tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                {noProductsYet && (
                    <Alert>
                        <AlertTitle>Produk belum tersedia</AlertTitle>
                        <AlertDescription>Buat data produk dulu sebelum menambahkan unit inventaris.</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.05fr_1.45fr]">
                    <div className="grid gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Generate Unit Massal</CardTitle>
                                <CardDescription>Buat banyak unit sekaligus dari prefix produk supaya admin tidak perlu mengetik kode satu per satu.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form className="grid gap-4" onSubmit={submitBulk}>
                                    <div className="grid gap-2">
                                        <Label htmlFor="bulk-product">Produk</Label>
                                        <Select value={bulkForm.data.product_id} onValueChange={(value) => bulkForm.setData('product_id', value)} disabled={noProductsYet}>
                                            <SelectTrigger id="bulk-product">
                                                <SelectValue placeholder="Pilih produk" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {productOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={bulkForm.errors.product_id} />
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="bulk-prefix">Prefix</Label>
                                            <Input id="bulk-prefix" value={selectedBulkProduct?.prefix_code ?? ''} readOnly disabled />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="bulk-quantity">Jumlah Unit</Label>
                                            <Input
                                                id="bulk-quantity"
                                                type="number"
                                                min="1"
                                                max="200"
                                                value={bulkForm.data.quantity}
                                                onChange={(event) => bulkForm.setData('quantity', event.target.value)}
                                                disabled={noProductsYet}
                                            />
                                            <InputError message={bulkForm.errors.quantity} />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="bulk-start-number">Mulai Dari Nomor</Label>
                                            <Input
                                                id="bulk-start-number"
                                                type="number"
                                                min="1"
                                                value={bulkForm.data.start_number}
                                                onChange={(event) => bulkForm.setData('start_number', event.target.value)}
                                                disabled={noProductsYet}
                                            />
                                            <p className="text-muted-foreground text-xs">
                                                Default mengikuti nomor berikutnya untuk produk terpilih.
                                            </p>
                                            <InputError message={bulkForm.errors.start_number} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="bulk-status">Status Unit</Label>
                                            <Select value={bulkForm.data.status} onValueChange={(value) => bulkForm.setData('status', value)} disabled={noProductsYet}>
                                                <SelectTrigger id="bulk-status">
                                                    <SelectValue placeholder="Pilih status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {statusOptions.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <InputError message={bulkForm.errors.status} />
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-dashed p-4 text-sm">
                                        <p className="font-medium">Preview kode</p>
                                        <p className="text-muted-foreground mt-1">
                                            {selectedBulkProduct?.prefix_code
                                                ? `${previewCode(bulkStartNumber)} sampai ${previewCode(bulkPreviewEnd)}`
                                                : 'Isi prefix kode di produk terlebih dulu agar unit bisa digenerate.'}
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="bulk-notes">Catatan</Label>
                                        <Textarea
                                            id="bulk-notes"
                                            value={bulkForm.data.notes}
                                            onChange={(event) => bulkForm.setData('notes', event.target.value)}
                                            disabled={noProductsYet}
                                            placeholder="Catatan umum untuk semua unit yang digenerate"
                                        />
                                        <InputError message={bulkForm.errors.notes} />
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={bulkForm.processing || noProductsYet || !selectedBulkProduct?.prefix_code}
                                    >
                                        {bulkForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                        Generate Unit
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Tambah Satu Unit</CardTitle>
                                <CardDescription>Form manual tetap tersedia untuk kasus khusus atau unit tambahan satuan.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form className="grid gap-4" onSubmit={submitCreate}>
                                    <div className="grid gap-2">
                                        <Label htmlFor="create-product">Produk</Label>
                                        <Select value={createForm.data.product_id} onValueChange={(value) => createForm.setData('product_id', value)} disabled={noProductsYet}>
                                            <SelectTrigger id="create-product">
                                                <SelectValue placeholder="Pilih produk" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {productOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={createForm.errors.product_id} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="create-unit-code">Kode Unit</Label>
                                        <Input
                                            id="create-unit-code"
                                            value={createForm.data.unit_code}
                                            onChange={(event) => createForm.setData('unit_code', event.target.value)}
                                            placeholder="CAR50-001"
                                            disabled={noProductsYet}
                                        />
                                        {selectedCreateProduct?.prefix_code && (
                                            <p className="text-muted-foreground text-xs">
                                                Saran nomor berikutnya: {selectedCreateProduct.prefix_code}-{String(selectedCreateProduct.next_number).padStart(3, '0')}
                                            </p>
                                        )}
                                        <InputError message={createForm.errors.unit_code} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="create-status">Status Unit</Label>
                                        <Select value={createForm.data.status} onValueChange={(value) => createForm.setData('status', value)} disabled={noProductsYet}>
                                            <SelectTrigger id="create-status">
                                                <SelectValue placeholder="Pilih status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {statusOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={createForm.errors.status} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="create-notes">Catatan</Label>
                                        <Textarea
                                            id="create-notes"
                                            value={createForm.data.notes}
                                            onChange={(event) => createForm.setData('notes', event.target.value)}
                                            disabled={noProductsYet}
                                            placeholder="Misal: unit ini masih ada gores kecil"
                                        />
                                        <InputError message={createForm.errors.notes} />
                                    </div>

                                    <Button type="submit" className="w-full" disabled={createForm.processing || noProductsYet}>
                                        {createForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                        Simpan Unit
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Daftar Unit</CardTitle>
                            <CardDescription>Cari cepat, filter per produk atau status, lalu edit unit tanpa perlu scroll panjang.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Unit</p>
                                    <p className="mt-2 text-2xl font-semibold">{inventorySummary.total_units}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Produk</p>
                                    <p className="mt-2 text-2xl font-semibold">{inventorySummary.total_products}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Hasil Filter</p>
                                    <p className="mt-2 text-2xl font-semibold">{inventorySummary.filtered_units}</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border p-4">
                                <div className="flex flex-wrap gap-2">
                                    {inventorySummary.statuses.map((item) => (
                                        <Badge key={item.value} variant="outline" className="px-3 py-1">
                                            {item.label}: {item.count}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <form className="rounded-2xl border p-4" onSubmit={submitFilters}>
                                <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr_0.7fr]">
                                    <div className="grid gap-2">
                                        <Label htmlFor="inventory-search">Cari Unit</Label>
                                        <div className="relative">
                                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input
                                                id="inventory-search"
                                                value={filterForm.data.search}
                                                onChange={(event) => filterForm.setData('search', event.target.value)}
                                                placeholder="Cari kode unit atau nama produk"
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="filter-product">Filter Produk</Label>
                                        <Select value={filterForm.data.product || 'all'} onValueChange={(value) => filterForm.setData('product', value === 'all' ? '' : value)}>
                                            <SelectTrigger id="filter-product">
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

                                    <div className="grid gap-2">
                                        <Label htmlFor="filter-status">Filter Status</Label>
                                        <Select value={filterForm.data.status || 'all'} onValueChange={(value) => filterForm.setData('status', value === 'all' ? '' : value)}>
                                            <SelectTrigger id="filter-status">
                                                <SelectValue placeholder="Semua status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Semua status</SelectItem>
                                                {statusOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="filter-per-page">Baris / Halaman</Label>
                                        <Select value={filterForm.data.per_page} onValueChange={(value) => filterForm.setData('per_page', value)}>
                                            <SelectTrigger id="filter-per-page">
                                                <SelectValue placeholder="15" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="15">15</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-3">
                                    <Button type="submit">Terapkan Filter</Button>
                                    <Button type="button" variant="outline" onClick={resetFilters}>
                                        <X className="h-4 w-4" />
                                        Reset
                                    </Button>
                                </div>
                            </form>

                            <div className="rounded-xl border">
                                <div className="max-h-[30rem] overflow-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-muted/60 sticky top-0 z-10 backdrop-blur">
                                            <tr className="text-left">
                                                <th className="px-4 py-3 font-medium">Kode Unit</th>
                                                <th className="px-4 py-3 font-medium">Produk</th>
                                                <th className="px-4 py-3 font-medium">Status</th>
                                                <th className="px-4 py-3 font-medium">Catatan</th>
                                                <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inventoryUnits.length > 0 ? (
                                                inventoryUnits.map((unit) => {
                                                    const isActive = selectedUnitId === unit.id;

                                                    return (
                                                        <tr key={unit.id} className={isActive ? 'bg-muted/30' : ''}>
                                                            <td className="px-4 py-3 font-medium">{unit.unit_code}</td>
                                                            <td className="px-4 py-3 text-muted-foreground">{unit.product_name || '-'}</td>
                                                            <td className="px-4 py-3">
                                                                <Badge variant="outline">{unit.status_label}</Badge>
                                                            </td>
                                                            <td className="px-4 py-3 text-muted-foreground">{unit.notes || '-'}</td>
                                                            <td className="px-4 py-3 text-right">
                                                                <Button
                                                                    type="button"
                                                                    variant={isActive ? 'secondary' : 'outline'}
                                                                    size="sm"
                                                                    onClick={() => setSelectedUnitId(unit.id)}
                                                                >
                                                                    Edit
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="text-muted-foreground px-4 py-8 text-center">
                                                        Tidak ada unit yang cocok dengan filter saat ini.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-muted-foreground text-sm">
                                    Menampilkan {inventoryPagination.from ?? 0} - {inventoryPagination.to ?? 0} dari {inventoryPagination.total} unit.
                                </p>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(inventoryPagination.current_page - 1)}
                                        disabled={inventoryPagination.current_page <= 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Prev
                                    </Button>

                                    {paginationPages.map((page) => (
                                        <Button
                                            key={page}
                                            type="button"
                                            variant={page === inventoryPagination.current_page ? 'secondary' : 'outline'}
                                            size="sm"
                                            onClick={() => goToPage(page)}
                                        >
                                            {page}
                                        </Button>
                                    ))}

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(inventoryPagination.current_page + 1)}
                                        disabled={inventoryPagination.current_page >= inventoryPagination.last_page}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {selectedUnit ? (
                                <div className="rounded-2xl border p-5">
                                    <div>
                                        <h2 className="text-lg font-semibold">Edit Unit</h2>
                                        <p className="text-muted-foreground text-sm">
                                            {selectedUnit.unit_code} untuk produk {selectedUnit.product_name || '-'}.
                                        </p>
                                    </div>

                                    <form className="mt-5 grid gap-4" onSubmit={submitUpdate}>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-product">Produk</Label>
                                                <Select value={updateForm.data.product_id} onValueChange={(value) => updateForm.setData('product_id', value)}>
                                                    <SelectTrigger id="edit-product">
                                                        <SelectValue placeholder="Pilih produk" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {productOptions.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <InputError message={updateForm.errors.product_id} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-unit-code">Kode Unit</Label>
                                                <Input id="edit-unit-code" value={updateForm.data.unit_code} onChange={(event) => updateForm.setData('unit_code', event.target.value)} />
                                                <InputError message={updateForm.errors.unit_code} />
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit-status">Status Unit</Label>
                                            <Select value={updateForm.data.status} onValueChange={(value) => updateForm.setData('status', value)}>
                                                <SelectTrigger id="edit-status">
                                                    <SelectValue placeholder="Pilih status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {statusOptions.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <InputError message={updateForm.errors.status} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit-notes">Catatan</Label>
                                            <Textarea id="edit-notes" value={updateForm.data.notes} onChange={(event) => updateForm.setData('notes', event.target.value)} />
                                            <InputError message={updateForm.errors.notes} />
                                        </div>

                                        <Button type="submit" className="w-full sm:w-auto" disabled={updateForm.processing}>
                                            {updateForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                            Update Unit
                                        </Button>
                                    </form>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                    Belum ada unit inventaris yang bisa diedit.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
