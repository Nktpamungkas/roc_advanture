import InputError from '@/components/input-error';
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
import { CheckCheck, LoaderCircle, Search } from 'lucide-react';
import { FormEventHandler, useMemo, useState } from 'react';

interface SaleProductItem {
    id: number;
    sku: string;
    name: string;
    category: string | null;
    stock_qty: number;
    min_stock_qty: number;
    active: boolean;
}

interface InventoryUnitItem {
    id: number;
    product_name: string | null;
    unit_code: string;
    status: string;
    status_label: string;
}

interface OptionItem {
    value: string;
    label: string;
}

interface SessionItem {
    id: number;
    opname_no: string;
    performed_at: string | null;
    total_items: number;
    discrepancy_count: number;
    creator_name: string | null;
    notes: string | null;
}

interface OpnameSummary {
    sale_products_count: number;
    sale_stock_total: number;
    inventory_units_count: number;
    inventory_discrepancy_candidate_count: number;
}

interface SaleOpnameForm {
    performed_at: string;
    notes: string;
    items: Array<{
        sale_product_id: number;
        physical_qty: string;
    }>;
}

interface RentalOpnameForm {
    performed_at: string;
    notes: string;
    items: Array<{
        inventory_unit_id: number;
        observed_status: string;
    }>;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Stok Opname', href: '/admin/stock-opname' },
];

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const toDateTimeLocalValue = (date: Date) => {
    const timezoneOffset = date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

export default function StockOpnameIndex({
    saleProducts,
    inventoryUnits,
    inventoryStatusOptions,
    recentSalesSessions,
    recentRentalSessions,
    opnameSummary,
}: {
    saleProducts: SaleProductItem[];
    inventoryUnits: InventoryUnitItem[];
    inventoryStatusOptions: OptionItem[];
    recentSalesSessions: SessionItem[];
    recentRentalSessions: SessionItem[];
    opnameSummary: OpnameSummary;
}) {
    const { flash } = usePage<SharedData>().props;
    const [saleSearch, setSaleSearch] = useState('');
    const [rentalSearch, setRentalSearch] = useState('');
    const [rentalStatusFilter, setRentalStatusFilter] = useState('all');

    const saleForm = useForm<SaleOpnameForm>({
        performed_at: toDateTimeLocalValue(new Date()),
        notes: '',
        items: saleProducts.map((product) => ({
            sale_product_id: product.id,
            physical_qty: String(product.stock_qty),
        })),
    });

    const rentalForm = useForm<RentalOpnameForm>({
        performed_at: toDateTimeLocalValue(new Date()),
        notes: '',
        items: inventoryUnits.map((unit) => ({
            inventory_unit_id: unit.id,
            observed_status: unit.status,
        })),
    });

    const saleRows = useMemo(
        () =>
            saleProducts.map((product) => {
                const formItem = saleForm.data.items.find((item) => item.sale_product_id === product.id);
                const physicalQty = Number(formItem?.physical_qty ?? product.stock_qty);

                return {
                    ...product,
                    physical_qty: physicalQty,
                    difference_qty: physicalQty - product.stock_qty,
                };
            }),
        [saleForm.data.items, saleProducts],
    );

    const filteredSaleRows = useMemo(() => {
        const query = saleSearch.trim().toLowerCase();

        return saleRows.filter((row) =>
            query === '' ? true : [row.name, row.sku, row.category ?? ''].join(' ').toLowerCase().includes(query),
        );
    }, [saleRows, saleSearch]);

    const rentalRows = useMemo(
        () =>
            inventoryUnits.map((unit) => {
                const formItem = rentalForm.data.items.find((item) => item.inventory_unit_id === unit.id);
                const observedStatus = formItem?.observed_status ?? unit.status;

                return {
                    ...unit,
                    observed_status: observedStatus,
                    is_discrepancy: observedStatus !== unit.status,
                };
            }),
        [inventoryUnits, rentalForm.data.items],
    );

    const filteredRentalRows = useMemo(() => {
        const query = rentalSearch.trim().toLowerCase();

        return rentalRows.filter((row) => {
            const matchesSearch =
                query === '' ? true : [row.product_name ?? '', row.unit_code, row.status_label].join(' ').toLowerCase().includes(query);
            const matchesStatus = rentalStatusFilter === 'all' ? true : row.status === rentalStatusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [rentalRows, rentalSearch, rentalStatusFilter]);

    const saleDiscrepancyCount = saleRows.filter((row) => row.difference_qty !== 0).length;
    const rentalDiscrepancyCount = rentalRows.filter((row) => row.is_discrepancy).length;

    const updateSaleQty = (productId: number, value: string) => {
        saleForm.setData(
            'items',
            saleForm.data.items.map((item) =>
                item.sale_product_id === productId
                    ? { ...item, physical_qty: value === '' ? '0' : String(Math.max(0, Number(value) || 0)) }
                    : item,
            ),
        );
    };

    const updateObservedStatus = (unitId: number, status: string) => {
        rentalForm.setData(
            'items',
            rentalForm.data.items.map((item) => (item.inventory_unit_id === unitId ? { ...item, observed_status: status } : item)),
        );
    };

    const submitSaleOpname: FormEventHandler = (event) => {
        event.preventDefault();

        saleForm.post(route('admin.stock-opname.sales.store'), {
            preserveScroll: true,
            errorBag: 'saleStockOpname',
        });
    };

    const submitRentalOpname: FormEventHandler = (event) => {
        event.preventDefault();

        rentalForm.post(route('admin.stock-opname.rentals.store'), {
            preserveScroll: true,
            errorBag: 'rentalStockOpname',
        });
    };

    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Stok Opname" />

            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Stok Opname</h1>
                    <p className="text-muted-foreground text-sm">
                        Cocokkan stok fisik toko dengan data sistem untuk barang jual dan unit rental, lalu simpan koreksinya dengan jejak audit.
                    </p>
                </div>

                {flash.success && <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{flash.success}</div>}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard label="Produk Jual" value={opnameSummary.sale_products_count} description="Total SKU yang bisa diopname qty fisiknya." />
                    <SummaryCard label="Total Qty Jual" value={opnameSummary.sale_stock_total} description="Akumulasi qty sistem untuk seluruh produk jual." />
                    <SummaryCard label="Unit Rental" value={opnameSummary.inventory_units_count} description="Total unit inventaris rental yang tercatat di sistem." />
                    <SummaryCard
                        label="Butuh Perhatian"
                        value={opnameSummary.inventory_discrepancy_candidate_count}
                        description="Unit rental yang saat ini belum dicuci atau maintenance."
                    />
                </div>

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>Opname Stok Jual</CardTitle>
                        <CardDescription>Isi qty fisik sesuai hitungan nyata di toko. Sistem akan otomatis menyesuaikan stok dan menyimpan riwayat penyesuaiannya.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={submitSaleOpname} className="space-y-4">
                            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.5fr]">
                                <div className="grid gap-2">
                                    <Label htmlFor="sale-performed-at">Waktu Opname</Label>
                                    <Input id="sale-performed-at" type="datetime-local" value={saleForm.data.performed_at} onChange={(event) => saleForm.setData('performed_at', event.target.value)} />
                                    <InputError message={saleForm.errors.performed_at} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="sale-search">Cari Produk</Label>
                                    <div className="relative">
                                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                        <Input id="sale-search" value={saleSearch} onChange={(event) => setSaleSearch(event.target.value)} placeholder="Nama produk atau SKU" className="pl-9" />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="sale-notes">Catatan Sesi</Label>
                                    <Textarea id="sale-notes" value={saleForm.data.notes} onChange={(event) => saleForm.setData('notes', event.target.value)} placeholder="Opsional. Misal: opname akhir bulan atau setelah restock besar." className="min-h-24" />
                                    <InputError message={saleForm.errors.notes} />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                <Badge variant="secondary">{filteredSaleRows.length} produk tampil</Badge>
                                <Badge variant={saleDiscrepancyCount > 0 ? 'destructive' : 'secondary'}>{saleDiscrepancyCount} produk selisih</Badge>
                            </div>

                            <div className="overflow-hidden rounded-2xl border">
                                <div className="max-h-[32rem] overflow-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-muted/40 sticky top-0">
                                            <tr className="border-b text-left">
                                                <th className="px-4 py-3 font-medium">Produk</th>
                                                <th className="px-4 py-3 font-medium">Qty Sistem</th>
                                                <th className="px-4 py-3 font-medium">Qty Fisik</th>
                                                <th className="px-4 py-3 font-medium">Selisih</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSaleRows.length > 0 ? (
                                                filteredSaleRows.map((row) => (
                                                    <tr key={row.id} className="border-b">
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium">{row.name}</p>
                                                            <p className="text-muted-foreground mt-1 text-xs">{row.sku}{row.category ? ` • ${row.category}` : ''}</p>
                                                        </td>
                                                        <td className="px-4 py-3">{row.stock_qty}</td>
                                                        <td className="px-4 py-3">
                                                            <Input type="number" min={0} value={String(row.physical_qty)} onChange={(event) => updateSaleQty(row.id, event.target.value)} className="h-9 w-28" />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant={row.difference_qty === 0 ? 'secondary' : row.difference_qty > 0 ? 'default' : 'destructive'}>
                                                                {row.difference_qty > 0 ? `+${row.difference_qty}` : row.difference_qty}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                                                        Tidak ada produk jual yang cocok dengan pencarian.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <InputError message={saleForm.errors.items} />

                            <div className="flex justify-end">
                                <Button type="submit" disabled={saleForm.processing || saleProducts.length === 0}>
                                    {saleForm.processing && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan Opname Stok Jual
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>Opname Unit Rental</CardTitle>
                        <CardDescription>Cocokkan status unit fisik di lapangan dengan status yang tercatat di sistem. Jika berbeda, pilih status aktual yang benar.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={submitRentalOpname} className="space-y-4">
                            <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1.5fr]">
                                <div className="grid gap-2">
                                    <Label htmlFor="rental-performed-at">Waktu Opname</Label>
                                    <Input id="rental-performed-at" type="datetime-local" value={rentalForm.data.performed_at} onChange={(event) => rentalForm.setData('performed_at', event.target.value)} />
                                    <InputError message={rentalForm.errors.performed_at} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="rental-search">Cari Unit</Label>
                                    <div className="relative">
                                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                        <Input id="rental-search" value={rentalSearch} onChange={(event) => setRentalSearch(event.target.value)} placeholder="Kode unit atau produk" className="pl-9" />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="rental-status-filter">Filter Status Sistem</Label>
                                    <Select value={rentalStatusFilter} onValueChange={setRentalStatusFilter}>
                                        <SelectTrigger id="rental-status-filter">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua status</SelectItem>
                                            {inventoryStatusOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="rental-notes">Catatan Sesi</Label>
                                    <Textarea id="rental-notes" value={rentalForm.data.notes} onChange={(event) => rentalForm.setData('notes', event.target.value)} placeholder="Opsional. Misal: opname gudang akhir high season." className="min-h-24" />
                                    <InputError message={rentalForm.errors.notes} />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                <Badge variant="secondary">{filteredRentalRows.length} unit tampil</Badge>
                                <Badge variant={rentalDiscrepancyCount > 0 ? 'destructive' : 'secondary'}>{rentalDiscrepancyCount} unit selisih status</Badge>
                            </div>

                            <div className="overflow-hidden rounded-2xl border">
                                <div className="max-h-[32rem] overflow-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-muted/40 sticky top-0">
                                            <tr className="border-b text-left">
                                                <th className="px-4 py-3 font-medium">Unit</th>
                                                <th className="px-4 py-3 font-medium">Status Sistem</th>
                                                <th className="px-4 py-3 font-medium">Status Aktual</th>
                                                <th className="px-4 py-3 font-medium">Hasil</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRentalRows.length > 0 ? (
                                                filteredRentalRows.map((row) => (
                                                    <tr key={row.id} className="border-b">
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium">{row.unit_code}</p>
                                                            <p className="text-muted-foreground mt-1 text-xs">{row.product_name ?? '-'}</p>
                                                        </td>
                                                        <td className="px-4 py-3">{row.status_label}</td>
                                                        <td className="px-4 py-3">
                                                            <Select value={row.observed_status} onValueChange={(value) => updateObservedStatus(row.id, value)}>
                                                                <SelectTrigger className="w-52">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {inventoryStatusOptions.map((option) => (
                                                                        <SelectItem key={option.value} value={option.value}>
                                                                            {option.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {row.is_discrepancy ? <Badge variant="destructive">Perlu Update</Badge> : <Badge variant="secondary"><CheckCheck className="mr-1 h-3.5 w-3.5" />Sesuai</Badge>}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                                                        Tidak ada unit rental yang cocok dengan filter ini.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <InputError message={rentalForm.errors.items} />

                            <div className="flex justify-end">
                                <Button type="submit" disabled={rentalForm.processing || inventoryUnits.length === 0}>
                                    {rentalForm.processing && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan Opname Unit Rental
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-2">
                    <HistoryCard title="Riwayat Opname Stok Jual" description="Sesi opname penjualan terakhir yang sudah disimpan." sessions={recentSalesSessions} formatDateTime={formatDateTime} />
                    <HistoryCard title="Riwayat Opname Unit Rental" description="Sesi opname rental terakhir yang sudah disimpan." sessions={recentRentalSessions} formatDateTime={formatDateTime} />
                </div>
            </div>
        </AppLayout>
    );
}

function SummaryCard({ label, value, description }: { label: string; value: string | number; description: string }) {
    return (
        <Card className="rounded-3xl">
            <CardContent className="p-5">
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
                <p className="text-muted-foreground mt-2 text-xs">{description}</p>
            </CardContent>
        </Card>
    );
}

function HistoryCard({
    title,
    description,
    sessions,
    formatDateTime,
}: {
    title: string;
    description: string;
    sessions: SessionItem[];
    formatDateTime: (value: string | null) => string;
}) {
    return (
        <Card className="rounded-3xl">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-hidden rounded-2xl border">
                    <div className="max-h-[22rem] overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-muted/40 sticky top-0">
                                <tr className="border-b text-left">
                                    <th className="px-4 py-3 font-medium">No Opname</th>
                                    <th className="px-4 py-3 font-medium">Waktu</th>
                                    <th className="px-4 py-3 font-medium">Selisih</th>
                                    <th className="px-4 py-3 font-medium">Petugas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.length > 0 ? (
                                    sessions.map((session) => (
                                        <tr key={session.id} className="border-b align-top">
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{session.opname_no}</p>
                                                <p className="text-muted-foreground mt-1 text-xs">{session.total_items} item</p>
                                            </td>
                                            <td className="px-4 py-3">{formatDateTime(session.performed_at)}</td>
                                            <td className="px-4 py-3">{session.discrepancy_count}</td>
                                            <td className="px-4 py-3">
                                                <p>{session.creator_name ?? '-'}</p>
                                                {session.notes && <p className="text-muted-foreground mt-1 text-xs">{session.notes}</p>}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                                            Belum ada riwayat opname.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
