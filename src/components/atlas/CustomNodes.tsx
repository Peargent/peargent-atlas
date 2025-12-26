import { Handle, Position, NodeProps } from '@xyflow/react';
import { Bot, Network, Wrench, Database, History } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PearNodeData extends Record<string, unknown> {
    name?: string;
    type?: string;
    model?: string | { type?: string; model_name?: string };
    persona?: string;
    description?: string;
    expanded?: boolean;
    highlighted?: boolean;
    store_type?: string;
}

// Helper to safely display model - prioritize model_name, then type, then fallback
const getModelDisplay = (model: string | { type?: string; model_name?: string } | undefined): string => {
    if (!model) return "Unknown Model";
    if (typeof model === 'string') return model;
    if (typeof model === 'object') {
        // Prefer model_name (e.g., "groq/llama-3.2-70b-instruct") over type (e.g., "GroqModel")
        if (model.model_name) return model.model_name;
        if (model.type) return model.type;
    }
    return "Unknown Model";
};

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
                <Handle type="source" position={Position.Right} id="right-history-source" className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background z-50 pointer-events-auto" style={{ top: '50%' }} />
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
    const highlighted = !!nodeData.highlighted;

    return (
        <div className="relative group w-[320px]">
            {/* Base Connector Layer */}
            <div className="absolute inset-0 pointer-events-none z-50">
                <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-background z-50 pointer-events-auto" />
                <Handle type="source" position={Position.Left} id="left-tool-source" className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-background z-50 pointer-events-auto" style={{ top: 42 }} />
                <Handle type="source" position={Position.Right} id="right-history-source" className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background z-50 pointer-events-auto" style={{ top: 42 }} />
            </div>

            {/* Selection Glow */}
            <div className={cn(
                "absolute inset-0 rounded-2xl transition duration-300",
                highlighted ? "shadow-[0_0_20px_theme(colors.blue.500)]" : "opacity-0"
            )} />

            {/* Card Content */}
            <div className={cn(
                "relative flex flex-col gap-3 p-4 rounded-2xl bg-card/80 backdrop-blur-xl border shadow-2xl cursor-pointer",
                highlighted ? "border-blue-500/50" : "border-white/10"
            )}>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/20 shrink-0">
                        <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="overflow-hidden flex-1">
                        <h3 className="font-bold text-base leading-tight truncate" title={nodeData.name}>{nodeData.name}</h3>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate" title={getModelDisplay(nodeData.model)}>{getModelDisplay(nodeData.model)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}


// --- Tool Node ---
export function ToolNode({ data }: NodeProps) {
    const nodeData = data as PearNodeData;
    const highlighted = !!nodeData.highlighted;

    return (
        <div className="relative group min-w-[180px] max-w-[220px]">
            {/* Selection Glow */}
            <div className={cn(
                "absolute inset-0 rounded-xl transition duration-300",
                highlighted ? "shadow-[0_0_20px_theme(colors.amber.500)]" : "opacity-0"
            )} />

            <div className={cn(
                "relative flex flex-col gap-2 p-3 rounded-xl bg-card/90 backdrop-blur-xl border shadow-lg cursor-pointer",
                highlighted ? "border-amber-500/50" : "border-white/10"
            )}>
                <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/20 shrink-0">
                        <Wrench className="w-4 h-4 text-white" />
                    </div>
                    <div className="overflow-hidden flex-1">
                        <h3 className="font-bold text-sm leading-tight text-foreground truncate">{nodeData.name}</h3>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Tool</span>
                    </div>
                </div>

                <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-background" style={{ top: 33 }} />
            </div>
        </div>
    );
}

// --- History Node ---
export function HistoryNode({ data }: NodeProps) {
    const nodeData = data as PearNodeData;
    const highlighted = !!nodeData.highlighted;

    return (
        <div className="relative group min-w-[180px] max-w-[220px]">
            {/* Selection Glow */}
            <div className={cn(
                "absolute inset-0 rounded-xl transition duration-300",
                highlighted ? "shadow-[0_0_20px_theme(colors.pink.500)]" : "opacity-0"
            )} />

            <div className={cn(
                "relative flex flex-col gap-2 p-3 rounded-xl bg-card/90 backdrop-blur-xl border shadow-lg cursor-pointer",
                highlighted ? "border-pink-500/50" : "border-white/10"
            )}>
                <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 shadow-md shadow-pink-500/20 shrink-0">
                        <History className="w-4 h-4 text-white" />
                    </div>
                    <div className="overflow-hidden flex-1">
                        <h3 className="font-bold text-sm leading-tight text-foreground truncate">History</h3>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                            {nodeData.store_type || nodeData.type || 'Store'}
                        </span>
                    </div>
                </div>

                <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-pink-500 !border-2 !border-background" style={{ top: 33 }} />
            </div>
        </div>
    );
}

