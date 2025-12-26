import dagre from 'dagre';
import { Node, Edge, Position } from '@xyflow/react';

const nodeDimensions: Record<string, { width: number, height: number }> = {
    pool: { width: 320, height: 140 },
    router: { width: 320, height: 140 },
    agent: { width: 320, height: 100 },
    tool: { width: 220, height: 80 },
    history: { width: 220, height: 80 },
    default: { width: 200, height: 80 }
};

const GRID_SIZE = 24;

const snapTo = (val: number) => {
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
};

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Split nodes into Layout-driven (Pool, Router, Agent) and Manual (Tools, History)
    // We treat 'tool' and 'history' type nodes as manually positioned
    const layoutNodes = nodes.filter(n => n.type !== 'tool' && n.type !== 'history');
    const toolNodes = nodes.filter(n => n.type === 'tool');
    const historyNodes = nodes.filter(n => n.type === 'history');

    dagreGraph.setGraph({ 
        rankdir: direction, 
        ranksep: 120, 
        nodesep: 80 
    });

    layoutNodes.forEach((node) => {
        const dim = nodeDimensions[node.type || 'default'] || nodeDimensions.default;
        dagreGraph.setNode(node.id, { width: dim.width, height: dim.height });
    });

    // Only add edges between layout nodes for Dagre calculation
    edges.forEach((edge) => {
         // Check if both source and target are in layoutNodes
        const sourceNode = layoutNodes.find(n => n.id === edge.source);
        const targetNode = layoutNodes.find(n => n.id === edge.target);
        if (sourceNode && targetNode) {
             dagreGraph.setEdge(edge.source, edge.target);
        }
    });

    dagre.layout(dagreGraph);

    // 1. Position Layout Nodes
    const positionedLayoutNodes = layoutNodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        
        // Dagre gives center coordinates, convert to top-left
        const x = snapTo(nodeWithPosition.x - nodeWithPosition.width / 2);
        const y = snapTo(nodeWithPosition.y - nodeWithPosition.height / 2);

        return {
            ...node,
            targetPosition: Position.Top,
            sourcePosition: Position.Bottom,
            position: { x, y },
        };
    });

    // 2. Position Tool Nodes (Vertical Stack under Agents)
    const positionedToolNodes = toolNodes.map(toolNode => {
        // Parse agent ID from tool ID (format: "agentId-tool-idx")
        // We need to parse strictly. We know how we generate them: `${agentId}-tool-${tIdx}`
        // So we can split by '-tool-'
        const parts = toolNode.id.split('-tool-');
        if (parts.length < 2) return toolNode; // Fallback
        
        const agentId = parts[0];
        const index = parseInt(parts[1], 10);
        
        const agentNode = positionedLayoutNodes.find(n => n.id === agentId);
        if (!agentNode) return toolNode;

        const agentDim = nodeDimensions.agent;
        const toolDim = nodeDimensions.tool;
        const verticalGap = 16;
        const startOffset = 40; // Gap between agent and first tool

        // Stack vertically
        const x = snapTo(agentNode.position.x + 20); // Indent slightly
        const y = snapTo(agentNode.position.y + agentDim.height + startOffset + (index * (toolDim.height + verticalGap)));

        return {
            ...toolNode,
            targetPosition: Position.Left, // Tools connect on the left
            sourcePosition: Position.Right,
            position: { x, y }
        };
    });

    // 3. Position History Nodes (To the right of their parent)
    const positionedHistoryNodes = historyNodes.map(historyNode => {
        // Parse parent ID from history ID (format: "parentId-history")
        const parts = historyNode.id.split('-history');
        if (parts.length < 1) return historyNode;
        
        const parentId = parts[0];
        const parentNode = positionedLayoutNodes.find(n => n.id === parentId);
        if (!parentNode) return historyNode;

        const parentDim = nodeDimensions[parentNode.type || 'default'] || nodeDimensions.default;
        const historyDim = nodeDimensions.history;
        const horizontalGap = 60;

        // Position to the right of parent
        const x = snapTo(parentNode.position.x + parentDim.width + horizontalGap);
        const y = snapTo(parentNode.position.y + (parentDim.height - historyDim.height) / 2);

        return {
            ...historyNode,
            targetPosition: Position.Left,
            sourcePosition: Position.Right,
            position: { x, y }
        };
    });

    return { 
        nodes: [...positionedLayoutNodes, ...positionedToolNodes, ...positionedHistoryNodes], 
        edges 
    };
};

