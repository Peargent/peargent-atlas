import { generateUUID } from '../../lib/utils';
import { AtlasTab } from '../../types/atlas';
import { memo } from 'react';
import { NodeProps } from '@xyflow/react';

import keyBindsImg from '../assets/key-binds.svg';
import deleteLinkImg from '../assets/delete-link.svg';
import iCardImg from '../assets/i-card.svg';
import colorDotsImg from '../assets/color-dots.svg';
import nodeEditImg from '../assets/node-edit.svg';
import downloadPearImg from '../assets/download-pear.svg';

// Tutorial viewport settings (zoom and pan position)
export const tutorialViewport = { x: 200, y: 100, zoom: 1.0 };

// Calculate responsive graph position from screen position
// Formula: graphX = (screenX - viewport.x) / zoom
const getResponsivePosition = (screenX: number, screenY: number) => {
    const { x: vpX, y: vpY, zoom } = tutorialViewport;
    return {
        x: (screenX - vpX) / zoom,
        y: (screenY - vpY) / zoom,
    };
};

// Get tutorial annotations with responsive positioning based on screen size
export const getTutorialAnnotations = (screenWidth: number, screenHeight: number) => {
    const keyBindsSrc = typeof keyBindsImg === 'string' ? keyBindsImg : keyBindsImg.src;
    const deleteLinkSrc = typeof deleteLinkImg === 'string' ? deleteLinkImg : deleteLinkImg.src;
    const iCardSrc = typeof iCardImg === 'string' ? iCardImg : iCardImg.src;
    const colorDotsSrc = typeof colorDotsImg === 'string' ? colorDotsImg : colorDotsImg.src;
    const nodeEditSrc = typeof nodeEditImg === 'string' ? nodeEditImg : nodeEditImg.src;
    const downloadPearSrc = typeof downloadPearImg === 'string' ? downloadPearImg : downloadPearImg.src;

    // Mobile annotations (screen width < 768px)
    if (screenWidth < 768) {
        return [
            // TODO: Add mobile-specific annotations here
            // Example:
            // {
            //     id: 'annotation-mobile-hint',
            //     text: '',
            //     image: mobileHintSrc,
            //     position: { x: 50, y: 100 },
            // },
        ];
    }

    // Desktop annotations
    return [
        {
            id: 'annotation-key-binds',
            text: '',
            image: keyBindsSrc,
            position: getResponsivePosition(50, screenHeight - 280),
        },
        {
            id: 'annotation-delete-link',
            text: '',
            image: deleteLinkSrc,
            width: 200,
            position: getResponsivePosition(80, screenHeight / 2),
        },
        {
            id: 'annotation-i-card',
            text: '',
            image: iCardSrc,
            position: getResponsivePosition(400, screenHeight / 22),
        },
        {
            id: 'annotation-color-dots',
            text: '',
            image: colorDotsSrc,
            position: getResponsivePosition(screenWidth - 750, screenHeight / 1.5),
        },
        {
            id: 'annotation-node-edit',
            text: '',
            image: nodeEditSrc,
            position: getResponsivePosition(screenWidth - 750, screenHeight / 3),
        },
        {
            id: 'annotation-download-pear',
            text: '',
            image: downloadPearSrc,
            position: getResponsivePosition(screenWidth / 1.7, screenHeight / 25), // Top-right
        },
    ];
};

// Static export for type definition (will be replaced at runtime)
export const tutorialAnnotations: {
    id: string;
    text: string;
    image?: string;
    width?: number;
    position: { x: number; y: number };
}[] = [];

// TutorialOverlay is no longer needed since annotations are on canvas
export const TutorialOverlay = memo(() => null);
TutorialOverlay.displayName = 'TutorialOverlay';

