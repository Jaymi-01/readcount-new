export type ThemeColors = typeof COLORS;

export const COLORS = {
    primary: '#6366f1', // Vibrant Indigo
    primaryLight: '#e0e7ff', 
    secondary: '#f43f5e', // Rose/Pink
    background: '#f8fafc', // Slate 50 (Cleaner)
    card: '#ffffff',
    textDark: '#0f172a', // Slate 900
    textLight: '#64748b', // Slate 500
    white: '#ffffff',
    reading: '#6366f1', // Indigo
    toRead: '#f59e0b', // Amber
    read: '#10b981',   // Emerald
    danger: '#f43f5e', 
    success: '#10b981',
    border: '#e2e8f0',
};

export const darkColors: ThemeColors = {
    primary: '#818cf8', // Lighter Indigo for Dark Mode
    primaryLight: '#312e81',
    secondary: '#fb7185', // Lighter Rose
    background: '#020617', // Slate 950 (Deep Midnight)
    card: '#0f172a', // Slate 900
    textDark: '#f8fafc', // Slate 50
    textLight: '#94a3b8', // Slate 400
    white: '#ffffff',
    reading: '#818cf8',
    toRead: '#fbbf24', // Amber 400
    read: '#34d399',   // Emerald 400
    danger: '#fb7185',
    success: '#34d399',
    border: '#1e293b', // Slate 800
};
