import * as THREE from 'three';
import { createVoxel } from '../utils/voxel.js';

const rockMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
const treeLeavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
const grassMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
const bushMat = new THREE.MeshLambertMaterial({ color: 0x3cb371 });

function createRNG(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function createTree(x, y, z, rng) {
    const g = new THREE.Group();
    const trunkHeight = 1.5 + rng() * 1.5;
    g.add(createVoxel(0, trunkHeight / 2, 0, 0.5, trunkHeight, 0.5, treeTrunkMat));
    const leavesY = trunkHeight;
    g.add(createVoxel(0, leavesY + 0.75, 0, 1.5, 1.5, 1.5, treeLeavesMat));
    g.add(createVoxel(0.5, leavesY + 0.4, 0.3, 1.2, 1.2, 1.2, treeLeavesMat));
    g.add(createVoxel(-0.4, leavesY + 0.5, -0.5, 1.3, 1.3, 1.3, treeLeavesMat));
    g.position.set(x, y, z);
    return g;
}

function createMountainSide(isLeft, rng) {
    const group = new THREE.Group();
    const sign = isLeft ? -1 : 1;
    const baseWidth = 8, baseDepth = 20, startY = 2, endY = -20;
    const bankEdgeX = 7;
    let currentY = startY, layerCount = 0;
    while (currentY > endY) {
        layerCount++;
        const layerHeight = 3 + rng() * 3;
        const widthIncrease = rng() * 2;
        const depthIncrease = rng() * 2;
        const layerWidth = baseWidth + (layerCount * widthIncrease);
        const layerDepth = baseDepth + (layerCount * depthIncrease);
        const layerX = sign * (bankEdgeX + layerWidth / 2 - 1);
        const layerZ = -5 + (rng() - 0.5) * 2;
        const layerY = currentY - layerHeight / 2;
        group.add(createVoxel(layerX, layerY, layerZ, layerWidth, layerHeight, layerDepth, rockMat));
        const detailRocks = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < detailRocks; i++) {
            const size = 1 + rng() * 2;
            const detailX = layerX + sign * (rng() * layerWidth - (layerWidth / 2));
            const detailY = currentY + size / 2;
            const detailZ = layerZ + (rng() - 0.5) * layerDepth;
            group.add(createVoxel(detailX, detailY, detailZ, size, size, size, rockMat));
        }
        currentY -= layerHeight;
    }
    return group;
}

function createBush(x, y, z, rng) {
    const g = new THREE.Group();
    g.add(createVoxel(0, 0.25, 0, 1.2, 0.6, 1.2, bushMat));
    g.add(createVoxel(0.5, 0.35, -0.2, 0.7, 0.5, 0.7, bushMat));
    g.add(createVoxel(-0.4, 0.3, 0.3, 0.8, 0.5, 0.6, bushMat));
    g.position.set(x, y, z);
    return g;
}

