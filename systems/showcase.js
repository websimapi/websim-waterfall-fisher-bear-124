import * as THREE from 'three';
import { scene } from '../scene.js';
import { createBear, getHandAnchor } from '../entities/bear.js';
import { createFish } from '../entities/fish.js';
import { getPlayerProgress } from '../unlocks.js';
import { initAudio, playSFX, sounds } from './audio.js';
import * as TWEEN from 'tween';

export let showcaseBear = null;
export let showcaseFish = null;

/** 
 * [FIX] Technical Note: The 'missing arm' bug on retry was due to improper 
 * disposal of THREE.js objects. Simply removing an object from the scene 
 * doesn't free up its geometry and material data from GPU memory. This 
 * function ensures a deep disposal of an object and all its children.
 * It's called on the old `showcaseBear` before creating a new one to prevent 
 * state corruption and rendering glitches.
 */
function disposeObject(obj) {
    if (!obj) return;

    // Dispose of children first
    while (obj.children.length > 0) {
        disposeObject(obj.children[0]);
        obj.remove(obj.children[0]);
    }

    // Dispose of the object itself
    if (obj.isMesh) {
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        // [FIX] DO NOT dispose materials. They are shared constants across 
        // different bear/fish instances. Disposing them globally breaks 
        // any future objects that try to use them. Geometries are created 
        // uniquely per part, so they are safe to dispose.
        /* if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(material => material.dispose());
            } else {
                obj.material.dispose();
            }
        } */
    }
}

export function createOrUpdateShowcase() {
    const playerProgress = getPlayerProgress();
    console.log("[SHOWCASE] Starting showcase creation/update");
    console.log("[SHOWCASE] Current showcase bear exists:", !!showcaseBear);
    console.log("[SHOWCASE] Selected bear type:", playerProgress.selectedBear);
    console.log("[SHOWCASE] Selected fish type:", playerProgress.selectedFish);

    // [FIX] ALWAYS recreate showcase objects on retry to prevent corruption
    // Instead of trying to reuse potentially corrupted objects, start fresh
    if (showcaseBear) {
        console.log("[SHOWCASE] Removing existing showcase bear");
        // Simple removal without complex disposal that can break hierarchy
        scene.remove(showcaseBear);
        showcaseBear = null;
        showcaseFish = null;
    }

    // Create fresh bear
    console.log("[SHOWCASE] Creating new showcase bear of type:", playerProgress.selectedBear);
    showcaseBear = createBear(playerProgress.selectedBear, playerProgress.selectedCosmetic || null);
    showcaseBear.name = 'showcase-bear';
    showcaseBear.userData.isShowcase = true;
    showcaseBear.userData.bearType = playerProgress.selectedBear;
    showcaseBear.userData.cosmeticId = playerProgress.selectedCosmetic || 'none';
    showcaseBear.position.set(0, 4.65, 0.8);
    showcaseBear.rotation.x = 0; // keep facing direction from createBear()
    showcaseBear.rotation.z = 0;
    showcaseBear.rotation.y = 0; // face forward toward the log/camera
    scene.add(showcaseBear);

    // Rig now has stable hand anchors; attach fish to right-hand anchor
    const rightAnchor = getHandAnchor(showcaseBear, 'right');
    console.log("[SHOWCASE] Right hand anchor present:", !!rightAnchor);

    // Create fresh fish
    console.log("[SHOWCASE] Creating new showcase fish of type:", playerProgress.selectedFish);
    showcaseFish = createFish(scene, 0, playerProgress.selectedFish, {}, false);
    showcaseFish.name = 'showcase-fish';
    showcaseFish.userData.fishType = playerProgress.selectedFish;
    if (showcaseFish.userData?.velocity) showcaseFish.userData.velocity.set(0, 0, 0);
    if (showcaseFish.userData) showcaseFish.userData.swimAmplitude = 0;
    // ensure any previous showcaseFish is detached from old parents
    if (showcaseFish.parent) showcaseFish.parent.remove(showcaseFish);

    // Attach fish to bear's hand with error checking
    if (rightAnchor) {
        rightAnchor.add(showcaseFish);
        showcaseFish.position.set(0.12, -0.35, 0.35);
        showcaseFish.rotation.set(-Math.PI/6, Math.PI/2, Math.PI);
        showcaseFish.scale.set(0.5, 0.5, 0.5);
        showcaseFish.visible = true;
        if (showcaseFish.userData) showcaseFish.userData.pattern = 'held';
        showcaseFish.traverse((o) => { if (o.isMesh || o.isGroup) o.frustumCulled = false; });
        console.log("[SHOWCASE] Fish attached to hand anchor");
    }

    // Ensure showcase bear is visible
    if (showcaseBear) {
        showcaseBear.visible = true;
        showcaseBear.updateMatrixWorld(true);
        console.log("[SHOWCASE] Showcase bear set to visible");
    }

    setupShowcaseAnimation(); // start new tween-based idle animation

    console.log("[SHOWCASE] Showcase creation completed");
}

