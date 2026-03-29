import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Archive, Bath, CalendarDays, FileText, LayoutGrid, Package, RotateCcw, Users } from 'lucide-react';
import AppLogo from './app-logo';

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;
    const roleNames = auth.user?.role_names ?? [];
    const canManageUsers = roleNames.includes('super-admin') || roleNames.includes('admin-toko');

    const mainNavItems: NavItem[] = [
        {
            title: 'Dashboard',
            url: '/dashboard',
            icon: LayoutGrid,
        },
        ...(canManageUsers
            ? [
                  {
                      title: 'Penyewaan',
                      url: route('admin.rentals.index'),
                      icon: FileText,
                  },
                  {
                      title: 'Pengembalian',
                      url: route('admin.returns.index'),
                      icon: RotateCcw,
                  },
                  {
                      title: 'Produk',
                      url: route('admin.products.index'),
                      icon: Package,
                  },
                  {
                      title: 'Unit Inventaris',
                      url: route('admin.inventory-units.index'),
                      icon: Archive,
                  },
                  {
                      title: 'Proses Cuci',
                      url: route('admin.washing.index'),
                      icon: Bath,
                  },
                  {
                      title: 'Customer',
                      url: route('admin.customers.index'),
                      icon: Users,
                  },
                  {
                      title: 'Season & DP',
                      url: route('admin.season-rules.index'),
                      icon: CalendarDays,
                  },
                  {
                      title: 'User Management',
                      url: route('admin.users.index'),
                      icon: Users,
                  },
              ]
            : []),
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
