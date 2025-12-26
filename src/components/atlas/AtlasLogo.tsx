import { cn } from '@/lib/cn';

export const AtlasLogo = ({ className }: { className?: string }) => (
    <div className={cn("flex items-baseline gap-2 select-none", className)}>
        <span
            className="font-semibold text-foreground leading-none"
            style={{ fontFamily: 'var(--font-instrument-serif), serif', fontSize: '2.1rem' }}
        >
            peargent<span className="text-primary">.</span>
        </span>
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
            Atlas
        </span>
    </div>
);