export function setupShowcaseAnimation() {
    if (!showcaseBear) return;
    if (!TWEEN || !TWEEN.Tween) { console.warn("[SHOWCASE] TWEEN not ready; skipping animation"); return; }
    const easingInOut = (TWEEN.Easing && TWEEN.Easing.Sine && TWEEN.Easing.Sine.InOut) || (TWEEN.Easing?.Linear?.None) || ((k)=>k);
    const arm = showcaseBear.getObjectByName('rightArm');
    if (arm?.rotation) new TWEEN.Tween(arm.rotation).to({ x: -0.35 }, 900).easing(easingInOut).yoyo(true).repeat(Infinity).start();
    if (showcaseFish) {
        // lock fish at hand; animate only tail + body segments for a held wiggle
        const wiggle = { t: 0 };
        const lin = (TWEEN.Easing?.Linear?.None) || ((k)=>k);
        const tw = new TWEEN.Tween(wiggle)
          .to({ t: Math.PI * 2 }, 1200)
          .easing(lin)
          .onUpdate(() => {
              if (!showcaseFish) { try { tw.stop(); } catch {} return; }
              const ud = showcaseFish.userData || {};
              const phase = wiggle.t;
              const tailSwing = Math.sin(phase) * 0.18;
              if (ud.tailV) ud.tailV.rotation.y = tailSwing;
              if (ud.tailH) ud.tailH.rotation.y = tailSwing;
              if (ud.bones && ud.boneCount) {
                  for (let i = 0; i < ud.bones.length; i++) {
                      const t = i / (ud.boneCount - 1);
                      const weight = Math.pow(THREE.MathUtils.smoothstep(t, 0.2, 1.0), 1.35);
                      ud.bones[i].rotation.y = Math.sin(phase + t * Math.PI * 1.6) * (ud.wiggleRotAmp || 0.24) * 0.75 * weight;
                  }
              }
          })
          .repeat(Infinity)
          .onRepeat(()=>{ wiggle.t = 0; })
          .start();
    }
}

