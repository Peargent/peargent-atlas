import React from 'react';
import { Sparkles, FolderOpen, Bot, Database, Wrench, Network } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTheme } from 'next-themes';

interface WelcomeScreenProps {
    title: React.ReactNode;
    subtitle?: string;
    onNewProject: () => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTutorial: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    title,
    subtitle = "Visual builder for AI agent systems",
    onNewProject,
    onImport,
    onTutorial
}) => {
    const { resolvedTheme } = useTheme();
    const borderClass = resolvedTheme === 'dark' ? 'border-border' : 'border-border';
    const [isExampleHovered, setIsExampleHovered] = React.useState(false);

    return (
        <div className="absolute inset-0 z-10 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center py-8">
                <div className="text-center w-full max-w-5xl mx-auto px-4">
                    <div className="max-w-md mx-auto">
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
                        <div className="mt-6 mb-8 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
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

                    {/* How to use Atlas Section */}
                    <div className="mt-4 text-left animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                        <h3 className="text-3xl text-center mb-2 text-foreground/80" style={{ fontFamily: 'var(--font-instrument-serif), serif' }}>
                            How to use Atlas
                        </h3>
                        <p className="text-center text-muted-foreground mb-4 text-sm max-w-2xl mx-auto">
                            Connect the nodes below to design custom AI agents and orchestrate unique, powerful workflows.
                        </p>
                        <p className="text-center text-muted-foreground mb-8 text-xs opacity-70">
                            Click on the <span
                                className="underline cursor-pointer hover:text-primary transition-colors"
                                onMouseEnter={() => setIsExampleHovered(true)}
                                onMouseLeave={() => setIsExampleHovered(false)}
                                // onClick={onTutorial}
                            >Example</span> to load simple example and understand <span className="text-primary">Atlas</span>
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
    );
};
