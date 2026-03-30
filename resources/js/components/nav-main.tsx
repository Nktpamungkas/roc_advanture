import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { type NavGroup } from '@/types';
import { Link, usePage } from '@inertiajs/react';

export function NavMain({ groups = [] }: { groups: NavGroup[] }) {
    const page = usePage();

    const normalizePath = (url: string) => {
        try {
            const normalized = new URL(url, window.location.origin).pathname;

            return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
        } catch {
            return url.length > 1 ? url.replace(/\/+$/, '') : url;
        }
    };

    const currentPath = normalizePath(page.url);

    const isItemActive = (url: string) => {
        const targetPath = normalizePath(url);

        return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
    };

    return (
        <>
            {groups.map((group) => (
                <SidebarGroup key={group.title} className="px-2 py-0">
                    <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                    <SidebarMenu>
                        {group.items.map((item) => {
                            const active = isItemActive(item.url);

                            return (
                                <SidebarMenuItem
                                    key={item.title}
                                    className={cn(active && 'after:absolute after:top-2 after:bottom-2 after:left-0 after:w-1 after:rounded-r-full after:bg-primary')}
                                >
                                <SidebarMenuButton
                                    asChild
                                    isActive={active}
                                    className={cn(active && 'bg-primary/10 text-primary font-semibold shadow-sm hover:bg-primary/12 hover:text-primary')}
                                >
                                    <Link href={item.url} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            ))}
        </>
    );
}
