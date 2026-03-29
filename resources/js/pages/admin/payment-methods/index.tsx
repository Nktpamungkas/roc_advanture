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
import { ChevronLeft, ChevronRight, CreditCard, LoaderCircle, Search, X } from 'lucide-react';
import { ChangeEvent, FormEventHandler, useEffect, useMemo, useState } from 'react';

interface PaymentMethodItem {
    id: number;
    name: string;
    type: string;
    type_label: string;
    code: string;
    bank_name: string | null;
    account_number: string | null;
    account_name: string | null;
    qr_image_path: string | null;
    instructions: string | null;
    active: boolean;
    sort_order: number;
}

interface Option {
    value: string;
    label: string;
}

interface Filters {
    search: string;
    type: string;
    status: string;
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
    total_methods: number;
    active_methods: number;
    qris_methods: number;
}

interface MethodForm {
    name: string;
    type: string;
    code: string;
    bank_name: string;
    account_number: string;
    account_name: string;
    qr_image: File | null;
    instructions: string;
    active: boolean;
    sort_order: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Metode Pembayaran', href: '/admin/payment-methods' },
];

export default function PaymentMethodsIndex({
    paymentMethods,
    paymentMethodFilters,
    paymentMethodPagination,
    paymentMethodSummary,
    paymentMethodTypeOptions,
}: {
    paymentMethods: PaymentMethodItem[];
    paymentMethodFilters: Filters;
    paymentMethodPagination: Pagination;
    paymentMethodSummary: Summary;
    paymentMethodTypeOptions: Option[];
}) {
    const { flash } = usePage<SharedData>().props;
    const [selectedMethodId, setSelectedMethodId] = useState<number | null>(paymentMethods[0]?.id ?? null);
    const selectedMethod = useMemo(() => paymentMethods.find((method) => method.id === selectedMethodId) ?? null, [paymentMethods, selectedMethodId]);

    const createForm = useForm<MethodForm>({ name: '', type: paymentMethodTypeOptions[0]?.value ?? 'cash', code: '', bank_name: '', account_number: '', account_name: '', qr_image: null, instructions: '', active: true, sort_order: '0' });
    const updateForm = useForm<MethodForm>({ name: '', type: 'cash', code: '', bank_name: '', account_number: '', account_name: '', qr_image: null, instructions: '', active: true, sort_order: '0' });
    const filterForm = useForm({ search: paymentMethodFilters.search, type: paymentMethodFilters.type, status: paymentMethodFilters.status, per_page: String(paymentMethodFilters.per_page) });

    useEffect(() => {
        if (!selectedMethod) {
            updateForm.reset();
            return;
        }

        updateForm.setData({ name: selectedMethod.name, type: selectedMethod.type, code: selectedMethod.code, bank_name: selectedMethod.bank_name ?? '', account_number: selectedMethod.account_number ?? '', account_name: selectedMethod.account_name ?? '', qr_image: null, instructions: selectedMethod.instructions ?? '', active: selectedMethod.active, sort_order: String(selectedMethod.sort_order) });
        updateForm.clearErrors();
    }, [selectedMethod]);

    const assignFile = (setter: typeof createForm | typeof updateForm, event: ChangeEvent<HTMLInputElement>) => {
        setter.setData('qr_image', event.target.files?.[0] ?? null);
    };

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();
        createForm.post(route('admin.payment-methods.store'), { preserveScroll: true, forceFormData: true, onSuccess: () => createForm.reset() });
    };

    const submitUpdate: FormEventHandler = (event) => {
        event.preventDefault();
        if (!selectedMethod) return;
        updateForm.patch(route('admin.payment-methods.update', selectedMethod.id), { preserveScroll: true, forceFormData: true });
    };

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();
        router.get(route('admin.payment-methods.index'), { search: filterForm.data.search || undefined, type: filterForm.data.type || undefined, status: filterForm.data.status || undefined, per_page: filterForm.data.per_page }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const resetFilters = () => {
        filterForm.setData({ search: '', type: '', status: '', per_page: '10' });
        router.get(route('admin.payment-methods.index'), { per_page: 10 }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const goToPage = (page: number) => {
        router.get(route('admin.payment-methods.index'), { search: paymentMethodFilters.search || undefined, type: paymentMethodFilters.type || undefined, status: paymentMethodFilters.status || undefined, per_page: paymentMethodFilters.per_page, page }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const pages = useMemo(() => {
        if (paymentMethodPagination.last_page <= 1) return [1];
        const start = Math.max(1, paymentMethodPagination.current_page - 2);
        const end = Math.min(paymentMethodPagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);
        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [paymentMethodPagination.current_page, paymentMethodPagination.last_page]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Metode Pembayaran" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Konfigurasi pembayaran</p>
                    <h1 className="mt-2 text-2xl font-semibold">Metode Pembayaran</h1>
                </section>

                {flash.success && <Alert><AlertTitle>Perubahan tersimpan</AlertTitle><AlertDescription>{flash.success}</AlertDescription></Alert>}

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">Total Metode</p><p className="mt-2 text-2xl font-semibold">{paymentMethodSummary.total_methods}</p></div>
                    <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">Aktif</p><p className="mt-2 text-2xl font-semibold">{paymentMethodSummary.active_methods}</p></div>
                    <div className="rounded-2xl border p-4"><p className="text-muted-foreground text-xs uppercase tracking-wide">QRIS</p><p className="mt-2 text-2xl font-semibold">{paymentMethodSummary.qris_methods}</p></div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
                    <Card>
                        <CardHeader><CardTitle>Tambah Metode</CardTitle><CardDescription>Khusus super-admin.</CardDescription></CardHeader>
                        <CardContent>
                            <form className="grid gap-4" onSubmit={submitCreate}>
                                <InputGroup label="Nama" value={createForm.data.name} onChange={(value) => createForm.setData('name', value)} error={createForm.errors.name} />
                                <div className="grid gap-4 md:grid-cols-2">
                                    <SelectGroup label="Tipe" value={createForm.data.type} onChange={(value) => createForm.setData('type', value)} options={paymentMethodTypeOptions} error={createForm.errors.type} />
                                    <InputGroup label="Kode" value={createForm.data.code} onChange={(value) => createForm.setData('code', value)} error={createForm.errors.code} />
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <InputGroup label="Nama Bank" value={createForm.data.bank_name} onChange={(value) => createForm.setData('bank_name', value)} error={createForm.errors.bank_name} />
                                    <InputGroup label="No. Rekening" value={createForm.data.account_number} onChange={(value) => createForm.setData('account_number', value)} error={createForm.errors.account_number} />
                                </div>
                                <InputGroup label="Atas Nama" value={createForm.data.account_name} onChange={(value) => createForm.setData('account_name', value)} error={createForm.errors.account_name} />
                                <div className="grid gap-2"><Label htmlFor="create-qr">Upload QRIS</Label><Input id="create-qr" type="file" accept="image/*" onChange={(event) => assignFile(createForm, event)} /><InputError message={createForm.errors.qr_image as string | undefined} /></div>
                                <div className="grid gap-2"><Label htmlFor="create-instructions">Instruksi</Label><Textarea id="create-instructions" rows={3} value={createForm.data.instructions} onChange={(event) => createForm.setData('instructions', event.target.value)} /><InputError message={createForm.errors.instructions} /></div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <InputGroup label="Urutan" value={createForm.data.sort_order} onChange={(value) => createForm.setData('sort_order', value)} error={createForm.errors.sort_order} type="number" />
                                    <Select value={createForm.data.active ? 'active' : 'inactive'} onValueChange={(value) => createForm.setData('active', value === 'active')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Aktif</SelectItem><SelectItem value="inactive">Nonaktif</SelectItem></SelectContent></Select>
                                </div>
                                <Button type="submit" disabled={createForm.processing}>{createForm.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}Simpan Metode</Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="gap-4">
                            <div><CardTitle>Daftar Metode</CardTitle><CardDescription>Pilih satu metode untuk diedit.</CardDescription></div>
                            <form className="grid gap-3 md:grid-cols-[1fr_9rem_9rem_9rem_auto]" onSubmit={submitFilters}>
                                <div className="relative"><Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" /><Input value={filterForm.data.search} onChange={(event) => filterForm.setData('search', event.target.value)} className="pl-9" placeholder="Cari metode" /></div>
                                <Select value={filterForm.data.type || 'all'} onValueChange={(value) => filterForm.setData('type', value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua tipe</SelectItem>{paymentMethodTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
                                <Select value={filterForm.data.status || 'all'} onValueChange={(value) => filterForm.setData('status', value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem><SelectItem value="active">Aktif</SelectItem><SelectItem value="inactive">Nonaktif</SelectItem></SelectContent></Select>
                                <Select value={filterForm.data.per_page} onValueChange={(value) => filterForm.setData('per_page', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[10, 15, 25, 50].map((option) => <SelectItem key={option} value={String(option)}>{option} baris</SelectItem>)}</SelectContent></Select>
                                <Button type="button" variant="outline" onClick={resetFilters}><X className="mr-2 h-4 w-4" />Reset</Button>
                            </form>
                        </CardHeader>
                        <CardContent className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                            <div className="grid max-h-[34rem] gap-3 overflow-auto">
                                {paymentMethods.map((method) => <button key={method.id} type="button" onClick={() => setSelectedMethodId(method.id)} className={`rounded-2xl border p-4 text-left transition ${selectedMethodId === method.id ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{method.name}</p><Badge variant={method.active ? 'outline' : 'secondary'}>{method.active ? 'Aktif' : 'Nonaktif'}</Badge></div><p className="text-muted-foreground mt-1 text-sm">{method.type_label}</p></button>)}
                            </div>

                            <div className="rounded-2xl border p-4">
                                {selectedMethod ? (
                                    <form className="grid gap-4" onSubmit={submitUpdate}>
                                        <InputGroup label="Nama" value={updateForm.data.name} onChange={(value) => updateForm.setData('name', value)} error={updateForm.errors.name} />
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <SelectGroup label="Tipe" value={updateForm.data.type} onChange={(value) => updateForm.setData('type', value)} options={paymentMethodTypeOptions} error={updateForm.errors.type} />
                                            <InputGroup label="Kode" value={updateForm.data.code} onChange={(value) => updateForm.setData('code', value)} error={updateForm.errors.code} />
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <InputGroup label="Nama Bank" value={updateForm.data.bank_name} onChange={(value) => updateForm.setData('bank_name', value)} error={updateForm.errors.bank_name} />
                                            <InputGroup label="No. Rekening" value={updateForm.data.account_number} onChange={(value) => updateForm.setData('account_number', value)} error={updateForm.errors.account_number} />
                                        </div>
                                        <InputGroup label="Atas Nama" value={updateForm.data.account_name} onChange={(value) => updateForm.setData('account_name', value)} error={updateForm.errors.account_name} />
                                        {selectedMethod.qr_image_path && <img src={selectedMethod.qr_image_path} alt={selectedMethod.name} className="h-40 w-40 rounded-xl border object-contain p-2" />}
                                        <div className="grid gap-2"><Label htmlFor="edit-qr">Ganti QRIS</Label><Input id="edit-qr" type="file" accept="image/*" onChange={(event) => assignFile(updateForm, event)} /><InputError message={updateForm.errors.qr_image as string | undefined} /></div>
                                        <div className="grid gap-2"><Label htmlFor="edit-instructions">Instruksi</Label><Textarea id="edit-instructions" rows={3} value={updateForm.data.instructions} onChange={(event) => updateForm.setData('instructions', event.target.value)} /><InputError message={updateForm.errors.instructions} /></div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <InputGroup label="Urutan" value={updateForm.data.sort_order} onChange={(value) => updateForm.setData('sort_order', value)} error={updateForm.errors.sort_order} type="number" />
                                            <Select value={updateForm.data.active ? 'active' : 'inactive'} onValueChange={(value) => updateForm.setData('active', value === 'active')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Aktif</SelectItem><SelectItem value="inactive">Nonaktif</SelectItem></SelectContent></Select>
                                        </div>
                                        <Button type="submit" disabled={updateForm.processing}>{updateForm.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}Update Metode</Button>
                                    </form>
                                ) : <p className="text-muted-foreground text-sm">Pilih metode pembayaran di sebelah kiri untuk mulai edit.</p>}
                            </div>
                        </CardContent>

                        {paymentMethodPagination.last_page > 1 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-6">
                                <p className="text-muted-foreground text-sm">Halaman {paymentMethodPagination.current_page} dari {paymentMethodPagination.last_page}</p>
                                <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" size="icon" disabled={paymentMethodPagination.current_page <= 1} onClick={() => goToPage(paymentMethodPagination.current_page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                                    {pages.map((page) => <Button key={page} type="button" variant={page === paymentMethodPagination.current_page ? 'default' : 'outline'} size="sm" onClick={() => goToPage(page)}>{page}</Button>)}
                                    <Button type="button" variant="outline" size="icon" disabled={paymentMethodPagination.current_page >= paymentMethodPagination.last_page} onClick={() => goToPage(paymentMethodPagination.current_page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

function InputGroup({ label, value, onChange, error, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; error?: string; type?: string }) {
    return <div className="grid gap-2"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /><InputError message={error} /></div>;
}

function SelectGroup({ label, value, onChange, options, error }: { label: string; value: string; onChange: (value: string) => void; options: Option[]; error?: string }) {
    return <div className="grid gap-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><InputError message={error} /></div>;
}
