import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavGroup, type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Archive, BarChart3, Bath, CalendarDays, ClipboardList, CreditCard, FileText, LayoutGrid, MessageSquare, Package, RotateCcw, ShoppingBag, Truck, Users } from 'lucide-react';
import AppLogo from './app-logo';

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;
    const roleNames = auth.user?.role_names ?? [];
    const canManageUsers = roleNames.includes('super-admin') || roleNames.includes('admin-toko');
    const isSuperAdmin = roleNames.includes('super-admin');

    const commonOperationalItems: NavItem[] = [
        {
            title: 'Dashboard',
            url: '/dashboard',
            icon: LayoutGrid,
        },
        ...(canManageUsers
            ? [
                  {
                      title: 'Stok Opname',
                      url: route('admin.stock-opname.index'),
                      icon: ClipboardList,
                  },
              ]
            : []),
    ];

    const rentalOperationalItems: NavItem[] = canManageUsers
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
                  title: 'Proses Cuci',
                  url: route('admin.washing.index'),
                  icon: Bath,
              },
          ]
        : [];

    const salesOperationalItems: NavItem[] = canManageUsers
        ? [
              {
                  title: 'Penjualan',
                  url: route('admin.sales.index'),
                  icon: ShoppingBag,
              },
              {
                  title: 'Stok Masuk',
                  url: route('admin.stock-receipts.index'),
                  icon: Truck,
              },
          ]
        : [];

    const reportItems: NavItem[] = canManageUsers
        ? [
              {
                  title: 'Laporan Penyewaan',
                  url: route('admin.rental-reports.index'),
                  icon: BarChart3,
              },
              {
                  title: 'Laporan Penjualan',
                  url: route('admin.sales-reports.index'),
                  icon: ShoppingBag,
              },
              {
                  title: 'History WhatsApp',
                  url: route('admin.whatsapp-history.index'),
                  icon: MessageSquare,
              },
          ]
        : [];

    const rentalMasterItems: NavItem[] = canManageUsers
        ? [
              {
                  title: 'Produk Sewa',
                  url: route('admin.products.index'),
                  icon: Package,
              },
              {
                  title: 'Unit Inventaris',
                  url: route('admin.inventory-units.index'),
                  icon: Archive,
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
          ]
        : [];

    const salesMasterItems: NavItem[] = canManageUsers
        ? [
              {
                  title: 'Produk Jual',
                  url: route('admin.sale-products.index'),
                  icon: ShoppingBag,
              },
          ]
        : [];

    const sharedMasterItems: NavItem[] =
        canManageUsers && isSuperAdmin
            ? [
                  {
                      title: 'Metode Pembayaran',
                      url: route('admin.payment-methods.index'),
                      icon: CreditCard,
                  },
              ]
            : [];

    const settingsItems: NavItem[] = canManageUsers
        ? [
              {
                  title: 'User Management',
                  url: route('admin.users.index'),
                  icon: Users,
              },
          ]
        : [];

    const navGroups: NavGroup[] = [
        {
            title: 'Operasional Umum',
            items: commonOperationalItems,
        },
        ...(rentalOperationalItems.length > 0
            ? [
                  {
                      title: 'Operasional Rental',
                      items: rentalOperationalItems,
                  },
              ]
            : []),
        ...(salesOperationalItems.length > 0
            ? [
                  {
                      title: 'Operasional Penjualan',
                      items: salesOperationalItems,
                  },
              ]
            : []),
        ...(reportItems.length > 0
            ? [
                  {
                      title: 'Laporan',
                      items: reportItems,
                  },
              ]
            : []),
        ...(rentalMasterItems.length > 0
            ? [
                  {
                      title: 'Master Rental',
                      items: rentalMasterItems,
                  },
              ]
            : []),
        ...(salesMasterItems.length > 0
            ? [
                  {
                      title: 'Master Penjualan',
                      items: salesMasterItems,
                  },
              ]
            : []),
        ...(sharedMasterItems.length > 0
            ? [
                  {
                      title: 'Master Umum',
                      items: sharedMasterItems,
                  },
              ]
            : []),
        ...(settingsItems.length > 0
            ? [
                  {
                      title: 'Pengaturan',
                      items: settingsItems,
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
                <NavMain groups={navGroups} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