export const parsePearData = (data: any) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Helper to add node
    const addNode = (type: string, data: any, id: string, parentId?: string, sourceHandle?: string) => {
        nodes.push({
            id,
            type,
            data: { 
                label: data.name, 
                ...data,
                originalData: data // Store the complete original data for details sidebar
            },
            position: { x: 0, y: 0 }, // Initial position
        });

        if (parentId) {
            edges.push({
                id: `e-${parentId}-${id}`,
                source: parentId,
                target: id,
                sourceHandle: sourceHandle || null, // null uses default handle
                type: 'smoothstep',
                animated: true,
                style: { stroke: getEdgeColor(type), strokeWidth: 2 },
            });
        }
    };

    const getEdgeColor = (targetType: string) => {
        switch (targetType) {
            case 'router': return '#a855f7'; // Purple
            case 'agent': return '#3b82f6'; // Blue
            case 'tool': return '#f59e0b'; // Amber
            case 'history': return '#ec4899'; // Pink
            default: return '#64748b';
        }
    };

    if (data.type === 'pool') {
        const poolId = 'pool-root';
        addNode('pool', data.data, poolId);

        // Handle Router
        if (data.data.router) {
            const routerId = 'router-main';
            addNode('router', data.data.router, routerId, poolId);
            
            // Handle Agents under Router
            if (data.data.agents) {
                data.data.agents.forEach((agent: any, idx: number) => {
                    const agentId = `agent-${idx}`;
                    addNode('agent', agent, agentId, routerId);

                    // Tools
                    if (agent.tools) {
                        agent.tools.forEach((tool: any, tIdx: number) => {
                             // Naming convention strictly used for layout positioning
                            const toolId = `${agentId}-tool-${tIdx}`;
                            addNode('tool', tool, toolId, agentId, 'left-tool-source');
                        });
                    }
                    // Agent-level history
                    if (agent.history) {
                        const historyId = `${agentId}-history`;
                        addNode('history', agent.history, historyId, agentId, 'right-history-source');
                    }
                });
            }
        } else if (data.data.agents) {
             // Direct Pool -> Agents if no router
             data.data.agents.forEach((agent: any, idx: number) => {
                const agentId = `agent-${idx}`;
                addNode('agent', agent, agentId, poolId);
                 // Tools
                 if (agent.tools) {
                    agent.tools.forEach((tool: any, tIdx: number) => {
                        const toolId = `${agentId}-tool-${tIdx}`;
                        addNode('tool', tool, toolId, agentId, 'left-tool-source');
                    });
                }
                // Agent-level history
                if (agent.history) {
                    const historyId = `${agentId}-history`;
                    addNode('history', agent.history, historyId, agentId, 'right-history-source');
                }
            });
        }

        // Pool-level history
        if (data.data.history) {
            const historyId = 'pool-root-history';
            addNode('history', data.data.history, historyId, poolId, 'right-history-source');
        }
    } else if (data.type === 'agent') {
         // Single Agent
         const agentId = 'agent-root';
         addNode('agent', data.data, agentId);
         if (data.data.tools) {
            data.data.tools.forEach((tool: any, tIdx: number) => {
                const toolId = `${agentId}-tool-${tIdx}`;
                addNode('tool', tool, toolId, agentId, 'left-tool-source');
            });
        }
    }

    return getLayoutedElements(nodes, edges);
};
