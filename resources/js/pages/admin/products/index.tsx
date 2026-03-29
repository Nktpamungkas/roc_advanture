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

interface ProductItem {
    id: number;
    name: string;
    category: string | null;
    prefix_code: string | null;
    daily_rate: string;
    active: boolean;
    notes: string | null;
    inventory_units_count: number;
}

interface ProductForm {
    name: string;
    category: string;
    prefix_code: string;
    daily_rate: string;
    active: boolean;
    notes: string;
}

interface ProductFilters {
    search: string;
    status: string;
    per_page: number;
}

interface ProductPagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface ProductSummary {
    total_products: number;
    active_products: number;
    inactive_products: number;
    total_units: number;
    filtered_products: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Produk', href: '/admin/products' },
];

const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

export default function ProductsIndex({
    products,
    productFilters,
    productPagination,
    productSummary,
}: {
    products: ProductItem[];
    productFilters: ProductFilters;
    productPagination: ProductPagination;
    productSummary: ProductSummary;
}) {
    const { flash } = usePage<SharedData>().props;
    const [selectedProductId, setSelectedProductId] = useState<number | null>(products[0]?.id ?? null);

    const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId) ?? null, [products, selectedProductId]);

    const createForm = useForm<ProductForm>({
        name: '',
        category: '',
        prefix_code: '',
        daily_rate: '',
        active: true,
        notes: '',
    });

    const updateForm = useForm<ProductForm>({
        name: '',
        category: '',
        prefix_code: '',
        daily_rate: '',
        active: true,
        notes: '',
    });

    const filterForm = useForm({
        search: productFilters.search,
        status: productFilters.status,
        per_page: String(productFilters.per_page),
    });

    useEffect(() => {
        if (!selectedProduct) {
            updateForm.reset();
            return;
        }

        updateForm.setData({
            name: selectedProduct.name,
            category: selectedProduct.category ?? '',
            prefix_code: selectedProduct.prefix_code ?? '',
            daily_rate: selectedProduct.daily_rate,
            active: selectedProduct.active,
            notes: selectedProduct.notes ?? '',
        });
        updateForm.clearErrors();
    }, [selectedProduct]);

    useEffect(() => {
        if (products.some((product) => product.id === selectedProductId)) {
            return;
        }

        setSelectedProductId(products[0]?.id ?? null);
    }, [products, selectedProductId]);

    useEffect(() => {
        filterForm.setData({
            search: productFilters.search,
            status: productFilters.status,
            per_page: String(productFilters.per_page),
        });
    }, [productFilters.per_page, productFilters.search, productFilters.status]);

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();

        createForm.post(route('admin.products.store'), {
            preserveScroll: true,
            onSuccess: () => createForm.reset(),
        });
    };

    const submitUpdate: FormEventHandler = (event) => {
        event.preventDefault();

        if (!selectedProduct) {
            return;
        }

        updateForm.patch(route('admin.products.update', selectedProduct.id), {
            preserveScroll: true,
        });
    };

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.products.index'),
            {
                search: filterForm.data.search || undefined,
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
            status: '',
            per_page: '10',
        });

        router.get(
            route('admin.products.index'),
            { per_page: 10 },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const goToPage = (page: number) => {
        router.get(
            route('admin.products.index'),
            {
                search: productFilters.search || undefined,
                status: productFilters.status || undefined,
                per_page: productFilters.per_page,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const formatCurrency = (value: string) => currencyFormatter.format(Number(value || 0));

    const paginationPages = useMemo(() => {
        if (productPagination.last_page <= 1) {
            return [1];
        }

        const start = Math.max(1, productPagination.current_page - 2);
        const end = Math.min(productPagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);

        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [productPagination.current_page, productPagination.last_page]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Produk" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Master rental</p>
                    <h1 className="mt-2 text-2xl font-semibold">Produk</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Simpan daftar jenis barang yang disewakan beserta harga sewa hariannya.
                    </p>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Perubahan tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.05fr_1.45fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tambah Produk</CardTitle>
                            <CardDescription>Masukkan jenis barang baru yang bisa disewakan.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-4" onSubmit={submitCreate}>
                                <div className="grid gap-2">
                                    <Label htmlFor="create-name">Nama Produk</Label>
                                    <Input id="create-name" value={createForm.data.name} onChange={(event) => createForm.setData('name', event.target.value)} placeholder="Carrier 50L" />
                                    <InputError message={createForm.errors.name} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-category">Kategori</Label>
                                    <Input id="create-category" value={createForm.data.category} onChange={(event) => createForm.setData('category', event.target.value)} placeholder="Carrier / Tenda / Lampu" />
                                    <InputError message={createForm.errors.category} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-prefix-code">Prefix Kode Unit</Label>
                                    <Input
                                        id="create-prefix-code"
                                        value={createForm.data.prefix_code}
                                        onChange={(event) => createForm.setData('prefix_code', event.target.value.toUpperCase())}
                                        placeholder="CAR50 / TND4P / FLS34"
                                    />
                                    <p className="text-muted-foreground text-xs">Dipakai saat generate unit inventaris massal.</p>
                                    <InputError message={createForm.errors.prefix_code} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-rate">Harga Sewa per Hari</Label>
                                    <Input id="create-rate" type="number" min="0" step="1000" value={createForm.data.daily_rate} onChange={(event) => createForm.setData('daily_rate', event.target.value)} placeholder="75000" />
                                    <InputError message={createForm.errors.daily_rate} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-active">Status</Label>
                                    <Select value={createForm.data.active ? 'active' : 'inactive'} onValueChange={(value) => createForm.setData('active', value === 'active')}>
                                        <SelectTrigger id="create-active">
                                            <SelectValue placeholder="Pilih status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Aktif</SelectItem>
                                            <SelectItem value="inactive">Nonaktif</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={createForm.errors.active} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-notes">Catatan</Label>
                                    <Textarea id="create-notes" value={createForm.data.notes} onChange={(event) => createForm.setData('notes', event.target.value)} placeholder="Catatan tambahan untuk admin" />
                                    <InputError message={createForm.errors.notes} />
                                </div>

                                <Button type="submit" className="w-full" disabled={createForm.processing}>
                                    {createForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                    Simpan Produk
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Daftar Produk</CardTitle>
                            <CardDescription>Cari dan filter produk aktif dengan tampilan yang lebih ringkas saat data mulai banyak.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="grid gap-4 md:grid-cols-4">
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Produk</p>
                                    <p className="mt-2 text-2xl font-semibold">{productSummary.total_products}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Aktif</p>
                                    <p className="mt-2 text-2xl font-semibold">{productSummary.active_products}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Nonaktif</p>
                                    <p className="mt-2 text-2xl font-semibold">{productSummary.inactive_products}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Unit</p>
                                    <p className="mt-2 text-2xl font-semibold">{productSummary.total_units}</p>
                                </div>
                            </div>

                            <form className="rounded-2xl border p-4" onSubmit={submitFilters}>
                                <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_0.7fr]">
                                    <div className="grid gap-2">
                                        <Label htmlFor="product-search">Cari Produk</Label>
                                        <div className="relative">
                                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input
                                                id="product-search"
                                                value={filterForm.data.search}
                                                onChange={(event) => filterForm.setData('search', event.target.value)}
                                                placeholder="Cari nama, kategori, atau prefix"
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="product-status">Filter Status</Label>
                                        <Select value={filterForm.data.status || 'all'} onValueChange={(value) => filterForm.setData('status', value === 'all' ? '' : value)}>
                                            <SelectTrigger id="product-status">
                                                <SelectValue placeholder="Semua status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Semua status</SelectItem>
                                                <SelectItem value="active">Aktif</SelectItem>
                                                <SelectItem value="inactive">Nonaktif</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="product-per-page">Baris / Halaman</Label>
                                        <Select value={filterForm.data.per_page} onValueChange={(value) => filterForm.setData('per_page', value)}>
                                            <SelectTrigger id="product-per-page">
                                                <SelectValue placeholder="10" />
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
                                <div className="max-h-[28rem] overflow-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-muted/60 sticky top-0 z-10 backdrop-blur">
                                            <tr className="text-left">
                                                <th className="px-4 py-3 font-medium">Produk</th>
                                                <th className="px-4 py-3 font-medium">Kategori</th>
                                                <th className="px-4 py-3 font-medium">Prefix</th>
                                                <th className="px-4 py-3 font-medium">Harga / hari</th>
                                                <th className="px-4 py-3 font-medium">Unit</th>
                                                <th className="px-4 py-3 font-medium">Status</th>
                                                <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {products.length > 0 ? (
                                                products.map((product) => {
                                                    const isActive = selectedProductId === product.id;

                                                    return (
                                                        <tr key={product.id} className={isActive ? 'bg-muted/30' : ''}>
                                                            <td className="px-4 py-3 font-medium">{product.name}</td>
                                                            <td className="px-4 py-3 text-muted-foreground">{product.category || '-'}</td>
                                                            <td className="px-4 py-3 text-muted-foreground">{product.prefix_code || '-'}</td>
                                                            <td className="px-4 py-3 text-muted-foreground">{formatCurrency(product.daily_rate)}</td>
                                                            <td className="px-4 py-3 text-muted-foreground">{product.inventory_units_count}</td>
                                                            <td className="px-4 py-3">
                                                                <Badge variant={product.active ? 'default' : 'secondary'}>{product.active ? 'Aktif' : 'Nonaktif'}</Badge>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <Button
                                                                    type="button"
                                                                    variant={isActive ? 'secondary' : 'outline'}
                                                                    size="sm"
                                                                    onClick={() => setSelectedProductId(product.id)}
                                                                >
                                                                    Edit
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={7} className="text-muted-foreground px-4 py-8 text-center">
                                                        Tidak ada produk yang cocok dengan filter saat ini.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-muted-foreground text-sm">
                                    Menampilkan {productPagination.from ?? 0} - {productPagination.to ?? 0} dari {productPagination.total} produk.
                                </p>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(productPagination.current_page - 1)}
                                        disabled={productPagination.current_page <= 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Prev
                                    </Button>

                                    {paginationPages.map((page) => (
                                        <Button
                                            key={page}
                                            type="button"
                                            variant={page === productPagination.current_page ? 'secondary' : 'outline'}
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
                                        onClick={() => goToPage(productPagination.current_page + 1)}
                                        disabled={productPagination.current_page >= productPagination.last_page}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {selectedProduct ? (
                                <div className="rounded-2xl border p-5">
                                    <div>
                                        <h2 className="text-lg font-semibold">Edit Produk</h2>
                                        <p className="text-muted-foreground text-sm">
                                            {selectedProduct.name} dengan {selectedProduct.inventory_units_count} unit inventaris.
                                        </p>
                                    </div>

                                    <form className="mt-5 grid gap-4" onSubmit={submitUpdate}>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-name">Nama Produk</Label>
                                                <Input id="edit-name" value={updateForm.data.name} onChange={(event) => updateForm.setData('name', event.target.value)} />
                                                <InputError message={updateForm.errors.name} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-category">Kategori</Label>
                                                <Input id="edit-category" value={updateForm.data.category} onChange={(event) => updateForm.setData('category', event.target.value)} />
                                                <InputError message={updateForm.errors.category} />
                                            </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-prefix-code">Prefix Kode Unit</Label>
                                                <Input
                                                    id="edit-prefix-code"
                                                    value={updateForm.data.prefix_code}
                                                    onChange={(event) => updateForm.setData('prefix_code', event.target.value.toUpperCase())}
                                                />
                                                <InputError message={updateForm.errors.prefix_code} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-rate">Harga Sewa per Hari</Label>
                                                <Input id="edit-rate" type="number" min="0" step="1000" value={updateForm.data.daily_rate} onChange={(event) => updateForm.setData('daily_rate', event.target.value)} />
                                                <InputError message={updateForm.errors.daily_rate} />
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit-active">Status</Label>
                                            <Select value={updateForm.data.active ? 'active' : 'inactive'} onValueChange={(value) => updateForm.setData('active', value === 'active')}>
                                                <SelectTrigger id="edit-active">
                                                    <SelectValue placeholder="Pilih status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Aktif</SelectItem>
                                                    <SelectItem value="inactive">Nonaktif</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <InputError message={updateForm.errors.active} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit-notes">Catatan</Label>
                                            <Textarea id="edit-notes" value={updateForm.data.notes} onChange={(event) => updateForm.setData('notes', event.target.value)} />
                                            <InputError message={updateForm.errors.notes} />
                                        </div>

                                        <Button type="submit" className="w-full sm:w-auto" disabled={updateForm.processing}>
                                            {updateForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                            Update Produk
                                        </Button>
                                    </form>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                    Belum ada produk yang bisa diedit.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
