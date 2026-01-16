import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import { bear, activeFishes, gameState, createGameBear } from './game.js';
import { BEARS, FISH, COSMETICS, getPlayerProgress, savePlayerProgress } from '../unlocks.js';
import { showGameOver, showStart, populateUnlocks, updateUIValues } from './ui.js';
import { playSFX, sounds } from './audio.js';
import { addLocalScore } from './leaderboard.js';
import { startRecording, stopRecording } from './recorder.js';
import { renderer } from '../scene.js';
import { createOrUpdateShowcase, showcaseBear, throwShowcaseFish, walkInShowcaseBear, swapShowcaseToCurrentSelection } from './showcase.js';
import * as TWEEN from 'tween';

/* add start guard */
let __startingSequence = false;
/* camera follow config */
const CAM_OFFSET = new THREE.Vector3(0, 12, 9);

export function setupStartScreen(isFirstLoad = false) {
    console.log("[SETUP] Setting up start screen");
    gameState.current = 'IDLE';

    // Hide any active game objects (but not showcase objects)
    scene.children.forEach(child => {
        if ((child.name === 'bear' || child.name === 'fish') && !child.userData?.isShowcase) {
             child.visible = false;
        }
    });

    // Clear fish array, but actual objects are just hidden
    activeFishes.forEach(f => scene.remove(f));
    activeFishes.length = 0;

    // Make sure game bear is fully gone
    if (bear) {
        console.log("[SETUP] Removing game bear");
        scene.remove(bear);
    }

    const playerProgress = getPlayerProgress();
    populateUnlocks(playerProgress, (type, id) => {
        if (type === 'bear') playerProgress.selectedBear = id;
        if (type === 'fish') playerProgress.selectedFish = id;
        if (type === 'cosmetic') playerProgress.selectedCosmetic = id; // Keep 'none' as id, not null
        savePlayerProgress(playerProgress);

        const quickBearName = document.querySelector('#choose-bear span');
        const quickBearImg = document.querySelector('#choose-bear img');
        const quickFishName = document.querySelector('#choose-fish span');
        const quickFishImg = document.querySelector('#choose-fish img');
        const quickCosmeticName = document.querySelector('#choose-cosmetic span');
        const quickCosmeticImg = document.querySelector('#choose-cosmetic img');

        const selectedBearInfo = BEARS.find(b => b.id === playerProgress.selectedBear);
        const selectedFishInfo = FISH.find(f => f.id === playerProgress.selectedFish);
        const selectedCosmeticInfo = COSMETICS.find(c => c.id === playerProgress.selectedCosmetic) || null;

        if(quickBearName) quickBearName.textContent = selectedBearInfo.name;
        if(quickBearImg) quickBearImg.src = selectedBearInfo.asset;
        if(quickFishName) quickFishName.textContent = selectedFishInfo.name;
        if(quickFishImg) quickFishImg.src = selectedFishInfo.asset;
        if(quickCosmeticName) quickCosmeticName.textContent = selectedCosmeticInfo && selectedCosmeticInfo.id !== 'none' ? selectedCosmeticInfo.name : 'Cosmetic';
        if(quickCosmeticImg) quickCosmeticImg.src = selectedCosmeticInfo && selectedCosmeticInfo.id !== 'none' ? selectedCosmeticInfo.asset : 'scream_mask_unlock.png';

        console.log("[SETUP] Recreating showcase after unlock selection");
        swapShowcaseToCurrentSelection();
    });

    console.log("[SETUP] Creating main showcase");
    // animate log back first, then waddle bear in
    window.__canQuickStart = false;
    animateLogReset(() => {
        createOrUpdateShowcase();
        walkInShowcaseBear();
    });
    showStart(isFirstLoad);
    const startButton = document.getElementById('start-button');
    if (startButton) startButton.innerText = 'START';
    console.log("[SETUP] Start screen setup completed");
}

function startGame() {
    gameState.current = 'PLAYING';
    gameState.score = 0;
    gameState.streak = 1;
    // TWEEN.removeAll(); // moved to startGameWithTurnaround after animations finish

    // Immediately hide showcase bear to avoid overlapping with gameplay bear
    if (showcaseBear) showcaseBear.visible = false;

    createGameBear();
    
    // Pass waterfall seed and current global tick to the recorder
    const wf = scene.getObjectByName('waterfall');
    const seed = wf?.userData?.seed || 12345;
    startRecording(seed, gameState.totalTicks);
    
    // notify listeners that gameplay has begun (for quick-start drag carry-over)
    window.dispatchEvent(new CustomEvent('game:started'));

}

