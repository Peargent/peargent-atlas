"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Upload, X, FileJson, Plus, Menu, PanelLeft, TreeDeciduous, Play, Download, Save, MoreHorizontal, Image as ImageIcon, FileCode } from "lucide-react";
import { type Node as ReactFlowNode, type Edge } from '@xyflow/react';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import * as htmlToImage from 'html-to-image';
import AtlasGraph from '@/components/atlas/AtlasGraph';
import AtlasSidebar from '@/components/atlas/AtlasSidebar';
import { Toast } from "@/components/ui/Toast";

interface AtlasTab {
    id: string;
    name: string;
    data: any;
    layout?: {
        nodes: ReactFlowNode[];
        edges: Edge[];
    };
}

export default function AtlasPage() {
    const [tabs, setTabs] = useState<AtlasTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Download Dropdown State
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    const mobileDownloadMenuRef = useRef<HTMLDivElement>(null);

    // Toast State
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const handleSave = () => {
        if (tabs.length === 0) {
            setToastMessage("Nothing to save. Please import a file first.");
            setShowToast(true);
            return;
        }

        try {
            localStorage.setItem('peargent_atlas_tabs', JSON.stringify(tabs));
            setToastMessage("Saved the current state of atlas to browser");
            setShowToast(true);
        } catch (err) {
            console.error("Failed to save to localStorage", err);
            setToastMessage("Failed to save state");
            setShowToast(true);
        }
    };

    const handleDownloadPear = () => {
        if (!activeTab || !activeTab.data) return;

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
            setIsDownloadOpen(false);
            setToastMessage("Downloaded .pear file");
            setShowToast(true);
        } catch (err) {
            console.error("Failed to download pear file", err);
            setToastMessage("Failed to download file");
            setShowToast(true);
        }
    };

    const getNodesBounds = (nodes: ReactFlowNode[]) => {
        if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            const x = n.position.x;
            const y = n.position.y;
            // Fallback dimensions if unmeasured
            const w = n.measured?.width ?? n.width ?? 200;
            const h = n.measured?.height ?? n.height ?? 50;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
        });
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    };

    const handleDownloadImage = async () => {
        // Target the viewport to get content, not the container which clips
        const viewportNode = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!viewportNode || !activeTab?.layout?.nodes) return;

        try {
            const nodes = activeTab.layout.nodes;
            const bounds = getNodesBounds(nodes);
            const padding = 50;
            const width = bounds.width + (padding * 2);
            const height = bounds.height + (padding * 2);

            const dataUrl = await htmlToImage.toPng(viewportNode, {
                backgroundColor: 'transparent',
                width: width,
                height: height,
                style: {
                    width: `${width}px`,
                    height: `${height}px`,
                    transform: `translate(${(-bounds.x + padding)}px, ${(-bounds.y + padding)}px) scale(1)`,
                },
                pixelRatio: 4, // 2k+ resolution
                filter: (node) => {
                    // Filter out background and controls if they are somehow inside viewport (usually they are siblings, but good safety)
                    // Note: controls are usually outside viewport, background is sibling. 
                    // Since we target viewport, we only get nodes/edges.
                    // But we want to be safe if structure changes.
                    if (node.classList && (
                        node.classList.contains('react-flow__controls') ||
                        node.classList.contains('react-flow__background') ||
                        node.classList.contains('react-flow__panel')
                    )) {
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
            setToastMessage("Downloaded Atlas image");
            setShowToast(true);
        } catch (err) {
            console.error("Failed to generate image", err);
            setToastMessage("Failed to generate image");
            setShowToast(true);
        }
    };

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                downloadMenuRef.current &&
                event.target instanceof Node &&
                !downloadMenuRef.current.contains(event.target) &&
                mobileDownloadMenuRef.current &&
                !mobileDownloadMenuRef.current.contains(event.target)
            ) {
                setIsDownloadOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Use useCallback to prevent infinite loops in AtlasGraph
    const handleLayoutChange = useCallback((nodes: ReactFlowNode[], edges: Edge[]) => {
        setTabs(prev => {
            // Find active tab inside setter to avoid dependency on activeTabId if possible, 
            // but we need activeTabId.
            // Actually, we can just use the state updater pattern if we depend on activeTabId
            return prev.map(tab => {
                if (tab.id === activeTabId) {
                    // Only update if layout actually changed to avoid cycles? 
                    // For now, react state updates are cheap enough if references are stable enough
                    return { ...tab, layout: { nodes, edges } };
                }
                return tab;
            });
        });
    }, [setTabs, activeTabId]);

    const activeTab = useMemo(() =>
        tabs.find(t => t.id === activeTabId) || null
        , [tabs, activeTabId]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        setError(null);

        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    // Load saved state on mount
    useEffect(() => {
        const saved = localStorage.getItem('peargent_atlas_tabs');
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            processFile(e.target.files[0]);
            // Reset input so same file can be selected again if needed
            e.target.value = '';
        }
    };

    const processFile = (file: File) => {
        if (!file.name.endsWith(".pear") && !file.name.endsWith(".json")) {
            setError("Please upload a valid .pear file");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                // Basic validation
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
            } catch (err) {
                setError("Failed to parse file. Is it valid JSON?");
            }
        };
        reader.readAsText(file);
    };

    const closeTab = (e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();
        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);

        if (activeTabId === tabId) {
            // If we closed the active tab, switch to the last one, or null
            setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
        }
    };


    return (
        <div
            className="h-screen w-full bg-background text-foreground flex overflow-hidden relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Desktop Sidebar - Visible on md+ */}
            <div className="hidden md:flex h-full z-30 shrink-0">
                <AtlasSidebar
                    data={activeTab?.data || null}
                    selectedId={selectedNodeId}
                    onSelect={setSelectedNodeId}
                />
            </div>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="fixed inset-0 backdrop-blur-[4px] z-50 md:hidden"
                        />
                        {/* Sidebar Drawer */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 right-0 z-50 h-full w-[85vw] max-w-[350px] shadow-2xl md:hidden"
                        >
                            <AtlasSidebar
                                data={activeTab?.data || null}
                                selectedId={selectedNodeId}
                                className="border-l border-r-0 h-full w-full bg-background/95 backdrop-blur-[0px]"
                                hideLogo={true}
                                onClose={() => setIsSidebarOpen(false)}
                                onSelect={(id) => {
                                    setSelectedNodeId(id);
                                    setIsSidebarOpen(false); // Close on selection
                                }}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <div className="flex-1 relative h-full flex flex-col min-w-0">

                {/* Toast Notification */}
                <Toast
                    message={toastMessage}
                    isVisible={showToast}
                    onClose={() => setShowToast(false)}
                />

                {/* Mobile Floating Action Buttons (Bottom Right) */}
                <div className="fixed bottom-4 right-4 z-30 flex flex-col gap-3 md:hidden">
                    <div className="relative" ref={mobileDownloadMenuRef}>
                        <AnimatePresence>
                            {isDownloadOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                    className="absolute bottom-14 right-0 min-w-[180px] bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl flex flex-col p-1.5 z-50 origin-bottom-right"
                                >
                                    <button
                                        onClick={handleDownloadPear}
                                        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 rounded-lg text-sm transition-colors text-left"
                                    >
                                        <div className="p-1 rounded bg-primary/10 text-primary">
                                            <FileJson className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium">.pear</span>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Source File</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={handleDownloadImage}
                                        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 rounded-lg text-sm transition-colors text-left"
                                    >
                                        <div className="p-1 rounded bg-blue-500/10 text-blue-500">
                                            <ImageIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium">Image</span>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">PNG Format</span>
                                        </div>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsDownloadOpen(!isDownloadOpen);
                            }}
                            className="flex items-center justify-center w-12 h-12 bg-card border border-border rounded-xl shadow-lg hover:bg-secondary/80 text-foreground transition-all active:scale-95"
                            title="Download"
                        >
                            <Download className="w-5 h-5 opacity-90" />
                        </button>
                    </div>
                    <button
                        onClick={handleSave}
                        className="flex items-center justify-center w-12 h-12 bg-card border border-border rounded-xl shadow-lg hover:bg-secondary/80 text-foreground transition-all active:scale-95"
                        title="Save"
                    >
                        <Save className="w-5 h-5 opacity-90" />
                    </button>
                </div>

                {/* Top Bar: Tabs & Actions */}
                <div className="border-b border-border bg-card/50 backdrop-blur-sm flex flex-col md:flex-row items-center px-4 gap-2 z-40 shrink-0 md:h-14 md:py-0 transition-all">

                    {/* Mobile Header Row: Logo + Menu */}
                    <div className="flex items-center justify-between w-full md:hidden mb-1 md:mb-0 mt-2">
                        {/* Mobile Logo */}
                        <div className="">
                            <span className="font-semibold text-foreground leading-none pt-1" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontSize: '2.1rem' }}>
                                peargent.
                            </span>
                            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium pl-0.5">Atlas</span>
                        </div>
                        {/* Mobile Menu Trigger */}
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 -mr-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                        >
                            <PanelLeft className="w-4.5 h-4.5" />
                        </button>
                    </div>
                    <div className="border w-screen h-px md:hidden" />

                    {/* Tabs Scroll Area */}
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
                                            className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-10"
                                        />
                                    )}
                                    <button
                                        onClick={(e) => closeTab(e, tab.id)}
                                        className={cn(
                                            "p-0.5 rounded-md hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity",
                                            activeTabId === tab.id && "opacity-100" // Always show close on active
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

                    {/* Fixed Right Actions - Desktop Only */}
                    <div className="hidden md:flex items-center h-full gap-0 bg-card/50 backdrop-blur-sm z-20">

                        {/* Action Buttons */}
                        <button
                            onClick={handleSave}
                            className="flex items-center justify-center w-fit p-4 h-full hover:bg-white/5 hover:text-foreground transition-all group border-r border-border/50 border-l"
                            title="Save"
                        >
                            <Save className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-all mr-2" />
                            <span className="">Save</span>
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
                                <span className="">Download</span>
                            </button>
                            <AnimatePresence>
                                {isDownloadOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                        className="absolute top-full right-0 mt-1 min-w-[180px] bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl flex flex-col p-1.5 z-50 origin-top-right"
                                    >
                                        <button
                                            onClick={handleDownloadPear}
                                            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 rounded-lg text-sm transition-colors text-left"
                                        >
                                            <div className="p-1 rounded bg-primary/10 text-primary">
                                                <FileJson className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium">.pear</span>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Source File</span>
                                            </div>
                                        </button>
                                        <button
                                            onClick={handleDownloadImage}
                                            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 rounded-lg text-sm transition-colors text-left"
                                        >
                                            <div className="p-1 rounded bg-blue-500/10 text-blue-500">
                                                <ImageIcon className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium">Image</span>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">PNG Format</span>
                                            </div>
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                </div>

                {/* Graph Area */}
                <div className="flex-1 relative bg-background/50 overflow-hidden">
                    {/* We key the graph by tab ID so it fully remounts/resets state when switching. 
                        Alternatively, we could pass new data and let it update, but a key reset ensures clean slate. */}
                    <AtlasGraph
                        key={activeTabId || 'empty'}
                        data={activeTab?.data || null}
                        selectedNodeId={selectedNodeId}
                        onNodeSelect={(id) => {
                            setSelectedNodeId(id);
                            setIsDownloadOpen(false); // Close dropdown on interaction
                        }}
                        onPaneClick={() => setIsDownloadOpen(false)} // Close dropdown on background click
                        defaultLayout={activeTab?.layout}
                        onLayoutChange={handleLayoutChange}
                    />

                    {/* Empty State Overlay (only if no tabs) */}
                    <AnimatePresence>
                        {(tabs.length === 0 && !isDragging) && (
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
                                    {/* <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center mx-auto mb-8 border border-white/10 group-hover:scale-105 group-hover:rotate-3 transition-all duration-500 shadow-xl shadow-primary/5">
                                        <TreeDeciduous className="w-10 h-10 text-primary opacity-80 group-hover:opacity-100 transition-all duration-500" />
                                    </div> */}
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
                                    <div className="text-center transform duration-200">
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
