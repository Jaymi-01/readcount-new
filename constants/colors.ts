export type ThemeColors = typeof COLORS;

export const COLORS = {
    primary: '#6366f1', // Vibrant Indigo
    primaryLight: '#e0e7ff', 
    secondary: '#f43f5e', // Rose/Pink
    background: '#f8fafc', // Slate 50
    card: '#ffffff',
    textDark: '#0f172a', // Slate 900
    textLight: '#64748b', // Slate 500
    white: '#ffffff',
    
    // Status Colors (Vibrant)
    reading: '#6366f1', // Indigo
    readingBg: '#e0e7ff',
    toRead: '#f59e0b', // Amber
    toReadBg: '#fef3c7',
    read: '#10b981',   // Emerald
    readBg: '#d1fae5',

    danger: '#f43f5e', 
    success: '#10b981',
    border: '#e2e8f0',

    // Chart Palette (Vibrant)
    chart: [
        '#6366f1', '#f43f5e', '#10b981', '#f59e0b', 
        '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
        '#22c55e', '#ef4444', '#a855f7', '#3b82f6'
    ]
};

export const darkColors: ThemeColors = {
    primary: '#818cf8', 
    primaryLight: '#312e81',
    secondary: '#fb7185', 
    background: '#020617', // Deep Midnight
    card: '#0f172a', // Slate 900
    textDark: '#f8fafc', 
    textLight: '#94a3b8', 
    white: '#ffffff',
    
    // Status Colors (Dark mode adjusted)
    reading: '#818cf8',
    readingBg: '#1e1b4b',
    toRead: '#fbbf24',
    toReadBg: '#451a03',
    read: '#34d399',
    readBg: '#064e3b',

    danger: '#fb7185',
    success: '#34d399',
    border: '#1e293b',

    chart: [
        '#818cf8', '#fb7185', '#34d399', '#fbbf24',
        '#a78bfa', '#f472b6', '#22d3ee', '#fb923c',
        '#4ade80', '#f87171', '#c084fc', '#60a5fa'
    ]
};
