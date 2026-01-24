"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'default';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Are you sure?",
    message = "This action cannot be undone.",
    confirmText = "Delete",
    cancelText = "Cancel",
    variant = 'danger'
}) => {
    // Handle escape key
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when open
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const variantStyles = {
        danger: {
            icon: 'bg-destructive/10 text-destructive',
            button: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
        },
        warning: {
            icon: 'bg-amber-500/10 text-amber-500',
            button: 'bg-amber-500 hover:bg-amber-600 text-white'
        },
        default: {
            icon: 'bg-primary/10 text-primary',
            button: 'bg-primary hover:bg-primary/90 text-primary-foreground'
        }
    };

    const styles = variantStyles[variant];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-full max-w-md mx-4"
                    >
                        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-start gap-4 p-6 pb-4">
                                <div className={cn("p-3 rounded-xl", styles.icon)}>
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold text-foreground mb-1">
                                        {title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {message}
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 -m-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-muted/30 border-t border-border">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm();
                                        onClose();
                                    }}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                        styles.button
                                    )}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ConfirmDialog;
