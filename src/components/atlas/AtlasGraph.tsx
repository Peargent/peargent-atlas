"use client";

import { useMemo, useEffect } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNode, RouterNode, ToolNode, PoolNode } from './CustomNodes';
import { parsePearData } from './layout';
import { Node, Edge } from '@xyflow/react';

const nodeTypes = {
    agent: AgentNode,
    router: RouterNode,
    tool: ToolNode,
    pool: PoolNode,
};

export default function AtlasGraph({
    data,
    selectedNodeId,
    onNodeSelect,
    onPaneClick,
    defaultLayout,
    onLayoutChange
}: {
    data: any,
    selectedNodeId?: string | null,
    onNodeSelect?: (id: string) => void,
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
                    setNodes((nds) =>
                        nds.map((n) => {
                            if (n.id === node.id) {
                                return { ...n, data: { ...n.data, expanded: !n.data.expanded } };
                            }
                            return n;
                        })
                    );
                }}
                onPaneClick={() => {
                    onNodeSelect?.(''); // Deselect
                    onPaneClick?.();
                    setNodes((nds) =>
                        nds.map((n) => ({ ...n, data: { ...n.data, expanded: false } }))
                    );
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
