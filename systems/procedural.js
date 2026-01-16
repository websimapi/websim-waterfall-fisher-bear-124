import * as THREE from 'three';
import { createVoxel } from '../utils/voxel.js';

const rockMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
const treeLeavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
const grassMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
const bushMat = new THREE.MeshLambertMaterial({ color: 0x3cb371 });

function createTree(x, y, z) {
    const g = new THREE.Group();
    const trunkHeight = 1.5 + Math.random() * 1.5;
    g.add(createVoxel(0, trunkHeight / 2, 0, 0.5, trunkHeight, 0.5, treeTrunkMat));
    const leavesY = trunkHeight;
    g.add(createVoxel(0, leavesY + 0.75, 0, 1.5, 1.5, 1.5, treeLeavesMat));
    g.add(createVoxel(0.5, leavesY + 0.4, 0.3, 1.2, 1.2, 1.2, treeLeavesMat));
    g.add(createVoxel(-0.4, leavesY + 0.5, -0.5, 1.3, 1.3, 1.3, treeLeavesMat));
    g.position.set(x, y, z);
    return g;
}

function createMountainSide(isLeft) {
    const group = new THREE.Group();
    const sign = isLeft ? -1 : 1;
    const baseWidth = 8, baseDepth = 20, startY = 2, endY = -20;
    const bankEdgeX = 7;
    let currentY = startY, layerCount = 0;
    while (currentY > endY) {
        layerCount++;
        const layerHeight = 3 + Math.random() * 3;
        const widthIncrease = Math.random() * 2;
        const depthIncrease = Math.random() * 2;
        const layerWidth = baseWidth + (layerCount * widthIncrease);
        const layerDepth = baseDepth + (layerCount * depthIncrease);
        const layerX = sign * (bankEdgeX + layerWidth / 2 - 1);
        const layerZ = -5 + (Math.random() - 0.5) * 2;
        const layerY = currentY - layerHeight / 2;
        group.add(createVoxel(layerX, layerY, layerZ, layerWidth, layerHeight, layerDepth, rockMat));
        const detailRocks = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < detailRocks; i++) {
            const size = 1 + Math.random() * 2;
            const detailX = layerX + sign * (Math.random() * layerWidth - (layerWidth / 2));
            const detailY = currentY + size / 2;
            const detailZ = layerZ + (Math.random() - 0.5) * layerDepth;
            group.add(createVoxel(detailX, detailY, detailZ, size, size, size, rockMat));
        }
        currentY -= layerHeight;
    }
    return group;
}

function createBush(x, y, z) {
    const g = new THREE.Group();
    g.add(createVoxel(0, 0.25, 0, 1.2, 0.6, 1.2, bushMat));
    g.add(createVoxel(0.5, 0.35, -0.2, 0.7, 0.5, 0.7, bushMat));
    g.add(createVoxel(-0.4, 0.3, 0.3, 0.8, 0.5, 0.6, bushMat));
    g.position.set(x, y, z);
    return g;
}

