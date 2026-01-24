export const generateUUID = () => {
    try {
        // Try native crypto.randomUUID first
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch (e) {
        console.warn('crypto.randomUUID failed, using fallback', e);
    }

    // Fallback implementation (RFC4122)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const ADJECTIVES = [
    'Cosmic', 'Quantum', 'Neon', 'Cyber', 'Solar', 'Lunar', 'Hyper', 'Sonic',
    'Vivid', 'Rapid', 'Sleek', 'Wild', 'Bold', 'Brave', 'Calm', 'Blue',
    'Red', 'Dark', 'Light', 'Bright', 'Silent', 'Swift', 'Grand', 'Noble', 
    'Mystic', 'Crystal', 'Golden', 'Silver', 'Iron', 'Steel'
];

const NOUNS = [
    'Pear', 'Atlas', 'Nexus', 'Core', 'Grid', 'Node', 'Flow', 'Wave',
    'Spark', 'Pulse', 'Drift', 'Haze', 'Mist', 'Realm', 'Zone', 'Base',
    'Link', 'Sync', 'Mesh', 'Net', 'Web', 'Loop', 'Arc', 'Beam',
    'Ray', 'Star', 'Moon', 'Sun', 'Sky', 'Cloud'
];

export const generateProjectSlug = () => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj} ${noun}`;
};
