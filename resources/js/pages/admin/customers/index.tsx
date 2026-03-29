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
import { ChevronLeft, ChevronRight, LoaderCircle, Search, X } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface CustomerItem {
    id: number;
    name: string;
    phone_whatsapp: string;
    address: string | null;
    notes: string | null;
    rentals_count: number;
    rating: {
        score: number;
        label: string;
        total_rentals: number;
        completed_rentals: number;
        overdue_returns: number;
        damaged_returns: number;
    };
}

interface CustomerForm {
    name: string;
    phone_whatsapp: string;
    address: string;
    notes: string;
}

interface CustomerFilters {
    search: string;
    per_page: number;
}

interface CustomerPagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface CustomerSummary {
    total_customers: number;
    filtered_customers: number;
    total_rentals: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Customer', href: '/admin/customers' },
];

export default function CustomersIndex({
    customers,
    customerFilters,
    customerPagination,
    customerSummary,
}: {
    customers: CustomerItem[];
    customerFilters: CustomerFilters;
    customerPagination: CustomerPagination;
    customerSummary: CustomerSummary;
}) {
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

    const filterForm = useForm({
        search: customerFilters.search,
        per_page: String(customerFilters.per_page),
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

    useEffect(() => {
        if (customers.some((customer) => customer.id === selectedCustomerId)) {
            return;
        }

        setSelectedCustomerId(customers[0]?.id ?? null);
    }, [customers, selectedCustomerId]);

    useEffect(() => {
        filterForm.setData({
            search: customerFilters.search,
            per_page: String(customerFilters.per_page),
        });
    }, [customerFilters.per_page, customerFilters.search]);

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

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.customers.index'),
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
            route('admin.customers.index'),
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
            route('admin.customers.index'),
            {
                search: customerFilters.search || undefined,
                per_page: customerFilters.per_page,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const paginationPages = useMemo(() => {
        if (customerPagination.last_page <= 1) {
            return [1];
        }

        const start = Math.max(1, customerPagination.current_page - 2);
        const end = Math.min(customerPagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);

        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [customerPagination.current_page, customerPagination.last_page]);

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
                            <CardDescription>Cari customer lebih cepat tanpa harus scroll panjang saat data penyewa mulai banyak.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Customer</p>
                                    <p className="mt-2 text-2xl font-semibold">{customerSummary.total_customers}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Hasil Filter</p>
                                    <p className="mt-2 text-2xl font-semibold">{customerSummary.filtered_customers}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Rental</p>
                                    <p className="mt-2 text-2xl font-semibold">{customerSummary.total_rentals}</p>
                                </div>
                            </div>

                            <form className="rounded-2xl border p-4" onSubmit={submitFilters}>
                                <div className="grid gap-4 xl:grid-cols-[1.6fr_0.7fr]">
                                    <div className="grid gap-2">
                                        <Label htmlFor="customer-search">Cari Customer</Label>
                                        <div className="relative">
                                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input
                                                id="customer-search"
                                                value={filterForm.data.search}
                                                onChange={(event) => filterForm.setData('search', event.target.value)}
                                                placeholder="Cari nama, nomor WA, atau alamat"
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="customer-per-page">Baris / Halaman</Label>
                                        <Select value={filterForm.data.per_page} onValueChange={(value) => filterForm.setData('per_page', value)}>
                                            <SelectTrigger id="customer-per-page">
                                                <SelectValue placeholder="10" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="15">15</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-3">
                                    <Button type="submit">Terapkan Filter</Button>
                                    <Button type="button" variant="outline" onClick={resetFilters}>
                                        <X className="h-4 w-4" />
                                        Reset
                                    </Button>
                                </div>
                            </form>

                            <div className="rounded-xl border">
                                <div className="max-h-[28rem] overflow-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-muted/60 sticky top-0 z-10 backdrop-blur">
                                            <tr className="text-left">
                                                <th className="px-4 py-3 font-medium">Nama</th>
                                                <th className="px-4 py-3 font-medium">WhatsApp</th>
                                                <th className="px-4 py-3 font-medium">Alamat</th>
                                                <th className="px-4 py-3 font-medium">Riwayat Sewa</th>
                                                <th className="px-4 py-3 font-medium">Rating</th>
                                                <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {customers.length > 0 ? (
                                                customers.map((customer) => {
                                                    const isActive = selectedCustomerId === customer.id;

                                                    return (
                                                        <tr key={customer.id} className={isActive ? 'bg-muted/30' : ''}>
                                                            <td className="px-4 py-3 font-medium">{customer.name}</td>
                                                            <td className="px-4 py-3 text-muted-foreground">{customer.phone_whatsapp}</td>
                                                            <td className="px-4 py-3 text-muted-foreground">{customer.address || '-'}</td>
                                                            <td className="px-4 py-3 text-muted-foreground">{customer.rentals_count}</td>
                                                            <td className="px-4 py-3">
                                                                <Badge variant="outline">{customer.rating.label}</Badge>
                                                            </td>
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
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center">
                                                        Tidak ada customer yang cocok dengan filter saat ini.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-muted-foreground text-sm">
                                    Menampilkan {customerPagination.from ?? 0} - {customerPagination.to ?? 0} dari {customerPagination.total} customer.
                                </p>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(customerPagination.current_page - 1)}
                                        disabled={customerPagination.current_page <= 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Prev
                                    </Button>

                                    {paginationPages.map((page) => (
                                        <Button
                                            key={page}
                                            type="button"
                                            variant={page === customerPagination.current_page ? 'secondary' : 'outline'}
                                            size="sm"
                                            onClick={() => goToPage(page)}
                                        >
                                            {page}
                                        </Button>
                                    ))}

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(customerPagination.current_page + 1)}
                                        disabled={customerPagination.current_page >= customerPagination.last_page}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {selectedCustomer ? (
                                <div className="rounded-2xl border p-5">
                                    <div>
                                        <h2 className="text-lg font-semibold">Edit Customer</h2>
                                        <p className="text-muted-foreground text-sm">
                                            {selectedCustomer.name} dengan {selectedCustomer.rentals_count} riwayat transaksi rental.
                                        </p>
                                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                                            <Badge variant="outline">{selectedCustomer.rating.label}</Badge>
                                            <span className="text-muted-foreground">Skor {selectedCustomer.rating.score}/100</span>
                                            <span className="text-muted-foreground">Overdue {selectedCustomer.rating.overdue_returns}</span>
                                            <span className="text-muted-foreground">Reject/Rusak {selectedCustomer.rating.damaged_returns}</span>
                                        </div>
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
