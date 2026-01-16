import * as THREE from 'three';
import { scene } from '../scene.js';
import { getHandAnchor } from '../entities/bear.js';
import { updateFish } from '../entities/fish.js';
import { playSFX, sounds } from './audio.js';
import * as TWEEN from 'tween';

export function handleFishInteractions(bear, activeFishes, gameState, updateUIValues, dt = 1/60) {
    const catchZ = bear.position.z - 0.9, failZ = bear.position.z - 0.6;
    for (let i = activeFishes.length - 1; i >= 0; i--) {
        const f = activeFishes[i];
        updateFish(f, dt);
        if (f.userData?.thrown) {
            if (f.position.y < -10 || Math.abs(f.position.x) > 30 || f.position.z > 20) { 
                scene.remove(f); 
                activeFishes.splice(i,1); 
            }
            continue;
        }
        if (f.userData?.caught) continue;
        if (f.position.z >= catchZ) {
            const half = (bear.userData.netWidth || 1) / 2, buffer = 0.35;
            const dx = Math.abs(f.position.x - bear.position.x);
            const withinX = dx <= half + buffer;
            if (withinX) {
                playSFX(sounds.catch);
                gameState.score += computeFishScore(f, gameState.streak);
                gameState.streak++;
                updateUIValues({ score: gameState.score, streak: gameState.streak });
                grabAndThrow(f, bear);
            } else if (f.position.z > failZ && dx > half + buffer + 0.25) {
                gameState.streak = 1;
                updateUIValues({ score: gameState.score, streak: gameState.streak });
                scene.remove(f); 
                activeFishes.splice(i,1);
                return true;
            }
        }
    }
    return false;
}

function computeFishScore(fish, streak) {
    const ud = fish.userData || {};
    const base = 10;
    const weightBonus = Math.round(ud.weight ? ud.weight * 60 : 0);
    const rareBonusMult = ud.rareTiny ? 3 : 1;
    const raw = (base + weightBonus) * rareBonusMult * Math.max(1, streak);
    return Math.max(1, Math.round(raw / 100));
}

function grabAndThrow(fish, bear) {
    if (!bear || !fish || fish.userData?.thrown) return;
    if (!fish.userData) fish.userData = {};
    fish.userData.caught = true;
    if (!fish.userData.velocity || !fish.userData.velocity.set) fish.userData.velocity = new THREE.Vector3(0,0,0);
    const side = fish.position.x >= bear.position.x ? 'right' : 'left';
    let hand = getHandAnchor(bear, side) || getHandAnchor(bear, side === 'right' ? 'left' : 'right');
    if (!hand) return;
    const arm = bear.getObjectByName(side==='right'?'rightArm':'leftArm') || bear.getObjectByName(side==='right'?'leftArm':'rightArm');
    if (!arm || !arm.rotation) return;
    const isRight = arm?.name === 'rightArm';
    const dir = isRight ? 1 : -1; // +X for right-hand throws, -X for left-hand
    fish.userData.velocity.set(0,0,0); fish.userData.pattern = 'held';
    if (fish.parent) fish.parent.remove(fish); hand.add(fish);
    fish.position.set(0.08 * (isRight?1:-1), -0.35, 0.30);
    fish.rotation.set(-Math.PI/6, isRight?Math.PI/2:-Math.PI/2, Math.PI);
    const easeInOut = (TWEEN.Easing && TWEEN.Easing.Sine && TWEEN.Easing.Sine.InOut) || ((k)=>k);
    const easeOut = (TWEEN.Easing && TWEEN.Easing.Sine && TWEEN.Easing.Sine.Out) || ((k)=>k);
    const wig={t:0}, lin=(TWEEN.Easing?.Linear?.None)||((k)=>k);
    const heldTw=new TWEEN.Tween(wig).to({t:Math.PI*2},900).easing(lin).onUpdate(()=>{
      const ud=fish.userData||{}, ph=wig.t, ts=Math.sin(ph)*0.18;
      if(ud.tailV) ud.tailV.rotation.y=ts; if(ud.tailH) ud.tailH.rotation.y=ts;
      if(ud.bones && ud.boneCount){
        for(let i=0;i<ud.bones.length;i++){
          const t=i/(ud.boneCount-1);
          const w=Math.pow(THREE.MathUtils.smoothstep(t,0.2,1.0),1.35);
          ud.bones[i].rotation.y=Math.sin(ph+t*Math.PI*1.6)*(ud.wiggleRotAmp||0.24)*0.75*w;
        }
      }
    }).repeat(Infinity).onRepeat(()=>{ wig.t=0; }).start();
    fish.userData.heldWiggle=heldTw;
    const bend1 = new TWEEN.Tween(bear.rotation).to({ x: -0.28 }, 140).easing(easeInOut);
    const prep  = new TWEEN.Tween(arm.rotation).to({ x: -0.6 }, 140).easing(easeInOut);
    const throwTw = new TWEEN.Tween(arm.rotation).to({ x: 1.25 }, 180).easing(easeOut).onStart(()=>{
        hand.updateMatrixWorld(true);
        fish.updateMatrixWorld(true);
        try { fish.userData.heldWiggle?.stop(); } catch {}
        const wp = new THREE.Vector3(); const wq = new THREE.Quaternion();
        fish.getWorldPosition(wp); fish.getWorldQuaternion(wq);
        if (fish.parent) hand.remove(fish), scene.add(fish);
        fish.position.copy(wp); fish.quaternion.copy(wq);
        fish.userData.thrown = true;
        fish.userData.pattern = 'thrown'; // ensure update loop applies throw physics
        fish.userData.velocity = new THREE.Vector3(0.22*dir, 0.36, 0.06);
        fish.userData.angularVel = new THREE.Vector3((Math.random()*0.8-0.4), (Math.random()*1.6-0.8)*dir, (Math.random()*1.0-0.5));
        playSFX(sounds.whoosh);
    });
    
    // ADDED: Arm rotation X recovery back to its neutral point (0)
    const armRecover = new TWEEN.Tween(arm.rotation).to({ x: 0 }, 220).easing(easeOut);

    const recover = new TWEEN.Tween(bear.rotation).to({ x: 0 }, 220).easing(easeOut);
    bend1.start(); prep.start(); bend1.chain(recover); prep.chain(throwTw);
    throwTw.chain(armRecover); // Chain arm recovery
}