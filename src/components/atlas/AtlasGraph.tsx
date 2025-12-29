"use client";

import { useMemo, useEffect, useState } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNode, RouterNode, ToolNode, PoolNode, HistoryNode } from './CustomNodes';
import { parsePearData } from './layout';
import { Node, Edge, Connection, OnConnect } from '@xyflow/react';
import { ContextMenu, ContextMenuItem } from '../ui/ContextMenu';
import { Bot, Plus, Wrench, Network, History, Trash2 } from 'lucide-react';

const nodeTypes = {
    agent: AgentNode,
    router: RouterNode,
    tool: ToolNode,
    pool: PoolNode,
    history: HistoryNode,
};

export default function AtlasGraph({
    data,
    selectedNodeId,
    onNodeSelect,
    onNodeClick,
    onPaneClick,
    defaultLayout,
    onLayoutChange,
    onAddAgent,
    onAddTool,
    onConnectToolToAgent,
    onConnectAgentToParent,
    onAddRouter,
    onAddHistory,
    onDeleteNode
}: {
    data: any,
    selectedNodeId?: string | null,
    onNodeSelect?: (id: string) => void,
    onNodeClick?: (nodeData: any, nodeType: 'agent' | 'router' | 'tool' | 'pool' | 'history') => void,
    onPaneClick?: () => void,
    defaultLayout?: { nodes: Node[], edges: Edge[] },
    onLayoutChange?: (nodes: Node[], edges: Edge[]) => void
    onAddAgent?: (parentId?: string) => void;

    onAddTool?: (agentId?: string) => void;
    onConnectToolToAgent?: (toolId: string, agentId: string) => void;
    onConnectAgentToParent?: (agentId: string, parentId: string) => void;
    onAddRouter?: () => void;
    onAddHistory?: (parentId?: string) => void;
    onDeleteNode?: (id: string) => void;
}) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[] } | null>(null);

    // Initialize: Use defaultLayout if available, otherwise parse raw data
    useEffect(() => {
        if (defaultLayout) {
            setNodes(defaultLayout.nodes);
            setEdges(defaultLayout.edges);
        } else if (data) {
            const { nodes: layoutedNodes, edges: layoutedEdges } = parsePearData(data);
            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When data changes (after edits), update node data while preserving positions
    useEffect(() => {
        if (!data) return;

        // Parse fresh data
        const { nodes: freshNodes, edges: freshEdges } = parsePearData(data);

        setNodes(currentNodes => {
            const currentNodeMap = new Map(currentNodes.map(n => [n.id, n]));

            // Merge fresh data with existing positions
            const mergedNodes = freshNodes.map(freshNode => {
                const existing = currentNodeMap.get(freshNode.id);
                if (existing) {
                    return {
                        ...freshNode, // Use fresh node (including data and originalData)
                        position: existing.position, // Keep position info
                        data: {
                            ...freshNode.data,
                            // Preserve any runtime-only data if needed, but prioritize fresh data
                        }
                    };
                }
                return freshNode;
            });
            return mergedNodes;
        });

        setEdges(freshEdges);
    }, [data, setNodes, setEdges]);

    // Lift state up whenever nodes or edges change
    // We use a debounce or simple effect to notify parent
    useEffect(() => {
        if (nodes.length > 0 && onLayoutChange) {
            onLayoutChange(nodes, edges);
        }
        if (nodes.length > 0 && onLayoutChange) {
            onLayoutChange(nodes, edges);
        }
    }, [nodes, edges, onLayoutChange]);

    // Handle Manual Connections
    const onConnect: OnConnect = (connection: Connection) => {
        const source = connection.source;
        const target = connection.target;

        // Check types via nodes state
        const sourceNode = nodes.find(n => n.id === source);
        const targetNode = nodes.find(n => n.id === target);

        if (!sourceNode || !targetNode) return;

        // Scenario 1: Agent -> Tool (unlikely with handles) OR Tool -> Agent
        if (onConnectToolToAgent) {
            if (sourceNode.type === 'agent' && targetNode.type === 'tool') {
                onConnectToolToAgent(targetNode.id, sourceNode.id);
                return;
            } else if (sourceNode.type === 'tool' && targetNode.type === 'agent') {
                onConnectToolToAgent(sourceNode.id, targetNode.id);
                return;
            }
        }

        // Scenario 2: Agent -> Pool/Router (Connecting unassigned agent)
        if (onConnectAgentToParent) {
            // Drag from Agent to Pool/Router
            if (sourceNode.type === 'agent' && (targetNode.type === 'pool' || targetNode.type === 'router')) {
                onConnectAgentToParent(sourceNode.id, targetNode.id);
                return;
            }
            // Drag from Pool/Router to Agent
            if ((sourceNode.type === 'pool' || sourceNode.type === 'router') && targetNode.type === 'agent') {
                onConnectAgentToParent(targetNode.id, sourceNode.id);
                return;
            }
        }
    };

    // Handle External Selection
    useEffect(() => {
        setNodes((nds) =>
            nds.map((node) => ({
                ...node,
                data: {
                    ...node.data,
                    highlighted: node.id === selectedNodeId
                }
            }))
        );
    }, [selectedNodeId, setNodes]);

    const handlePaneContextMenu = (event: React.MouseEvent | MouseEvent) => {
        event.preventDefault();

        // Build global menu items
        const items: ContextMenuItem[] = [];

        if (onAddAgent) {
            items.push({
                label: 'Add Agent',
                icon: Bot,
                onClick: () => onAddAgent(), // No ID = Unassigned
                shortcut: 'A'
            });
        }

        if (onAddTool) {
            items.push({
                label: 'Add Tool',
                icon: Wrench,
                onClick: () => onAddTool(), // No ID = Global/Unassigned
                shortcut: 'T'
            });
        }

        if (onAddRouter) {
            items.push({
                label: 'Add Router',
                icon: Network,
                onClick: () => onAddRouter(), // No ID = Global
                shortcut: 'R'
            });
        }

        if (items.length > 0) {
            setContextMenu({
                x: event.clientX,
                y: event.clientY,
                items
            });
        }
    };

    const handleNodeContextMenu = (event: React.MouseEvent, node: Node) => {
        event.preventDefault();

        if (node.type === 'agent') {
            const items: ContextMenuItem[] = [];

            if (onAddTool) {
                items.push({
                    label: 'Add Tool',
                    icon: Wrench,
                    onClick: () => onAddTool(node.id),
                    shortcut: 'T'
                });
            }
            if (onAddHistory) {
                items.push({
                    label: 'Add History',
                    icon: History,
                    onClick: () => onAddHistory(node.id),
                    shortcut: 'H'
                });
            }
            if (onDeleteNode) {
                items.push({
                    label: 'Delete',
                    icon: Trash2,
                    onClick: () => onDeleteNode(node.id),
                    shortcut: 'Del',
                    danger: true
                });
            }

            setContextMenu({ x: event.clientX, y: event.clientY, items });

        } else if (node.type === 'pool') {
            // Pool Root - Can add children, but cannot delete itself
            const items: ContextMenuItem[] = [];

            if (onAddAgent) items.push({ label: 'Add Agent', icon: Bot, onClick: () => onAddAgent(node.id), shortcut: 'A' });
            if (onAddRouter) items.push({ label: 'Add Router', icon: Network, onClick: () => onAddRouter(), shortcut: 'R' });
            if (onAddHistory) items.push({ label: 'Add History', icon: History, onClick: () => onAddHistory('pool-root'), shortcut: 'H' });

            setContextMenu({ x: event.clientX, y: event.clientY, items });

        } else if (onDeleteNode) {
            // Generic fallback for other deletable nodes (Tool, History, Router)
            setContextMenu({
                x: event.clientX,
                y: event.clientY,
                items: [
                    {
                        label: 'Delete',
                        icon: Trash2,
                        onClick: () => onDeleteNode(node.id),
                        shortcut: 'Del',
                        danger: true
                    }
                ]
            });
        } else {
            setContextMenu(null);
        }
    };

    const handlePaneClick = () => {
        setContextMenu(null);
        onNodeSelect?.(''); // Deselect
        onPaneClick?.();
    };

    return (
        <div className="w-full h-full text-foreground">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                className="bg-transparent"
                minZoom={0.2}
                maxZoom={1.5}
                onNodeClick={(event, node) => {
                    setContextMenu(null);
                    onNodeSelect?.(node.id);

                    // Open details sidebar with node data
                    const nodeType = node.type as 'agent' | 'router' | 'tool' | 'pool';
                    const originalData = node.data.originalData || node.data;
                    // Inject ID so we can key the sidebar
                    const dataWithId = { ...originalData, _nodeId: node.id };
                    onNodeClick?.(dataWithId, nodeType);
                }}
                onPaneClick={handlePaneClick}
                onPaneContextMenu={handlePaneContextMenu}
                onNodeContextMenu={handleNodeContextMenu}
                onKeyDown={(e) => {
                    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && onDeleteNode) {
                        // Prevent backspace from navigating back
                        // Especially important if not in an input
                        const target = e.target as HTMLElement;
                        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                            e.preventDefault();
                            // Don't delete Pool Root 
                            if (selectedNodeId !== 'pool-root') {
                                onDeleteNode(selectedNodeId);
                            }
                        }
                    }
                }}
                defaultEdgeOptions={{ type: 'smoothstep' }}
                proOptions={{ hideAttribution: true }}
                snapToGrid={true}
                snapGrid={[24, 24]}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={24}
                    size={2}
                    color="currentColor"
                    className="opacity-[0.15]"
                />
                <Controls className="bg-card border border-border text-foreground [&>button]:!bg-card [&>button]:!border-border [&>button:hover]:!bg-secondary" />
            </ReactFlow>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
}
