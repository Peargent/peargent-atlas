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
import { Upload, X, Plus, Save, Download, FileJson, ImageIcon, PanelLeft, PanelLeftClose, FileCode, PanelRight, PanelRightClose, Sparkles, FolderOpen, Bot, Network, History, Wrench, Layers, Redo2, Undo2, Menu, ArrowLeft, ArrowRight, Settings, Check, ChevronDown } from "lucide-react";
import MobileBottomSheet from '@/components/atlas/MobileBottomSheet';
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

const generateUUID = () => {
    // Try native crypto.randomUUID first
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export default function AtlasPage() {
    // State
    const [tabs, setTabs] = useState<AtlasTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Desktop sidebar
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [detailsNode, setDetailsNode] = useState<any>(null);
    const [detailsNodeType, setDetailsNodeType] = useState<'agent' | 'router' | 'tool' | 'pool' | 'history' | null>(null);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [isAddToolbarCollapsed, setIsAddToolbarCollapsed] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
    const [rightSidebarWidth, setRightSidebarWidth] = useState(400);
    const [nodePositions, setNodePositions] = useState<Record<string, { x: number, y: number }>>({});
    const [isMobileAddMenuOpen, setIsMobileAddMenuOpen] = useState(false);

    // Refs
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    const mobileDownloadMenuRef = useRef<HTMLDivElement>(null);

    // History for Undo/Redo (per tab)
    const historyRef = useRef<Record<string, any[]>>({});
    const futureRef = useRef<Record<string, any[]>>({});
    const MAX_HISTORY = 50;

    // Derived State
    const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || null, [tabs, activeTabId]);

    // Toast Helper
    const showNotification = useCallback((message: string) => {
        setToastMessage(message);
        setShowToast(true);
    }, []);

    // Push current tab state to history (call before mutations)
    const pushToHistory = useCallback((tabId: string, data: any) => {
        if (!tabId || !data) return;

        const history = historyRef.current[tabId] || [];
        const snapshot = JSON.parse(JSON.stringify(data));
        history.push(snapshot);

        // Limit history size
        if (history.length > MAX_HISTORY) {
            history.shift();
        }

        historyRef.current[tabId] = history;
        historyRef.current[tabId] = history;
        // Clear future on new action
        futureRef.current[tabId] = [];
    }, []);

    // Clear node positions when tab changes to prevent cross-tab pollution (since we only use it for handovers)
    useEffect(() => {
        setNodePositions({});
    }, [activeTabId]);

    // Undo handler
    const handleUndo = useCallback(() => {
        if (!activeTabId) return;

        const history = historyRef.current[activeTabId] || [];
        if (history.length === 0) {
            // showNotification("Nothing to undo");
            return;
        }

        const previousState = history.pop();
        historyRef.current[activeTabId] = history;

        // Save current state to future for redo
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab?.data) {
            const future = futureRef.current[activeTabId] || [];
            future.push(JSON.parse(JSON.stringify(currentTab.data)));
            futureRef.current[activeTabId] = future;
        }

        // Restore previous state
        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;
            return { ...tab, data: previousState };
        }));

        // showNotification("Undo");
    }, [activeTabId, tabs, showNotification]);

    // Redo handler
    const handleRedo = useCallback(() => {
        if (!activeTabId) return;

        const future = futureRef.current[activeTabId] || [];
        if (future.length === 0) {
            // showNotification("Nothing to redo");
            return;
        }

        const nextState = future.pop();
        futureRef.current[activeTabId] = future;

        // Save current state to history
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab?.data) {
            const history = historyRef.current[activeTabId] || [];
            history.push(JSON.parse(JSON.stringify(currentTab.data)));
            historyRef.current[activeTabId] = history;
        }

        // Restore next state
        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;
            return { ...tab, data: nextState };
        }));

        // showNotification("Redo");
    }, [activeTabId, tabs, showNotification]);

    // Keyboard listener for Undo/Redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if user is typing in an input/textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    handleUndo();
                } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
                    e.preventDefault();
                    handleRedo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

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
            // showNotification("Downloaded .pear file");
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
            // showNotification("Downloaded Atlas image");
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
            // showNotification("Downloaded Python file");
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

            // Helper to get the operational root (Pool or Data Root)
            // If project mode, agents/router/history are inside 'pool'
            const isProject = newData.type === 'project';
            const targetRoot = isProject ? (newData.data.pool || {}) : newData.data;

            // Note: We need to write back to newData.data.pool if isProject
            // But checking 'pool' type update implies updating the pool object itself

            if (detailsNodeType === 'pool') {
                if (isProject) {
                    newData.data.pool = { ...newData.data.pool, ...updatedNode };
                } else {
                    newData.data = { ...newData.data, ...updatedNode };
                }
            } else if (detailsNodeType === 'agent') {
                const nodeId = updatedNode._nodeId || '';
                const isUnassigned = nodeId.startsWith('agent-unassigned-');

                if (isUnassigned && newData.data.unassigned_agents) {
                    const newAgents = newData.data.unassigned_agents.map((agent: any) =>
                        agent.name === originalName ? { ...updatedNode, _originalName: updatedNode.name } : agent
                    );
                    newData.data = { ...newData.data, unassigned_agents: newAgents };
                } else if (targetRoot.agents) {
                    const newAgents = targetRoot.agents.map((agent: any) =>
                        agent.name === originalName ? { ...updatedNode, _originalName: updatedNode.name } : agent
                    );

                    if (isProject && newData.data.pool) {
                        newData.data.pool = { ...newData.data.pool, agents: newAgents };
                    } else {
                        newData.data = { ...newData.data, agents: newAgents };
                    }
                }
            } else if (detailsNodeType === 'router' && targetRoot) {
                // Router might be null initially? No, if we are updating it, it exists.
                if (isProject && newData.data.pool) {
                    newData.data.pool = { ...newData.data.pool, router: { ...updatedNode, _originalName: updatedNode.name } };
                } else {
                    newData.data = { ...newData.data, router: { ...updatedNode, _originalName: updatedNode.name } };
                }
            } else if (detailsNodeType === 'tool') {
                const nodeId = updatedNode._nodeId || '';
                const isUnassigned = nodeId.startsWith('tool-unassigned-');
                const isChildOfUnassignedAgent = nodeId.startsWith('agent-unassigned-');

                if (isUnassigned && newData.data.unassigned_tools) {
                    const newTools = newData.data.unassigned_tools.map((tool: any) =>
                        (tool._originalName || tool.name) === originalName ? { ...updatedNode, _originalName: updatedNode.name } : tool
                    );
                    newData.data = { ...newData.data, unassigned_tools: newTools };
                } else if (isChildOfUnassignedAgent && newData.data.unassigned_agents) {
                    // Update tools inside unassigned agents
                    const newUnassignedAgents = newData.data.unassigned_agents.map((agent: any, idx: number) => {
                        const agentId = `agent-unassigned-${agent._id || idx}`;
                        if (!nodeId.startsWith(agentId)) return agent;

                        const updatedTools = (agent.tools || []).map((tool: any) =>
                            (tool._originalName || tool.name) === originalName
                                ? { ...updatedNode, _originalName: updatedNode.name }
                                : tool
                        );
                        return { ...agent, tools: updatedTools };
                    });

                    newData.data.unassigned_agents = newUnassignedAgents;
                } else if (targetRoot.agents) {
                    const newAgents = targetRoot.agents.map((agent: any) => ({
                        ...agent,
                        tools: agent.tools?.map((tool: any) =>
                            (tool._originalName || tool.name) === originalName
                                ? { ...updatedNode, _originalName: updatedNode.name }
                                : tool
                        ) || []
                    }));

                    if (isProject && newData.data.pool) {
                        newData.data.pool = { ...newData.data.pool, agents: newAgents };
                    } else {
                        newData.data = { ...newData.data, agents: newAgents };
                    }
                }
            } else if (detailsNodeType === 'history') {
                if (isProject && newData.data.pool) {
                    newData.data.pool = { ...newData.data.pool, history: { ...updatedNode, _originalName: updatedNode.name } };
                } else {
                    newData.data = { ...newData.data, history: { ...updatedNode, _originalName: updatedNode.name } };
                }
            }

            return { ...tab, data: newData };
        }));

        // Also update the detailsNode state to keep sidebar in sync (track the new name as original for next update)
        setDetailsNode({ ...updatedNode, _originalName: updatedNode.name });
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
                    id: generateUUID(),
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

        // Disable drop if project is active (only allow on welcome/empty tab)
        if (activeTab?.data) return;

        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    }, [processFile, activeTab]);

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
            id: generateUUID(),
            name: 'New Tab',
            data: null  // null means show onboarding options in the tab
        };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        setDetailsNode(null);
        setDetailsNodeType(null);
        setSelectedNodeId(null);
        setIsRightSidebarOpen(false);
    }, []);

    // Create a new empty project (sets data on current empty tab or creates new tab)
    const handleNewProject = useCallback(() => {
        const emptyProjectData = {
            type: 'project',
            data: {
                settings: {
                    tracing: true
                },
                pool: null,
                unassigned_agents: [],
                unassigned_tools: [],
                unassigned_histories: []
            }
        };

        // If current tab has no data, set it there
        if (activeTab && activeTab.data === null) {
            setTabs(prev => prev.map(tab =>
                tab.id === activeTabId ? { ...tab, name: 'Untitled Project', data: emptyProjectData } : tab
            ));
            setDetailsNode(null);
            setDetailsNodeType(null);
            setSelectedNodeId(null);
            setIsRightSidebarOpen(false);
        } else {
            // Otherwise create a new tab
            const newTab: AtlasTab = {
                id: generateUUID(),
                name: 'Untitled Project',
                data: emptyProjectData
            };
            setTabs(prev => [...prev, newTab]);
            setActiveTabId(newTab.id);
            setDetailsNode(null);
            setDetailsNodeType(null);
            setSelectedNodeId(null);
            setIsRightSidebarOpen(false);
        }
        setIsAddToolbarCollapsed(false);
        // showNotification("Created new project");
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
    const handleAddAgent = useCallback((parentId?: string, position?: { x: number, y: number }) => {
        const randomSlug = Math.random().toString(36).substring(2, 6);
        const agentName = `New Agent ${randomSlug}`;
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        const newAgent = {
            _id: uniqueId,
            name: agentName,
            persona: 'You are a helpful AI assistant.',
            model: 'gpt-4o',
            temperature: 0.7,
            tracing: null,
            tools: [],
            history: null
        };

        if (activeTabId && activeTab?.data) {
            setTabs(prev => prev.map(tab => {
                if (tab.id !== activeTabId) return tab;

                const newData = { ...tab.data, data: { ...tab.data.data } };

                // Scenario 1: Unassigned (No parentId)
                if (!parentId) {
                    const currentUnassigned = newData.data.unassigned_agents || [];
                    newData.data = {
                        ...newData.data,
                        unassigned_agents: [...currentUnassigned, newAgent]
                    };

                    // Auto-select using unique ID
                    const newAgentId = `agent-unassigned-${uniqueId}`;

                    // Store position if provided
                    if (position) {
                        setNodePositions(prev => ({ ...prev, [newAgentId]: position }));
                    }

                    setTimeout(() => {
                        setSelectedNodeId(newAgentId);
                        setDetailsNodeType('agent');
                        setDetailsNode({ ...newAgent, _nodeId: newAgentId, _originalName: agentName });
                        setIsRightSidebarOpen(true);
                    }, 50);

                    return { ...tab, data: newData };
                }

                // Scenario 2: Assigned (Pool/Router)
                // Determine container
                // Determine container
                const isProject = newData.type === 'project';
                const container = isProject ? newData.data.pool : newData.data;

                // If in project mode and NO pool exists, we cannot add assigned agent. 
                // Fallback to unassigned?
                if (isProject && !newData.data.pool) {
                    showNotification("No Pool to assign agent to");
                    return tab;
                }

                const currentAgents = container.agents || [];
                const newAgents = [...currentAgents, newAgent];

                if (isProject) {
                    newData.data.pool = { ...newData.data.pool, agents: newAgents };
                } else {
                    newData.data = { ...newData.data, agents: newAgents };
                }

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

            // showNotification(`Added "${agentName}"`);
        }
    }, [activeTabId, activeTab, showNotification]);

    // Add Tool handler - adds to agent or unassigned
    const handleAddTool = useCallback((agentId?: string, position?: { x: number, y: number }) => {
        if (!activeTabId || !activeTab?.data) return;

        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        const newTool = {
            _id: uniqueId,
            name: `new_tool_${Math.floor(Math.random() * 1000)}`,
            description: 'Description of the new tool...',
            input_parameters: { param: 'str' },
            source_code: 'def new_tool(param: str):\n    return "result"',
            type: 'tool'
        };

        if (!agentId) {
            setTabs(prev => prev.map(tab => {
                if (tab.id !== activeTabId) return tab;

                const newData = { ...tab.data, data: { ...tab.data.data } };
                const currentUnassigned = newData.data.unassigned_tools || [];

                newData.data = {
                    ...newData.data,
                    unassigned_tools: [...currentUnassigned, newTool]
                };

                // Auto-select using unique ID
                const newToolId = `tool-unassigned-${uniqueId}`;

                // Store position if provided
                if (position) {
                    setNodePositions(prev => ({ ...prev, [newToolId]: position }));
                }

                setTimeout(() => {
                    setSelectedNodeId(newToolId);
                    setDetailsNodeType('tool');
                    setDetailsNode({ ...newTool, _nodeId: newToolId, _originalName: newTool.name });
                    setIsRightSidebarOpen(true);
                }, 50);

                return { ...tab, data: newData };
            }));
            // showNotification("Added unassigned tool");
            return;
        }

        // Find the agent to add tool to
        const isProject = activeTab.data.type === 'project';
        const currentData = activeTab.data.data;
        // If project mode, drill into pool
        const targetModels = (isProject && currentData.pool) ? (currentData.pool.agents || []) : (currentData.agents || []);

        let targetAgentIndex = -1;

        // Parse index from ID if possible (format: "agent-{index}")
        if (agentId.startsWith('agent-')) {
            const parts = agentId.split('-');
            const idx = parseInt(parts[1], 10);
            if (!isNaN(idx) && targetModels[idx]) {
                targetAgentIndex = idx;
            }
        }

        if (targetAgentIndex === -1) {
            console.error("Could not find agent index for ID:", agentId);
            return;
        }

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data, data: { ...tab.data.data } };
            const isProjectUpdate = newData.type === 'project';

            const container = (isProjectUpdate && newData.data.pool) ? newData.data.pool : (!isProjectUpdate ? newData.data : null);
            if (!container) return tab;

            const newAgents = [...(container.agents || [])];

            if (newAgents[targetAgentIndex]) {
                const agent = { ...newAgents[targetAgentIndex] };
                const currentTools = agent.tools || [];
                agent.tools = [...currentTools, newTool];
                newAgents[targetAgentIndex] = agent;

                // Update specific part of data tree
                if (isProjectUpdate) {
                    newData.data.pool = { ...container, agents: newAgents };
                } else {
                    newData.data = { ...container, agents: newAgents };
                }

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

        // showNotification("Added new tool");

    }, [activeTabId, activeTab, showNotification]);

    // Handle Tool -> Agent connection
    const handleConnectToolToAgent = useCallback((toolId: string, agentId: string, position?: { x: number, y: number }) => {
        if (!activeTabId || !activeTab?.data) return;

        // 1. Identify Tool (only support connecting unassigned tools for now)
        const isUnassignedTool = toolId.startsWith('tool-unassigned-');
        if (!isUnassignedTool) {
            showNotification("Moving existing tools is not supported yet");
            return;
        }

        const uniqueId = toolId.replace('tool-unassigned-', '');

        // 2. Identify Agent (supports both assigned agents and unassigned agents)
        const isProject = activeTab.data.type === 'project';
        const currentData = activeTab.data.data;
        const container = (isProject && currentData.pool) ? currentData.pool : currentData;
        const assignedAgents = container?.agents || [];

        const isUnassignedAgent = agentId.startsWith('agent-unassigned-');
        let targetAgentIndex = -1;
        let agentCollection: any[] | undefined = undefined;
        let updateAssignedAgents = false;

        if (isUnassignedAgent) {
            const unassignedAgents = currentData.unassigned_agents || [];
            agentCollection = unassignedAgents;
            const lookupId = agentId.replace('agent-unassigned-', '');
            targetAgentIndex = unassignedAgents.findIndex((a: any, idx: number) => {
                const candidateId = a._id ?? idx.toString();
                return lookupId === candidateId.toString();
            });
        } else {
            agentCollection = assignedAgents;
            if (agentId.startsWith('agent-')) {
                const parts = agentId.split('-');
                const idx = parseInt(parts[1], 10);
                if (!isNaN(idx) && assignedAgents[idx]) {
                    targetAgentIndex = idx;
                    updateAssignedAgents = true;
                }
            }
        }

        if (!agentCollection || targetAgentIndex === -1 || !agentCollection[targetAgentIndex]) return;

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data, data: { ...tab.data.data } };
            const unassignedTools = [...(newData.data.unassigned_tools || [])];

            const toolIndex = unassignedTools.findIndex((t: any) => t._id === uniqueId || `tool-unassigned-${t._id || unassignedTools.indexOf(t)}` === toolId);
            if (toolIndex === -1) return tab;

            const toolToMove = unassignedTools[toolIndex];

            // Remove from unassigned tools list
            unassignedTools.splice(toolIndex, 1);

            // Prepare agent collections
            const isProjectData = newData.type === 'project';
            const container = (isProjectData && newData.data.pool) ? newData.data.pool : (!isProjectData ? newData.data : null);

            // Assigned agents path
            if (updateAssignedAgents && container) {
                const newAgents = [...(container.agents || [])];
                const agent = { ...newAgents[targetAgentIndex] };
                const currentTools = agent.tools || [];
                agent.tools = [...currentTools, toolToMove];
                newAgents[targetAgentIndex] = agent;

                if (isProjectData) {
                    newData.data.pool = { ...container, agents: newAgents };
                } else {
                    newData.data = { ...container, agents: newAgents };
                }

                // Update unassigned tools list
                newData.data.unassigned_tools = unassignedTools;

                const newToolIndex = currentTools.length;
                const newToolId = `${agentId}-tool-${newToolIndex}`;
                // Transfer position from old tool ID to new tool ID, or use passed position
                if (position) {
                    setNodePositions(prev => {
                        const next = { ...prev };
                        delete next[toolId]; // Remove old ID
                        next[newToolId] = position; // Store under new ID
                        return next;
                    });
                }

                setSelectedNodeId(newToolId);
                setDetailsNodeType('tool');
                setDetailsNode({ ...toolToMove, _nodeId: newToolId, _originalName: toolToMove.name });
                setIsRightSidebarOpen(true);

                return { ...tab, data: newData };
            }

            // Unassigned agent path (agent lives in unassigned_agents)
            if (isUnassignedAgent) {
                const unassignedAgents = [...(newData.data.unassigned_agents || [])];
                const targetAgent = { ...unassignedAgents[targetAgentIndex] };
                const currentTools = targetAgent.tools || [];
                targetAgent.tools = [...currentTools, toolToMove];
                unassignedAgents[targetAgentIndex] = targetAgent;

                newData.data.unassigned_agents = unassignedAgents;
                newData.data.unassigned_tools = unassignedTools;

                const newToolIndex = currentTools.length;
                const newToolId = `${agentId}-tool-${newToolIndex}`;

                if (position) {
                    setNodePositions(prev => ({ ...prev, [newToolId]: position }));
                }

                setSelectedNodeId(newToolId);
                setDetailsNodeType('tool');
                setDetailsNode({ ...toolToMove, _nodeId: newToolId, _originalName: toolToMove.name });
                setIsRightSidebarOpen(true);

                return { ...tab, data: newData };
            }

            return tab;
        }));

        // showNotification("Tool connected to agent");

    }, [activeTab, activeTabId, showNotification]);

    // Add Router handler - Single instance (or global unassigned if we supported multiple, but for now single)
    const handleAddRouter = useCallback((position?: { x: number, y: number }) => {
        if (!activeTabId || !activeTab?.data) return;

        const currentData = activeTab.data.data;
        if (currentData.router) {
            showNotification("Pool already has a router");
            return;
        }

        // Create the Router
        const newRouter = {
            _id: crypto.randomUUID(),
            name: 'Router',
            persona: 'You are a routing agent that directs requests to the appropriate specialist agent.',
            model: 'gpt-4o',
            type: 'semantic_router',
            tracing: null,
            routes: []
        };

        // Even for global add, we assign it as the Pool's router because the schema enforces 1 router.
        // The user's request "manually connect it" likely refers visually. 
        // But if I assign it to data.router, layout.ts AUTOMATICALLY connects it to Pool.
        // To support "manual connection", I must store it elsewhere first.
        // Let's store it in `unassigned_agents` but with type `semantic_router`? 
        // PROPOSAL: If added globally, put in `unassigned_agents`. If added via Pool context, puts in `router`.
        // But `handleAddRouter` takes no arguments from the toolbar.
        // Let's allow `handleAddRouter` to take an argument `assignToPool ?: boolean`.
        // Context menu on Pool sends true. Global/Toolbar sends false (or undefined).

        // HOWEVER: If I put it in unassigned_agents, it's an Agent.
        // layout.ts renders unassigned agents as AgentNode.
        // I need to update layout.ts to check `type === 'semantic_router'` and render RouterNode.

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data, data: { ...tab.data.data } };

            // For now, adhering to strict schema: There is only ONE router slot.
            // If I put it in unassigned, it's just an agent.
            // Let's assume the user wants the FREEDOM to place it.
            // But structurally it MUST be the router.
            // If I just add it to `data.router`, it works.
            // Maybe the user just wanted the BUTTON to be available globally.
            // Let's stick to assigning it for now as "Unassigned Router" concept is tricky without schema change.
            // Just enabling the global button satisfies "wherever i click I should be able to add".

            const isProject = newData.type === 'project';
            const container = (isProject && newData.data.pool) ? newData.data.pool : newData.data;

            // If project mode and no pool, cannot add router to pool
            if (isProject && !container) {
                showNotification("No Pool to select");
                return tab;
            }

            if (isProject) {
                newData.data.pool = { ...container, router: newRouter };
            } else {
                newData.data = { ...newData.data, router: newRouter };
            }

            // Auto-select
            const routerId = 'router-main';

            // Store position if provided
            if (position) {
                setNodePositions(prev => ({ ...prev, [routerId]: position }));
            }

            setTimeout(() => {
                setSelectedNodeId(routerId);
                setDetailsNodeType('router');
                setDetailsNode({ ...newRouter, _nodeId: routerId, _originalName: 'Router' });
                setIsRightSidebarOpen(true);
            }, 50);

            return { ...tab, data: newData };
        }));

        // showNotification("Added Router");
    }, [activeTabId, activeTab, showNotification]);

    // Add Pool handler
    const handleAddPool = useCallback((position?: { x: number, y: number }) => {
        if (!activeTabId || !activeTab?.data) return;

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data, data: { ...tab.data.data } };

            // Check if pool already exists
            const hasPool = (newData.type === 'pool') || (newData.type === 'project' && newData.data.pool);
            if (hasPool) {
                showNotification("Pool already exists");
                return tab;
            }

            // Create Pool Data
            const newPool = {
                max_iter: 5,
                tracing: null,
                agents: [],
                router: null,
                history: null
            };

            // If simple 'pool' type (legacy or direct), we can't really "add" it if it is the root without resetting.
            // But we are using 'project' type now.
            if (newData.type === 'project') {
                newData.data = {
                    ...newData.data,
                    pool: newPool
                };
            } else {
                // Should not happen with new projects, but fallback:
                // If data is weirdly empty, init as pool?
                // Or if we want to migrate generic to project?
                return tab;
            }

            // Auto-select
            const poolId = 'pool-root';

            // Store position if provided
            if (position) {
                setNodePositions(prev => ({ ...prev, [poolId]: position }));
            }

            setTimeout(() => {
                setSelectedNodeId(poolId);
                setDetailsNodeType('pool');
                setDetailsNode({ ...newPool, _nodeId: poolId, _originalName: 'Agent Pool' });
                setIsRightSidebarOpen(true);
            }, 50);

            return { ...tab, data: newData };
        }));
        // showNotification("Added Agent Pool");
    }, [activeTabId, activeTab, showNotification]);

    // Connect Agent -> Pool/Router
    const handleConnectAgentToParent = useCallback((agentId: string, parentId: string, position?: { x: number, y: number }) => {
        if (!activeTabId || !activeTab?.data) return;

        // 1. Identify Agent
        if (!agentId.startsWith('agent-unassigned-')) {
            return;
        }
        const uniqueId = agentId.replace('agent-unassigned-', '');

        // 2. Identify Parent (Pool or Router)
        const isPool = parentId === 'pool-root';
        const isRouter = parentId === 'router-main';

        if (!isPool && !isRouter) return;

        // Calculate the new agent ID before state updates
        const isProject = activeTab.data.type === 'project';
        const container = (isProject && activeTab.data.data.pool) ? activeTab.data.data.pool : activeTab.data.data;
        const currentAgents = container?.agents || [];
        const newAgentId = `agent-${currentAgents.length}`;

        // Get the agent being moved to check for attached tools/history
        const unassignedAgents = activeTab.data.data.unassigned_agents || [];
        const agentBeingMoved = unassignedAgents.find((a: any) =>
            a._id === uniqueId || `agent-unassigned-${a._id}` === agentId
        );
        const attachedTools = agentBeingMoved?.tools || [];
        const hasHistory = !!agentBeingMoved?.history;

        // Transfer ALL positions: agent, its tools, and its history
        setNodePositions(prev => {
            const next = { ...prev };

            // Transfer agent position
            if (position) {
                next[newAgentId] = position;
            }

            // Transfer tool positions from old IDs to new IDs
            attachedTools.forEach((_tool: any, idx: number) => {
                const oldToolId = `${agentId}-tool-${idx}`;
                const newToolId = `${newAgentId}-tool-${idx}`;
                if (next[oldToolId]) {
                    next[newToolId] = next[oldToolId];
                    delete next[oldToolId];
                }
            });

            // Transfer history position
            if (hasHistory) {
                const oldHistoryId = `${agentId}-history`;
                const newHistoryId = `${newAgentId}-history`;
                if (next[oldHistoryId]) {
                    next[newHistoryId] = next[oldHistoryId];
                    delete next[oldHistoryId];
                }
            }

            return next;
        });

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data, data: { ...tab.data.data } };
            const unassigned = [...(newData.data.unassigned_agents || [])];

            const agentIndex = unassigned.findIndex((a: any) => a._id === uniqueId || `agent-unassigned-${a._id || unassigned.indexOf(a)}` === agentId);
            if (agentIndex === -1) return tab;

            const agentToMove = unassigned[agentIndex];

            // Remove from unassigned
            unassigned.splice(agentIndex, 1);

            // Add to agents list
            const isProject = newData.type === 'project';
            const container = (isProject && newData.data.pool) ? newData.data.pool : newData.data;
            if (isProject && !container) return tab;

            const currentAgents = container.agents || [];
            const newAgentsList = [...currentAgents, agentToMove];

            if (isProject) {
                newData.data = {
                    ...newData.data,
                    unassigned_agents: unassigned,
                    pool: { ...container, agents: newAgentsList }
                };
            } else {
                newData.data = {
                    ...newData.data,
                    agents: newAgentsList,
                    unassigned_agents: unassigned
                };
            }

            return { ...tab, data: newData };
        }));

        // showNotification("Agent connected");
    }, [activeTabId, activeTab, showNotification]);

    // Handle node position updates when manually dragged
    const handleNodePositionChange = useCallback((nodeId: string, position: { x: number, y: number }) => {
        setNodePositions(prev => ({ ...prev, [nodeId]: position }));
    }, []);

    // Add History handler
    const handleAddHistory = useCallback((parentId?: string, position?: { x: number, y: number }) => {
        if (!activeTabId || !activeTab?.data) return;

        const currentData = activeTab.data.data;
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        // Default History Object
        const newHistory = {
            _id: uniqueId,
            type: 'sqlite',
            db_path: './history.db'
        };

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data, data: { ...tab.data.data } };

            // Scenario 1: Add to Pool (Global/Root) - only when explicitly requested
            const isProject = newData.type === 'project';
            const container = isProject ? newData.data.pool : newData.data;

            // If no parentId, always add as Unassigned History
            if (!parentId) {
                const currentUnassigned = newData.data.unassigned_histories || [];
                newData.data = {
                    ...newData.data,
                    unassigned_histories: [...currentUnassigned, newHistory]
                };

                const historyId = `history-unassigned-${uniqueId}`;

                // Store position if provided
                if (position) {
                    setNodePositions(prev => ({ ...prev, [historyId]: position }));
                }

                setTimeout(() => {
                    setSelectedNodeId(historyId);
                    setDetailsNodeType('history');
                    setDetailsNode({ ...newHistory, _nodeId: historyId, _originalName: 'Global History' });
                    setIsRightSidebarOpen(true);
                }, 50);

                // showNotification("Added Unassigned History");
                return { ...tab, data: newData };
            }

            // Add to Pool (when explicitly right-clicking pool and selecting "Add History")
            if (parentId === 'pool-root') {
                if (!container) {
                    showNotification("No Pool to add history to");
                    return tab;
                }

                if (container.history) {
                    showNotification("Pool already has history");
                    return tab;
                }

                if (isProject) {
                    newData.data.pool = { ...container, history: newHistory };
                } else {
                    newData.data = { ...container, history: newHistory };
                }

                // Auto-select
                const historyId = 'pool-root-history';

                // Store position if provided
                if (position) {
                    setNodePositions(prev => ({ ...prev, [historyId]: position }));
                }

                setTimeout(() => {
                    setSelectedNodeId(historyId);
                    setDetailsNodeType('history');
                    setDetailsNode({ ...newHistory, _nodeId: historyId, _originalName: 'Pool History', _parentId: 'pool-root' });
                    setIsRightSidebarOpen(true);
                }, 50);

                // showNotification("Added Pool History");
                return { ...tab, data: newData };
            }

            // Scenario 2: Add to Agent

            if (parentId.startsWith('agent-')) {
                // Find agent index
                const parts = parentId.split('-');
                const idx = parseInt(parts[1], 10);

                if (!isNaN(idx) && container && container.agents && container.agents[idx]) {
                    const agent = { ...container.agents[idx] };

                    if (agent.history) {
                        showNotification("Agent already has history");
                        return tab;
                    }

                    agent.history = newHistory;

                    const newAgents = [...container.agents];
                    newAgents[idx] = agent;

                    if (isProject) {
                        newData.data.pool = { ...container, agents: newAgents };
                    } else {
                        newData.data = { ...container, agents: newAgents };
                    }

                    // Auto-select
                    const historyId = `${parentId} -history`;

                    // Store position if provided
                    if (position) {
                        setNodePositions(prev => ({ ...prev, [historyId]: position }));
                    }

                    setTimeout(() => {
                        setSelectedNodeId(historyId);
                        setDetailsNodeType('history');
                        setDetailsNode({ ...newHistory, _nodeId: historyId, _originalName: 'Agent History', _parentId: parentId });
                        setIsRightSidebarOpen(true);
                    }, 50);

                    // showNotification("Added Agent History");
                    return { ...tab, data: newData };
                }
            }

            return tab;
        }));

    }, [activeTabId, activeTab, showNotification]);

    // Handle connecting Unassigned History to Parent (Pool or Agent)
    const handleConnectHistoryToParent = useCallback((historyId: string, parentId: string, position?: { x: number, y: number }) => {
        if (!activeTabId || !activeTab?.data) return;

        // 1. Identify History Node
        if (!historyId.startsWith('history-unassigned-')) return;

        const uniqueId = historyId.replace('history-unassigned-', '');

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data, data: { ...tab.data.data } };
            const unassigned = [...(newData.data.unassigned_histories || [])];

            const historyIndex = unassigned.findIndex((h: any) => h._id === uniqueId || `history-unassigned-${h._id || unassigned.indexOf(h)}` === historyId);
            if (historyIndex === -1) return tab;

            const historyToMove = unassigned[historyIndex];

            // 2. Identify Parent
            const isProject = newData.type === 'project';
            const container = isProject ? newData.data.pool : newData.data;

            // Scenario A: Connect to Pool
            if (parentId === 'pool-root') {
                if (isProject && !container) return tab; // Should not happen if dragging to pool

                if (container.history) {
                    showNotification("Pool already has history");
                    return tab;
                }

                // Remove from unassigned
                unassigned.splice(historyIndex, 1);
                if (unassigned.length === 0) delete newData.data.unassigned_histories;
                else newData.data.unassigned_histories = unassigned;

                // Assign to pool
                if (isProject) {
                    newData.data.pool = { ...container, history: historyToMove };
                } else {
                    newData.data = { ...container, history: historyToMove };
                }

                if (position) {
                    setNodePositions(prev => {
                        const next = { ...prev };
                        if (next[historyId]) delete next[historyId];
                        next['pool-root-history'] = position;
                        return next;
                    });
                }

                // showNotification("History connected to Pool");
                return { ...tab, data: newData };
            }

            // Scenario B: Connect to Agent
            if (parentId.startsWith('agent-')) {
                const parts = parentId.split('-');
                const agentIdx = parseInt(parts[1], 10);

                if (!isNaN(agentIdx) && container && container.agents && container.agents[agentIdx]) {
                    const agent = { ...container.agents[agentIdx] };

                    if (agent.history) {
                        showNotification("Agent already has history");
                        return tab;
                    }

                    // Remove from unassigned
                    unassigned.splice(historyIndex, 1);
                    if (unassigned.length === 0) delete newData.data.unassigned_histories;
                    else newData.data.unassigned_histories = unassigned;

                    // Assign to Agent
                    agent.history = historyToMove;
                    const newAgents = [...container.agents];
                    newAgents[agentIdx] = agent;

                    if (position) {
                        const newHistoryId = `${parentId}-history`;
                        setNodePositions(prev => {
                            const next = { ...prev };
                            if (next[historyId]) delete next[historyId];
                            next[newHistoryId] = position;
                            return next;
                        });
                    }

                    if (isProject) {
                        newData.data.pool = { ...container, agents: newAgents };
                    } else {
                        newData.data = { ...container, agents: newAgents };
                    }

                    // showNotification("History connected to Agent");
                    return { ...tab, data: newData };
                }
            }

            return tab;
        }));

    }, [activeTabId, activeTab, showNotification]);

    // Connect Router -> Pool
    const handleConnectRouterToPool = useCallback((routerId: string, poolId: string, position?: { x: number, y: number }) => {
        if (!activeTabId || !activeTab?.data || poolId !== 'pool-root') return;

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data, data: { ...tab.data.data } };
            const unassignedRouters = [...(newData.data.unassigned_routers || [])];

            const uniqueId = routerId.replace('router-unassigned-', '');
            const routerIndex = unassignedRouters.findIndex((r: any) =>
                r._id === uniqueId || `router-unassigned-${r._id || unassignedRouters.indexOf(r)}` === routerId
            );

            if (routerIndex === -1) return tab;

            const routerToMove = unassignedRouters[routerIndex];
            const isProject = newData.type === 'project';
            const container = isProject ? newData.data.pool : newData.data;

            if (!container) return tab;

            if (container.router) {
                showNotification("Pool already has a router");
                return tab;
            }

            // Remove from unassigned
            unassignedRouters.splice(routerIndex, 1);
            if (unassignedRouters.length === 0) delete newData.data.unassigned_routers;
            else newData.data.unassigned_routers = unassignedRouters;

            // Assign to pool
            if (isProject) {
                newData.data.pool = { ...container, router: routerToMove };
            } else {
                newData.data = { ...container, router: routerToMove };
            }

            if (position) {
                const newRouterId = 'router-main';
                setNodePositions(prev => {
                    const next = { ...prev };
                    if (next[routerId]) delete next[routerId];
                    next[newRouterId] = position;
                    return next;
                });
            }

            return { ...tab, data: newData };
        }));

    }, [activeTabId, activeTab, showNotification]);

    // Delete Node Handler - supports single ID or array of IDs for bulk deletion
    const handleDeleteNode = useCallback((nodeIdOrIds: string | string[]) => {
        if (!activeTabId || !activeTab?.data) return;

        const nodeIds = Array.isArray(nodeIdOrIds) ? nodeIdOrIds : [nodeIdOrIds];
        if (nodeIds.length === 0) return;

        // Save current state to history for undo
        pushToHistory(activeTabId, activeTab.data);

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            // Deep clone data to avoid mutation issues
            const newData = JSON.parse(JSON.stringify(tab.data));
            const currentData = newData.data;
            let anyNodeDeleted = false;

            const isProject = newData.type === 'project';
            const poolContainer = (isProject && currentData.pool) ? currentData.pool : (!isProject ? currentData : null);

            // Process each node ID for deletion
            for (const nodeId of nodeIds) {

                // 1. Delete Router
                if (nodeId === 'router-main') {
                    if (poolContainer?.router) {
                        delete poolContainer.router;
                        anyNodeDeleted = true;
                    }
                }
                // 2. Delete Pool Node
                else if (nodeId === 'pool-root') {
                    if (isProject && currentData.pool) {
                        // Move Agents to Unassigned
                        const strategies = currentData.pool.agents || [];
                        const currentUnassigned = currentData.unassigned_agents || [];
                        const currentUnassignedRouters = currentData.unassigned_routers || [];
                        const currentUnassignedHistories = currentData.unassigned_histories || [];

                        // 1. Preserve Agent History (don't set to null)
                        const releasedAgents = strategies.map((a: any) => ({ ...a, tools: a.tools }));

                        // 2. Handle Router
                        const router = currentData.pool.router;
                        if (router && !router._id) {
                            router._id = crypto.randomUUID();
                        }
                        const releasedRouters = router ? [router] : [];

                        // 3. Handle Pool History
                        const poolHistory = currentData.pool.history;
                        const releasedHistories = poolHistory ? [poolHistory] : [];

                        // 4. Transfer Positions
                        setNodePositions(prev => {
                            const next = { ...prev };

                            // Transfer Router Position
                            if (router) {
                                const oldRouterId = 'router-main';
                                const uniqueId = router._id;
                                const newRouterId = `router-unassigned-${uniqueId}`;
                                if (next[oldRouterId]) {
                                    next[newRouterId] = next[oldRouterId];
                                    delete next[oldRouterId];
                                }
                            }

                            // Transfer Pool History Position
                            if (poolHistory) {
                                const oldHistoryId = 'pool-root-history';
                                const uniqueId = poolHistory._id;
                                const newHistoryId = `history-unassigned-${uniqueId}`;
                                if (next[oldHistoryId]) {
                                    next[newHistoryId] = next[oldHistoryId];
                                    delete next[oldHistoryId];
                                }
                            }

                            // Transfer Agent Positions
                            strategies.forEach((agent: any, index: number) => {
                                const oldAgentId = `agent-${index}`;
                                const uniqueId = agent._id;
                                const newAgentId = `agent-unassigned-${uniqueId}`;

                                // Transfer Agent Position
                                if (next[oldAgentId]) {
                                    next[newAgentId] = next[oldAgentId];
                                    delete next[oldAgentId];
                                }

                                // Transfer Tool Positions
                                agent.tools?.forEach((_: any, tIdx: number) => {
                                    const oldToolId = `${oldAgentId}-tool-${tIdx}`;
                                    const newToolId = `${newAgentId}-tool-${tIdx}`;
                                    if (next[oldToolId]) {
                                        next[newToolId] = next[oldToolId];
                                        delete next[oldToolId];
                                    }
                                });

                                // Transfer History Position
                                if (agent.history) {
                                    const oldHistoryId = `${oldAgentId}-history`;
                                    const newHistoryId = `${newAgentId}-history`;
                                    if (next[oldHistoryId]) {
                                        next[newHistoryId] = next[oldHistoryId];
                                        delete next[oldHistoryId];
                                    }
                                }
                            });
                            return next;
                        });

                        currentData.unassigned_agents = [...currentUnassigned, ...releasedAgents];
                        if (releasedRouters.length > 0) {
                            currentData.unassigned_routers = [...currentUnassignedRouters, ...releasedRouters];
                        }
                        if (releasedHistories.length > 0) {
                            currentData.unassigned_histories = [...currentUnassignedHistories, ...releasedHistories];
                        }

                        delete currentData.pool;
                        anyNodeDeleted = true;
                    } else if (newData.type === 'pool') {
                        // Legacy Pool Root Delete -> Convert to Project
                        newData.type = 'project';
                        const unassigned = [...(currentData.unassigned_agents || []), ...(currentData.agents || [])];
                        newData.data = {
                            pool: null,
                            unassigned_agents: unassigned,
                            unassigned_tools: currentData.unassigned_tools || [],
                        };
                        anyNodeDeleted = true;
                    }
                }
                // 3. Delete Pool History
                else if (nodeId === 'pool-root-history') {
                    if (poolContainer?.history) {
                        delete poolContainer.history;
                        anyNodeDeleted = true;
                    }
                }
                // 4. Delete Unassigned Agent (by _id)
                else if (nodeId.startsWith('agent-unassigned-')) {
                    const itemId = nodeId.split('agent-unassigned-')[1];
                    if (currentData.unassigned_agents) {
                        const agentToDelete = currentData.unassigned_agents.find(
                            (a: any) => a._id === itemId || String(currentData.unassigned_agents.indexOf(a)) === itemId
                        );

                        if (agentToDelete) {
                            // 1. Move Tools to Unassigned
                            if (agentToDelete.tools) {
                                const currentUnassignedTools = currentData.unassigned_tools || [];
                                currentData.unassigned_tools = [...currentUnassignedTools, ...agentToDelete.tools];
                            }

                            // 2. Move History to Unassigned
                            if (agentToDelete.history) {
                                const currentUnassignedHistories = currentData.unassigned_histories || [];
                                currentData.unassigned_histories = [...currentUnassignedHistories, agentToDelete.history];
                            }

                            // 3. Transfer Positions
                            setNodePositions(prev => {
                                const next = { ...prev };

                                // Transfer Tool Positions
                                agentToDelete.tools?.forEach((tool: any, tIdx: number) => {
                                    // Verify old tool ID format for unassigned agents
                                    const oldToolId = `agent-unassigned-${itemId}-tool-${tIdx}`;
                                    const uniqueToolId = tool._id;
                                    const newToolId = `tool-unassigned-${uniqueToolId}`;

                                    if (next[oldToolId]) {
                                        next[newToolId] = next[oldToolId];
                                        delete next[oldToolId];
                                    }
                                });

                                // Transfer History Position
                                if (agentToDelete.history) {
                                    const oldHistoryId = `agent-unassigned-${itemId}-history`;
                                    const uniqueHistoryId = agentToDelete.history._id;
                                    const newHistoryId = `history-unassigned-${uniqueHistoryId}`;

                                    if (next[oldHistoryId]) {
                                        next[newHistoryId] = next[oldHistoryId];
                                        delete next[oldHistoryId];
                                    }
                                }
                                return next;
                            });

                            // Remove the agent
                            const originalLength = currentData.unassigned_agents.length;
                            currentData.unassigned_agents = currentData.unassigned_agents.filter((a: any) => a !== agentToDelete);
                            if (currentData.unassigned_agents.length < originalLength) {
                                anyNodeDeleted = true;
                            }
                            if (currentData.unassigned_agents.length === 0) delete currentData.unassigned_agents;
                        }
                    }
                }
                // 4.5. Delete Unassigned Router (by _id)
                else if (nodeId.startsWith('router-unassigned-')) {
                    const itemId = nodeId.split('router-unassigned-')[1];
                    if (currentData.unassigned_routers) {
                        const originalLength = currentData.unassigned_routers.length;
                        currentData.unassigned_routers = currentData.unassigned_routers.filter(
                            (r: any) => r._id !== itemId && String(currentData.unassigned_routers.indexOf(r)) !== itemId
                        );
                        if (currentData.unassigned_routers.length < originalLength) {
                            anyNodeDeleted = true;
                        }
                        if (currentData.unassigned_routers.length === 0) delete currentData.unassigned_routers;
                    }
                }
                // 5. Delete Unassigned Tool (by _id)
                else if (nodeId.startsWith('tool-unassigned-')) {
                    const itemId = nodeId.split('tool-unassigned-')[1];
                    if (currentData.unassigned_tools) {
                        const originalLength = currentData.unassigned_tools.length;
                        currentData.unassigned_tools = currentData.unassigned_tools.filter(
                            (t: any) => t._id !== itemId && String(currentData.unassigned_tools.indexOf(t)) !== itemId
                        );
                        if (currentData.unassigned_tools.length < originalLength) {
                            anyNodeDeleted = true;
                        }
                        if (currentData.unassigned_tools.length === 0) delete currentData.unassigned_tools;
                    }
                }
                // 6. Delete Assigned Agent
                else if (nodeId.startsWith('agent-') && !nodeId.includes('tool') && !nodeId.includes('history')) {
                    const idx = parseInt(nodeId.split('agent-')[1], 10);
                    // Use poolContainer
                    if (!isNaN(idx) && poolContainer?.agents && poolContainer.agents[idx]) {
                        const agent = poolContainer.agents[idx];

                        // Move Tools to Unassigned
                        if (agent.tools) {
                            const currentUnassignedTools = currentData.unassigned_tools || [];
                            currentData.unassigned_tools = [...currentUnassignedTools, ...agent.tools];
                        }

                        // Move History to Unassigned
                        if (agent.history) {
                            const currentUnassignedHistories = currentData.unassigned_histories || [];
                            currentData.unassigned_histories = [...currentUnassignedHistories, agent.history];
                        }

                        // Transfer Positions
                        setNodePositions(prev => {
                            const next = { ...prev };
                            const oldAgentId = `agent-${idx}`;
                            const uniqueId = agent._id;
                            // Agent itself is deleted, so no position transfer for agent
                            // But transfer Tool positions
                            agent.tools?.forEach((_: any, tIdx: number) => {
                                const oldToolId = `${oldAgentId}-tool-${tIdx}`;
                                // Note: agent.tools are objects, they need _id for new ID
                                // Wait, tools use index in unassigned list for ID?
                                // Let's check handleAddTool unassigned logic: tool-unassigned-{_id}
                                // Yes, using _id.
                            });

                            // Re-loop to handle proper tools transfer
                            agent.tools?.forEach((tool: any, tIdx: number) => {
                                const oldToolId = `${oldAgentId}-tool-${tIdx}`;
                                const uniqueToolId = tool._id;
                                const newToolId = `tool-unassigned-${uniqueToolId}`;
                                if (next[oldToolId]) {
                                    next[newToolId] = next[oldToolId];
                                    delete next[oldToolId];
                                }
                            });

                            // Transfer History Position
                            if (agent.history) {
                                const oldHistoryId = `${oldAgentId}-history`;
                                const uniqueHistoryId = agent.history._id;
                                const newHistoryId = `history-unassigned-${uniqueHistoryId}`;
                                if (next[oldHistoryId]) {
                                    next[newHistoryId] = next[oldHistoryId];
                                    delete next[oldHistoryId];
                                }
                            }

                            return next;
                        });

                        poolContainer.agents.splice(idx, 1);
                        if (poolContainer.agents.length === 0) delete poolContainer.agents;
                        anyNodeDeleted = true;
                    }
                }
                // 7. Delete Assigned Tool (agent-X-tool-Y)
                else if (nodeId.includes('-tool-')) {
                    const parts = nodeId.split('-tool-');
                    const agentId = parts[0];
                    const toolIdx = parseInt(parts[1], 10);
                    const agentIdx = parseInt(agentId.split('agent-')[1], 10);

                    if (!isNaN(agentIdx) && !isNaN(toolIdx) && poolContainer?.agents && poolContainer.agents[agentIdx]) {
                        const agent = poolContainer.agents[agentIdx];
                        if (agent.tools && agent.tools[toolIdx]) {
                            agent.tools.splice(toolIdx, 1);
                            if (agent.tools.length === 0) delete agent.tools;
                            anyNodeDeleted = true;
                        }
                    }
                }
                // 8. Delete Unassigned History (by _id)
                else if (nodeId.startsWith('history-unassigned-')) {
                    const itemId = nodeId.split('history-unassigned-')[1];
                    if (currentData.unassigned_histories) {
                        const originalLength = currentData.unassigned_histories.length;
                        currentData.unassigned_histories = currentData.unassigned_histories.filter(
                            (h: any) => h._id !== itemId && String(currentData.unassigned_histories.indexOf(h)) !== itemId
                        );
                        if (currentData.unassigned_histories.length < originalLength) {
                            anyNodeDeleted = true;
                        }
                        if (currentData.unassigned_histories.length === 0) delete currentData.unassigned_histories;
                    }
                }
                // 9. Delete Agent History (agent-X-history)
                else if (nodeId.includes('-history')) {
                    const agentId = nodeId.split('-history')[0];
                    const agentIdx = parseInt(agentId.split('agent-')[1], 10);
                    if (!isNaN(agentIdx) && poolContainer?.agents && poolContainer.agents[agentIdx]) {
                        const agent = poolContainer.agents[agentIdx];
                        if (agent.history) {
                            delete agent.history;
                            anyNodeDeleted = true;
                        }
                    }
                }
            } // End of for loop

            if (anyNodeDeleted) {
                // showNotification(nodeIds.length > 1 ? `Deleted ${nodeIds.length} nodes` : "Node deleted");

                // Smart Selection Fallback - if selected node was among those deleted
                if (selectedNodeId && nodeIds.includes(selectedNodeId)) {
                    let fallbackId = null;
                    let fallbackType = null;
                    let fallbackNode = null;

                    const newIsProject = newData.type === 'project';
                    const fallbackContainer = (newIsProject && newData.data.pool) ? newData.data.pool : (!newIsProject ? newData.data : null);

                    if (fallbackContainer) {
                        // 1. Try Sibling Agent (Assigned)
                        if (fallbackContainer.agents && fallbackContainer.agents.length > 0) {
                            fallbackId = 'agent-0';
                            fallbackType = 'agent';
                            fallbackNode = fallbackContainer.agents[0];
                        }
                        // 2. Try Pool Root (if not deleted)
                        else if (!nodeIds.includes('pool-root')) {
                            fallbackId = 'pool-root';
                            fallbackType = 'pool';
                            fallbackNode = fallbackContainer;
                        }
                        // 3. Try Router
                        else if (fallbackContainer.router) {
                            fallbackId = 'router-main';
                            fallbackType = 'router';
                            fallbackNode = fallbackContainer.router;
                        }
                    }

                    // 4. Try Unassigned Agent (if nothing found yet)
                    if (!fallbackId && newData.data.unassigned_agents && newData.data.unassigned_agents.length > 0) {
                        const firstAgent = newData.data.unassigned_agents[0];
                        fallbackId = `agent - unassigned - ${firstAgent._id || 0} `;
                        fallbackType = 'agent';
                        fallbackNode = firstAgent;
                    }

                    if (fallbackId && fallbackNode) {
                        setSelectedNodeId(fallbackId);
                        setDetailsNodeType(fallbackType as any);
                        const originalName = fallbackNode.name || (fallbackType === 'pool' ? 'Agent Pool' : 'Unknown');
                        setDetailsNode({ ...fallbackNode, _nodeId: fallbackId, _originalName: originalName });
                        setIsRightSidebarOpen(true);
                    } else {
                        setSelectedNodeId(null);
                        setDetailsNode(null);
                        setDetailsNodeType(null);
                        // Keep sidebar open to show empty state
                    }
                }

                return { ...tab, data: newData };
            }

            return tab;
        }));
    }, [activeTabId, activeTab, selectedNodeId, showNotification]);


    // Auto-select default node if sidebar is open, nothing is selected, but nodes exist
    useEffect(() => {
        if (isRightSidebarOpen && !detailsNode && activeTab?.data) {
            const currentData = activeTab.data;
            const isProject = currentData.type === 'project';
            const poolContainer = (isProject && currentData.data?.pool) ? currentData.data.pool : (!isProject ? currentData : null);
            const projectData = isProject ? currentData.data : null;

            let fallbackId = null;
            let fallbackType = null;
            let fallbackNode = null;

            if (poolContainer) {
                // 1. Try Agent (Assigned)
                if (poolContainer.agents && poolContainer.agents.length > 0) {
                    fallbackId = 'agent-0';
                    fallbackType = 'agent';
                    fallbackNode = poolContainer.agents[0];
                }
                // 2. Try Pool Root
                else {
                    fallbackId = 'pool-root';
                    fallbackType = 'pool';
                    fallbackNode = poolContainer;
                }
                // 3. Try Router
                if (!fallbackId && poolContainer.router) {
                    fallbackId = 'router-main';
                    fallbackType = 'router';
                    fallbackNode = poolContainer.router;
                }
            }

            // 4. Try Unassigned Agent
            if (!fallbackId && projectData && projectData.unassigned_agents && projectData.unassigned_agents.length > 0) {
                fallbackId = 'agent-unassigned-0';
                fallbackType = 'agent';
                fallbackNode = projectData.unassigned_agents[0];
            }

            // 5. Try Unassigned Tool (optional)
            if (!fallbackId && projectData && projectData.unassigned_tools && projectData.unassigned_tools.length > 0) {
                fallbackId = 'tool-unassigned-0';
                fallbackType = 'tool';
                fallbackNode = projectData.unassigned_tools[0];
            }

            // 6. Try Unassigned History
            if (!fallbackId && projectData && projectData.unassigned_histories && projectData.unassigned_histories.length > 0) {
                fallbackId = 'history-unassigned-0';
                fallbackType = 'history';
                fallbackNode = projectData.unassigned_histories[0];
            }

            // If found, select it
            if (fallbackId && fallbackNode) {
                setSelectedNodeId(fallbackId);
                setDetailsNodeType(fallbackType as any);
                const originalName = fallbackNode.name || (fallbackType === 'pool' ? 'Agent Pool' : 'Unknown');
                setDetailsNode({ ...fallbackNode, _nodeId: fallbackId, _originalName: originalName });
            }
        }
    }, [isRightSidebarOpen, detailsNode, activeTab]);

    // Effects
    const settingsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(target) &&
                mobileDownloadMenuRef.current && !mobileDownloadMenuRef.current.contains(target)) {
                setIsDownloadOpen(false);
            }
            if (settingsRef.current && !settingsRef.current.contains(target)) {
                setIsSettingsOpen(false);
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

    // Helper to find node data by ID
    const findNodeData = useCallback((id: string, data: any) => {
        if (!data) return null;

        const isProject = data.type === 'project';
        const projectData = isProject ? data.data : null;
        const poolData = isProject ? projectData.pool : (data.type === 'pool' ? data.data : null);

        // 1. Pool & Children
        if (poolData) {
            if (id === 'pool-root') return { node: poolData, type: 'pool' };
            if (id === 'router-main' && poolData.router) return { node: poolData.router, type: 'router' };
            if (id === 'pool-root-history' && poolData.history) return { node: poolData.history, type: 'history' };

            // Agents
            if (id.startsWith('agent-') && !id.includes('unassigned')) {
                const parts = id.split('-');
                const agentIdx = parseInt(parts[1], 10);

                if (!isNaN(agentIdx) && poolData.agents && poolData.agents[agentIdx]) {
                    const agent = poolData.agents[agentIdx];

                    // Direct Agent
                    if (parts.length === 2) return { node: agent, type: 'agent' };

                    // Agent Tool
                    if (id.includes('-tool-')) {
                        const toolIdx = parseInt(parts[3], 10);
                        if (!isNaN(toolIdx) && agent.tools && agent.tools[toolIdx]) {
                            return { node: agent.tools[toolIdx], type: 'tool' };
                        }
                    }

                    // Agent History
                    if (id.endsWith('-history') && agent.history) {
                        return { node: agent.history, type: 'history' };
                    }
                }
            }
        }

        // 2. Unassigned Items (Project Level)
        const container = projectData || data.data; // handling project vs direct data structure if needed

        if (container) {
            // Unassigned Agents
            if (id.startsWith('agent-unassigned-')) {
                const suffix = id.replace('agent-unassigned-', ''); // id or index

                // Agents list
                const agents = container.unassigned_agents || [];
                // Try finding by ID first, then by index
                let agent = agents.find((a: any) => a._id === suffix);
                if (!agent && !isNaN(parseInt(suffix))) agent = agents[parseInt(suffix)];

                if (agent) {
                    if (!id.includes('-tool-') && !id.includes('-history')) {
                        return { node: agent, type: 'agent' };
                    }

                    // Unassigned Agent Tool
                    if (id.includes('-tool-')) {
                        const toolIdx = parseInt(id.split('-tool-')[1], 10);
                        if (!isNaN(toolIdx) && agent.tools && agent.tools[toolIdx]) {
                            return { node: agent.tools[toolIdx], type: 'tool' };
                        }
                    }

                    // Unassigned Agent History
                    if (id.endsWith('-history') && agent.history) {
                        return { node: agent.history, type: 'history' };
                    }
                }
            }

            // Unassigned Tools
            if (id.startsWith('tool-unassigned-')) {
                const suffix = id.replace('tool-unassigned-', '');
                const tools = container.unassigned_tools || [];
                let tool = tools.find((t: any) => t._id === suffix);
                if (!tool && !isNaN(parseInt(suffix))) tool = tools[parseInt(suffix)];
                if (tool) return { node: tool, type: 'tool' };
            }

            // Unassigned Routers
            if (id.startsWith('router-unassigned-')) {
                const suffix = id.replace('router-unassigned-', '');
                const routers = container.unassigned_routers || [];
                let router = routers.find((r: any) => r._id === suffix);
                if (!router && !isNaN(parseInt(suffix))) router = routers[parseInt(suffix)];
                if (router) return { node: router, type: 'router' };
            }

            // Unassigned Histories
            if (id.startsWith('history-unassigned-')) {
                const suffix = id.replace('history-unassigned-', '');
                const histories = container.unassigned_histories || [];
                let history = histories.find((h: any) => h._id === suffix);
                if (!history && !isNaN(parseInt(suffix))) history = histories[parseInt(suffix)];
                if (history) return { node: history, type: 'history' };
            }
        }

        return null;
    }, []);

    const handleSidebarSelect = useCallback((id: string) => {
        setSelectedNodeId(id);

        const found = findNodeData(id, activeTab?.data);
        if (found) {
            setDetailsNode({ ...found.node, _nodeId: id, _originalName: found.node.name || (found.type === 'pool' ? 'Agent Pool' : 'Unknown') });
            setDetailsNodeType(found.type as any);
            setIsRightSidebarOpen(true);
        }

        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    }, [activeTab, findNodeData]);

    return (
        <div
            className="h-screen w-full bg-background text-foreground flex overflow-hidden relative"
            onDragOver={(e) => {
                e.preventDefault();
                // Only enable drag overlay if NO project is active (welcome or empty tab)
                if (!activeTab?.data) {
                    setIsDragging(true);
                }
            }}
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
                            className="fixed inset-0 backdrop-blur-[4px] z-[100] md:hidden"
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 right-0 z-[100] h-full w-[85vw] max-w-[350px] shadow-2xl md:hidden"
                        >
                            <AtlasSidebar
                                data={activeTab?.data || null}
                                selectedId={selectedNodeId}
                                className="border-l border-r-0 h-full w-full bg-background/95 backdrop-blur-[0px]"

                                onClose={() => setIsSidebarOpen(false)}
                                onSelect={handleSidebarSelect}
                                isMobile={true}
                                onSave={handleSave}
                                onDownload={handleDownloadPear}
                                onDownloadImage={handleDownloadImage}
                                onDownloadPython={handleDownloadPython}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 relative h-full flex flex-col min-w-0">
                <Toast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />



                {/* Top Bar */}
                <div className="border-b border-white/10 bg-card/40 backdrop-blur-xl flex flex-col md:flex-row items-center px-0 md:px-4 gap-0 md:gap-2 z-40 shrink-0 md:h-[60px] transition-all shadow-sm">
                    {/* Mobile Header */}
                    <div className="flex items-center justify-between w-full md:hidden px-4 py-3 border-b border-white/5">
                        {/* Left: Actions */}

                        <div>
                            <span className="font-semibold text-foreground leading-none" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontSize: '2.1rem' }}>
                                peargent.
                            </span>
                            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium pl-0.5">Atlas</span>
                        </div>
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 -mr-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                        >
                            <PanelLeft className="w-5 h-5" />
                        </button>
                    </div>

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
                    {/* Mobile Sidebar Backdrop */}
                    {isSidebarOpen && (
                        <div
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 md:hidden"
                            onClick={() => setIsSidebarOpen(false)}
                        />
                    )}

                    {/* Left Sidebar */}
                    {/* Left Sidebar (Desktop Only) */}
                    <div className={cn(
                        "hidden md:flex z-30 h-full flex-col transition-all duration-300 ease-in-out border-r border-border bg-background",
                    )}>
                        <AtlasSidebar
                            data={activeTab?.data}
                            selectedId={selectedNodeId}
                            onSelect={handleSidebarSelect}
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
                            onAddPool={handleAddPool}
                            onDeleteNode={handleDeleteNode}
                            onConnectHistoryToParent={handleConnectHistoryToParent}
                            onConnectRouterToPool={handleConnectRouterToPool}
                            nodePositions={nodePositions}
                            onNodePositionChange={handleNodePositionChange}
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

                        {/* Undo/Redo Buttons */}
                        <div className="absolute top-4 left-16 z-40 hidden md:flex items-center gap-1">
                            <button
                                onClick={handleUndo}
                                className="p-2 rounded-lg bg-card/80 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground shadow-lg transition-all hover:bg-white/5"
                                title="Undo (Ctrl+Z)"
                            >
                                <Undo2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleRedo}
                                className="p-2 rounded-lg bg-card/80 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground shadow-lg transition-all hover:bg-white/5"
                                title="Redo (Ctrl+Shift+Z)"
                            >
                                <Redo2 className="w-4 h-4" />
                            </button>
                        </div>


                        {/* Settings Dropdown */}
                        <div className="absolute top-4 right-16 z-40 hidden md:block" ref={settingsRef}>
                            <div className="relative">
                                <button
                                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                    className={cn(
                                        "p-2 rounded-lg bg-card/80 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground shadow-lg transition-all hover:bg-white/5",
                                        isSettingsOpen && "bg-white/10 text-foreground"
                                    )}
                                    title="Settings"
                                >
                                    <Settings className="w-5 h-5" />
                                </button>

                                <AnimatePresence>
                                    {isSettingsOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                            className="absolute top-full right-0 mt-2 w-56 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl flex flex-col p-1.5 z-50 origin-top-right"
                                        >
                                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                Global Settings
                                            </div>

                                            <button
                                                onClick={() => {
                                                    if (!activeTabId) return;
                                                    setTabs(prev => prev.map(tab => {
                                                        if (tab.id !== activeTabId) return tab;
                                                        const currentSettings = tab.data.settings || {};
                                                        const newTracing = currentSettings.tracing === false ? true : false; // Default to true if undefined? Or toggle. Let's assume undefined = true.
                                                        // Actually, better explicitly set.
                                                        // If undefined, it acts as true. Toggle makes it false.
                                                        // If false, toggle makes it true.
                                                        const isCurrentlyEnabled = currentSettings.tracing !== false;

                                                        return {
                                                            ...tab,
                                                            data: {
                                                                ...tab.data,
                                                                settings: {
                                                                    ...currentSettings,
                                                                    tracing: !isCurrentlyEnabled
                                                                }
                                                            }
                                                        };
                                                    }));
                                                }}
                                                className="flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg text-sm transition-colors group"
                                            >
                                                <span className="text-foreground group-hover:text-foreground/90">Tracing Enabled</span>
                                                <div className={cn(
                                                    "w-9 h-5 rounded-full relative transition-colors duration-200",
                                                    (activeTab?.data?.settings?.tracing !== false) ? "bg-primary" : "bg-muted"
                                                )}>
                                                    <div className={cn(
                                                        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                                                        (activeTab?.data?.settings?.tracing !== false) ? "left-[18px]" : "left-0.5"
                                                    )} />
                                                </div>
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
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

                        {/* Undo/Redo Buttons - Mobile: Top-Left Canvas, Desktop: Hidden (handled in sidebar toggle area) */}
                        <div className="absolute top-4 left-4 z-40 flex md:hidden items-center gap-1">
                            <button
                                onClick={handleUndo}
                                className="p-2 rounded-lg bg-card/80 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground shadow-lg transition-all hover:bg-white/5"
                                title="Undo"
                            >
                                <Undo2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleRedo}
                                className="p-2 rounded-lg bg-card/80 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground shadow-lg transition-all hover:bg-white/5"
                                title="Redo"
                            >
                                <Redo2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Desktop Floating Bottom Right Add Buttons */}
                        {activeTab?.data && (
                            <motion.div
                                layout
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                className={cn(
                                    "hidden md:flex absolute right-6 z-40 items-center rounded-2xl bg-card/90 backdrop-blur-xl border border-border/50 shadow-lg",
                                    "bottom-6",
                                    isAddToolbarCollapsed ? "p-2 gap-3" : "p-1.5 gap-2"
                                )}
                            >
                                {/* Toggle Button */}
                                <motion.button
                                    layout="position"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    onClick={() => setIsAddToolbarCollapsed(!isAddToolbarCollapsed)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {isAddToolbarCollapsed ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                                </motion.button>

                                {/* Divider */}
                                <motion.div layout="position" transition={{ type: "spring", stiffness: 400, damping: 30 }} className="w-px h-6 bg-white/10" />

                                <AnimatePresence mode="popLayout" initial={false}>
                                    {isAddToolbarCollapsed ? (
                                        <motion.div
                                            key="collapsed"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            transition={{ duration: 0.15, type: 'spring', stiffness: 500, damping: 25 }}
                                            className="flex items-center gap-2 pr-1"
                                        >
                                            {/* Condensed Indicators */}
                                            <div className="w-2 h-7 rounded-full border border-emerald-500/50 bg-emerald-500/20" title="Pool" />
                                            <div className="w-2 h-7 rounded-full border border-blue-500/50 bg-blue-500/20" title="Agent" />
                                            <div className="w-2 h-7 rounded-full border border-amber-500/50 bg-amber-500/20" title="Tool" />
                                            <div className="w-2 h-7 rounded-full border border-purple-500/50 bg-purple-500/20" title="Router" />
                                            <div className="w-2 h-7 rounded-full border border-pink-500/50 bg-pink-500/20" title="History" />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="expanded"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            transition={{ duration: 0.15, type: 'spring', stiffness: 500, damping: 25 }}
                                            className="flex items-center gap-2"
                                        >
                                            {/* Add Pool */}
                                            <button
                                                onClick={() => handleAddPool()}
                                                disabled={activeTab?.data?.type === 'pool' || (activeTab?.data?.type === 'project' && !!activeTab?.data?.data?.pool)}
                                                className={cn(
                                                    "relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
                                                    (activeTab?.data?.type === 'pool' || (activeTab?.data?.type === 'project' && !!activeTab?.data?.data?.pool))
                                                        ? "bg-secondary/50 border-transparent text-muted-foreground cursor-not-allowed opacity-50"
                                                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/40"
                                                )}
                                                title="Add Pool"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <Layers className="w-4 h-4" />
                                                <span className="text-xs font-medium">Pool</span>
                                            </button>

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
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {/* Mobile Add FAB & Menu */}
                        {activeTab?.data && (
                            <div className={cn(
                                "md:hidden absolute right-6 z-40 flex flex-col items-end gap-4 pointer-events-none transition-all duration-300",
                                detailsNode ? "bottom-20" : "bottom-6"
                            )}>
                                <AnimatePresence>
                                    {isMobileAddMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                            className="flex flex-col items-end gap-3 pointer-events-auto"
                                        >
                                            {/* History */}
                                            <button
                                                onClick={() => { handleAddHistory(); setIsMobileAddMenuOpen(false); }}
                                                className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card border border-pink-500/20 text-pink-400 shadow-lg shadow-black/5"
                                            >
                                                <span className="text-sm font-medium">History</span>
                                                <History className="w-4 h-4" />
                                            </button>

                                            {/* Router */}
                                            <button
                                                onClick={() => { handleAddRouter(); setIsMobileAddMenuOpen(false); }}
                                                className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card border border-purple-500/20 text-purple-400 shadow-lg shadow-black/5"
                                            >
                                                <span className="text-sm font-medium">Router</span>
                                                <Network className="w-4 h-4" />
                                            </button>

                                            {/* Tool */}
                                            <button
                                                onClick={() => { handleAddTool(); setIsMobileAddMenuOpen(false); }}
                                                className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card border border-amber-500/20 text-amber-400 shadow-lg shadow-black/5"
                                            >
                                                <span className="text-sm font-medium">Tool</span>
                                                <Wrench className="w-4 h-4" />
                                            </button>

                                            {/* Agent */}
                                            <button
                                                onClick={() => { handleAddAgent(); setIsMobileAddMenuOpen(false); }}
                                                className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card border border-blue-500/20 text-blue-400 shadow-lg shadow-black/5"
                                            >
                                                <span className="text-sm font-medium">Agent</span>
                                                <Bot className="w-4 h-4" />
                                            </button>

                                            {/* Pool */}
                                            <button
                                                onClick={() => { handleAddPool(); setIsMobileAddMenuOpen(false); }}
                                                disabled={activeTab?.data?.type === 'pool' || (activeTab?.data?.type === 'project' && !!activeTab?.data?.data?.pool)}
                                                className={cn(
                                                    "flex items-center gap-3 px-4 py-2.5 rounded-full shadow-lg transition-all",
                                                    (activeTab?.data?.type === 'pool' || (activeTab?.data?.type === 'project' && !!activeTab?.data?.data?.pool))
                                                        ? "bg-secondary text-muted-foreground opacity-50"
                                                        : "bg-card border border-emerald-500/20 text-emerald-400 shadow-black/5"
                                                )}
                                            >
                                                <span className="text-sm font-medium">Pool</span>
                                                <Layers className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* FAB */}
                                <button
                                    onClick={() => setIsMobileAddMenuOpen(!isMobileAddMenuOpen)}
                                    className={cn(
                                        "w-12 h-12 rounded-full bg-card/90 backdrop-blur-md border border-white/10 text-foreground shadow-xl flex items-center justify-center pointer-events-auto transition-transform active:scale-95",
                                        isMobileAddMenuOpen && "bg-secondary text-foreground"
                                    )}
                                >
                                    <Plus className={cn("w-6 h-6 transition-transform duration-300", isMobileAddMenuOpen && "rotate-[135deg]")} />
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
                                            <h2 className="text-4xl font-bold mb-4">
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
                        {isRightSidebarOpen && (
                            <NodeDetailsSidebar
                                node={detailsNode}
                                nodeType={detailsNodeType}
                                className="hidden md:block absolute right-0 top-0 h-full z-30 border-l border-border/50 md:static md:shrink-0"
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

                    {/* Mobile Bottom Sheet for Details */}
                    <MobileBottomSheet
                        isOpen={!!detailsNode && window.innerWidth < 768}
                        onClose={() => {
                            setDetailsNode(null);
                            setDetailsNodeType(null);
                        }}
                        title={detailsNode?.name || 'Node Details'}
                        nodeColor={
                            detailsNodeType === 'pool' ? 'bg-emerald-500' :
                                detailsNodeType === 'agent' ? 'bg-blue-500' :
                                    detailsNodeType === 'tool' ? 'bg-amber-500' :
                                        detailsNodeType === 'router' ? 'bg-purple-500' :
                                            detailsNodeType === 'history' ? 'bg-pink-500' :
                                                'bg-primary'
                        }
                    >
                        {!!detailsNode && (
                            <NodeDetailsSidebar
                                node={detailsNode}
                                nodeType={detailsNodeType}
                                className="w-full h-full border-none shadow-none bg-transparent"
                                onClose={() => {
                                    setDetailsNode(null);
                                    setDetailsNodeType(null);
                                }}
                                onUpdate={handleNodeUpdate}
                                onWidthChange={() => { }}
                                onToggle={() => { }}
                                isMobile={true}
                            />
                        )}
                    </MobileBottomSheet>
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
        </div >
    );
}
