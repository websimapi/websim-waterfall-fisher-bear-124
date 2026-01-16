import * as THREE from 'three';

/**
 * Creates a voxel (a cube mesh) with specified dimensions and material.
 * @param {number} x - The x-coordinate of the voxel's center.
 * @param {number} y - The y-coordinate of the voxel's center.
 * @param {number} z - The z-coordinate of the voxel's center.
 * @param {number} w - The width of the voxel.
 * @param {number} h - The height of the voxel.
 * @param {number} d - The depth of the voxel.
 * @param {THREE.Material} mat - The material to apply to the voxel.
 * @returns {THREE.Mesh} The created voxel mesh.
 */
export function createVoxel(x, y, z, w, h, d, mat) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    return mesh;
}