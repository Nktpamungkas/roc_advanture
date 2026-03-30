import { cn } from '@/lib/utils';
import { ImgHTMLAttributes } from 'react';

export default function BrandWordmark({ alt = 'Roc Advanture wordmark', className, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
    return <img {...props} src="/images/roc-advanture-wordmark-2.jpeg" alt={alt} className={cn('h-auto w-full object-contain', className)} />;
}
