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
import { ArrowUpDown, CheckCheck, LoaderCircle, ShieldAlert } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface RentalItemSummary {
    id: number;
    product_name: string;
    inventory_unit_code: string | null;
    status_at_checkout: string;
    status_at_checkout_label: string;
}

interface ActiveRentalItem {
    id: number;
    rental_no: string;
    customer_name: string | null;
    customer_phone: string | null;
    starts_at: string | null;
    due_at: string | null;
    total_days: number;
    subtotal: string;
    remaining_amount: string;
    is_overdue: boolean;
    items: RentalItemSummary[];
}

interface RecentReturnItem {
    id: number;
    rental_no: string | null;
    customer_name: string | null;
    returned_at: string | null;
    items_count: number;
}

interface ReturnSummary {
    active_rentals: number;
    overdue_rentals: number;
    returned_today: number;
    rented_units: number;
}

interface Option {
    value: string;
    label: string;
}

interface ReturnFormItem {
    rental_item_id: number;
    next_unit_status: string;
    notes: string;
}

interface ReturnForm {
    rental_id: string;
    returned_at: string;
    notes: string;
    items: ReturnFormItem[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pengembalian', href: '/admin/returns' },
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

const buildDefaultReturnedAt = () => {
    const now = new Date();
    now.setSeconds(0, 0);

    return toDateTimeLocalValue(now);
};

export default function ReturnsIndex({
    activeRentals,
    recentReturns,
    returnSummary,
    returnStatusOptions,
    returnConditionLabels,
}: {
    activeRentals: ActiveRentalItem[];
    recentReturns: RecentReturnItem[];
    returnSummary: ReturnSummary;
    returnStatusOptions: Option[];
    returnConditionLabels: Record<string, string>;
}) {
    const { flash } = usePage<SharedData>().props;
    const [selectedRentalId, setSelectedRentalId] = useState<number | null>(activeRentals[0]?.id ?? null);

    const selectedRental = useMemo(
        () => activeRentals.find((rental) => rental.id === selectedRentalId) ?? null,
        [activeRentals, selectedRentalId],
    );

    const returnForm = useForm<ReturnForm>({
        rental_id: selectedRental ? String(selectedRental.id) : '',
        returned_at: buildDefaultReturnedAt(),
        notes: '',
        items: selectedRental
            ? selectedRental.items.map((item) => ({
                  rental_item_id: item.id,
                  next_unit_status: 'ready_unclean',
                  notes: '',
              }))
            : [],
    });

    useEffect(() => {
        if (activeRentals.some((rental) => rental.id === selectedRentalId)) {
            return;
        }

        setSelectedRentalId(activeRentals[0]?.id ?? null);
    }, [activeRentals, selectedRentalId]);

    useEffect(() => {
        if (!selectedRental) {
            returnForm.setData({
                rental_id: '',
                returned_at: buildDefaultReturnedAt(),
                notes: '',
                items: [],
            });
            return;
        }

        returnForm.setData({
            rental_id: String(selectedRental.id),
            returned_at: buildDefaultReturnedAt(),
            notes: '',
            items: selectedRental.items.map((item) => ({
                rental_item_id: item.id,
                next_unit_status: 'ready_unclean',
                notes: '',
            })),
        });
        returnForm.clearErrors();
    }, [selectedRental]);

    const updateItem = (index: number, updater: (item: ReturnFormItem) => ReturnFormItem) => {
        returnForm.setData(
            'items',
            returnForm.data.items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)),
        );
    };

    const applyStatusToAll = (status: string) => {
        returnForm.setData(
            'items',
            returnForm.data.items.map((item) => ({
                ...item,
                next_unit_status: status,
            })),
        );
    };

    const submitReturn: FormEventHandler = (event) => {
        event.preventDefault();

        returnForm.post(route('admin.returns.store'), {
            preserveScroll: true,
        });
    };

