"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { type Node as ReactFlowNode, type Edge } from '@xyflow/react';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import * as htmlToImage from 'html-to-image';
import AtlasGraph from '@/components/atlas/AtlasGraph';
import AtlasSidebar from '@/components/atlas/AtlasSidebar';
import { AtlasLogo } from '@/components/atlas/AtlasLogo';
import NodeDetailsSidebar from '@/components/atlas/NodeDetailsSidebar';
import { Toast } from "@/components/ui/Toast";
import { Upload, X, Plus, Save, Download, FileJson, ImageIcon, PanelLeft, PanelLeftClose, FileCode, PanelRight, PanelRightClose, Sparkles, FolderOpen, Bot, Network, History, Wrench } from "lucide-react";
import { generatePythonCode, suggestPythonFilename } from "@/lib/generatePythonCode";

// Types
interface AtlasTab {
    id: string;
    name: string;
    data: any;
    layout?: {
        nodes: ReactFlowNode[];
        edges: Edge[];
    };
}

interface DownloadMenuItemProps {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    subtitle: string;
    onClick: () => void;
}

// Components
const DownloadMenuItem = ({ icon, iconBg, label, subtitle, onClick }: DownloadMenuItemProps) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-sm transition-colors text-left"
    >
        <div className={cn("p-1.5 rounded-md", iconBg)}>{icon}</div>
        <div className="flex flex-col gap-0.5">
            <span className="font-medium">{label}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{subtitle}</span>
        </div>
    </button>
);

// Utility Functions
const getNodesBounds = (nodes: ReactFlowNode[]) => {
    if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(n => {
        const x = n.position.x;
        const y = n.position.y;
        const w = n.measured?.width ?? n.width ?? 200;
        const h = n.measured?.height ?? n.height ?? 50;

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + w > maxX) maxX = x + w;
        if (y + h > maxY) maxY = y + h;
    });

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const STORAGE_KEY = 'peargent_atlas_tabs';

