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
import { ArrowLeft, LoaderCircle, Minus, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface CustomerOption { id: number; name: string; phone_whatsapp: string; address: string | null; }
interface AvailableUnitItem { id: number; product_name: string | null; unit_code: string; status: string; status_label: string; daily_rate: string; }
interface SaleProductOption { id: number; sku: string; name: string; selling_price: string; stock_qty: number; editable_stock_qty: number; is_out_of_stock?: boolean; }
interface PaymentMethodOption { value: string; label: string; type_label: string; }
interface CombinedOrderForm { customer_id: string; customer_name: string; customer_phone_whatsapp: string; customer_address: string; guarantee_note: string; starts_at: string; rental_days: string; due_at: string; inventory_unit_ids: number[]; sale_items: Array<{ sale_product_id: number; qty: string }>; paid_amount: string; payment_method_config_id: string; dp_override_reason: string; notes: string; }
interface CombinedOrderEditRecord extends CombinedOrderForm { id: number; combined_no: string; }

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Transaksi Gabungan', href: '/admin/combined-orders' },
    { title: 'Edit Transaksi Gabungan', href: '#' },
];

const currencyFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export default function CombinedOrdersEdit({ combinedOrder, customers, availableUnits, saleProducts, paymentMethodOptions }: { combinedOrder: CombinedOrderEditRecord; customers: CustomerOption[]; availableUnits: AvailableUnitItem[]; saleProducts: SaleProductOption[]; paymentMethodOptions: PaymentMethodOption[]; }) {
    const { flash } = usePage<SharedData>().props;
    const [unitSearch, setUnitSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const form = useForm<CombinedOrderForm>(combinedOrder);

    const filteredUnits = useMemo(() => {
        const query = unitSearch.trim().toLowerCase();
        return availableUnits.filter((unit) => query === '' ? true : `${unit.product_name ?? ''} ${unit.unit_code}`.toLowerCase().includes(query));
    }, [availableUnits, unitSearch]);

    const filteredSaleProducts = useMemo(() => {
        const query = productSearch.trim().toLowerCase();
        return saleProducts.filter((product) => query === '' ? true : `${product.name} ${product.sku}`.toLowerCase().includes(query));
    }, [productSearch, saleProducts]);

    const selectedSaleItems = useMemo(() => form.data.sale_items.map((item) => {
        const product = saleProducts.find((candidate) => candidate.id === item.sale_product_id);
        return product ? { ...item, product } : null;
    }).filter((item): item is { sale_product_id: number; qty: string; product: SaleProductOption } => item !== null), [form.data.sale_items, saleProducts]);

    const toggleUnit = (unitId: number, checked: boolean) => {
        if (checked) {
            form.setData('inventory_unit_ids', [...form.data.inventory_unit_ids, unitId]);
            return;
        }
        form.setData('inventory_unit_ids', form.data.inventory_unit_ids.filter((selectedId) => selectedId !== unitId));
    };

    const addProduct = (product: SaleProductOption) => {
        if (product.is_out_of_stock) return;
        const existingItem = form.data.sale_items.find((item) => item.sale_product_id === product.id);
        if (existingItem) {
            const nextQty = Math.min(product.editable_stock_qty, Number(existingItem.qty || 0) + 1);
            form.setData('sale_items', form.data.sale_items.map((item) => item.sale_product_id === product.id ? { ...item, qty: String(nextQty) } : item));
            return;
        }
        form.setData('sale_items', [...form.data.sale_items, { sale_product_id: product.id, qty: '1' }]);
    };

    const updateSaleQty = (productId: number, qty: string) => {
        const product = saleProducts.find((candidate) => candidate.id === productId);
        if (!product) return;
        const normalizedQty = Math.max(1, Math.min(product.editable_stock_qty, Number(qty || 0) || 1));
        form.setData('sale_items', form.data.sale_items.map((item) => item.sale_product_id === productId ? { ...item, qty: String(normalizedQty) } : item));
    };

    const removeSaleItem = (productId: number) => form.setData('sale_items', form.data.sale_items.filter((item) => item.sale_product_id !== productId));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${combinedOrder.combined_no}`} />
            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Edit Transaksi Gabungan</h1>
                        <p className="text-muted-foreground mt-2 text-sm">{combinedOrder.combined_no}</p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href={route('admin.combined-orders.show', combinedOrder.id)}>
                            <ArrowLeft className="h-4 w-4" />
                            Kembali ke Invoice
                        </Link>
                    </Button>
                </div>

                {flash.success && <Alert><AlertTitle>Berhasil</AlertTitle><AlertDescription>{flash.success}</AlertDescription></Alert>}
                {flash.error && <Alert className="border-red-200 bg-red-50 text-red-700"><AlertTitle>Gagal</AlertTitle><AlertDescription>{flash.error}</AlertDescription></Alert>}

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>Form Edit</CardTitle>
                        <CardDescription>Ubah item sewa, item jual, customer, jadwal, dan pembayaran dalam satu transaksi.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); form.put(route('admin.combined-orders.update', combinedOrder.id), { preserveScroll: true }); }}>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Nama Customer" error={form.errors.customer_name}><Input value={form.data.customer_name} onChange={(event) => form.setData('customer_name', event.target.value)} /></Field>
                                <Field label="Nomor WhatsApp" error={form.errors.customer_phone_whatsapp}><Input value={form.data.customer_phone_whatsapp} onChange={(event) => form.setData('customer_phone_whatsapp', event.target.value)} /></Field>
                                <Field label="Alamat" error={form.errors.customer_address}><Textarea rows={2} value={form.data.customer_address} onChange={(event) => form.setData('customer_address', event.target.value)} /></Field>
                                <Field label="Jaminan" error={form.errors.guarantee_note}><Input value={form.data.guarantee_note} onChange={(event) => form.setData('guarantee_note', event.target.value)} /></Field>
                            </div>

                            <div className="grid gap-4 md:grid-cols-4">
                                <Field label="Mulai Sewa" error={form.errors.starts_at}><Input type="datetime-local" value={form.data.starts_at} onChange={(event) => form.setData('starts_at', event.target.value)} /></Field>
                                <Field label="Lama Sewa (Hari)" error={form.errors.rental_days}><Input type="number" min="1" value={form.data.rental_days} onChange={(event) => form.setData('rental_days', event.target.value)} /></Field>
                                <Field label="Harus Kembali" error={form.errors.due_at}><Input type="datetime-local" value={form.data.due_at} onChange={(event) => form.setData('due_at', event.target.value)} /></Field>
                                <Field label="Pembayaran Gabungan" error={form.errors.paid_amount}><Input type="number" min="0" step="1000" value={form.data.paid_amount} onChange={(event) => form.setData('paid_amount', event.target.value)} /></Field>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Metode Pembayaran" error={form.errors.payment_method_config_id}>
                                    <Select value={form.data.payment_method_config_id || 'none'} onValueChange={(value) => form.setData('payment_method_config_id', value === 'none' ? '' : value)}>
                                        <SelectTrigger><SelectValue placeholder="Pilih metode pembayaran" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Belum dipilih</SelectItem>
                                            {paymentMethodOptions.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label} - {option.type_label}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field label="Alasan Override DP" error={form.errors.dp_override_reason}><Textarea rows={2} value={form.data.dp_override_reason} onChange={(event) => form.setData('dp_override_reason', event.target.value)} /></Field>
                            </div>

                            <Field label="Catatan" error={form.errors.notes}><Textarea rows={3} value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} /></Field>

                            <div className="grid gap-6 lg:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Unit Sewa</CardTitle>
                                        <CardDescription>Pilih ulang unit inventaris.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="relative">
                                            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Cari unit atau produk" className="pl-9" />
                                        </div>
                                        <InputError message={form.errors.inventory_unit_ids} />
                                        <div className="max-h-[24rem] space-y-2 overflow-auto rounded-2xl border p-3">
                                            {filteredUnits.map((unit) => {
                                                const selected = form.data.inventory_unit_ids.includes(unit.id);
                                                return (
                                                    <label key={unit.id} className={`flex items-start gap-3 rounded-xl border p-3 ${selected ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}>
                                                        <Checkbox checked={selected} onCheckedChange={(checked) => toggleUnit(unit.id, checked === true)} />
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2"><span className="font-medium">{unit.unit_code}</span><Badge variant="outline">{unit.status_label}</Badge></div>
                                                            <p className="text-muted-foreground text-sm">{unit.product_name} • {currencyFormatter.format(Number(unit.daily_rate || 0))}/hari</p>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Barang Jual</CardTitle>
                                        <CardDescription>Tambah produk atau ubah qty dari transaksi ini.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="relative">
                                            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari nama atau SKU" className="pl-9" />
                                        </div>

                                        <div className="max-h-48 space-y-2 overflow-auto rounded-2xl border p-3">
                                            {filteredSaleProducts.map((product) => (
                                                <button key={product.id} type="button" disabled={product.is_out_of_stock} onClick={() => addProduct(product)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${product.is_out_of_stock ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/40'}`}>
                                                    <div>
                                                        <p className="font-medium">{product.name}</p>
                                                        <p className="text-muted-foreground text-sm">{product.sku} • stok edit {product.editable_stock_qty}</p>
                                                    </div>
                                                    <span className="font-medium">{currencyFormatter.format(Number(product.selling_price || 0))}</span>
                                                </button>
                                            ))}
                                        </div>

                                        <InputError message={form.errors.sale_items} />
                                        <div className="space-y-2">
                                            {selectedSaleItems.length > 0 ? selectedSaleItems.map((item) => (
                                                <div key={item.sale_product_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                                                    <div>
                                                        <p className="font-medium">{item.product.name}</p>
                                                        <p className="text-muted-foreground text-sm">{item.product.sku}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button type="button" className="rounded border p-2" onClick={() => updateSaleQty(item.sale_product_id, String(Math.max(1, Number(item.qty || 0) - 1)))}><Minus className="h-4 w-4" /></button>
                                                        <Input className="w-16 text-center" value={item.qty} onChange={(event) => updateSaleQty(item.sale_product_id, event.target.value)} />
                                                        <button type="button" className="rounded border p-2" onClick={() => updateSaleQty(item.sale_product_id, String(Math.min(item.product.editable_stock_qty, Number(item.qty || 0) + 1)))}><Plus className="h-4 w-4" /></button>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => removeSaleItem(item.sale_product_id)}><X className="mr-2 h-4 w-4" />Hapus</Button>
                                                    </div>
                                                </div>
                                            )) : <div className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">Belum ada barang jual dipilih.</div>}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button type="button" variant="outline" asChild><Link href={route('admin.combined-orders.show', combinedOrder.id)}>Batal</Link></Button>
                                <Button type="submit" disabled={form.processing}>{form.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}Simpan Perubahan</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return <div className="grid gap-2"><Label>{label}</Label>{children}<InputError message={error} /></div>;
}
