"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, BackgroundVariant, useReactFlow, SelectionMode, getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNode, RouterNode, ToolNode, PoolNode, HistoryNode } from './CustomNodes';
import { parsePearData } from './layout';
import { Node, Edge, Connection, OnConnect, EdgeProps } from '@xyflow/react';
import { ContextMenu, ContextMenuItem } from '../ui/ContextMenu';
import { Bot, Plus, Wrench, Network, History, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AnnotationNode, tutorialAnnotations, TutorialOverlay, getTutorialAnnotations } from './Tutorial';

// Custom Edge with Delete Button (shows on hover)
function DeletableEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
}: EdgeProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const onDelete = data?.onDelete as ((edgeId: string) => void) | undefined;

    return (
        <g
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Invisible wider path for easier hover detection */}
            <path
                d={edgePath}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                style={{ cursor: 'pointer' }}
            />
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    strokeWidth: 2,
                    stroke: '#3b82f6',
                    strokeDasharray: '8,4',
                    ...style,
                }}
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity 0.15s ease',
                    }}
                    className="nodrag nopan"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete?.(id);
                        }}
                        className="w-6 h-6 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shadow-md hover:scale-110 border border-border"
                        title="Delete connection"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </EdgeLabelRenderer>
        </g>
    );
}

const nodeTypes = {
    agent: AgentNode,
    router: RouterNode,
    tool: ToolNode,
    pool: PoolNode,
    history: HistoryNode,
    annotation: AnnotationNode,
};

