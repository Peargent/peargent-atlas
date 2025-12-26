import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronRight, ChevronDown, Database, Network, Bot, Wrench, Box, Github, TreeDeciduous, PanelLeft, PanelLeftClose, GripVertical, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/theme-toggle';

// Types
interface SidebarProps {
    data: any;
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    className?: string;
    onClose?: () => void;
    onToggleCollapse?: () => void;
}

interface TreeNode {
    id: string;
    label: string;
    type: 'pool' | 'router' | 'agent' | 'tool' | 'collection' | 'history';
    children?: TreeNode[];
    icon?: any;
}

// Resize limits
const MIN_WIDTH = 200;
const MAX_WIDTH = 450;
const DEFAULT_WIDTH = 300;
const COLLAPSED_WIDTH = 48;

// Constants
const TYPE_COLORS: Record<TreeNode['type'], string> = {
    pool: 'text-emerald-500',
    router: 'text-purple-500',
    agent: 'text-blue-500',
    tool: 'text-amber-500',
    collection: 'text-muted-foreground',
    history: 'text-pink-500',
};

const SOCIAL_LINKS = [
    { href: 'https://github.com/quanta-naut/peargent', icon: Github, title: 'GitHub' },
    { href: 'https://peargent.online/socials', icon: TreeDeciduous, title: 'Socials' },
];

// Utility Functions
const createToolNodes = (tools: any[] | undefined, parentId: string): TreeNode[] =>
    tools?.map((tool, idx) => ({
        id: `${parentId}-tool-${idx}`,
        label: tool.name,
        type: 'tool' as const,
        icon: Wrench,
    })) || [];

const createAgentNode = (agent: any, agentId: string): TreeNode => {
    const children: TreeNode[] = createToolNodes(agent.tools, agentId);

    // Add history node if the agent has history
    if (agent.history) {
        children.push({
            id: `${agentId}-history`,
            label: 'History',
            type: 'history' as const,
            icon: History,
        });
    }

    return {
        id: agentId,
        label: agent.name,
        type: 'agent',
        children,
        icon: Bot,
    };
};

const getAllNodeIds = (node: TreeNode): string[] => {
    const ids = [node.id];
    node.children?.forEach(child => ids.push(...getAllNodeIds(child)));
    return ids;
};

const filterTree = (node: TreeNode, query: string): TreeNode | null => {
    const matchesSelf = node.label.toLowerCase().includes(query.toLowerCase());
    const filteredChildren = node.children
        ?.map(child => filterTree(child, query))
        .filter((child): child is TreeNode => child !== null) || [];

    if (matchesSelf || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
    }
    return null;
};

const buildTree = (json: any): TreeNode => {
    if (json.type === 'pool') {
        const children: TreeNode[] = [];

        if (json.data.router) {
            children.push({
                id: 'router-main',
                label: json.data.router.name,
                type: 'router',
                icon: Network,
            });
        }

        json.data.agents?.forEach((agent: any, idx: number) => {
            children.push(createAgentNode(agent, `agent-${idx}`));
        });

        // Add pool-level history node if exists
        if (json.data.history) {
            children.push({
                id: 'pool-history',
                label: 'History',
                type: 'history' as const,
                icon: History,
            });
        }

        return {
            id: 'root',
            label: 'Agent Pool',
            type: 'pool',
            children,
            icon: Database,
        };
    }

    if (json.type === 'collection') {
        const children = json.data.agents?.map((agent: any, idx: number) =>
            createAgentNode(agent, `agent-${idx}`)
        ) || [];

        return {
            id: 'root-collection',
            label: 'Agent Collection',
            type: 'collection',
            children,
            icon: Box,
        };
    }

    if (json.type === 'agent') {
        return {
            id: 'agent-root',
            label: json.data.name,
            type: 'agent',
            children: createToolNodes(json.data.tools, 'agent-root'),
            icon: Bot,
        };
    }

    return { id: 'unknown', label: 'Unknown', type: 'collection', children: [] };
};



const SocialLinks = ({ withHoverEffect = false, vertical = false }: { withHoverEffect?: boolean; vertical?: boolean }) => (
    <div className={cn("flex items-center gap-4 pt-2", vertical && "flex-col")}>
        {SOCIAL_LINKS.map(({ href, icon: Icon, title }) => (
            <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors group relative"
                title={title}
            >
                {withHoverEffect && (
                    <div className="absolute inset-0 bg-white/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                )}
                <Icon className={cn("relative z-10", withHoverEffect ? "w-5 h-5" : "w-4.5 h-4.5")} />
            </a>
        ))}
    </div>
);

const Footer = ({ collapsed }: { collapsed: boolean }) => (
    <div className={cn(
        "mt-auto relative z-10 w-full bg-gradient-to-t from-background to-background/50 backdrop-blur-sm border-t border-sidebar-border hidden md:flex flex-col",
        collapsed && "items-center"
    )}>
        {!collapsed && (
            <div className="flex items-center justify-between px-6 py-4">
                <SocialLinks withHoverEffect />
                <ThemeToggle className="border-none bg-transparent p-0" />
            </div>
        )}
        {collapsed && (
            <div className="py-4 flex flex-col items-center gap-4">
                <SocialLinks vertical />
                <ThemeToggle className="border-none bg-transparent p-0" />
            </div>
        )}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full" />
    </div>
);

const MobileHeader = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex items-center justify-between mb-2 mt-2 mx-2 md:hidden">
        <SocialLinks />
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
);

const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 opacity-50">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
            <Database className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No Data</p>
            <p className="text-xs text-muted-foreground">Import a file to view structure</p>
        </div>
    </div>
);

