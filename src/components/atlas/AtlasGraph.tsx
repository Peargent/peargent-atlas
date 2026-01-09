"use client";

import { useMemo, useEffect, useState, useRef } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, BackgroundVariant, useReactFlow, SelectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNode, RouterNode, ToolNode, PoolNode, HistoryNode } from './CustomNodes';
import { parsePearData } from './layout';
import { Node, Edge, Connection, OnConnect } from '@xyflow/react';
import { ContextMenu, ContextMenuItem } from '../ui/ContextMenu';
import { Bot, Plus, Wrench, Network, History, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';

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
    onAddPool,
    onDeleteNode,
    onConnectHistoryToParent,
    onConnectRouterToPool,
    nodePositions,
    onNodePositionChange
}: {
    data: any,
    selectedNodeId?: string | null,
    onNodeSelect?: (id: string) => void,
    onNodeClick?: (nodeData: any, nodeType: 'agent' | 'router' | 'tool' | 'pool' | 'history') => void,
    onPaneClick?: () => void,
    defaultLayout?: { nodes: Node[], edges: Edge[] },
    onLayoutChange?: (nodes: Node[], edges: Edge[]) => void,
    onAddAgent?: (id?: string | undefined, position?: { x: number, y: number }) => void;
    onAddTool?: (id?: string | undefined, position?: { x: number, y: number }) => void;
    onConnectToolToAgent?: (toolId: string, agentId: string, position?: { x: number, y: number }) => void;
    onConnectAgentToParent?: (agentId: string, parentId: string, position?: { x: number, y: number }) => void;
    onAddRouter?: (position?: { x: number, y: number }) => void;
    onAddHistory?: (id?: string | undefined, position?: { x: number, y: number }) => void;
    onAddPool?: (position?: { x: number, y: number }) => void;
    onDeleteNode?: (id: string) => void;
    onConnectHistoryToParent?: (historyId: string, parentId: string, position?: { x: number, y: number }) => void;
    onConnectRouterToPool?: (routerId: string, poolId: string, position?: { x: number, y: number }) => void;
    nodePositions?: Record<string, { x: number, y: number }>;
    onNodePositionChange?: (nodeId: string, position: { x: number, y: number }) => void;
}) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[] } | null>(null);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    // Track mobile state
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Initialize: Use defaultLayout if available, otherwise parse raw data
    useEffect(() => {
        if (defaultLayout) {
            setNodes(defaultLayout.nodes);
            setEdges(defaultLayout.edges);
        } else if (data) {
            const { nodes: layoutedNodes, edges: layoutedEdges } = parsePearData(data, nodePositions);
            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When data changes (after edits), update node data while preserving positions
    useEffect(() => {
        if (!data) return;

        // Parse fresh data
        const { nodes: freshNodes, edges: freshEdges } = parsePearData(data, nodePositions);

        setNodes(currentNodes => {
            const currentNodeMap = new Map(currentNodes.map(n => [n.id, n]));

            // Helper: Find a tool node in currentNodes that might correspond to a new tool ID
            // This handles the case where tool ID changes from unassigned to assigned
            const findPreviousToolPosition = (newToolId: string): { x: number, y: number } | null => {
                // For assigned tools (agent-X-tool-Y), check if there's an unassigned tool with the same data
                if (newToolId.includes('-tool-') && !newToolId.startsWith('tool-unassigned-')) {
                    // Look for any unassigned tool that might have been moved
                    for (const [id, node] of currentNodeMap) {
                        if (id.startsWith('tool-unassigned-') &&
                            node.position && (node.position.x !== 0 || node.position.y !== 0)) {
                            // Found a potential previous tool - use its position
                            return node.position;
                        }
                    }
                }
                return null;
            };

            // Merge fresh data with existing positions
            const mergedNodes = freshNodes.map(freshNode => {
                const existing = currentNodeMap.get(freshNode.id);

                // Check if there's a custom position for this node
                const customPosition = nodePositions?.[freshNode.id];

                if (existing) {
                    return {
                        ...freshNode, // Use fresh node (including data and originalData)
                        position: customPosition || existing.position, // Prefer custom, then existing
                        data: {
                            ...freshNode.data,
                        }
                    };
                }

                // For new nodes, apply custom position if available
                if (customPosition) {
                    return {
                        ...freshNode,
                        position: customPosition
                    };
                }

                // For new tool nodes, try to find position from previous tool ID
                if (freshNode.type === 'tool') {
                    const prevPosition = findPreviousToolPosition(freshNode.id);
                    if (prevPosition) {
                        return {
                            ...freshNode,
                            position: prevPosition
                        };
                    }
                }

                // Helper: Find a history node in currentNodes that might correspond to a new history ID
                if (freshNode.type === 'history') {
                    // For assigned history (X-history), check if there's an unassigned history
                    if (freshNode.id.endsWith('-history') && !freshNode.id.startsWith('history-unassigned-')) {
                        for (const [id, node] of currentNodeMap) {
                            if (id.startsWith('history-unassigned-') &&
                                node.position && (node.position.x !== 0 || node.position.y !== 0)) {
                                return {
                                    ...freshNode,
                                    position: node.position
                                };
                            }
                        }
                    }
                }

                return freshNode;
            });
            return mergedNodes;
        });

        setEdges(freshEdges);
    }, [data, nodePositions, setNodes, setEdges]);

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
                // Preserve the tool's current manual position when linking Agent -> Tool
                onConnectToolToAgent(targetNode.id, sourceNode.id, targetNode.position);
                return;
            } else if (sourceNode.type === 'tool' && targetNode.type === 'agent') {
                onConnectToolToAgent(sourceNode.id, targetNode.id, sourceNode.position);
                return;
            }
        }

        // Scenario 2: Agent -> Pool/Router (Connecting unassigned agent)
        if (onConnectAgentToParent) {
            // Drag from Agent to Pool/Router
            if (sourceNode.type === 'agent' && (targetNode.type === 'pool' || targetNode.type === 'router')) {
                onConnectAgentToParent(sourceNode.id, targetNode.id, sourceNode.position);
                return;
            }
            // Drag from Pool/Router to Agent
            if ((sourceNode.type === 'pool' || sourceNode.type === 'router') && targetNode.type === 'agent') {
                onConnectAgentToParent(targetNode.id, sourceNode.id, targetNode.position);
                return;
            }
        }

        // Scenario 3: History -> Pool/Agent (Connecting unassigned history)
        if (onConnectHistoryToParent) {
            // Drag from History to Parent
            if (sourceNode.type === 'history' && (targetNode.type === 'pool' || targetNode.type === 'agent')) {
                onConnectHistoryToParent(sourceNode.id, targetNode.id, sourceNode.position);
                return;
            }
            // Drag from Parent to History
            if ((sourceNode.type === 'pool' || sourceNode.type === 'agent') && targetNode.type === 'history') {
                onConnectHistoryToParent(targetNode.id, sourceNode.id);
                return;
            }
        }

        // Scenario 4: Router -> Pool (Connecting unassigned router)
        if (onConnectRouterToPool) {
            // Drag from Router to Pool
            if (sourceNode.type === 'router' && targetNode.type === 'pool') {
                onConnectRouterToPool(sourceNode.id, targetNode.id, sourceNode.position);
                return;
            }
            // Drag from Pool to Router
            if (sourceNode.type === 'pool' && targetNode.type === 'router') {
                onConnectRouterToPool(targetNode.id, sourceNode.id, targetNode.position);
                return;
            }
        }
    };

    // Handle Deletion (Backspace/Delete key) - passes all IDs at once for proper bulk delete
    const onNodesDelete = (deletedNodes: Node[]) => {
        if (!onDeleteNode) return;
        // Pass all node IDs at once for batched state update
        const idsToDelete = deletedNodes.map(node => node.id);
        if (idsToDelete.length > 0) {
            onDeleteNode(idsToDelete as any); // Cast needed since handler accepts string | string[]
        }
    };

    // Handle node drag stop to persist manual position changes
    const handleNodeDragStop = (_event: React.MouseEvent, node: Node) => {
        if (onNodePositionChange && node.position) {
            onNodePositionChange(node.id, node.position);
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

    const reactFlowInstanceRef = useRef<any>(null);

    const handlePaneContextMenu = (event: React.MouseEvent | MouseEvent) => {
        event.preventDefault();

        // Use screenToFlowPosition to get the correct flow coordinate
        let clickPosition: { x: number, y: number } | undefined;
        if (reactFlowInstanceRef.current) {
            clickPosition = reactFlowInstanceRef.current.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });
        }

        // Build global menu items
        const items: ContextMenuItem[] = [];

        if (onAddAgent) {
            items.push({
                label: 'Add Agent',
                icon: Bot,
                onClick: () => onAddAgent(undefined, clickPosition),
                shortcut: 'A'
            });
        }

        if (onAddTool) {
            items.push({
                label: 'Add Tool',
                icon: Wrench,
                onClick: () => onAddTool(undefined, clickPosition),
                shortcut: 'T'
            });
        }

        if (onAddRouter) {
            items.push({
                label: 'Add Router',
                icon: Network,
                onClick: () => onAddRouter(clickPosition),
                shortcut: 'R'
            });
        }

        if (onAddPool) {
            items.push({
                label: 'Add Pool',
                icon: Plus,
                onClick: () => onAddPool(clickPosition),
                shortcut: 'P'
            });
        }

        if (onAddHistory) {
            items.push({
                label: 'Add History',
                icon: History,
                onClick: () => onAddHistory(undefined, clickPosition),
                shortcut: 'H'
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
            if (onDeleteNode) items.push({ label: 'Delete', icon: Trash2, onClick: () => onDeleteNode(node.id), shortcut: 'Del', danger: true });

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
        <div ref={reactFlowWrapper} className="w-full h-full text-foreground">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodesDelete={onNodesDelete}
                onConnect={onConnect}
                onNodeDragStop={handleNodeDragStop}
                nodeTypes={nodeTypes}
                onInit={(instance) => { reactFlowInstanceRef.current = instance; }}
                fitView
                className="bg-transparent"
                minZoom={0.2}
                maxZoom={1.5}
                selectionOnDrag={!isMobile}
                panOnDrag={isMobile ? true : [1, 2]}
                selectionMode={SelectionMode.Partial}
                deleteKeyCode={['Backspace', 'Delete']}
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
                            // if (selectedNodeId !== 'pool-root') {
                            onDeleteNode(selectedNodeId);
                            // }
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
                <Controls
                    className={cn(
                        "bg-card border border-border text-foreground [&>button]:!bg-card [&>button]:!border-border [&>button:hover]:!bg-secondary transition-all duration-300",
                        isMobile && selectedNodeId && "!bottom-[80px]"
                    )}
                />
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