export function generateProceduralAssets(seed = 12345) {
    const group = new THREE.Group();
    group.name = "procedural-scenery";
    group.userData.seed = seed;
    const rng = createRNG(seed);

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

    group.add(createMountainSide(true, rng));
    group.add(createMountainSide(false, rng));

    // Dynamic Tree and Bush Placement
    const groundY = 2.1;
    const riverLength = 100;
    const bankLength = riverLength - 4;
    const bankWidth = 6;
    const numTrees = 50;
    for (let i = 0; i < numTrees; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const x = side * (riverHalfWidth + 1.0 + rng() * (bankWidth - 1.5));
        const z = -bankLength / 2 + 0.5 + rng() * (bankLength - 1);

        if (!isOccupied(x, z, 1.5)) {
            group.add(createTree(x, groundY, z, rng));
            occupy(x, z, 1.5);

            if (rng() > 0.65) {
                const bushX = x + (rng() - 0.5) * 3;
                const bushZ = z + (rng() - 0.5) * 3;
                const clampedBushX = side * Math.max(riverHalfWidth + 0.6, Math.min(Math.abs(bushX), riverHalfWidth + bankWidth - 0.6));
                if (!isOccupied(clampedBushX, bushZ, 1.0)) {
                    group.add(createBush(clampedBushX, groundY, bushZ, rng));
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
        const side = rng() < 0.5 ? -1 : 1;
        const x = side * (riverHalfWidth + 1.0 + rng() * (bankWidth - 1.5));
        const z = lowerRiverStartZ + 0.5 + rng() * (lowerRiverLength - 1);

        if (!isOccupied(x, z, 1.5)) {
            group.add(createTree(x, lowerGroundY, z, rng));
            occupy(x, z, 1.5);
            if (rng() > 0.65) {
                const bushX = x + (rng() - 0.5) * 3;
                const bushZ = z + (rng() - 0.5) * 3;
                const clampedBushX = side * Math.max(riverHalfWidth + 0.6, Math.min(Math.abs(bushX), riverHalfWidth + lowerBankWidth - 0.6));
                if (!isOccupied(clampedBushX, bushZ, 1.0)) {
                    group.add(createBush(clampedBushX, lowerGroundY, bushZ, rng));
                    occupy(clampedBushX, bushZ, 1.0);
                }
            }
        }
    }

    // Background rocks
    for (let i = 0; i < 12; i++) {
        const z = -26 - rng() * 24,
            x = (rng() < 0.5 ? -12 : 12) + (rng() * 4 - 2),
            w = 4 + rng() * 6,
            h = 1.5 + rng() * 2.5,
            d = 5 + rng() * 8;
        group.add(createVoxel(x, 1.2 - rng() * 1.5, z, w, h, d, rockMat));
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
        const z = -30 - (rng() * 180);
        const isFar = z < -120;
        const side = rng() < 0.5 ? -1 : 1;
        const x = side * (20 + rng() * 80);

        const w = 12 + rng() * (isFar ? 45 : 25);
        const d = 12 + rng() * (isFar ? 45 : 25);
        const h = 8 + rng() * (isFar ? 60 : 35);

        const y = -15 + h / 2;

        const mat = terrainColors[Math.floor(rng() * terrainColors.length)];
        distantTerrainGroup.add(createVoxel(x, y, z, w, h, d, mat));

        if (rng() > 0.5) {
            const w2 = w * (0.4 + rng() * 0.4);
            const d2 = d * (0.4 + rng() * 0.4);
            const h2 = h * (0.4 + rng() * 0.4);

            const xOffset = (rng() - 0.5) * (w - w2);
            let x2 = x + xOffset;
            const minX = riverHalfWidth + w2 / 2 + 1.0;
            x2 = side * Math.max(minX, Math.abs(x2));

            const z2 = z + (rng() - 0.5) * d;
            const y2 = y + (rng() - 0.5) * h * 0.5;
            distantTerrainGroup.add(createVoxel(x2, y2, z2, w2, h2, d2, mat));
        }
    }
    for (let i = 0; i < 80; i++) {
        const z = -120 - (rng() * 100);
        const side = rng() < 0.5 ? -1 : 1;
        const x = side * (25 + rng() * 100);

        const w = 20 + rng() * 50;
        const d = 20 + rng() * 50;
        const h = 50 + rng() * 70;

        const y = 10 + h / 2;

        const mat = terrainColors[Math.floor(rng() * terrainColors.length)];
        distantTerrainGroup.add(createVoxel(x, y, z, w, h, d, mat));
    }
    for (let i = 0; i < 150; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const z = -40 - (rng() * 120);
        const x = side * (12 + rng() * 60);

        const w = 8 + rng() * 20;
        const d = 8 + rng() * 20;
        const h = 0.5 + rng() * 4;

        const y = 15 + rng() * 30;

        const mat = terrainColors[Math.floor(rng() * 2)];
        distantTerrainGroup.add(createVoxel(x, y, z, w, h, d, mat));

        if (rng() > 0.6) {
            let detailX = x + (rng() - 0.5) * w;
            const detailZ = z + (rng() - 0.5) * d;
            const minDetailX = riverHalfWidth + 1.5;
            if (side > 0) {
                detailX = Math.max(minDetailX, detailX);
            } else {
                detailX = Math.min(-minDetailX, detailX);
            }
            if (!isOccupied(detailX, detailZ, 1.5)) {
                if (rng() > 0.4) {
                    distantTerrainGroup.add(createTree(detailX, y + h / 2, detailZ, rng));
                } else {
                    distantTerrainGroup.add(createBush(detailX, y + h / 2, detailZ, rng));
                }
                occupy(detailX, detailZ, 1.5);
            }
        }
    }
    group.add(distantTerrainGroup);

    return group;
}