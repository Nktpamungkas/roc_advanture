import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';

interface ManagedUser {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    role_names: string[];
    primary_role: string | null;
    created_at: string | null;
    updated_at: string | null;
}

interface RoleOption {
    value: string;
    label: string;
}

interface PageProps {
    users: ManagedUser[];
    roleOptions: RoleOption[];
}

interface CreateUserForm {
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    password: string;
    password_confirmation: string;
}

interface UpdateUserForm {
    name: string;
    email: string;
    role: string;
    is_active: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'User Management',
        href: '/admin/users',
    },
];

const fallbackRoleLabels: Record<string, string> = {
    'super-admin': 'Super Admin',
    'admin-toko': 'Admin Toko',
    staff: 'Staff',
};

export default function UsersIndex({ users, roleOptions }: PageProps) {
    const { auth, flash } = usePage<SharedData>().props;
    const [selectedUserId, setSelectedUserId] = useState<number | null>(users[0]?.id ?? null);

    const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? null, [selectedUserId, users]);
    const isEditingSelf = selectedUser?.id === auth.user?.id;

    const createForm = useForm<CreateUserForm>({
        name: '',
        email: '',
        role: roleOptions[0]?.value ?? '',
        is_active: true,
        password: '',
        password_confirmation: '',
    });

    const updateForm = useForm<UpdateUserForm>({
        name: '',
        email: '',
        role: '',
        is_active: true,
    });

    useEffect(() => {
        if (!selectedUser) {
            updateForm.reset();
            return;
        }

        updateForm.setData({
            name: selectedUser.name,
            email: selectedUser.email,
            role: selectedUser.primary_role ?? roleOptions[0]?.value ?? '',
            is_active: selectedUser.is_active,
        });
        updateForm.clearErrors();
    }, [roleOptions, selectedUser]);

    const submitCreate: FormEventHandler = (event) => {
        event.preventDefault();

        createForm.post(route('admin.users.store'), {
            preserveScroll: true,
            onSuccess: () =>
                createForm.reset('name', 'email', 'password', 'password_confirmation'),
        });
    };

    const submitUpdate: FormEventHandler = (event) => {
        event.preventDefault();

        if (!selectedUser) {
            return;
        }

        updateForm.patch(route('admin.users.update', selectedUser.id), {
            preserveScroll: true,
        });
    };

    const roleLabel = (role: string | null) => {
        if (!role) {
            return '-';
        }

        return roleOptions.find((option) => option.value === role)?.label ?? fallbackRoleLabels[role] ?? role;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User Management" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <section className="rounded-2xl border p-6">
                    <p className="text-muted-foreground text-sm">Internal access control</p>
                    <h1 className="mt-2 text-2xl font-semibold">User Management</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
                        Kelola user internal Roc Advanture berdasarkan role, status aktif, dan akses minimum untuk tahap awal aplikasi.
                    </p>
                </section>

                {flash.success && (
                    <Alert>
                        <AlertTitle>Perubahan tersimpan</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                {flash.error && (
                    <Alert variant="destructive">
                        <AlertTitle>Akses dihentikan</AlertTitle>
                        <AlertDescription>{flash.error}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Buat User Baru</CardTitle>
                            <CardDescription>
                                Admin membuat akun internal berikut role dan status awalnya.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-4" onSubmit={submitCreate}>
                                <div className="grid gap-2">
                                    <Label htmlFor="create-name">Nama</Label>
                                    <Input
                                        id="create-name"
                                        value={createForm.data.name}
                                        onChange={(event) => createForm.setData('name', event.target.value)}
                                        disabled={createForm.processing}
                                        placeholder="Nama user"
                                    />
                                    <InputError message={createForm.errors.name} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-email">Email</Label>
                                    <Input
                                        id="create-email"
                                        type="email"
                                        value={createForm.data.email}
                                        onChange={(event) => createForm.setData('email', event.target.value)}
                                        disabled={createForm.processing}
                                        placeholder="email@rocadvanture.local"
                                    />
                                    <InputError message={createForm.errors.email} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-role">Role</Label>
                                    <Select
                                        value={createForm.data.role}
                                        onValueChange={(value) => createForm.setData('role', value)}
                                        disabled={createForm.processing}
                                    >
                                        <SelectTrigger id="create-role">
                                            <SelectValue placeholder="Pilih role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roleOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={createForm.errors.role} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-status">Status</Label>
                                    <Select
                                        value={createForm.data.is_active ? 'active' : 'inactive'}
                                        onValueChange={(value) => createForm.setData('is_active', value === 'active')}
                                        disabled={createForm.processing}
                                    >
                                        <SelectTrigger id="create-status">
                                            <SelectValue placeholder="Pilih status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Aktif</SelectItem>
                                            <SelectItem value="inactive">Nonaktif</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={createForm.errors.is_active} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-password">Password awal</Label>
                                    <Input
                                        id="create-password"
                                        type="password"
                                        value={createForm.data.password}
                                        onChange={(event) => createForm.setData('password', event.target.value)}
                                        disabled={createForm.processing}
                                        placeholder="Minimal sesuai policy password"
                                    />
                                    <InputError message={createForm.errors.password} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="create-password-confirmation">Konfirmasi password</Label>
                                    <Input
                                        id="create-password-confirmation"
                                        type="password"
                                        value={createForm.data.password_confirmation}
                                        onChange={(event) => createForm.setData('password_confirmation', event.target.value)}
                                        disabled={createForm.processing}
                                        placeholder="Ulangi password awal"
                                    />
                                    <InputError message={createForm.errors.password_confirmation} />
                                </div>

                                <Button type="submit" className="mt-2 w-full" disabled={createForm.processing}>
                                    {createForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                    Simpan User
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Daftar User</CardTitle>
                            <CardDescription>
                                Pilih user dari daftar untuk mengubah nama, email, role, dan status aktif.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="overflow-x-auto rounded-xl border">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/40">
                                        <tr className="text-left">
                                            <th className="px-4 py-3 font-medium">Nama</th>
                                            <th className="px-4 py-3 font-medium">Email</th>
                                            <th className="px-4 py-3 font-medium">Role</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                            <th className="px-4 py-3 font-medium text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((user) => {
                                            const active = selectedUserId === user.id;

                                            return (
                                                <tr key={user.id} className={active ? 'bg-muted/30' : ''}>
                                                    <td className="px-4 py-3 align-top">
                                                        <div className="font-medium">{user.name}</div>
                                                    </td>
                                                    <td className="px-4 py-3 align-top text-muted-foreground">{user.email}</td>
                                                    <td className="px-4 py-3 align-top">
                                                        <Badge variant="outline">{roleLabel(user.primary_role)}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3 align-top">
                                                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                                                            {user.is_active ? 'Aktif' : 'Nonaktif'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right align-top">
                                                        <Button type="button" variant={active ? 'secondary' : 'outline'} size="sm" onClick={() => setSelectedUserId(user.id)}>
                                                            Edit
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {selectedUser ? (
                                <div className="rounded-2xl border p-5">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold">Edit User</h2>
                                            <p className="text-muted-foreground text-sm">
                                                Mengubah akun: {selectedUser.name} ({selectedUser.email})
                                            </p>
                                        </div>
                                        <Badge variant="outline">{roleLabel(selectedUser.primary_role)}</Badge>
                                    </div>

                                    {isEditingSelf && (
                                        <Alert className="mt-4">
                                            <AlertTitle>Akun aktif kamu sedang dipilih</AlertTitle>
                                            <AlertDescription>
                                                Role dan status aktif dikunci untuk akun yang sedang kamu pakai. Untuk perubahan akun sendiri, gunakan halaman profile/settings.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <form className="mt-5 grid gap-4" onSubmit={submitUpdate}>
                                        <div className="grid gap-2 md:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-name">Nama</Label>
                                                <Input
                                                    id="edit-name"
                                                    value={updateForm.data.name}
                                                    onChange={(event) => updateForm.setData('name', event.target.value)}
                                                    disabled={updateForm.processing}
                                                />
                                                <InputError message={updateForm.errors.name} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-email">Email</Label>
                                                <Input
                                                    id="edit-email"
                                                    type="email"
                                                    value={updateForm.data.email}
                                                    onChange={(event) => updateForm.setData('email', event.target.value)}
                                                    disabled={updateForm.processing}
                                                />
                                                <InputError message={updateForm.errors.email} />
                                            </div>
                                        </div>

                                        <div className="grid gap-2 md:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-role">Role</Label>
                                                <Select
                                                    value={updateForm.data.role}
                                                    onValueChange={(value) => updateForm.setData('role', value)}
                                                    disabled={updateForm.processing || isEditingSelf}
                                                >
                                                    <SelectTrigger id="edit-role">
                                                        <SelectValue placeholder="Pilih role" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {roleOptions.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <InputError message={updateForm.errors.role} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-status">Status</Label>
                                                <Select
                                                    value={updateForm.data.is_active ? 'active' : 'inactive'}
                                                    onValueChange={(value) => updateForm.setData('is_active', value === 'active')}
                                                    disabled={updateForm.processing || isEditingSelf}
                                                >
                                                    <SelectTrigger id="edit-status">
                                                        <SelectValue placeholder="Pilih status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="active">Aktif</SelectItem>
                                                        <SelectItem value="inactive">Nonaktif</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <InputError message={updateForm.errors.is_active} />
                                            </div>
                                        </div>

                                        <Button type="submit" className="w-full sm:w-auto" disabled={updateForm.processing}>
                                            {updateForm.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                            Update User
                                        </Button>
                                    </form>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                    Belum ada user yang bisa diedit dari ruang lingkup role kamu.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
