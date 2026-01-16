import { getPlayerProgress } from '../unlocks.js';

let isRecording = false;
let frames = [];
let startTime = 0;
const FRAME_RATE = 30;
let lastFrameTime = 0;

export function startRecording() {
    isRecording = true;
    frames = [];
    startTime = Date.now();
    lastFrameTime = startTime;
}

// Precision helper to save JSON space
const p = (n) => typeof n === 'number' ? Number(n.toFixed(2)) : 0;

export function recordTick(bear, activeFishes, score, log) {
    if (!isRecording || !bear) return;

    const now = Date.now();
    // Limit recording to approx 30fps
    if (now - lastFrameTime < 1000 / FRAME_RATE) return;
    lastFrameTime = now;

    const frameData = {
        // Bear pos/rot
        bp: [p(bear.position.x), p(bear.position.y), p(bear.position.z)],
        br: [p(bear.rotation.x), p(bear.rotation.y), p(bear.rotation.z)],
        // Active fishes
        f: activeFishes.map(f => ({
            id: f.userData.id,
            t: f.userData.fishType || 'classic',
            s: p(f.scale.x),
            p: [p(f.position.x), p(f.position.y), p(f.position.z)],
            r: [p(f.rotation.x), p(f.rotation.y), p(f.rotation.z)]
        }))
    };

    if (log) {
        frameData.lp = [p(log.position.x), p(log.position.y), p(log.position.z)];
        frameData.lr = [p(log.rotation.x), p(log.rotation.y), p(log.rotation.z)];
    }
    
    // Add mask info if present
    if (bear.getObjectByName('cosmeticMask')) {
        frameData.m = 1;
    }

    frames.push(frameData);

    // Hard limit to prevent memory issues/huge uploads (approx 45 seconds)
    if (frames.length > 30 * 45) {
        frames.shift(); // Keep mostly recent history
    }
}

export function stopRecording() {
    isRecording = false;
    const progress = getPlayerProgress();
    
    // Construct the replay payload
    const replayData = {
        fps: FRAME_RATE,
        bearType: progress.selectedBear,
        cosmeticId: progress.selectedCosmetic,
        frames: frames,
        totalFrames: frames.length,
        durationInSeconds: frames.length / FRAME_RATE
    };
    
    return replayData;
}