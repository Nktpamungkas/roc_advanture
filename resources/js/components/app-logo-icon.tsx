import { cn } from '@/lib/utils';
import { ImgHTMLAttributes } from 'react';

export default function AppLogoIcon({ alt = 'Roc Advanture logo', className, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            {...props}
            src="/images/roc-advanture-logo-circle.png"
            alt={alt}
            className={cn('rounded-full object-cover object-center', className)}
        />
    );
}
