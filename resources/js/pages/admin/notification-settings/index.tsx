import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { BellRing, LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reminder WhatsApp', href: '/admin/notification-settings' },
];

export default function NotificationSettingsIndex({
    notificationSettings,
}: {
    notificationSettings: {
        rental_reminder_enabled: boolean;
        rental_reminder_lead_hours: number;
        rental_reminder_template: string;
        overdue_reminder_enabled: boolean;
        overdue_reminder_delay_hours: number;
        overdue_reminder_template: string;
        default_rental_reminder_lead_hours: number;
        default_overdue_reminder_delay_hours: number;
        placeholders: string[];
    };
}) {
    const { flash } = usePage<SharedData>().props;

    const form = useForm({
        rental_reminder_enabled: notificationSettings.rental_reminder_enabled,
        rental_reminder_lead_hours: String(notificationSettings.rental_reminder_lead_hours),
        rental_reminder_template: notificationSettings.rental_reminder_template,
        overdue_reminder_enabled: notificationSettings.overdue_reminder_enabled,
        overdue_reminder_delay_hours: String(notificationSettings.overdue_reminder_delay_hours),
        overdue_reminder_template: notificationSettings.overdue_reminder_template,
    });
    const previewLeadHours = Number(form.data.rental_reminder_lead_hours || notificationSettings.rental_reminder_lead_hours);
    const previewOverdueDelayHours = Number(form.data.overdue_reminder_delay_hours || notificationSettings.overdue_reminder_delay_hours);

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        form.put(route('admin.notification-settings.update'), {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Reminder WhatsApp" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Pengaturan operasional notifikasi</p>
                    <h1 className="mt-2 text-2xl font-semibold">Reminder WhatsApp</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Atur toggle reminder otomatis, template pesan WhatsApp, dan jeda pengingat kedua saat rental sudah lewat batas pengembalian.
                    </p>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Pengaturan tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Reminder Sebelum Jatuh Tempo</p>
                        <p className="mt-2 text-2xl font-semibold">{notificationSettings.rental_reminder_lead_hours} jam</p>
                        <p className="text-muted-foreground mt-2 text-sm">{notificationSettings.rental_reminder_enabled ? 'Aktif' : 'Nonaktif'}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Reminder Kedua Saat Telat</p>
                        <p className="mt-2 text-2xl font-semibold">{notificationSettings.overdue_reminder_delay_hours} jam</p>
                        <p className="text-muted-foreground mt-2 text-sm">{notificationSettings.overdue_reminder_enabled ? 'Aktif' : 'Nonaktif'}</p>
                    </div>
                    <div className="rounded-2xl border p-4">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Default Sistem</p>
                        <div className="mt-2 space-y-2 text-sm leading-6">
                            <p>Reminder jatuh tempo: {notificationSettings.default_rental_reminder_lead_hours} jam sebelumnya</p>
                            <p>Reminder telat: {notificationSettings.default_overdue_reminder_delay_hours} jam setelah lewat due date</p>
                        </div>
                    </div>
                </div>

                <Card className="max-w-4xl">
                    <CardHeader>
                        <CardTitle>Atur Reminder Otomatis</CardTitle>
                        <CardDescription>
                            Nilai yang kamu simpan di sini langsung dipakai scheduler tanpa perlu edit file <code>.env</code>. Placeholder di template bisa dipakai untuk menyesuaikan isi pesan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="grid gap-5" onSubmit={submit}>
                            <div className="grid gap-6 lg:grid-cols-2">
                                <div className="grid gap-4 rounded-2xl border p-5">
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="rental-reminder-enabled"
                                            checked={form.data.rental_reminder_enabled}
                                            onCheckedChange={(checked) => form.setData('rental_reminder_enabled', checked === true)}
                                        />
                                        <div className="grid gap-1">
                                            <Label htmlFor="rental-reminder-enabled" className="cursor-pointer">
                                                Aktifkan reminder sebelum jatuh tempo
                                            </Label>
                                            <p className="text-muted-foreground text-sm">
                                                Kalau aktif, sistem akan mengirim pengingat beberapa jam sebelum batas pengembalian.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="rental-reminder-lead-hours">Jam sebelum jatuh tempo</Label>
                                        <Input
                                            id="rental-reminder-lead-hours"
                                            type="number"
                                            min="1"
                                            max="168"
                                            value={form.data.rental_reminder_lead_hours}
                                            onChange={(event) => form.setData('rental_reminder_lead_hours', event.target.value)}
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            Contoh: jika due date jam 18:00 dan setting {previewLeadHours} jam, reminder dikirim sekitar {previewLeadHours} jam sebelumnya.
                                        </p>
                                        <InputError message={form.errors.rental_reminder_lead_hours} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="rental-reminder-template">Template Reminder Jatuh Tempo</Label>
                                        <Textarea
                                            id="rental-reminder-template"
                                            rows={10}
                                            value={form.data.rental_reminder_template}
                                            onChange={(event) => form.setData('rental_reminder_template', event.target.value)}
                                        />
                                        <InputError message={form.errors.rental_reminder_template} />
                                    </div>
                                </div>

                                <div className="grid gap-4 rounded-2xl border p-5">
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="overdue-reminder-enabled"
                                            checked={form.data.overdue_reminder_enabled}
                                            onCheckedChange={(checked) => form.setData('overdue_reminder_enabled', checked === true)}
                                        />
                                        <div className="grid gap-1">
                                            <Label htmlFor="overdue-reminder-enabled" className="cursor-pointer">
                                                Aktifkan reminder kedua saat rental telat
                                            </Label>
                                            <p className="text-muted-foreground text-sm">
                                                Kalau aktif, sistem akan mengirim pesan susulan untuk rental yang sudah melewati batas pengembalian.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="overdue-reminder-delay-hours">Jam setelah lewat due date</Label>
                                        <Input
                                            id="overdue-reminder-delay-hours"
                                            type="number"
                                            min="1"
                                            max="168"
                                            value={form.data.overdue_reminder_delay_hours}
                                            onChange={(event) => form.setData('overdue_reminder_delay_hours', event.target.value)}
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            Contoh: jika due date jam 18:00 dan setting {previewOverdueDelayHours} jam, reminder kedua dikirim sekitar {previewOverdueDelayHours} jam setelah batas waktu lewat.
                                        </p>
                                        <InputError message={form.errors.overdue_reminder_delay_hours} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="overdue-reminder-template">Template Reminder Telat</Label>
                                        <Textarea
                                            id="overdue-reminder-template"
                                            rows={10}
                                            value={form.data.overdue_reminder_template}
                                            onChange={(event) => form.setData('overdue_reminder_template', event.target.value)}
                                        />
                                        <InputError message={form.errors.overdue_reminder_template} />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-dashed p-4 text-sm">
                                <div className="flex items-start gap-3">
                                    <BellRing className="mt-0.5 h-4 w-4" />
                                    <div className="space-y-1">
                                        <p className="font-medium">Placeholder yang tersedia</p>
                                        <p className="text-muted-foreground leading-6">
                                            {notificationSettings.placeholders.join(', ')}
                                        </p>
                                        <p className="text-muted-foreground leading-6">
                                            Scheduler tetap berjalan setiap 5 menit, lalu sistem akan cek toggle, jam, dan template di halaman ini untuk menentukan kapan reminder WA dikirim ke customer.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button type="submit" disabled={form.processing}>
                                    {form.processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Simpan Pengaturan
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