export function throwShowcaseFish(done) {
    if (!showcaseBear || !showcaseFish) return done?.();
    const hand = getHandAnchor(showcaseBear, 'right');
    const arm = showcaseBear.getObjectByName('rightArm');
    if (!hand || !arm) return done?.();
    const easeInOut = (TWEEN.Easing && TWEEN.Easing.Sine && TWEEN.Easing.Sine.InOut) || ((k)=>k);
    const easeOut = (TWEEN.Easing && TWEEN.Easing.Sine && TWEEN.Easing.Sine.Out) || ((k)=>k);
    const bend1 = new TWEEN.Tween(showcaseBear.rotation).to({ x: -0.28 }, 140).easing(easeInOut);
    const prep  = new TWEEN.Tween(arm.rotation).to({ x: -0.6 }, 140).easing(easeInOut);
    const throwTw = new TWEEN.Tween(arm.rotation).to({ x: 1.25 }, 180).easing(easeOut).onStart(()=>{
        // preserve world transform from hand before detaching
        hand.updateMatrixWorld(true);
        showcaseFish.updateMatrixWorld(true);
        const wp = new THREE.Vector3(); const wq = new THREE.Quaternion();
        showcaseFish.getWorldPosition(wp); showcaseFish.getWorldQuaternion(wq);
        if (showcaseFish.parent) hand.remove(showcaseFish), scene.add(showcaseFish);
        showcaseFish.position.copy(wp); showcaseFish.quaternion.copy(wq);
        showcaseFish.userData.thrown = true;
        showcaseFish.userData.pattern = 'thrown'; // switch off 'held' so throw anim updates
        showcaseFish.userData.velocity = new THREE.Vector3(-0.22, 0.36, 0.06);
        showcaseFish.userData.angularVel = new THREE.Vector3((Math.random()*0.8-0.4), (Math.random()*1.6-0.8), (Math.random()*1.0-0.5));
        (async ()=>{ try { await initAudio(); } catch {} playSFX(sounds.whoosh); })();
        setTimeout(()=>{ try { scene.remove(showcaseFish); } catch {} showcaseFish = null; done?.(); }, 650);
    });
    const recover = new TWEEN.Tween(showcaseBear.rotation).to({ x: 0 }, 220).easing(easeOut);

    // ADDED: Arm rotation X recovery back to its neutral point (0)
    const armRecover = new TWEEN.Tween(arm.rotation).to({ x: 0 }, 220).easing(easeOut);

    bend1.start(); prep.start(); bend1.chain(recover); prep.chain(throwTw);
    throwTw.chain(armRecover); // Chain arm recovery
}

export function walkInShowcaseBear(fromRight, done) {
    if (showcaseBear) {
        const fromRightResolved = typeof fromRight === 'boolean' ? fromRight : Math.random() < 0.5;
        showcaseBear.userData.fromRight = fromRightResolved;
        showcaseBear.position.set(fromRightResolved ? 12 : -12, 4.65, 0.8);
        showcaseBear.visible = true;
        // face toward the log along X while walking in
        showcaseBear.rotation.y = fromRightResolved ? -Math.PI/2 : Math.PI/2;
        const startX = showcaseBear.position.x, endX = 0, baseY = 4.65;
        const duration = 2400;
        const walkTw = new TWEEN.Tween(showcaseBear.position)
            .to({ x: endX }, duration)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                if (!showcaseBear) { try { walkTw.stop(); } catch {} return; }
                const total = Math.max(0.0001, Math.abs(startX - endX));
                const progress = 1 - (Math.abs(showcaseBear.position.x - endX) / total);
                const phase = progress * Math.PI * 6;
                showcaseBear.rotation.z = Math.sin(phase) * 0.18 * (fromRightResolved ? -1 : 1);
                showcaseBear.position.y = baseY + Math.abs(Math.sin(phase)) * 0.12;
            })
            .onComplete(() => { 
                showcaseBear.rotation.z = 0; showcaseBear.position.y = baseY; 
                const dur2 = 800, easeRot = TWEEN.Easing?.Cubic?.InOut || ((k)=>k), easeWob = TWEEN.Easing?.Sine?.InOut || ((k)=>k);
                new TWEEN.Tween(showcaseBear.rotation).to({ y: 0 }, dur2).easing(easeRot).start();
                const wob = { t: 0 };
                new TWEEN.Tween(wob).to({ t: 1 }, dur2).easing(easeWob).onUpdate(()=>{ const ph = wob.t * Math.PI * 4; showcaseBear.rotation.z = Math.sin(ph) * 0.12; showcaseBear.position.y = baseY + Math.abs(Math.sin(ph)) * 0.08; }).onComplete(()=>{ showcaseBear.rotation.z = 0; showcaseBear.position.y = baseY; try { done?.(); } catch {} window.__canQuickStart = true; window.dispatchEvent(new CustomEvent('showcase:ready')); }).start();
            })
            .start();
    }
}

