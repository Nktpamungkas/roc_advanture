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

interface Option {
    value: string;
    label: string;
}

interface SeasonRuleItem {
    id: number;
    name: string;
    start_date: string | null;
    end_date: string | null;
    dp_required: boolean;
    dp_type: string | null;
    dp_value: string | null;
    active: boolean;
    notes: string | null;
}

interface SeasonRuleForm {
    name: string;
    start_date: string;
    end_date: string;
    dp_required: boolean;
    dp_type: string;
    dp_value: string;
    active: boolean;
    notes: string;
}

interface SeasonRuleFilters {
    search: string;
    status: string;
    dp_required: string;
    per_page: number;
}

interface SeasonRulePagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface SeasonRuleSummary {
    total_rules: number;
    active_rules: number;
    dp_required_rules: number;
    filtered_rules: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Season & DP', href: '/admin/season-rules' },
];

const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

export default function SeasonRulesIndex({
    seasonRules,
    seasonRuleFilters,
    seasonRulePagination,
    seasonRuleSummary,
    dpTypeOptions,
}: {
    seasonRules: SeasonRuleItem[];
    seasonRuleFilters: SeasonRuleFilters;
    seasonRulePagination: SeasonRulePagination;
    seasonRuleSummary: SeasonRuleSummary;
    dpTypeOptions: Option[];
}) {
    const { flash } = usePage<SharedData>().props;
    const [selectedSeasonRuleId, setSelectedSeasonRuleId] = useState<number | null>(seasonRules[0]?.id ?? null);

    const selectedSeasonRule = useMemo(
        () => seasonRules.find((seasonRule) => seasonRule.id === selectedSeasonRuleId) ?? null,
        [seasonRules, selectedSeasonRuleId],
    );

    const createForm = useForm<SeasonRuleForm>({
        name: '',
        start_date: '',
        end_date: '',
        dp_required: false,
        dp_type: dpTypeOptions[0]?.value ?? '',
        dp_value: '',
        active: true,
        notes: '',
    });

    const updateForm = useForm<SeasonRuleForm>({
        name: '',
        start_date: '',
        end_date: '',
        dp_required: false,
        dp_type: dpTypeOptions[0]?.value ?? '',
        dp_value: '',
        active: true,
        notes: '',
    });

    const filterForm = useForm({
        search: seasonRuleFilters.search,
        status: seasonRuleFilters.status,
        dp_required: seasonRuleFilters.dp_required,
        per_page: String(seasonRuleFilters.per_page),
    });

    useEffect(() => {
        if (!selectedSeasonRule) {
            updateForm.reset();
            return;
        }

        updateForm.setData({
            name: selectedSeasonRule.name,
            start_date: selectedSeasonRule.start_date ?? '',
            end_date: selectedSeasonRule.end_date ?? '',
            dp_required: selectedSeasonRule.dp_required,
            dp_type: selectedSeasonRule.dp_type ?? dpTypeOptions[0]?.value ?? '',
            dp_value: selectedSeasonRule.dp_value ?? '',
            active: selectedSeasonRule.active,
            notes: selectedSeasonRule.notes ?? '',
        });
        updateForm.clearErrors();
    }, [dpTypeOptions, selectedSeasonRule]);

    useEffect(() => {
        if (seasonRules.some((seasonRule) => seasonRule.id === selectedSeasonRuleId)) {
            return;
        }

        setSelectedSeasonRuleId(seasonRules[0]?.id ?? null);
    }, [seasonRules, selectedSeasonRuleId]);

    useEffect(() => {
        filterForm.setData({
            search: seasonRuleFilters.search,
            status: seasonRuleFilters.status,
            dp_required: seasonRuleFilters.dp_required,
            per_page: String(seasonRuleFilters.per_page),
        });
    }, [seasonRuleFilters.dp_required, seasonRuleFilters.per_page, seasonRuleFilters.search, seasonRuleFilters.status]);

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();

        createForm.post(route('admin.season-rules.store'), {
            preserveScroll: true,
            onSuccess: () => createForm.reset('name', 'start_date', 'end_date', 'dp_value', 'notes'),
        });
    };

    const submitUpdate: FormEventHandler = (event) => {
        event.preventDefault();

        if (!selectedSeasonRule) {
            return;
        }

        updateForm.patch(route('admin.season-rules.update', selectedSeasonRule.id), {
            preserveScroll: true,
        });
    };

    const submitFilters: FormEventHandler = (event) => {
        event.preventDefault();

        router.get(
            route('admin.season-rules.index'),
            {
                search: filterForm.data.search || undefined,
                status: filterForm.data.status || undefined,
                dp_required: filterForm.data.dp_required || undefined,
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
            status: '',
            dp_required: '',
            per_page: '10',
        });

        router.get(
            route('admin.season-rules.index'),
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
            route('admin.season-rules.index'),
            {
                search: seasonRuleFilters.search || undefined,
                status: seasonRuleFilters.status || undefined,
                dp_required: seasonRuleFilters.dp_required || undefined,
                per_page: seasonRuleFilters.per_page,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const dpLabel = (seasonRule: SeasonRuleItem) => {
        if (!seasonRule.dp_required) {
            return 'Tidak wajib DP';
        }

        if (seasonRule.dp_type === 'percentage') {
            return `${seasonRule.dp_value || 0}%`;
        }

        return currencyFormatter.format(Number(seasonRule.dp_value || 0));
    };

    const paginationPages = useMemo(() => {
        if (seasonRulePagination.last_page <= 1) {
            return [1];
        }

        const start = Math.max(1, seasonRulePagination.current_page - 2);
        const end = Math.min(seasonRulePagination.last_page, start + 4);
        const normalizedStart = Math.max(1, end - 4);

        return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
    }, [seasonRulePagination.current_page, seasonRulePagination.last_page]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Season & DP" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Aturan high season</p>
                    <h1 className="mt-2 text-2xl font-semibold">Season & DP</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Tentukan periode high season dan aturan DP agar admin tidak perlu mengingatnya secara manual saat membuat penyewaan.
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
                            <CardTitle>Tambah Aturan Season</CardTitle>
                            <CardDescription>Atur rentang tanggal dan kebutuhan DP untuk periode tertentu.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-4" onSubmit={submitCreate}>
                                <div className="grid gap-2">
                                    <Label htmlFor="create-name">Nama Aturan</Label>
                                    <Input
                                        id="create-name"
                                        value={createForm.data.name}
                                        onChange={(event) => createForm.setData('name', event.target.value)}
                                        placeholder="High Season Lebaran 2026"
                                    />
                                    <InputError message={createForm.errors.name} />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="create-start-date">Tanggal Mulai</Label>
                                        <Input
                                            id="create-start-date"
                                            type="date"
                                            value={createForm.data.start_date}
                                            onChange={(event) => createForm.setData('start_date', event.target.value)}
                                        />
                                        <InputError message={createForm.errors.start_date} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="create-end-date">Tanggal Selesai</Label>
                                        <Input
                                            id="create-end-date"
                                            type="date"
                                            value={createForm.data.end_date}
                                            onChange={(event) => createForm.setData('end_date', event.target.value)}
                                        />
                                        <InputError message={createForm.errors.end_date} />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="create-dp-required">Aturan DP</Label>
                                        <Select
                                            value={createForm.data.dp_required ? 'required' : 'optional'}
                                            onValueChange={(value) => createForm.setData('dp_required', value === 'required')}
                                        >
                                            <SelectTrigger id="create-dp-required">
                                                <SelectValue placeholder="Pilih aturan DP" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="optional">Tidak wajib DP</SelectItem>
                                                <SelectItem value="required">Wajib DP</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError message={createForm.errors.dp_required} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="create-active">Status</Label>
                                        <Select
                                            value={createForm.data.active ? 'active' : 'inactive'}
                                            onValueChange={(value) => createForm.setData('active', value === 'active')}
                                        >
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
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="create-dp-type">Tipe DP</Label>
                                        <Select
                                            value={createForm.data.dp_type}
                                            onValueChange={(value) => createForm.setData('dp_type', value)}
                                            disabled={!createForm.data.dp_required}
                                        >
                                            <SelectTrigger id="create-dp-type">
                                                <SelectValue placeholder="Pilih tipe DP" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {dpTypeOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={createForm.errors.dp_type} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="create-dp-value">Nilai DP</Label>
                                        <Input
                                            id="create-dp-value"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={createForm.data.dp_value}
                                            onChange={(event) => createForm.setData('dp_value', event.target.value)}
                                            placeholder={createForm.data.dp_type === 'percentage' ? '50' : '150000'}
                                            disabled={!createForm.data.dp_required}
                                        />
                                        <InputError message={createForm.errors.dp_value} />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-notes">Catatan</Label>
                                    <Textarea
                                        id="create-notes"
                                        value={createForm.data.notes}
                                        onChange={(event) => createForm.setData('notes', event.target.value)}
                                        placeholder="Misalnya dipakai saat libur panjang dan stok cepat habis"
                                    />
                                    <InputError message={createForm.errors.notes} />
                                </div>

                                <Button type="submit" className="w-full" disabled={createForm.processing}>
                                    {createForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                    Simpan Aturan
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Daftar Season</CardTitle>
                            <CardDescription>Filter aturan season yang aktif atau wajib DP agar daftar tetap nyaman walau periodenya banyak.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="grid gap-4 md:grid-cols-4">
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Rule</p>
                                    <p className="mt-2 text-2xl font-semibold">{seasonRuleSummary.total_rules}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Aktif</p>
                                    <p className="mt-2 text-2xl font-semibold">{seasonRuleSummary.active_rules}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Wajib DP</p>
                                    <p className="mt-2 text-2xl font-semibold">{seasonRuleSummary.dp_required_rules}</p>
                                </div>
                                <div className="rounded-2xl border p-4">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Hasil Filter</p>
                                    <p className="mt-2 text-2xl font-semibold">{seasonRuleSummary.filtered_rules}</p>
                                </div>
                            </div>

                            <form className="rounded-2xl border p-4" onSubmit={submitFilters}>
                                <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr_0.7fr]">
                                    <div className="grid gap-2">
                                        <Label htmlFor="season-search">Cari Aturan</Label>
                                        <div className="relative">
                                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                            <Input
                                                id="season-search"
                                                value={filterForm.data.search}
                                                onChange={(event) => filterForm.setData('search', event.target.value)}
                                                placeholder="Cari nama season"
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="season-status">Filter Status</Label>
                                        <Select value={filterForm.data.status || 'all'} onValueChange={(value) => filterForm.setData('status', value === 'all' ? '' : value)}>
                                            <SelectTrigger id="season-status">
                                                <SelectValue placeholder="Semua status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Semua status</SelectItem>
                                                <SelectItem value="active">Aktif</SelectItem>
                                                <SelectItem value="inactive">Nonaktif</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="season-dp-required">Filter DP</Label>
                                        <Select value={filterForm.data.dp_required || 'all'} onValueChange={(value) => filterForm.setData('dp_required', value === 'all' ? '' : value)}>
                                            <SelectTrigger id="season-dp-required">
                                                <SelectValue placeholder="Semua aturan DP" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Semua aturan DP</SelectItem>
                                                <SelectItem value="required">Wajib DP</SelectItem>
                                                <SelectItem value="optional">Tidak wajib DP</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="season-per-page">Baris / Halaman</Label>
                                        <Select value={filterForm.data.per_page} onValueChange={(value) => filterForm.setData('per_page', value)}>
                                            <SelectTrigger id="season-per-page">
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
                                                <th className="px-4 py-3 font-medium">Periode</th>
                                                <th className="px-4 py-3 font-medium">DP</th>
                                                <th className="px-4 py-3 font-medium">Status</th>
                                                <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {seasonRules.length > 0 ? (
                                                seasonRules.map((seasonRule) => {
                                                    const isActive = selectedSeasonRuleId === seasonRule.id;

                                                    return (
                                                        <tr key={seasonRule.id} className={isActive ? 'bg-muted/30' : ''}>
                                                            <td className="px-4 py-3 font-medium">{seasonRule.name}</td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                {seasonRule.start_date} s.d. {seasonRule.end_date}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <Badge variant="outline">{dpLabel(seasonRule)}</Badge>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <Badge variant={seasonRule.active ? 'default' : 'secondary'}>
                                                                    {seasonRule.active ? 'Aktif' : 'Nonaktif'}
                                                                </Badge>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <Button
                                                                    type="button"
                                                                    variant={isActive ? 'secondary' : 'outline'}
                                                                    size="sm"
                                                                    onClick={() => setSelectedSeasonRuleId(seasonRule.id)}
                                                                >
                                                                    Edit
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="text-muted-foreground px-4 py-8 text-center">
                                                        Tidak ada aturan season yang cocok dengan filter saat ini.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-muted-foreground text-sm">
                                    Menampilkan {seasonRulePagination.from ?? 0} - {seasonRulePagination.to ?? 0} dari {seasonRulePagination.total} aturan.
                                </p>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(seasonRulePagination.current_page - 1)}
                                        disabled={seasonRulePagination.current_page <= 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Prev
                                    </Button>

                                    {paginationPages.map((page) => (
                                        <Button
                                            key={page}
                                            type="button"
                                            variant={page === seasonRulePagination.current_page ? 'secondary' : 'outline'}
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
                                        onClick={() => goToPage(seasonRulePagination.current_page + 1)}
                                        disabled={seasonRulePagination.current_page >= seasonRulePagination.last_page}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {selectedSeasonRule ? (
                                <div className="rounded-2xl border p-5">
                                    <div>
                                        <h2 className="text-lg font-semibold">Edit Aturan Season</h2>
                                        <p className="text-muted-foreground text-sm">
                                            {selectedSeasonRule.name} dengan skema {dpLabel(selectedSeasonRule)}.
                                        </p>
                                    </div>

                                    <form className="mt-5 grid gap-4" onSubmit={submitUpdate}>
                                        <div className="grid gap-2">
                                            <Label htmlFor="edit-name">Nama Aturan</Label>
                                            <Input
                                                id="edit-name"
                                                value={updateForm.data.name}
                                                onChange={(event) => updateForm.setData('name', event.target.value)}
                                            />
                                            <InputError message={updateForm.errors.name} />
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-start-date">Tanggal Mulai</Label>
                                                <Input
                                                    id="edit-start-date"
                                                    type="date"
                                                    value={updateForm.data.start_date}
                                                    onChange={(event) => updateForm.setData('start_date', event.target.value)}
                                                />
                                                <InputError message={updateForm.errors.start_date} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-end-date">Tanggal Selesai</Label>
                                                <Input
                                                    id="edit-end-date"
                                                    type="date"
                                                    value={updateForm.data.end_date}
                                                    onChange={(event) => updateForm.setData('end_date', event.target.value)}
                                                />
                                                <InputError message={updateForm.errors.end_date} />
                                            </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-dp-required">Aturan DP</Label>
                                                <Select
                                                    value={updateForm.data.dp_required ? 'required' : 'optional'}
                                                    onValueChange={(value) => updateForm.setData('dp_required', value === 'required')}
                                                >
                                                    <SelectTrigger id="edit-dp-required">
                                                        <SelectValue placeholder="Pilih aturan DP" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="optional">Tidak wajib DP</SelectItem>
                                                        <SelectItem value="required">Wajib DP</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <InputError message={updateForm.errors.dp_required} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-active">Status</Label>
                                                <Select
                                                    value={updateForm.data.active ? 'active' : 'inactive'}
                                                    onValueChange={(value) => updateForm.setData('active', value === 'active')}
                                                >
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

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-dp-type">Tipe DP</Label>
                                                <Select
                                                    value={updateForm.data.dp_type}
                                                    onValueChange={(value) => updateForm.setData('dp_type', value)}
                                                    disabled={!updateForm.data.dp_required}
                                                >
                                                    <SelectTrigger id="edit-dp-type">
                                                        <SelectValue placeholder="Pilih tipe DP" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {dpTypeOptions.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <InputError message={updateForm.errors.dp_type} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-dp-value">Nilai DP</Label>
                                                <Input
                                                    id="edit-dp-value"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={updateForm.data.dp_value}
                                                    onChange={(event) => updateForm.setData('dp_value', event.target.value)}
                                                    placeholder={updateForm.data.dp_type === 'percentage' ? '50' : '150000'}
                                                    disabled={!updateForm.data.dp_required}
                                                />
                                                <InputError message={updateForm.errors.dp_value} />
                                            </div>
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
                                            Update Aturan
                                        </Button>
                                    </form>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                    Belum ada aturan season yang bisa diedit.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
