import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useRef, useEffect, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { createBear } from "../entities/bear.js";
import { createFish } from "../entities/fish.js";
import { createScenery } from "../entities/scenery.js";
import { createWaterfall } from "../entities/waterfall.js";
const ReplayComposition = ({ replayData }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const bearRef = useRef(null);
  const fishGroupRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !replayData) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(8900331);
    scene.fog = new THREE.Fog(8900331, 50, 220);
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(60, 540 / 960, 1, 1e3);
    camera.position.set(0, 12, 9);
    camera.lookAt(0, 2, 0);
    cameraRef.current = camera;
    const ambientLight = new THREE.AmbientLight(16777215, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(16777215, 0.8);
    dirLight.position.set(10, 20, 5);
    scene.add(dirLight);
    const scenery = createScenery();
    scene.add(scenery);
    const waterfall = createWaterfall();
    scene.add(waterfall);
    const bear = createBear(replayData.bearType || "splashy", replayData.cosmeticId);
    scene.add(bear);
    bearRef.current = bear;
    const fishGroup = new THREE.Group();
    scene.add(fishGroup);
    fishGroupRef.current = fishGroup;
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false
    });
    renderer.setSize(540, 960);
    rendererRef.current = renderer;
    const resize = () => {
      const parent = canvasRef.current.parentElement;
      if (parent) {
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    };
    resize();
    return () => {
      renderer.dispose();
    };
  }, []);
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !bearRef.current || !replayData) return;
    const frameIndex = Math.floor(frame);
    const frameData = replayData.frames[Math.min(frameIndex, replayData.frames.length - 1)];
    if (frameData) {
      const b = bearRef.current;
      if (frameData.bp) b.position.set(...frameData.bp);
      if (frameData.br) b.rotation.set(...frameData.br);
      const CAM_OFFSET_Y = 12;
      const CAM_OFFSET_Z = 9;
      const camera = cameraRef.current;
      camera.position.z = b.position.z + CAM_OFFSET_Z;
      camera.position.y = CAM_OFFSET_Y;
      camera.lookAt(0, 2, b.position.z);
      const fishGroup = fishGroupRef.current;
      const activeIds = /* @__PURE__ */ new Set();
      frameData.f.forEach((fData, idx) => {
        const id = `fish_${idx}`;
        activeIds.add(id);
        let fish = fishGroup.children.find((c) => c.name === id);
        if (!fish) {
          if (fishGroup.children[idx]) {
            fish = fishGroup.children[idx];
          } else {
            fish = createFish(sceneRef.current, 0, fData.t, {}, false);
            fishGroup.add(fish);
          }
        }
        if (fish.userData.fishType !== fData.t) {
          fishGroup.remove(fish);
          fish = createFish(sceneRef.current, 0, fData.t, {}, false);
          fishGroup.add(fish);
        }
        fish.visible = true;
        fish.position.set(...fData.p);
        fish.rotation.set(...fData.r);
      });
      for (let i = frameData.f.length; i < fishGroup.children.length; i++) {
        fishGroup.children[i].visible = false;
      }
    }
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, [frame, replayData]);
  return /* @__PURE__ */ jsxDEV("canvas", { ref: canvasRef, style: { width: "100%", height: "100%" } }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 157,
    columnNumber: 10
  });
};
export {
  ReplayComposition
};
