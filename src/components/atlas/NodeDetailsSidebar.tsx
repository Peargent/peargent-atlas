"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Bot, Network, Database, Wrench, Code, Settings, RefreshCw, AlertCircle, FileCode, List, Type, User, Brain, GripVertical, History, MessageSquare, PanelRightClose, Plus, MousePointerClick } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { EditableField, FIELD_OPTIONS } from '@/components/ui/EditableField';

interface NodeDetailsSidebarProps {
    node: any;
    nodeType: 'agent' | 'router' | 'tool' | 'pool' | 'history' | null;
    onClose: () => void;
    onUpdate?: (updatedNode: any) => void;
    onWidthChange?: (width: number) => void;
    onToggle?: () => void;
    className?: string;
    isMobile?: boolean;
}

// Resize limits
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 400;

// Section component
const Section = ({ title, icon: Icon, color, children }: {
    title: string;
    icon: any;
    color: string;
    children: React.ReactNode;
}) => (
    <div className="space-y-4">
        <div className={cn("flex items-center gap-2 text-sm font-semibold", color)}>
            <Icon className="w-4 h-4" />
            {title}
        </div>
        <div className="space-y-4 pl-1">
            {children}
        </div>
    </div>
);

// Badge component
const Badge = ({ children, color }: { children: React.ReactNode; color: string }) => (
    <span className={cn("px-2.5 py-1 rounded-md text-xs font-medium border", color)}>
        {children}
    </span>
);

// Read-only DetailField for non-editable display
const DetailField = ({ label, value, icon: Icon, mono = false }: {
    label: string;
    value: React.ReactNode;
    icon?: any;
    mono?: boolean;
}) => {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
            </div>
            <div className={cn(
                "text-foreground text-sm",
                mono && "font-mono bg-secondary/50 p-2.5 rounded-lg border border-border/50"
            )}>
                {value}
            </div>
        </div>
    );
};

// Agent Details with editable fields
const AgentDetails = ({ data, onChange, onBatchChange }: { data: any; onChange: (field: string, value: any) => void; onBatchChange?: (updates: Record<string, any>) => void }) => (
    <div className="space-y-6">
        <Section title="Agent Configuration" icon={Bot} color="text-blue-400">
            <EditableField label="Name" value={data.name} type="text" onChange={(v) => onChange('name', v)} color="text-blue-400" />
            <EditableField label="Description" value={data.description} type="textarea" onChange={(v) => onChange('description', v)} placeholder="Agent description..." color="text-blue-400" />
            <EditableField label="Persona" value={data.persona} type="textarea" onChange={(v) => onChange('persona', v)} icon={User} placeholder="Agent persona/system prompt..." expandable={true} color="text-blue-400" aiGeneration={true} aiApiEndpoint="/api/generate-persona" aiResponseField="persona" onSuggestMetadata={(name, description) => { onBatchChange?.({ name, description }); }} />
        </Section>

        <Section title="Configuration" icon={Settings} color="text-blue-400">
            <div className="space-y-3">
                <EditableField label="Model Provider" value={data.model?.type || 'GroqModel'} type="select" options={FIELD_OPTIONS.model_provider} onChange={(v) => onChange('model.type', v)} color="text-blue-400" />
                <EditableField label="Model Name" value={data.model?.model_name || ''} type="text" onChange={(v) => onChange('model.model_name', v)} mono placeholder="e.g. llama-3.3-70b-versatile" color="text-blue-400" />
            </div>
            <EditableField label="Max Retries" value={data.max_retries} type="number" onChange={(v) => onChange('max_retries', v)} mono placeholder="3" color="text-blue-400" />
            <EditableField label="Tracing" value={String(data.tracing ?? null)} type="select" options={FIELD_OPTIONS.tracing} onChange={(v) => onChange('tracing', v === 'null' ? null : v === 'true' ? true : false)} color="text-blue-400" />
        </Section>

        {data.stop_conditions && (
            <Section title="Stop Conditions" icon={AlertCircle} color="text-blue-400">
                <div className="bg-blue-500/5 rounded-lg p-3 border border-blue-500/10">
                    <DetailField label="Type" value={data.stop_conditions.type} />
                    <EditableField label="Max Steps" value={data.stop_conditions.max_steps} type="number" onChange={(v) => onChange('stop_conditions.max_steps', v)} mono color="text-blue-400" />
                </div>
            </Section>
        )}


    </div>
);