// Main Component

export default function AtlasSidebar({
    data,
    selectedId,
    onSelect,
    className,
    isCollapsed = false,
    onClose,
    onToggleCollapse
}: SidebarProps & { isCollapsed?: boolean }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [isResizing, setIsResizing] = useState(false);

    const treeData = useMemo(() => data ? buildTree(data) : null, [data]);

    const filteredData = useMemo(() => {
        if (!treeData) return null;
        if (!searchQuery) return treeData;
        return filterTree(treeData, searchQuery);
    }, [treeData, searchQuery]);

    const toggleNode = useCallback((id: string) => {
        setExpandedNodes(prev => {
            const newSet = new Set(prev);
            newSet.has(id) ? newSet.delete(id) : newSet.add(id);
            return newSet;
        });
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (isCollapsed) return;
        e.preventDefault();
        setIsResizing(true);

        const startX = e.clientX;
        const startWidth = width;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startX;
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
    }, [width, isCollapsed]);

    // Auto-expand nodes on data change or search
    useEffect(() => {
        const dataToExpand = searchQuery ? filteredData : treeData;
        if (dataToExpand) {
            setExpandedNodes(new Set(getAllNodeIds(dataToExpand)));
        }
    }, [treeData, filteredData, searchQuery]);

    const renderTree = useCallback((node: TreeNode, depth = 0) => {
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children && node.children.length > 0;
        const Icon = node.icon || Box;
        const isSelected = selectedId === node.id;

        return (
            <div key={node.id} className="select-none">
                <div
                    className={cn(
                        "flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-sm",
                        isSelected ? "bg-sidebar-accent text-foreground font-medium" : "hover:bg-white/5",
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
                            if (hasChildren) toggleNode(node.id);
                        }}
                    >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>

                    <Icon className={cn("w-4 h-4", TYPE_COLORS[node.type])} />
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
    }, [expandedNodes, selectedId, onSelect, toggleNode]);

    const hasNoResults = !filteredData || (filteredData.children?.length === 0 && searchQuery);

    return (
        <div
            style={{ width: isCollapsed ? COLLAPSED_WIDTH : width }}
            className={cn(
                "flex flex-col border-r border-sidebar-border bg-background backdrop-blur-xl h-full relative shrink-0 transition-[width] duration-200",
                isResizing && "select-none transition-none",
                className
            )}
        >
            {/* Resize Handle */}
            {!isCollapsed && (
                <div
                    onMouseDown={handleMouseDown}
                    className={cn(
                        "absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize group hover:bg-primary/20 transition-colors z-10",
                        isResizing && "bg-primary/30"
                    )}
                >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                    </div>
                </div>
            )}

            {/* Header - Only Mobile now */}
            <div className={cn(
                "flex md:hidden",
                isCollapsed ? "justify-center pt-4" : "px-5 py-1 mb-4"
            )}>
                <MobileHeader onClose={onClose} />
            </div>

            {/* Desktop Spacer if expanding? No, header is gone. Just start content. */}

            {/* Content */}
            {isCollapsed ? (
                <div className="flex-1 flex flex-col items-center pt-4 gap-2">
                    <button
                        onClick={onToggleCollapse}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors hidden md:block mb-2"
                        title="Expand sidebar"
                    >
                        <PanelLeft className="w-5 h-5" />
                    </button>

                    {treeData && (
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Database className="w-4 h-4 text-emerald-500" />
                        </div>
                    )}
                </div>
            ) : !treeData ? (
                <div className="flex-1 flex flex-col">
                    <div className="hidden md:flex justify-end p-2">
                        <button
                            onClick={onToggleCollapse}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                            title="Collapse sidebar"
                        >
                            <PanelLeftClose className="w-5 h-5" />
                        </button>
                    </div>
                    <EmptyState />
                </div>
            ) : (
                <>
                    {/* Search & Toggle */}
                    <div className="flex items-center gap-2 px-5 mb-2 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground z-10" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-background/50 border border-sidebar-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-muted-foreground/50"
                            />
                        </div>
                        <button
                            onClick={onToggleCollapse}
                            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors hidden md:block"
                            title="Collapse sidebar"
                        >
                            <PanelLeftClose className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tree */}
                    <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {hasNoResults ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                                No results found for "{searchQuery}"
                            </div>
                        ) : (
                            renderTree(filteredData!)
                        )}
                    </div>
                </>
            )}

            <Footer collapsed={isCollapsed} />
        </div>
    );
}