export function waddleOutShowcaseBear(toRight = true, done) {
    if (!showcaseBear) return done?.();
    const baseY = 4.65, targetX = toRight ? 12 : -12, faceY = toRight ? Math.PI / 2 : -Math.PI / 2;
    const durTurn = 800, easeRot = TWEEN.Easing?.Cubic?.InOut || ((k)=>k), easeWob = TWEEN.Easing?.Sine?.InOut || ((k)=>k);
    const wob = { t: 0 };
    new TWEEN.Tween(wob).to({ t: 1 }, durTurn).easing(easeWob)
      .onUpdate(()=>{ const ph = wob.t * Math.PI * 4; showcaseBear.rotation.z = Math.sin(ph)*0.12; showcaseBear.position.y = baseY + Math.abs(Math.sin(ph))*0.08; })
      .onComplete(()=>{ showcaseBear.rotation.z = 0; showcaseBear.position.y = baseY; })
      .start();
    new TWEEN.Tween(showcaseBear.rotation).to({ y: faceY }, durTurn).easing(easeRot)
      .onComplete(() => {
        const startX = showcaseBear.position.x;
        new TWEEN.Tween(showcaseBear.position).to({ x: targetX }, 1400).easing(TWEEN.Easing.Quadratic.In)
          .onUpdate(() => { const t = (showcaseBear.position.x - startX) / (targetX - startX); const ph = t * Math.PI * 6; if (showcaseBear) { showcaseBear.rotation.z = Math.sin(ph) * 0.18 * (toRight ? -1 : 1); showcaseBear.position.y = baseY + Math.abs(Math.sin(ph)) * 0.12; } })
          .onComplete(() => { if (showcaseBear) { showcaseBear.rotation.z = 0; showcaseBear.position.y = baseY; try { scene.remove(showcaseBear); } catch {} showcaseBear = null; } done?.(); })
          .start();
      }).start();
}

export function swapShowcaseToCurrentSelection() {
    const progress = getPlayerProgress();
    const newBearType = progress.selectedBear;
    const newFishType = progress.selectedFish;
    const newCosmeticId = progress.selectedCosmetic || 'none';
    const oldBearType = showcaseBear?.userData?.bearType;
    const oldCosmeticId = showcaseBear?.userData?.cosmeticId || 'none';

    // If bear type or cosmetic is different, we need to swap the bear.
    const bearNeedsSwap = oldBearType !== newBearType || oldCosmeticId !== newCosmeticId;
    
    if (showcaseBear && !bearNeedsSwap) {
        // Only fish changed, or nothing changed. Swap fish if needed.
        if (showcaseFish?.userData?.fishType !== newFishType) {
            const rightAnchor = getHandAnchor(showcaseBear, 'right');
            if (rightAnchor) {
                if (showcaseFish?.parent) showcaseFish.parent.remove(showcaseFish);
                showcaseFish = createFish(scene, 0, newFishType, {}, false);
                showcaseFish.name = 'showcase-fish';
                showcaseFish.userData.fishType = newFishType;
                showcaseFish.userData.pattern = 'held';
                rightAnchor.add(showcaseFish);
                showcaseFish.position.set(0.12, -0.35, 0.35);
                showcaseFish.rotation.set(-Math.PI/6, Math.PI/2, Math.PI);
                showcaseFish.scale.set(0.5,0.5,0.5);
                setupShowcaseAnimation();
            }
        }
        return;
    }

    // Bear (or cosmetic) changed -> animate old off, spawn new and walk in
    if (showcaseBear) {
        const leaveToRight = !(showcaseBear.userData?.fromRight);
        waddleOutShowcaseBear(leaveToRight, () => { createOrUpdateShowcase(); walkInShowcaseBear(leaveToRight); });
    } else {
        createOrUpdateShowcase();
        walkInShowcaseBear();
    }
}