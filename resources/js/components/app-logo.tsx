import AppLogoIcon from './app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <div className="flex size-9 items-center justify-center rounded-full border border-sidebar-border/70 bg-white p-0.5 shadow-sm">
                <AppLogoIcon className="size-full" />
            </div>
            <div className="ml-2 grid flex-1 text-left text-sm">
                <span className="mb-0.5 truncate leading-none font-semibold">Roc Advanture</span>
            </div>
        </>
    );
}