// Simple Annotation Node component - renders text or images
export const AnnotationNode = memo(({ data }: NodeProps) => {
    const annotationData = data as {
        text: string;
        image?: string;
        width?: number;
    };

    // Render Image if provided
    if (annotationData.image) {
        return (
            <div style={{ position: 'relative', zIndex: 1000 }}>
                <img
                    src={annotationData.image}
                    alt={annotationData.text}
                    style={{
                        width: annotationData.width || 'auto',
                        pointerEvents: 'none',
                        display: 'block'
                    }}
                />
                {annotationData.text && (
                    <div style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '14px',
                        color: '#22c55e',
                        marginTop: '8px'
                    }}>
                        {annotationData.text}
                    </div>
                )}
            </div>
        );
    }

    // Default: render text only
    return (
        <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '16px',
            color: '#22c55e',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '6px',
            border: '1px solid #22c55e',
            maxWidth: '300px',
            pointerEvents: 'none'
        }}>
            {annotationData.text}
        </div>
    );
});

AnnotationNode.displayName = 'AnnotationNode';

export const createTutorialData = () => {
    const timestamp = Date.now();

    // IDs for items (used in data, but layout.ts generates its own IDs)
    const poolId = `pool-${timestamp}`;
    const routerId = `router-${timestamp}`;
    const historyId = `history-${timestamp}`;
    const agent1Id = `agent1-${timestamp}`;
    const tool1Id = `tool1-${timestamp}`;
    const agent2Id = `agent2-${timestamp}`;
    const tool2Id = `tool2-${timestamp}`;

    // Agent 1: Researcher
    const agent1 = {
        _id: agent1Id,
        name: 'Research Agent',
        persona: 'You are an expert researcher who finds accurate information.',
        model: {
            type: 'OpenAIModel',
            model_name: 'gpt-4o'
        },
        temperature: 0.7,
        tracing: null,
        tools: [
            {
                _id: tool1Id,
                name: 'search_tool',
                description: 'Search the web for information.',
                input_parameters: { query: 'str' },
                source_code: 'def search_tool(query: str):\n    return f"Results for: {query}"',
                type: 'tool'
            }
        ],
        history: null
    };

    // Agent 2: Writer
    const agent2 = {
        _id: agent2Id,
        name: 'Writer Agent',
        persona: 'You are a creative writer who produces engaging content.',
        model: {
            type: 'OpenAIModel',
            model_name: 'gpt-4o'
        },
        temperature: 0.8,
        tracing: null,
        tools: [
            {
                _id: tool2Id,
                name: 'format_tool',
                description: 'Format text into markdown.',
                input_parameters: { text: 'str' },
                source_code: 'def format_tool(text: str):\n    return f"**{text}**"',
                type: 'tool'
            }
        ],
        history: null
    };

    // Pool Data containing everything
    const poolData = {
        _id: poolId,
        name: 'Main Pool',
        router: {
            _id: routerId,
            type: 'routing_agent',
            routing_agent: null,
            routes: []
        },
        history: {
            _id: historyId,
            type: 'sqlite',
            db_path: './history.db'
        },
        agents: [agent1, agent2]
    };

    const tutorialData = {
        type: 'project',
        data: {
            settings: { tracing: true },
            pool: poolData,
            unassigned_agents: [],
            unassigned_tools: [],
            unassigned_histories: []
        }
    };

    const newTab: AtlasTab = {
        id: generateUUID(),
        name: 'Tutorial Project',
        data: tutorialData,
        isTutorial: true
    };

    // Node positions
    const positions: Record<string, { x: number; y: number }> = {
        ['pool-root']: { x: 450, y: 100 },
        ['router-main']: { x: 50, y: 100 },
        ['pool-root-history']: { x: 850, y: 100 },
        ['agent-0']: { x: 200, y: 380 },
        ['agent-1']: { x: 650, y: 380 },
        [`agent-0-tool-${tool1Id}`]: { x: 200, y: 560 },
        [`agent-1-tool-${tool2Id}`]: { x: 650, y: 560 }
    };

    return { newTab, positions };
};

// Tutorial component - no longer renders annotations (they're now in AtlasGraph)
export const Tutorial = ({ activeTab }: { activeTab: AtlasTab | null }) => {
    return null;
};