export default function AtlasPage() {
    // State
    const [tabs, setTabs] = useState<AtlasTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [detailsNode, setDetailsNode] = useState<any>(null);
    const [detailsNodeType, setDetailsNodeType] = useState<'agent' | 'router' | 'tool' | 'pool' | 'history' | null>(null);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
    const [rightSidebarWidth, setRightSidebarWidth] = useState(400);

    // Refs
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    const mobileDownloadMenuRef = useRef<HTMLDivElement>(null);

    // Derived State
    const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || null, [tabs, activeTabId]);

    // Toast Helper
    const showNotification = useCallback((message: string) => {
        setToastMessage(message);
        setShowToast(true);
    }, []);

    // Handlers
    const handleSave = useCallback(() => {
        if (tabs.length === 0) {
            showNotification("Nothing to save. Please import a file first.");
            return;
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
            showNotification("Saved the current state of atlas to browser");
        } catch (err) {
            console.error("Failed to save to localStorage", err);
            showNotification("Failed to save state");
        }
    }, [tabs, showNotification]);

    const handleDownloadPear = useCallback(() => {
        if (!activeTab?.data) return;

        try {
            const dataStr = JSON.stringify(activeTab.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${activeTab.name}.pear`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setIsDownloadOpen(false);
            showNotification("Downloaded .pear file");
        } catch (err) {
            console.error("Failed to download pear file", err);
            showNotification("Failed to download file");
        }
    }, [activeTab, showNotification]);

    const handleDownloadImage = useCallback(async () => {
        const viewportNode = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!viewportNode || !activeTab?.layout?.nodes) return;

        try {
            const nodes = activeTab.layout.nodes;
            const bounds = getNodesBounds(nodes);
            const padding = 50;
            const width = bounds.width + padding * 2;
            const height = bounds.height + padding * 2;

            const dataUrl = await htmlToImage.toPng(viewportNode, {
                backgroundColor: 'transparent',
                width,
                height,
                style: {
                    width: `${width}px`,
                    height: `${height}px`,
                    transform: `translate(${-bounds.x + padding}px, ${-bounds.y + padding}px) scale(1)`,
                },
                pixelRatio: 4,
                filter: (node) => {
                    if (node.classList?.contains('react-flow__controls') ||
                        node.classList?.contains('react-flow__background') ||
                        node.classList?.contains('react-flow__panel')) {
                        return false;
                    }
                    return true;
                }
            });

            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${activeTab?.name || 'atlas'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setIsDownloadOpen(false);
            showNotification("Downloaded Atlas image");
        } catch (err) {
            console.error("Failed to generate image", err);
            showNotification("Failed to generate image");
        }
    }, [activeTab, showNotification]);

    const handleDownloadPython = useCallback(() => {
        if (!activeTab?.data) {
            showNotification("No data to export. Please import a file first.");
            return;
        }

        try {
            const pythonCode = generatePythonCode(activeTab.data, 'GeneratedAgentSystem');
            const blob = new Blob([pythonCode], { type: 'text/x-python' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = suggestPythonFilename(activeTab.name);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setIsDownloadOpen(false);
            showNotification("Downloaded Python file");
        } catch (err) {
            console.error("Failed to generate Python file", err);
            showNotification("Failed to generate Python file");
        }
    }, [activeTab, showNotification]);

    const handleLayoutChange = useCallback((nodes: ReactFlowNode[], edges: Edge[]) => {
        setTabs(prev => prev.map(tab =>
            tab.id === activeTabId ? { ...tab, layout: { nodes, edges } } : tab
        ));
    }, [activeTabId]);

    // Handle node updates from the sidebar
    const handleNodeUpdate = useCallback((updatedNode: any) => {
        if (!activeTab || !detailsNodeType) return;

        // Use _originalName to match nodes (in case name was changed)
        const originalName = updatedNode._originalName || updatedNode.name;

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data };

            // Update the correct node in the data structure based on node type
            if (detailsNodeType === 'pool') {
                newData.data = { ...newData.data, ...updatedNode };
            } else if (detailsNodeType === 'agent' && newData.data?.agents) {
                newData.data = {
                    ...newData.data,
                    agents: newData.data.agents.map((agent: any) =>
                        agent.name === originalName ? { ...updatedNode, _originalName: originalName } : agent
                    )
                };
            } else if (detailsNodeType === 'router' && newData.data?.router) {
                newData.data = { ...newData.data, router: { ...updatedNode, _originalName: originalName } };
            } else if (detailsNodeType === 'tool' && newData.data?.agents) {
                // Tools are nested inside agents - use _originalName for matching
                newData.data = {
                    ...newData.data,
                    agents: newData.data.agents.map((agent: any) => ({
                        ...agent,
                        tools: agent.tools?.map((tool: any) =>
                            (tool._originalName || tool.name) === originalName
                                ? { ...updatedNode, _originalName: originalName }
                                : tool
                        ) || []
                    }))
                };
            } else if (detailsNodeType === 'history') {
                newData.data = { ...newData.data, history: updatedNode };
            }

            return { ...tab, data: newData };
        }));

        // Also update the detailsNode state to keep sidebar in sync (with _originalName preserved)
        setDetailsNode({ ...updatedNode, _originalName: originalName });
    }, [activeTab, activeTabId, detailsNodeType]);

    const processFile = useCallback((file: File) => {
        if (!file.name.endsWith(".pear") && !file.name.endsWith(".json")) {
            setError("Please upload a valid .pear file");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (!json.type || !json.data) {
                    throw new Error("Invalid .pear file structure");
                }

                const newTab: AtlasTab = {
                    id: crypto.randomUUID(),
                    name: file.name.replace(/\.(pear|json)$/, ''),
                    data: json
                };

                setTabs(prev => [...prev, newTab]);
                setActiveTabId(newTab.id);
                setError(null);
            } catch {
                setError("Failed to parse file. Is it valid JSON?");
            }
        };
        reader.readAsText(file);
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            processFile(e.target.files[0]);
            e.target.value = '';
        }
    }, [processFile]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        setError(null);
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    }, [processFile]);

    const closeTab = useCallback((e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();
        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== tabId);
            if (activeTabId === tabId) {
                setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
            }
            return newTabs;
        });
    }, [activeTabId]);

    // Create a new empty tab (shows onboarding in the tab content)
    const handleNewEmptyTab = useCallback(() => {
        const newTab: AtlasTab = {
            id: crypto.randomUUID(),
            name: 'New Tab',
            data: null  // null means show onboarding options in the tab
        };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        setDetailsNode(null);
        setDetailsNodeType(null);
    }, []);

    // Create a new empty project (sets data on current empty tab or creates new tab)
    const handleNewProject = useCallback(() => {
        const emptyPoolData = {
            type: 'pool',
            data: {
                max_iter: 5,
                tracing: false,
                agents: [],
                unassigned_tools: [],
                router: null,
                history: null
            }
        };

        // If current tab has no data, set it there
        if (activeTab && activeTab.data === null) {
            setTabs(prev => prev.map(tab =>
                tab.id === activeTabId ? { ...tab, name: 'Untitled Project', data: emptyPoolData } : tab
            ));
            setDetailsNode(emptyPoolData);
            setDetailsNodeType('pool');
        } else {
            // Otherwise create a new tab
            const newTab: AtlasTab = {
                id: crypto.randomUUID(),
                name: 'Untitled Project',
                data: emptyPoolData
            };
            setTabs(prev => [...prev, newTab]);
            setActiveTabId(newTab.id);
            setDetailsNode(emptyPoolData);
            setDetailsNodeType('pool');
        }
        showNotification("Created new project");
    }, [activeTab, activeTabId, showNotification]);

    // Import file into current empty tab
    const handleImportToCurrentTab = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        if (!file.name.endsWith(".pear") && !file.name.endsWith(".json")) {
            setError("Please upload a valid .pear file");
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const json = JSON.parse(evt.target?.result as string);
                if (!json.type || !json.data) {
                    throw new Error("Invalid .pear file structure");
                }

                // Update current tab with imported data
                if (activeTabId) {
                    setTabs(prev => prev.map(tab =>
                        tab.id === activeTabId ? { ...tab, name: file.name.replace(/\.(pear|json)$/, ''), data: json } : tab
                    ));
                }
                setError(null);
            } catch {
                setError("Failed to parse file. Is it valid JSON?");
            }
        };
        reader.readAsText(file);
    }, [activeTabId]);

    // Add Agent handler - directly adds agent with random slug
    // Add Agent handler - adds to pool or unassigned
    const handleAddAgent = useCallback((parentId?: string) => {
        const randomSlug = Math.random().toString(36).substring(2, 6);
        const agentName = `New Agent ${randomSlug}`;

        const newAgent = {
            name: agentName,
            persona: 'You are a helpful AI assistant.',
            model: 'gpt-4o',
            temperature: 0.7,
            tools: [],
            history: null
        };

        if (activeTabId && activeTab?.data) {
            setTabs(prev => prev.map(tab => {
                if (tab.id !== activeTabId) return tab;

                const newData = { ...tab.data };

                // Scenario 1: Unassigned (No parentId)
                if (!parentId) {
                    const currentUnassigned = newData.data.unassigned_agents || [];
                    newData.data = {
                        ...newData.data,
                        unassigned_agents: [...currentUnassigned, newAgent]
                    };

                    // Auto-select
                    const newAgentId = `agent-unassigned-${currentUnassigned.length}`;

                    setTimeout(() => {
                        setSelectedNodeId(newAgentId);
                        setDetailsNodeType('agent');
                        setDetailsNode({ ...newAgent, _nodeId: newAgentId, _originalName: agentName });
                        setIsRightSidebarOpen(true);
                    }, 50);

                    return { ...tab, data: newData };
                }

                // Scenario 2: Assigned (Pool/Router) - Currently treated as adding to main 'agents' list
                const currentAgents = newData.data.agents || [];
                newData.data = {
                    ...newData.data,
                    agents: [...currentAgents, newAgent]
                };

                // Auto-select
                const newAgentId = `agent-${currentAgents.length}`;

                setTimeout(() => {
                    setSelectedNodeId(newAgentId);
                    setDetailsNodeType('agent');
                    setDetailsNode({ ...newAgent, _nodeId: newAgentId, _originalName: agentName });
                    setIsRightSidebarOpen(true);
                }, 50);

                return { ...tab, data: newData };
            }));

            showNotification(`Added "${agentName}"`);
        }
    }, [activeTabId, activeTab, showNotification]);

    // Add Tool handler - adds to agent or unassigned
    const handleAddTool = useCallback((agentId?: string) => {
        if (!activeTabId || !activeTab?.data) return;

        const newTool = {
            name: `new_tool_${Math.floor(Math.random() * 1000)}`,
            description: 'Description of the new tool...',
            input_parameters: { param: 'str' },
            source_code: 'def new_tool(param: str):\n    return "result"',
            type: 'tool'
        };

        if (!agentId) {
            setTabs(prev => prev.map(tab => {
                if (tab.id !== activeTabId) return tab;

                const newData = { ...tab.data };
                const currentUnassigned = newData.data.unassigned_tools || [];

                newData.data = {
                    ...newData.data,
                    unassigned_tools: [...currentUnassigned, newTool]
                };

                // Auto-select
                const newToolId = `tool-unassigned-${currentUnassigned.length}`;

                setTimeout(() => {
                    setSelectedNodeId(newToolId);
                    setDetailsNodeType('tool');
                    setDetailsNode({ ...newTool, _nodeId: newToolId, _originalName: newTool.name });
                    setIsRightSidebarOpen(true);
                }, 50);

                return { ...tab, data: newData };
            }));
            showNotification("Added unassigned tool");
            return;
        }

        // Find the agent to add tool to
        // Note: Graph node IDs for agents are "agent-{index}" or "agent-root"
        // But we need to interact with the data structure which relies on array indices or names

        let targetAgentIndex = -1;
        const currentData = activeTab.data.data;
        const agents = currentData?.agents || [];

        // Parse index from ID if possible (format: "agent-{index}")
        if (agentId.startsWith('agent-')) {
            const parts = agentId.split('-');
            const idx = parseInt(parts[1], 10);
            if (!isNaN(idx) && agents[idx]) {
                targetAgentIndex = idx;
            } else if (agentId === 'agent-root' && currentData?.name) {
                // Single agent mode (root) - handled differently potentially, but structure usually has agents array for pool
                // If types are mixed, we might need robust finding. 
                // For now assuming Pool structure with agents array.
            }
        }

        // Fallback: search by name if we stored _originalName in node data, but ReactFlow nodes have ID.
        // Let's stick to index from ID for now as layout.ts generates it this way.

        if (targetAgentIndex === -1 && agents.length > 0) {
            // Try to find by iterating?? No, ID is reliable from layout.ts
            console.error("Could not find agent index for ID:", agentId);
            return;
        }



        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data };
            const newAgents = [...(newData.data.agents || [])];

            if (newAgents[targetAgentIndex]) {
                const agent = { ...newAgents[targetAgentIndex] };
                const currentTools = agent.tools || [];
                agent.tools = [...currentTools, newTool];
                newAgents[targetAgentIndex] = agent;

                // Update specific part of data tree
                newData.data = {
                    ...newData.data,
                    agents: newAgents
                };

                // Auto-select new tool
                // Tool ID format from layout.ts: `${agentId}-tool-${tIdx}`
                const newToolIndex = currentTools.length;
                const newToolId = `${agentId}-tool-${newToolIndex}`;

                // We need to defer this slightly or ensure layout updates happen first? 
                // ReactFlow update might be async. But setting state here triggers re-render 
                // which re-runs layout in AtlasGraph effect.

                setSelectedNodeId(newToolId);
                setDetailsNodeType('tool');
                setDetailsNode({ ...newTool, _nodeId: newToolId, _originalName: newTool.name });
                setIsRightSidebarOpen(true);
            }

            // Update details node if we are looking at the modified agent
            // (We are auto-switching to tool anyway, so maybe less important)

            return { ...tab, data: newData };
        }));

        showNotification("Added new tool");

    }, [activeTabId, activeTab, showNotification]);

    // Handle connecting a tool to an agent (Drag and Drop)
    const handleConnectToolToAgent = useCallback((toolId: string, agentId: string) => {
        if (!activeTabId || !activeTab?.data) return;

        // 1. Identify Tool
        // Is it unassigned?
        const isUnassigned = toolId.startsWith('tool-unassigned-');
        if (!isUnassigned) {
            // Re-assigning existing tool? For now only support unassigned -> agent
            showNotification("Moving existing tools is not supported yet");
            return;
        }

        const unassignedIdx = parseInt(toolId.split('-').pop() || '0', 10);

        // 2. Identify Agent
        let targetAgentIndex = -1;
        const currentData = activeTab.data.data;
        const agents = currentData?.agents || [];

        if (agentId.startsWith('agent-')) {
            const parts = agentId.split('-');
            const idx = parseInt(parts[1], 10);
            if (!isNaN(idx) && agents[idx]) {
                targetAgentIndex = idx;
            }
        }

        if (targetAgentIndex === -1) return;

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data };
            const unassigned = [...(newData.data.unassigned_tools || [])];

            // Get the tool
            const toolToMove = unassigned[unassignedIdx];
            if (!toolToMove) return tab;

            // Remove from unassigned
            unassigned.splice(unassignedIdx, 1);

            // Add to agent
            const newAgents = [...(newData.data.agents || [])];
            const agent = { ...newAgents[targetAgentIndex] };
            agent.tools = [...(agent.tools || []), toolToMove];
            newAgents[targetAgentIndex] = agent;

            newData.data = {
                ...newData.data,
                agents: newAgents,
                unassigned_tools: unassigned
            };

            return { ...tab, data: newData };
        }));

        showNotification("Tool connected to agent");

    }, [activeTab, activeTabId, showNotification]);

    // Add Router handler - Single instance (or global unassigned if we supported multiple, but for now single)
    const handleAddRouter = useCallback(() => {
        if (!activeTabId || !activeTab?.data) return;

        const currentData = activeTab.data.data;
        if (currentData.router) {
            showNotification("Pool already has a router");
            return;
        }

        // Create the Router
        const newRouter = {
            name: 'Router',
            persona: 'You are a routing agent that directs requests to the appropriate specialist agent.',
            model: 'gpt-4o',
            type: 'semantic_router',
            routes: []
        };

        // Even for global add, we assign it as the Pool's router because the schema enforces 1 router.
        // The user's request "manually connect it" likely refers visually. 
        // But if I assign it to data.router, layout.ts AUTOMATICALLY connects it to Pool.
        // To support "manual connection", I must store it elsewhere first.
        // Let's store it in `unassigned_agents` but with type `semantic_router`? 
        // PROPOSAL: If added globally, put in `unassigned_agents`. If added via Pool context, puts in `router`.
        // But `handleAddRouter` takes no arguments from the toolbar.
        // Let's allow `handleAddRouter` to take an argument `assignToPool?: boolean`.
        // Context menu on Pool sends true. Global/Toolbar sends false (or undefined).

        // HOWEVER: If I put it in unassigned_agents, it's an Agent.
        // layout.ts renders unassigned agents as AgentNode.
        // I need to update layout.ts to check `type === 'semantic_router'` and render RouterNode.

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data };

            // For now, adhering to strict schema: There is only ONE router slot.
            // If I put it in unassigned, it's just an agent.
            // Let's assume the user wants the FREEDOM to place it.
            // But structurally it MUST be the router.
            // If I just add it to `data.router`, it works.
            // Maybe the user just wanted the BUTTON to be available globally.
            // Let's stick to assigning it for now as "Unassigned Router" concept is tricky without schema change.
            // Just enabling the global button satisfies "wherever i click I should be able to add".

            newData.data = {
                ...newData.data,
                router: newRouter
            };

            // Auto-select
            const routerId = 'router-main';
            setTimeout(() => {
                setSelectedNodeId(routerId);
                setDetailsNodeType('router');
                setDetailsNode({ ...newRouter, _nodeId: routerId, _originalName: 'Router' });
                setIsRightSidebarOpen(true);
            }, 50);

            return { ...tab, data: newData };
        }));

        showNotification("Added Router");
    }, [activeTabId, activeTab, showNotification]);

    // Handle connecting an unassigned Agent to Pool/Router
    const handleConnectAgentToParent = useCallback((agentId: string, parentId: string) => {
        if (!activeTabId || !activeTab?.data) return;

        // 1. Identify Agent
        if (!agentId.startsWith('agent-unassigned-')) {
            return;
        }
        const unassignedIdx = parseInt(agentId.split('-').pop() || '0', 10);

        // 2. Identify Parent (Pool or Router)
        const isPool = parentId === 'pool-root';
        const isRouter = parentId === 'router-main';

        if (!isPool && !isRouter) return;

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data };
            const unassigned = [...(newData.data.unassigned_agents || [])];

            const agentToMove = unassigned[unassignedIdx];
            if (!agentToMove) return tab;

            // Remove from unassigned
            unassigned.splice(unassignedIdx, 1);

            // Add to agents list
            // If we are connecting to Router, does the data structure change?
            // For now, let's keep all agents in 'agents' array, but the visual Layout will decide parent.
            // Wait, CustomNodes/Layout.ts implies functionality based on structure.
            // If connecting to Router, strictly speaking we might want to move it to `router.routes` or `router.agents`?
            // Looking at `parsePearData` in layout.ts:
            // if (data.data.router) { ... if (data.data.agents) ... }
            // It seems agents are siblings to router in the data object, but VISUALLY connected.
            // However, the standard Peargent structure might strict nesting?
            // Let's stick to flat agents list for now, but if we want to support explicit Router -> Agent routing config later we can.
            // ACTUALLY: layout.ts `parsePearData` lines 128-132:
            // if (data.data.router) { ... addNode('agent', agent, agentId, routerId); }
            // So if a router exists, ALL agents are visually children of the router in the current layout logic.
            // So 'connecting' to Pool vs Router doesn't change the data structure, it just changes visual if router exists.

            // BUT: If the user explicitly connects to Pool when a Router exists... that might be invalid if all agents MUST go through router?
            // For now, let's just move it to the main agents list.

            const currentAgents = newData.data.agents || [];

            newData.data = {
                ...newData.data,
                agents: [...currentAgents, agentToMove],
                unassigned_agents: unassigned
            };

            return { ...tab, data: newData };
        }));

        showNotification("Agent connected");
    }, [activeTabId, activeTab, showNotification]);

    // Add History handler
    const handleAddHistory = useCallback((parentId?: string) => {
        if (!activeTabId || !activeTab?.data) return;

        const currentData = activeTab.data.data;

        // Default History Object
        const newHistory = {
            type: 'sqlite',
            db_path: './history.db'
        };

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data };

            // Scenario 1: Add to Pool (Global/Root)
            // If parentId is missing or explicitly pool-root
            if (!parentId || parentId === 'pool-root') {
                if (newData.data.history) {
                    showNotification("Pool already has history");
                    return tab;
                }

                newData.data = {
                    ...newData.data,
                    history: newHistory
                };

                // Auto-select
                const historyId = 'pool-root-history';
                setTimeout(() => {
                    setSelectedNodeId(historyId);
                    setDetailsNodeType('history');
                    setDetailsNode({ ...newHistory, _nodeId: historyId, _originalName: 'Pool History', _parentId: 'pool-root' });
                    setIsRightSidebarOpen(true);
                }, 50);

                showNotification("Added Pool History");
                return { ...tab, data: newData };
            }

            // Scenario 2: Add to Agent
            if (parentId.startsWith('agent-')) {
                // Find agent index
                const parts = parentId.split('-');
                const idx = parseInt(parts[1], 10);

                if (!isNaN(idx) && newData.data.agents && newData.data.agents[idx]) {
                    const agent = { ...newData.data.agents[idx] };

                    if (agent.history) {
                        showNotification("Agent already has history");
                        return tab;
                    }

                    agent.history = newHistory;

                    const newAgents = [...newData.data.agents];
                    newAgents[idx] = agent;

                    newData.data = {
                        ...newData.data,
                        agents: newAgents
                    };

                    // Auto-select
                    const historyId = `${parentId}-history`;
                    setTimeout(() => {
                        setSelectedNodeId(historyId);
                        setDetailsNodeType('history');
                        setDetailsNode({ ...newHistory, _nodeId: historyId, _originalName: 'Agent History', _parentId: parentId });
                        setIsRightSidebarOpen(true);
                    }, 50);

                    showNotification("Added Agent History");
                    return { ...tab, data: newData };
                }
            }

            return tab;
        }));

    }, [activeTabId, activeTab, showNotification]);

    // Delete Node Handler
    const handleDeleteNode = useCallback((nodeId: string) => {
        if (!activeTabId || !activeTab?.data) return;

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data };
            const currentData = newData.data;
            let nodeDeleted = false;

            // 1. Delete Router
            if (nodeId === 'router-main') {
                if (currentData.router) {
                    delete currentData.router;
                    nodeDeleted = true;
                }
            }
            // 2. Delete Pool History
            else if (nodeId === 'pool-root-history') {
                if (currentData.history) {
                    delete currentData.history;
                    nodeDeleted = true;
                }
            }
            // 3. Delete Unassigned Agent
            else if (nodeId.startsWith('agent-unassigned-')) {
                const idx = parseInt(nodeId.split('agent-unassigned-')[1], 10);
                if (!isNaN(idx) && currentData.unassigned_agents && currentData.unassigned_agents[idx]) {
                    currentData.unassigned_agents.splice(idx, 1);
                    if (currentData.unassigned_agents.length === 0) delete currentData.unassigned_agents;
                    nodeDeleted = true;
                }
            }
            // 4. Delete Unassigned Tool
            else if (nodeId.startsWith('tool-unassigned-')) {
                const idx = parseInt(nodeId.split('tool-unassigned-')[1], 10);
                if (!isNaN(idx) && currentData.unassigned_tools && currentData.unassigned_tools[idx]) {
                    currentData.unassigned_tools.splice(idx, 1);
                    if (currentData.unassigned_tools.length === 0) delete currentData.unassigned_tools;
                    nodeDeleted = true;
                }
            }
            // 5. Delete Assigned Agent
            else if (nodeId.startsWith('agent-') && !nodeId.includes('tool') && !nodeId.includes('history')) {
                const idx = parseInt(nodeId.split('agent-')[1], 10);
                if (!isNaN(idx) && currentData.agents && currentData.agents[idx]) {
                    currentData.agents.splice(idx, 1);
                    if (currentData.agents.length === 0) delete currentData.agents;
                    nodeDeleted = true;
                }
            }
            // 6. Delete Assigned Tool (agent-X-tool-Y)
            else if (nodeId.includes('-tool-')) {
                const parts = nodeId.split('-tool-');
                const agentId = parts[0];
                const toolIdx = parseInt(parts[1], 10);
                const agentIdx = parseInt(agentId.split('agent-')[1], 10);

                if (!isNaN(agentIdx) && !isNaN(toolIdx) && currentData.agents && currentData.agents[agentIdx]) {
                    const agent = currentData.agents[agentIdx];
                    if (agent.tools && agent.tools[toolIdx]) {
                        agent.tools.splice(toolIdx, 1);
                        if (agent.tools.length === 0) delete agent.tools;
                        nodeDeleted = true;
                    }
                }
            }
            // 7. Delete Agent History (agent-X-history)
            else if (nodeId.includes('-history')) {
                const agentId = nodeId.split('-history')[0];
                const agentIdx = parseInt(agentId.split('agent-')[1], 10);
                if (!isNaN(agentIdx) && currentData.agents && currentData.agents[agentIdx]) {
                    const agent = currentData.agents[agentIdx];
                    if (agent.history) {
                        delete agent.history;
                        nodeDeleted = true;
                    }
                }
            }

            if (nodeDeleted) {
                showNotification("Node deleted");

                // Smart Selection Fallback
                if (selectedNodeId === nodeId) {
                    let nextId: string | null = 'pool-root';
                    let nextType: any = 'pool';
                    let nextDataObj: any = currentData; // Pool is root data

                    // 1. If Router deleted -> Pool (Default)

                    // 2. If History deleted -> Parent
                    if (nodeId.includes('-history')) {
                        if (nodeId !== 'pool-root-history') {
                            // Agent History -> Agent
                            const agentId = nodeId.split('-history')[0];
                            // Check if it was unassigned agent or assigned
                            if (agentId.startsWith('agent-unassigned-')) {
                                const idx = parseInt(agentId.split('agent-unassigned-')[1], 10);
                                if (currentData.unassigned_agents && currentData.unassigned_agents[idx]) {
                                    nextId = agentId;
                                    nextType = 'agent';
                                    nextDataObj = currentData.unassigned_agents[idx];
                                }
                            } else {
                                const idx = parseInt(agentId.split('agent-')[1], 10);
                                if (currentData.agents && currentData.agents[idx]) {
                                    nextId = agentId;
                                    nextType = 'agent';
                                    nextDataObj = currentData.agents[idx];
                                }
                            }
                        }
                    }
                    // 3. If Tool deleted -> Parent Agent (or Pool if unassigned)
                    else if (nodeId.includes('-tool-')) {
                        const parts = nodeId.split('-tool-');
                        const parentId = parts[0];
                        if (parentId.startsWith('agent')) {
                            // Go to parent agent
                            // Logic similar to history
                            if (parentId.startsWith('agent-unassigned-')) {
                                const idx = parseInt(parentId.split('agent-unassigned-')[1], 10);
                                if (currentData.unassigned_agents && currentData.unassigned_agents[idx]) {
                                    nextId = parentId;
                                    nextType = 'agent';
                                    nextDataObj = currentData.unassigned_agents[idx];
                                }
                            } else {
                                const idx = parseInt(parentId.split('agent-')[1], 10);
                                if (currentData.agents && currentData.agents[idx]) {
                                    nextId = parentId;
                                    nextType = 'agent';
                                    nextDataObj = currentData.agents[idx];
                                }
                            }
                        }
                    }
                    else if (nodeId.startsWith('tool-unassigned-')) {
                        // Unassigned tool: try prev/next unassigned tool, else Pool
                        // Logic similar to agents below
                        const idx = parseInt(nodeId.split('tool-unassigned-')[1], 10);
                        // `unassigned_tools` array was spliced at `idx`.
                        // New `idx` is the next item.
                        if (currentData.unassigned_tools && currentData.unassigned_tools[idx]) {
                            nextId = `tool-unassigned-${idx}`;
                            nextType = 'tool';
                            nextDataObj = currentData.unassigned_tools[idx];
                        } else if (currentData.unassigned_tools && currentData.unassigned_tools[idx - 1]) {
                            nextId = `tool-unassigned-${idx - 1}`;
                            nextType = 'tool';
                            nextDataObj = currentData.unassigned_tools[idx - 1];
                        }
                    }

                    // 4. If Agent deleted -> Prev Agent or Pool
                    else if (nodeId.startsWith('agent-')) {
                        const isUnassigned = nodeId.startsWith('agent-unassigned-');
                        const prefix = isUnassigned ? 'agent-unassigned-' : 'agent-';
                        const list = isUnassigned ? currentData.unassigned_agents : currentData.agents;
                        const idx = parseInt(nodeId.split(prefix)[1], 10);

                        // Array was spliced at `idx`.
                        // Try same index (next item shifted up)
                        if (list && list[idx]) {
                            nextId = `${prefix}${idx}`;
                            nextType = 'agent';
                            nextDataObj = list[idx];
                        }
                        // Try prev index
                        else if (list && list[idx - 1]) {
                            nextId = `${prefix}${idx - 1}`;
                            nextType = 'agent';
                            nextDataObj = list[idx - 1];
                        }
                        // Default to Pool
                    }

                    // Apply Selection
                    if (nextId) {
                        setTimeout(() => {
                            setSelectedNodeId(nextId);
                            setDetailsNode({ ...nextDataObj, _nodeId: nextId });
                            setDetailsNodeType(nextType);
                            setIsRightSidebarOpen(true);
                        }, 50);
                    } else {
                        // Should not happen as Pool is default, but just in case
                        setSelectedNodeId(null);
                        setIsRightSidebarOpen(false);
                    }
                }

                return { ...tab, data: newData };
            }

            return tab;
        }));
    }, [activeTabId, activeTab, selectedNodeId, showNotification]);

    // Effects
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(target) &&
                mobileDownloadMenuRef.current && !mobileDownloadMenuRef.current.contains(target)) {
                setIsDownloadOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setTabs(parsed);
                    setActiveTabId(parsed[0].id);
                }
            } catch (e) {
                console.error("Failed to load saved atlas state", e);
            }
        }
    }, []);

    // Default to Pool details when tab loads
    useEffect(() => {
        if (activeTab?.data && !detailsNode) {
            setDetailsNode(activeTab.data);
            setDetailsNodeType('pool');
        }
    }, [activeTab, detailsNode]);

    // Download menu items configuration
    const downloadMenuItems = [
        {
            icon: <FileJson className="w-4 h-4" />,
            iconBg: "bg-primary/10 text-primary",
            label: ".pear",
            subtitle: "Source File",
            onClick: handleDownloadPear,
        },
        {
            icon: <FileCode className="w-4 h-4" />,
            iconBg: "bg-amber-500/10 text-amber-500",
            label: ".py",
            subtitle: "Python Code",
            onClick: handleDownloadPython,
        },
        {
            icon: <ImageIcon className="w-4 h-4" />,
            iconBg: "bg-blue-500/10 text-blue-500",
            label: "Image",
            subtitle: "PNG Format",
            onClick: handleDownloadImage,
        },
    ];

    return (
        <div
            className="h-screen w-full bg-background text-foreground flex overflow-hidden relative"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
        >


            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="fixed inset-0 backdrop-blur-[4px] z-50 md:hidden"
                        />
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 left-0 z-50 h-full w-[85vw] max-w-[350px] shadow-2xl md:hidden"
                        >
                            <AtlasSidebar
                                data={activeTab?.data || null}
                                selectedId={selectedNodeId}
                                className="border-r border-l-0 h-full w-full bg-background/95 backdrop-blur-[0px]"

                                onClose={() => setIsSidebarOpen(false)}
                                onSelect={(id: string) => {
                                    setSelectedNodeId(id);
                                    setIsSidebarOpen(false);
                                }}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 relative h-full flex flex-col min-w-0">
                <Toast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />

                {/* Mobile Floating Dock */}
                <div
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 md:hidden z-30 bg-card/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-full"
                >
                    <div className="flex items-center gap-3 px-3 py-1.5 relative">
                        <AnimatePresence>
                            {isDownloadOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                    className="absolute bottom-full mb-6 left-1/2 -translate-x-1/2 min-w-[200px] bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl flex flex-col p-1.5 z-50 origin-bottom"
                                >
                                    {downloadMenuItems.map((item, i) => (
                                        <DownloadMenuItem key={i} {...item} />
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="relative" ref={mobileDownloadMenuRef}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsDownloadOpen(!isDownloadOpen); }}
                                className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 text-foreground transition-all active:scale-95"
                                title="Download"
                            >
                                <Download className="w-5 h-5 opacity-80" />
                            </button>
                        </div>

                        <div className="w-px h-5 bg-white/10" />

                        <button
                            onClick={(e) => { e.stopPropagation(); handleSave(); }}
                            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 text-foreground transition-all active:scale-95"
                            title="Save"
                        >
                            <Save className="w-5 h-5 opacity-80" />
                        </button>
                    </div>
                </div>

                {/* Top Bar */}
                <div className="border-b border-white/10 bg-card/40 backdrop-blur-xl flex flex-col md:flex-row items-center px-4 gap-2 z-40 shrink-0 md:h-[60px] transition-all shadow-sm">
                    {/* Mobile Header */}
                    <div className="flex items-center justify-between w-full md:hidden mb-1 mt-2">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 -ml-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                        >
                            <PanelLeft className="w-4.5 h-4.5" />
                        </button>
                        <div>
                            <span className="font-semibold text-foreground leading-none pt-1" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontSize: '2.1rem' }}>
                                peargent.
                            </span>
                            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium pl-0.5">Atlas</span>
                        </div>
                        <div className="w-8" /> {/* Spacer for centering */}
                    </div>
                    <div className="border w-screen h-px md:hidden" />

                    <div className="border w-screen h-px md:hidden" />

                    {/* Desktop Logo & Sidebar Toggle */}
                    <div className="hidden md:flex items-center justify-between pl-2 pr-4 border-r border-white/5 h-full mr-2 w-[284px] shrink-0">
                        <AtlasLogo />
                    </div>

                    {/* Tabs */}
                    <div className="flex-1 flex items-end gap-0.5 overflow-x-auto w-full md:w-auto scrollbar-hide h-full z-10">
                        <AnimatePresence initial={false}>
                            {tabs.map((tab) => (
                                <motion.div
                                    key={tab.id}
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: 'auto' }}
                                    exit={{ opacity: 0, width: 0 }}
                                    className={cn(
                                        "group flex items-center gap-2 px-4 py-2 border-r border-r-border/50 text-sm font-medium transition-all cursor-pointer select-none min-w-[120px] max-w-[200px] shrink-0 h-full relative",
                                        activeTabId === tab.id
                                            ? "bg-transparent text-foreground pt-2.5 pb-2"
                                            : "bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground pt-2.5 pb-2"
                                    )}
                                    onClick={() => setActiveTabId(tab.id)}
                                >
                                    <span className="truncate flex-1">{tab.name}</span>
                                    {activeTabId === tab.id && (
                                        <motion.div
                                            layoutId="activeTabBottomBorder"
                                            className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-10 shadow-[0_0_10px_2px_rgba(var(--primary),0.5)]"
                                        />
                                    )}
                                    <button
                                        onClick={(e) => closeTab(e, tab.id)}
                                        className={cn(
                                            "p-0.5 rounded-md hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity",
                                            activeTabId === tab.id && "opacity-100"
                                        )}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* New Tab Button */}
                        <div className="shrink-0 flex items-center h-full border-l border-border/50">
                            <button
                                onClick={handleNewEmptyTab}
                                className="flex items-center justify-center w-[48px] h-full hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all group border-r border-border/50"
                                title="New Tab"
                            >
                                <Plus className="w-5 h-5 text-primary opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                            </button>
                        </div>
                    </div>

                    {/* Desktop Actions */}
                    <div className="hidden md:flex items-center h-full gap-0 bg-card/50 backdrop-blur-sm z-20">
                        <button
                            onClick={handleSave}
                            className="flex items-center justify-center w-fit p-4 h-full hover:bg-white/5 hover:text-foreground transition-all group border-r border-border/50 border-l"
                            title="Save"
                        >
                            <Save className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-all mr-2" />
                            <span>Save</span>
                        </button>

                        <div className="relative" ref={downloadMenuRef}>
                            <button
                                onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                                className={cn(
                                    "flex items-center justify-center w-fit p-4 h-full hover:bg-white/5 hover:text-foreground transition-all group border-r border-border/50",
                                    isDownloadOpen && "bg-white/5 text-foreground"
                                )}
                                title="Download"
                            >
                                <Download className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-all mr-2" />
                                <span>Download</span>
                            </button>

                            <AnimatePresence>
                                {isDownloadOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                        className="absolute top-full right-0 mt-1 min-w-[180px] bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl flex flex-col p-1.5 z-50 origin-top-right"
                                    >
                                        {downloadMenuItems.map((item, i) => (
                                            <DownloadMenuItem key={i} {...item} />
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Graph Area + Details Sidebar Container */}
                <div className="flex-1 flex relative overflow-hidden">
                    {/* Left Sidebar */}
                    <div className={cn(
                        "relative z-30 h-full flex flex-col transition-all duration-300 ease-in-out md:translate-x-0 absolute md:relative w-full md:w-auto",
                        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                    )}>
                        <AtlasSidebar
                            data={activeTab?.data}
                            selectedId={selectedNodeId}
                            onSelect={(id) => {
                                setSelectedNodeId(id);
                                if (window.innerWidth < 768) setIsSidebarOpen(false);
                            }}
                            onClose={() => setIsSidebarOpen(false)}
                            isCollapsed={isSidebarCollapsed}
                            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                            projectName={activeTab?.name}
                            onProjectNameChange={(name) => {
                                if (activeTabId) {
                                    setTabs(prev => prev.map(tab =>
                                        tab.id === activeTabId ? { ...tab, name } : tab
                                    ));
                                }
                            }}
                        />
                    </div>

                    {/* Graph Area */}
                    <div className="flex-1 relative bg-background/50 overflow-hidden">
                        <AtlasGraph
                            key={activeTabId || 'empty'}
                            data={activeTab?.data || null}
                            selectedNodeId={selectedNodeId}
                            onNodeSelect={(id) => {
                                setSelectedNodeId(id);
                                setIsDownloadOpen(false);
                            }}
                            onNodeClick={(nodeData: any, nodeType: 'agent' | 'router' | 'tool' | 'pool' | 'history') => {
                                // Set _originalName if not already set (for tracking edits)
                                const nodeWithOriginal = {
                                    ...nodeData,
                                    _originalName: nodeData._originalName || nodeData.name
                                };
                                setDetailsNode(nodeWithOriginal);
                                setDetailsNodeType(nodeType);
                            }}
                            onPaneClick={() => {
                                setIsDownloadOpen(false);
                            }}
                            defaultLayout={activeTab?.layout}
                            onLayoutChange={handleLayoutChange}
                            onAddAgent={handleAddAgent}
                            onAddTool={handleAddTool}
                            onConnectToolToAgent={handleConnectToolToAgent}
                            onConnectAgentToParent={handleConnectAgentToParent}
                            onAddRouter={handleAddRouter}
                            onAddHistory={handleAddHistory}
                            onDeleteNode={handleDeleteNode}
                        />

                        {/* In-Tab Onboarding - shows when tab has no data */}
                        {activeTab && activeTab.data === null && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 bg-background/80 backdrop-blur-sm">
                                <div className="text-center max-w-md mx-auto px-4">
                                    <h2
                                        className="text-3xl font-normal mb-2 text-foreground"
                                        style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
                                    >
                                        Get Started
                                    </h2>
                                    <p className="text-muted-foreground text-sm mb-8">
                                        Choose how you want to begin
                                    </p>

                                    <div className="flex flex-col gap-3">
                                        {/* Build from Scratch */}
                                        <button
                                            onClick={handleNewProject}
                                            className="group w-full p-4 rounded-xl bg-gradient-to-br from-primary/10 to-emerald-500/10 border border-primary/20 hover:border-primary/40 hover:from-primary/15 hover:to-emerald-500/15 transition-all duration-300 text-left flex items-center gap-4"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Sparkles className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-foreground">Build from Scratch</h3>
                                                <p className="text-xs text-muted-foreground">Create agents visually</p>
                                            </div>
                                        </button>

                                        {/* Import File */}
                                        <label className="group w-full p-4 rounded-xl bg-card/50 border border-border hover:border-primary/30 hover:bg-card/80 transition-all duration-300 text-left flex items-center gap-4 cursor-pointer">
                                            <input
                                                type="file"
                                                accept=".pear,.json"
                                                onChange={handleImportToCurrentTab}
                                                className="hidden"
                                            />
                                            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <FolderOpen className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-foreground">Import .pear File</h3>
                                                <p className="text-xs text-muted-foreground">Load existing configuration</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Left Sidebar Toggle */}
                        <div className="absolute top-4 left-4 z-40 hidden md:block">
                            <button
                                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                className="p-2 rounded-lg bg-card/80 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground shadow-lg transition-all hover:bg-white/5"
                                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                            >
                                {isSidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* Right Sidebar Toggle - only show when closed */}
                        {!isRightSidebarOpen && (
                            <div className="absolute top-4 right-4 z-40 hidden md:block">
                                <button
                                    onClick={() => setIsRightSidebarOpen(true)}
                                    className="p-2 rounded-lg bg-card/80 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground shadow-lg transition-all hover:bg-white/5"
                                    title="Expand Sidebar"
                                >
                                    <PanelRight className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {/* Floating Bottom Right Add Buttons */}
                        {activeTab?.data && (
                            <div
                                className="absolute bottom-6 z-40 flex items-center gap-2 p-1.5 rounded-2xl bg-card/90 backdrop-blur-xl border border-border/50 shadow-lg"
                                style={{ right: isRightSidebarOpen ? `${rightSidebarWidth + 24}px` : '24px' }}
                            >
                                {/* Add Agent */}
                                <button
                                    onClick={() => handleAddAgent()}
                                    className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/40"
                                    title="Add Agent"
                                >
                                    <Plus className="w-4 h-4" />
                                    <Bot className="w-4 h-4" />
                                    <span className="text-xs font-medium">Agent</span>
                                </button>

                                {/* Add Tool */}
                                <button
                                    onClick={() => handleAddTool()}
                                    className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/40"
                                    title="Add Tool"
                                >
                                    <Plus className="w-4 h-4" />
                                    <Wrench className="w-4 h-4" />
                                    <span className="text-xs font-medium">Tool</span>
                                </button>

                                {/* Add Router */}
                                <button
                                    onClick={() => handleAddRouter()}
                                    disabled={!!activeTab?.data?.data?.router}
                                    className={cn(
                                        "relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
                                        activeTab?.data?.data?.router
                                            ? "bg-secondary/50 border-transparent text-muted-foreground cursor-not-allowed opacity-50"
                                            : "bg-purple-500/10 border-purple-500/20 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/40"
                                    )}
                                    title="Add Router"
                                >
                                    <Plus className="w-4 h-4" />
                                    <Network className="w-4 h-4" />
                                    <span className="text-xs font-medium">Router</span>
                                </button>

                                {/* Add History */}
                                <button
                                    onClick={() => handleAddHistory()}
                                    disabled={!!activeTab?.data?.data?.history}
                                    className={cn(
                                        "relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
                                        activeTab?.data?.data?.history
                                            ? "bg-secondary/50 border-transparent text-muted-foreground cursor-not-allowed opacity-50"
                                            : "bg-pink-500/10 border-pink-500/20 text-pink-400 hover:text-pink-300 hover:bg-pink-500/20 hover:border-pink-400/40"
                                    )}
                                    title="Add History (Pool)"
                                >
                                    <Plus className="w-4 h-4" />
                                    <History className="w-4 h-4" />
                                    <span className="text-xs font-medium">History</span>
                                </button>
                            </div>
                        )}

                        {/* Empty State - Dual Path Onboarding */}
                        <AnimatePresence>
                            {tabs.length === 0 && !isDragging && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex items-center justify-center z-10"
                                >
                                    <div className="text-center max-w-2xl mx-auto px-4">
                                        {/* Header */}
                                        <h1
                                            className="text-5xl font-normal mb-3 text-foreground"
                                            style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
                                        >
                                            Welcome to <span className="font-medium text-transparent bg-clip-text bg-gradient-to-br from-primary to-emerald-500">peargent</span> Atlas
                                        </h1>
                                        <p className="text-muted-foreground text-lg mb-10 font-light">
                                            Visual builder for AI agent systems
                                        </p>

                                        {/* Dual Path Cards */}
                                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch">
                                            {/* Start from Scratch */}
                                            <button
                                                onClick={handleNewProject}
                                                className="group flex-1 max-w-[280px] p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-emerald-500/10 border border-primary/20 hover:border-primary/40 hover:from-primary/15 hover:to-emerald-500/15 transition-all duration-300 text-left relative overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="relative z-10">
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                        <Sparkles className="w-6 h-6 text-white" />
                                                    </div>
                                                    <h3 className="text-lg font-semibold text-foreground mb-1">Start from Scratch</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Build your agent system visually, node by node
                                                    </p>
                                                </div>
                                            </button>

                                            {/* Import File */}
                                            <label className="group flex-1 max-w-[280px] p-6 rounded-2xl bg-card/50 border border-border hover:border-primary/30 hover:bg-card/80 transition-all duration-300 text-left cursor-pointer relative overflow-hidden">
                                                <input
                                                    type="file"
                                                    accept=".pear,.json"
                                                    onChange={handleFileSelect}
                                                    className="hidden"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="relative z-10">
                                                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                        <FolderOpen className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <h3 className="text-lg font-semibold text-foreground mb-1">Import .pear File</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Load an existing agent configuration
                                                    </p>
                                                </div>
                                            </label>
                                        </div>

                                        {/* Drag hint */}
                                        <p className="text-xs text-muted-foreground/60 mt-8">
                                            or drag and drop a <span className="font-mono text-primary/60">.pear</span> file anywhere
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Drag Overlay */}
                        <AnimatePresence>
                            {isDragging && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
                                >
                                    <div className="absolute inset-4 border-4 border-dashed border-blue-500/50 rounded-3xl flex items-center justify-center bg-blue-500/5">
                                        <div className="text-center">
                                            <div className="w-24 h-24 rounded-3xl bg-blue-500 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/50 animate-bounce">
                                                <Upload className="w-12 h-12 text-white" />
                                            </div>
                                            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-4">
                                                Drop to Open
                                            </h2>
                                            <p className="text-xl text-muted-foreground">Original file will be loaded in a new tab</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right Details Sidebar - Inside flex container to appear on right */}
                    <AnimatePresence>
                        {detailsNode && detailsNodeType && isRightSidebarOpen && (
                            <NodeDetailsSidebar
                                node={detailsNode}
                                nodeType={detailsNodeType}
                                className="absolute right-0 top-0 h-full z-30 border-l border-border/50"
                                onClose={() => {
                                    setDetailsNode(null);
                                    setDetailsNodeType(null);
                                }}
                                onUpdate={handleNodeUpdate}
                                onWidthChange={setRightSidebarWidth}
                                onToggle={() => setIsRightSidebarOpen(false)}
                            />
                        )}
                    </AnimatePresence>
                </div>

                {/* Error Toast */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-red-500/10 text-red-500 backdrop-blur-md rounded-full shadow-lg border border-red-500/20 flex items-center gap-3 font-medium"
                        >
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            {error}
                            <button onClick={() => setError(null)} className="ml-2 opacity-60 hover:opacity-100">
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
