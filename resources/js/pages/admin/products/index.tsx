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

interface ProductItem {
    id: number;
    name: string;
    category: string | null;
    daily_rate: string;
    active: boolean;
    notes: string | null;
    inventory_units_count: number;
}

interface ProductForm {
    name: string;
    category: string;
    daily_rate: string;
    active: boolean;
    notes: string;
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

export default function ProductsIndex({ products }: { products: ProductItem[] }) {
    const { flash } = usePage<SharedData>().props;
    const [selectedProductId, setSelectedProductId] = useState<number | null>(products[0]?.id ?? null);

    const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId) ?? null, [products, selectedProductId]);

    const createForm = useForm<ProductForm>({
        name: '',
        category: '',
        daily_rate: '',
        active: true,
        notes: '',
    });

    const updateForm = useForm<ProductForm>({
        name: '',
        category: '',
        daily_rate: '',
        active: true,
        notes: '',
    });

    useEffect(() => {
        if (!selectedProduct) {
            updateForm.reset();
            return;
        }

        updateForm.setData({
            name: selectedProduct.name,
            category: selectedProduct.category ?? '',
            daily_rate: selectedProduct.daily_rate,
            active: selectedProduct.active,
            notes: selectedProduct.notes ?? '',
        });
        updateForm.clearErrors();
    }, [selectedProduct]);

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

    const formatCurrency = (value: string) => currencyFormatter.format(Number(value || 0));

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
                            <CardDescription>Pilih produk untuk melihat dan memperbarui detailnya.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="overflow-x-auto rounded-xl border">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/40">
                                        <tr className="text-left">
                                            <th className="px-4 py-3 font-medium">Produk</th>
                                            <th className="px-4 py-3 font-medium">Kategori</th>
                                            <th className="px-4 py-3 font-medium">Harga / hari</th>
                                            <th className="px-4 py-3 font-medium">Unit</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                            <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map((product) => {
                                            const isActive = selectedProductId === product.id;

                                            return (
                                                <tr key={product.id} className={isActive ? 'bg-muted/30' : ''}>
                                                    <td className="px-4 py-3 font-medium">{product.name}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{product.category || '-'}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{formatCurrency(product.daily_rate)}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{product.inventory_units_count}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={product.active ? 'default' : 'secondary'}>{product.active ? 'Aktif' : 'Nonaktif'}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button type="button" variant={isActive ? 'secondary' : 'outline'} size="sm" onClick={() => setSelectedProductId(product.id)}>
                                                            Edit
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
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
                                                <Label htmlFor="edit-rate">Harga Sewa per Hari</Label>
                                                <Input id="edit-rate" type="number" min="0" step="1000" value={updateForm.data.daily_rate} onChange={(event) => updateForm.setData('daily_rate', event.target.value)} />
                                                <InputError message={updateForm.errors.daily_rate} />
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
