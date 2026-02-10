
import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Network, Wrench, Database, History, Info, Type, User, Settings, AlertCircle, RefreshCw, Code, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface NodeHelpPanelProps {
    nodeType: 'agent' | 'router' | 'tool' | 'pool' | 'history' | null;
    onClose: () => void;
    isMobile?: boolean;
}

const HelpSection = ({ title, icon: Icon, children, color }: { title: string; icon: any; children: React.ReactNode; color: string }) => (
    <div className="space-y-2 mb-6 last:mb-0">
        <div className={cn("flex items-center gap-2 text-xs font-bold uppercase tracking-wider", color)}>
            <Icon className="w-3.5 h-3.5" />
            {title}
        </div>
        <div className="text-sm text-muted-foreground leading-relaxed pl-1">
            {children}
        </div>
    </div>
);

const HelpItem = ({ label, description }: { label: string; description: string }) => (
    <div className="mb-3 last:mb-0 bg-secondary/30 p-3 rounded-lg border border-border/50">
        <span className="block text-xs font-semibold text-foreground mb-1">{label}</span>
        <span className="block text-xs text-muted-foreground leading-normal">{description}</span>
    </div>
);

export const NodeHelpPanel = ({ nodeType, onClose, isMobile = false }: NodeHelpPanelProps) => {
    if (!nodeType) return null;

    const content = {
        agent: {
            title: 'Agent Configuration',
            description: 'Agents are the intelligent workers in your system. They use LLMs to process information and allow for tool execution.',
            color: 'text-blue-400',
            icon: Bot,
            sections: [
                {
                    title: 'Core Settings',
                    icon: Settings,
                    items: [
                        { label: 'Name', description: 'Unique identifier for this agent.' },
                        { label: 'Description', description: 'A brief explanation of what this agent does.' },
                        { label: 'Persona', description: 'The "brain" of the agent. This system prompt defines its role, behavior, and capabilities.' },
                        { label: 'Model', description: 'The underlying LLM (e.g., Llama 3) that powers the agent.' }
                    ]
                },
                {
                    title: 'Advanced',
                    icon: AlertCircle,
                    items: [
                        { label: 'Max Retries', description: 'Number of times to retry a failed model call.' },
                        { label: 'Tracing', description: 'Enable detailed logging of agent steps for debugging.' }
                    ]
                }
            ]
        },
        router: {
            // ... (router content matches previous state)
            title: 'Router Configuration',
            description: 'Routers direct incoming requests to the most appropriate agent or sub-router based on the user\'s intent.',
            color: 'text-purple-400',
            icon: Network,
            sections: [
                {
                    title: 'Router Info',
                    icon: Info,
                    items: [
                        { label: 'Name', description: 'Unique identifier for this router.' },
                        { label: 'Router Type', description: 'Mechanism for routing (e.g., Round Robin, LLM-based Routing Agent).' },
                        { label: 'Description', description: 'Purpose of this router (Routing Agent only).' },
                        { label: 'Persona', description: 'Instructions for the routing logic (Routing Agent only).' }
                    ]
                },
                {
                    title: 'Configuration',
                    icon: Settings,
                    items: [
                        { label: 'Model Provider', description: 'The LLM provider for the routing agent.' },
                        { label: 'Model Name', description: 'The specific model used for routing decisions.' },
                        { label: 'Tracing', description: 'Enable detailed logging for debugging.' }
                    ]
                }
            ]
        },
        tool: {
            title: 'Tool Configuration',
            description: 'Tools are Python functions that agents can execute to perform actions, fetch data, or compute values.',
            color: 'text-amber-400',
            icon: Wrench,
            sections: [
                {
                    title: 'Definition',
                    icon: Code,
                    items: [
                        { label: 'Name', description: 'Function name used by the agent to call this tool.' },
                        { label: 'Description', description: 'Explanation of when and how the agent should use this tool.' },
                        { label: 'Function Body', description: 'The actual Python code. Must define arguments and return a string.' },

                    ]
                },
                {
                    title: 'Retry Configuration',
                    icon: RefreshCw,
                    items: [
                        { label: 'Max Retries', description: 'Maximum number of retry attempts for failed executions.' },
                        { label: 'Retry Delay', description: 'Time in seconds to wait between retry attempts.' },
                        { label: 'Timeout', description: 'Maximum execution time in seconds before cancelling.' },
                        { label: 'On Error', description: 'Action to take when the tool fails (e.g., Fail, Ignore).' },
                        { label: 'Retry Backoff', description: 'Exponentially increase delay between retries to prevent flooding.' }
                    ]
                }
            ]
        },
        pool: {
            title: 'Pool Configuration',
            description: 'The Pool acts as the root container and orchestrator for your agent system.',
            color: 'text-emerald-400',
            icon: Database,
            sections: [
                {
                    title: 'Model Configuration',
                    icon: Bot,
                    items: [
                        { label: 'Model Provider', description: 'The LLM provider (e.g., Groq, OpenAI) used for the pool\'s operations.' },
                        { label: 'Model Name', description: 'The specific model identifier (e.g., llama-3.3-70b-versatile).' }
                    ]
                },
                {
                    title: 'Orchestration',
                    icon: Settings,
                    items: [
                        { label: 'Max Iterations', description: 'Maximum number of steps the entire system can take for a single query to prevent infinite loops.' },
                        { label: 'Tracing', description: 'Global switch to enable/disable tracing for all agents in the pool.' }
                    ]
                }
            ]
        },
        history: {
            title: 'History Configuration',
            description: 'Manages how conversation memory is stored and retrieved across sessions.',
            color: 'text-pink-400',
            icon: History,
            sections: [
                {
                    title: 'Storage',
                    icon: Database,
                    items: [
                        { label: 'Store Type', description: 'Backend for storing messages (SQLite, File, Redis, etc.).' },
                        { label: 'Connection', description: 'Paths or connection strings for the selected storage backend.' }
                    ]
                },
                {
                    title: 'Context Window',
                    icon: Settings,
                    items: [
                        { label: 'Strategy', description: 'How to manage long conversations (e.g., sliding window, summarization).' }
                    ]
                }
            ]
        }
    };

    const activeContent = content[nodeType];
    const Icon = activeContent.icon;

    return (
        <motion.div
            initial={{ opacity: 0, x: isMobile ? 20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isMobile ? 20 : 20 }}
            className={cn(
                "absolute top-0 h-full bg-background/95 backdrop-blur-xl shadow-2xl z-[60] flex flex-col",
                isMobile
                    ? "inset-0 w-full border-none"
                    : "right-[100%] w-[300px] border-l border-y border-border mr-[1px]"
            )}
        >
            {/* Header */}
            <div className={cn(
                "p-4 border-b border-border bg-card/50 relative",
                isMobile && "border-none bg-transparent p-4" // Remove border/bg on mobile
            )}>
                <div className="flex items-start justify-between mb-2">
                    <div className={cn("flex items-center gap-3", !isMobile && "pr-6")}>
                        <div className={cn("p-2 rounded-lg bg-background border border-border", activeContent.color)}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="font-bold text-foreground">{activeContent.title}</div>
                    </div>
                    <button
                        onClick={onClose}
                        className={cn(
                            "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors",
                            !isMobile && "absolute top-2 right-2"
                        )}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    {activeContent.description}
                </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {activeContent.sections.map((section, idx) => (
                    <HelpSection key={idx} title={section.title} icon={section.icon} color={activeContent.color}>
                        <div className="space-y-2 mt-2">
                            {section.items.map((item, i) => (
                                <HelpItem key={i} label={item.label} description={item.description} />
                            ))}
                        </div>
                    </HelpSection>
                ))}
            </div>

            <div className="p-4 border-t border-border bg-card/30 text-[10px] text-muted-foreground text-center">
                Review specific parameters for {nodeType}
            </div>
        </motion.div>
    );
};