// Helper to extract function body from source_code (removes decorator)
const extractFunctionBody = (sourceCode: string | null | undefined): string => {
    if (!sourceCode) return '';
    // Find the 'def ' line and return from there
    const defMatch = sourceCode.match(/^(def\s+.+)/m);
    if (defMatch) {
        const defIndex = sourceCode.indexOf(defMatch[0]);
        return sourceCode.slice(defIndex);
    }
    return sourceCode;
};

// Tool Details with editable fields
const ToolDetails = ({ data, onChange, onBatchChange }: { data: any; onChange: (field: string, value: any) => void; onBatchChange?: (updates: Record<string, any>) => void }) => {
    // Prefer saved function_body, otherwise extract from source_code
    const functionBody = data.function_body || extractFunctionBody(data.source_code);

    return (
        <div className="space-y-6">
            <Section title="Tool Info" icon={Wrench} color="text-amber-400">
                <EditableField label="Name" value={data.name} type="text" onChange={(v) => onChange('name', v)} icon={Type} color="text-amber-400" />
                <EditableField label="Description" value={data.description} type="textarea" onChange={(v) => onChange('description', v)} placeholder="Tool description..." color="text-amber-400" />
            </Section>

            <Section title="Function Body" icon={Code} color="text-amber-400">
                <div className="text-[10px] text-muted-foreground mb-2 italic">
                    The @create_tool decorator is auto-generated from Name and Description above.
                </div>
                <EditableField
                    label="Function"
                    value={functionBody}
                    type="textarea"
                    onChange={(v) => {
                        // Store the function body, we'll reconstruct source_code with decorator on export
                        onChange('function_body', v);
                    }}
                    icon={Code}
                    mono
                    placeholder="def function_name(param: str) -> str:\n    return 'result'"
                    expandable={true}
                    aiGeneration={true}
                    syntaxLanguage="python"
                    color="text-amber-400"
                    onSuggestMetadata={(name, description) => {
                        onBatchChange?.({ name, description });
                    }}
                />
            </Section>

            <Section title="Retry Configuration" icon={RefreshCw} color="text-amber-400">
                <div className="grid grid-cols-2 gap-3">
                    <EditableField label="Max Retries" value={data.max_retries} type="number" onChange={(v) => onChange('max_retries', v)} mono placeholder="0" color="text-amber-400" />
                    <EditableField label="Retry Delay" value={data.retry_delay} type="number" onChange={(v) => onChange('retry_delay', v)} mono placeholder="1.0" color="text-amber-400" />
                    <EditableField label="Timeout" value={data.timeout} type="number" onChange={(v) => onChange('timeout', v)} mono placeholder="None" color="text-amber-400" />
                    <EditableField label="On Error" value={data.on_error} type="select" options={FIELD_OPTIONS.on_error} onChange={(v) => onChange('on_error', v)} color="text-amber-400" />
                </div>
                <EditableField label="Retry Backoff" value={data.retry_backoff} type="boolean" onChange={(v) => onChange('retry_backoff', v)} color="text-amber-400" />
            </Section>
        </div>
    );
};

