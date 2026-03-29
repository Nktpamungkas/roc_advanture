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
import { Head, useForm, usePage } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
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

interface InventoryUnitForm {
    product_id: string;
    unit_code: string;
    status: string;
    notes: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Unit Inventaris', href: '/admin/inventory-units' },
];

export default function InventoryUnitsIndex({
    inventoryUnits,
    productOptions,
    statusOptions,
}: {
    inventoryUnits: InventoryUnitItem[];
    productOptions: Option[];
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

    const updateForm = useForm<InventoryUnitForm>({
        product_id: '',
        unit_code: '',
        status: '',
        notes: '',
    });

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

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();

        createForm.post(route('admin.inventory-units.store'), {
            preserveScroll: true,
            onSuccess: () => createForm.reset('unit_code', 'notes'),
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

    const noProductsYet = productOptions.length === 0;

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
                    <Card>
                        <CardHeader>
                            <CardTitle>Tambah Unit</CardTitle>
                            <CardDescription>Masukkan unit fisik baru yang siap dilacak per kode barang.</CardDescription>
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
                                    <Input id="create-unit-code" value={createForm.data.unit_code} onChange={(event) => createForm.setData('unit_code', event.target.value)} placeholder="TND-004" disabled={noProductsYet} />
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
                                    <Textarea id="create-notes" value={createForm.data.notes} onChange={(event) => createForm.setData('notes', event.target.value)} disabled={noProductsYet} placeholder="Misal: unit ini masih ada gores kecil" />
                                    <InputError message={createForm.errors.notes} />
                                </div>

                                <Button type="submit" className="w-full" disabled={createForm.processing || noProductsYet}>
                                    {createForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                    Simpan Unit
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Daftar Unit</CardTitle>
                            <CardDescription>Lihat status tiap unit fisik dan perbarui kondisinya saat operasional berjalan.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="overflow-x-auto rounded-xl border">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/40">
                                        <tr className="text-left">
                                            <th className="px-4 py-3 font-medium">Kode Unit</th>
                                            <th className="px-4 py-3 font-medium">Produk</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                            <th className="px-4 py-3 font-medium">Catatan</th>
                                            <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inventoryUnits.map((unit) => {
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
                                                        <Button type="button" variant={isActive ? 'secondary' : 'outline'} size="sm" onClick={() => setSelectedUnitId(unit.id)}>
                                                            Edit
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
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