export function generateProceduralAssets() {
    const group = new THREE.Group();
    group.name = "procedural-scenery";

    const placementGrid = new Map();
    const gridCellSize = 2.0;
    const riverHalfWidth = 4.0;

    function getGridKey(x, z) {
        return `${Math.floor(x / gridCellSize)},${Math.floor((z + 200) / gridCellSize)}`;
    }

    function isOccupied(x, z, objectRadius = 1.0) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const key = getGridKey(x + i * objectRadius, z + j * objectRadius);
                if (placementGrid.has(key)) return true;
            }
        }
        return false;
    }

    function occupy(x, z, objectRadius = 1.0) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const key = getGridKey(x + i * objectRadius, z + j * objectRadius);
                placementGrid.set(key, true);
            }
        }
    }

    group.add(createMountainSide(true));
    group.add(createMountainSide(false));

    // Dynamic Tree and Bush Placement
    const groundY = 2.1;
    const riverLength = 100;
    const bankLength = riverLength - 4;
    const bankWidth = 6;
    const numTrees = 50;
    for (let i = 0; i < numTrees; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side * (riverHalfWidth + 1.0 + Math.random() * (bankWidth - 1.5));
        const z = -bankLength / 2 + 0.5 + Math.random() * (bankLength - 1);

        if (!isOccupied(x, z, 1.5)) {
            group.add(createTree(x, groundY, z));
            occupy(x, z, 1.5);

            if (Math.random() > 0.65) {
                const bushX = x + (Math.random() - 0.5) * 3;
                const bushZ = z + (Math.random() - 0.5) * 3;
                const clampedBushX = side * Math.max(riverHalfWidth + 0.6, Math.min(Math.abs(bushX), riverHalfWidth + bankWidth - 0.6));
                if (!isOccupied(clampedBushX, bushZ, 1.0)) {
                    group.add(createBush(clampedBushX, groundY, bushZ));
                    occupy(clampedBushX, bushZ, 1.0);
                }
            }
        }
    }

    // Dynamic Tree and Bush Placement for Lower Banks
    const waterfallBottomY = -18.1;
    const lowerGroundY = waterfallBottomY + 0.3;
    const lowerRiverLength = 80;
    const lowerRiverStartZ = 2.5;
    const lowerBankWidth = 6;
    const numTreesLower = 40;
    for (let i = 0; i < numTreesLower; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side * (riverHalfWidth + 1.0 + Math.random() * (lowerBankWidth - 1.5));
        const z = lowerRiverStartZ + 0.5 + Math.random() * (lowerRiverLength - 1);

        if (!isOccupied(x, z, 1.5)) {
            group.add(createTree(x, lowerGroundY, z));
            occupy(x, z, 1.5);
            if (Math.random() > 0.65) {
                const bushX = x + (Math.random() - 0.5) * 3;
                const bushZ = z + (Math.random() - 0.5) * 3;
                const clampedBushX = side * Math.max(riverHalfWidth + 0.6, Math.min(Math.abs(bushX), riverHalfWidth + lowerBankWidth - 0.6));
                if (!isOccupied(clampedBushX, bushZ, 1.0)) {
                    group.add(createBush(clampedBushX, lowerGroundY, bushZ));
                    occupy(clampedBushX, bushZ, 1.0);
                }
            }
        }
    }

    // Background rocks
    for (let i = 0; i < 12; i++) {
        const z = -26 - Math.random() * 24,
            x = (Math.random() < 0.5 ? -12 : 12) + (Math.random() * 4 - 2),
            w = 4 + Math.random() * 6,
            h = 1.5 + Math.random() * 2.5,
            d = 5 + Math.random() * 8;
        group.add(createVoxel(x, 1.2 - Math.random() * 1.5, z, w, h, d, rockMat));
    }

    // Distant Terrain
    const distantTerrainGroup = new THREE.Group();
    const terrainColors = [
        grassMat,
        rockMat,
        new THREE.MeshLambertMaterial({ color: 0x287a4b }),
        new THREE.MeshLambertMaterial({ color: 0x707070 })
    ];
    for (let i = 0; i < 250; i++) {
        const z = -30 - (Math.random() * 180);
        const isFar = z < -120;
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side * (20 + Math.random() * 80);

        const w = 12 + Math.random() * (isFar ? 45 : 25);
        const d = 12 + Math.random() * (isFar ? 45 : 25);
        const h = 8 + Math.random() * (isFar ? 60 : 35);

        const y = -15 + h / 2;

        const mat = terrainColors[Math.floor(Math.random() * terrainColors.length)];
        distantTerrainGroup.add(createVoxel(x, y, z, w, h, d, mat));

        if (Math.random() > 0.5) {
            const w2 = w * (0.4 + Math.random() * 0.4);
            const d2 = d * (0.4 + Math.random() * 0.4);
            const h2 = h * (0.4 + Math.random() * 0.4);

            const xOffset = (Math.random() - 0.5) * (w - w2);
            let x2 = x + xOffset;
            const minX = riverHalfWidth + w2 / 2 + 1.0;
            x2 = side * Math.max(minX, Math.abs(x2));

            const z2 = z + (Math.random() - 0.5) * d;
            const y2 = y + (Math.random() - 0.5) * h * 0.5;
            distantTerrainGroup.add(createVoxel(x2, y2, z2, w2, h2, d2, mat));
        }
    }
    for (let i = 0; i < 80; i++) {
        const z = -120 - (Math.random() * 100);
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side * (25 + Math.random() * 100);

        const w = 20 + Math.random() * 50;
        const d = 20 + Math.random() * 50;
        const h = 50 + Math.random() * 70;

        const y = 10 + h / 2;

        const mat = terrainColors[Math.floor(Math.random() * terrainColors.length)];
        distantTerrainGroup.add(createVoxel(x, y, z, w, h, d, mat));
    }
    for (let i = 0; i < 150; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const z = -40 - (Math.random() * 120);
        const x = side * (12 + Math.random() * 60);

        const w = 8 + Math.random() * 20;
        const d = 8 + Math.random() * 20;
        const h = 0.5 + Math.random() * 4;

        const y = 15 + Math.random() * 30;

        const mat = terrainColors[Math.floor(Math.random() * 2)];
        distantTerrainGroup.add(createVoxel(x, y, z, w, h, d, mat));

        if (Math.random() > 0.6) {
            let detailX = x + (Math.random() - 0.5) * w;
            const detailZ = z + (Math.random() - 0.5) * d;
            const minDetailX = riverHalfWidth + 1.5;
            if (side > 0) {
                detailX = Math.max(minDetailX, detailX);
            } else {
                detailX = Math.min(-minDetailX, detailX);
            }
            if (!isOccupied(detailX, detailZ, 1.5)) {
                if (Math.random() > 0.4) {
                    distantTerrainGroup.add(createTree(detailX, y + h / 2, detailZ));
                } else {
                    distantTerrainGroup.add(createBush(detailX, y + h / 2, detailZ));
                }
                occupy(detailX, detailZ, 1.5);
            }
        }
    }
    group.add(distantTerrainGroup);

    return group;
}