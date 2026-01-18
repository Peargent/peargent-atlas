import dagre from 'dagre';
import { Node, Edge, Position } from '@xyflow/react';

export const nodeDimensions: Record<string, { width: number, height: number }> = {
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

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB', customPositions?: Record<string, { x: number, y: number }>) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Split nodes into Layout-driven (Pool, Router, Assigned Agent) and Manual (Tools, History, Unassigned Agents)
    // We treat 'tool', 'history' and 'unassigned agent' type nodes as manually positioned
    const isUnassignedAgent = (n: Node) => n.type === 'agent' && n.id.startsWith('agent-unassigned-');
    
    // Check if an agent has a manually set position (from dragging or manual placement)
    const hasManualPosition = (n: Node) => {
        if (customPositions && customPositions[n.id]) return true;
        return n.position && (n.position.x !== 0 || n.position.y !== 0);
    };
    
    // Nodes driven by Dagre (unless manually positioned) – excludes tools/history/unassigned agents
    const layoutNodes = nodes.filter(n => n.type !== 'tool' && n.type !== 'history' && !isUnassignedAgent(n) && !hasManualPosition(n));
    // Manually positioned layout nodes (e.g., pool/router dragged by user) so they remain rendered
    const manualLayoutNodes = nodes.filter(n => n.type !== 'tool' && n.type !== 'history' && !isUnassignedAgent(n) && hasManualPosition(n) && n.type !== 'agent');
    const toolNodes = nodes.filter(n => n.type === 'tool');
    const historyNodes = nodes.filter(n => n.type === 'history');
    const unassignedAgentNodes = nodes.filter(isUnassignedAgent);
    const manualAgentNodes = nodes.filter(n => n.type === 'agent' && !isUnassignedAgent(n) && hasManualPosition(n));

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
        
        // Exclude the manual Router->Pool edge from Dagre layout to avoid Top-Bottom stacking
        // We want manual side-by-side positioning for them.
        const isRouterToPool = sourceNode?.type === 'router' && targetNode?.type === 'pool';

        if (sourceNode && targetNode && !isRouterToPool) {
             dagreGraph.setEdge(edge.source, edge.target);
        }
    });

    dagre.layout(dagreGraph);

    // 1. Position Layout Nodes
    const positionedLayoutNodes = layoutNodes.map((node) => {
        // Special Manual Positioning for Router
        // It resides outside the Dagre flow (which manages Pool -> Agents)
        if (node.type === 'router') {
             // We will position it relative to Pool in a second pass or right here if we can find Pool.
             // Dagre might not have positioned it if we didn't add edges?
             // Actually if we added `setNode` for Router but no edges, it might just be at 0,0.
             // Let's defer Router positioning.
             return { ...node, position: { x: 0, y: 0 } }; 
        }

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
    
    // 1b. Manually Position Router (Left of Pool)
    const finalLayoutNodes = positionedLayoutNodes.map(node => {
        if (node.type === 'router') {
            const poolNode = positionedLayoutNodes.find(n => n.type === 'pool');
            if (poolNode) {
                 const gap = 100;
                 return {
                     ...node,
                     sourcePosition: Position.Right, // Handle is on Right
                     targetPosition: Position.Top, // Unused really
                     position: {
                         x: snapTo(poolNode.position.x - 320 - gap), // Router width 320
                         y: poolNode.position.y
                     }
                 };
            }
        }
        return node;
    });

    // Use finalLayoutNodes for subsequent steps

    // 1c. Position Manual Layout Nodes (pool/router with manual positions)
    const positionedManualLayoutNodes = manualLayoutNodes.map(node => {
        const position = customPositions?.[node.id] || node.position;
        const common = {
            targetPosition: Position.Top,
            sourcePosition: Position.Bottom,
            position
        };

        if (node.type === 'router') {
            return {
                ...node,
                targetPosition: Position.Top,
                sourcePosition: Position.Right,
                position
            };
        }

        return { ...node, ...common };
    });

    // 1c. Position Manual Agent Nodes (preserve their positions)
    const positionedManualAgentNodes = manualAgentNodes.map(node => {
        const position = customPositions?.[node.id] || node.position;
        return {
            ...node,
            targetPosition: Position.Top,
            sourcePosition: Position.Bottom,
            position
        };
    });

    // 4. Position Unassigned Tool Nodes (Grid layout below everything else or to the side)
    const unassignedToolNodes = toolNodes.filter(n => n.id.startsWith('tool-unassigned-'));
    
    // Determine start Y for unassigned area
    const maxY = Math.max(...finalLayoutNodes.map(n => n.position.y + nodeDimensions[n.type || 'default'].height), 0);
    const startY = maxY + 100;

    // Position Unassigned Agents first (preserve existing positions)
    const positionedUnassignedAgentNodes = unassignedAgentNodes.map((node, idx) => {
         // Check customPositions first (from right-click add)
         const customPosition = customPositions?.[node.id];
         if (customPosition) {
             return {
                 ...node,
                 targetPosition: Position.Top,
                 sourcePosition: Position.Bottom,
                 position: customPosition
             };
         }
         // Preserve existing position if set
         if (node.position && (node.position.x !== 0 || node.position.y !== 0)) {
             return {
                 ...node,
                 targetPosition: Position.Top,
                 sourcePosition: Position.Bottom
             };
         }
         const dim = nodeDimensions.agent;
         const gap = 20;
         const cols = 2; // Agents are wider
         const col = idx % cols;
         const row = Math.floor(idx / cols);
         
         const x = col * (dim.width + gap);
         const y = startY + row * (dim.height + gap);
         
         return {
            ...node,
            targetPosition: Position.Top,
            sourcePosition: Position.Bottom,
            position: { x, y }
         };
    });

    // Determine start Y for Tools (below unassigned agents)
    const maxAgentY = Math.max(...positionedUnassignedAgentNodes.map(n => n.position.y + nodeDimensions.agent.height), startY);
    const toolsStartY = maxAgentY + 60;

    const positionedUnassignedToolNodes = unassignedToolNodes.map((node, idx) => {
        // Check customPositions first (from right-click add)
        const customPosition = customPositions?.[node.id];
        if (customPosition) {
            return {
                ...node,
                targetPosition: Position.Left,
                sourcePosition: Position.Right,
                position: customPosition
            };
        }
        // Preserve existing position if set
        if (node.position && (node.position.x !== 0 || node.position.y !== 0)) {
            return {
                ...node,
                targetPosition: Position.Left,
                sourcePosition: Position.Right
            };
        }
        const dim = nodeDimensions.tool;
        const gap = 20;
        const cols = 3;
        const col = idx % cols;
        const row = Math.floor(idx / cols);

        // Position them below unassigned agents
        const x = col * (dim.width + gap);
        const y = toolsStartY + row * (dim.height + gap);

        return {
            ...node,
            targetPosition: Position.Left,
            sourcePosition: Position.Right,
            position: { x, y }
        };
    });
    
    const assignedToolNodes = toolNodes.filter(n => !n.id.startsWith('tool-unassigned-'));
    const positionedAssignedToolNodes = assignedToolNodes.map(toolNode => {
        // Check customPositions first (from connection or manual drag)
        const manualPosition = customPositions?.[toolNode.id];
        if (manualPosition) {
            return {
                ...toolNode,
                targetPosition: Position.Left,
                sourcePosition: Position.Right,
                position: manualPosition
            };
        }

        // Preserve existing position - NO auto-repositioning
        // If node already has a non-zero position, keep it
        if (toolNode.position && (toolNode.position.x !== 0 || toolNode.position.y !== 0)) {
            return {
                ...toolNode,
                targetPosition: Position.Left,
                sourcePosition: Position.Right
            };
        }

        // Only calculate default position for brand new tools with no position
        const parts = toolNode.id.split('-tool-');
        if (parts.length < 2) return toolNode; 
        
        const agentId = parts[0];
        let index = parseInt(parts[1], 10);
        if (isNaN(index)) index = 0;
        
        // Try to find agent among layouted (assigned) agents first
        let agentNode = finalLayoutNodes.find(n => n.id === agentId);
        // If not found, try unassigned agents (positioned separately)
        if (!agentNode) {
            agentNode = positionedUnassignedAgentNodes.find(n => n.id === agentId);
        }
        if (!agentNode) return toolNode;

        const agentDim = nodeDimensions.agent;
        const toolDim = nodeDimensions.tool;
        const verticalGap = 16;
        const startOffset = 40; 

        const x = snapTo(agentNode.position.x + 20); 
        const y = snapTo(agentNode.position.y + agentDim.height + startOffset + (index * (toolDim.height + verticalGap)));

        return {
            ...toolNode,
            targetPosition: Position.Left,
            sourcePosition: Position.Right,
            position: { x, y }
        };
    });

    // 3. Position History Nodes (Assigned)
    const unassignedHistoryNodes = historyNodes.filter(n => n.id.startsWith('history-unassigned-'));
    const assignedHistoryNodes = historyNodes.filter(n => !n.id.startsWith('history-unassigned-'));

    const positionedHistoryNodes = assignedHistoryNodes.map(historyNode => {
        // Check customPositions first (from connection or manual drag)
        const manualPosition = customPositions?.[historyNode.id];
        if (manualPosition) {
            return {
                ...historyNode,
                targetPosition: Position.Left,
                sourcePosition: Position.Right,
                position: manualPosition
            };
        }

        // Preserve existing position - NO auto-repositioning
        if (historyNode.position && (historyNode.position.x !== 0 || historyNode.position.y !== 0)) {
            return {
                ...historyNode,
                targetPosition: Position.Left,
                sourcePosition: Position.Right
            };
        }

        // Parse parent ID from history ID (format: "parentId-history" or "pool-root-history")
        const parts = historyNode.id.split('-history');
        if (parts.length < 1) return historyNode;
        
        let parentId = parts[0];
        // Special case for pool history which might be 'pool-root' but ID is 'pool-root-history' -> split gives 'pool-root'
        
        // Find parent
        const parentNode = finalLayoutNodes.find(n => n.id === parentId);
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

    // 5. Position Unassigned History Nodes (Below tools)
    const historyStartY = Math.max(...positionedUnassignedToolNodes.map(n => n.position.y + nodeDimensions.tool.height), toolsStartY) + 60;

    const positionedUnassignedHistoryNodes = unassignedHistoryNodes.map((node, idx) => {
        // Check customPositions first (from right-click add)
        const customPosition = customPositions?.[node.id];
        if (customPosition) {
            return {
                ...node,
                targetPosition: Position.Left,
                sourcePosition: Position.Right,
                position: customPosition
            };
        }
        // Preserve existing position if set
        if (node.position && (node.position.x !== 0 || node.position.y !== 0)) {
            return {
                ...node,
                targetPosition: Position.Left,
                sourcePosition: Position.Right
            };
        }
        const dim = nodeDimensions.history;
        const gap = 20;
        const cols = 2;
        const col = idx % cols;
        const row = Math.floor(idx / cols);

        // Position them below unassigned tools
        const x = col * (dim.width + gap);
        const y = historyStartY + row * (dim.height + gap);

        return {
            ...node,
            targetPosition: Position.Left,
            sourcePosition: Position.Right,
            position: { x, y }
        };
    });

    // 6. Position Unassigned Router Nodes (Below History)
    const routerNodes = nodes.filter(n => n.type === 'router');
    const unassignedRouterNodes = routerNodes.filter(n => n.id.startsWith('router-unassigned-'));
    const routerStartY = Math.max(...positionedUnassignedHistoryNodes.map(n => n.position.y + nodeDimensions.history.height), historyStartY) + 60;

    const positionedUnassignedRouterNodes = unassignedRouterNodes.map((node, idx) => {
        // Check customPositions first
        const customPosition = customPositions?.[node.id];
        if (customPosition) {
            return {
                ...node,
                targetPosition: Position.Top,
                sourcePosition: Position.Right, 
                position: customPosition
            };
        }
        // Preserve existing position if set
        if (node.position && (node.position.x !== 0 || node.position.y !== 0)) {
             return {
                ...node,
                targetPosition: Position.Top,
                sourcePosition: Position.Right, 
             };
        }

        const dim = nodeDimensions.default; // Router uses default size but mapped
        const gap = 20;
        
        const x = 0; // Simple vertical stack or similar default
        const y = routerStartY + idx * (100 + gap);

        return {
            ...node,
            targetPosition: Position.Top,
            sourcePosition: Position.Right, 
            position: { x, y }
        };
    });

    return {  
        nodes: [...finalLayoutNodes, ...positionedManualLayoutNodes, ...positionedManualAgentNodes, ...positionedAssignedToolNodes, ...positionedUnassignedToolNodes, ...positionedUnassignedAgentNodes, ...positionedHistoryNodes, ...positionedUnassignedHistoryNodes, ...positionedUnassignedRouterNodes], 
        edges 
    };
};

export const parsePearData = (data: any, customPositions?: Record<string, { x: number, y: number }>) => {
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

    if (data.type === 'project') {
        const projectData = data.data;

        // 1. Pool (Optional)
        if (projectData.pool) {
            const poolId = 'pool-root';
            addNode('pool', projectData.pool, poolId);

            const poolData = projectData.pool;

            // Handle Router (Attached to Pool logic)
            if (poolData.router) {
                const routerId = 'router-main';
                addNode('router', poolData.router, routerId);
                
                edges.push({
                    id: `e-${routerId}-${poolId}-main`,
                    source: routerId,
                    target: poolId,
                    sourceHandle: 'router-right-source', 
                    targetHandle: 'pool-left-target',
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#a855f7', strokeWidth: 3 },
                });
            }

            // Handle Agents connected to Pool
            if (poolData.agents) {
                poolData.agents.forEach((agent: any, idx: number) => {
                    const agentId = `agent-${idx}`;
                    addNode('agent', agent, agentId, poolId, 'pool-bottom-source');

                    // Tools
                    if (agent.tools) {
                        agent.tools.forEach((tool: any, tIdx: number) => {
                            const toolId = `${agentId}-tool-${tool._id || tIdx}`;
                            addNode('tool', tool, toolId, agentId, 'left-tool-source');
                        });
                    }
                    // History
                    if (agent.history) {
                        const historyId = `${agentId}-history`;
                        addNode('history', agent.history, historyId, agentId, 'right-history-source');
                    }
                });
            }

            // Pool History
            if (poolData.history) {
                const poolHistoryId = 'pool-root-history';
                addNode('history', poolData.history, poolHistoryId, poolId, 'right-history-source');
            }
        }

        // 2. Unassigned Items (Global)
        if (projectData.unassigned_tools) {
            projectData.unassigned_tools.forEach((tool: any, idx: number) => {
                const toolId = `tool-unassigned-${tool._id || idx}`;
                addNode('tool', tool, toolId);
            });
        }
        
        if (projectData.unassigned_agents) {
            projectData.unassigned_agents.forEach((agent: any, idx: number) => {
                const agentId = `agent-unassigned-${agent._id || idx}`;
                addNode('agent', agent, agentId);

                // Attach tools to unassigned agents
                if (agent.tools) {
                    agent.tools.forEach((tool: any, tIdx: number) => {
                        const toolId = `${agentId}-tool-${tool._id || tIdx}`;
                        addNode('tool', tool, toolId, agentId, 'left-tool-source');
                    });
                }

                // Attach history to unassigned agents
                if (agent.history) {
                    const historyId = `${agentId}-history`;
                    addNode('history', agent.history, historyId, agentId, 'right-history-source');
                }
            });
        }

        if (projectData.unassigned_histories) {
            projectData.unassigned_histories.forEach((history: any, idx: number) => {
                const historyId = `history-unassigned-${history._id || idx}`;
                addNode('history', history, historyId);
            });
        }

        // Unassigned Routers
        if (projectData.unassigned_routers) {
            projectData.unassigned_routers.forEach((router: any, idx: number) => {
                const routerId = `router-unassigned-${router._id || idx}`;
                addNode('router', router, routerId);
            });
        }

    } else if (data.type === 'pool') {
        const poolId = 'pool-root';
        addNode('pool', data.data, poolId);

        // Handle Router
        if (data.data.router) {
            const routerId = 'router-main';
            addNode('router', data.data.router, routerId); // No parent in helper
            
            // Manually add Edge: Router (Right) -> Pool (Left)
            edges.push({
                id: `e-${routerId}-${poolId}-main`,
                source: routerId,
                target: poolId,
                sourceHandle: 'router-right-source', 
                targetHandle: 'pool-left-target',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#a855f7', strokeWidth: 3 }, // Purple edge
            });
        }
        
        // Handle Agents directly connected to Pool (visually)
        if (data.data.agents) {
            data.data.agents.forEach((agent: any, idx: number) => {
                const agentId = `agent-${idx}`;
                // Connect to Pool
                addNode('agent', agent, agentId, poolId, 'pool-bottom-source');

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

        if (data.data.history) {
            const poolHistoryId = 'pool-root-history';
            addNode('history', data.data.history, poolHistoryId, poolId, 'right-history-source');
        }

        // Unassigned Tools
        if (data.data.unassigned_tools) {
            data.data.unassigned_tools.forEach((tool: any, idx: number) => {
                const toolId = `tool-unassigned-${idx}`;
                addNode('tool', tool, toolId); // No parent
            });
        }
        
        // Unassigned Agents
        if (data.data.unassigned_agents) {
            data.data.unassigned_agents.forEach((agent: any, idx: number) => {
                const agentId = `agent-unassigned-${idx}`;
                addNode('agent', agent, agentId); // No parent

                if (agent.tools) {
                    agent.tools.forEach((tool: any, tIdx: number) => {
                        const toolId = `${agentId}-tool-${tIdx}`;
                        addNode('tool', tool, toolId, agentId, 'left-tool-source');
                    });
                }

                if (agent.history) {
                    const historyId = `${agentId}-history`;
                    addNode('history', agent.history, historyId, agentId, 'right-history-source');
                }
            });
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

    return getLayoutedElements(nodes, edges, 'TB', customPositions);
};
