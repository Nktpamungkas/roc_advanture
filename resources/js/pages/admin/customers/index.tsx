import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface CustomerItem {
    id: number;
    name: string;
    phone_whatsapp: string;
    address: string | null;
    notes: string | null;
    rentals_count: number;
}

interface CustomerForm {
    name: string;
    phone_whatsapp: string;
    address: string;
    notes: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Customer', href: '/admin/customers' },
];

export default function CustomersIndex({ customers }: { customers: CustomerItem[] }) {
    const { flash } = usePage<SharedData>().props;
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(customers[0]?.id ?? null);

    const selectedCustomer = useMemo(
        () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
        [customers, selectedCustomerId],
    );

    const createForm = useForm<CustomerForm>({
        name: '',
        phone_whatsapp: '',
        address: '',
        notes: '',
    });

    const updateForm = useForm<CustomerForm>({
        name: '',
        phone_whatsapp: '',
        address: '',
        notes: '',
    });

    useEffect(() => {
        if (!selectedCustomer) {
            updateForm.reset();
            return;
        }

        updateForm.setData({
            name: selectedCustomer.name,
            phone_whatsapp: selectedCustomer.phone_whatsapp,
            address: selectedCustomer.address ?? '',
            notes: selectedCustomer.notes ?? '',
        });
        updateForm.clearErrors();
    }, [selectedCustomer]);

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();

        createForm.post(route('admin.customers.store'), {
            preserveScroll: true,
            onSuccess: () => createForm.reset(),
        });
    };

    const submitUpdate: FormEventHandler = (event) => {
        event.preventDefault();

        if (!selectedCustomer) {
            return;
        }

        updateForm.patch(route('admin.customers.update', selectedCustomer.id), {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Customer" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Data penyewa</p>
                    <h1 className="mt-2 text-2xl font-semibold">Customer</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Simpan data customer agar transaksi sewa, reminder WhatsApp, dan riwayat penyewaan tercatat rapi sejak awal.
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
                            <CardTitle>Tambah Customer</CardTitle>
                            <CardDescription>Masukkan data penyewa yang akan dipakai saat membuat transaksi rental.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-4" onSubmit={submitCreate}>
                                <div className="grid gap-2">
                                    <Label htmlFor="create-name">Nama Customer</Label>
                                    <Input
                                        id="create-name"
                                        value={createForm.data.name}
                                        onChange={(event) => createForm.setData('name', event.target.value)}
                                        placeholder="Nama lengkap customer"
                                    />
                                    <InputError message={createForm.errors.name} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-phone">Nomor WhatsApp</Label>
                                    <Input
                                        id="create-phone"
                                        value={createForm.data.phone_whatsapp}
                                        onChange={(event) => createForm.setData('phone_whatsapp', event.target.value)}
                                        placeholder="08xxxxxxxxxx"
                                    />
                                    <InputError message={createForm.errors.phone_whatsapp} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-address">Alamat</Label>
                                    <Textarea
                                        id="create-address"
                                        value={createForm.data.address}
                                        onChange={(event) => createForm.setData('address', event.target.value)}
                                        placeholder="Alamat singkat customer"
                                    />
                                    <InputError message={createForm.errors.address} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-notes">Catatan</Label>
                                    <Textarea
                                        id="create-notes"
                                        value={createForm.data.notes}
                                        onChange={(event) => createForm.setData('notes', event.target.value)}
                                        placeholder="Catatan tambahan, misalnya preferensi atau info penting"
                                    />
                                    <InputError message={createForm.errors.notes} />
                                </div>

                                <Button type="submit" className="w-full" disabled={createForm.processing}>
                                    {createForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                    Simpan Customer
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Daftar Customer</CardTitle>
                            <CardDescription>Pilih customer untuk memperbarui data kontak dan catatannya.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="overflow-x-auto rounded-xl border">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/40">
                                        <tr className="text-left">
                                            <th className="px-4 py-3 font-medium">Nama</th>
                                            <th className="px-4 py-3 font-medium">WhatsApp</th>
                                            <th className="px-4 py-3 font-medium">Alamat</th>
                                            <th className="px-4 py-3 font-medium">Riwayat Sewa</th>
                                            <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customers.map((customer) => {
                                            const isActive = selectedCustomerId === customer.id;

                                            return (
                                                <tr key={customer.id} className={isActive ? 'bg-muted/30' : ''}>
                                                    <td className="px-4 py-3 font-medium">{customer.name}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{customer.phone_whatsapp}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{customer.address || '-'}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{customer.rentals_count}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            type="button"
                                                            variant={isActive ? 'secondary' : 'outline'}
                                                            size="sm"
                                                            onClick={() => setSelectedCustomerId(customer.id)}
                                                        >
                                                            Edit
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {selectedCustomer ? (
                                <div className="rounded-2xl border p-5">
                                    <div>
                                        <h2 className="text-lg font-semibold">Edit Customer</h2>
                                        <p className="text-muted-foreground text-sm">
                                            {selectedCustomer.name} dengan {selectedCustomer.rentals_count} riwayat transaksi rental.
                                        </p>
                                    </div>

                                    <form className="mt-5 grid gap-4" onSubmit={submitUpdate}>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-name">Nama Customer</Label>
                                                <Input
                                                    id="edit-name"
                                                    value={updateForm.data.name}
                                                    onChange={(event) => updateForm.setData('name', event.target.value)}
                                                />
                                                <InputError message={updateForm.errors.name} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-phone">Nomor WhatsApp</Label>
                                                <Input
                                                    id="edit-phone"
                                                    value={updateForm.data.phone_whatsapp}
                                                    onChange={(event) => updateForm.setData('phone_whatsapp', event.target.value)}
                                                />
                                                <InputError message={updateForm.errors.phone_whatsapp} />
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit-address">Alamat</Label>
                                            <Textarea
                                                id="edit-address"
                                                value={updateForm.data.address}
                                                onChange={(event) => updateForm.setData('address', event.target.value)}
                                            />
                                            <InputError message={updateForm.errors.address} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit-notes">Catatan</Label>
                                            <Textarea
                                                id="edit-notes"
                                                value={updateForm.data.notes}
                                                onChange={(event) => updateForm.setData('notes', event.target.value)}
                                            />
                                            <InputError message={updateForm.errors.notes} />
                                        </div>

                                        <Button type="submit" className="w-full sm:w-auto" disabled={updateForm.processing}>
                                            {updateForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                            Update Customer
                                        </Button>
                                    </form>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                    Belum ada customer yang bisa diedit.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
