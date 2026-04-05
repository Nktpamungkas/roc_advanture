
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Layers3, LoaderCircle, Minus, Plus, Search, UserRoundSearch, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface CustomerOption { id: number; name: string; phone_whatsapp: string; address: string | null; rating: { score: number; label: string } | null; }
interface AvailableUnitItem { id: number; product_name: string | null; unit_code: string; status: string; status_label: string; daily_rate: string; notes: string | null; }
interface SaleProductOption { id: number; sku: string; name: string; selling_price: string; stock_qty: number; is_low_stock: boolean; is_out_of_stock?: boolean; }
interface SeasonRuleItem { name: string; start_date: string; end_date: string; dp_required: boolean; dp_type: string | null; dp_value: string | null; }
interface PaymentMethodOption { value: string; label: string; type: string; type_label: string; instructions: string | null; bank_name: string | null; account_number: string | null; account_name: string | null; qr_image_path: string | null; }
interface RecentCombinedOrderItem { id: number; combined_no: string; ordered_at: string | null; customer_name: string | null; rental_items_count: number; sale_items_count: number; paid_amount: string; remaining_amount: string; payment_status_label: string; }
interface CombinedOrderForm { customer_id: string; customer_name: string; customer_phone_whatsapp: string; customer_address: string; guarantee_note: string; starts_at: string; rental_days: string; due_at: string; inventory_unit_ids: number[]; sale_items: Array<{ sale_product_id: number; qty: string }>; paid_amount: string; payment_method_config_id: string; dp_override_reason: string; notes: string; }

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Transaksi Gabungan', href: '/admin/combined-orders' },
];

const currencyFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const toDateTimeLocalValue = (date: Date) => {
    const timezoneOffset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};
const defaultStartAt = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return toDateTimeLocalValue(now);
};
const calculateDueAtValue = (startsAtValue: string, rentalDaysValue: string) => {
    const startsAt = new Date(startsAtValue);
    const rentalDays = Number(rentalDaysValue);
    if (Number.isNaN(startsAt.getTime()) || rentalDays <= 0) return '';
    startsAt.setDate(startsAt.getDate() + rentalDays);
    return toDateTimeLocalValue(startsAt);
};
const calculateRentalDaysValue = (startsAtValue: string, dueAtValue: string) => {
    const startsAt = new Date(startsAtValue);
    const dueAt = new Date(dueAtValue);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(dueAt.getTime()) || dueAt.getTime() <= startsAt.getTime()) return '';
    return String(Math.max(1, Math.ceil((dueAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60 * 24))));
};