// Router Details with editable fields - conditional based on router type
const RouterDetails = ({ data, onChange }: { data: any; onChange: (field: string, value: any) => void }) => {
    const routerType = data.type || 'round_robin';
    const isRoundRobin = routerType === 'round_robin';
    const isSemanticRouter = routerType === 'semantic_router';
    const isRoutingAgent = routerType === 'routing_agent';

    return (
        <div className="space-y-6">
            <Section title="Router Info" icon={Network} color="text-purple-400">
                <EditableField label="Name" value={data.name} type="text" onChange={(v) => onChange('name', v)} icon={Type} color="text-purple-400" />
                <EditableField label="Type" value={routerType} type="select" options={FIELD_OPTIONS.router_type} onChange={(v) => onChange('type', v)} color="text-purple-400" />
                {/* Description and Persona only for Routing Agent */}
                {isRoutingAgent && (
                    <>
                        <EditableField label="Description" value={data.description} type="textarea" onChange={(v) => onChange('description', v)} placeholder="Router description..." color="text-purple-400" />
                        <EditableField label="Persona" value={data.persona} type="textarea" onChange={(v) => onChange('persona', v)} icon={User} placeholder="Router persona..." expandable={true} color="text-purple-400" />
                    </>
                )}
            </Section>

            {data.agents && data.agents.length > 0 && (
                <Section title={`Connected Agents (${data.agents.length})`} icon={Bot} color="text-purple-400">
                    <div className="flex flex-wrap gap-2">
                        {data.agents.map((agent: any, idx: number) => (
                            <Badge key={agent?.name || agent?._id || idx} color="bg-purple-500/10 text-purple-400 border-purple-500/20">
                                {typeof agent === 'string' ? agent : agent?.name || 'Unnamed Agent'}
                            </Badge>
                        ))}
                    </div>
                </Section>
            )}

            {/* Configuration section: only show for Semantic Router and Routing Agent */}
            {!isRoundRobin && (
                <Section title="Configuration" icon={Settings} color="text-purple-400">
                    <div className="space-y-3">
                        <EditableField
                            label="Model Provider"
                            value={data.model?.type || 'GeminiModel'}
                            type="select"
                            options={isSemanticRouter ? FIELD_OPTIONS.embedding_model_provider : FIELD_OPTIONS.model_provider}
                            onChange={(v) => onChange('model.type', v)}
                            color="text-purple-400"
                        />
                        <EditableField label="Model Name" value={data.model?.model_name || ''} type="text" onChange={(v) => onChange('model.model_name', v)} mono placeholder="e.g. gemini-2.5-flash" color="text-purple-400" />
                    </div>
                    {isRoutingAgent && (
                        <EditableField label="Tracing" value={String(data.tracing ?? null)} type="select" options={FIELD_OPTIONS.tracing} onChange={(v) => onChange('tracing', v === 'null' ? null : v === 'true' ? true : false)} color="text-purple-400" />
                    )}
                </Section>
            )}

            {data.stop_conditions && isRoutingAgent && (
                <Section title="Stop Conditions" icon={AlertCircle} color="text-purple-400">
                    <EditableField label="Max Steps" value={data.stop_conditions.max_steps} type="number" onChange={(v) => onChange('stop_conditions.max_steps', v)} mono color="text-purple-400" />
                </Section>
            )}
        </div>
    );
};

// Pool Details with editable fields
const PoolDetails = ({ data, onChange }: {
    data: any;
    onChange: (field: string, value: any) => void;
}) => (
    <div className="space-y-6">
        <Section title="Pool Configuration" icon={Settings} color="text-emerald-400">
            <EditableField label="Max Iterations" value={data.max_iter} type="number" onChange={(v) => onChange('max_iter', v)} mono placeholder="5" color="text-emerald-400" />
            <div className="space-y-3">
                <EditableField label="Model Provider" value={data.model?.type || 'GroqModel'} type="select" options={FIELD_OPTIONS.model_provider} onChange={(v) => onChange('model.type', v)} color="text-emerald-400" />
                <EditableField label="Model Name" value={data.model?.model_name || ''} type="text" onChange={(v) => onChange('model.model_name', v)} mono placeholder="e.g. llama-3.3-70b-versatile" color="text-emerald-400" />
            </div>
            <EditableField label="Tracing" value={data.tracing === true ? 'true' : 'false'} type="select" options={FIELD_OPTIONS.pool_tracing} onChange={(v) => onChange('tracing', v === 'true')} color="text-emerald-400" />
        </Section>

        {data.agent_names && data.agent_names.length > 0 && (
            <Section title={`Agents (${data.agent_names.length})`} icon={Bot} color="text-emerald-400">
                <div className="flex flex-wrap gap-2">
                    {data.agent_names.map((name: string) => (
                        <Badge key={name} color="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            {name}
                        </Badge>
                    ))}
                </div>
            </Section>
        )}
    </div>
);

