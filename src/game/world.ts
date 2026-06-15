/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BlockType } from '../types';

export const WORLD_WIDTH = 48; // Kept for backward compatibility imports
export const WORLD_DEPTH = 48; // Kept for backward compatibility imports
export const WORLD_HEIGHT = 16;

export class VoxelWorld {
  private chunks: Map<string, Uint8Array>;
  private modifiedBlocks: Record<string, BlockType>; // Key is "x,y,z"
  private seedOffsetX: number;
  private seedOffsetZ: number;

  constructor(
    seedOffsetX = Math.random() * 10000,
    seedOffsetZ = Math.random() * 10000,
    modifiedBlocks: Record<string, BlockType> = {}
  ) {
    this.chunks = new Map();
    this.modifiedBlocks = { ...modifiedBlocks };
    this.seedOffsetX = seedOffsetX;
    this.seedOffsetZ = seedOffsetZ;
  }

  getModifiedBlocks(): Record<string, BlockType> {
    return this.modifiedBlocks;
  }

  getSeedOffsets() {
    return { seedOffsetX: this.seedOffsetX, seedOffsetZ: this.seedOffsetZ };
  }

  // Convert 3D local coord inside a chunk to flat index
  private getIndex(lx: number, y: number, lz: number): number {
    return lx + lz * 16 + y * 16 * 16;
  }

  // Bounds check (Y only)
  inBounds(x: number, y: number, z: number): boolean {
    return y >= 0 && y < WORLD_HEIGHT;
  }

