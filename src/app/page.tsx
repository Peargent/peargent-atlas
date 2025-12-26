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
import { Upload, X, Plus, Save, Download, FileJson, ImageIcon, PanelLeft, PanelLeftClose, FileCode, PanelRight, PanelRightClose } from "lucide-react";
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

                        {/* Import Button */}
                        <div className="relative shrink-0 flex items-center h-full border-l border-border/50">
                            <button
                                className="flex items-center justify-center w-[48px] h-full hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all group border-r border-border/50"
                                title="Import File"
                            >
                                <Plus className="w-5 h-5 text-primary opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                            </button>
                            <input
                                type="file"
                                accept=".pear,.json"
                                onChange={handleFileSelect}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                title="Import .pear file"
                            />
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
                                setDetailsNode(null);
                                setDetailsNodeType(null);
                            }}
                            defaultLayout={activeTab?.layout}
                            onLayoutChange={handleLayoutChange}
                        />

                        {/* Right Sidebar Toggle */}
                        <div className="absolute top-4 right-4 z-40">
                            <button
                                onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                                className="p-2 rounded-lg bg-card/80 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground shadow-lg transition-all hover:bg-white/5"
                                title={isRightSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                            >
                                {isRightSidebarOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRight className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* Empty State */}
                        <AnimatePresence>
                            {tabs.length === 0 && !isDragging && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex items-center justify-center z-10"
                                >
                                    <label className="cursor-pointer text-center p-12 rounded-[2rem] bg-sidebar/30 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-sidebar/50 transition-all duration-500 group relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                        <input
                                            type="file"
                                            accept=".pear,.json"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                        <h3
                                            className="text-4xl font-normal mb-4 text-foreground"
                                            style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
                                        >
                                            Welcome to <span className="font-medium text-transparent bg-clip-text bg-gradient-to-br from-primary to-emerald-500 inline-block relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-primary/30 after:scale-x-0 group-hover:after:scale-x-100 after:transition-transform after:duration-500">peargent</span> Atlas
                                        </h3>
                                        <p className="text-muted-foreground text-lg max-w-sm mx-auto leading-relaxed group-hover:text-foreground/80 transition-colors font-light">
                                            Drag and drop a <span className="text-primary font-mono font-medium opacity-80 group-hover:opacity-100">.pear</span> file here<br />
                                            or <span className="underline decoration-primary/30 underline-offset-4 group-hover:decoration-primary/60 transition-all">click to browse</span>
                                        </p>
                                    </label>
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
                                className="absolute right-0 top-0 h-full z-30 shadow-2xl border-l border-border/50"
                                onClose={() => {
                                    setDetailsNode(null);
                                    setDetailsNodeType(null);
                                }}
                                onUpdate={handleNodeUpdate}
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
