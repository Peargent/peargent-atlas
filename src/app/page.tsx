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
import { Upload, X, Plus, Save, Download, FileJson, ImageIcon, PanelLeft, PanelLeftClose, FileCode, PanelRight, PanelRightClose, Sparkles, FolderOpen, Bot, Network, History, Wrench, Layers, Redo2, Undo2, Menu, ArrowLeft, ArrowRight, Settings, Check, ChevronDown, Github, Database } from "lucide-react";
import MobileBottomSheet from '@/components/atlas/MobileBottomSheet';
import { createTutorialData, tutorialViewport } from '@/components/atlas/Tutorial';
import { WelcomeScreen } from '@/components/atlas/WelcomeScreen';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';


// Types
interface AtlasTab {
    id: string;
    name: string;
    data: any;
    layout?: {
        nodes: ReactFlowNode[];
        edges: Edge[];
    };
    selectedNodeId?: string | null;
    isTutorial?: boolean;
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
const PROJECTS_STORAGE_KEY = 'peargent_atlas_projects';

// Helper to generate router auto-fill values based on connected agents
const generateRouterAutoFill = (agents: any[]) => {
    if (!agents || agents.length === 0) {
        return {
            name: 'Router',
            description: 'Routes requests to the appropriate agent.',
            persona: 'You are a routing agent that directs requests to the appropriate specialist agent.'
        };
    }

    const agentNames = agents.map((a: any) => a.name || 'Agent').filter(Boolean);
    const agentDescriptions = agents.map((a: any) => a.description || a.persona || '').filter(Boolean);

    // Keep name as 'Router' (not auto-generated)

    // Generate description based on agent count and names
    const description = agentNames.length === 1
        ? `Routes requests to ${agentNames[0]}.`
        : agentNames.length <= 3
            ? `Routes requests between ${agentNames.join(', ')}.`
            : `Routes requests between ${agents.length} agents: ${agentNames.slice(0, 3).join(', ')}${agentNames.length > 3 ? `, and ${agentNames.length - 3} more` : ''}.`;

    // Generate persona based on agent capabilities
    const agentCapabilities = agentDescriptions.length > 0
        ? `The available agents are:\n${agents.map((a: any, i: number) => `- ${a.name || `Agent ${i + 1}`}: ${a.description || a.persona || 'No description'}`).join('\n')}`
        : agentNames.map((n: string) => n).join(', ');

    const persona = `You are an intelligent routing agent responsible for directing user requests to the most appropriate specialist agent.

${agentCapabilities}

Analyze each incoming request and determine which agent is best suited to handle it based on their specialization. Always route to the most relevant agent.`;

    return { name: 'Router', description, persona };
};

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
    const [savedProjects, setSavedProjects] = useState<AtlasTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Desktop sidebar (collapsed by default for welcome screen)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [detailsNode, setDetailsNode] = useState<any>(null);
    const [detailsNodeType, setDetailsNodeType] = useState<'agent' | 'router' | 'tool' | 'pool' | 'history' | null>(null);
    const [starCount, setStarCount] = useState<number | null>(null);

    // Fetch GitHub stars
    useEffect(() => {
        fetch('https://api.github.com/repos/Peargent/peargent')
            .then(res => res.json())
            .then(data => {
                if (data.stargazers_count) {
                    setStarCount(data.stargazers_count);
                }
            })
            .catch(err => console.error("Failed to fetch Github stars:", err));
    }, []);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [isAddToolbarCollapsed, setIsAddToolbarCollapsed] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
    const [rightSidebarWidth, setRightSidebarWidth] = useState(400);
    const [nodePositions, setNodePositions] = useState<Record<string, { x: number, y: number }>>({});
    const [isMobileAddMenuOpen, setIsMobileAddMenuOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
    // Now stores both data AND node positions to preserve visual layout
    const pushToHistory = useCallback((tabId: string, data: any, manualPositions?: Record<string, { x: number, y: number }>) => {
        if (!tabId || !data) return;

        // Get the current tab to extract positions from layout nodes
        const currentTab = tabs.find(t => t.id === tabId);

        // Build complete positions map from layout nodes
        const allPositions: Record<string, { x: number, y: number }> = {};
        if (currentTab?.layout?.nodes) {
            currentTab.layout.nodes.forEach(node => {
                if (node.position) {
                    allPositions[node.id] = { x: node.position.x, y: node.position.y };
                }
            });
        }

        // Merge with any manual position overrides
        if (manualPositions) {
            Object.assign(allPositions, manualPositions);
        }

        const history = historyRef.current[tabId] || [];
        const snapshot = {
            data: JSON.parse(JSON.stringify(data)),
            positions: JSON.parse(JSON.stringify(allPositions))
        };
        history.push(snapshot);

        // Limit history size
        if (history.length > MAX_HISTORY) {
            history.shift();
        }

        historyRef.current[tabId] = history;
        // Clear future on new action
        futureRef.current[tabId] = [];
    }, [tabs]);

    // Draggable Tabs Logic
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const [isDraggingTabs, setIsDraggingTabs] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleTabsMouseDown = (e: React.MouseEvent) => {
        if (!tabsContainerRef.current) return;
        setIsDraggingTabs(true);
        setStartX(e.pageX - tabsContainerRef.current.offsetLeft);
        setScrollLeft(tabsContainerRef.current.scrollLeft);
    };

    const handleTabsMouseLeave = () => {
        setIsDraggingTabs(false);
    };

    const handleTabsMouseUp = () => {
        setIsDraggingTabs(false);
    };

    const handleTabsMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingTabs || !tabsContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - tabsContainerRef.current.offsetLeft;
        const walk = (x - startX) * 2; // scroll-fast
        tabsContainerRef.current.scrollLeft = scrollLeft - walk;
    };

    // Clear node positions when tab changes to prevent cross-tab pollution (since we only use it for handovers)
    useEffect(() => {
        setNodePositions({});
    }, [activeTabId]);

