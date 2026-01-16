export const BEARS = [
    { 
        id: 'splashy', 
        name: 'Splashy Bear', 
        asset: 'bear_unlock.png',
        unlockCondition: { type: 'score', value: 0 }
    },
    { 
        id: 'grizzly', 
        name: 'Grizzly', 
        asset: 'grizzly_bear_unlock.png',
        unlockCondition: { type: 'score', value: 1000 }
    },
    { 
        id: 'polar', 
        name: 'Polar Bear', 
        asset: 'polar_bear_unlock.png',
        unlockCondition: { type: 'score', value: 1500 }
    }
];

export const FISH = [
    { 
        id: 'classic', 
        name: 'Classic Fish', 
        asset: 'fish_unlock.png',
        unlockCondition: { type: 'score', value: 0 }, 
        difficulty: 1,
    },
    { 
        id: 'vitiligo', 
        name: 'Vitiligo Fish', 
        asset: 'vitiligo_fish_unlock.png',
        unlockCondition: { type: 'score', value: 250 }, 
        difficulty: 2,
    },
    { 
        id: 'golden',
        name: 'Golden Fish',
        asset: 'golden_fish_unlock.png',
        unlockCondition: { type: 'score', value: 750 },
        difficulty: 3,
    },
];

export const COSMETICS = [
    {
        id: 'none',
        name: 'None',
        asset: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', // transparent pixel
        unlockCondition: { type: 'score', value: 0 }
    },
    {
        id: 'scream_mask',
        name: 'Scream Mask',
        asset: 'scream_mask_unlock.png',
        unlockCondition: { type: 'score', value: 0 }
    }
];

const PROGRESS_KEY = 'splashyBearProgress';

export function getPlayerProgress() {
    const defaults = {
        unlockedBears: ['splashy'],
        unlockedFish: ['classic'],
        selectedBear: 'splashy',
        selectedFish: 'classic',
        highScore: 0,
        unlockedCosmetics: ['none', 'scream_mask'],
        selectedCosmetic: 'none',
    };
    try {
        const stored = localStorage.getItem(PROGRESS_KEY);
        if (stored) {
            const loadedProgress = JSON.parse(stored);
            // Ensure default cosmetics are always present for backward compatibility
            const cosmetics = new Set([...(defaults.unlockedCosmetics || []), ...(loadedProgress.unlockedCosmetics || [])]);
            loadedProgress.unlockedCosmetics = Array.from(cosmetics);
            
            // If selected cosmetic is somehow invalid, reset to 'none'
            if (!loadedProgress.unlockedCosmetics.includes(loadedProgress.selectedCosmetic)) {
                loadedProgress.selectedCosmetic = 'none';
            }
            
            // merge stored with defaults to prevent missing keys on updates
            return { ...defaults, ...loadedProgress };
        }
    } catch (e) {
        console.error("Could not load player progress", e);
    }
    return defaults;
}

export function savePlayerProgress(progress) {
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch(e) {
        console.error("Could not save player progress", e);
    }
}