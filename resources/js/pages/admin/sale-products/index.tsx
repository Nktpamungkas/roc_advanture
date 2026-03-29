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
import { ChevronLeft, ChevronRight, LoaderCircle, Search, ShoppingBag, X } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface SaleProductItem {
    id: number;
    sku: string;
    name: string;
    category: string | null;
    purchase_price: string;
    selling_price: string;
    stock_qty: number;
    min_stock_qty: number;
    active: boolean;
    is_low_stock: boolean;
    notes: string | null;
}

interface SaleProductForm {
    sku: string;
    name: string;
    category: string;
    purchase_price: string;
    selling_price: string;
    min_stock_qty: string;
    active: boolean;
    notes: string;
}

interface Filters {
    search: string;
    status: string;
    stock_state: string;
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
    total_products: number;
    active_products: number;
    low_stock_products: number;
    total_stock_qty: number;
    filtered_products: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Produk Jual', href: '/admin/sale-products' },
];

const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

export default function SaleProductsIndex({
    saleProducts,
    saleProductFilters,
    saleProductPagination,
    saleProductSummary,
}: {
    saleProducts: SaleProductItem[];
    saleProductFilters: Filters;
    saleProductPagination: Pagination;
    saleProductSummary: Summary;
}) {
    const { flash } = usePage<SharedData>().props;
    const [selectedProductId, setSelectedProductId] = useState<number | null>(saleProducts[0]?.id ?? null);
    const selectedProduct = useMemo(() => saleProducts.find((item) => item.id === selectedProductId) ?? null, [saleProducts, selectedProductId]);

    const createForm = useForm<SaleProductForm>({
        sku: '',
        name: '',
        category: '',
        purchase_price: '',
        selling_price: '',
        min_stock_qty: '0',
        active: true,
        notes: '',
    });

    const updateForm = useForm<SaleProductForm>({
        sku: '',
        name: '',
        category: '',
        purchase_price: '',
        selling_price: '',
        min_stock_qty: '0',
        active: true,
        notes: '',
    });

    const filterForm = useForm({
        search: saleProductFilters.search,
        status: saleProductFilters.status,
        stock_state: saleProductFilters.stock_state,
        per_page: String(saleProductFilters.per_page),
    });

    useEffect(() => {
        if (!selectedProduct) {
            updateForm.reset();
            return;
        }

        updateForm.setData({
            sku: selectedProduct.sku,
            name: selectedProduct.name,
            category: selectedProduct.category ?? '',
            purchase_price: selectedProduct.purchase_price,
            selling_price: selectedProduct.selling_price,
            min_stock_qty: String(selectedProduct.min_stock_qty),
            active: selectedProduct.active,
            notes: selectedProduct.notes ?? '',
        });
        updateForm.clearErrors();
    }, [selectedProduct]);

    useEffect(() => {
        if (saleProducts.some((item) => item.id === selectedProductId)) {
            return;
        }

        setSelectedProductId(saleProducts[0]?.id ?? null);
    }, [saleProducts, selectedProductId]);

    useEffect(() => {
        filterForm.setData({
            search: saleProductFilters.search,
            status: saleProductFilters.status,
            stock_state: saleProductFilters.stock_state,
            per_page: String(saleProductFilters.per_page),
        });
    }, [saleProductFilters.per_page, saleProductFilters.search, saleProductFilters.status, saleProductFilters.stock_state]);

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();

        createForm.post(route('admin.sale-products.store'), {
            preserveScroll: true,
            onSuccess: () => createForm.reset(),
        });
    };

    const submitUpdate: FormEventHandler = (event) => {
        event.preventDefault();

        if (!selectedProduct) {
            return;
        }

        updateForm.patch(route('admin.sale-products.update', selectedProduct.id), {
            preserveScroll: true,
        });
    };

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.sale-products.index'),
            {
                search: filterForm.data.search || undefined,
                status: filterForm.data.status || undefined,
                stock_state: filterForm.data.stock_state || undefined,
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
            stock_state: '',
            per_page: '10',
        });

        router.get(
            route('admin.sale-products.index'),
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
            route('admin.sale-products.index'),
            {
                search: saleProductFilters.search || undefined,
                status: saleProductFilters.status || undefined,
                stock_state: saleProductFilters.stock_state || undefined,
                per_page: saleProductFilters.per_page,
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
        if (saleProductPagination.last_page <= 1) return [1];
        const start = Math.max(1, saleProductPagination.current_page - 2);
        const end = Math.min(saleProductPagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);

        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [saleProductPagination.current_page, saleProductPagination.last_page]);

    const formatCurrency = (value: string) => currencyFormatter.format(Number(value || 0));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Produk Jual" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Master barang jual-beli</p>
                    <h1 className="mt-2 text-2xl font-semibold">Produk Jual</h1>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Perubahan tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-4">
                    <SummaryCard label="Total Produk" value={saleProductSummary.total_products} />
                    <SummaryCard label="Aktif" value={saleProductSummary.active_products} />
                    <SummaryCard label="Stok Menipis" value={saleProductSummary.low_stock_products} />
                    <SummaryCard label="Total Stok" value={saleProductSummary.total_stock_qty} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tambah Produk Jual</CardTitle>
                            <CardDescription>Tambahkan katalog barang yang memang dijual, bukan barang rental.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-4" onSubmit={submitCreate}>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <InputGroup label="SKU" value={createForm.data.sku} onChange={(value) => createForm.setData('sku', value)} error={createForm.errors.sku} />
                                    <InputGroup label="Nama Produk" value={createForm.data.name} onChange={(value) => createForm.setData('name', value)} error={createForm.errors.name} />
                                </div>
                                <InputGroup label="Kategori" value={createForm.data.category} onChange={(value) => createForm.setData('category', value)} error={createForm.errors.category} />
                                <div className="grid gap-4 md:grid-cols-3">
                                    <InputGroup label="Harga Beli" value={createForm.data.purchase_price} onChange={(value) => createForm.setData('purchase_price', value)} error={createForm.errors.purchase_price} type="number" />
                                    <InputGroup label="Harga Jual" value={createForm.data.selling_price} onChange={(value) => createForm.setData('selling_price', value)} error={createForm.errors.selling_price} type="number" />
                                    <InputGroup label="Stok Minimum" value={createForm.data.min_stock_qty} onChange={(value) => createForm.setData('min_stock_qty', value)} error={createForm.errors.min_stock_qty} type="number" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="create-notes">Catatan</Label>
                                    <Textarea id="create-notes" rows={3} value={createForm.data.notes} onChange={(event) => createForm.setData('notes', event.target.value)} />
                                    <InputError message={createForm.errors.notes} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Status</Label>
                                    <Select value={createForm.data.active ? 'active' : 'inactive'} onValueChange={(value) => createForm.setData('active', value === 'active')}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Aktif</SelectItem>
                                            <SelectItem value="inactive">Nonaktif</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button type="submit" disabled={createForm.processing}>
                                    {createForm.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingBag className="mr-2 h-4 w-4" />}
                                    Simpan Produk Jual
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="gap-4">
                            <div>
                                <CardTitle>Daftar Produk Jual</CardTitle>
                                <CardDescription>Pilih produk di kiri untuk edit detail, harga, dan batas stok minimumnya.</CardDescription>
                            </div>
                            <form className="grid gap-3 md:grid-cols-[1fr_10rem_10rem_10rem_auto]" onSubmit={submitFilters}>
                                <div className="relative">
                                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                    <Input value={filterForm.data.search} onChange={(event) => filterForm.setData('search', event.target.value)} className="pl-9" placeholder="Cari nama, SKU, kategori" />
                                </div>
                                <Select value={filterForm.data.status || 'all'} onValueChange={(value) => filterForm.setData('status', value === 'all' ? '' : value)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua status</SelectItem>
                                        <SelectItem value="active">Aktif</SelectItem>
                                        <SelectItem value="inactive">Nonaktif</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={filterForm.data.stock_state || 'all'} onValueChange={(value) => filterForm.setData('stock_state', value === 'all' ? '' : value)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua stok</SelectItem>
                                        <SelectItem value="low">Stok menipis</SelectItem>
                                        <SelectItem value="out">Stok habis</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={filterForm.data.per_page} onValueChange={(value) => filterForm.setData('per_page', value)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {[10, 15, 25, 50].map((option) => <SelectItem key={option} value={String(option)}>{option} baris</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Button type="button" variant="outline" onClick={resetFilters}>
                                    <X className="mr-2 h-4 w-4" />
                                    Reset
                                </Button>
                            </form>
                        </CardHeader>
                        <CardContent className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                            <div className="grid max-h-[34rem] gap-3 overflow-auto">
                                {saleProducts.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSelectedProductId(item.id)}
                                        className={`rounded-2xl border p-4 text-left transition ${selectedProductId === item.id ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="font-medium">{item.name}</p>
                                            <div className="flex gap-2">
                                                {item.is_low_stock && <Badge variant="destructive">Low</Badge>}
                                                <Badge variant={item.active ? 'outline' : 'secondary'}>{item.active ? 'Aktif' : 'Nonaktif'}</Badge>
                                            </div>
                                        </div>
                                        <p className="text-muted-foreground mt-1 text-sm">{item.sku}</p>
                                        <p className="text-muted-foreground text-sm">{formatCurrency(item.selling_price)} • stok {item.stock_qty}</p>
                                    </button>
                                ))}
                            </div>

                            <div className="rounded-2xl border p-4">
                                {selectedProduct ? (
                                    <form className="grid gap-4" onSubmit={submitUpdate}>
                                        <div className="rounded-2xl border p-4 text-sm">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-muted-foreground">Stok Saat Ini</span>
                                                <span className="font-semibold">{selectedProduct.stock_qty}</span>
                                            </div>
                                            <div className="mt-2 flex items-center justify-between gap-3">
                                                <span className="text-muted-foreground">Minimum</span>
                                                <span>{selectedProduct.min_stock_qty}</span>
                                            </div>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <InputGroup label="SKU" value={updateForm.data.sku} onChange={(value) => updateForm.setData('sku', value)} error={updateForm.errors.sku} />
                                            <InputGroup label="Nama Produk" value={updateForm.data.name} onChange={(value) => updateForm.setData('name', value)} error={updateForm.errors.name} />
                                        </div>
                                        <InputGroup label="Kategori" value={updateForm.data.category} onChange={(value) => updateForm.setData('category', value)} error={updateForm.errors.category} />
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <InputGroup label="Harga Beli" value={updateForm.data.purchase_price} onChange={(value) => updateForm.setData('purchase_price', value)} error={updateForm.errors.purchase_price} type="number" />
                                            <InputGroup label="Harga Jual" value={updateForm.data.selling_price} onChange={(value) => updateForm.setData('selling_price', value)} error={updateForm.errors.selling_price} type="number" />
                                            <InputGroup label="Stok Minimum" value={updateForm.data.min_stock_qty} onChange={(value) => updateForm.setData('min_stock_qty', value)} error={updateForm.errors.min_stock_qty} type="number" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="edit-notes">Catatan</Label>
                                            <Textarea id="edit-notes" rows={3} value={updateForm.data.notes} onChange={(event) => updateForm.setData('notes', event.target.value)} />
                                            <InputError message={updateForm.errors.notes} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Status</Label>
                                            <Select value={updateForm.data.active ? 'active' : 'inactive'} onValueChange={(value) => updateForm.setData('active', value === 'active')}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Aktif</SelectItem>
                                                    <SelectItem value="inactive">Nonaktif</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button type="submit" disabled={updateForm.processing}>
                                            {updateForm.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingBag className="mr-2 h-4 w-4" />}
                                            Update Produk Jual
                                        </Button>
                                    </form>
                                ) : (
                                    <p className="text-muted-foreground text-sm">Pilih produk jual di sebelah kiri untuk mulai edit.</p>
                                )}
                            </div>
                        </CardContent>

                        {saleProductPagination.last_page > 1 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-6">
                                <p className="text-muted-foreground text-sm">
                                    Menampilkan {saleProductPagination.from ?? 0} - {saleProductPagination.to ?? 0} dari {saleProductPagination.total} produk.
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" size="icon" disabled={saleProductPagination.current_page <= 1} onClick={() => goToPage(saleProductPagination.current_page - 1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    {pages.map((page) => (
                                        <Button key={page} type="button" variant={page === saleProductPagination.current_page ? 'default' : 'outline'} size="sm" onClick={() => goToPage(page)}>
                                            {page}
                                        </Button>
                                    ))}
                                    <Button type="button" variant="outline" size="icon" disabled={saleProductPagination.current_page >= saleProductPagination.last_page} onClick={() => goToPage(saleProductPagination.current_page + 1)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
    );
}

function InputGroup({ label, value, onChange, error, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; error?: string; type?: string }) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
            <InputError message={error} />
        </div>
    );
}