  private getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  // Ensure chunk exists and generate if needed
  private ensureChunk(cx: number, cz: number): Uint8Array {
    const key = this.getChunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Uint8Array(16 * 16 * WORLD_HEIGHT);
      this.chunks.set(key, chunk);
      this.generateChunkData(cx, cz, chunk);
    }
    return chunk;
  }

  getBlock(x: number, y: number, z: number): BlockType {
    // If we have an alteration in modifiedBlocks, priority is given to it
    const modKey = `${x},${y},${z}`;
    if (this.modifiedBlocks[modKey] !== undefined) {
      return this.modifiedBlocks[modKey];
    }

    if (y < 0) return BlockType.BEDROCK;
    if (y >= WORLD_HEIGHT) return BlockType.AIR;

    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    const chunk = this.ensureChunk(cx, cz);

    const lx = x - cx * 16;
    const lz = z - cz * 16;
    return chunk[this.getIndex(lx, y, lz)];
  }

  getBlockIfLoaded(x: number, y: number, z: number): BlockType {
    // Priority to modifications
    const modKey = `${x},${y},${z}`;
    if (this.modifiedBlocks[modKey] !== undefined) {
      return this.modifiedBlocks[modKey];
    }

    if (y < 0) return BlockType.BEDROCK;
    if (y >= WORLD_HEIGHT) return BlockType.AIR;

    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    const chunkKey = this.getChunkKey(cx, cz);
    const chunk = this.chunks.get(chunkKey);
    if (!chunk) {
      // Chunk not generated yet, treat neighbor as AIR to avoid cascading procedural generation
      return BlockType.AIR;
    }

    const lx = x - cx * 16;
    const lz = z - cz * 16;
    return chunk[this.getIndex(lx, y, lz)];
  }

  setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (y < 0 || y >= WORLD_HEIGHT) return;

    // Record the block modification so we can save it!
    const key = `${x},${y},${z}`;
    this.modifiedBlocks[key] = type;

    // Update loaded chunk data if chunk is already loaded
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    const chunkKey = this.getChunkKey(cx, cz);
    const chunk = this.chunks.get(chunkKey);
    if (chunk) {
      const lx = x - cx * 16;
      const lz = z - cz * 16;
      chunk[this.getIndex(lx, y, lz)] = type;
    }
  }

  // Generate a chunk procedurally with gorgeous biomes (Forest, Desert, Plains)
  private generateChunkData(cx: number, cz: number, chunk: Uint8Array): void {
    const startX = cx * 16;
    const startZ = cz * 16;

    // 1. Generate base terrain (Bedrock, Stone, Dirt, Grass, Ores, Sand, Gold)
    for (let lx = 0; lx < 16; lx++) {
      const x = startX + lx;
      for (let lz = 0; lz < 16; lz++) {
        const z = startZ + lz;

        const rx = x + this.seedOffsetX;
        const rz = z + this.seedOffsetZ;

        // Continental low-frequency noise determining biomes
        const biomeVal = Math.sin(rx * 0.015) * Math.cos(rz * 0.015) + Math.sin(rx * 0.005) * 0.5;

        let height = 8;
        if (biomeVal > 0.25) {
          // Desert biome: sandy dunes
          const dune = Math.sin(rx * 0.08) * Math.cos(rz * 0.08) * 2.5 + Math.sin(rx * 0.02) * 2.0;
          height = Math.floor(9 + dune);
        } else if (biomeVal < -0.15) {
          // Prettier Forest biome: rolling mountains and canopy valleys
          const hills = Math.sin(rx * 0.06) * Math.cos(rz * 0.06) * 4.0 + Math.cos(rx * 0.02) * 3.0;
          height = Math.floor(11 + hills);
        } else {
          // Plains biome: smooth gentle fields
          const rolling = Math.sin(rx * 0.04) * 2.0 + Math.cos(rz * 0.03) * 1.0;
          height = Math.floor(8 + rolling);
        }

        const maxHeight = Math.min(WORLD_HEIGHT - 6, Math.max(3, height));

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let block = BlockType.AIR;
          if (y === 0) {
            block = BlockType.BEDROCK;
          } else if (y < maxHeight - 2) {
            // Caves & Ores Layer
            const rand = Math.sin(rx * 5.3 + y * 9.7 + rz * 12.1);
            if (y < 4 && rand > 0.90) {
              block = BlockType.LAVA; // Lava pockets deep under
            } else if (y < 6 && rand < -0.88) {
              block = BlockType.GOLD_ORE; // Gold ore spawned deep down
            } else if (rand > 0.81) {
              block = BlockType.COAL_ORE;
            } else if (rand < -0.82) {
              block = BlockType.IRON_ORE;
            } else {
              block = BlockType.STONE;
            }
          } else if (y < maxHeight) {
            if (biomeVal > 0.25) {
              block = BlockType.SAND; // Desert sand base
            } else {
              block = BlockType.DIRT;
            }
          } else if (y === maxHeight) {
            if (biomeVal > 0.25) {
              block = BlockType.SAND; // Desert surface
            } else {
              block = BlockType.GRASS; // Grass surface
            }
          }

          chunk[this.getIndex(lx, y, lz)] = block;
        }
      }
    }

    // 2. Generate trees and desert vegetation deterministically inside the chunk
    const seed = Math.sin((cx + this.seedOffsetX) * 12.9898 + (cz + this.seedOffsetZ) * 78.233) * 43758.5453;
    let randVal = seed - Math.floor(seed);
    const rand = () => {
      randVal = Math.sin(randVal * 12.9898 + 78.233) * 43758.5453;
      randVal = randVal - Math.floor(randVal);
      return randVal;
    };

    // Calculate general biome of this chunk at the center
    const ccx = startX + 8 + this.seedOffsetX;
    const ccz = startZ + 8 + this.seedOffsetZ;
    const chunkBiome = Math.sin(ccx * 0.015) * Math.cos(ccz * 0.015) + Math.sin(ccx * 0.005) * 0.5;

    let spawnCount = 0;
    if (chunkBiome > 0.25) {
      // Desert: Spawn 1-2 cacti occasionally
      spawnCount = rand() < 0.35 ? 1 : rand() < 0.15 ? 2 : 0;
      for (let s = 0; s < spawnCount; s++) {
        const lx = Math.floor(2 + rand() * 12);
        const lz = Math.floor(2 + rand() * 12);

        let ty = WORLD_HEIGHT - 1;
        while (ty > 0 && chunk[this.getIndex(lx, ty, lz)] === BlockType.AIR) {
          ty--;
        }

        if (chunk[this.getIndex(lx, ty, lz)] === BlockType.SAND) {
          // Height of Cactus: 2 to 3 blocks
          const cacHeight = rand() < 0.4 ? 2 : 3;
          for (let ch = 1; ch <= cacHeight; ch++) {
            if (ty + ch < WORLD_HEIGHT) {
              chunk[this.getIndex(lx, ty + ch, lz)] = BlockType.CACTUS;
            }
          }
        }
      }
    } else if (chunkBiome < -0.15) {
      // Lush Forest: Spawn 3 to 5 trees/shrubs per chunk
      spawnCount = Math.floor(3 + rand() * 3);
      for (let t = 0; t < spawnCount; t++) {
        const lx = Math.floor(2 + rand() * 12);
        const lz = Math.floor(2 + rand() * 12);

        let ty = WORLD_HEIGHT - 1;
        while (ty > 0 && chunk[this.getIndex(lx, ty, lz)] === BlockType.AIR) {
          ty--;
        }

        if (chunk[this.getIndex(lx, ty, lz)] === BlockType.GRASS) {
          // Shrubs vs tall trees
          if (rand() < 0.25) {
            // Shrub
            if (ty + 1 < WORLD_HEIGHT) {
              chunk[this.getIndex(lx, ty + 1, lz)] = BlockType.WOOD_TRUNK;
              // Tiny leaf cluster on top
              const radius = 1;
              for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                  if (lx+dx >= 0 && lx+dx < 16 && lz+dz >= 0 && lz+dz < 16) {
                    if (!(dx === 0 && dz === 0) && ty + 2 < WORLD_HEIGHT) {
                      chunk[this.getIndex(lx + dx, ty + 1, lz + dz)] = BlockType.LEAVES;
                    }
                    if (ty + 2 < WORLD_HEIGHT) {
                      chunk[this.getIndex(lx + dx, ty + 2, lz + dz)] = BlockType.LEAVES;
                    }
                  }
                }
              }
            }
          } else {
            // Beautiful Tall Tree
            this.spawnTreeInChunk(lx, ty + 1, lz, chunk, rand);
          }
        }
      }
    } else {
      // Plains: Sporadic trees (0..1)
      spawnCount = rand() < 0.16 ? 1 : 0;
      for (let t = 0; t < spawnCount; t++) {
        const lx = Math.floor(2 + rand() * 12);
        const lz = Math.floor(2 + rand() * 12);

        let ty = WORLD_HEIGHT - 1;
        while (ty > 0 && chunk[this.getIndex(lx, ty, lz)] === BlockType.AIR) {
          ty--;
        }

        if (chunk[this.getIndex(lx, ty, lz)] === BlockType.GRASS) {
          this.spawnTreeInChunk(lx, ty + 1, lz, chunk, rand);
        }
      }
    }
  }

  // Spawns wood trunks and a dome of leaves inside a chunk's Uint8Array
  private spawnTreeInChunk(lx: number, y: number, lz: number, chunk: Uint8Array, rand: () => number): void {
    const trunkHeight = 4 + Math.floor(rand() * 2); // 4-5 high

    // Build Trunk
    for (let h = 0; h < trunkHeight; h++) {
      if (y + h < WORLD_HEIGHT) {
        chunk[this.getIndex(lx, y + h, lz)] = BlockType.WOOD_TRUNK;
      }
    }

    // Build leaves crown starting at trunk Y + 2
    const leafStart = y + trunkHeight - 2;
    for (let ly = leafStart; ly <= y + trunkHeight + 1; ly++) {
      if (ly >= WORLD_HEIGHT) continue;

      const isTop = (ly === y + trunkHeight + 1);
      const isUpper = (ly === y + trunkHeight);
      const radius = isTop ? 1 : isUpper ? 2 : 2;

      for (let clx = lx - radius; clx <= lx + radius; clx++) {
        for (let clz = lz - radius; clz <= lz + radius; clz++) {
          // Keep leaf blocks within bounds of chunk 0..15 horizontally
          if (clx < 0 || clx >= 16 || clz < 0 || clz >= 16) continue;

          // Avoid overwriting wood trunk
          if (clx === lx && clz === lz && ly < y + trunkHeight) {
            continue;
          }

          // Corners cut-off for rounder leaves crown
          const dx = clx - lx;
          const dz = clz - lz;
          if (radius > 1 && Math.abs(dx) === radius && Math.abs(dz) === radius) {
            if (rand() > 0.4) continue; // random corner cut
          }

          const idx = this.getIndex(clx, ly, clz);
          if (chunk[idx] === BlockType.AIR) {
            chunk[idx] = BlockType.LEAVES;
          }
        }
      }
    }
  }

  // Simple voxel raycasting: returns block position, normal vector, and targeted block
  // Returns { blockX, blockY, blockZ, normalX, normalY, normalZ } or null
  raycast(
    originX: number, originY: number, originZ: number,
    dirX: number, dirY: number, dirZ: number,
    maxDistance = 5
  ) {
    let t = 0.0;
    let x = Math.floor(originX);
    let y = Math.floor(originY);
    let z = Math.floor(originZ);

    const stepX = dirX > 0 ? 1 : -1;
    const stepY = dirY > 0 ? 1 : -1;
    const stepZ = dirZ > 0 ? 1 : -1;

    const tDeltaX = Math.abs(1 / dirX);
    const tDeltaY = Math.abs(1 / dirY);
    const tDeltaZ = Math.abs(1 / dirZ);

    const xDist = dirX > 0 ? (x + 1 - originX) : (originX - x);
    const yDist = dirY > 0 ? (y + 1 - originY) : (originY - y);
    const zDist = dirZ > 0 ? (z + 1 - originZ) : (originZ - z);

    let tMaxX = isFinite(tDeltaX) ? xDist * tDeltaX : Infinity;
    let tMaxY = isFinite(tDeltaY) ? yDist * tDeltaY : Infinity;
    let tMaxZ = isFinite(tDeltaZ) ? zDist * tDeltaZ : Infinity;

    let normalX = 0;
    let normalY = 0;
    let normalZ = 0;

    while (t < maxDistance) {
      const type = this.getBlock(x, y, z);
      if (type !== BlockType.AIR) {
        return {
          px: x, py: y, pz: z,
          nx: normalX, ny: normalY, nz: normalZ,
          blockType: type
        };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          t = tMaxX;
          tMaxX += tDeltaX;
          x += stepX;
          normalX = -stepX;
          normalY = 0;
          normalZ = 0;
        } else {
          t = tMaxZ;
          tMaxZ += tDeltaZ;
          z += stepZ;
          normalX = 0;
          normalY = 0;
          normalZ = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          t = tMaxY;
          tMaxY += tDeltaY;
          y += stepY;
          normalX = 0;
          normalY = -stepY;
          normalZ = 0;
        } else {
          t = tMaxZ;
          tMaxZ += tDeltaZ;
          z += stepZ;
          normalX = 0;
          normalY = 0;
          normalZ = -stepZ;
        }
      }
    }
    return null;
  }
}