    // Undo handler - now restores both data AND positions
    const handleUndo = useCallback(() => {
        if (!activeTabId) return;

        const history = historyRef.current[activeTabId] || [];
        if (history.length === 0) {
            // showNotification("Nothing to undo");
            return;
        }

        const previousSnapshot = history.pop();
        historyRef.current[activeTabId] = history;

        // Handle both old format (just data) and new format (data + positions)
        const previousData = previousSnapshot?.data ?? previousSnapshot;
        const previousPositions = previousSnapshot?.positions ?? {};

        // Save current state to future for redo
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab?.data) {
            // Build complete positions map from current layout nodes
            const currentPositions: Record<string, { x: number, y: number }> = {};
            if (currentTab.layout?.nodes) {
                currentTab.layout.nodes.forEach(node => {
                    if (node.position) {
                        currentPositions[node.id] = { x: node.position.x, y: node.position.y };
                    }
                });
            }
            // Merge with manual positions
            Object.assign(currentPositions, nodePositions);

            const future = futureRef.current[activeTabId] || [];
            future.push({
                data: JSON.parse(JSON.stringify(currentTab.data)),
                positions: JSON.parse(JSON.stringify(currentPositions))
            });
            futureRef.current[activeTabId] = future;
        }

        // Restore previous state (data)
        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;
            return { ...tab, data: previousData };
        }));

        // Restore previous positions
        setNodePositions(previousPositions);

        // showNotification("Undo");
    }, [activeTabId, tabs, nodePositions]);

    // Redo handler - now restores both data AND positions
    const handleRedo = useCallback(() => {
        if (!activeTabId) return;

        const future = futureRef.current[activeTabId] || [];
        if (future.length === 0) {
            // showNotification("Nothing to redo");
            return;
        }

        const nextSnapshot = future.pop();
        futureRef.current[activeTabId] = future;

        // Handle both old format (just data) and new format (data + positions)
        const nextData = nextSnapshot?.data ?? nextSnapshot;
        const nextPositions = nextSnapshot?.positions ?? {};

        // Save current state to history
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab?.data) {
            // Build complete positions map from current layout nodes
            const currentPositions: Record<string, { x: number, y: number }> = {};
            if (currentTab.layout?.nodes) {
                currentTab.layout.nodes.forEach(node => {
                    if (node.position) {
                        currentPositions[node.id] = { x: node.position.x, y: node.position.y };
                    }
                });
            }
            // Merge with manual positions
            Object.assign(currentPositions, nodePositions);

            const history = historyRef.current[activeTabId] || [];
            history.push({
                data: JSON.parse(JSON.stringify(currentTab.data)),
                positions: JSON.parse(JSON.stringify(currentPositions))
            });
            historyRef.current[activeTabId] = history;
        }

        // Restore next state (data)
        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;
            return { ...tab, data: nextData };
        }));

        // Restore next positions
        setNodePositions(nextPositions);

        // showNotification("Redo");
    }, [activeTabId, tabs, nodePositions]);

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

    // Auto-save: Debounce saves to localStorage whenever tabs change
    const isInitialLoad = useRef(true);
    const lastSavedJson = useRef<string>('');

    useEffect(() => {
        // Skip auto-save on initial load (we load from localStorage, so no need to save immediately)
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            // Initialize lastSavedJson with current state
            const tabsToSave = tabs.filter(tab => tab.data !== null);
            lastSavedJson.current = JSON.stringify(tabsToSave);
            return;
        }

        // Filter out empty/new tabs (those with no data)
        const tabsToSave = tabs.filter(tab => tab.data !== null);
        const currentJson = JSON.stringify(tabsToSave);

        // Only trigger unsaved state if content actually changed
        if (currentJson === lastSavedJson.current) {
            return; // No actual change, don't update status or save
        }

        // Mark as unsaved immediately when actual changes are detected
        setSaveStatus('idle'); // 'idle' = unsaved (gray underline)

        // Debounce: wait 1 second after last change before saving
        const timeoutId = setTimeout(() => {
            if (tabsToSave.length > 0) {
                try {
                    localStorage.setItem(STORAGE_KEY, currentJson);
                    lastSavedJson.current = currentJson;
                    console.log('[Auto-save] Saved to localStorage');
                    setSaveStatus('saved'); // 'saved' = primary color (stays)
                } catch (err) {
                    console.error('[Auto-save] Failed to save:', err);
                }
            }
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [tabs]);

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
                    // Sync pool tracing with global settings
                    if ('tracing' in updatedNode) {
                        newData.data.settings = {
                            ...(newData.data.settings || {}),
                            tracing: updatedNode.tracing
                        };
                    }
                } else {
                    newData.data = { ...newData.data, ...updatedNode };
                    // Sync pool tracing with global settings
                    if ('tracing' in updatedNode) {
                        newData.settings = {
                            ...(newData.settings || {}),
                            tracing: updatedNode.tracing
                        };
                    }
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

                        // Auto-update router persona if it exists and is routing_agent type
                        if (newData.data.pool.router && newData.data.pool.router.type === 'routing_agent') {
                            const autoFill = generateRouterAutoFill(newAgents);
                            newData.data.pool.router = {
                                ...newData.data.pool.router,
                                description: autoFill.description,
                                persona: autoFill.persona
                            };
                        }
                    } else {
                        newData.data = { ...newData.data, agents: newAgents };

                        // Auto-update router persona if it exists and is routing_agent type
                        if (newData.data.router && newData.data.router.type === 'routing_agent') {
                            const autoFill = generateRouterAutoFill(newAgents);
                            newData.data.router = {
                                ...newData.data.router,
                                description: autoFill.description,
                                persona: autoFill.persona
                            };
                        }
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
                const uniqueId = updatedNode._id;
                const isUnassigned = nodeId.startsWith('tool-unassigned-');
                const isChildOfUnassignedAgent = nodeId.startsWith('agent-unassigned-');

                if (isUnassigned && newData.data.unassigned_tools) {
                    const newTools = newData.data.unassigned_tools.map((tool: any) =>
                        (uniqueId && tool._id === uniqueId) || (!uniqueId && (tool._originalName || tool.name) === originalName)
                            ? { ...updatedNode, _originalName: updatedNode.name }
                            : tool
                    );
                    newData.data = { ...newData.data, unassigned_tools: newTools };
                } else if (isChildOfUnassignedAgent && newData.data.unassigned_agents) {
                    // Update tools inside unassigned agents
                    const newUnassignedAgents = newData.data.unassigned_agents.map((agent: any, idx: number) => {
                        const agentId = `agent-unassigned-${agent._id || idx}`;
                        if (!nodeId.startsWith(agentId)) return agent;

                        const updatedTools = (agent.tools || []).map((tool: any) =>
                            (uniqueId && tool._id === uniqueId) || (!uniqueId && (tool._originalName || tool.name) === originalName)
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
                            (uniqueId && tool._id === uniqueId) || (!uniqueId && (tool._originalName || tool.name) === originalName)
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

        const newTabs = tabs.filter(t => t.id !== tabId);

        // trigger save of the NEW state (without the closed tab)
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newTabs));
        } catch (err) {
            console.error("Failed to save before closing tab", err);
        }

        setTabs(newTabs);

        if (activeTabId === tabId) {
            setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
        }

        if (newTabs.length === 0) {
            setIsSidebarCollapsed(true);
            setIsRightSidebarOpen(false);
        }
    }, [activeTabId, tabs]);

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
        setIsSidebarCollapsed(true);
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
            setIsSidebarCollapsed(false);
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
            setIsSidebarCollapsed(false);
        }
        setIsAddToolbarCollapsed(false);
        // showNotification("Created new project");
    }, [activeTab, activeTabId, showNotification]);

    // Create a Tutorial Project (full tutorial with pool, router, history, agents, tools)
    const handleTutorial = useCallback(() => {
        const { newTab, positions } = createTutorialData();

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        setNodePositions(positions);

        setDetailsNode(null);
        setDetailsNodeType(null);
        setSelectedNodeId(null);
        setIsRightSidebarOpen(false);
        setIsSidebarCollapsed(false);
        setIsAddToolbarCollapsed(false);

    }, []);

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
                setIsSidebarCollapsed(false);
            } catch {
                setError("Failed to parse file. Is it valid JSON?");
            }
        };
        reader.readAsText(file);
    }, [activeTabId]);

    // Add Agent handler - directly adds agent with random slug
    // Add Agent handler - adds to pool or unassigned
    const handleAddAgent = useCallback((parentId?: string, position?: { x: number, y: number }) => {
        if (!activeTabId || !activeTab?.data) return;

        // Save current state to history for undo
        pushToHistory(activeTabId, activeTab.data, nodePositions);

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

        // Save current state to history for undo
        pushToHistory(activeTabId, activeTab.data, nodePositions);

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

    // Handle Tool -> Agent connection (supports both unassigned tools and cloning existing tools)
    const handleConnectToolToAgent = useCallback((toolId: string, agentId: string, position?: { x: number, y: number }) => {
        if (!activeTabId || !activeTab?.data) return;

        const isUnassignedTool = toolId.startsWith('tool-unassigned-');
        const isAssignedTool = toolId.includes('-tool-') && !isUnassignedTool;

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
            let toolToAdd: any = null;

            // Collect position remappings to apply later
            // const positionRemaps: { from: string, to: string }[] = []; // REMOVED

            // Case 1: Move an assigned tool from one agent to another
            if (isAssignedTool) {
                // Parse the source agent ID and tool suffix from toolId
                const toolMatch = toolId.match(/^(.+)-tool-(.+)$/);
                if (!toolMatch) return tab;

                const sourceAgentId = toolMatch[1];
                const toolSuffix = toolMatch[2]; // Could be index or _id

                const isProjectData = newData.type === 'project';

                // Deep clone the data structure to allow mutations
                if (isProjectData && newData.data.pool) {
                    newData.data.pool = JSON.parse(JSON.stringify(newData.data.pool));
                }
                if (newData.data.unassigned_agents) {
                    newData.data.unassigned_agents = JSON.parse(JSON.stringify(newData.data.unassigned_agents));
                }

                const container = (isProjectData && newData.data.pool) ? newData.data.pool : newData.data;

                // Find and REMOVE the source tool from its current agent
                let sourceTool: any = null;

                // Helper to find tool index by ID or Index
                const findToolIndex = (tools: any[]) => {
                    return tools.findIndex((t: any, idx: number) => {
                        // Check strictly if suffix matches _id, or if matches index string
                        return (t._id && t._id === toolSuffix) || (String(idx) === toolSuffix);
                    });
                };

                // Check pool agents
                if (container?.agents) {
                    for (let i = 0; i < container.agents.length; i++) {
                        if (sourceAgentId === `agent-${i}` && container.agents[i].tools) {
                            const idx = findToolIndex(container.agents[i].tools);
                            if (idx !== -1) {
                                [sourceTool] = container.agents[i].tools.splice(idx, 1);
                                break;
                            }
                        }
                    }
                }

                // Check unassigned agents
                if (!sourceTool && newData.data.unassigned_agents) {
                    for (const agent of newData.data.unassigned_agents) {
                        const uaId = `agent-unassigned-${agent._id}`;
                        if (sourceAgentId === uaId && agent.tools) {
                            const idx = findToolIndex(agent.tools);
                            if (idx !== -1) {
                                [sourceTool] = agent.tools.splice(idx, 1);
                                break;
                            }
                        }
                    }
                }

                if (!sourceTool) return tab;

                toolToAdd = sourceTool;
            }
            // Case 2: Move an unassigned tool
            else if (isUnassignedTool) {
                const unassignedTools = [...(newData.data.unassigned_tools || [])];
                const toolIndex = unassignedTools.findIndex((t: any) => t._id === uniqueId || `tool-unassigned-${t._id || unassignedTools.indexOf(t)}` === toolId);
                if (toolIndex === -1) return tab;

                toolToAdd = unassignedTools[toolIndex];
                // Remove from unassigned tools list
                unassignedTools.splice(toolIndex, 1);
                newData.data.unassigned_tools = unassignedTools;
            }

            if (!toolToAdd) return tab;

            // Prepare agent collections
            const isProjectData = newData.type === 'project';
            const container = (isProjectData && newData.data.pool) ? newData.data.pool : (!isProjectData ? newData.data : null);

            // Assigned agents path
            if (updateAssignedAgents && container) {
                const newAgents = [...(container.agents || [])];
                const agent = { ...newAgents[targetAgentIndex] };
                const currentTools = agent.tools || [];
                agent.tools = [...currentTools, toolToAdd];
                newAgents[targetAgentIndex] = agent;

                if (isProjectData) {
                    newData.data.pool = { ...container, agents: newAgents };
                } else {
                    newData.data = { ...container, agents: newAgents };
                }

                // Stable ID generation
                const newToolIndex = currentTools.length;
                const newToolId = `${agentId}-tool-${toolToAdd._id || newToolIndex}`;

                // ATOMIC POSITION UPDATE
                setNodePositions(prev => {
                    const next = { ...prev };

                    // Capture old position
                    const oldPosition = next[toolId];
                    if (next[toolId]) delete next[toolId];

                    // Set new position
                    if (position) {
                        next[newToolId] = position;
                    } else if (oldPosition) {
                        next[newToolId] = oldPosition;
                    }
                    return next;
                });

                setSelectedNodeId(newToolId);
                setDetailsNodeType('tool');
                setDetailsNode({ ...toolToAdd, _nodeId: newToolId, _originalName: toolToAdd.name });
                setIsRightSidebarOpen(true);

                return { ...tab, data: newData };
            }

            // Unassigned agent path (agent lives in unassigned_agents)
            if (isUnassignedAgent) {
                const unassignedAgents = [...(newData.data.unassigned_agents || [])];
                const targetAgent = { ...unassignedAgents[targetAgentIndex] };
                const currentTools = targetAgent.tools || [];
                targetAgent.tools = [...currentTools, toolToAdd];
                unassignedAgents[targetAgentIndex] = targetAgent;

                newData.data.unassigned_agents = unassignedAgents;

                const newToolIndex = currentTools.length;
                const newToolId = `${agentId}-tool-${toolToAdd._id || newToolIndex}`;

                // ATOMIC POSITION UPDATE
                setNodePositions(prev => {
                    const next = { ...prev };

                    // Capture old position
                    const oldPosition = next[toolId];
                    if (next[toolId]) delete next[toolId];

                    // Set new position
                    if (position) {
                        next[newToolId] = position;
                    } else if (oldPosition) {
                        next[newToolId] = oldPosition;
                    }
                    return next;
                });

                setSelectedNodeId(newToolId);
                setDetailsNodeType('tool');
                setDetailsNode({ ...toolToAdd, _nodeId: newToolId, _originalName: toolToAdd.name });
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

        // Save current state to history for undo
        pushToHistory(activeTabId, activeTab.data, nodePositions);

        const currentData = activeTab.data.data;

        // Check if pool already has a router (for assigned router)
        const isProject = activeTab.data.type === 'project';
        const poolRouter = isProject ? currentData.pool?.router : currentData.router;

        if (poolRouter) {
            showNotification("Pool already has a router");
            return;
        }

        // Get pool agents for auto-fill
        const poolAgents = isProject ? (currentData.pool?.agents || []) : (currentData.agents || []);
        const autoFill = generateRouterAutoFill(poolAgents);

        // Create the Router with auto-filled values
        const newRouter = {
            _id: crypto.randomUUID(),
            name: autoFill.name,
            description: autoFill.description,
            persona: autoFill.persona,
            model: 'gpt-4o',
            type: 'routing_agent',
            tracing: null,
            routes: []
        };

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = { ...tab.data, data: { ...tab.data.data } };
            const isProjectType = newData.type === 'project';

            // If pool exists, assign to pool's router slot
            if (isProjectType && newData.data.pool) {
                newData.data.pool = { ...newData.data.pool, router: newRouter };

                const routerId = 'router-main';
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
            }

            // If no pool exists (project mode) or not project mode without pool, add as unassigned router
            if (isProjectType && !newData.data.pool) {
                // Store in unassigned_routers array
                const currentUnassigned = newData.data.unassigned_routers || [];
                newData.data = {
                    ...newData.data,
                    unassigned_routers: [...currentUnassigned, newRouter]
                };

                const routerId = `router-unassigned-${newRouter._id}`;
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
            }

            // Non-project types (e.g., pool type directly)
            newData.data = { ...newData.data, router: newRouter };

            const routerId = 'router-main';
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

        // Save current state to history for undo
        pushToHistory(activeTabId, activeTab.data, nodePositions);

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

                // Auto-update router if it exists and is routing_agent type
                if (newData.data.pool.router && newData.data.pool.router.type === 'routing_agent') {
                    const autoFill = generateRouterAutoFill(newAgentsList);
                    newData.data.pool.router = {
                        ...newData.data.pool.router,
                        description: autoFill.description,
                        persona: autoFill.persona
                    };
                }
            } else {
                newData.data = {
                    ...newData.data,
                    agents: newAgentsList,
                    unassigned_agents: unassigned
                };

                // Auto-update router if it exists and is routing_agent type
                if (newData.data.router && newData.data.router.type === 'routing_agent') {
                    const autoFill = generateRouterAutoFill(newAgentsList);
                    newData.data.router = {
                        ...newData.data.router,
                        description: autoFill.description,
                        persona: autoFill.persona
                    };
                }
            }

            return { ...tab, data: newData };
        }));

        // showNotification("Agent connected");
    }, [activeTabId, activeTab, showNotification]);

    // Handle node position updates when manually dragged
    const handleNodePositionChange = useCallback((nodeId: string, position: { x: number, y: number }) => {
        setNodePositions(prev => ({ ...prev, [nodeId]: position }));
    }, []);

    // Handle node drag start - save state to history for undo
    const handleNodeDragStart = useCallback(() => {
        if (!activeTabId || !activeTab?.data) return;

        // Save current state to history before the drag changes positions
        pushToHistory(activeTabId, activeTab.data, nodePositions);
    }, [activeTabId, activeTab, nodePositions, pushToHistory]);

    // Add History handler
    const handleAddHistory = useCallback((parentId?: string, position?: { x: number, y: number }) => {
        if (!activeTabId || !activeTab?.data) return;

        // Save current state to history for undo
        pushToHistory(activeTabId, activeTab.data, nodePositions);

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

            // Scenario B: Connect to Assigned Agent (agent-{index})
            if (parentId.startsWith('agent-') && !parentId.startsWith('agent-unassigned-')) {
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

            // Scenario C: Connect to Unassigned Agent (agent-unassigned-{id})
            if (parentId.startsWith('agent-unassigned-')) {
                const agentUniqueId = parentId.replace('agent-unassigned-', '');
                const unassignedAgents = newData.data.unassigned_agents || [];

                const agentIndex = unassignedAgents.findIndex((a: any) =>
                    a._id === agentUniqueId || `agent-unassigned-${a._id}` === parentId
                );

                if (agentIndex !== -1) {
                    const agent = { ...unassignedAgents[agentIndex] };

                    if (agent.history) {
                        showNotification("Agent already has history");
                        return tab;
                    }

                    // Remove from unassigned histories
                    unassigned.splice(historyIndex, 1);
                    if (unassigned.length === 0) delete newData.data.unassigned_histories;
                    else newData.data.unassigned_histories = unassigned;

                    // Assign to Unassigned Agent
                    agent.history = historyToMove;
                    const newUnassignedAgents = [...unassignedAgents];
                    newUnassignedAgents[agentIndex] = agent;
                    newData.data.unassigned_agents = newUnassignedAgents;

                    if (position) {
                        const newHistoryId = `${parentId}-history`;
                        setNodePositions(prev => {
                            const next = { ...prev };
                            if (next[historyId]) delete next[historyId];
                            next[newHistoryId] = position;
                            return next;
                        });
                    }

                    // showNotification("History connected to Unassigned Agent");
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

    // Disconnect nodes (remove connection between source and target)
    const handleDisconnect = useCallback((sourceId: string, targetId: string) => {
        if (!activeTabId || !activeTab?.data) return;

        // Save current state to history for undo
        pushToHistory(activeTabId, activeTab.data, nodePositions);

        // Track ID changes for position transfer
        const positionTransfers: { oldId: string, newId: string }[] = [];

        setTabs(prev => prev.map(tab => {
            if (tab.id !== activeTabId) return tab;

            const newData = JSON.parse(JSON.stringify(tab.data));
            const isProject = newData.type === 'project';
            const projectData = isProject ? newData.data : null;
            const pool = isProject ? projectData?.pool : (newData.type === 'pool' ? newData.data : null);

            // Helper to identify node types from IDs
            const getNodeType = (id: string) => {
                // Check tool FIRST since tool IDs contain 'agent-' prefix (e.g., 'agent-0-tool-0')
                if (id.startsWith('tool-') || id.includes('-tool-')) return 'tool';
                if (id.includes('-history') || id.startsWith('history-')) return 'history';
                if (id.startsWith('agent-')) return 'agent';
                if (id.startsWith('router') || id === 'router-main') return 'router';
                if (id === 'pool-root') return 'pool';
                return 'unknown';
            };

            const sourceType = getNodeType(sourceId);
            const targetType = getNodeType(targetId);

            // Case 1: Disconnect tool from agent
            if ((sourceType === 'tool' && targetType === 'agent') || (sourceType === 'agent' && targetType === 'tool')) {
                const toolId = sourceType === 'tool' ? sourceId : targetId;
                const agentId = sourceType === 'agent' ? sourceId : targetId;

                // Parse tool suffix (ID or index)
                const toolMatch = toolId.match(/-tool-(.+)$/);
                const toolSuffix = toolMatch ? toolMatch[1] : null;

                if (!toolSuffix) return tab;

                // Find the agent and remove the tool
                const findAndRemoveToolFromPoolAgents = () => {
                    if (!pool?.agents) return false;
                    for (let agentIdx = 0; agentIdx < pool.agents.length; agentIdx++) {
                        const agent = pool.agents[agentIdx];
                        const expectedAgentId = `agent-${agentIdx}`;

                        if (!toolId.startsWith(expectedAgentId + '-tool-')) {
                            continue;
                        }

                        if (agent.tools) {
                            const idx = agent.tools.findIndex((t: any, i: number) =>
                                (t._id && t._id === toolSuffix) || (String(i) === toolSuffix)
                            );

                            if (idx !== -1) {
                                const [removedTool] = agent.tools.splice(idx, 1);
                                if (isProject) {
                                    if (!newData.data.unassigned_tools) newData.data.unassigned_tools = [];
                                    const newToolId = removedTool._id || `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                                    // Make sure removed tool has _id if it was missing (fallback)
                                    removedTool._id = newToolId;
                                    newData.data.unassigned_tools.push(removedTool);
                                    positionTransfers.push({ oldId: toolId, newId: `tool-unassigned-${newToolId}` });
                                }
                                return true;
                            }
                        }
                    }
                    return false;
                };

                const findAndRemoveToolFromUnassignedAgents = () => {
                    if (!projectData?.unassigned_agents) return false;
                    for (let agentIdx = 0; agentIdx < projectData.unassigned_agents.length; agentIdx++) {
                        const agent = projectData.unassigned_agents[agentIdx];
                        // Unassigned agents use _id in their node ID, not array index
                        const expectedAgentId = `agent-unassigned-${agent._id || agentIdx}`;

                        if (!toolId.startsWith(expectedAgentId + '-tool-')) {
                            continue;
                        }

                        if (agent.tools) {
                            const idx = agent.tools.findIndex((t: any, i: number) =>
                                (t._id && t._id === toolSuffix) || (String(i) === toolSuffix)
                            );

                            if (idx !== -1) {
                                const [removedTool] = agent.tools.splice(idx, 1);
                                if (isProject) {
                                    if (!newData.data.unassigned_tools) newData.data.unassigned_tools = [];
                                    const newToolId = removedTool._id || `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                                    removedTool._id = newToolId;
                                    newData.data.unassigned_tools.push(removedTool);
                                    positionTransfers.push({ oldId: toolId, newId: `tool-unassigned-${newToolId}` });
                                }
                                return true;
                            }
                        }
                    }
                    return false;
                };

                findAndRemoveToolFromPoolAgents();
                findAndRemoveToolFromUnassignedAgents();
            }

            // Case 2: Disconnect agent from pool/router
            if ((sourceType === 'agent' && (targetType === 'pool' || targetType === 'router')) ||
                ((sourceType === 'pool' || sourceType === 'router') && targetType === 'agent')) {
                const agentId = sourceType === 'agent' ? sourceId : targetId;

                if (pool?.agents) {
                    const agentIndex = pool.agents.findIndex((a: any, i: number) =>
                        agentId === `agent-${i}` || a._id === agentId.replace('agent-', '')
                    );
                    if (agentIndex !== -1) {
                        const [removedAgent] = pool.agents.splice(agentIndex, 1);
                        // Add to unassigned
                        if (isProject) {
                            if (!newData.data.unassigned_agents) newData.data.unassigned_agents = [];
                            const newAgentId = removedAgent._id || `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                            removedAgent._id = newAgentId;
                            newData.data.unassigned_agents.push(removedAgent);
                            // Track position transfer for agent and its children
                            positionTransfers.push({ oldId: agentId, newId: `agent-unassigned-${newAgentId}` });

                            // Shift positions for remaining agents that moved index
                            for (let k = agentIndex; k < pool.agents.length; k++) {
                                const oldIdx = k + 1;
                                const newIdx = k;
                                const oldAgentId = `agent-${oldIdx}`;
                                const newAgentId = `agent-${newIdx}`;
                                positionTransfers.push({ oldId: oldAgentId, newId: newAgentId });

                                const agent = pool.agents[k];
                                if (agent.tools) {
                                    agent.tools.forEach((t: any, tIdx: number) => {
                                        const suffix = t._id || tIdx;
                                        positionTransfers.push({
                                            oldId: `${oldAgentId}-tool-${suffix}`,
                                            newId: `${newAgentId}-tool-${suffix}`
                                        });
                                    });
                                }
                                if (agent.history) {
                                    positionTransfers.push({
                                        oldId: `${oldAgentId}-history`,
                                        newId: `${newAgentId}-history`
                                    });
                                }
                            }

                            // Transfer tool positions for the removed agent
                            if (removedAgent.tools) {
                                removedAgent.tools.forEach((t: any, i: number) => {
                                    const suffix = t._id || i;
                                    positionTransfers.push({
                                        oldId: `${agentId}-tool-${suffix}`,
                                        newId: `agent-unassigned-${newAgentId}-tool-${suffix}`
                                    });
                                });
                            }
                            // Transfer history position for the removed agent
                            if (removedAgent.history) {
                                positionTransfers.push({
                                    oldId: `${agentId}-history`,
                                    newId: `agent-unassigned-${newAgentId}-history`
                                });
                            }

                            // Auto-update router if it exists and is routing_agent type
                            if (pool.router && pool.router.type === 'routing_agent') {
                                const autoFill = generateRouterAutoFill(pool.agents);
                                pool.router = {
                                    ...pool.router,
                                    description: autoFill.description,
                                    persona: autoFill.persona
                                };
                            }
                        }
                    }
                }
            }

            // Case 3: Disconnect history from parent
            if ((sourceType === 'history') || (targetType === 'history')) {
                const historyId = sourceType === 'history' ? sourceId : targetId;
                const historyParentId = sourceType === 'history' ? targetId : sourceId;

                if (historyParentId === 'pool-root' && pool?.history) {
                    const removedHistory = { ...pool.history };
                    delete pool.history;
                    if (isProject) {
                        if (!newData.data.unassigned_histories) newData.data.unassigned_histories = [];
                        const newHistoryId = removedHistory._id || `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                        removedHistory._id = newHistoryId;
                        newData.data.unassigned_histories.push(removedHistory);
                        positionTransfers.push({ oldId: historyId, newId: `history-unassigned-${newHistoryId}` });
                    }
                } else if (historyParentId.startsWith('agent-')) {
                    const findAndRemoveHistory = (agents: any[], agentIdPrefix: string) => {
                        for (let i = 0; i < agents.length; i++) {
                            const agent = agents[i];
                            if (agent.history && historyId === `${agentIdPrefix}-${i}-history`) {
                                const removedHistory = { ...agent.history };
                                delete agent.history;
                                if (isProject) {
                                    if (!newData.data.unassigned_histories) newData.data.unassigned_histories = [];
                                    const newHistoryId = removedHistory._id || `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                                    removedHistory._id = newHistoryId;
                                    newData.data.unassigned_histories.push(removedHistory);
                                    positionTransfers.push({ oldId: historyId, newId: `history-unassigned-${newHistoryId}` });
                                }
                                return true;
                            }
                        }
                        return false;
                    };
                    if (pool?.agents) findAndRemoveHistory(pool.agents, 'agent');
                    if (projectData?.unassigned_agents) findAndRemoveHistory(projectData.unassigned_agents, 'agent-unassigned');
                }
            }

            // Case 4: Disconnect router from pool
            if ((sourceType === 'router' && targetType === 'pool') || (sourceType === 'pool' && targetType === 'router')) {
                const routerId = sourceType === 'router' ? sourceId : targetId;
                if (pool?.router) {
                    const removedRouter = { ...pool.router };
                    delete pool.router;
                    if (isProject) {
                        if (!newData.data.unassigned_routers) newData.data.unassigned_routers = [];
                        const newRouterId = removedRouter._id || `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                        removedRouter._id = newRouterId;
                        newData.data.unassigned_routers.push(removedRouter);
                        positionTransfers.push({ oldId: routerId, newId: `router-unassigned-${newRouterId}` });
                    }
                }
            }

            return { ...tab, data: newData };
        }));

        // Transfer positions from old IDs to new IDs
        if (positionTransfers.length > 0) {
            setNodePositions(prev => {
                const next = { ...prev };
                for (const { oldId, newId } of positionTransfers) {
                    // Try to get position from manual map OR from current layout fallback
                    // Read from 'prev' to avoid issues with chained shifts (A->B, B->C) in the same batch
                    let pos = prev[oldId];

                    if (!pos && activeTab?.layout?.nodes) {
                        const node = activeTab.layout.nodes.find(n => n.id === oldId);
                        if (node) {
                            pos = node.position;
                        }
                    }

                    if (pos) {
                        next[newId] = pos;
                        if (next[oldId]) {
                            delete next[oldId];
                        }
                    }
                }
                return next;
            });
        }
    }, [activeTabId, activeTab, pushToHistory]);

    // Delete Node Handler - supports single ID or array of IDs for bulk deletion
    const handleDeleteNode = useCallback((nodeIdOrIds: string | string[]) => {
        if (!activeTabId || !activeTab?.data) return;

        const nodeIds = Array.isArray(nodeIdOrIds) ? nodeIdOrIds : [nodeIdOrIds];
        if (nodeIds.length === 0) return;

        // Save current state to history for undo
        pushToHistory(activeTabId, activeTab.data, nodePositions);

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
                                    // Use ID-based old tool ID
                                    const oldToolId = `agent-unassigned-${itemId}-tool-${tool._id || tIdx}`;
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
                            // Transfer Tool Positions
                            agent.tools?.forEach((tool: any, tIdx: number) => {
                                const oldToolId = `${oldAgentId}-tool-${tool._id || tIdx}`;
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
                else if (nodeId.includes('-tool-') && !nodeId.startsWith('tool-unassigned-') && !nodeId.startsWith('agent-unassigned-')) {
                    const parts = nodeId.split('-tool-');
                    const agentId = parts[0];
                    const toolSuffix = parts[1];
                    const agentIdx = parseInt(agentId.split('agent-')[1], 10);

                    if (!isNaN(agentIdx) && poolContainer?.agents && poolContainer.agents[agentIdx]) {
                        const agent = poolContainer.agents[agentIdx];
                        if (agent.tools) {
                            const idx = agent.tools.findIndex((t: any, i: number) =>
                                (t._id && t._id === toolSuffix) || (String(i) === toolSuffix)
                            );
                            if (idx !== -1) {
                                agent.tools.splice(idx, 1);
                                if (agent.tools.length === 0) delete agent.tools;
                                anyNodeDeleted = true;
                            }
                        }
                    }
                }
                // 7.5 Delete Tool from Unassigned Agent (agent-unassigned-X-tool-Y)
                else if (nodeId.includes('-tool-') && nodeId.startsWith('agent-unassigned-')) {
                    const parts = nodeId.split('-tool-');
                    const agentId = parts[0]; // agent-unassigned-ID
                    const toolSuffix = parts[1];
                    const agentUniqueId = agentId.replace('agent-unassigned-', '');

                    if (currentData.unassigned_agents) {
                        const agentIndex = currentData.unassigned_agents.findIndex((a: any) =>
                            a._id === agentUniqueId || `agent-unassigned-${a._id}` === agentId
                        );

                        if (agentIndex !== -1) {
                            const agent = currentData.unassigned_agents[agentIndex];
                            if (agent.tools) {
                                const idx = agent.tools.findIndex((t: any, i: number) =>
                                    (t._id && t._id === toolSuffix) || (String(i) === toolSuffix)
                                );
                                if (idx !== -1) {
                                    agent.tools.splice(idx, 1);
                                    if (agent.tools.length === 0) delete agent.tools;
                                    anyNodeDeleted = true;
                                    // Update the agent in the array
                                    currentData.unassigned_agents[agentIndex] = agent;
                                }
                            }
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

    // Load saved data and projects on mount
    useEffect(() => {
        // Load tabs (session)
        const savedTabs = localStorage.getItem(STORAGE_KEY);
        let loadedTabs: AtlasTab[] = [];

        if (savedTabs) {
            try {
                const parsed = JSON.parse(savedTabs);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    loadedTabs = parsed;
                    setTabs(parsed);
                    // Set active tab to the last tab (most recently used)
                    setActiveTabId(parsed[parsed.length - 1].id);
                    // Check if the active tab has data to determine sidebar state
                    const lastTab = parsed[parsed.length - 1];
                    if (lastTab.data) {
                        setIsSidebarCollapsed(false);
                    }
                }
            } catch (e) {
                console.error("Failed to parse saved tabs", e);
            }
        }

        // If no tabs were loaded, create a new empty tab for welcome screen
        if (loadedTabs.length === 0) {
            const newTab: AtlasTab = {
                id: generateUUID(),
                name: 'New Tab',
                data: null
            };
            setTabs([newTab]);
            setActiveTabId(newTab.id);
            setIsSidebarCollapsed(true);
            setIsRightSidebarOpen(false);
        }

        // Load projects (persistent)
        const savedProjectsData = localStorage.getItem(PROJECTS_STORAGE_KEY);
        if (savedProjectsData) {
            try {
                const parsed = JSON.parse(savedProjectsData);
                if (Array.isArray(parsed)) {
                    setSavedProjects(parsed);
                }
            } catch (e) {
                console.error("Failed to parse saved projects", e);
            }
        }
    }, []);

    // Save tabs to local storage whenever they change, AND update saved projects
    useEffect(() => {
        if (tabs.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));

            // Sync current tabs to savedProjects (add or update)
            setSavedProjects(prevProjects => {
                const newProjects = [...prevProjects];
                let changed = false;

                tabs.forEach(tab => {
                    // Only save tabs that have data (actual projects)
                    if (tab.data) {
                        const index = newProjects.findIndex(p => p.id === tab.id);
                        if (index >= 0) {
                            // Update existing project
                            if (JSON.stringify(newProjects[index]) !== JSON.stringify(tab)) {
                                newProjects[index] = tab;
                                changed = true;
                            }
                        } else {
                            // Add new project
                            newProjects.push(tab);
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(newProjects));
                    return newProjects;
                }
                return prevProjects;
            });
        }
    }, [tabs]);

    // Handle Delete Project (Persistent)
    const handleDeleteProject = useCallback((projectId: string) => {
        // Show custom confirmation dialog
        setPendingDeleteId(projectId);
        setDeleteConfirmOpen(true);
    }, []);

    // Confirm delete action
    const confirmDeleteProject = useCallback(() => {
        if (!pendingDeleteId) return;

        // Remove from persistent storage
        setSavedProjects(prev => {
            const newProjects = prev.filter(p => p.id !== pendingDeleteId);
            localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(newProjects));
            return newProjects;
        });

        // Remove from active tabs if open
        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== pendingDeleteId);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newTabs)); // Update session storage too
            return newTabs;
        });

        if (activeTabId === pendingDeleteId) {
            setActiveTabId(null);
        }

        // Reset pending delete
        setPendingDeleteId(null);
    }, [activeTabId, pendingDeleteId]);

    // Handle Open Project from List
    const handleOpenProject = useCallback((projectId: string) => {
        // Check if already open
        const isOpen = tabs.find(t => t.id === projectId);
        if (isOpen) {
            setActiveTabId(projectId);
            setIsSidebarCollapsed(false); // Expand sidebar when opening project
            return;
        }

        // Load from saved projects
        const project = savedProjects.find(p => p.id === projectId);
        if (project) {
            setTabs(prev => [...prev, project]);
            setActiveTabId(projectId);
            setIsSidebarCollapsed(false); // Expand sidebar when opening project
        }
    }, [tabs, savedProjects]);

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
                        const toolMatch = id.match(/-tool-(.+)$/);
                        const toolSuffix = toolMatch ? toolMatch[1] : parts[3];

                        // Find by _id OR index
                        if (agent.tools) {
                            const tool = agent.tools.find((t: any, idx: number) =>
                                (t._id && t._id === toolSuffix) || String(idx) === toolSuffix
                            );
                            if (tool) return { node: tool, type: 'tool' };
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
                        const toolMatch = id.match(/-tool-(.+)$/);
                        const toolSuffix = toolMatch ? toolMatch[1] : null;

                        if (toolSuffix && agent.tools) {
                            const tool = agent.tools.find((t: any, idx: number) =>
                                (t._id && t._id === toolSuffix) || String(idx) === toolSuffix
                            );
                            if (tool) return { node: tool, type: 'tool' };
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
                                tabs={tabs.map(t => ({ id: t.id, name: t.name }))}
                                activeTabId={activeTabId}
                                onTabChange={(id) => setActiveTabId(id)}
                                onCloseTab={(id) => {
                                    // Create synthetic event for closeTab
                                    closeTab({ stopPropagation: () => { } } as React.MouseEvent, id);
                                }}
                                onRenameTab={(id, name) => {
                                    setTabs(prev => prev.map(t =>
                                        t.id === id ? { ...t, name } : t
                                    ));
                                }}
                                onNewTab={() => {
                                    handleNewEmptyTab();
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

                {/* Top Bar */}
                <div className="border-b border-white/10 bg-card/40 backdrop-blur-xl flex flex-col md:flex-row items-center px-0 md:px-4 gap-0 md:gap-2 z-40 shrink-0 md:h-[55px] transition-all shadow-sm">
                    {/* Mobile Header */}
                    <div className="flex items-center justify-between w-full md:hidden px-4 py-3 border-b border-white/5">
                        {/* Left: Actions */}

                        <div
                            onClick={() => {
                                // Only create new tab if current tab has data (not already on welcome screen)
                                if (activeTab?.data) {
                                    handleNewEmptyTab();
                                }
                            }}
                            className="cursor-pointer"
                        >
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
                    <div
                        ref={tabsContainerRef}
                        onMouseDown={handleTabsMouseDown}
                        onMouseLeave={handleTabsMouseLeave}
                        onMouseUp={handleTabsMouseUp}
                        onMouseMove={handleTabsMouseMove}
                        className="hidden md:flex flex-1 items-end gap-0.5 overflow-x-auto w-full md:w-auto [&::-webkit-scrollbar]:hidden h-full min-h-[45px] z-10 cursor-grab active:cursor-grabbing"
                    >
                        <AnimatePresence initial={false}>
                            {tabs.map((tab) => (
                                <motion.div
                                    layout
                                    key={tab.id}
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: 'auto' }}
                                    exit={{ opacity: 0, width: 0, transition: { duration: 0.15 } }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className={cn(
                                        "group flex items-center gap-2 px-4 py-2 border-r border-r-border/50 text-sm font-medium transition-all cursor-pointer select-none min-w-[120px] max-w-[200px] shrink-0 h-full relative",
                                        activeTabId === tab.id
                                            ? "bg-transparent text-foreground pt-2.5 pb-2"
                                            : "bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground pt-2.5 pb-2"
                                    )}
                                    onClick={() => {
                                        // Don't do anything if clicking the already active tab
                                        if (activeTabId === tab.id) return;

                                        // Save current selection to the current tab before switching
                                        if (activeTabId && selectedNodeId) {
                                            setTabs(prev => prev.map(t =>
                                                t.id === activeTabId ? { ...t, selectedNodeId } : t
                                            ));
                                        }

                                        // Switch to new tab
                                        setActiveTabId(tab.id);

                                        // Restore the target tab's saved selection or auto-select
                                        if (tab.selectedNodeId) {
                                            // Restore saved selection and expand sidebar for tab with data
                                            setSelectedNodeId(tab.selectedNodeId);
                                            setIsSidebarCollapsed(false);
                                            // Find and open the node details
                                            if (tab.layout?.nodes) {
                                                const node = tab.layout.nodes.find(n => n.id === tab.selectedNodeId);
                                                if (node) {
                                                    const nodeType = node.type as 'agent' | 'router' | 'tool' | 'pool' | 'history';
                                                    const originalData = (node.data as any).originalData || node.data;
                                                    setDetailsNode({ ...originalData, _nodeId: node.id });
                                                    setDetailsNodeType(nodeType);
                                                }
                                            }
                                        } else if (tab.data) {
                                            // Tab has data - expand sidebar
                                            setIsSidebarCollapsed(false);
                                            // Auto-select in priority: agent > pool > other
                                            let autoSelectId: string | null = null;
                                            let autoSelectNode: any = null;
                                            let autoSelectType: 'agent' | 'router' | 'tool' | 'pool' | 'history' | null = null;

                                            if (tab.layout?.nodes && tab.layout.nodes.length > 0) {
                                                const nodes = tab.layout.nodes;
                                                // Priority 1: Agent
                                                const agentNode = nodes.find(n => n.type === 'agent');
                                                if (agentNode) {
                                                    autoSelectId = agentNode.id;
                                                    autoSelectNode = (agentNode.data as any).originalData || agentNode.data;
                                                    autoSelectType = 'agent';
                                                } else {
                                                    // Priority 2: Pool
                                                    const poolNode = nodes.find(n => n.type === 'pool');
                                                    if (poolNode) {
                                                        autoSelectId = poolNode.id;
                                                        autoSelectNode = (poolNode.data as any).originalData || poolNode.data;
                                                        autoSelectType = 'pool';
                                                    } else {
                                                        // Priority 3: Any other node
                                                        const anyNode = nodes[0];
                                                        if (anyNode) {
                                                            autoSelectId = anyNode.id;
                                                            autoSelectNode = (anyNode.data as any).originalData || anyNode.data;
                                                            autoSelectType = anyNode.type as any;
                                                        }
                                                    }
                                                }
                                            }

                                            if (autoSelectId && autoSelectNode) {
                                                setSelectedNodeId(autoSelectId);
                                                setDetailsNode({ ...autoSelectNode, _nodeId: autoSelectId });
                                                setDetailsNodeType(autoSelectType);
                                            } else {
                                                // No nodes to select
                                                setSelectedNodeId(null);
                                                setDetailsNode(null);
                                            }
                                        } else {
                                            // Tab has no data (welcome screen/new tab) - collapse sidebars
                                            setSelectedNodeId(null);
                                            setDetailsNode(null);
                                            setIsSidebarCollapsed(true);
                                            setIsRightSidebarOpen(false);
                                        }
                                    }}
                                >
                                    <span className="truncate flex-1">{tab.name}</span>

                                    {/* Active tab bottom border - color indicates save state */}
                                    {activeTabId === tab.id && (
                                        <motion.div
                                            layoutId="activeTabBottomBorder"
                                            className={cn(
                                                "absolute bottom-0 left-0 right-0 h-[2px] z-10 transition-colors duration-300",
                                                saveStatus === 'saved'
                                                    ? "bg-primary"
                                                    : "bg-muted-foreground/50"
                                            )}
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
                    <div className="hidden md:flex items-center h-full gap-2 bg-card/50 backdrop-blur-sm z-20 px-2">
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    if (!activeTab?.data) {
                                        showNotification("Create an atlas first");
                                        return;
                                    }
                                    handleDownloadPear();
                                }}
                                className="flex items-center justify-center w-fit px-4 py-2 h-9 hover:bg-white/5 text-foreground transition-all group border rounded-sm border-border text-sm font-medium"
                                title="Download .pear file"
                            >
                                <Download className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-all mr-2" />
                                <span>Download</span>
                            </button>
                        </div>

                        <a
                            href="https://github.com/Peargent/peargent"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-fit px-5 h-9 bg-black hover:bg-neutral-900 text-white transition-all group rounded-sm text-sm font-medium border border-border"
                            title="Star on GitHub"
                        >
                            <Github className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                            <span className="font-medium">{starCount !== null ? starCount.toLocaleString() : 'Star'}</span>
                        </a>

                        <a
                            href="https://github.com/Peargent/peargent-atlas/issues/new?labels=bug"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-fit px-4 h-9 bg-card hover:bg-muted text-foreground transition-all group rounded-sm text-sm font-medium border border-border"
                            title="Report a Bug"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 group-hover:scale-110 transition-transform">
                                <path d="m8 2 1.88 1.88" />
                                <path d="M14.12 3.88 16 2" />
                                <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
                                <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
                                <path d="M12 20v-9" />
                                <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
                                <path d="M6 13H2" />
                                <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
                                <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
                                <path d="M22 13h-4" />
                                <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
                            </svg>
                            <span className="font-medium">Bug</span>
                        </a>
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
                                setIsRightSidebarOpen(true);
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
                            onNodeDragStart={handleNodeDragStart}
                            onDisconnect={handleDisconnect}
                            isTutorial={activeTab?.isTutorial}
                            initialViewport={activeTab?.isTutorial ? tutorialViewport : undefined}
                        />

                        {/* In-Tab Onboarding - shows when tab has no data */}
                        {activeTab && activeTab.data === null && (
                            <WelcomeScreen
                                title={
                                    <>Create with <span className="font-medium text-transparent bg-clip-text bg-gradient-to-br from-primary to-emerald-500">peargent</span> Atlas</>
                                }
                                onNewProject={handleNewProject}
                                onImport={handleImportToCurrentTab}
                                onTutorial={handleTutorial}
                                projects={savedProjects}
                                onOpenProject={handleOpenProject}
                                onDeleteProject={handleDeleteProject}
                            />
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
                        {activeTab?.data && (
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
                        )}


                        {/* Settings Dropdown */}
                        {activeTab?.data && (
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
                                                            const isCurrentlyEnabled = currentSettings.tracing !== false;
                                                            const newTracingValue = !isCurrentlyEnabled;

                                                            // Prepare updated data
                                                            const updatedData = {
                                                                ...tab.data,
                                                                settings: {
                                                                    ...currentSettings,
                                                                    tracing: newTracingValue
                                                                }
                                                            };

                                                            // Also sync to pool's tracing if pool exists
                                                            const isProject = tab.data.type === 'project';
                                                            if (isProject && updatedData.data?.pool) {
                                                                updatedData.data = {
                                                                    ...updatedData.data,
                                                                    pool: {
                                                                        ...updatedData.data.pool,
                                                                        tracing: newTracingValue
                                                                    }
                                                                };
                                                            } else if (!isProject && updatedData.data) {
                                                                updatedData.data = {
                                                                    ...updatedData.data,
                                                                    tracing: newTracingValue
                                                                };
                                                            }

                                                            return { ...tab, data: updatedData };
                                                        }));

                                                        // Update detailsNode in real-time if viewing a pool
                                                        if (detailsNodeType === 'pool' && detailsNode) {
                                                            const currentSettings = activeTab?.data?.settings || {};
                                                            const isCurrentlyEnabled = currentSettings.tracing !== false;
                                                            setDetailsNode((prev: any) => ({
                                                                ...prev,
                                                                tracing: !isCurrentlyEnabled
                                                            }));
                                                        }
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
                        )}

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
                        {activeTab?.data && (
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
                        )}

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
                                            <div className="w-2 h-7 rounded-full border border-purple-500/50 bg-purple-500/20" title="Router" />
                                            <div className="w-2 h-7 rounded-full border border-pink-500/50 bg-pink-500/20" title="History" />
                                            <div className="w-2 h-7 rounded-full border border-blue-500/50 bg-blue-500/20" title="Agent" />
                                            <div className="w-2 h-7 rounded-full border border-amber-500/50 bg-amber-500/20" title="Tool" />
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

                                            {/* Add Router */}
                                            <button
                                                onClick={() => handleAddRouter()}
                                                disabled={
                                                    !!activeTab?.data?.data?.router || // Pool view
                                                    !!activeTab?.data?.data?.pool?.router || // Project view (assigned)
                                                    (activeTab?.data?.data?.unassigned_routers && activeTab?.data?.data?.unassigned_routers.length > 0) // Project view (unassigned)
                                                }
                                                className={cn(
                                                    "relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
                                                    (
                                                        !!activeTab?.data?.data?.router ||
                                                        !!activeTab?.data?.data?.pool?.router ||
                                                        (activeTab?.data?.data?.unassigned_routers && activeTab?.data?.data?.unassigned_routers.length > 0)
                                                    )
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
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {/* Mobile Add FAB & Menu - top right */}
                        {activeTab?.data && (
                            <div className="md:hidden absolute right-4 top-4 z-40 flex flex-col items-end gap-3 pointer-events-none">
                                {/* FAB - stays at top */}
                                <button
                                    onClick={() => setIsMobileAddMenuOpen(!isMobileAddMenuOpen)}
                                    className={cn(
                                        "w-12 h-12 rounded-full bg-card/90 backdrop-blur-md border border-white/10 text-foreground shadow-xl flex items-center justify-center pointer-events-auto transition-transform active:scale-95",
                                        isMobileAddMenuOpen && "bg-secondary text-foreground"
                                    )}
                                >
                                    <Plus className={cn("w-6 h-6 transition-transform duration-300", isMobileAddMenuOpen && "rotate-[135deg]")} />
                                </button>

                                {/* Menu items appear below */}
                                <AnimatePresence>
                                    {isMobileAddMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10, scale: 0.9 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.9 }}
                                            className="flex flex-col items-end gap-3 pointer-events-auto"
                                        >
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

                                            {/* Agent */}
                                            <button
                                                onClick={() => { handleAddAgent(); setIsMobileAddMenuOpen(false); }}
                                                className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card border border-blue-500/20 text-blue-400 shadow-lg shadow-black/5"
                                            >
                                                <span className="text-sm font-medium">Agent</span>
                                                <Bot className="w-4 h-4" />
                                            </button>

                                            {/* Tool */}
                                            <button
                                                onClick={() => { handleAddTool(); setIsMobileAddMenuOpen(false); }}
                                                className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card border border-amber-500/20 text-amber-400 shadow-lg shadow-black/5"
                                            >
                                                <span className="text-sm font-medium">Tool</span>
                                                <Wrench className="w-4 h-4" />
                                            </button>

                                            {/* Router */}
                                            <button
                                                onClick={() => { handleAddRouter(); setIsMobileAddMenuOpen(false); }}
                                                className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card border border-purple-500/20 text-purple-400 shadow-lg shadow-black/5"
                                            >
                                                <span className="text-sm font-medium">Router</span>
                                                <Network className="w-4 h-4" />
                                            </button>

                                            {/* History */}
                                            <button
                                                onClick={() => { handleAddHistory(); setIsMobileAddMenuOpen(false); }}
                                                className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card border border-pink-500/20 text-pink-400 shadow-lg shadow-black/5"
                                            >
                                                <span className="text-sm font-medium">History</span>
                                                <History className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Empty State - Dual Path Onboarding */}
                        <AnimatePresence>
                            {tabs.length === 0 && !isDragging && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-10"
                                >
                                    <WelcomeScreen
                                        title={
                                            <>Welcome to <span className="font-medium text-transparent bg-clip-text bg-gradient-to-br from-primary to-emerald-500">peargent</span> Atlas</>
                                        }
                                        onNewProject={handleNewProject}
                                        onImport={handleFileSelect}
                                        onTutorial={handleTutorial}
                                        projects={savedProjects}
                                        onOpenProject={handleOpenProject}
                                        onDeleteProject={handleDeleteProject}
                                    />
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
                                    className="absolute inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-8"
                                >
                                    <div className="w-full h-full border-2 border-dashed border-primary/20 rounded-[2rem] flex items-center justify-center bg-primary/5 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-emerald-500/5" />

                                        <div className="text-center relative z-10">
                                            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary/30 animate-bounce">
                                                <Upload className="w-10 h-10 text-white" />
                                            </div>
                                            <h2
                                                className="text-5xl font-normal mb-3 text-foreground"
                                                style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
                                            >
                                                Drop to Open
                                            </h2>
                                            <p className="text-lg text-muted-foreground font-light">Original file will be loaded in a new tab</p>
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

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setPendingDeleteId(null);
                }}
                onConfirm={confirmDeleteProject}
                title="Delete Project"
                message="Are you sure you want to delete this project? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    );
}   
