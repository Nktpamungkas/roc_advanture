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
import { ChevronLeft, ChevronRight, LoaderCircle, Plus, Search, Truck, X } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo } from 'react';

interface ProductOption {
    value: string;
    label: string;
    sku: string;
    purchase_price: string;
    selling_price: string;
    stock_qty: number;
    active: boolean;
}

interface ReceiptItem {
    id: number;
    receipt_no: string;
    supplier_name: string | null;
    received_at: string | null;
    items_count: number;
    total_qty: number;
    total_amount: string;
    receiver_name: string | null;
    notes: string | null;
}

interface Filters {
    search: string;
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
    total_receipts: number;
    total_received_qty: number;
    total_inventory_value: string;
    filtered_receipts: number;
}

interface StockReceiptForm {
    supplier_name: string;
    received_at: string;
    notes: string;
    items: Array<{
        sale_product_id: string;
        qty: string;
        purchase_price: string;
    }>;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Stok Masuk', href: '/admin/stock-receipts' },
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

export default function StockReceiptsIndex({
    stockReceipts,
    stockReceiptFilters,
    stockReceiptPagination,
    stockReceiptSummary,
    saleProductOptions,
}: {
    stockReceipts: ReceiptItem[];
    stockReceiptFilters: Filters;
    stockReceiptPagination: Pagination;
    stockReceiptSummary: Summary;
    saleProductOptions: ProductOption[];
}) {
    const { flash } = usePage<SharedData>().props;

    const createForm = useForm<StockReceiptForm>({
        supplier_name: '',
        received_at: toDateTimeLocalValue(new Date()),
        notes: '',
        items: [
            {
                sale_product_id: saleProductOptions[0]?.value ?? '',
                qty: '1',
                purchase_price: saleProductOptions[0]?.purchase_price ?? '',
            },
        ],
    });

    const filterForm = useForm({
        search: stockReceiptFilters.search,
        per_page: String(stockReceiptFilters.per_page),
    });

    const selectedProductIds = useMemo(
        () => createForm.data.items.map((item) => item.sale_product_id).filter((value) => value !== ''),
        [createForm.data.items],
    );

    const remainingProductOptions = useMemo(
        () => saleProductOptions.filter((option) => !selectedProductIds.includes(option.value)),
        [saleProductOptions, selectedProductIds],
    );

    useEffect(() => {
        filterForm.setData({
            search: stockReceiptFilters.search,
            per_page: String(stockReceiptFilters.per_page),
        });
    }, [stockReceiptFilters.per_page, stockReceiptFilters.search]);

    const updateItem = (index: number, field: 'sale_product_id' | 'qty' | 'purchase_price', value: string) => {
        const nextItems = [...createForm.data.items];
        nextItems[index] = { ...nextItems[index], [field]: value };

        if (field === 'sale_product_id') {
            const selectedProduct = saleProductOptions.find((product) => product.value === value);
            nextItems[index].purchase_price = selectedProduct?.purchase_price ?? '';
        }

        createForm.setData('items', nextItems);
    };

    const addItem = () => {
        const nextProduct = remainingProductOptions[0];

        if (!nextProduct) {
            return;
        }

        createForm.setData('items', [
            ...createForm.data.items,
            {
                sale_product_id: nextProduct.value,
                qty: '1',
                purchase_price: nextProduct.purchase_price,
            },
        ]);
    };

    const removeItem = (index: number) => {
        if (createForm.data.items.length <= 1) {
            return;
        }

        createForm.setData(
            'items',
            createForm.data.items.filter((_, itemIndex) => itemIndex !== index),
        );
    };

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();

        createForm.post(route('admin.stock-receipts.store'), {
            preserveScroll: true,
            onSuccess: () =>
                createForm.reset(
                    'supplier_name',
                    'notes',
                    'items',
                ),
        });
    };

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.stock-receipts.index'),
            {
                search: filterForm.data.search || undefined,
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
            per_page: '10',
        });

        router.get(
            route('admin.stock-receipts.index'),
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
            route('admin.stock-receipts.index'),
            {
                search: stockReceiptFilters.search || undefined,
                per_page: stockReceiptFilters.per_page,
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
        if (stockReceiptPagination.last_page <= 1) return [1];
        const start = Math.max(1, stockReceiptPagination.current_page - 2);
        const end = Math.min(stockReceiptPagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);

        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [stockReceiptPagination.current_page, stockReceiptPagination.last_page]);

    const totalQty = createForm.data.items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const totalAmount = createForm.data.items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.purchase_price || 0)), 0);
    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Stok Masuk" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Operasional jual-beli</p>
                    <h1 className="mt-2 text-2xl font-semibold">Stok Masuk</h1>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Stok tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-4">
                    <SummaryCard label="Total Dokumen" value={stockReceiptSummary.total_receipts} />
                    <SummaryCard label="Qty Masuk" value={stockReceiptSummary.total_received_qty} />
                    <SummaryCard label="Nilai Pembelian" value={formatCurrency(stockReceiptSummary.total_inventory_value)} />
                    <SummaryCard label="Hasil Filter" value={stockReceiptSummary.filtered_receipts} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Buat Stok Masuk</CardTitle>
                            <CardDescription>Pakai halaman ini untuk barang datang dari supplier atau restock toko.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-4" onSubmit={submitCreate}>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <InputGroup label="Supplier" value={createForm.data.supplier_name} onChange={(value) => createForm.setData('supplier_name', value)} error={createForm.errors.supplier_name} />
                                    <div className="grid gap-2">
                                        <Label htmlFor="received-at">Waktu Masuk</Label>
                                        <Input id="received-at" type="datetime-local" value={createForm.data.received_at} onChange={(event) => createForm.setData('received_at', event.target.value)} />
                                        <InputError message={createForm.errors.received_at} />
                                    </div>
                                </div>

                                <div className="grid gap-3 rounded-2xl border p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="font-semibold">Item Restock</h2>
                                            <p className="text-muted-foreground text-sm">Pilih produk, qty, dan harga beli per item.</p>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={remainingProductOptions.length === 0}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Tambah Baris
                                        </Button>
                                    </div>

                                    <InputError message={createForm.errors.items} />

                                    <div className="grid gap-3">
                                        {createForm.data.items.map((item, index) => {
                                            const selectedProduct = saleProductOptions.find((product) => product.value === item.sale_product_id) ?? null;
                                            const selectedInOtherRows = createForm.data.items
                                                .filter((_, itemIndex) => itemIndex !== index)
                                                .map((entry) => entry.sale_product_id)
                                                .filter((value) => value !== '');
                                            const productOptionsForRow = saleProductOptions.filter(
                                                (option) => option.value === item.sale_product_id || !selectedInOtherRows.includes(option.value),
                                            );

                                            return (
                                                <div key={`${index}-${item.sale_product_id}`} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1.2fr_0.7fr_0.8fr_auto]">
                                                    <div className="grid gap-2">
                                                        <Label>Produk</Label>
                                                        <Select value={item.sale_product_id || 'none'} onValueChange={(value) => updateItem(index, 'sale_product_id', value === 'none' ? '' : value)}>
                                                            <SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Pilih produk</SelectItem>
                                                                {productOptionsForRow.map((option) => (
                                                                    <SelectItem key={option.value} value={option.value}>
                                                                        {option.label} ({option.sku})
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <InputError message={createForm.errors[`items.${index}.sale_product_id` as keyof typeof createForm.errors]} />
                                                        {selectedProduct && (
                                                            <p className="text-muted-foreground text-xs">Stok sekarang {selectedProduct.stock_qty} • Harga beli terakhir {formatCurrency(selectedProduct.purchase_price)}</p>
                                                        )}
                                                    </div>
                                                    <InputGroup label="Qty" value={item.qty} onChange={(value) => updateItem(index, 'qty', value)} error={createForm.errors[`items.${index}.qty` as keyof typeof createForm.errors]} type="number" />
                                                    <InputGroup label="Harga Beli" value={item.purchase_price} onChange={(value) => updateItem(index, 'purchase_price', value)} error={createForm.errors[`items.${index}.purchase_price` as keyof typeof createForm.errors]} type="number" />
                                                    <div className="flex items-end">
                                                        <Button type="button" variant="outline" onClick={() => removeItem(index)} disabled={createForm.data.items.length <= 1}>
                                                            <X className="mr-2 h-4 w-4" />
                                                            Hapus
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="receipt-notes">Catatan</Label>
                                    <Textarea id="receipt-notes" rows={3} value={createForm.data.notes} onChange={(event) => createForm.setData('notes', event.target.value)} />
                                    <InputError message={createForm.errors.notes} />
                                </div>

                                <div className="rounded-2xl border p-4 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">Total Qty</span>
                                        <span>{totalQty}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-3 font-medium">
                                        <span>Total Pembelian</span>
                                        <span>{formatCurrency(totalAmount)}</span>
                                    </div>
                                </div>

                                <Button type="submit" disabled={createForm.processing || saleProductOptions.length === 0}>
                                    {createForm.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                                    Simpan Stok Masuk
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="gap-4">
                            <div>
                                <CardTitle>Riwayat Stok Masuk</CardTitle>
                                <CardDescription>Monitor dokumen restock terbaru agar histori pembelian tetap rapi.</CardDescription>
                            </div>
                            <form className="grid gap-3 md:grid-cols-[1fr_10rem_auto]" onSubmit={submitFilters}>
                                <div className="relative">
                                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                    <Input value={filterForm.data.search} onChange={(event) => filterForm.setData('search', event.target.value)} className="pl-9" placeholder="Cari no dokumen, supplier, produk" />
                                </div>
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
                        <CardContent className="space-y-4">
                            <div className="grid max-h-[44rem] gap-3 overflow-auto">
                                {stockReceipts.length > 0 ? (
                                    stockReceipts.map((receipt) => (
                                        <div key={receipt.id} className="rounded-2xl border p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="font-medium">{receipt.receipt_no}</p>
                                                <Badge variant="outline">{receipt.items_count} item</Badge>
                                            </div>
                                            <p className="text-muted-foreground mt-1 text-sm">{receipt.supplier_name || 'Supplier belum diisi'}</p>
                                            <p className="text-muted-foreground text-sm">{receipt.received_at ? dateTimeFormatter.format(new Date(receipt.received_at)) : '-'}</p>
                                            <div className="mt-3 grid gap-2 text-sm">
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Qty</span><span>{receipt.total_qty}</span></div>
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Nilai</span><span>{formatCurrency(receipt.total_amount)}</span></div>
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Admin</span><span>{receipt.receiver_name ?? '-'}</span></div>
                                            </div>
                                            {receipt.notes && <p className="text-muted-foreground mt-3 text-xs leading-5">{receipt.notes}</p>}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">
                                        Belum ada riwayat stok masuk yang cocok dengan filter saat ini.
                                    </div>
                                )}
                            </div>

                            {stockReceiptPagination.last_page > 1 && (
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-muted-foreground text-sm">
                                        Menampilkan {stockReceiptPagination.from ?? 0} - {stockReceiptPagination.to ?? 0} dari {stockReceiptPagination.total} dokumen.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="outline" size="icon" disabled={stockReceiptPagination.current_page <= 1} onClick={() => goToPage(stockReceiptPagination.current_page - 1)}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        {pages.map((page) => (
                                            <Button key={page} type="button" variant={page === stockReceiptPagination.current_page ? 'default' : 'outline'} size="sm" onClick={() => goToPage(page)}>
                                                {page}
                                            </Button>
                                        ))}
                                        <Button type="button" variant="outline" size="icon" disabled={stockReceiptPagination.current_page >= stockReceiptPagination.last_page} onClick={() => goToPage(stockReceiptPagination.current_page + 1)}>
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

function SummaryCard({ label, value }: { label: string; value: number | string }) {
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
