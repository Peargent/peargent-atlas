import { Handle, Position, NodeProps } from '@xyflow/react';
import { Bot, Network, Wrench, Database, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';

// Helper for expand/collapse icon
const ExpandIcon = ({ expanded }: { expanded: boolean }) => (
    <div className="text-muted-foreground/50">
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </div>
);

interface PearNodeData extends Record<string, unknown> {
    name?: string;
    type?: string;
    model?: string;
    persona?: string;
    description?: string;
    expanded?: boolean;
    highlighted?: boolean;
}

// --- Pool Node (Root) ---
export function PoolNode({ data }: NodeProps) {
    const nodeData = data as PearNodeData;
    const highlighted = !!nodeData.highlighted;

    return (
        <div className="relative group w-[320px]">
            {/* Glow Effect */}
            {/* <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl opacity-40 blur-lg" /> */}

            {/* Selection Glow */}
            <div className={cn(
                "absolute inset-0 rounded-2xl transition duration-300",
                highlighted ? "shadow-[0_0_20px_theme(colors.emerald.500)]" : "opacity-0"
            )} />

            {/* Base Connector Layer */}
            <div className="absolute inset-0 pointer-events-none z-50">
                <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-teal-500 !border-2 !border-background z-50 pointer-events-auto" />
            </div>

            <div className={cn(
                "relative flex flex-col gap-4 p-4 rounded-2xl bg-card/90 backdrop-blur-xl border shadow-2xl z-10",
                highlighted ? "border-emerald-500/50" : "border-white/10"
            )}>
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 shrink-0">
                        <Database className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg leading-tight truncate text-foreground">
                            {nodeData.name || "Agent Pool"}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 uppercase tracking-wider">
                            Orchestration Layer
                        </p>
                    </div>
                </div>

                {/* Footer / Badge */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
                        {nodeData.type || "POOL"}
                    </span>
                </div>
            </div>
        </div>
    );
}

// --- Router Node ---
export function RouterNode({ data }: NodeProps) {
    const nodeData = data as PearNodeData;
    const highlighted = !!nodeData.highlighted;

    return (
        <div className="relative group w-[320px]">
            {/* Glow Effect */}
            {/* <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl opacity-40 blur-lg" /> */}

            {/* Selection Glow */}
            <div className={cn(
                "absolute inset-0 rounded-2xl transition duration-300",
                highlighted ? "shadow-[0_0_20px_theme(colors.purple.500)]" : "opacity-0"
            )} />

            {/* Base Connector Layer */}
            <div className="absolute inset-0 pointer-events-none z-50">
                <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background z-50 pointer-events-auto" />
                <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background z-50 pointer-events-auto" />
            </div>

            <div className={cn(
                "relative flex flex-col gap-4 p-4 rounded-2xl bg-card/90 backdrop-blur-xl border shadow-2xl z-10",
                highlighted ? "border-purple-500/50" : "border-white/10"
            )}>
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/20 shrink-0">
                        <Network className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg leading-tight truncate text-foreground">
                            {nodeData.name || "Router"}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 uppercase tracking-wider">
                            Routing Agent
                        </p>
                    </div>
                </div>

                {/* Footer / Badge */}
                {nodeData.type && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-300 text-[10px] font-bold uppercase tracking-widest border border-purple-500/20">
                            {nodeData.type.replace('_', ' ')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Agent Node ---
export function AgentNode({ data }: NodeProps) {
    const nodeData = data as PearNodeData;
    const expanded = !!nodeData.expanded;
    const highlighted = !!nodeData.highlighted;

    // Common Header Content for reuse in Placeholder and Visual
    const HeaderContent = () => (
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 w-full">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/20 shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="overflow-hidden flex-1">
                    <h3 className="font-bold text-base leading-tight truncate" title={nodeData.name}>{nodeData.name}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate" title={nodeData.model}>{nodeData.model || "Unknown Model"}</p>
                </div>
                <ExpandIcon expanded={expanded} />
            </div>
        </div>
    );

    return (
        <div className="relative group w-[320px]">
            {/* Base Connector Layer - Attached to Anchor */}
            <div className="absolute inset-0 pointer-events-none z-50">
                <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-background z-50 pointer-events-auto" />
                <Handle type="source" position={Position.Left} id="left-tool-source" className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-background z-50 pointer-events-auto" style={{ top: 42 }} />
            </div>

            {/* Placeholder - Maintains dimensions in graph flow */}
            <div className="relative flex flex-col gap-3 p-4 border border-transparent opacity-0 pointer-events-none" aria-hidden="true">
                <HeaderContent />
                <div className="mt-1 flex justify-center">
                    <div className="h-0.5 w-8" />
                </div>
            </div>

            {/* Visual Layer - Absolute Overlay */}
            <div
                className={cn(
                    "absolute top-0 left-0 w-full transition-all duration-200",
                    expanded ? "z-50 h-auto" : "z-10 h-full"
                )}
            >
                {/* Selection Glow/Border */}
                <div className={cn(
                    "absolute inset-0 rounded-2xl transition duration-300",
                    highlighted ? "shadow-[0_0_20px_theme(colors.blue.500)]" : "opacity-0"
                )} />

                {/* Glow Effect - Inside wrapper to track size */}
                {/* <div className={cn(
                    "absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl transition duration-500 blur-lg",
                    expanded ? "opacity-60" : "opacity-0 group-hover:opacity-40"
                )} /> */}

                {/* Card Content */}
                <div className={cn(
                    "relative flex flex-col gap-3 p-4 rounded-2xl bg-card/80 backdrop-blur-xl border shadow-2xl cursor-pointer h-full",
                    highlighted ? "border-blue-500/50" : "border-white/10"
                )}>

                    <HeaderContent />

                    {/* Persona Preview - Expanded Only */}
                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                {nodeData.persona ? (
                                    <div className="mt-3 text-sm text-muted-foreground bg-blue-500/5 p-3 rounded-lg border border-white/5">
                                        <p className="italic text-xs leading-relaxed whitespace-pre-wrap">
                                            "{nodeData.persona}"
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mt-3 text-sm text-muted-foreground italic opacity-50">
                                        No persona defined
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Visual Connector / Footer (only visible when not expanded) */}
                    {!expanded && (
                        <div className="mt-1 flex justify-center opacity-30">
                            <div className="h-0.5 w-8 rounded-full bg-white/20" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Tool Node ---
export function ToolNode({ data }: NodeProps) {
    const nodeData = data as PearNodeData;
    const expanded = !!nodeData.expanded;
    const highlighted = !!nodeData.highlighted;

    const HeaderContent = () => (
        <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/20 shrink-0">
                <Wrench className="w-4 h-4 text-white" />
            </div>
            <div className="overflow-hidden flex-1">
                <h3 className="font-bold text-sm leading-tight text-foreground truncate">{nodeData.name}</h3>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Tool</span>
            </div>
        </div>
    );

    return (
        <div
            className="relative group min-w-[180px] max-w-[220px]"
        >
            {/* Placeholder - Maintains dimensions */}
            <div className="relative flex flex-col gap-2 p-3 border border-transparent opacity-0 pointer-events-none" aria-hidden="true">
                <HeaderContent />
            </div>

            {/* Visual Layer - Absolute Overlay */}
            <div
                className={cn(
                    "absolute top-0 left-0 w-full transition-all duration-200",
                    expanded ? "z-50 h-auto" : "z-10 h-full"
                )}
            >
                {/* Selection Glow */}
                <div className={cn(
                    "absolute inset-0 rounded-2xl transition duration-300",
                    highlighted ? "shadow-[0_0_20px_theme(colors.amber.500)]" : "opacity-0"
                )} />

                {/* Glow Effect */}
                {/* <div className={cn(
                    "absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl transition duration-500 blur-md",
                    expanded ? "opacity-60" : "opacity-0 group-hover:opacity-40"
                )} /> */}

                <div className={cn(
                    "relative flex flex-col gap-2 p-3 rounded-xl bg-card/90 backdrop-blur-xl border shadow-lg cursor-pointer h-full",
                    highlighted ? "border-amber-500/50" : "border-white/10"
                )}>
                    <HeaderContent />

                    <AnimatePresence>
                        {expanded && nodeData.description && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <p className="text-[10px] text-muted-foreground mt-2 px-1 leading-relaxed">
                                    {nodeData.description}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-background" style={{ top: 33 }} />
                </div>
            </div>
        </div>
    );
}

