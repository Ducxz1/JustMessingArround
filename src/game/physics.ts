/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BlockType } from '../types';
import { VoxelWorld } from './world';

export interface Box {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

// Check if two boxes overlap
export function intersectBoxes(a: Box, b: Box): boolean {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}

// Get raw collidable blocks intersecting the search boundary
export function getCollidingBlocks(entityBox: Box, world: VoxelWorld): Box[] {
  const minX = Math.floor(entityBox.minX);
  const maxX = Math.ceil(entityBox.maxX);
  const minY = Math.floor(entityBox.minY);
  const maxY = Math.ceil(entityBox.maxY);
  const minZ = Math.floor(entityBox.minZ);
  const maxZ = Math.ceil(entityBox.maxZ);

  const list: Box[] = [];

  for (let x = minX; x < maxX; x++) {
    for (let y = minY; y < maxY; y++) {
      for (let z = minZ; z < maxZ; z++) {
        const type = world.getBlock(x, y, z);
        // Lava is passable, other non-air are solid
        if (type !== BlockType.AIR && type !== BlockType.LAVA) {
          list.push({
            minX: x,
            minY: y,
            minZ: z,
            maxX: x + 1,
            maxY: y + 1,
            maxZ: z + 1,
          });
        }
      }
    }
  }

  return list;
}

// Move an entity's position vector, resolving collisions. Modifies pos. Returns onGround status.
export function moveWithCollisions(
  pos: { x: number; y: number; z: number },
  vel: { x: number; y: number; z: number },
  width: number,
  height: number,
  world: VoxelWorld,
  deltaTime: number
): { onGround: boolean; collidedX: boolean; collidedZ: boolean; inLava: boolean } {
  // Translate velocity into actual distance step
  const dx = vel.x * deltaTime;
  const dy = vel.y * deltaTime;
  const dz = vel.z * deltaTime;

  let onGround = false;
  let collidedX = false;
  let collidedZ = false;
  let inLava = false;

  const halfW = width / 2;

  // Check if player is currently in lava
  const px = Math.floor(pos.x);
  const py = Math.floor(pos.y + 0.1); // feet level
  const pz = Math.floor(pos.z);
  if (world.getBlock(px, py, pz) === BlockType.LAVA || world.getBlock(px, Math.floor(pos.y + 1.0), pz) === BlockType.LAVA) {
    inLava = true;
  }

  // 1. Resolve Y axis
  pos.y += dy;
  let playerBox: Box = {
    minX: pos.x - halfW,
    maxX: pos.x + halfW,
    minY: pos.y,
    maxY: pos.y + height,
    minZ: pos.z - halfW,
    maxZ: pos.z + halfW,
  };

  let blocks = getCollidingBlocks(playerBox, world);
  for (const block of blocks) {
    if (intersectBoxes(playerBox, block)) {
      if (dy > 0) {
        // Collided with ceiling
        pos.y = block.minY - height - 0.001;
        vel.y = 0;
      } else if (dy < 0) {
        // Collided with floor
        pos.y = block.maxY + 0.001;
        vel.y = 0;
        onGround = true;
      }
      // Re-evaluate bounding box
      playerBox.minY = pos.y;
      playerBox.maxY = pos.y + height;
    }
  }

  // 2. Resolve X axis
  pos.x += dx;
  playerBox.minX = pos.x - halfW;
  playerBox.maxX = pos.x + halfW;

  blocks = getCollidingBlocks(playerBox, world);
  for (const block of blocks) {
    if (intersectBoxes(playerBox, block)) {
      if (dx > 0) {
        pos.x = block.minX - halfW - 0.001;
      } else if (dx < 0) {
        pos.x = block.maxX + halfW + 0.001;
      }
      vel.x = 0;
      collidedX = true;
      // Re-evaluate bounding box
      playerBox.minX = pos.x - halfW;
      playerBox.maxX = pos.x + halfW;
    }
  }

  // 3. Resolve Z axis
  pos.z += dz;
  playerBox.minZ = pos.z - halfW;
  playerBox.maxZ = pos.z + halfW;

  blocks = getCollidingBlocks(playerBox, world);
  for (const block of blocks) {
    if (intersectBoxes(playerBox, block)) {
      if (dz > 0) {
        pos.z = block.minZ - halfW - 0.001;
      } else if (dz < 0) {
        pos.z = block.maxZ + halfW + 0.001;
      }
      vel.z = 0;
      collidedZ = true;
      // Re-evaluate bounding box
      playerBox.minZ = pos.z - halfW;
      playerBox.maxZ = pos.z + halfW;
    }
  }

  return { onGround, collidedX, collidedZ, inLava };
}
