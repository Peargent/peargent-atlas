"use client";

import { useMemo, useEffect } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNode, RouterNode, ToolNode, PoolNode, HistoryNode } from './CustomNodes';
import { parsePearData } from './layout';
import { Node, Edge } from '@xyflow/react';

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
    onLayoutChange
}: {
    data: any,
    selectedNodeId?: string | null,
    onNodeSelect?: (id: string) => void,
    onNodeClick?: (nodeData: any, nodeType: 'agent' | 'router' | 'tool' | 'pool' | 'history') => void,
    onPaneClick?: () => void,
    defaultLayout?: { nodes: Node[], edges: Edge[] },
    onLayoutChange?: (nodes: Node[], edges: Edge[]) => void
}) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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
    }, [nodes, edges, onLayoutChange]);

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

    return (
        <div className="w-full h-full text-foreground">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                className="bg-transparent"
                minZoom={0.2}
                maxZoom={1.5}
                onNodeClick={(event, node) => {
                    onNodeSelect?.(node.id);

                    // Open details sidebar with node data
                    const nodeType = node.type as 'agent' | 'router' | 'tool' | 'pool';
                    const originalData = node.data.originalData || node.data;
                    // Inject ID so we can key the sidebar
                    const dataWithId = { ...originalData, _nodeId: node.id };
                    onNodeClick?.(dataWithId, nodeType);
                }}
                onPaneClick={() => {
                    onNodeSelect?.(''); // Deselect
                    onPaneClick?.();
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
        </div>
    );
}
