import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, LoaderCircle, Save, Search } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface CustomerOption { id: number; name: string; phone_whatsapp: string; address: string | null; }
interface AvailableUnitItem { id: number; product_name: string | null; unit_code: string; status: string; status_label: string; daily_rate: string; notes: string | null; }
interface SeasonRuleItem { name: string; start_date: string; end_date: string; dp_required: boolean; dp_type: string | null; dp_value: string | null; }
interface PaymentMethodOption { value: string; label: string; type_label: string; instructions: string | null; bank_name: string | null; account_number: string | null; account_name: string | null; qr_image_path: string | null; }

interface RentalEditData {
    id: number; rental_no: string; customer_id: string; customer_name: string; customer_phone_whatsapp: string; customer_address: string;
    guarantee_note: string; starts_at: string | null; due_at: string | null; rental_days: string; inventory_unit_ids: number[];
    payment_method_config_id: string; dp_override_reason: string; notes: string; paid_amount: string; payment_status_label: string;
}

interface RentalForm {
    customer_id: string; customer_name: string; customer_phone_whatsapp: string; customer_address: string; guarantee_note: string;
    starts_at: string; rental_days: string; due_at: string; inventory_unit_ids: number[]; payment_method_config_id: string; dp_override_reason: string; notes: string;
}

type DurationSource = 'rental_days' | 'due_at';

const currencyFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const toDateTimeLocalValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
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

