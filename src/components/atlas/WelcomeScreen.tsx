import React from 'react';
import { Sparkles, FolderOpen, Bot, Database, Wrench, Network } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTheme } from 'next-themes';
import PearIcon from '@/components/assets/pear.svg';

interface WelcomeScreenProps {
    title: React.ReactNode;
    subtitle?: string;
    onNewProject: () => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTutorial: () => void;
    projects?: any[]; // Using any[] to avoid strict type dependency for now, but should be AtlasTab[]
    onOpenProject?: (id: string) => void;
    onDeleteProject?: (id: string) => void;
}

// Helper to generate a simple thumbnail from project layout
const ProjectThumbnail = ({ layout }: { layout: { nodes: any[], edges: any[] } }) => {
    if (!layout?.nodes || layout.nodes.length === 0) {
        return (
            <div className="w-full h-full bg-muted/20 flex items-center justify-center">
                <div className="text-4xl opacity-10">Empty</div>
            </div>
        );
    }

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    layout.nodes.forEach(node => {
        const x = node.position.x;
        const y = node.position.y;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + 180); // Assume approx width
        maxY = Math.max(maxY, y + 100); // Assume approx height
    });

    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    // Scale to fit
    const viewBox = `${minX} ${minY} ${width} ${height}`;

    return (
        <svg viewBox={viewBox} className="w-full h-full bg-muted/5 pointer-events-none" preserveAspectRatio="xMidYMid meet">
            {/* Edges */}
            {layout.edges?.map((edge, i) => {
                const sourceNode = layout.nodes.find(n => n.id === edge.source);
                const targetNode = layout.nodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                return (
                    <line
                        key={i}
                        x1={sourceNode.position.x + 90}
                        y1={sourceNode.position.y + 50}
                        x2={targetNode.position.x + 90}
                        y2={targetNode.position.y + 50}
                        stroke="currentColor"
                        strokeOpacity="0.1"
                        strokeWidth="2"
                    />
                );
            })}

            {/* Nodes */}
            {layout.nodes.map((node, i) => {
                let color = "#64748b"; // default slate
                if (node.type === 'agent') color = "#3b82f6"; // blue
                if (node.type === 'tool') color = "#f59e0b"; // amber
                if (node.type === 'router') color = "#a855f7"; // purple
                if (node.type === 'pool') color = "#10b981"; // emerald
                if (node.type === 'history') color = "#ef4444"; // red

                return (
                    <rect
                        key={i}
                        x={node.position.x}
                        y={node.position.y}
                        width="180"
                        height="80"
                        rx="8"
                        fill={color}
                        fillOpacity="0.2"
                        stroke={color}
                        strokeWidth="2"
                    />
                );
            })}
        </svg>
    );
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    title,
    subtitle = "Visual builder for AI agent systems",
    onNewProject,
    onImport,
    projects = [],
    onOpenProject,
    onDeleteProject,
    onTutorial
}) => {
    const { resolvedTheme } = useTheme();
    const borderClass = resolvedTheme === 'dark' ? 'border-border' : 'border-border';
    const [isExampleHovered, setIsExampleHovered] = React.useState(false);
    // Default to collapsed if projects exist, expanded otherwise
    const [isHelpExpanded, setIsHelpExpanded] = React.useState(projects.length === 0);

    // Update expansion state when projects change
    React.useEffect(() => {
        if (projects.length > 0) {
            setIsHelpExpanded(false);
        } else {
            setIsHelpExpanded(true);
        }
    }, [projects.length]);

    return (
        <div className="absolute inset-0 z-10 overflow-y-auto">
            <div className="min-h-full flex flex-col items-center py-8 md:py-12">
                {/* Header Section - Centered */}
                <div className="text-center w-full max-w-md mx-auto px-4 mb-8">
                    {/* Header */}
                    <h1
                        className="text-5xl font-normal mb-3 text-foreground"
                        style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
                    >
                        {title}
                    </h1>
                    <p className="text-muted-foreground text-lg mb-10 font-light">
                        {subtitle}
                    </p>

                    {/* Dual Path Cards */}
                    <div className="grid grid-cols-2 gap-4 text-left">
                        {/* Start from Scratch */}
                        <button
                            onClick={onNewProject}
                            className="group w-full p-4 rounded-xl bg-gradient-to-br from-primary/10 to-emerald-500/10 border border-primary/20 hover:border-primary/40 hover:from-primary/15 hover:to-emerald-500/15 transition-all duration-300 flex flex-col justify-between h-[160px] relative overflow-hidden text-left items-start"
                        >
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform mb-3 relative z-10">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="font-semibold text-foreground mb-1">Create Atlas</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">Build your agent system visually, node by node</p>
                            </div>
                        </button>

                        {/* Import File */}
                        <label className="group w-full p-4 rounded-xl bg-card/50 border border-border hover:border-primary/30 hover:bg-card/80 transition-all duration-300 flex flex-col justify-between h-[160px] cursor-pointer relative overflow-hidden">
                            <input
                                type="file"
                                accept=".pear,.json"
                                onChange={onImport}
                                className="hidden"
                            />
                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform mb-3 relative z-10">
                                <FolderOpen className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="font-semibold text-foreground mb-1">Import .pear File</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">Load an existing agent configuration</p>
                            </div>
                        </label>
                    </div>

                    {/* Tutorial Button */}
                    <div className="mt-6 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                        <button
                            onClick={onTutorial}
                            className={cn(
                                "group relative px-6 py-3 rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 border border-primary/20 hover:border-primary/40",
                                isExampleHovered && "scale-105 border-primary/40"
                            )}
                        >
                            <div className={cn(
                                "absolute inset-0 bg-gradient-to-r from-primary/10 via-emerald-500/10 to-primary/10 transition-opacity opacity-50 group-hover:opacity-100",
                                isExampleHovered && "opacity-100"
                            )} />
                            <div className="relative flex items-center gap-3">
                                <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <span className="font-medium text-foreground text-sm" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontSize: '1.1rem' }}>
                                    Example
                                </span>
                                <span className={cn(
                                    "text-xs text-muted-foreground ml-1 font-normal opacity-70 group-hover:opacity-100 transition-opacity",
                                    isExampleHovered && "opacity-100"
                                )}>
                                    Click to load example
                                </span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Recent Projects Section - Full Width */}
                {projects.length > 0 && (
                    <div className="w-full max-w-6xl mx-auto px-4 md:px-8 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                        <div className="flex items-center justify-between mb-4 md:mb-6">
                            <h3 className="text-lg md:text-xl font-medium text-foreground flex items-center gap-2 md:gap-3">
                                <span style={{ fontFamily: 'var(--font-instrument-serif), serif' }}>Your Projects</span>
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 md:px-2.5 md:py-1 rounded-full font-medium">{projects.length}</span>
                            </h3>
                        </div>

                        {/* Mobile: Horizontal list layout */}
                        <div className="flex flex-col gap-2 md:hidden">
                            {[...projects].reverse().map((project) => (
                                <div key={project.id} className="group relative">
                                    <button
                                        onClick={() => onOpenProject?.(project.id)}
                                        className="w-full rounded-xl overflow-hidden border border-border/50 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 flex items-center gap-3 p-3 text-left"
                                    >
                                        {/* Small Thumbnail */}
                                        <div className="w-12 h-12 shrink-0 rounded-lg bg-gradient-to-br from-muted/20 to-muted/5 relative overflow-hidden flex items-center justify-center border border-border/30">
                                            {project.layout && project.layout.nodes?.length > 0 ? (
                                                <ProjectThumbnail layout={project.layout} />
                                            ) : (
                                                <img src={PearIcon.src || PearIcon} alt="Pear" className="w-5 h-5 opacity-40" style={{ filter: 'brightness(0) saturate(100%) invert(50%) sepia(80%) saturate(400%) hue-rotate(40deg) brightness(95%)' }} />
                                            )}
                                        </div>

                                        {/* Project Name */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm text-foreground truncate">
                                                {project.name}
                                            </div>
                                        </div>

                                        {/* Delete Button - Always visible on mobile */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteProject?.(project.id);
                                            }}
                                            className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
                                            title="Delete Project"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Desktop: Grid layout */}
                        <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {[...projects].reverse().map((project) => (
                                <div key={project.id} className="group relative">
                                    <button
                                        onClick={() => onOpenProject?.(project.id)}
                                        className="w-full rounded-2xl overflow-hidden border border-border/50 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-1 flex flex-col text-left"
                                    >
                                        {/* Thumbnail Area */}
                                        <div className="aspect-[16/10] w-full bg-gradient-to-br from-muted/20 to-muted/5 relative overflow-hidden">
                                            {project.layout ? (
                                                <div className="absolute inset-2">
                                                    <ProjectThumbnail layout={project.layout} />
                                                </div>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-emerald-500/10 flex items-center justify-center border border-primary/10">
                                                        <img src={PearIcon.src || PearIcon} alt="Pear" className="w-8 h-8 opacity-40" style={{ filter: 'brightness(0) saturate(100%) invert(50%) sepia(80%) saturate(400%) hue-rotate(40deg) brightness(95%)' }} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Gradient Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-60" />
                                        </div>

                                        {/* Footer Info */}
                                        <div className="p-4">
                                            <div className="font-semibold text-base text-foreground truncate">
                                                {project.name}
                                            </div>
                                        </div>
                                    </button>

                                    {/* Delete Button - Appears on hover */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteProject?.(project.id);
                                        }}
                                        className="absolute top-3 right-3 p-2 rounded-xl bg-background/80 backdrop-blur-md text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive z-20 border border-border/50 shadow-sm"
                                        title="Delete Project"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Collapsible How to use Atlas Section */}
                <div className="w-full max-w-5xl mx-auto px-4 mt-12 transition-all duration-500 ease-in-out">
                    <button
                        onClick={() => setIsHelpExpanded(!isHelpExpanded)}
                        className="flex items-center justify-center gap-3 w-full py-3 group"
                    >
                        <h3
                            className="text-2xl text-foreground/80 group-hover:text-foreground transition-colors"
                            style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
                        >
                            How to use Atlas
                        </h3>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={cn(
                                "transition-transform duration-300 text-muted-foreground group-hover:text-primary",
                                isHelpExpanded ? "rotate-180" : "rotate-0"
                            )}
                        >
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </button>

                    <div className={cn(
                        "grid transition-all duration-500 ease-in-out overflow-hidden",
                        isHelpExpanded ? "grid-rows-[1fr] opacity-100 mt-6" : "grid-rows-[0fr] opacity-0 mt-0"
                    )}>
                        <div className="min-h-0">
                            {/* Content Wrapper */}
                            <div className="text-left pt-2">
                                <p className="text-center text-muted-foreground mb-4 text-sm max-w-2xl mx-auto">
                                    Connect the nodes below to design custom AI agents and orchestrate unique, powerful workflows.
                                </p>
                                <p className="text-center text-muted-foreground mb-8 text-xs opacity-70">
                                    Click on the <span
                                        className="underline cursor-pointer hover:text-primary transition-colors"
                                        onMouseEnter={() => setIsExampleHovered(true)}
                                        onMouseLeave={() => setIsExampleHovered(false)}
                                        onClick={onTutorial}
                                    >Example</span> to load a simple example and understand <span className="text-primary">Atlas</span>
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                    {/* Agent Node */}
                                    <div className={cn("p-4 rounded-xl bg-card/30 border hover:bg-card/50 transition-colors", borderClass)}>
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3 text-blue-400">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                        <h4 className="text-sm font-semibold text-foreground mb-1">Agent Node</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Autonomous AI entity configured with a model and instructions to execute specific tasks.
                                        </p>
                                    </div>

                                    {/* Pool Node */}
                                    <div className={cn("p-4 rounded-xl bg-card/30 border hover:bg-card/50 transition-colors", borderClass)}>
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3 text-emerald-400">
                                            <Database className="w-4 h-4" />
                                        </div>
                                        <h4 className="text-sm font-semibold text-foreground mb-1">Pool Node</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Orchestration layer that manages multiple agents and delegates tasks efficiently.
                                        </p>
                                    </div>

                                    {/* Tool Node */}
                                    <div className={cn("p-4 rounded-xl bg-card/30 border hover:bg-card/50 transition-colors", borderClass)}>
                                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3 text-amber-400">
                                            <Wrench className="w-4 h-4" />
                                        </div>
                                        <h4 className="text-sm font-semibold text-foreground mb-1">Tool Node</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Custom Python functions that agents can execute to interact with external systems.
                                        </p>
                                    </div>

                                    {/* Router Node */}
                                    <div className={cn("p-4 rounded-xl bg-card/30 border hover:bg-card/50 transition-colors", borderClass)}>
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3 text-purple-400">
                                            <Network className="w-4 h-4" />
                                        </div>
                                        <h4 className="text-sm font-semibold text-foreground mb-1">Router Node</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Intelligent routing layer that directs user intent to the most appropriate agent.
                                        </p>
                                    </div>
                                </div>

                                {/* Export & Run */}
                                <div className={cn("rounded-xl bg-gradient-to-r from-primary/5 via-card/50 to-primary/5 border p-5 flex flex-col md:flex-row items-center gap-6 justify-between")}>
                                    <div className="flex gap-4 items-center">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                            <Sparkles className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-foreground">Export & Run</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Download your atlas as a .pear file and run it directly with the Peargent CLI.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="shrink-0 font-mono text-xs bg-muted px-3 py-1.5 rounded-md border border-border text-muted-foreground">
                                        peargent run my-agent.pear
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