// History Details with editable fields - conditional based on store type
const HistoryDetails = ({ data, onChange }: { data: any; onChange: (field: string, value: any) => void }) => {
    const storeType = data.store_type?.toLowerCase().replace('historystore', '') || 'session_buffer';
    const isFile = storeType === 'file';
    const isSqlite = storeType === 'sqlite';
    const isPostgresql = storeType === 'postgresql';
    const isRedis = storeType === 'redis';

    return (
        <div className="space-y-6">
            <Section title="History Configuration" icon={History} color="text-pink-400">
                <EditableField label="Store Type" value={storeType} type="select" options={FIELD_OPTIONS.store_type} onChange={(v) => onChange('store_type', v)} color="text-pink-400" />

                {/* File storage options */}
                {isFile && (
                    <EditableField label="Storage Directory" value={data.storage_dir || '.peargent_history'} type="text" onChange={(v) => onChange('storage_dir', v)} mono placeholder=".peargent_history" color="text-pink-400" />
                )}

                {/* SQLite options */}
                {isSqlite && (
                    <>
                        <EditableField label="Database Path" value={data.database_path || 'peargent_history.db'} type="text" onChange={(v) => onChange('database_path', v)} mono placeholder="peargent_history.db" color="text-pink-400" />
                        <EditableField label="Table Prefix" value={data.table_prefix || 'peargent'} type="text" onChange={(v) => onChange('table_prefix', v)} mono placeholder="peargent" color="text-pink-400" />
                    </>
                )}

                {/* PostgreSQL options - connection_string from .env */}
                {isPostgresql && (
                    <>
                        <div className="text-xs text-muted-foreground px-1 py-2 bg-secondary/30 rounded-lg">
                            Connection string loaded from <code className="font-mono text-pink-400">DATABASE_URL</code> environment variable
                        </div>
                        <EditableField label="Table Prefix" value={data.table_prefix || 'peargent'} type="text" onChange={(v) => onChange('table_prefix', v)} mono placeholder="peargent" color="text-pink-400" />
                    </>
                )}

                {/* Redis options - host/port/password from .env */}
                {isRedis && (
                    <>
                        <div className="text-xs text-muted-foreground px-1 py-2 bg-secondary/30 rounded-lg">
                            Connection details loaded from <code className="font-mono text-pink-400">REDIS_URL</code> environment variable
                        </div>
                        <EditableField label="Key Prefix" value={data.key_prefix || 'peargent'} type="text" onChange={(v) => onChange('key_prefix', v)} mono placeholder="peargent" color="text-pink-400" />
                    </>
                )}
            </Section>

            {/* Context Management - show for all persistent stores */}
            {(isFile || isSqlite || isPostgresql || isRedis) && (
                <Section title="Context Management" icon={Settings} color="text-pink-400">
                    <EditableField label="Auto Manage Context" value={String(data.auto_manage_context ?? true)} type="select" options={[
                        { value: 'true', label: 'Enabled' },
                        { value: 'false', label: 'Disabled' },
                    ]} onChange={(v) => onChange('auto_manage_context', v === 'true')} color="text-pink-400" />
                    <EditableField label="Max Context Messages" value={data.max_context_messages || 50} type="number" onChange={(v) => onChange('max_context_messages', v)} mono color="text-pink-400" />
                    <EditableField label="Strategy" value={data.strategy || 'smart'} type="select" options={FIELD_OPTIONS.context_strategy} onChange={(v) => onChange('strategy', v)} color="text-pink-400" />
                </Section>
            )}
        </div>
    );
};

// Type icons and colors
const TYPE_CONFIG = {
    agent: { icon: Bot, color: 'text-blue-400', bgColor: 'bg-gradient-to-br from-blue-500 to-cyan-600', label: 'Agent' },
    router: { icon: Network, color: 'text-purple-400', bgColor: 'bg-purple-500', label: 'Router' },
    tool: { icon: Wrench, color: 'text-amber-400', bgColor: 'bg-gradient-to-br from-amber-500 to-orange-600', label: 'Tool' },
    pool: { icon: Database, color: 'text-emerald-400', bgColor: 'bg-gradient-to-br from-emerald-500 to-teal-600', label: 'Pool' },
    history: { icon: History, color: 'text-pink-400', bgColor: 'bg-gradient-to-br from-pink-500 to-rose-600', label: 'History' },
};

// Empty state component
const EmptySidebarState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 opacity-50">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
            <MousePointerClick className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2 max-w-[240px]">
            <h3 className="font-semibold text-foreground">Nothing to show here</h3>
            <p className="text-sm text-muted-foreground">Select a node to view its configuration, or add a new node to get started.</p>
        </div>
    </div>
);

