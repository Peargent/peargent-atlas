import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export interface ContextMenuItem {
    label: string;
    icon?: React.ElementType;
    onClick: () => void;
    className?: string;
    shortcut?: string;
    danger?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    // Portal to body to avoid z-index issues
    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                style={{ top: y, left: x }}
                className="fixed z-[9999] min-w-[180px] bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-1.5 flex flex-col origin-top-left"
                onContextMenu={(e) => e.preventDefault()}
            >
                {items.map((item, index) => (
                    <button
                        key={index}
                        onClick={(e) => {
                            e.stopPropagation();
                            item.onClick();
                            onClose();
                        }}
                        className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                            item.danger
                                ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                : "text-foreground/80 hover:text-foreground hover:bg-white/10",
                            item.className
                        )}
                    >
                        {item.icon && <item.icon className="w-4 h-4 opacity-70" />}
                        <span className="flex-1">{item.label}</span>
                        {item.shortcut && (
                            <span className="text-[10px] text-muted-foreground/50 font-mono">{item.shortcut}</span>
                        )}
                    </button>
                ))}
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
