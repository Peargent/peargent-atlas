import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown, Database, Network, Bot, Wrench, Box, Github, TreeDeciduous, CircleHelp, User, Sparkles, Menu, PanelLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/theme-toggle';

interface SidebarProps {
    data: any;
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    className?: string;
    hideLogo?: boolean;
    onClose?: () => void;
}

interface TreeNode {
    id: string;
    label: string;
    type: 'pool' | 'router' | 'agent' | 'tool' | 'collection';
    children?: TreeNode[];
    icon?: any;
}

export default function AtlasSidebar({ data, selectedId, onSelect, className, hideLogo, onClose }: SidebarProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));

    const treeData = useMemo(() => {
        if (!data) return null;

        const buildTree = (json: any): TreeNode => {
            // Handle Pool
            if (json.type === 'pool') {
                const children: TreeNode[] = [];

                // Router
                if (json.data.router) {
                    children.push({
                        id: 'router-main',
                        label: json.data.router.name || 'Router',
                        type: 'router',
                        icon: Network
                    });
                }

                // Agents
                if (json.data.agents) {
                    json.data.agents.forEach((agent: any, idx: number) => {
                        const agentId = `agent-${idx}`;
                        const tools = agent.tools?.map((tool: any, tIdx: number) => ({
                            id: `${agentId}-tool-${tIdx}`,
                            label: tool.name,
                            type: 'tool',
                            icon: Wrench
                        })) || [];

                        children.push({
                            id: agentId,
                            label: agent.name,
                            type: 'agent',
                            children: tools,
                            icon: Bot
                        });
                    });
                }

                return {
                    id: 'pool-root',
                    label: json.data.name || 'Agent Pool',
                    type: 'pool',
                    children,
                    icon: Database
                };
            }

            // Handle Collection
            if (json.type === 'collection') {
                const children: TreeNode[] = [];
                if (json.data.agents) {
                    json.data.agents.forEach((agent: any, idx: number) => {
                        const agentId = `agent-${idx}`;
                        const tools = agent.tools?.map((tool: any, tIdx: number) => ({
                            id: `${agentId}-tool-${tIdx}`,
                            label: tool.name,
                            type: 'tool',
                            icon: Wrench
                        })) || [];

                        children.push({
                            id: agentId,
                            label: agent.name,
                            type: 'agent',
                            children: tools,
                            icon: Bot
                        });
                    });
                }
                return {
                    id: 'root-collection',
                    label: 'Agent Collection',
                    type: 'collection',
                    children,
                    icon: Box
                };
            }

            // Handle Single Agent
            if (json.type === 'agent') {
                const agentId = 'agent-root';
                const tools = json.data.tools?.map((tool: any, tIdx: number) => ({
                    id: `${agentId}-tool-${tIdx}`,
                    label: tool.name,
                    type: 'tool',
                    icon: Wrench
                })) || [];

                return {
                    id: agentId,
                    label: json.data.name,
                    type: 'agent',
                    children: tools,
                    icon: Bot
                };
            }

            return { id: 'unknown', label: 'Unknown', type: 'collection', children: [] };
        };

        return buildTree(data);
    }, [data]);

    // Recursive search filter
    const filterTree = (node: TreeNode, query: string): TreeNode | null => {
        const matchesSelf = node.label.toLowerCase().includes(query.toLowerCase());

        let filteredChildren: TreeNode[] = [];
        if (node.children) {
            filteredChildren = node.children
                .map(child => filterTree(child, query))
                .filter((child): child is TreeNode => child !== null);
        }

        if (matchesSelf || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
        }
        return null;
    };

    const filteredData = useMemo(() => {
        if (!treeData) return null;
        if (!searchQuery) return treeData;
        return filterTree(treeData, searchQuery);
    }, [treeData, searchQuery]);

    const toggleNode = (id: string) => {
        const newSet = new Set(expandedNodes);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedNodes(newSet);
    };

    // Auto-expand all by default and on search
    useEffect(() => {
        const dataToExpand = searchQuery ? filteredData : treeData;
        if (dataToExpand) {
            const getAllIds = (node: TreeNode): string[] => {
                let ids = [node.id];
                if (node.children) {
                    node.children.forEach(child => ids.push(...getAllIds(child)));
                }
                return ids;
            };
            setExpandedNodes(new Set(getAllIds(dataToExpand)));
        }
    }, [treeData, filteredData, searchQuery]);


    const renderTree = (node: TreeNode, depth = 0) => {
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children && node.children.length > 0;
        const Icon = node.icon || Box;
        const isSelected = selectedId === node.id;

        return (
            <div key={node.id} className="select-none">
                <div
                    className={cn(
                        "flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-sm",
                        isSelected ? "bg-white/10 text-foreground font-medium" : "hover:bg-white/5",
                        depth === 0 && !isSelected && "font-semibold text-foreground",
                        depth > 0 && !isSelected && "text-muted-foreground hover:text-foreground"
                    )}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    onClick={() => onSelect?.(node.id)}
                >
                    <span
                        className={cn(
                            "text-muted-foreground/50 w-4 h-4 flex items-center justify-center hover:text-foreground transition-colors",
                            !hasChildren && "invisible"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleNode(node.id);
                        }}
                    >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </span>

                    <Icon className={cn(
                        "w-4 h-4",
                        node.type === 'pool' && "text-emerald-500",
                        node.type === 'router' && "text-purple-500",
                        node.type === 'agent' && "text-blue-500",
                        node.type === 'tool' && "text-amber-500",
                    )} />

                    <span className="truncate">{node.label}</span>
                </div>

                <AnimatePresence>
                    {isExpanded && hasChildren && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            {node.children!.map(child => renderTree(child, depth + 1))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    if (!treeData) {
        return (
            <div className={cn("w-[300px] flex flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-xl h-full", className)}>
                <div className="px-5 py-2 border-b border-sidebar-border mb-4">
                    <div className="flex items-center justify-between mb-2 mt-2 mx-2 md:hidden ">
                        <div className="flex items-center gap-3 ">
                            <a href="https://github.com/quanta-naut/peargent" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors group relative" title="GitHub">
                                <Github className="w-4.5 h-4.5" />
                            </a>
                            <a href="https://peargent.online/socials" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors group relative" title="Socials">
                                <TreeDeciduous className="w-4.5 h-4.5" />
                            </a>
                            {/* <button className="text-muted-foreground hover:text-foreground transition-colors group relative" title="Settings">
                                <Settings className="w-4.5 h-4.5" />
                            </button> */}
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 -mr-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <PanelLeft className="w-4.5 h-4.5" />
                            </button>
                        )}
                    </div>
                    {!hideLogo && (
                        <div className="">
                            <span className="font-semibold text-foreground" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontSize: '2.1rem' }}>
                                peargent<span className="text-primary">.</span>
                            </span>
                            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium pl-0.5">Atlas</span>
                        </div>
                    )}
                    <div className={cn("mt-4 mb-2 h-9 bg-white/5 rounded-lg w-full opacity-50", !hideLogo ? "" : "mt-0")} />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 opacity-50">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                        <Database className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">No Data</p>
                        <p className="text-xs text-muted-foreground">Import a file to view structure</p>
                    </div>
                </div>

                {/* Footer Stat (Hidden on mobile) */}
                <div className="mt-auto relative z-10 w-full bg-gradient-to-t from-background to-background/50 backdrop-blur-sm border-t border-sidebar-border hidden md:flex flex-col">
                    {/* Icons Row */}
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-4">
                            <a href="https://github.com/quanta-naut/peargent" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors group relative" title="GitHub">
                                <div className="absolute inset-0 bg-white/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <Github className="w-5 h-5 relative z-10" />
                            </a>
                            <a href="https://peargent.online/socials" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors group relative" title="Socials">
                                <div className="absolute inset-0 bg-white/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <TreeDeciduous className="w-5 h-5 relative z-10" />
                            </a>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle className="border-none bg-transparent p-0" />
                        </div>
                    </div>
                    {/* Divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full" />
                </div>


            </div>
        )
    }

    return (
        <div className={cn("w-[300px] flex flex-col border-r border-sidebar-border bg-background backdrop-blur-xl h-full", className)}>
            {/* Header / Search */}
            <div className="px-5 py-2 border-b border-sidebar-border mb-4">
                <div className="flex items-center justify-between mb-2 mt-2 mx-2 md:hidden ">
                    <div className="flex items-center gap-3">
                        <a href="https://github.com/quanta-naut/peargent" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors group relative" title="GitHub">
                            <Github className="w-5 h-5" />
                        </a>
                        <a href="https://peargent.online/socials" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors group relative" title="Socials">
                            <TreeDeciduous className="w-5 h-5" />
                        </a>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle className="border-none bg-transparent p-0" />
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 -mr-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <PanelLeft className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
                {!hideLogo && (
                    <div className="">
                        <span className="font-semibold text-foreground" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontSize: '2.1rem' }}>
                            peargent<span className="text-primary">.</span>
                        </span>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium pl-0.5">Atlas</span>
                    </div>
                )}
            </div>
            <div className="relative px-5 mb-2">
                <Search className="absolute left-7 top-2.5 w-4 h-4 text-muted-foreground z-10" />
                <input
                    type="text"
                    placeholder="Search agents, tools..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-background/50 border border-sidebar-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-muted-foreground/50"
                />
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {/* Render tree or empty search state */}
                {filteredData ? (
                    renderTree(filteredData)
                ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                        No results found for "{searchQuery}"
                    </div>
                )}

                {filteredData && filteredData.children && filteredData.children.length === 0 && searchQuery && (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                        No results found for "{searchQuery}"
                    </div>
                )}
            </div>

            {/* Footer Stat (Hidden on mobile) */}
            <div className="mt-auto relative z-10 w-full bg-gradient-to-t from-background to-background/50 backdrop-blur-sm border-t border-sidebar-border hidden md:flex flex-col">
                {/* Icons Row */}
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <a href="https://github.com/quanta-naut/peargent" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors group relative" title="GitHub">
                            <div className="absolute inset-0 bg-white/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <Github className="w-5 h-5 relative z-10" />
                        </a>
                        <a href="https://peargent.online/socials" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors group relative" title="Socials">
                            <div className="absolute inset-0 bg-white/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <TreeDeciduous className="w-5 h-5 relative z-10" />
                        </a>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle className="border-none bg-transparent p-0" />
                    </div>
                </div>
                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full" />
            </div>


        </div>
    );
}