export default function EditRentalPage({ rental, customers, availableUnits, seasonRules, paymentMethodOptions }: {
    rental: RentalEditData; customers: CustomerOption[]; availableUnits: AvailableUnitItem[]; seasonRules: SeasonRuleItem[]; paymentMethodOptions: PaymentMethodOption[];
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Penyewaan', href: '/admin/rentals' },
        { title: rental.rental_no, href: route('admin.rentals.show', rental.id) },
        { title: 'Edit Transaksi', href: route('admin.rentals.edit', rental.id) },
    ];
    const [unitSearch, setUnitSearch] = useState('');
    const [durationSource, setDurationSource] = useState<DurationSource>('due_at');
    const [options, setOptions] = useState(paymentMethodOptions);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const form = useForm<RentalForm>({
        customer_id: rental.customer_id, customer_name: rental.customer_name, customer_phone_whatsapp: rental.customer_phone_whatsapp, customer_address: rental.customer_address,
        guarantee_note: rental.guarantee_note, starts_at: rental.starts_at ?? '', rental_days: rental.rental_days, due_at: rental.due_at ?? '',
        inventory_unit_ids: rental.inventory_unit_ids, payment_method_config_id: rental.payment_method_config_id, dp_override_reason: rental.dp_override_reason, notes: rental.notes,
    });

    const selectedUnits = useMemo(() => availableUnits.filter((unit) => form.data.inventory_unit_ids.includes(unit.id)), [availableUnits, form.data.inventory_unit_ids]);
    const filteredUnits = useMemo(() => {
        const query = unitSearch.trim().toLowerCase();
        return availableUnits.filter((unit) => query === '' ? true : [unit.product_name ?? '', unit.unit_code, unit.status_label, unit.notes ?? ''].join(' ').toLowerCase().includes(query));
    }, [availableUnits, unitSearch]);
    const groupedUnits = useMemo(() => filteredUnits.reduce<Record<string, AvailableUnitItem[]>>((groups, unit) => {
        const key = unit.product_name ?? 'Produk tanpa nama'; groups[key] ??= []; groups[key].push(unit); return groups;
    }, {}), [filteredUnits]);

    const exactCustomerMatch = useMemo(() => customers.find((customer) => customer.phone_whatsapp.trim() === form.data.customer_phone_whatsapp.trim()) ?? null, [customers, form.data.customer_phone_whatsapp]);
    useEffect(() => { form.setData('customer_id', exactCustomerMatch ? String(exactCustomerMatch.id) : ''); }, [exactCustomerMatch]);
    useEffect(() => { setOptions(paymentMethodOptions); }, [paymentMethodOptions]);
    useEffect(() => { if (durationSource === 'rental_days') { const next = calculateDueAtValue(form.data.starts_at, form.data.rental_days); if (next !== form.data.due_at) form.setData('due_at', next); } }, [durationSource, form, form.data.due_at, form.data.rental_days, form.data.starts_at]);
    useEffect(() => { if (durationSource === 'due_at') { const next = calculateRentalDaysValue(form.data.starts_at, form.data.due_at); if (next !== form.data.rental_days) form.setData('rental_days', next); } }, [durationSource, form, form.data.due_at, form.data.rental_days, form.data.starts_at]);

    const totalDays = Math.max(0, Number(form.data.rental_days || 0));
    const subtotal = useMemo(() => selectedUnits.reduce((sum, unit) => sum + Number(unit.daily_rate || 0) * totalDays, 0), [selectedUnits, totalDays]);
    const matchedSeasonRule = useMemo(() => {
        const rentalDate = form.data.starts_at.slice(0, 10);
        const matches = seasonRules.filter((seasonRule) => rentalDate >= seasonRule.start_date && rentalDate <= seasonRule.end_date);
        return matches.length > 0 ? matches[matches.length - 1] : null;
    }, [form.data.starts_at, seasonRules]);
    const requiredDpAmount = useMemo(() => {
        if (!matchedSeasonRule?.dp_required) return 0;
        return matchedSeasonRule.dp_type === 'fixed_amount' ? Math.min(subtotal, Number(matchedSeasonRule.dp_value || 0)) : Math.min(subtotal, subtotal * (Number(matchedSeasonRule.dp_value || 0) / 100));
    }, [matchedSeasonRule, subtotal]);
    const paidAmount = Number(rental.paid_amount || 0);
    const remainingAmount = Math.max(0, subtotal - paidAmount);
    const dpRequirementUnmet = matchedSeasonRule?.dp_required === true && selectedUnits.length > 0 && totalDays > 0 && subtotal > 0 && paidAmount < requiredDpAmount;
    const selectedPaymentMethod = useMemo(() => options.find((option) => option.value === form.data.payment_method_config_id) ?? null, [form.data.payment_method_config_id, options]);

    const refreshPaymentMethodOptions = async (open: boolean) => {
        if (!open || loadingOptions) return;
        setLoadingOptions(true);
        try {
            const response = await fetch('/admin/payment-methods/options', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
            if (!response.ok) throw new Error('Gagal memuat metode pembayaran terbaru.');
            const data = (await response.json()) as { payment_method_options?: PaymentMethodOption[] };
            const nextOptions = data.payment_method_options ?? [];
            setOptions(nextOptions);
            if (nextOptions.length === 0) { form.setData('payment_method_config_id', ''); return; }
            if (!nextOptions.some((option) => option.value === form.data.payment_method_config_id)) form.setData('payment_method_config_id', nextOptions[0]?.value ?? '');
        } catch (error) { console.error(error); } finally { setLoadingOptions(false); }
    };

    const submit: FormEventHandler = (event) => { event.preventDefault(); form.put(route('admin.rentals.update', rental.id)); };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${rental.rental_no}`} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-muted-foreground text-sm">Perubahan transaksi aktif</p>
                            <h1 className="mt-2 text-2xl font-semibold">Edit Transaksi Rental</h1>
                            <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">Ubah data customer, jadwal, unit inventaris, dan metode pembayaran. Pembayaran yang sudah tercatat tetap dipertahankan.</p>
                        </div>
                        <Button asChild variant="outline"><Link href={route('admin.rentals.show', rental.id)}><ArrowLeft className="h-4 w-4" />Kembali ke Invoice</Link></Button>
                    </div>
                </section>

                <Alert>
                    <AlertTitle>Pembayaran existing dipertahankan</AlertTitle>
                    <AlertDescription>Total dan sisa tagihan akan dihitung ulang dari perubahan terbaru, tetapi nominal yang sudah dibayar tetap mengikuti riwayat pembayaran sebelumnya.</AlertDescription>
                </Alert>

                <form className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]" onSubmit={submit}>
                    <div className="grid gap-6 rounded-2xl border p-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2"><Label htmlFor="customer-name">Nama Customer</Label><Input id="customer-name" value={form.data.customer_name} onChange={(event) => form.setData('customer_name', event.target.value)} /><InputError message={form.errors.customer_name} /></div>
                            <div className="grid gap-2"><Label htmlFor="customer-phone">Nomor WhatsApp</Label><Input id="customer-phone" value={form.data.customer_phone_whatsapp} onChange={(event) => form.setData('customer_phone_whatsapp', event.target.value)} /><InputError message={form.errors.customer_phone_whatsapp} /></div>
                            <div className="grid gap-2 md:col-span-2"><Label htmlFor="customer-address">Alamat</Label><Textarea id="customer-address" rows={3} value={form.data.customer_address} onChange={(event) => form.setData('customer_address', event.target.value)} /><InputError message={form.errors.customer_address} /></div>
                            <div className="grid gap-2 md:col-span-2"><Label htmlFor="guarantee-note">Jaminan</Label><Input id="guarantee-note" value={form.data.guarantee_note} onChange={(event) => form.setData('guarantee_note', event.target.value)} placeholder="Contoh: KTP, SIM C, STNK motor" /><InputError message={form.errors.guarantee_note} /></div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="grid gap-2"><Label htmlFor="starts-at">Mulai Sewa</Label><Input id="starts-at" type="datetime-local" value={form.data.starts_at} onChange={(event) => form.setData('starts_at', event.target.value)} /><InputError message={form.errors.starts_at} /></div>
                            <div className="grid gap-2"><Label htmlFor="rental-days">Lama Sewa (Hari)</Label><Input id="rental-days" type="number" min="1" value={form.data.rental_days} onChange={(event) => { setDurationSource('rental_days'); form.setData('rental_days', event.target.value); }} /><InputError message={form.errors.rental_days} /></div>
                            <div className="grid gap-2"><Label htmlFor="due-at">Harus Kembali</Label><Input id="due-at" type="datetime-local" value={form.data.due_at} onChange={(event) => { setDurationSource('due_at'); form.setData('due_at', event.target.value); }} /><InputError message={form.errors.due_at} /></div>
                        </div>

                        {matchedSeasonRule?.dp_required && (
                            <Alert variant={dpRequirementUnmet ? 'destructive' : 'default'}>
                                <AlertTitle>{dpRequirementUnmet ? 'High Season: DP Di Bawah Rekomendasi' : 'High Season Aktif'}</AlertTitle>
                                <AlertDescription>{dpRequirementUnmet ? `Masuk season ${matchedSeasonRule.name}. Rekomendasi DP ${currencyFormatter.format(requiredDpAmount)}. Isi alasan override kalau mau lanjut.` : `Masuk season ${matchedSeasonRule.name}. Rekomendasi DP ${currencyFormatter.format(requiredDpAmount)}.`}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid gap-3 rounded-2xl border p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div><h2 className="text-lg font-semibold">Pilih Unit Inventaris</h2><p className="text-muted-foreground text-sm">Unit yang sudah dipakai transaksi ini tetap muncul supaya bisa dipertahankan atau diganti.</p></div>
                                <div className="relative w-full md:max-w-xs"><Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" /><Input value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Cari unit atau produk" className="pl-9" /></div>
                            </div>
                            <InputError message={form.errors.inventory_unit_ids} />
                            <div className="max-h-[28rem] overflow-auto rounded-xl border">
                                {filteredUnits.length > 0 ? (
                                    <div className="grid gap-4 p-4">
                                        {Object.entries(groupedUnits).map(([productName, units]) => (
                                            <div key={productName} className="rounded-2xl border p-4">
                                                <div className="mb-3"><h3 className="font-medium">{productName}</h3><p className="text-muted-foreground text-sm">{units.length} unit tampil</p></div>
                                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                    {units.map((unit) => {
                                                        const isSelected = form.data.inventory_unit_ids.includes(unit.id);
                                                        return (
                                                            <label key={unit.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}>
                                                                <Checkbox checked={isSelected} onCheckedChange={(checked) => form.setData('inventory_unit_ids', checked === true ? [...form.data.inventory_unit_ids, unit.id] : form.data.inventory_unit_ids.filter((selectedId) => selectedId !== unit.id))} />
                                                                <div className="grid flex-1 gap-2">
                                                                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{unit.unit_code}</p><InventoryStatusBadge status={unit.status} label={unit.status_label} /></div>
                                                                    <p className="text-muted-foreground text-sm">{currencyFormatter.format(Number(unit.daily_rate || 0))} / hari</p>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="text-muted-foreground p-6 text-sm">Tidak ada unit yang cocok dengan pencarian saat ini.</div>}
                            </div>
                        </div>

                        <div className="grid gap-2"><Label htmlFor="notes">Catatan Transaksi</Label><Textarea id="notes" rows={3} value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} /><InputError message={form.errors.notes} /></div>
                    </div>

                    <div className="grid gap-6">
                        <div className="rounded-2xl border p-6">
                            <div className="grid gap-2">
                                <Label htmlFor="payment-method-config">Metode Pembayaran</Label>
                                <Select value={form.data.payment_method_config_id || 'none'} onValueChange={(value) => form.setData('payment_method_config_id', value === 'none' ? '' : value)} onOpenChange={(open) => void refreshPaymentMethodOptions(open)}>
                                    <SelectTrigger id="payment-method-config"><SelectValue placeholder="Pilih metode pembayaran" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Belum dipilih</SelectItem>
                                        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label} • {option.type_label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <p className="text-muted-foreground text-xs">{loadingOptions ? 'Memuat metode pembayaran terbaru...' : 'Daftar akan dicek ulang saat dropdown dibuka.'}</p>
                                <InputError message={form.errors.payment_method_config_id} />
                            </div>
                            {dpRequirementUnmet && (
                                <div className="mt-4 grid gap-2">
                                    <Label htmlFor="dp-override-reason">Alasan Override DP</Label>
                                    <Textarea id="dp-override-reason" rows={3} value={form.data.dp_override_reason} onChange={(event) => form.setData('dp_override_reason', event.target.value)} />
                                    <InputError message={form.errors.dp_override_reason} />
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border p-4 text-sm">
                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Ringkasan Baru</p>
                            <div className="mt-3 grid gap-2">
                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Unit Dipilih</span><span>{selectedUnits.length}</span></div>
                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Durasi</span><span>{totalDays} hari</span></div>
                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Total Baru</span><span>{currencyFormatter.format(subtotal)}</span></div>
                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Sudah Dibayar</span><span>{currencyFormatter.format(paidAmount)}</span></div>
                                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Status Bayar</span><span>{rental.payment_status_label}</span></div>
                                <div className="flex items-center justify-between gap-3 border-t pt-3 font-medium"><span>Sisa Baru</span><span>{currencyFormatter.format(remainingAmount)}</span></div>
                            </div>
                            {selectedPaymentMethod && (
                                <div className="mt-4 rounded-xl border p-3 text-xs text-muted-foreground">
                                    <p className="font-medium text-foreground">{selectedPaymentMethod.label}</p>
                                    {selectedPaymentMethod.bank_name && <p>{selectedPaymentMethod.bank_name} • {selectedPaymentMethod.account_number}</p>}
                                    {selectedPaymentMethod.instructions && <p className="mt-1">{selectedPaymentMethod.instructions}</p>}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={form.processing || selectedUnits.length === 0 || totalDays <= 0 || (dpRequirementUnmet && form.data.dp_override_reason.trim() === '')}>
                                {form.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Simpan Perubahan
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
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