export default function CombinedOrdersIndex({ customers, availableUnits, saleProducts, seasonRules, paymentMethodOptions, recentCombinedOrders }: {
    customers: CustomerOption[];
    availableUnits: AvailableUnitItem[];
    saleProducts: SaleProductOption[];
    seasonRules: SeasonRuleItem[];
    paymentMethodOptions: PaymentMethodOption[];
    recentCombinedOrders: RecentCombinedOrderItem[];
}) {
    const { flash } = usePage<SharedData>().props;
    const [unitSearch, setUnitSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [durationInputSource, setDurationInputSource] = useState<'rental_days' | 'due_at'>('rental_days');
    const [availablePaymentMethodOptions, setAvailablePaymentMethodOptions] = useState(paymentMethodOptions);
    const [isRefreshingPaymentMethods, setIsRefreshingPaymentMethods] = useState(false);

    const startsAtDefault = defaultStartAt();
    const dueAtDefault = calculateDueAtValue(startsAtDefault, '1');

    const createForm = useForm<CombinedOrderForm>({
        customer_id: '', customer_name: '', customer_phone_whatsapp: '', customer_address: '', guarantee_note: '',
        starts_at: startsAtDefault, rental_days: '1', due_at: dueAtDefault, inventory_unit_ids: [], sale_items: [],
        paid_amount: '0', payment_method_config_id: paymentMethodOptions[0]?.value ?? '', dp_override_reason: '', notes: '',
    });

    useEffect(() => setAvailablePaymentMethodOptions(paymentMethodOptions), [paymentMethodOptions]);

    const computedDueAt = useMemo(() => durationInputSource !== 'rental_days' ? createForm.data.due_at : calculateDueAtValue(createForm.data.starts_at, createForm.data.rental_days), [createForm.data.due_at, createForm.data.rental_days, createForm.data.starts_at, durationInputSource]);
    const computedRentalDays = useMemo(() => durationInputSource !== 'due_at' ? createForm.data.rental_days : calculateRentalDaysValue(createForm.data.starts_at, createForm.data.due_at), [createForm.data.due_at, createForm.data.rental_days, createForm.data.starts_at, durationInputSource]);

    useEffect(() => {
        if (durationInputSource === 'rental_days' && computedDueAt !== createForm.data.due_at) createForm.setData('due_at', computedDueAt);
    }, [computedDueAt, createForm, createForm.data.due_at, durationInputSource]);

    useEffect(() => {
        if (durationInputSource === 'due_at' && computedRentalDays !== createForm.data.rental_days) createForm.setData('rental_days', computedRentalDays);
    }, [computedRentalDays, createForm, createForm.data.rental_days, durationInputSource]);

    const customerSuggestions = useMemo(() => {
        const query = `${createForm.data.customer_name} ${createForm.data.customer_phone_whatsapp}`.trim().toLowerCase();
        if (query.length < 2) return [];
        return customers.filter((customer) => `${customer.name} ${customer.phone_whatsapp}`.toLowerCase().includes(query)).slice(0, 4);
    }, [createForm.data.customer_name, createForm.data.customer_phone_whatsapp, customers]);

    const filteredUnits = useMemo(() => {
        const query = unitSearch.trim().toLowerCase();
        return availableUnits.filter((unit) => query === '' ? true : [unit.product_name ?? '', unit.unit_code, unit.status_label, unit.notes ?? ''].join(' ').toLowerCase().includes(query));
    }, [availableUnits, unitSearch]);

    const groupedUnits = useMemo(() => filteredUnits.reduce<Record<string, AvailableUnitItem[]>>((groups, unit) => {
        const key = unit.product_name ?? 'Produk tanpa nama';
        groups[key] ??= [];
        groups[key].push(unit);
        return groups;
    }, {}), [filteredUnits]);

    const filteredSaleProducts = useMemo(() => {
        const query = productSearch.trim().toLowerCase();
        return saleProducts.filter((product) => query === '' ? true : `${product.name} ${product.sku}`.toLowerCase().includes(query));
    }, [productSearch, saleProducts]);
    const selectedUnits = useMemo(() => availableUnits.filter((unit) => createForm.data.inventory_unit_ids.includes(unit.id)), [availableUnits, createForm.data.inventory_unit_ids]);
    const selectedSaleItems = useMemo(() => createForm.data.sale_items.map((item) => {
        const product = saleProducts.find((candidate) => candidate.id === item.sale_product_id);
        return product ? { ...item, product } : null;
    }).filter((item): item is { sale_product_id: number; qty: string; product: SaleProductOption } => item !== null), [createForm.data.sale_items, saleProducts]);

    const totalDays = Math.max(0, Number(createForm.data.rental_days || 0));
    const rentalSubtotal = useMemo(() => selectedUnits.reduce((sum, unit) => sum + Number(unit.daily_rate || 0) * totalDays, 0), [selectedUnits, totalDays]);
    const saleSubtotal = useMemo(() => selectedSaleItems.reduce((sum, item) => sum + Number(item.product.selling_price || 0) * Number(item.qty || 0), 0), [selectedSaleItems]);
    const paidAmount = Number(createForm.data.paid_amount || 0);
    const allocatedRentalPayment = Math.max(0, paidAmount - saleSubtotal);
    const remainingAmount = Math.max(0, rentalSubtotal + saleSubtotal - paidAmount);

    const matchedSeasonRule = useMemo(() => {
        const rentalDate = createForm.data.starts_at.slice(0, 10);
        const matches = seasonRules.filter((seasonRule) => rentalDate >= seasonRule.start_date && rentalDate <= seasonRule.end_date);
        return matches.length > 0 ? matches[matches.length - 1] : null;
    }, [createForm.data.starts_at, seasonRules]);

    const requiredDpAmount = useMemo(() => {
        if (!matchedSeasonRule?.dp_required) return 0;
        if (matchedSeasonRule.dp_type === 'fixed_amount') return Math.min(rentalSubtotal, Number(matchedSeasonRule.dp_value || 0));
        return Math.min(rentalSubtotal, rentalSubtotal * (Number(matchedSeasonRule.dp_value || 0) / 100));
    }, [matchedSeasonRule, rentalSubtotal]);

    const paymentInsufficientForSales = saleSubtotal > 0 && paidAmount < saleSubtotal;
    const dpRequirementUnmet = matchedSeasonRule?.dp_required === true && selectedUnits.length > 0 && rentalSubtotal > 0 && allocatedRentalPayment < requiredDpAmount;
    const selectedPaymentMethod = useMemo(() => availablePaymentMethodOptions.find((option) => option.value === createForm.data.payment_method_config_id) ?? null, [availablePaymentMethodOptions, createForm.data.payment_method_config_id]);

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');

    const toggleUnit = (unitId: number, checked: boolean) => {
        if (checked) {
            createForm.setData('inventory_unit_ids', [...createForm.data.inventory_unit_ids, unitId]);
            return;
        }
        createForm.setData('inventory_unit_ids', createForm.data.inventory_unit_ids.filter((selectedId) => selectedId !== unitId));
    };

    const addProductToCart = (product: SaleProductOption) => {
        const existingItem = createForm.data.sale_items.find((item) => item.sale_product_id === product.id);
        if (existingItem) {
            const nextQty = Math.min(product.stock_qty, Number(existingItem.qty || 0) + 1);
            createForm.setData('sale_items', createForm.data.sale_items.map((item) => item.sale_product_id === product.id ? { ...item, qty: String(nextQty) } : item));
            return;
        }
        createForm.setData('sale_items', [...createForm.data.sale_items, { sale_product_id: product.id, qty: '1' }]);
    };

    const updateSaleQty = (productId: number, nextQtyValue: string) => {
        const product = saleProducts.find((candidate) => candidate.id === productId);
        if (!product) return;
        const normalizedQty = Math.max(1, Math.min(product.stock_qty, Number(nextQtyValue || 0) || 1));
        createForm.setData('sale_items', createForm.data.sale_items.map((item) => item.sale_product_id === productId ? { ...item, qty: String(normalizedQty) } : item));
    };

    const removeSaleItem = (productId: number) => createForm.setData('sale_items', createForm.data.sale_items.filter((item) => item.sale_product_id !== productId));

    const refreshPaymentMethodOptions = async (open: boolean) => {
        if (!open || isRefreshingPaymentMethods) return;
        setIsRefreshingPaymentMethods(true);
        try {
            const response = await fetch('/admin/payment-methods/options', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
            if (!response.ok) throw new Error('Gagal memuat metode pembayaran terbaru.');
            const data = (await response.json()) as { payment_method_options?: PaymentMethodOption[] };
            const nextOptions = data.payment_method_options ?? [];
            setAvailablePaymentMethodOptions(nextOptions);
            if (nextOptions.length === 0) {
                createForm.setData('payment_method_config_id', '');
            } else if (!nextOptions.some((option) => option.value === createForm.data.payment_method_config_id)) {
                createForm.setData('payment_method_config_id', nextOptions[0]?.value ?? '');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsRefreshingPaymentMethods(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Transaksi Gabungan" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">1x transaksi untuk sewa alat dan jual barang</p>
                    <h1 className="mt-2 text-2xl font-semibold">Transaksi Gabungan</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">Halaman ini dipakai saat customer sewa alat sekaligus beli barang, jadi staff tidak perlu input dua kali.</p>
                </section>

                {flash.success && <Alert><AlertTitle>Transaksi tersimpan</AlertTitle><AlertDescription>{flash.success}</AlertDescription></Alert>}

                <div className="grid gap-4 md:grid-cols-4">
                    <SummaryCard label="Unit Rental Ready" value={availableUnits.length} />
                    <SummaryCard label="Produk Jual Aktif" value={saleProducts.length} />
                    <SummaryCard label="Invoice Gabungan" value={recentCombinedOrders.length} />
                    <SummaryCard label="Item Sewa Terpilih" value={selectedUnits.length} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Buat Transaksi Gabungan</CardTitle>
                            <CardDescription>Pilih item sewa dan item jual dalam satu invoice.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-6" onSubmit={(event) => {
                                event.preventDefault();
                                createForm.post(route('admin.combined-orders.store'), { preserveScroll: true });
                            }}>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="customer-name">Nama Customer</Label>
                                        <Input id="customer-name" value={createForm.data.customer_name} onChange={(event) => createForm.setData('customer_name', event.target.value)} />
                                        <InputError message={createForm.errors.customer_name} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="customer-phone-whatsapp">Nomor WhatsApp</Label>
                                        <Input id="customer-phone-whatsapp" value={createForm.data.customer_phone_whatsapp} onChange={(event) => createForm.setData('customer_phone_whatsapp', event.target.value)} />
                                        <InputError message={createForm.errors.customer_phone_whatsapp} />
                                    </div>
                                </div>

                                {customerSuggestions.length > 0 && (
                                    <div className="grid gap-2 rounded-2xl border border-dashed p-4">
                                        <div className="flex items-center gap-2 text-sm font-medium"><UserRoundSearch className="h-4 w-4" />Gunakan customer lama</div>
                                        <div className="grid gap-2 md:grid-cols-2">
                                            {customerSuggestions.map((customer) => (
                                                <button key={customer.id} type="button" onClick={() => createForm.setData({ ...createForm.data, customer_id: String(customer.id), customer_name: customer.name, customer_phone_whatsapp: customer.phone_whatsapp, customer_address: customer.address ?? '' })} className="rounded-xl border p-3 text-left hover:border-primary/40">
                                                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{customer.name}</span>{customer.rating && <Badge variant="outline">{customer.rating.label}</Badge>}</div>
                                                    <p className="text-muted-foreground mt-1 text-sm">{customer.phone_whatsapp}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="customer-address">Alamat</Label>
                                        <Textarea id="customer-address" rows={2} value={createForm.data.customer_address} onChange={(event) => createForm.setData('customer_address', event.target.value)} />
                                        <InputError message={createForm.errors.customer_address} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="guarantee-note">Jaminan</Label>
                                        <Input id="guarantee-note" value={createForm.data.guarantee_note} onChange={(event) => createForm.setData('guarantee_note', event.target.value)} />
                                        <InputError message={createForm.errors.guarantee_note} />
                                    </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="grid gap-2">
                                        <Label htmlFor="starts-at">Mulai Sewa</Label>
                                        <Input id="starts-at" type="datetime-local" value={createForm.data.starts_at} onChange={(event) => createForm.setData('starts_at', event.target.value)} />
                                        <InputError message={createForm.errors.starts_at} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="rental-days">Lama Sewa (Hari)</Label>
                                        <Input id="rental-days" type="number" min="1" max="365" value={createForm.data.rental_days} onChange={(event) => { setDurationInputSource('rental_days'); createForm.setData('rental_days', event.target.value); }} />
                                        <InputError message={createForm.errors.rental_days} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="due-at">Harus Kembali</Label>
                                        <Input id="due-at" type="datetime-local" value={createForm.data.due_at} onChange={(event) => { setDurationInputSource('due_at'); createForm.setData('due_at', event.target.value); }} />
                                        <InputError message={createForm.errors.due_at} />
                                    </div>
                                </div>

                                <div className="grid gap-3 rounded-2xl border p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-lg font-semibold">Pilih Unit Sewa</h2>
                                            <p className="text-muted-foreground text-sm">Unit ready clean dan ready unclean bisa dipilih.</p>
                                        </div>
                                        <div className="relative w-full max-w-xs">
                                            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Cari unit atau produk" className="pl-9" />
                                        </div>
                                    </div>
                                    <InputError message={createForm.errors.inventory_unit_ids} />
                                    <div className="max-h-[22rem] overflow-auto rounded-xl border p-4">
                                        {Object.entries(groupedUnits).map(([productName, units]) => (
                                            <div key={productName} className="mb-4 last:mb-0">
                                                <p className="mb-2 font-medium">{productName}</p>
                                                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                                    {units.map((unit) => {
                                                        const isSelected = createForm.data.inventory_unit_ids.includes(unit.id);
                                                        return (
                                                            <label key={unit.id} className={`flex gap-3 rounded-xl border p-3 ${isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}>
                                                                <Checkbox checked={isSelected} onCheckedChange={(checked) => toggleUnit(unit.id, checked === true)} />
                                                                <div className="grid gap-1">
                                                                    <div className="flex items-center gap-2"><span className="font-medium">{unit.unit_code}</span><InventoryStatusBadge status={unit.status} label={unit.status_label} /></div>
                                                                    <span className="text-muted-foreground text-sm">{formatCurrency(unit.daily_rate)} / hari</span>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid gap-3 rounded-2xl border p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-lg font-semibold">Pilih Barang Jual</h2>
                                            <p className="text-muted-foreground text-sm">Klik barang untuk menambahkannya ke transaksi yang sama.</p>
                                        </div>
                                        <div className="relative w-full max-w-xs">
                                            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari nama atau SKU" className="pl-9" />
                                        </div>
                                    </div>
                                    <div className="grid max-h-[16rem] gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
                                        {filteredSaleProducts.length > 0 ? filteredSaleProducts.map((product) => (
                                            <button
                                                key={product.id}
                                                type="button"
                                                onClick={() => !product.is_out_of_stock && addProductToCart(product)}
                                                disabled={product.is_out_of_stock}
                                                className={`rounded-2xl border p-4 text-left ${product.is_out_of_stock ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/40'}`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div><p className="font-medium">{product.name}</p><p className="text-muted-foreground text-sm">{product.sku}</p></div>
                                                    <div className="flex gap-2">
                                                        {product.is_out_of_stock ? <Badge variant="secondary">Stok Habis</Badge> : product.is_low_stock ? <Badge variant="destructive">Low</Badge> : null}
                                                    </div>
                                                </div>
                                                <p className="mt-2 text-sm">Stok {product.stock_qty}</p>
                                                <p className="mt-1 font-medium">{formatCurrency(product.selling_price)}</p>
                                            </button>
                                        )) : (
                                            <div className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm md:col-span-2 xl:col-span-3">
                                                Belum ada master barang jual aktif yang cocok dengan pencarian ini.
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <div className="flex items-center justify-between gap-3"><h3 className="font-medium">Keranjang Barang Jual</h3><Badge variant="outline">{selectedSaleItems.length} produk</Badge></div>
                                        <InputError message={createForm.errors.sale_items} />
                                        {selectedSaleItems.length > 0 ? selectedSaleItems.map((item) => (
                                            <div key={item.sale_product_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                                                <div>
                                                    <p className="font-medium">{item.product.name}</p>
                                                    <p className="text-muted-foreground text-sm">{item.product.sku} • {formatCurrency(item.product.selling_price)}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button type="button" className="rounded border p-2" onClick={() => updateSaleQty(item.sale_product_id, String(Math.max(1, Number(item.qty || 0) - 1)))}><Minus className="h-4 w-4" /></button>
                                                    <Input value={item.qty} onChange={(event) => updateSaleQty(item.sale_product_id, event.target.value)} className="w-16 text-center" />
                                                    <button type="button" className="rounded border p-2" onClick={() => updateSaleQty(item.sale_product_id, String(Math.min(item.product.stock_qty, Number(item.qty || 0) + 1)))}><Plus className="h-4 w-4" /></button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => removeSaleItem(item.sale_product_id)}><X className="mr-2 h-4 w-4" />Hapus</Button>
                                                </div>
                                            </div>
                                        )) : <div className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">Belum ada barang jual dipilih.</div>}
                                    </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-[1fr_0.95fr]">
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="payment-method-config">Metode Pembayaran</Label>
                                            <Select value={createForm.data.payment_method_config_id || 'none'} onValueChange={(value) => createForm.setData('payment_method_config_id', value === 'none' ? '' : value)} onOpenChange={(open) => void refreshPaymentMethodOptions(open)}>
                                                <SelectTrigger id="payment-method-config"><SelectValue placeholder="Pilih metode pembayaran" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Belum dipilih</SelectItem>
                                                    {availablePaymentMethodOptions.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label} - {option.type_label}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <InputError message={createForm.errors.payment_method_config_id} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="paid-amount">Pembayaran Gabungan</Label>
                                            <Input id="paid-amount" type="number" min="0" step="1000" value={createForm.data.paid_amount} onChange={(event) => createForm.setData('paid_amount', event.target.value)} />
                                            <p className="text-muted-foreground text-xs">Minimal harus menutup item jual, sisanya baru dihitung sebagai pembayaran sewa.</p>
                                            <InputError message={createForm.errors.paid_amount} />
                                        </div>

                                        {dpRequirementUnmet && (
                                            <div className="grid gap-2">
                                                <Label htmlFor="dp-override-reason">Alasan Override DP</Label>
                                                <Textarea id="dp-override-reason" rows={3} value={createForm.data.dp_override_reason} onChange={(event) => createForm.setData('dp_override_reason', event.target.value)} />
                                                <InputError message={createForm.errors.dp_override_reason} />
                                            </div>
                                        )}

                                        <div className="grid gap-2">
                                            <Label htmlFor="notes">Catatan Transaksi</Label>
                                            <Textarea id="notes" rows={3} value={createForm.data.notes} onChange={(event) => createForm.setData('notes', event.target.value)} />
                                            <InputError message={createForm.errors.notes} />
                                        </div>
                                    </div>

                                    <div className="grid gap-4">
                                        <div className="rounded-2xl border p-4 text-sm">
                                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Ringkasan Gabungan</p>
                                            <div className="mt-3 grid gap-2">
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Item Sewa</span><span>{selectedUnits.length}</span></div>
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Item Jual</span><span>{selectedSaleItems.length}</span></div>
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Total Sewa</span><span>{formatCurrency(rentalSubtotal)}</span></div>
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Total Jual</span><span>{formatCurrency(saleSubtotal)}</span></div>
                                                {matchedSeasonRule?.dp_required && <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">DP Rekomendasi Sewa</span><span>{formatCurrency(requiredDpAmount)}</span></div>}
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Alokasi ke Sewa</span><span>{formatCurrency(allocatedRentalPayment)}</span></div>
                                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Dibayar</span><span>{formatCurrency(paidAmount)}</span></div>
                                                <div className="flex items-center justify-between gap-3 border-t pt-3 text-base font-semibold"><span>Sisa Gabungan</span><span>{formatCurrency(remainingAmount)}</span></div>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border p-4 text-sm">
                                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Metode Terpilih</p>
                                            {selectedPaymentMethod ? (
                                                <div className="mt-3 space-y-2">
                                                    <p className="font-medium">{selectedPaymentMethod.label}</p>
                                                    {selectedPaymentMethod.type === 'transfer' && <div className="rounded-xl border bg-muted/20 p-3"><p>{selectedPaymentMethod.bank_name}</p><p className="font-medium">{selectedPaymentMethod.account_number}</p><p className="text-muted-foreground">{selectedPaymentMethod.account_name}</p></div>}
                                                    {selectedPaymentMethod.type === 'qris' && selectedPaymentMethod.qr_image_path && <img src={selectedPaymentMethod.qr_image_path} alt={selectedPaymentMethod.label} className="h-36 w-36 rounded-xl border object-contain p-2" />}
                                                    {selectedPaymentMethod.instructions && <p className="text-muted-foreground leading-6">{selectedPaymentMethod.instructions}</p>}
                                                </div>
                                            ) : <p className="text-muted-foreground mt-3">Pilih metode pembayaran agar instruksi muncul di invoice.</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button type="submit" disabled={createForm.processing || selectedUnits.length === 0 || selectedSaleItems.length === 0 || totalDays <= 0 || !createForm.data.payment_method_config_id || paymentInsufficientForSales || (dpRequirementUnmet && createForm.data.dp_override_reason.trim() === '')}>
                                        {createForm.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Layers3 className="mr-2 h-4 w-4" />}
                                        Simpan Transaksi Gabungan
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Transaksi Gabungan Terbaru</CardTitle>
                            <CardDescription>Ringkasan invoice gabungan yang baru masuk.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {recentCombinedOrders.length > 0 ? recentCombinedOrders.map((combinedOrder) => (
                                <div key={combinedOrder.id} className="rounded-2xl border p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold">{combinedOrder.combined_no}</p>
                                            <p className="text-muted-foreground mt-1 text-sm">{combinedOrder.customer_name ?? '-'} • {combinedOrder.rental_items_count} item sewa • {combinedOrder.sale_items_count} item jual</p>
                                        </div>
                                        <Badge variant="outline">{combinedOrder.payment_status_label}</Badge>
                                    </div>
                                    <div className="text-muted-foreground mt-3 grid gap-1 text-xs">
                                        <p>{formatDateTime(combinedOrder.ordered_at)}</p>
                                        <p>Dibayar {formatCurrency(combinedOrder.paid_amount)} • Sisa {formatCurrency(combinedOrder.remaining_amount)}</p>
                                    </div>
                                    <Button asChild variant="outline" className="mt-4 w-full"><Link href={route('admin.combined-orders.show', combinedOrder.id)}>Buka Invoice</Link></Button>
                                </div>
                            )) : <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">Belum ada transaksi gabungan.</div>}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
    return <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}

function InventoryStatusBadge({ status, label }: { status: string; label: string }) {
    const tone = inventoryStatusTone(status);
    return <Badge variant="outline" className={`gap-2 border ${tone.badgeClass}`}><span className={`size-2 rounded-full ${tone.dotClass}`} />{label}</Badge>;
}

function inventoryStatusTone(status: string): { badgeClass: string; dotClass: string } {
    switch (status) {
        case 'ready_clean': return { badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700', dotClass: 'bg-emerald-500' };
        case 'ready_unclean': return { badgeClass: 'border-amber-200 bg-amber-50 text-amber-800', dotClass: 'bg-amber-500' };
        case 'rented': return { badgeClass: 'border-sky-200 bg-sky-50 text-sky-800', dotClass: 'bg-sky-500' };
        case 'maintenance': return { badgeClass: 'border-rose-200 bg-rose-50 text-rose-700', dotClass: 'bg-rose-500' };
        case 'retired': return { badgeClass: 'border-slate-300 bg-slate-100 text-slate-700', dotClass: 'bg-slate-500' };
        default: return { badgeClass: 'border-zinc-200 bg-zinc-50 text-zinc-700', dotClass: 'bg-zinc-400' };
    }
}
