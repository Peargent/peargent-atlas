import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronRight, ChevronDown, Database, Network, Bot, Wrench, Box, Github, TreeDeciduous, PanelLeft, PanelLeftClose, History, Pencil, Save, Download, FileJson, FileCode, Video, Image as ImageIcon } from 'lucide-react';
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
    projectName?: string;
    onProjectNameChange?: (name: string) => void;
    isMobile?: boolean; // Added prop
    onSave?: () => void;
    onDownload?: () => void; // Keeping generic just in case, but using specific ones
    onDownloadImage?: () => void;
    tabs?: { id: string; name: string }[];
    activeTabId?: string | null;
    onTabChange?: (id: string) => void;
    onNewTab?: () => void;
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
    { href: 'https://peargent.online/socials', icon: TreeDeciduous, title: 'Socials' },
];

// Utility Functions
const createToolNodes = (tools: any[] | undefined, parentId: string): TreeNode[] =>
    tools?.map((tool, idx) => ({
        id: `${parentId}-tool-${tool._id || idx}`,
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

const buildPoolChildren = (data: any): TreeNode[] => {
    const children: TreeNode[] = [];

    if (data.router) {
        children.push({
            id: 'router-main',
            label: data.router.name,
            type: 'router',
            icon: Network,
        });
    }

    data.agents?.forEach((agent: any, idx: number) => {
        children.push(createAgentNode(agent, `agent-${idx}`));
    });

    if (data.history) {
        children.push({
            id: 'pool-root-history',
            label: 'History',
            type: 'history' as const,
            icon: History,
        });
    }

    // Standalone Pool unassigned items
    data.unassigned_agents?.forEach((agent: any, idx: number) => {
        children.push(createAgentNode(agent, `agent-unassigned-${idx}`));
    });

    data.unassigned_tools?.forEach((tool: any, idx: number) => {
        children.push({
            id: `tool-unassigned-${idx}`,
            label: tool.name,
            type: 'tool',
            icon: Wrench
        });
    });

    return children;
};

const buildTree = (json: any): TreeNode => {
    if (json.type === 'project') {
        const children: TreeNode[] = [];
        const projectData = json.data;

        // 1. Pool
        if (projectData.pool) {
            children.push({
                id: 'pool-root',
                label: projectData.pool.name || 'Agent Pool',
                type: 'pool',
                children: buildPoolChildren(projectData.pool),
                icon: Database,
            });
        }

        // 2. Unassigned Items
        projectData.unassigned_agents?.forEach((agent: any, idx: number) => {
            // Handle ID properly - use _id if available, else idx logic matching layout/handleAddAgent
            const id = agent._id ? `agent-unassigned-${agent._id}` : `agent-unassigned-${idx}`;
            children.push(createAgentNode(agent, id));
        });

        projectData.unassigned_tools?.forEach((tool: any, idx: number) => {
            const id = tool._id ? `tool-unassigned-${tool._id}` : `tool-unassigned-${idx}`;
            children.push({
                id: id,
                label: tool.name,
                type: 'tool',
                icon: Wrench
            });
        });

        projectData.unassigned_histories?.forEach((history: any, idx: number) => {
            const id = history._id ? `history-unassigned-${history._id}` : `history-unassigned-${idx}`;
            children.push({
                id: id,
                label: 'History',
                type: 'history' as const,
                icon: History
            });
        });

        return {
            id: 'project-root',
            label: json.name || 'Project',
            type: 'collection', // Acts as a container
            children,
            icon: Box,
        };
    }

    if (json.type === 'pool') {
        return {
            id: 'root',
            label: json.data.name || 'Agent Pool',
            type: 'pool',
            children: buildPoolChildren(json.data),
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
    <div className={cn("flex items-center gap-4", vertical && "flex-col")}>
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

const MobileTabSwitcher = ({
    tabs,
    activeTabId,
    onTabChange,
    onNewTab
}: {
    tabs?: { id: string; name: string }[];
    activeTabId?: string | null;
    onTabChange?: (id: string) => void;
    onNewTab?: () => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!tabs || !onTabChange || !onNewTab) return null;

    return (
        <div className="px-4 mb-4 md:hidden">
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-card/50 border border-white/10 text-left"
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-1.5 rounded-lg bg-primary/20 text-primary shrink-0">
                            <Box className="w-4 h-4" />
                        </div>
                        <span className="font-medium truncate">
                            {tabs.find(t => t.id === activeTabId)?.name || "Select Project"}
                        </span>
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-popover border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 py-1"
                        >
                            <div className="px-2 pb-2 mb-2 border-b border-white/5">
                                <span className="text-xs font-medium text-muted-foreground px-2 py-2 block">Projects</span>
                            </div>

                            <div className="max-h-[200px] overflow-y-auto px-2 space-y-1">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            onTabChange(tab.id);
                                            setIsOpen(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                                            activeTabId === tab.id
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-1.5 h-1.5 rounded-full shrink-0",
                                            activeTabId === tab.id ? "bg-primary" : "bg-transparent"
                                        )} />
                                        <span className="truncate">{tab.name}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="px-2 pt-2 mt-2 border-t border-white/5">
                                <button
                                    onClick={() => {
                                        onNewTab();
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors"
                                >
                                    <div className="w-5 h-5 rounded-md border border-primary/30 flex items-center justify-center">
                                        <div className="w-2.5 h-0.5 bg-primary rounded-full" />
                                        <div className="w-0.5 h-2.5 bg-primary rounded-full absolute" />
                                    </div>
                                    New Project
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

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
    <div className="flex items-center justify-between py-3 px-4 md:hidden border-b border-sidebar-border mb-2">
        <div className="flex items-center gap-1">
            <ThemeToggle className="border-none bg-transparent p-0" />
        </div>
        <div className="flex items-center gap-4">
            <SocialLinks />
            {onClose && (
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <PanelLeftClose className="w-5 h-5 rotate-180" />
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
            <p className="text-xs text-muted-foreground">Create an Atlas to view structure</p>
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
    onToggleCollapse,
    projectName,
    onProjectNameChange,
    isMobile = false,
    onSave,
    onDownload,
    onDownloadImage,
    tabs,
    activeTabId,
    onTabChange,
    onNewTab,
}: SidebarProps & { isCollapsed?: boolean }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));

    // Fixed width
    const width = DEFAULT_WIDTH;

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
            style={{ width: isMobile ? '100%' : (isCollapsed ? COLLAPSED_WIDTH : width) }}
            className={cn(
                "flex flex-col border-r border-sidebar-border bg-background backdrop-blur-xl h-full relative shrink-0 transition-[width] duration-200",
                className
            )}
        >

            {/* Header - Only Mobile now */}
            <div className={cn(
                "flex md:hidden flex-col w-full",
                isCollapsed && "items-center pt-4"
            )}>
                <MobileHeader onClose={onClose} />
                {!isCollapsed && tabs && activeTabId && onTabChange && onNewTab && (
                    <MobileTabSwitcher
                        tabs={tabs}
                        activeTabId={activeTabId}
                        onTabChange={onTabChange}
                        onNewTab={onNewTab}
                    />
                )}
            </div>

            {/* Desktop Spacer if expanding? No, header is gone. Just start content. */}

            {/* Content */}
            {isCollapsed ? (
                <div className="flex-1 flex flex-col items-center pt-4 gap-2">
                    {treeData && (
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Database className="w-4 h-4 text-emerald-500" />
                        </div>
                    )}
                </div>
            ) : !treeData ? (
                <div className="flex-1 flex flex-col">
                    <EmptyState />
                </div>
            ) : (
                <>
                    {/* Project Name */}
                    {onProjectNameChange && (
                        <div className="px-5 pt-4 pb-2">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Project Name</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={projectName || ''}
                                    onChange={(e) => onProjectNameChange(e.target.value)}
                                    placeholder="Untitled Project"
                                    className="w-full bg-transparent border-b border-border/50 focus:border-primary py-1.5 text-base font-medium text-foreground focus:outline-none transition-colors placeholder:text-muted-foreground/50"
                                />
                                <Pencil className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                            </div>
                        </div>
                    )}

                    {/* Mobile Actions */}
                    {isMobile && (
                        <div className="flex flex-col gap-2 px-5 pb-2">
                            <button
                                onClick={onSave}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-colors text-sm font-medium"
                            >
                                <Save className="w-4 h-4" />
                                Save Project
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={onDownload}
                                    className="flex flex-col items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-card border border-border/50 hover:bg-white/5 transition-colors"
                                    title="Download .pear (JSON)"
                                >
                                    <FileJson className="w-4 h-4 text-primary" />
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase">JSON</span>
                                </button>
                                <button
                                    onClick={onDownloadImage}
                                    className="flex flex-col items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-card border border-border/50 hover:bg-white/5 transition-colors"
                                    title="Download Image (PNG)"
                                >
                                    <ImageIcon className="w-4 h-4 text-blue-500" />
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase">Image</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Search */}
                    <div className="flex items-center gap-2 px-5 mb-2 mt-2">
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
