export type ThemeColors = typeof COLORS;

export const COLORS = {
    primary: '#5e81ac', // Nord Blue (Deep)
    primaryLight: '#88c0d0', // Frost Blue
    secondary: '#ebcb8b', // Nord Yellow/Gold (Accent)
    background: '#eceff4', // Snow Storm (White/Gray)
    card: '#ffffff',
    textDark: '#2e3440', // Polar Night (Darkest)
    textLight: '#4c566a', // Slate Gray
    white: '#ffffff',
    
    // Status Colors (Nord Style)
    reading: '#81a1c1', // Glacial Blue
    readingBg: '#d8dee9',
    toRead: '#d08770', // Aurora Orange
    toReadBg: '#e5e9f0',
    read: '#a3be8c',   // Nord Green
    readBg: '#ebf0e9',

    danger: '#bf616a', // Aurora Red
    success: '#a3be8c',
    border: '#d8dee9', 

    // Chart & UI Accents (Nord Aurora Palette)
    chart: [
        '#5e81ac', '#81a1c1', '#88c0d0', '#8fbcbb', 
        '#a3be8c', '#ebcb8b', '#d08770', '#bf616a'
    ],

    // Book Cover Palette (Nordic cool tones)
    covers: [
        '#2e3440', '#3b4252', '#434c5e', '#4c566a',
        '#5e81ac', '#81a1c1', '#88c0d0', '#8fbcbb'
    ]
};

export const darkColors: ThemeColors = {
    primary: '#88c0d0', 
    primaryLight: '#2e3440',
    secondary: '#ebcb8b',
    background: '#2e3440', // Deep Polar Night
    card: '#3b4252',
    textDark: '#eceff4', 
    textLight: '#d8dee9', 
    white: '#ffffff',
    
    // Status Colors (Dark mode)
    reading: '#88c0d0',
    readingBg: '#434c5e',
    toRead: '#d08770',
    toReadBg: '#4c566a',
    read: '#a3be8c',
    readBg: '#434c5e',

    danger: '#bf616a',
    success: '#a3be8c',
    border: '#434c5e',

    chart: [
        '#88c0d0', '#81a1c1', '#5e81ac', '#8fbcbb',
        '#a3be8c', '#ebcb8b', '#d08770', '#bf616a'
    ],
    
    covers: [
        '#2e3440', '#3b4252', '#434c5e', '#4c566a',
        '#5e81ac', '#81a1c1', '#88c0d0', '#8fbcbb'
    ]
};
