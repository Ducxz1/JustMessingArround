/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { BlockType } from '../types';

// Helper to generate a random seeded value (between 0 and 1) for consistent generation if needed, or simple local state
function createNoise(x: number, y: number, seed = 42) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
  return n - Math.floor(n);
}

// Generate textures procedurally on a 16x16 canvas and return a canvas elements
export function createVoxelTexture(type: BlockType, side: 'top' | 'bottom' | 'side' = 'side'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;

  // Default color fill helper
  const fillPixel = (px: number, py: number, r: number, g: number, b: number, a = 255) => {
    ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
    ctx.fillRect(px, py, 1, 1);
  };

  const seed = type * 100 + (side === 'top' ? 13 : side === 'bottom' ? 27 : 91);

  // Generate pattern based on blocks
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const noise = createNoise(x, y, seed);
      const intensity = Math.floor(noise * 30) - 15; // -15 to +15 shading variation

      switch (type) {
        case BlockType.GRASS:
          if (side === 'top') {
            // Lime/Green grass top
            const r = 85 + intensity;
            const g = 150 + Math.floor(noise * 40);
            const b = 45 + intensity;
            fillPixel(x, y, r, g, b);
          } else if (side === 'bottom') {
            // Brown dirt bottom
            const r = 90 + intensity;
            const g = 60 + intensity;
            const b = 40 + intensity;
            fillPixel(x, y, r, g, b);
          } else {
            // Side: green grass fringe at top (varying height), dirt below
            const grassDepth = 4 + Math.floor(createNoise(x, 0, seed + 1) * 3);
            if (y < grassDepth) {
              const r = 85 + intensity;
              const g = 150 + Math.floor(noise * 20);
              const b = 45 + intensity;
              fillPixel(x, y, r, g, b);
            } else {
              const r = 90 + intensity;
              const g = 60 + intensity;
              const b = 40 + intensity;
              fillPixel(x, y, r, g, b);
            }
          }
          break;

        case BlockType.DIRT: {
          const r = 95 + intensity;
          const g = 65 + intensity;
          const b = 42 + intensity;
          fillPixel(x, y, r, g, b);
          break;
        }

        case BlockType.STONE: {
          const r = 115 + intensity;
          const g = 115 + intensity;
          const b = 115 + intensity;
          // Add occasional darker cracks
          if (createNoise(x, y, 77) < 0.12) {
            fillPixel(x, y, r - 35, g - 35, b - 35);
          } else {
            fillPixel(x, y, r, g, b);
          }
          break;
        }

        case BlockType.WOOD_TRUNK:
          if (side === 'top' || side === 'bottom') {
            // Cross-section circles of light wood
            const dx = x - 7.5;
            const dy = y - 7.5;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Rings
            if (dist > 6 && dist < 8) {
              fillPixel(x, y, 90, 60, 40); // bark ring
            } else if (Math.floor(dist) % 2 === 0) {
              fillPixel(x, y, 175 + intensity, 140 + intensity, 95 + intensity);
            } else {
              fillPixel(x, y, 195 + intensity, 160 + intensity, 110 + intensity);
            }
          } else {
            // Bark: vertical stripes
            const isStripe = (x % 4 === 0 || createNoise(x, 0, 999) < 0.1);
            if (isStripe) {
              fillPixel(x, y, 70 + intensity, 45 + intensity, 30 + intensity);
            } else {
              fillPixel(x, y, 95 + intensity, 65 + intensity, 43 + intensity);
            }
          }
          break;

        case BlockType.LEAVES: {
          // Leaves: deep green with tiny transparent/semi-transparent dots
          const r = 40 + intensity;
          const g = 110 + Math.floor(noise * 30);
          const b = 35 + intensity;
          const isTranslucent = (createNoise(x, y, seed * 2) < 0.15);
          if (isTranslucent) {
            fillPixel(x, y, r - 20, g - 40, b - 20, 100); // semi-translucent gap
          } else {
            fillPixel(x, y, r, g, b, 255);
          }
          break;
        }

        case BlockType.PLANKS: {
          // Horizontal planks
          const row = Math.floor(y / 4);
          const border = (y % 4 === 0 || x === 0 || (row % 2 === 0 ? x === 8 : x === 12));
          const r = 185 + intensity;
          const g = 145 + intensity;
          const b = 95 + intensity;
          if (border) {
            fillPixel(x, y, r - 40, g - 45, b - 35);
          } else {
            fillPixel(x, y, r, g, b);
          }
          break;
        }

        case BlockType.CRAFTING_TABLE:
          if (side === 'top') {
            // Wood checker with leather rim
            const rim = (x === 0 || x === 15 || y === 0 || y === 15);
            if (rim) {
              fillPixel(x, y, 110 + intensity, 70 + intensity, 45 + intensity);
            } else {
              const gridCol = (x % 5 === 0 || y % 5 === 0);
              const r = 190 + intensity;
              const g = 150 + intensity;
              const b = 100 + intensity;
              if (gridCol) {
                fillPixel(x, y, r - 25, g - 25, b - 20);
              } else {
                fillPixel(x, y, r, g, b);
              }
            }
          } else if (side === 'bottom') {
            // Simple planks
            const r = 140 + intensity;
            const g = 105 + intensity;
            const b = 70 + intensity;
            fillPixel(x, y, r, g, b);
          } else {
            // Sides: wood slats with cute tools painted on them
            const r = 145 + intensity;
            const g = 105 + intensity;
            const b = 70 + intensity;
            const rim = (y < 2 || x === 0 || x === 15);

            if (rim) {
              fillPixel(x, y, 110 + intensity, 72 + intensity, 45 + intensity);
            } else {
              // Paint a little blue hammer / shear silhouette on sides
              const hammerX = (x >= 5 && x <= 10 && y >= 6 && y <= 11);
              if (hammerX) {
                fillPixel(x, y, 80, 120, 200); // Hammer blue head
              } else {
                fillPixel(x, y, r, g, b);
              }
            }
          }
          break;

        case BlockType.COAL_ORE: {
          const r = 115 + intensity;
          const g = 115 + intensity;
          const b = 115 + intensity;
          // Coal flecks (dark charcoal)
          const isOre = (createNoise(x, y, 555) > 0.83);
          if (isOre) {
            fillPixel(x, y, 30, 30, 30);
          } else if (createNoise(x, y, 77) < 0.1) {
            fillPixel(x, y, r - 35, g - 35, b - 35);
          } else {
            fillPixel(x, y, r, g, b);
          }
          break;
        }

        case BlockType.IRON_ORE: {
          const r = 115 + intensity;
          const g = 115 + intensity;
          const b = 115 + intensity;
          // Iron patches (peach-gold)
          const isOre = (createNoise(x, y, 888) > 0.85);
          if (isOre) {
            fillPixel(x, y, 210, 165, 135);
          } else if (createNoise(x, y, 77) < 0.1) {
            fillPixel(x, y, r - 35, g - 35, b - 35);
          } else {
            fillPixel(x, y, r, g, b);
          }
          break;
        }

        case BlockType.BEDROCK: {
          // Extremely rugged, ultra high contrast black & grey
          const contrast = (noise > 0.5) ? 200 : 30;
          const r = Math.floor(noise * 60) + (noise > 0.55 ? 50 : 20);
          fillPixel(x, y, r, r, r);
          break;
        }

        case BlockType.LAVA: {
          // Bright, highly saturated fire-magma orange/yellow
          const val = noise * 100;
          const r = 220 + Math.floor(val * 0.35);
          const g = 60 + Math.floor(val * 0.9);
          const b = 20;
          fillPixel(x, y, r, g, b);
          break;
        }

        case BlockType.SAND: {
          // Warm sand/beige/peach with tiny specks
          const r = 225 + intensity;
          const g = 200 + intensity;
          const b = 155 + intensity;
          if (createNoise(x, y, 111) < 0.08) {
            fillPixel(x, y, r - 25, g - 25, b - 20);
          } else {
            fillPixel(x, y, r, g, b);
          }
          break;
        }

        case BlockType.CACTUS: {
          if (side === 'top' || side === 'bottom') {
            // Segmented circular texture for bottom/top of cactus
            const dx = x - 7.5;
            const dy = y - 7.5;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 2.5) {
              // Light green core
              fillPixel(x, y, 110 + intensity, 175 + intensity, 80 + intensity);
            } else if (dist < 6.5) {
              // Deep green flesh
              fillPixel(x, y, 40 + intensity, 100 + intensity, 35 + intensity);
            } else {
              // Sand surroundings/blank space (transparent/alphaTest)
              fillPixel(x, y, 0, 0, 0, 0); 
            }
          } else {
            // Cactus side: vertical green ribs + white needles/dots
            const isRib = (x % 4 === 0);
            const isNeedle = ((x + y * 5) % 9 === 0);
            if (isNeedle) {
              fillPixel(x, y, 220, 220, 200); // cactus needle
            } else if (isRib) {
              fillPixel(x, y, 32 + intensity, 80 + intensity, 27 + intensity); // darker ribs
            } else {
              fillPixel(x, y, 48 + intensity, 110 + intensity, 40 + intensity); // base green
            }
          }
          break;
        }

        case BlockType.GLASS: {
          // Mostly transparent, with clear border frame and white-ish specular streaks on 0,0,0,0
          const isBorder = (x === 0 || x === 15 || y === 0 || y === 15);
          const isStreak = (Math.abs(x - y) === 3 || Math.abs(x - y) === 7) && x > 2 && x < 13;
          if (isBorder) {
            fillPixel(x, y, 220, 245, 255, 180); // semi-translucent soft border
          } else if (isStreak) {
            fillPixel(x, y, 255, 255, 255, 210); // shiny white stripe
          } else {
            fillPixel(x, y, 225, 245, 255, 25); // tiny ambient glass tint
          }
          break;
        }

        case BlockType.GOLD_ORE: {
          const r = 115 + intensity;
          const g = 115 + intensity;
          const b = 115 + intensity;
          // Shiny gold flecks
          const isOre = (createNoise(x, y, 777) > 0.81);
          if (isOre) {
            fillPixel(x, y, 235, 195, 35); // golden yellow chunks
          } else if (createNoise(x, y, 77) < 0.1) {
            fillPixel(x, y, r - 35, g - 35, b - 35);
          } else {
            fillPixel(x, y, r, g, b);
          }
          break;
        }

        default:
          fillPixel(x, y, 255, 0, 255); // Magenta missing
      }
    }
  }

  // Create THREE Texture
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return texture;
}

