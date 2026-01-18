import { type Node, type Edge } from '@xyflow/react';

export interface AtlasTab {
    id: string;
    name: string;
    data: any;
    layout?: {
        nodes: Node[];
        edges: Edge[];
    };
    selectedNodeId?: string | null;
    isTutorial?: boolean;
}