export default function NodeDetailsSidebar({ node, nodeType, onClose, onUpdate, onWidthChange, onToggle, className, isMobile = false }: NodeDetailsSidebarProps) {
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [isResizing, setIsResizing] = useState(false);
    const [localNode, setLocalNode] = useState(node);

    // Sync local node with prop changes
    useEffect(() => {
        setLocalNode(node);
    }, [node]);

    // Report width changes to parent
    useEffect(() => {
        onWidthChange?.(width);
    }, [width, onWidthChange]);

    // Scroll reset ref
    const scrollRef = useRef<HTMLDivElement>(null);

    // Reset scroll on node change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [node?._nodeId, node?.name]);

    // Handle field changes with dot notation support
    const handleFieldChange = useCallback((field: string, value: any) => {
        let updatedNode: any;
        setLocalNode((prev: any) => {
            const updated = { ...prev };

            // Handle nested paths like 'model.model_name'
            const parts = field.split('.');
            if (parts.length === 1) {
                updated[field] = value;
            } else {
                let current = updated;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) {
                        current[parts[i]] = {};
                    } else {
                        current[parts[i]] = { ...current[parts[i]] };
                    }
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = value;
            }
            updatedNode = updated; // Capture the updated state
            return updated;
        });

        // Notify parent of update after setLocalNode has been called
        if (onUpdate && updatedNode) {
            setTimeout(() => onUpdate(updatedNode), 0);
        }
    }, [onUpdate]);

    // Handle batch field changes (multiple fields at once)
    const handleBatchFieldChange = useCallback((updates: Record<string, any>) => {
        setLocalNode((prev: any) => {
            const updated = { ...prev };

            for (const [field, value] of Object.entries(updates)) {
                const parts = field.split('.');
                if (parts.length === 1) {
                    updated[field] = value;
                } else {
                    let current = updated;
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (!current[parts[i]]) {
                            current[parts[i]] = {};
                        } else {
                            current[parts[i]] = { ...current[parts[i]] };
                        }
                        current = current[parts[i]];
                    }
                    current[parts[parts.length - 1]] = value;
                }
            }

            // Defer onUpdate to avoid setState during render
            if (onUpdate) {
                setTimeout(() => onUpdate(updated), 0);
            }

            return updated;
        });
    }, [onUpdate]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);

        const startX = e.clientX;
        const startWidth = width;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = startX - e.clientX;
            const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
            setWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [width]);

    // Prepare content based on state
    let content = null;
    let header = null;

    if (localNode && nodeType) {
        const config = TYPE_CONFIG[nodeType];

        // Guard against unknown node types (e.g., 'annotation')
        if (!config) {
            return null;
        }

        const Icon = config.icon;
        const nodeName = localNode.name || localNode.label || nodeType;

        header = (
            <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-xl", config.bgColor)}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg text-foreground leading-tight truncate max-w-[280px]" title={nodeName}>
                            {nodeName}
                        </h2>
                        <span className={cn("text-xs font-medium uppercase tracking-wider", config.color)}>
                            {config.label}
                        </span>
                    </div>
                </div>
            </div>
        );

        content = (
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {nodeType === 'agent' && <AgentDetails data={localNode} onChange={handleFieldChange} onBatchChange={handleBatchFieldChange} />}
                {nodeType === 'tool' && <ToolDetails data={localNode} onChange={handleFieldChange} onBatchChange={handleBatchFieldChange} />}
                {nodeType === 'router' && <RouterDetails data={localNode} onChange={handleFieldChange} />}
                {nodeType === 'pool' && <PoolDetails data={localNode} onChange={handleFieldChange} />}
                {nodeType === 'history' && <HistoryDetails data={localNode} onChange={handleFieldChange} />}
            </div>
        );
    } else {
        content = <EmptySidebarState />;
    }

    // Mobile View
    if (isMobile) {
        return (
            <div className={cn("h-full flex flex-col bg-transparent", className)}>
                {header}
                {content}
            </div>
        );
    }

    return (
        <motion.div
            initial={{ width: 0 }}
            animate={{ width }}
            exit={{ width: 0 }}
            transition={{ type: 'tween', duration: isResizing ? 0 : 0.2, ease: 'easeOut' }}
            className={cn(
                "h-full border-l border-border bg-background/95 backdrop-blur-xl flex flex-col shrink-0",
                isResizing && "select-none",
                className
            )}
        >
            <div style={{ width: width, minWidth: width }} className="h-full flex flex-col relative">
                {/* Resize Handle */}
                <div
                    onMouseDown={handleMouseDown}
                    className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize group hover:bg-primary/20 transition-colors z-10",
                        isResizing && "bg-primary/30"
                    )}
                >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                    </div>
                </div>

                {/* Collapse Toggle - positioned outside at left edge */}
                {onToggle && (
                    <button
                        onClick={onToggle}
                        className="absolute top-4 -left-12 p-2 rounded-lg bg-card/80 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground shadow-lg transition-all hover:bg-white/5 hidden md:block"
                        title="Collapse Sidebar"
                    >
                        <PanelRightClose className="w-5 h-5" />
                    </button>
                )}

                {header}
                {content}
            </div>
        </motion.div>
    );
}
