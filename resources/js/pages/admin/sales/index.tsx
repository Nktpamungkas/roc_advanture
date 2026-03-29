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
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, LoaderCircle, Minus, Plus, Search, ShoppingCart, X } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface SaleProductOption {
    id: number;
    sku: string;
    name: string;
    category: string | null;
    selling_price: string;
    stock_qty: number;
    min_stock_qty: number;
    is_low_stock: boolean;
    notes: string | null;
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

interface RecentSaleItem {
    id: number;
    sale_no: string;
    sold_at: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    items_count: number;
    total_amount: string;
    payment_method_name: string | null;
    sold_by_name: string | null;
}

interface SaleFilters {
    recent_search: string;
    recent_per_page: number;
}

interface SalePagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface SaleSummary {
    available_products: number;
    low_stock_products: number;
    total_stock_qty: number;
    sales_today: number;
}

interface SaleForm {
    sold_at: string;
    customer_name: string;
    customer_phone: string;
    discount_amount: string;
    payment_method_config_id: string;
    notes: string;
    items: Array<{
        sale_product_id: number;
        qty: string;
    }>;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Penjualan', href: '/admin/sales' },
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

export default function SalesIndex({
    saleProducts,
    paymentMethodOptions,
    recentSales,
    saleFilters,
    salePagination,
    saleSummary,
}: {
    saleProducts: SaleProductOption[];
    paymentMethodOptions: PaymentMethodOption[];
    recentSales: RecentSaleItem[];
    saleFilters: SaleFilters;
    salePagination: SalePagination;
    saleSummary: SaleSummary;
}) {
    const { flash } = usePage<SharedData>().props;
    const [productSearch, setProductSearch] = useState('');

    const createForm = useForm<SaleForm>({
        sold_at: toDateTimeLocalValue(new Date()),
        customer_name: '',
        customer_phone: '',
        discount_amount: '0',
        payment_method_config_id: paymentMethodOptions[0]?.value ?? '',
        notes: '',
        items: [],
    });

    const recentFilterForm = useForm({
        recent_search: saleFilters.recent_search,
        recent_per_page: String(saleFilters.recent_per_page),
    });

    useEffect(() => {
        recentFilterForm.setData({
            recent_search: saleFilters.recent_search,
            recent_per_page: String(saleFilters.recent_per_page),
        });
    }, [saleFilters.recent_per_page, saleFilters.recent_search]);

    const filteredProducts = useMemo(() => {
        const query = productSearch.trim().toLowerCase();

        return saleProducts.filter((product) =>
            query === ''
                ? true
                : [product.name, product.sku, product.category ?? '', product.notes ?? ''].join(' ').toLowerCase().includes(query),
        );
    }, [productSearch, saleProducts]);

    const selectedPaymentMethod = useMemo(
        () => paymentMethodOptions.find((option) => option.value === createForm.data.payment_method_config_id) ?? null,
        [createForm.data.payment_method_config_id, paymentMethodOptions],
    );

    const cartItems = useMemo(
        () =>
            createForm.data.items
                .map((item) => {
                    const saleProduct = saleProducts.find((product) => product.id === item.sale_product_id);

                    if (!saleProduct) {
                        return null;
                    }

                    return {
                        ...item,
                        product: saleProduct,
                    };
                })
                .filter((item): item is { sale_product_id: number; qty: string; product: SaleProductOption } => item !== null),
        [createForm.data.items, saleProducts],
    );

    const subtotal = useMemo(
        () =>
            cartItems.reduce((sum, item) => {
                return sum + Number(item.product.selling_price || 0) * Number(item.qty || 0);
            }, 0),
        [cartItems],
    );
    const discountAmount = Number(createForm.data.discount_amount || 0);
    const totalAmount = Math.max(0, subtotal - discountAmount);
    const noProductsAvailable = saleProducts.length === 0;
    const noPaymentMethods = paymentMethodOptions.length === 0;

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');

    const addProductToCart = (product: SaleProductOption) => {
        const existingItem = createForm.data.items.find((item) => item.sale_product_id === product.id);

        if (existingItem) {
            const nextQty = Math.min(product.stock_qty, Number(existingItem.qty || 0) + 1);

            createForm.setData(
                'items',
                createForm.data.items.map((item) => (item.sale_product_id === product.id ? { ...item, qty: String(nextQty) } : item)),
            );

            return;
        }

        createForm.setData('items', [
            ...createForm.data.items,
            {
                sale_product_id: product.id,
                qty: '1',
            },
        ]);
    };

    const updateCartQty = (productId: number, nextQtyValue: string) => {
        const product = saleProducts.find((item) => item.id === productId);

        if (!product) {
            return;
        }

        const normalizedQty = Math.max(1, Math.min(product.stock_qty, Number(nextQtyValue || 0) || 1));

        createForm.setData(
            'items',
            createForm.data.items.map((item) => (item.sale_product_id === productId ? { ...item, qty: String(normalizedQty) } : item)),
        );
    };

    const removeCartItem = (productId: number) => {
        createForm.setData(
            'items',
            createForm.data.items.filter((item) => item.sale_product_id !== productId),
        );
    };

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();

        createForm.post(route('admin.sales.store'), {
            preserveScroll: true,
        });
    };

    const submitRecentFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.sales.index'),
            {
                recent_search: recentFilterForm.data.recent_search || undefined,
                recent_per_page: recentFilterForm.data.recent_per_page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const resetRecentFilters = () => {
        recentFilterForm.setData({
            recent_search: '',
            recent_per_page: '10',
        });

        router.get(
            route('admin.sales.index'),
            { recent_per_page: 10 },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const goToRecentPage = (page: number) => {
        router.get(
            route('admin.sales.index'),
            {
                recent_search: saleFilters.recent_search || undefined,
                recent_per_page: saleFilters.recent_per_page,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const salePaginationPages = useMemo(() => {
        if (salePagination.last_page <= 1) {
            return [1];
        }

        const start = Math.max(1, salePagination.current_page - 2);
        const end = Math.min(salePagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);

        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [salePagination.current_page, salePagination.last_page]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Penjualan" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Operasional jual-beli</p>
                    <h1 className="mt-2 text-2xl font-semibold">Penjualan</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Pilih barang jual, atur qty, pilih metode bayar, lalu sistem langsung keluarkan invoice penjualan.
                    </p>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Penjualan tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                {noProductsAvailable && (
                    <Alert variant="destructive">
                        <AlertTitle>Produk jual belum tersedia</AlertTitle>
                        <AlertDescription>Buat produk jual dulu atau tambah stok masuk agar transaksi penjualan bisa dipakai.</AlertDescription>
                    </Alert>
                )}

                {noPaymentMethods && (
                    <Alert variant="destructive">
                        <AlertTitle>Metode pembayaran belum tersedia</AlertTitle>
                        <AlertDescription>Super-admin perlu mengatur metode pembayaran dulu sebelum transaksi penjualan dipakai.</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-4">
                    <SummaryCard label="Produk Tersedia" value={saleSummary.available_products} />
                    <SummaryCard label="Stok Menipis" value={saleSummary.low_stock_products} />
                    <SummaryCard label="Total Stok" value={saleSummary.total_stock_qty} />
                    <SummaryCard label="Penjualan Hari Ini" value={saleSummary.sales_today} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Buat Penjualan</CardTitle>
                            <CardDescription>Customer penjualan opsional, jadi admin bisa tetap cepat saat transaksi walk-in.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-6" onSubmit={submitCreate}>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="grid gap-2">
                                        <Label htmlFor="sold-at">Waktu Penjualan</Label>
                                        <Input
                                            id="sold-at"
                                            type="datetime-local"
                                            value={createForm.data.sold_at}
                                            onChange={(event) => createForm.setData('sold_at', event.target.value)}
                                        />
                                        <InputError message={createForm.errors.sold_at} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="customer-name">Nama Customer</Label>
                                        <Input
                                            id="customer-name"
                                            value={createForm.data.customer_name}
                                            onChange={(event) => createForm.setData('customer_name', event.target.value)}
                                            placeholder="Opsional"
                                        />
                                        <InputError message={createForm.errors.customer_name} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="customer-phone">No. WhatsApp</Label>
                                        <Input
                                            id="customer-phone"
                                            value={createForm.data.customer_phone}
                                            onChange={(event) => createForm.setData('customer_phone', event.target.value)}
                                            placeholder="Opsional"
                                        />
                                        <InputError message={createForm.errors.customer_phone} />
                                    </div>
                                </div>

                                <div className="grid gap-3 rounded-2xl border p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold">Pilih Produk Jual</h2>
                                            <p className="text-muted-foreground text-sm">Klik produk untuk menambahkannya ke keranjang penjualan.</p>
                                        </div>
                                        <div className="relative w-full md:max-w-xs">
                                            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari nama atau SKU" className="pl-9" />
                                        </div>
                                    </div>

                                    <div className="grid max-h-[18rem] gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
                                        {filteredProducts.length > 0 ? (
                                            filteredProducts.map((product) => (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    onClick={() => addProductToCart(product)}
                                                    className="hover:border-primary/40 rounded-2xl border p-4 text-left transition"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-medium">{product.name}</p>
                                                            <p className="text-muted-foreground mt-1 text-sm">{product.sku}</p>
                                                        </div>
                                                        {product.is_low_stock && <Badge variant="destructive">Low</Badge>}
                                                    </div>
                                                    <div className="mt-3 grid gap-1 text-sm">
                                                        <p className="text-muted-foreground">Stok {product.stock_qty}</p>
                                                        <p className="font-medium">{formatCurrency(product.selling_price)}</p>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="text-muted-foreground col-span-full rounded-2xl border border-dashed p-6 text-sm">
                                                Tidak ada produk jual yang cocok dengan pencarian saat ini.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid gap-3 rounded-2xl border p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-lg font-semibold">Keranjang Penjualan</h2>
                                            <p className="text-muted-foreground text-sm">Atur qty langsung dari sini sebelum transaksi disimpan.</p>
                                        </div>
                                        <Badge variant="outline">{cartItems.length} produk</Badge>
                                    </div>

                                    <InputError message={createForm.errors.items} />

                                    {cartItems.length > 0 ? (
                                        <div className="overflow-hidden rounded-xl border">
                                            <table className="min-w-full border-collapse text-sm">
                                                <thead>
                                                    <tr className="bg-muted/40 text-left">
                                                        <th className="px-4 py-2.5 font-medium">Produk</th>
                                                        <th className="px-4 py-2.5 font-medium">Stok</th>
                                                        <th className="px-4 py-2.5 font-medium">Qty</th>
                                                        <th className="px-4 py-2.5 font-medium">Harga</th>
                                                        <th className="px-4 py-2.5 text-right font-medium">Jumlah</th>
                                                        <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cartItems.map((item, index) => (
                                                        <tr key={item.sale_product_id}>
                                                            <td className="border-t px-4 py-3">
                                                                <div className="font-medium">{item.product.name}</div>
                                                                <div className="text-muted-foreground mt-1 text-xs">{item.product.sku}</div>
                                                            </td>
                                                            <td className="border-t px-4 py-3 text-muted-foreground">{item.product.stock_qty}</td>
                                                            <td className="border-t px-4 py-3">
                                                                <div className="flex w-28 items-center rounded-lg border">
                                                                    <button
                                                                        type="button"
                                                                        className="px-3 py-2"
                                                                        onClick={() => updateCartQty(item.sale_product_id, String(Math.max(1, Number(item.qty || 0) - 1)))}
                                                                    >
                                                                        <Minus className="h-4 w-4" />
                                                                    </button>
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        max={item.product.stock_qty}
                                                                        value={item.qty}
                                                                        onChange={(event) => updateCartQty(item.sale_product_id, event.target.value)}
                                                                        className="h-10 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        className="px-3 py-2"
                                                                        onClick={() => updateCartQty(item.sale_product_id, String(Math.min(item.product.stock_qty, Number(item.qty || 0) + 1)))}
                                                                    >
                                                                        <Plus className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                                <InputError message={createForm.errors[`items.${index}.qty` as keyof typeof createForm.errors]} />
                                                            </td>
                                                            <td className="border-t px-4 py-3">{formatCurrency(item.product.selling_price)}</td>
                                                            <td className="border-t px-4 py-3 text-right font-medium">
                                                                {formatCurrency(Number(item.product.selling_price) * Number(item.qty || 0))}
                                                            </td>
                                                            <td className="border-t px-4 py-3 text-right">
                                                                <Button type="button" variant="outline" size="sm" onClick={() => removeCartItem(item.sale_product_id)}>
                                                                    <X className="mr-2 h-4 w-4" />
                                                                    Hapus
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">
                                            Belum ada barang di keranjang. Klik produk jual di atas untuk mulai transaksi.
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-4 md:grid-cols-[1fr_0.95fr]">
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="payment-method-config">Metode Pembayaran</Label>
                                            <Select
                                                value={createForm.data.payment_method_config_id || 'none'}
                                                onValueChange={(value) => createForm.setData('payment_method_config_id', value === 'none' ? '' : value)}
                                            >
                                                <SelectTrigger id="payment-method-config">
                                                    <SelectValue placeholder="Pilih metode pembayaran" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Belum dipilih</SelectItem>
                                                    {paymentMethodOptions.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label} - {option.type_label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <InputError message={createForm.errors.payment_method_config_id} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="discount-amount">Diskon</Label>
                                            <Input
                                                id="discount-amount"
                                                type="number"
                                                min="0"
                                                step="1000"
                                                value={createForm.data.discount_amount}
                                                onChange={(event) => createForm.setData('discount_amount', event.target.value)}
                                            />
                                            <InputError message={createForm.errors.discount_amount} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="sale-notes">Catatan Penjualan</Label>
                                            <Textarea
                                                id="sale-notes"
                                                rows={3}
                                                value={createForm.data.notes}
                                                onChange={(event) => createForm.setData('notes', event.target.value)}
                                            />
                                            <InputError message={createForm.errors.notes} />
                                        </div>
                                    </div>

                                    <div className="grid gap-4">
                                        <div className="rounded-2xl border p-4 text-sm">
                                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Metode Terpilih</p>
                                            {selectedPaymentMethod ? (
                                                <div className="mt-3 space-y-2">
                                                    <p className="font-medium">{selectedPaymentMethod.label}</p>
                                                    <p className="text-muted-foreground text-sm">{selectedPaymentMethod.type_label}</p>
                                                    {selectedPaymentMethod.type === 'transfer' && (
                                                        <div className="rounded-xl border bg-muted/20 p-3">
                                                            <p>{selectedPaymentMethod.bank_name}</p>
                                                            <p className="font-medium">{selectedPaymentMethod.account_number}</p>
                                                            <p className="text-muted-foreground">{selectedPaymentMethod.account_name}</p>
                                                        </div>
                                                    )}
                                                    {selectedPaymentMethod.type === 'qris' && selectedPaymentMethod.qr_image_path && (
                                                        <img
                                                            src={selectedPaymentMethod.qr_image_path}
                                                            alt={selectedPaymentMethod.label}
                                                            className="h-40 w-40 rounded-xl border object-contain p-2"
                                                        />
                                                    )}
                                                    {selectedPaymentMethod.instructions && <p className="text-muted-foreground leading-6">{selectedPaymentMethod.instructions}</p>}
                                                </div>
                                            ) : (
                                                <p className="text-muted-foreground mt-3">Pilih metode pembayaran supaya invoice langsung menampilkan instruksinya.</p>
                                            )}
                                        </div>

                                        <div className="rounded-2xl border p-4 text-sm">
                                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Ringkasan Penjualan</p>
                                            <div className="mt-3 grid gap-2">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">Produk di Keranjang</span>
                                                    <span>{cartItems.length}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">Subtotal</span>
                                                    <span>{formatCurrency(subtotal)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">Diskon</span>
                                                    <span>{formatCurrency(discountAmount)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3 border-t pt-3 text-base font-semibold">
                                                    <span>Total Bayar</span>
                                                    <span>{formatCurrency(totalAmount)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={createForm.processing || cartItems.length === 0 || noProductsAvailable || noPaymentMethods || !createForm.data.payment_method_config_id}
                                    >
                                        {createForm.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                                        Simpan Penjualan
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="gap-4">
                            <div>
                                <CardTitle>Penjualan Terbaru</CardTitle>
                                <CardDescription>Ringkasan transaksi jual-beli terbaru yang sudah masuk ke sistem.</CardDescription>
                            </div>

                            <form className="grid gap-3 md:grid-cols-[1fr_10rem_auto_auto]" onSubmit={submitRecentFilters}>
                                <div className="relative">
                                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                    <Input
                                        value={recentFilterForm.data.recent_search}
                                        onChange={(event) => recentFilterForm.setData('recent_search', event.target.value)}
                                        className="pl-9"
                                        placeholder="Cari invoice, customer, produk"
                                    />
                                </div>
                                <Select value={recentFilterForm.data.recent_per_page} onValueChange={(value) => recentFilterForm.setData('recent_per_page', value)}>
                                    <SelectTrigger>
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
                                <Button type="submit">Terapkan</Button>
                                <Button type="button" variant="outline" onClick={resetRecentFilters}>
                                    <X className="mr-2 h-4 w-4" />
                                    Reset
                                </Button>
                            </form>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="text-muted-foreground text-sm">
                                {salePagination.total > 0
                                    ? `Menampilkan ${salePagination.from ?? 0}-${salePagination.to ?? 0} dari ${salePagination.total} transaksi`
                                    : 'Belum ada transaksi penjualan'}
                            </div>

                            <div className="grid max-h-[34rem] gap-3 overflow-auto">
                                {recentSales.length > 0 ? (
                                    recentSales.map((sale) => (
                                        <div key={sale.id} className="rounded-2xl border p-4">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold">{sale.sale_no}</p>
                                                    <p className="text-muted-foreground mt-1 text-sm">
                                                        {sale.customer_name ?? 'Penjualan Umum'} - {sale.items_count} item
                                                    </p>
                                                </div>
                                                <Badge variant="outline">{sale.payment_method_name ?? 'Metode belum tersimpan'}</Badge>
                                            </div>

                                            <div className="text-muted-foreground mt-3 grid gap-1 text-xs">
                                                <p>{formatDateTime(sale.sold_at)}</p>
                                                {sale.customer_phone && <p>{sale.customer_phone}</p>}
                                                <p>Total {formatCurrency(sale.total_amount)}</p>
                                                <p>Admin: {sale.sold_by_name ?? '-'}</p>
                                            </div>

                                            <Button asChild variant="outline" className="mt-4 w-full">
                                                <Link href={route('admin.sales.show', sale.id)}>Buka Invoice</Link>
                                            </Button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">
                                        Belum ada penjualan yang cocok dengan filter saat ini.
                                    </div>
                                )}
                            </div>

                            {salePagination.last_page > 1 && (
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-muted-foreground text-sm">
                                        Halaman {salePagination.current_page} dari {salePagination.last_page}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            disabled={salePagination.current_page <= 1}
                                            onClick={() => goToRecentPage(salePagination.current_page - 1)}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        {salePaginationPages.map((page) => (
                                            <Button
                                                key={page}
                                                type="button"
                                                variant={page === salePagination.current_page ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => goToRecentPage(page)}
                                            >
                                                {page}
                                            </Button>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            disabled={salePagination.current_page >= salePagination.last_page}
                                            onClick={() => goToRecentPage(salePagination.current_page + 1)}
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

function SummaryCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
    );
}