// Generate Mob skin textures
export function createMobTexture(type: 'zombie' | 'pig'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = type === 'zombie' ? '#4a753c' : '#f096aa'; // Base color fill
  ctx.fillRect(0, 0, 64, 32);

  // Add some pixel noise
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const noise = createNoise(x, y, type === 'zombie' ? 123 : 456);
      const val = Math.floor(noise * 30) - 15;

      if (type === 'zombie') {
        // Green skin variation
        const gLayer = (x >= 0 && x <= 32); // Face has interesting skin
        const r = 50 + val;
        const g = 100 + val + (gLayer ? 30 : 0);
        const b = 50 + val;

        // Zombie Eyes: Red / Dark
        const leftEye = (x === 10 && y === 12) || (x === 11 && y === 12);
        const rightEye = (x === 14 && y === 12) || (x === 15 && y === 12);
        const clothesBlue = (y >= 16); // Lower body clothes

        if (leftEye || rightEye) {
          ctx.fillStyle = '#ff3333';
          ctx.fillRect(x, y, 1, 1);
        } else if (clothesBlue) {
          ctx.fillStyle = `rgb(${40 + val}, ${110 + val}, ${150 + val})`;
          ctx.fillRect(x, y, 1, 1);
        } else {
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, y, 1, 1);
        }
      } else {
        // Pig: Pink skin variation
        const r = 240 + val;
        const g = 150 + val;
        const b = 170 + val;

        // Pig snout (darker pink)
        const isSnout = (x >= 10 && x <= 14 && y >= 12 && y <= 14);
        // Pig Eyes: Black and white
        const eyeLeft = (x === 8 && y === 10) || (x === 9 && y === 10);
        const eyeRight = (x === 15 && y === 10) || (x === 16 && y === 10);

        if (eyeLeft || eyeRight) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, 1, 1);
          ctx.fillStyle = '#000000';
          ctx.fillRect(x + 1, y, 1, 1);
        } else if (isSnout) {
          ctx.fillStyle = `rgb(${255 + val}, ${100 + val}, ${140 + val})`;
          ctx.fillRect(x, y, 1, 1);
        } else {
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

// Materials Dictionary cache so we don't recreate them every block!
const materialCache: Record<string, THREE.MeshLambertMaterial> = {};

export function getVoxelMaterials(type: BlockType): THREE.MeshLambertMaterial[] {
  const cacheKey = `voxel_mat_${type}`;
  if (materialCache[`${cacheKey}_right`]) {
    return [
      materialCache[`${cacheKey}_right`],
      materialCache[`${cacheKey}_left`],
      materialCache[`${cacheKey}_top`],
      materialCache[`${cacheKey}_bottom`],
      materialCache[`${cacheKey}_front`],
      materialCache[`${cacheKey}_back`],
    ];
  }

  // Generate 6 materials for the 6 faces: Right, Left, Top, Bottom, Front, Back
  const sides = ['right', 'left', 'top', 'bottom', 'front', 'back'] as const;
  const materials: THREE.MeshLambertMaterial[] = [];

  sides.forEach((sideName) => {
    let sideType: 'top' | 'bottom' | 'side' = 'side';
    if (sideName === 'top') sideType = 'top';
    if (sideName === 'bottom') sideType = 'bottom';

    const texture = createVoxelTexture(type, sideType);
    const isTrans = type === BlockType.LEAVES || type === BlockType.GLASS || type === BlockType.CACTUS;
    const alphaT = type === BlockType.LEAVES ? 0.35 : (type === BlockType.CACTUS ? 0.35 : 0.0);
    const mat = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: isTrans,
      alphaTest: alphaT,
      shadowSide: THREE.DoubleSide,
    });

    materialCache[`${cacheKey}_${sideName}`] = mat;
    materials.push(mat);
  });

  return materials;
}