export function startGameWithTurnaround() {
    if (__startingSequence) return;
    __startingSequence = true;
    TWEEN.removeAll(); // cancel any ongoing walk-in/wobble tweens to avoid double-rotations
    const proceed = () => {
        if (showcaseBear && showcaseBear.visible) {
            showcaseBear.rotation.y = 0; // normalize facing before rotating to 180°
            const baseY = 4.65, dur = 900;
            const easeRot = TWEEN.Easing?.Cubic?.InOut || ((k)=>k);
            const easeWob = TWEEN.Easing?.Sine?.InOut || ((k)=>k);
            new TWEEN.Tween(showcaseBear.rotation).to({ y: Math.PI }, dur).easing(easeRot).start();
            const wob = { t: 0 };
            new TWEEN.Tween(wob).to({ t: 1 }, dur).easing(easeWob)
              .onUpdate(()=>{ const phase = wob.t * Math.PI * 4; showcaseBear.rotation.z = Math.sin(phase) * 0.15; showcaseBear.position.y = baseY + Math.abs(Math.sin(phase)) * 0.10; })
              .onComplete(()=>{ showcaseBear.rotation.z = 0; showcaseBear.position.y = baseY; throwShowcaseFish(()=>{ TWEEN.removeAll(); startGame(); __startingSequence = false; }); })
              .start();
        } else { TWEEN.removeAll(); startGame(); __startingSequence = false; }
    };
    proceed();
}

export function gameOver() {
    gameState.current = 'GAME_OVER';
    document.getElementById('final-score').innerText = gameState.score;

    const playerProgress = getPlayerProgress();
    if (gameState.score > playerProgress.highScore) {
        playerProgress.highScore = gameState.score;
    }
    let newUnlock = false;
    BEARS.forEach(b => {
        if (!playerProgress.unlockedBears.includes(b.id) && b.unlockCondition.type === 'score' && playerProgress.highScore >= b.unlockCondition.value) {
            playerProgress.unlockedBears.push(b.id);
            newUnlock = true;
        }
    });
    FISH.forEach(f => {
        if (!playerProgress.unlockedFish.includes(f.id) && f.unlockCondition.type === 'score' && playerProgress.highScore >= f.unlockCondition.value) {
            playerProgress.unlockedFish.push(f.id);
            newUnlock = true;
        }
    });
    COSMETICS.forEach(c => {
        if (!(playerProgress.unlockedCosmetics || []).includes(c.id) && c.unlockCondition.type === 'score' && playerProgress.highScore >= c.unlockCondition.value) {
            if (!playerProgress.unlockedCosmetics) playerProgress.unlockedCosmetics = [];
            playerProgress.unlockedCosmetics.push(c.id);
            newUnlock = true;
        }
    });

    savePlayerProgress(playerProgress);

    showGameOver();
    playSFX(sounds.splash);
    activeFishes.forEach(f => scene.remove(f));
    activeFishes.length = 0;
    
    // Stop recording and get JSON data immediately
    const replayData = stopRecording();
    // For local score, we can store the object directly or stringify it.
    // However, leaderboard expects a "clipUrl" usually. We will repurpose this.
    // Since we can't "upload" JSON to a file URL easily without blobs (which we want to avoid for the leaderboard DB entry per instructions?),
    // We will just pass the data object to addLocalScore.
    addLocalScore(gameState.score, replayData);

    // remove auto transition; wait for user choice
    const skipBtn = document.getElementById('skip-submit-btn');
    skipBtn?.addEventListener('click', proceedToStart, { once: true });
    window.addEventListener('leaderboard:closed', proceedToStart, { once: true });
}

function proceedToStart() {
    const goScreen = document.getElementById('game-over-screen');
    if (!goScreen || gameState.current !== 'GAME_OVER') return;
    goScreen.classList.add('fade-out');
    const onFadeOut = () => {
        goScreen.removeEventListener('animationend', onFadeOut);
        setupStartScreen();
        const startButton = document.getElementById('start-button');
        if (startButton) startButton.innerText = 'RETRY';
    };
    goScreen.addEventListener('animationend', onFadeOut);
}

function animateLogReset(done) {
    const log = scene.getObjectByName('log');
    if (!log) { done?.(); return; }
    const camOffsetZ = camera.position.z - log.position.z; // keep current offset to log
    new TWEEN.Tween(log.position).to({ z: 1 }, 900).easing(TWEEN.Easing.Cubic.Out)
        .onUpdate(() => {
            camera.position.x = 0; camera.position.y = CAM_OFFSET.y;
            camera.position.z = log.position.z + camOffsetZ;
            camera.lookAt(0, 2, log.position.z);
        })
        .start();
    new TWEEN.Tween(log.rotation)
        .to({ x: 0 }, 900)
        .easing(TWEEN.Easing.Cubic.Out)
        .onComplete(() => { try { done?.(); } catch (e) { console.warn('animateLogReset done() error:', e); } })
        .start();
}