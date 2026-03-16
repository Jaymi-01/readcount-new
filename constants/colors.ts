export type ThemeColors = typeof COLORS;

export const COLORS = {
    primary: '#bc6c25', // Rich Wood (Tiger's Eye)
    primaryLight: '#faedcd', // Warm Cream wash
    secondary: '#f59e0b', // Golden Amber
    background: '#f2e8cf', // Warm Sepia Background
    card: '#fdfbf0', // Light Paper/Sepia Card
    textDark: '#432818', // Deep Coffee/Chocolate
    textLight: '#99582a', // Medium Brown/Sienna
    white: '#ffffff',
    
    // Status Colors (Warm & Earthy)
    reading: '#dda15e', // Golden Ochre
    readingBg: '#fef3c7',
    toRead: '#92400e', // Deep Amber/Wood
    toReadBg: '#faedcd',
    read: '#432818',   // Ink Black/Brown
    readBg: '#f2e8cf',

    danger: '#bc4749', // Muted Brick Red
    success: '#bc6c25',
    border: '#dda15e80', // Ochre Border

    // Chart & UI Accents (Monochromatic Warm Palette)
    chart: [
        '#bc6c25', '#dda15e', '#f59e0b', '#92400e', 
        '#432818', '#99582a', '#bc4749', '#603808'
    ],

    // Book Cover Palette (Rich leather and wood tones)
    covers: [
        '#bc6c25', '#92400e', '#603808', '#432818',
        '#dda15e', '#f59e0b', '#99582a', '#bc4749'
    ]
};

export const darkColors: ThemeColors = {
    primary: '#dda15e', // Lighter Ochre for dark mode
    primaryLight: '#432818', // Deep Coffee wash
    secondary: '#fbbf24', // Brighter Amber
    background: '#1a120b', // Deepest Ebony
    card: '#2c1e14', // Rich Cocoa
    textDark: '#f2e8cf', // Sepia Tinted White
    textLight: '#b08968', // Light Cocoa/Tan
    white: '#ffffff',
    
    // Status Colors (Dark mode adjusted)
    reading: '#dda15e',
    readingBg: '#432818',
    toRead: '#bc6c25',
    toReadBg: '#2c1e14',
    read: '#f2e8cf',
    readBg: '#432818',

    danger: '#bc4749',
    success: '#dda15e',
    border: '#432818',

    chart: [
        '#dda15e', '#bc6c25', '#fbbf24', '#f2e8cf',
        '#bc4749', '#99582a', '#603808', '#432818'
    ],
    
    covers: [
        '#bc6c25', '#92400e', '#603808', '#432818',
        '#dda15e', '#f59e0b', '#99582a', '#bc4749'
    ]
};
