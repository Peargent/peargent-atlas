'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, GripHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';

interface MobileBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    nodeColor?: string;
    title?: string;
}

type SheetState = 'closed' | 'peek' | 'half' | 'full';

const PEEK_HEIGHT = 60;
const HALF_HEIGHT_PERCENT = 50;
const FULL_HEIGHT_PERCENT = 90;

export default function MobileBottomSheet({
    isOpen,
    onClose,
    children,
    nodeColor = 'bg-card',
    title = 'Node Details'
}: MobileBottomSheetProps) {
    const [sheetState, setSheetState] = useState<SheetState>('half');
    const containerRef = useRef<HTMLDivElement>(null);
    const [windowHeight, setWindowHeight] = useState(0);

    useEffect(() => {
        setWindowHeight(window.innerHeight);
        const handleResize = () => setWindowHeight(window.innerHeight);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setSheetState('peek');
        }
    }, [isOpen]);

    const getHeight = (state: SheetState) => {
        switch (state) {
            case 'closed': return 0;
            case 'peek': return PEEK_HEIGHT;
            case 'half': return windowHeight * (HALF_HEIGHT_PERCENT / 100);
            case 'full': return windowHeight * (FULL_HEIGHT_PERCENT / 100);
            default: return PEEK_HEIGHT;
        }
    };

    const handleDragEnd = (_: any, info: PanInfo) => {
        const velocity = info.velocity.y;
        const offset = info.offset.y;

        // Fast swipe down = close or reduce
        if (velocity > 500) {
            if (sheetState === 'full') {
                setSheetState('half');
            } else if (sheetState === 'half') {
                setSheetState('peek');
            } else {
                onClose();
            }
            return;
        }

        // Fast swipe up = expand
        if (velocity < -500) {
            if (sheetState === 'peek') {
                setSheetState('half');
            } else if (sheetState === 'half') {
                setSheetState('full');
            }
            return;
        }

        // Slow drag - determine by position
        const currentHeight = getHeight(sheetState);
        const newHeight = currentHeight - offset;
        const halfHeight = getHeight('half');
        const fullHeight = getHeight('full');

        if (newHeight < PEEK_HEIGHT / 2) {
            onClose();
        } else if (newHeight < (PEEK_HEIGHT + halfHeight) / 2) {
            setSheetState('peek');
        } else if (newHeight < (halfHeight + fullHeight) / 2) {
            setSheetState('half');
        } else {
            setSheetState('full');
        }
    };

    // Get color class for the sheet header accent
    const getNodeColorClass = () => {
        if (nodeColor.startsWith('bg-')) {
            return nodeColor;
        }
        return 'bg-primary';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Bottom Sheet */}
                    <motion.div
                        ref={containerRef}
                        initial={{ y: '100%' }}
                        animate={{ y: 0, height: getHeight(sheetState) }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: 'spring',
                            damping: 30,
                            stiffness: 300,
                            mass: 0.8
                        }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0}
                        onDragEnd={handleDragEnd}
                        style={{
                            willChange: 'transform, height',
                            transform: 'translateZ(0)'
                        }}
                        className={cn(
                            "fixed bottom-0 left-0 right-0 z-50 md:hidden",
                            "bg-card border-t border-border rounded-t-2xl shadow-2xl",
                            "flex flex-col overflow-hidden"
                        )}
                    >
                        {/* Drag Handle + Header */}
                        <div className="shrink-0 pt-2 pb-3 px-4">
                            {/* Drag Indicator */}
                            <div className="flex justify-center mb-2">
                                <div className={cn("w-10 h-1.5 rounded-full", getNodeColorClass())} />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <GripHorizontal className="w-4 h-4 text-white/50" />
                                    <span className="font-medium text-sm text-white/90">{title}</span>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto overscroll-contain">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
