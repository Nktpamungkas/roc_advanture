import AppLogoIcon from '@/components/app-logo-icon';
import BrandWordmark from '@/components/brand-wordmark';
import { Link } from '@inertiajs/react';

interface AuthLayoutProps {
    children: React.ReactNode;
    name?: string;
    title?: string;
    description?: string;
}

export default function AuthSimpleLayout({ children, title, description }: AuthLayoutProps) {
    return (
        <div className="bg-background relative flex min-h-svh flex-col items-center justify-center overflow-hidden p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.08),_transparent_30%)]" />
            <div className="w-full max-w-sm">
                <div className="relative flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-5">
                        <Link href={route('home')} className="flex w-full flex-col items-center gap-3 font-medium">
                            <div className="w-full rounded-3xl border border-black/10 bg-white px-5 py-4 shadow-sm">
                                <BrandWordmark className="mx-auto max-w-[17rem]" />
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-md">
                                <AppLogoIcon className="size-9 fill-current text-[var(--foreground)] dark:text-white" />
                            </div>
                            <span className="sr-only">{title}</span>
                        </Link>

                        <div className="space-y-2 text-center">
                            <h1 className="text-xl font-medium">{title}</h1>
                            <p className="text-muted-foreground text-center text-sm">{description}</p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
