import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Search, Trash2, X } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

type HistoryTab = 'reminders' | 'invoices';

interface HistoryFilters {
    search: string;
    status: string;
    per_page: number;
}

interface StatusOption {
    value: string;
    label: string;
}

interface HistorySummary {
    total: number;
    sent: number;
    pending: number;
    failed: number;
}

interface HistoryItem {
    id: number;
    rental_id: number | null;
    rental_no: string | null;
    combined_order_id: number | null;
    combined_no: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    phone: string;
    message_type: string;
    message_type_label: string;
    scheduled_at: string | null;
    sent_at: string | null;
    created_at: string | null;
    due_at: string | null;
    status: string;
    status_label: string;
    provider_message_id: string | null;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'History WhatsApp', href: '/admin/whatsapp-history' },
];

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function WhatsappHistoryIndex({
    activeTab,
    statusOptions,
    reminderFilters,
    invoiceFilters,
    reminderSummary,
    invoiceSummary,
    reminders,
    invoices,
    reminderPagination,
    invoicePagination,
}: {
    activeTab: HistoryTab;
    statusOptions: StatusOption[];
    reminderFilters: HistoryFilters;
    invoiceFilters: HistoryFilters;
    reminderSummary: HistorySummary;
    invoiceSummary: HistorySummary;
    reminders: HistoryItem[];
    invoices: HistoryItem[];
    reminderPagination: PaginationMeta;
    invoicePagination: PaginationMeta;
}) {
    const { flash } = usePage<SharedData>().props;
    const [selectedReminderIds, setSelectedReminderIds] = useState<number[]>([]);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
    const reminderForm = useForm({
        search: reminderFilters.search,
        status: reminderFilters.status,
        per_page: String(reminderFilters.per_page),
    });

    const invoiceForm = useForm({
        search: invoiceFilters.search,
        status: invoiceFilters.status,
        per_page: String(invoiceFilters.per_page),
    });

    useEffect(() => {
        reminderForm.setData({
            search: reminderFilters.search,
            status: reminderFilters.status,
            per_page: String(reminderFilters.per_page),
        });
    }, [reminderFilters.per_page, reminderFilters.search, reminderFilters.status]);

    useEffect(() => {
        invoiceForm.setData({
            search: invoiceFilters.search,
            status: invoiceFilters.status,
            per_page: String(invoiceFilters.per_page),
        });
    }, [invoiceFilters.per_page, invoiceFilters.search, invoiceFilters.status]);

    useEffect(() => {
        const visibleIds = new Set(reminders.map((row) => row.id));
        setSelectedReminderIds((current) => current.filter((id) => visibleIds.has(id)));
    }, [reminders]);

    useEffect(() => {
        const visibleIds = new Set(invoices.map((row) => row.id));
        setSelectedInvoiceIds((current) => current.filter((id) => visibleIds.has(id)));
    }, [invoices]);

    const buildHistoryParams = (tab: HistoryTab, overrides: Record<string, string | number | undefined> = {}) => ({
        tab,
        reminder_search: reminderFilters.search || undefined,
        reminder_status: reminderFilters.status === 'all' ? undefined : reminderFilters.status,
        reminder_per_page: reminderFilters.per_page,
        invoice_search: invoiceFilters.search || undefined,
        invoice_status: invoiceFilters.status === 'all' ? undefined : invoiceFilters.status,
        invoice_per_page: invoiceFilters.per_page,
        ...overrides,
    });

    const submitReminderFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.whatsapp-history.index'),
            buildHistoryParams('reminders', {
                reminder_search: reminderForm.data.search || undefined,
                reminder_status: reminderForm.data.status === 'all' ? undefined : reminderForm.data.status,
                reminder_per_page: Number(reminderForm.data.per_page),
                reminder_page: 1,
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const submitInvoiceFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.whatsapp-history.index'),
            buildHistoryParams('invoices', {
                invoice_search: invoiceForm.data.search || undefined,
                invoice_status: invoiceForm.data.status === 'all' ? undefined : invoiceForm.data.status,
                invoice_per_page: Number(invoiceForm.data.per_page),
                invoice_page: 1,
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const switchTab = (tab: HistoryTab) => {
        router.get(route('admin.whatsapp-history.index'), buildHistoryParams(tab), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetReminderFilters = () => {
        reminderForm.setData({
            search: '',
            status: 'all',
            per_page: '10',
        });

        router.get(
            route('admin.whatsapp-history.index'),
            buildHistoryParams('reminders', {
                reminder_search: undefined,
                reminder_status: undefined,
                reminder_per_page: 10,
                reminder_page: 1,
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const resetInvoiceFilters = () => {
        invoiceForm.setData({
            search: '',
            status: 'all',
            per_page: '10',
        });

        router.get(
            route('admin.whatsapp-history.index'),
            buildHistoryParams('invoices', {
                invoice_search: undefined,
                invoice_status: undefined,
                invoice_per_page: 10,
                invoice_page: 1,
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const reminderPages = useMemo(() => buildPaginationPages(reminderPagination), [reminderPagination]);
    const invoicePages = useMemo(() => buildPaginationPages(invoicePagination), [invoicePagination]);

    const goToReminderPage = (page: number) => {
        router.get(
            route('admin.whatsapp-history.index'),
            buildHistoryParams('reminders', {
                reminder_page: page,
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const goToInvoicePage = (page: number) => {
        router.get(
            route('admin.whatsapp-history.index'),
            buildHistoryParams('invoices', {
                invoice_page: page,
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const activeSummary = activeTab === 'reminders' ? reminderSummary : invoiceSummary;

    const deleteHistoryRow = (id: number) => {
        if (!window.confirm('Hapus history WhatsApp ini? Tindakan ini tidak bisa dibatalkan.')) {
            return;
        }

        router.delete(route('admin.whatsapp-history.destroy', id), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const toggleReminderRow = (id: number, checked: boolean) => {
        setSelectedReminderIds((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((itemId) => itemId !== id)));
    };

    const toggleInvoiceRow = (id: number, checked: boolean) => {
        setSelectedInvoiceIds((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((itemId) => itemId !== id)));
    };

    const toggleReminderPage = (checked: boolean) => {
        setSelectedReminderIds(checked ? reminders.map((row) => row.id) : []);
    };

    const toggleInvoicePage = (checked: boolean) => {
        setSelectedInvoiceIds(checked ? invoices.map((row) => row.id) : []);
    };

    const deleteSelectedRows = (tab: HistoryTab) => {
        const selectedIds = tab === 'reminders' ? selectedReminderIds : selectedInvoiceIds;

        if (selectedIds.length === 0) {
            return;
        }

        if (!window.confirm(`Hapus ${selectedIds.length} history WhatsApp yang dipilih?`)) {
            return;
        }

        router.delete(route('admin.whatsapp-history.destroy-selected'), {
            data: { tab, ids: selectedIds },
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                if (tab === 'reminders') {
                    setSelectedReminderIds([]);
                    return;
                }

                setSelectedInvoiceIds([]);
            },
        });
    };

    const deleteAllRows = (tab: HistoryTab) => {
        const totalRows = tab === 'reminders' ? reminderSummary.total : invoiceSummary.total;

        if (totalRows === 0) {
            return;
        }

        if (!window.confirm(`Hapus semua data pada tab ${tab === 'reminders' ? 'Reminder Jatuh Tempo' : 'Invoice via WA'}?`)) {
            return;
        }

        router.delete(route('admin.whatsapp-history.destroy-all'), {
            data: { tab },
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                if (tab === 'reminders') {
                    setSelectedReminderIds([]);
                    return;
                }

                setSelectedInvoiceIds([]);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="History WhatsApp" />

            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">History WhatsApp</h1>
                    <p className="text-muted-foreground text-sm">
                        Pantau reminder jatuh tempo dan invoice mana saja yang sudah pernah dikirim ke customer lewat WhatsApp.
                    </p>
                </div>

                {flash.success && <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{flash.success}</div>}
                {flash.error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{flash.error}</div>}

                <div className="inline-flex w-full flex-wrap gap-2 rounded-2xl border bg-muted/20 p-2 md:w-auto">
                    <button
                        type="button"
                        onClick={() => switchTab('reminders')}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                            activeTab === 'reminders' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:bg-background/70',
                        )}
                    >
                        Reminder Jatuh Tempo
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{reminderSummary.total}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => switchTab('invoices')}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                            activeTab === 'invoices' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:bg-background/70',
                        )}
                    >
                        Invoice via WA
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{invoiceSummary.total}</span>
                    </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard label="Total Log" value={activeSummary.total} description="Jumlah log pada tab aktif setelah filter diterapkan." />
                    <SummaryCard label="Terkirim" value={activeSummary.sent} description="Pesan berhasil dikirim ke WhatsApp customer." />
                    <SummaryCard label="Pending" value={activeSummary.pending} description="Pesan sudah tercatat tetapi belum berhasil selesai diproses." />
                    <SummaryCard label="Gagal" value={activeSummary.failed} description="Pesan gagal dikirim dan perlu dicek ulang bila perlu." />
                </div>

                {activeTab === 'reminders' ? (
                    <div className="space-y-6">
                        <Card className="rounded-3xl">
                            <CardHeader>
                                <CardTitle>Filter Reminder Jatuh Tempo</CardTitle>
                                <CardDescription>Cari berdasarkan customer, nomor rental, nomor WA, provider ID, atau status pengiriman reminder.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={submitReminderFilters} className="grid gap-4 lg:grid-cols-[1.6fr_repeat(2,minmax(0,1fr))_auto]">
                                    <div className="grid gap-2">
                                        <Label htmlFor="reminder-search">Cari Reminder</Label>
                                        <div className="relative">
                                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input
                                                id="reminder-search"
                                                value={reminderForm.data.search}
                                                onChange={(event) => reminderForm.setData('search', event.target.value)}
                                                placeholder="Customer, rental, no. WA, atau provider ID"
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="reminder-status">Status</Label>
                                        <Select value={reminderForm.data.status} onValueChange={(value) => reminderForm.setData('status', value)}>
                                            <SelectTrigger id="reminder-status">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {statusOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="reminder-per-page">Baris / Halaman</Label>
                                        <Select value={reminderForm.data.per_page} onValueChange={(value) => reminderForm.setData('per_page', value)}>
                                            <SelectTrigger id="reminder-per-page">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {['10', '15', '25', '50'].map((option) => (
                                                    <SelectItem key={option} value={option}>
                                                        {option}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex flex-wrap items-end justify-end gap-3">
                                        <Button type="button" variant="outline" onClick={resetReminderFilters}>
                                            <X className="mr-2 h-4 w-4" />
                                            Reset
                                        </Button>
                                        <Button type="submit">Terapkan Filter</Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <HistoryTable
                            title="Riwayat Reminder Jatuh Tempo"
                            description="Daftar customer yang pernah diingatkan karena waktu sewa mereka sudah mendekati jatuh tempo."
                            rows={reminders}
                            pagination={reminderPagination}
                            pages={reminderPages}
                            emptyMessage="Belum ada reminder jatuh tempo yang tercatat."
                            dateColumnLabel="Harus Kembali"
                            getDateValue={(row) => row.due_at}
                            onPageChange={goToReminderPage}
                            onDeleteRow={deleteHistoryRow}
                            selectedIds={selectedReminderIds}
                            onToggleRow={toggleReminderRow}
                            onTogglePage={toggleReminderPage}
                            onDeleteSelected={() => deleteSelectedRows('reminders')}
                            onDeleteAll={() => deleteAllRows('reminders')}
                        />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <Card className="rounded-3xl">
                            <CardHeader>
                                <CardTitle>Filter Invoice via WA</CardTitle>
                                <CardDescription>Cari invoice rental yang pernah dikirim lewat WhatsApp berdasarkan customer, rental, nomor tujuan, atau provider ID.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={submitInvoiceFilters} className="grid gap-4 lg:grid-cols-[1.6fr_repeat(2,minmax(0,1fr))_auto]">
                                    <div className="grid gap-2">
                                        <Label htmlFor="invoice-search">Cari Invoice</Label>
                                        <div className="relative">
                                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input
                                                id="invoice-search"
                                                value={invoiceForm.data.search}
                                                onChange={(event) => invoiceForm.setData('search', event.target.value)}
                                                placeholder="Customer, rental, no. WA, atau provider ID"
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="invoice-status">Status</Label>
                                        <Select value={invoiceForm.data.status} onValueChange={(value) => invoiceForm.setData('status', value)}>
                                            <SelectTrigger id="invoice-status">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {statusOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="invoice-per-page">Baris / Halaman</Label>
                                        <Select value={invoiceForm.data.per_page} onValueChange={(value) => invoiceForm.setData('per_page', value)}>
                                            <SelectTrigger id="invoice-per-page">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {['10', '15', '25', '50'].map((option) => (
                                                    <SelectItem key={option} value={option}>
                                                        {option}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex flex-wrap items-end justify-end gap-3">
                                        <Button type="button" variant="outline" onClick={resetInvoiceFilters}>
                                            <X className="mr-2 h-4 w-4" />
                                            Reset
                                        </Button>
                                        <Button type="submit">Terapkan Filter</Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <HistoryTable
                            title="Riwayat Invoice via WhatsApp"
                            description="Daftar invoice rental yang pernah dikirim ke customer lewat tombol kirim invoice WhatsApp."
                            rows={invoices}
                            pagination={invoicePagination}
                            pages={invoicePages}
                            emptyMessage="Belum ada invoice rental yang dikirim via WhatsApp."
                            dateColumnLabel="Dijadwalkan"
                            getDateValue={(row) => row.scheduled_at ?? row.created_at}
                            onPageChange={goToInvoicePage}
                            onDeleteRow={deleteHistoryRow}
                            selectedIds={selectedInvoiceIds}
                            onToggleRow={toggleInvoiceRow}
                            onTogglePage={toggleInvoicePage}
                            onDeleteSelected={() => deleteSelectedRows('invoices')}
                            onDeleteAll={() => deleteAllRows('invoices')}
                            showTargetPhone
                        />
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function HistoryTable({
    title,
    description,
    rows,
    pagination,
    pages,
    emptyMessage,
    dateColumnLabel,
    getDateValue,
    onPageChange,
    onDeleteRow,
    selectedIds,
    onToggleRow,
    onTogglePage,
    onDeleteSelected,
    onDeleteAll,
    showTargetPhone = false,
}: {
    title: string;
    description: string;
    rows: HistoryItem[];
    pagination: PaginationMeta;
    pages: number[];
    emptyMessage: string;
    dateColumnLabel: string;
    getDateValue: (row: HistoryItem) => string | null;
    onPageChange: (page: number) => void;
    onDeleteRow: (id: number) => void;
    selectedIds: number[];
    onToggleRow: (id: number, checked: boolean) => void;
    onTogglePage: (checked: boolean) => void;
    onDeleteSelected: () => void;
    onDeleteAll: () => void;
    showTargetPhone?: boolean;
}) {
    const allRowsSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

    return (
        <Card className="rounded-3xl">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Baris Tampil</p>
                        <p className="mt-2 text-xl font-semibold">
                            {pagination.from ?? 0}-{pagination.to ?? 0}
                        </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Data</p>
                        <p className="mt-2 text-xl font-semibold">{pagination.total}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Halaman Aktif</p>
                        <p className="mt-2 text-xl font-semibold">
                            {pagination.current_page} / {pagination.last_page}
                        </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Per Halaman</p>
                        <p className="mt-2 text-xl font-semibold">{pagination.per_page}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between">
                    <label className="flex items-center gap-3 text-sm font-medium">
                        <Checkbox checked={allRowsSelected} onCheckedChange={(checked) => onTogglePage(checked === true)} />
                        Pilih halaman ini
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground text-sm">{selectedIds.length} data terpilih</span>
                        <Button type="button" variant="outline" size="sm" onClick={onDeleteSelected} disabled={selectedIds.length === 0}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus Terpilih
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={onDeleteAll} disabled={pagination.total === 0}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus Semua Tab
                        </Button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border">
                    <div className="max-h-[34rem] overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-muted/40 sticky top-0">
                                <tr className="border-b text-left">
                                    <th className="px-4 py-3 font-medium">Pilih</th>
                                    <th className="px-4 py-3 font-medium">Customer</th>
                                    <th className="px-4 py-3 font-medium">Rental</th>
                                    {showTargetPhone && <th className="px-4 py-3 font-medium">No. WA Tujuan</th>}
                                    <th className="px-4 py-3 font-medium">{dateColumnLabel}</th>
                                    <th className="px-4 py-3 font-medium">Terkirim</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Provider ID</th>
                                    <th className="px-4 py-3 font-medium text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length > 0 ? (
                                    rows.map((row) => (
                                        <tr key={row.id} className="border-b align-top">
                                            <td className="px-4 py-3">
                                                <Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={(checked) => onToggleRow(row.id, checked === true)} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{row.customer_name || 'Customer tidak ditemukan'}</p>
                                                <p className="text-muted-foreground mt-1 text-xs">{row.customer_phone || row.phone || '-'}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{row.combined_no || row.rental_no || '-'}</p>
                                                <p className="text-muted-foreground mt-1 text-xs">{row.message_type_label}</p>
                                            </td>
                                            {showTargetPhone && <td className="px-4 py-3">{row.phone || '-'}</td>}
                                            <td className="px-4 py-3">{formatDateTime(getDateValue(row))}</td>
                                            <td className="px-4 py-3">{formatDateTime(row.sent_at)}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={statusVariant(row.status)}>{row.status_label}</Badge>
                                            </td>
                                            <td className="px-4 py-3">{row.provider_message_id || '-'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    {row.rental_id ? (
                                                        row.combined_order_id ? (
                                                            <Button asChild size="sm" variant="outline">
                                                                <Link href={route('admin.combined-orders.show', row.combined_order_id)}>Buka Invoice</Link>
                                                            </Button>
                                                        ) : (
                                                            <Button asChild size="sm" variant="outline">
                                                                <Link href={route('admin.rentals.show', row.rental_id)}>Buka Rental</Link>
                                                            </Button>
                                                        )
                                                    ) : (
                                                        <Button size="sm" variant="outline" disabled>
                                                            Buka Detail
                                                        </Button>
                                                    )}

                                                    <Button type="button" size="sm" variant="destructive" onClick={() => onDeleteRow(row.id)}>
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Hapus
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={showTargetPhone ? 9 : 8} className="text-muted-foreground px-4 py-6 text-center">
                                            {emptyMessage}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
                    <p className="text-muted-foreground text-sm">
                        Menampilkan {pagination.from ?? 0}-{pagination.to ?? 0} dari {pagination.total} data.
                    </p>

                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(pagination.current_page - 1)} disabled={pagination.current_page <= 1}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Prev
                        </Button>

                        <div className="hidden items-center gap-2 md:flex">
                            {pages.map((page) => (
                                <Button key={page} type="button" size="sm" variant={page === pagination.current_page ? 'default' : 'outline'} onClick={() => onPageChange(page)}>
                                    {page}
                                </Button>
                            ))}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(pagination.current_page + 1)}
                            disabled={pagination.current_page >= pagination.last_page}
                        >
                            Next
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
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

function buildPaginationPages(pagination: PaginationMeta): number[] {
    if (pagination.last_page <= 1) {
        return [1];
    }

    const pages = new Set<number>([1, pagination.last_page]);

    for (let page = pagination.current_page - 1; page <= pagination.current_page + 1; page += 1) {
        if (page >= 1 && page <= pagination.last_page) {
            pages.add(page);
        }
    }

    return Array.from(pages).sort((left, right) => left - right);
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'sent':
            return 'default';
        case 'pending':
            return 'secondary';
        case 'failed':
            return 'destructive';
        default:
            return 'outline';
    }
}

function formatDateTime(value: string | null) {
    if (!value) {
        return '-';
    }

    return dateTimeFormatter.format(new Date(value));
}