    const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0));
    const formatDateTime = (value: string | null) => (value ? dateTimeFormatter.format(new Date(value)) : '-');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pengembalian" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Operasional return rental</p>
                    <h1 className="mt-2 text-2xl font-semibold">Pengembalian</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Proses satu transaksi pengembalian sekaligus. Default status item setelah kembali adalah <span className="font-medium">Ready Belum Dicuci</span> agar alur cuci tetap tercatat.
                    </p>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Pengembalian tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Rental Aktif</p>
                        <p className="mt-2 text-2xl font-semibold">{returnSummary.active_rentals}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Overdue</p>
                        <p className="mt-2 text-2xl font-semibold">{returnSummary.overdue_rentals}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Kembali Hari Ini</p>
                        <p className="mt-2 text-2xl font-semibold">{returnSummary.returned_today}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Unit Disewa</p>
                        <p className="mt-2 text-2xl font-semibold">{returnSummary.rented_units}</p>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
                    <div className="grid gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Rental Aktif</CardTitle>
                                <CardDescription>Pilih transaksi yang ingin dikembalikan. Transaksi overdue ditandai agar admin mudah memprioritaskan.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {activeRentals.length > 0 ? (
                                    <div className="grid max-h-[32rem] gap-3 overflow-auto">
                                        {activeRentals.map((rental) => {
                                            const isSelected = rental.id === selectedRentalId;

                                            return (
                                                <button
                                                    key={rental.id}
                                                    type="button"
                                                    onClick={() => setSelectedRentalId(rental.id)}
                                                    className={`rounded-2xl border p-4 text-left transition ${
                                                        isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/40'
                                                    }`}
                                                >
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-semibold">{rental.rental_no}</p>
                                                            <p className="text-muted-foreground mt-1 text-sm">
                                                                {rental.customer_name ?? '-'} • {rental.items.length} item
                                                            </p>
                                                            <p className="text-muted-foreground mt-1 text-xs">
                                                                {formatDateTime(rental.starts_at)} sampai {formatDateTime(rental.due_at)}
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2">
                                                            {rental.is_overdue && (
                                                                <Badge variant="destructive">
                                                                    <ShieldAlert className="h-3.5 w-3.5" />
                                                                    Overdue
                                                                </Badge>
                                                            )}
                                                            <Badge variant="outline">{formatCurrency(rental.subtotal)}</Badge>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 grid gap-1 text-xs text-muted-foreground">
                                                        <p>Sisa tagihan: {formatCurrency(rental.remaining_amount)}</p>
                                                        <p>Kontak customer: {rental.customer_phone ?? '-'}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">
                                        Tidak ada transaksi aktif yang perlu diproses pengembaliannya sekarang.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Pengembalian Terbaru</CardTitle>
                                <CardDescription>Riwayat ringkas untuk memastikan transaksi return yang baru diproses sudah tercatat.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {recentReturns.length > 0 ? (
                                    <div className="grid gap-3">
                                        {recentReturns.map((returnRecord) => (
                                            <div key={returnRecord.id} className="rounded-2xl border p-4 text-sm">
                                                <p className="font-medium">{returnRecord.rental_no ?? '-'}</p>
                                                <p className="text-muted-foreground mt-1">{returnRecord.customer_name ?? '-'} • {returnRecord.items_count} item</p>
                                                <p className="text-muted-foreground mt-1 text-xs">{formatDateTime(returnRecord.returned_at)}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">
                                        Belum ada pengembalian yang diproses.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Form Pengembalian</CardTitle>
                            <CardDescription>
                                {selectedRental
                                    ? `Proses pengembalian untuk transaksi ${selectedRental.rental_no}.`
                                    : 'Pilih salah satu rental aktif di sisi kiri untuk mulai memproses pengembalian.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {selectedRental ? (
                                <form className="grid gap-6" onSubmit={submitReturn}>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="rounded-2xl border p-4 text-sm">
                                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Customer</p>
                                            <p className="mt-2 font-medium">{selectedRental.customer_name ?? '-'}</p>
                                            <p className="text-muted-foreground mt-1">{selectedRental.customer_phone ?? '-'}</p>
                                            <p className="text-muted-foreground mt-3 text-xs">
                                                Total sewa {formatCurrency(selectedRental.subtotal)} • sisa {formatCurrency(selectedRental.remaining_amount)}
                                            </p>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="returned-at">Waktu Pengembalian</Label>
                                            <Input
                                                id="returned-at"
                                                type="datetime-local"
                                                value={returnForm.data.returned_at}
                                                onChange={(event) => returnForm.setData('returned_at', event.target.value)}
                                            />
                                            <InputError message={returnForm.errors.returned_at} />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <Button type="button" variant="outline" onClick={() => applyStatusToAll('ready_unclean')}>
                                            <ArrowUpDown className="h-4 w-4" />
                                            Semua Ready Belum Dicuci
                                        </Button>
                                        <Button type="button" variant="outline" onClick={() => applyStatusToAll('ready_clean')}>
                                            <CheckCheck className="h-4 w-4" />
                                            Semua Ready Bersih
                                        </Button>
                                    </div>

                                    <div className="grid gap-4">
                                        {selectedRental.items.map((item, index) => {
                                            const formItem = returnForm.data.items[index];
                                            const itemErrors = {
                                                next_unit_status: returnForm.errors[`items.${index}.next_unit_status` as keyof typeof returnForm.errors],
                                                notes: returnForm.errors[`items.${index}.notes` as keyof typeof returnForm.errors],
                                            };
                                            const nextStatus = formItem?.next_unit_status ?? 'ready_unclean';
                                            const requiresAttention = ['maintenance', 'retired'].includes(nextStatus);

                                            return (
                                                <div key={item.id} className="rounded-2xl border p-4">
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                        <div>
                                                            <p className="font-medium">{item.product_name}</p>
                                                            <p className="text-muted-foreground mt-1 text-sm">
                                                                {item.inventory_unit_code ?? '-'} • keluar sebagai {item.status_at_checkout_label}
                                                            </p>
                                                        </div>
                                                        {requiresAttention && (
                                                            <Badge variant="secondary">{returnConditionLabels.damaged}</Badge>
                                                        )}
                                                    </div>

                                                    <div className="mt-4 grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                                                        <div className="grid gap-2">
                                                            <Label htmlFor={`item-status-${item.id}`}>Status Setelah Kembali</Label>
                                                            <Select
                                                                value={nextStatus}
                                                                onValueChange={(value) =>
                                                                    updateItem(index, (currentItem) => ({
                                                                        ...currentItem,
                                                                        next_unit_status: value,
                                                                    }))
                                                                }
                                                            >
                                                                <SelectTrigger id={`item-status-${item.id}`}>
                                                                    <SelectValue placeholder="Pilih status" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {returnStatusOptions.map((option) => (
                                                                        <SelectItem key={option.value} value={option.value}>
                                                                            {option.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <InputError message={itemErrors.next_unit_status as string | undefined} />
                                                        </div>

                                                        <div className="grid gap-2">
                                                            <Label htmlFor={`item-notes-${item.id}`}>
                                                                Catatan Item
                                                                {requiresAttention ? ' (Wajib)' : ''}
                                                            </Label>
                                                            <Textarea
                                                                id={`item-notes-${item.id}`}
                                                                value={formItem?.notes ?? ''}
                                                                onChange={(event) =>
                                                                    updateItem(index, (currentItem) => ({
                                                                        ...currentItem,
                                                                        notes: event.target.value,
                                                                    }))
                                                                }
                                                                placeholder={
                                                                    requiresAttention
                                                                        ? 'Jelaskan kondisi unit, misalnya sobek, patah, atau perlu maintenance'
                                                                        : 'Opsional, misalnya masih basah atau perlu dicek ulang'
                                                                }
                                                            />
                                                            <InputError message={itemErrors.notes as string | undefined} />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="return-notes">Catatan Pengembalian</Label>
                                        <Textarea
                                            id="return-notes"
                                            value={returnForm.data.notes}
                                            onChange={(event) => returnForm.setData('notes', event.target.value)}
                                            placeholder="Catatan umum untuk seluruh transaksi pengembalian"
                                        />
                                        <InputError message={returnForm.errors.notes} />
                                    </div>

                                    <InputError message={returnForm.errors.items as string | undefined} />
                                    <InputError message={returnForm.errors.rental_id} />

                                    <Button type="submit" className="w-full md:w-auto" disabled={returnForm.processing}>
                                        {returnForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                        Proses Pengembalian
                                    </Button>
                                </form>
                            ) : (
                                <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">
                                    Belum ada rental aktif yang bisa diproses.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