const edgeTypes = {
    deletable: DeletableEdge,
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
    onNodePositionChange,
    onDisconnect,
    isTutorial,
    initialViewport
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
    onDeleteNode?: (id: string | string[]) => void;
    onConnectHistoryToParent?: (historyId: string, parentId: string, position?: { x: number, y: number }) => void;
    onConnectRouterToPool?: (routerId: string, poolId: string, position?: { x: number, y: number }) => void;
    nodePositions?: Record<string, { x: number, y: number }>;
    onNodePositionChange?: (nodeId: string, position: { x: number, y: number }) => void;
    onDisconnect?: (sourceId: string, targetId: string) => void;
    isTutorial?: boolean;
    initialViewport?: { x: number, y: number, zoom: number };
}) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[] } | null>(null);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    // Use ref for onDisconnect to avoid infinite loops when creating edge handlers
    const onDisconnectRef = useRef(onDisconnect);
    useEffect(() => {
        onDisconnectRef.current = onDisconnect;
    }, [onDisconnect]);

    // Track nodePositions via ref for synchronous access during renders
    const nodePositionsRef = useRef(nodePositions);
    nodePositionsRef.current = nodePositions;

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

                // Check if there's a custom position for this node (use ref for latest value)
                const currentPositions = nodePositionsRef.current;
                const customPosition = currentPositions?.[freshNode.id];

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

                // For new tool nodes, try to find position from currentNodes
                // This handles cases where tool IDs changed (moved between agents or reindexed)
                if (freshNode.type === 'tool') {
                    // Match by tool identity (_id or name) to find the correct previous position
                    // This prevents tools from taking each other's positions during reconnection
                    const freshNodeIds = new Set(freshNodes.map(n => n.id));

                    // Extract identity from fresh node - try _id first (most reliable), then name
                    const freshToolId = (freshNode.data as any)?.originalData?._id;
                    const freshToolName = (freshNode.data as any)?.originalData?.name || freshNode.data?.name;

                    // Skip identity matching if we don't have any identity data
                    if (freshToolId || freshToolName) {
                        for (const [id, node] of currentNodeMap) {
                            if (node.type === 'tool' && !freshNodeIds.has(id) &&
                                node.position && (node.position.x !== 0 || node.position.y !== 0)) {
                                // Extract identity from current node
                                const currentToolId = (node.data as any)?.originalData?._id;
                                const currentToolName = (node.data as any)?.originalData?.name || node.data?.name;

                                // Match by _id first (most reliable), then by name as fallback
                                const idsMatch = freshToolId && currentToolId && freshToolId === currentToolId;
                                const namesMatch = !freshToolId && !currentToolId && freshToolName && currentToolName && freshToolName === currentToolName;

                                if (idsMatch || namesMatch) {
                                    // Found the same tool with a different ID - use its position
                                    return {
                                        ...freshNode,
                                        position: node.position
                                    };
                                }
                            }
                        }
                    }
                }

                // Helper: Find a history node in currentNodes that might correspond to a new history ID
                if (freshNode.type === 'history') {
                    // Match by history identity to find the correct previous position
                    const freshNodeIds = new Set(freshNodes.map(n => n.id));

                    // Extract identity - try _id first, then name
                    const freshHistoryId = (freshNode.data as any)?.originalData?._id;
                    const freshHistoryName = (freshNode.data as any)?.originalData?.name || freshNode.data?.name;

                    // Skip if no identity data
                    if (freshHistoryId || freshHistoryName) {
                        for (const [id, node] of currentNodeMap) {
                            if (node.type === 'history' && !freshNodeIds.has(id) &&
                                node.position && (node.position.x !== 0 || node.position.y !== 0)) {
                                // Extract identity from current node
                                const currentHistoryId = (node.data as any)?.originalData?._id;
                                const currentHistoryName = (node.data as any)?.originalData?.name || node.data?.name;

                                // Match by _id first, then by name as fallback
                                const idsMatch = freshHistoryId && currentHistoryId && freshHistoryId === currentHistoryId;
                                const namesMatch = !freshHistoryId && !currentHistoryId && freshHistoryName && currentHistoryName && freshHistoryName === currentHistoryName;

                                if (idsMatch || namesMatch) {
                                    // Found the same history with a different ID - use its position
                                    return {
                                        ...freshNode,
                                        position: node.position
                                    };
                                }
                            }
                        }
                    }
                }

                return freshNode;
            });
            // If in tutorial mode, append annotation nodes with responsive positioning
            if (isTutorial) {
                // Get annotations with screen-relative positions
                const responsiveAnnotations = typeof window !== 'undefined'
                    ? getTutorialAnnotations(window.innerWidth, window.innerHeight)
                    : tutorialAnnotations;

                const annotationNodes = responsiveAnnotations.map(annotation => ({
                    id: annotation.id,
                    type: 'annotation',
                    position: annotation.position,
                    data: {
                        text: annotation.text,
                        image: annotation.image,
                    },
                    draggable: false,
                    selectable: false,
                    connectable: false
                }));
                // Filter out any stale annotations from mergedNodes (unlikely but safe) and append new ones
                return [...mergedNodes.filter(n => !n.id.startsWith('annotation-')), ...annotationNodes];
            }

            return mergedNodes;
        });

        // Transform edges to use deletable type with delete handler
        const edgesWithDelete = freshEdges.map(edge => ({
            ...edge,
            type: 'deletable',
            data: {
                ...edge.data,
                onDelete: (edgeId: string) => {
                    const edgeToDelete = freshEdges.find(e => e.id === edgeId);
                    if (edgeToDelete && onDisconnectRef.current) {
                        onDisconnectRef.current(edgeToDelete.source as string, edgeToDelete.target as string);
                    }
                },
            }
        }));
        setEdges(edgesWithDelete);
        setEdges(edgesWithDelete);
    }, [data, nodePositions, setNodes, setEdges, isTutorial]);


    // Lift state up whenever nodes or edges change
    // We use a debounce or simple effect to notify parent
    useEffect(() => {
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
            onDeleteNode(idsToDelete);
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

    // Nodes display - removed tutorial freeze, now always normal
    const displayedNodes = useMemo(() => nodes, [nodes]);

    return (
        <div
            ref={reactFlowWrapper}
            className="w-full h-full text-foreground"
            onMouseDownCapture={(e) => {
                // No special handling needed
            }}
        >
            <ReactFlow
                nodes={displayedNodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodesDelete={onNodesDelete}
                onConnect={onConnect}
                onNodeDragStop={handleNodeDragStop}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onInit={(instance) => { reactFlowInstanceRef.current = instance; }}
                defaultViewport={initialViewport}
                fitView={!initialViewport}
                fitViewOptions={{ padding: 0.2, minZoom: 0.1, maxZoom: 1 }}
                className="bg-transparent"
                minZoom={0.2}
                maxZoom={1.5}
                selectionOnDrag={false}
                panOnDrag={true}
                preventScrolling={true}
                panActivationKeyCode={'Space'}
                translateExtent={undefined}
                nodesDraggable={true}
                nodesConnectable={true}
                zoomOnScroll={true}
                zoomOnPinch={true}
                zoomOnDoubleClick={true}
                panOnScroll={false}
                selectionMode={SelectionMode.Partial}
                deleteKeyCode={['Backspace', 'Delete']}
                onNodeClick={(event, node) => {
                    setContextMenu(null);
                    onNodeSelect?.(node.id);

                    // Open details sidebar with node data
                    const nodeType = node.type as 'agent' | 'router' | 'tool' | 'pool';
                    const originalData = (node.data as any).originalData || node.data;
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
                {(data || defaultLayout) && (
                    <Controls
                        className={cn(
                            "bg-card border border-border text-foreground [&>button]:!bg-card [&>button]:!border-border [&>button:hover]:!bg-secondary transition-all duration-300",
                            isMobile && selectedNodeId && "!bottom-[80px]"
                        )}
                    />
                )}

                {/* Tutorial overlay - inside ReactFlow for context access */}
                {isTutorial && <TutorialOverlay />}
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
