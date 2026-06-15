/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { BlockType, InventoryItem, ITEMS, Mob, SavedWorld } from '../types';
import { VoxelWorld, WORLD_WIDTH, WORLD_DEPTH, WORLD_HEIGHT } from '../game/world';
import { moveWithCollisions } from '../game/physics';
import { getVoxelMaterials, createMobTexture } from '../game/textures';

interface GameCanvasProps {
  inventory: (InventoryItem | null)[];
  setInventory: (inv: (InventoryItem | null)[]) => void;
  activeSlot: number;
  health: number;
  setHealth: React.Dispatch<React.SetStateAction<number>>;
  hunger: number;
  setHunger: React.Dispatch<React.SetStateAction<number>>;
  isInventoryOpen: boolean;
  setIsInventoryOpen: (open: boolean) => void;
  isNearCraftingTable: boolean;
  setIsNearCraftingTable: (near: boolean) => void;
  dayTime: number;
  setDayTime: React.Dispatch<React.SetStateAction<number>>;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  onGameOver: () => void;
  viewDistance: number;
  activeWorld: SavedWorld;
  onSaveActiveWorld: (worldProps: Partial<SavedWorld>) => void;
  onQuitToMenu: () => void;
}

export default function GameCanvas({
  inventory,
  setInventory,
  activeSlot,
  health,
  setHealth,
  hunger,
  setHunger,
  isInventoryOpen,
  setIsInventoryOpen,
  isNearCraftingTable,
  setIsNearCraftingTable,
  dayTime,
  setDayTime,
  score,
  setScore,
  onGameOver,
  viewDistance,
  activeWorld,
  onSaveActiveWorld,
  onQuitToMenu,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use refs for gameplay critical loops to bypass react render lag and state staleness
  const stateRef = useRef({
    health,
    hunger,
    inventory,
    activeSlot,
    isInventoryOpen,
    isNearCraftingTable,
    viewDistance,
  });

  // Sync state changes with ref safely resisting race conditions
  useEffect(() => {
    let finalInv = stateRef.current.inventory;
    // If the incoming inventory prop is NOT in our set of generated/mutated states,
    // adopt it as the new source of truth (such as when crafting or moving items outside main loop)
    if (!internalInventories.current.has(inventory)) {
      finalInv = inventory;
    }
    
    stateRef.current = { 
      health, 
      hunger, 
      inventory: finalInv, 
      activeSlot, 
      isInventoryOpen, 
      isNearCraftingTable, 
      viewDistance 
    };
  }, [health, hunger, inventory, activeSlot, isInventoryOpen, isNearCraftingTable, viewDistance]);

  // Pointerlock state
  const [isLocked, setIsLocked] = useState(false);
  const [miningProgress, setMiningProgress] = useState(0); // 0 to 100 for visual feedback
  const [isMining, setIsMining] = useState(false);
  const [showSaveMessage, setShowSaveMessage] = useState(false);

  const handleSaveGameData = () => {
    if (!worldRef.current) return;
    
    const modifiedBlocks = worldRef.current.getModifiedBlocks();
    const playerPosition = {
      x: playerPos.current.x,
      y: playerPos.current.y,
      z: playerPos.current.z,
    };
    const playerRotation = {
      pitch: cameraRot.current.x,
      yaw: cameraRot.current.y,
    };

    onSaveActiveWorld({
      modifiedBlocks,
      playerPosition,
      playerRotation,
      inventory: stateRef.current.inventory,
      health: stateRef.current.health,
      hunger: stateRef.current.hunger,
      dayTime: dayTimeRef.current,
      score: score,
    });

    setShowSaveMessage(true);
    setTimeout(() => {
      setShowSaveMessage(false);
    }, 2000);
  };

  // Auto-save every 30 seconds
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (document.pointerLockElement === canvasRef.current) {
        handleSaveGameData();
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [activeWorld, onSaveActiveWorld]);
  const isMiningRef = useRef(false);
  const setMiningState = (mining: boolean) => {
    isMiningRef.current = mining;
    setIsMining(mining);
  };

  // Core Game State references
  const worldRef = useRef<VoxelWorld | null>(null);
  const playerPos = useRef<THREE.Vector3>(new THREE.Vector3(16.5, 10, 16.5));
  const playerVel = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraRot = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const onGround = useRef(false);
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Mining variables
  const currentTargetBlock = useRef<{ x: number; y: number; z: number; type: BlockType } | null>(null);
  const mineTimeAccumulator = useRef<number>(0);

  // Fall damage tracking
  const lastYPos = useRef<number>(10);
  const fallDistance = useRef<number>(0);
  const dayTimeRef = useRef<number>(dayTime);

  // Interactive Item Drops & Camera Bobbing
  const itemDrops = useRef<{ id: string; itemId: string; count: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; mesh: THREE.Mesh; spawnTime: number }[]>([]);
  const internalInventories = useRef<Set<any>>(new Set());
  const bobbingTime = useRef<number>(0);

  // Voxel Breaking Particles & Camera Mode State
  const particles = useRef<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; age: number; maxAge: number }[]>([]);
  const cameraModeRef = useRef<'first-person' | 'third-person'>('first-person');
  const [cameraMode, setCameraMode] = useState<'first-person' | 'third-person'>('first-person');

  // Chunk tracking for View distance updates
  const lastPlayerChunk = useRef<{ cx: number; cz: number }>({ cx: -1, cz: -1 });
  const lastViewDistance = useRef<number>(-1);
  const chunkLoadQueue = useRef<string[]>([]);

  // Entities & Meshes
  const chunkMeshes = useRef<Map<string, Map<BlockType, THREE.InstancedMesh>>>(new Map());
  const sceneRef = useRef<THREE.Scene | null>(null);
  const wireframeOutline = useRef<THREE.BoxHelper | null>(null);
  const mobsList = useRef<Mob[]>([]);
  const mobMeshes = useRef<Map<string, THREE.Group>>(new Map());

  // Damage Flash Red Overlay state
  const [hurtOverlay, setHurtOverlay] = useState(false);

  // Pointerlock request handler
  const handleCanvasClick = () => {
    if (stateRef.current.isInventoryOpen) return;
    canvasRef.current?.requestPointerLock();
  };

  // Simple Synthesizer sound generator reuse reference
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playSound = (freq: number, type: 'triangle' | 'sine' | 'square' | 'sawtooth' | string, duration: number) => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtxClass();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // Helper for procedural noise crunches (footsteps, breaking sand/dirt, blocks placement)
      const playNoise = (filterFreq: number, q: number, gainVal: number, dur: number, bandpass = true) => {
        const bufferSize = audioCtx.sampleRate * dur;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = bandpass ? 'bandpass' : 'lowpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = q;
        
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
        
        source.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        source.start();
      };

      // 1. High-fidelity Pop/Bubble sound for item collection (580 Hz)
      if (freq === 580) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.09);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.09);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.09);
        return;
      }

      // 2. High-fidelity block break crash (320 Hz)
      if (freq === 320) {
        // Wooden/stone crunch
        playNoise(280, 1.2, 0.18, 0.16);
        // Deeper thud
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
        return;
      }

      // 3. Block placement (200 Hz)
      if (freq === 200) {
        playNoise(350, 0.8, 0.1, 0.08);
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
        return;
      }

      // 4. Footsteps shuffling (120 Hz)
      if (freq === 120) {
        playNoise(400, 1.5, 0.04, 0.06);
        return;
      }

      // 5. Jump lift-off (280 Hz)
      if (freq === 280) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 0.08);
        gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
        return;
      }

      // 6. Heavy landing impact (80 Hz)
      if (freq === 80) {
        playNoise(200, 1.0, 0.2, 0.2);
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(90, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.18);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
        return;
      }

      // 7. Mining wood/stone crack chips (150 or 250 Hz)
      if (freq === 150 || freq === 250) {
        playNoise(freq === 150 ? 500 : 900, 2.0, 0.03, 0.04);
        return;
      }

      // 8. Hurt damage flash "OOF!" voice (90 / 110 Hz)
      if (freq === 90 || freq === 110) {
        // Vocal chest frequency
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(75, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
        
        // Throatiness layer
        const osc2 = audioCtx.createOscillator();
        const gainNode2 = audioCtx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(135, audioCtx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(70, audioCtx.currentTime + 0.15);
        gainNode2.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode2.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc2.connect(gainNode2);
        gainNode2.connect(audioCtx.destination);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.15);
        return;
      }

      // 9. Consuming Food crunchy bites (180 Hz)
      if (freq === 180) {
        // Chew chewing bite sequence (2 short bursts)
        playNoise(1200, 4.0, 0.12, 0.05);
        setTimeout(() => playNoise(900, 3.5, 0.1, 0.06), 80);
        return;
      }

      // Fallback for regular beeps/synths (mobs, alerts)
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = type as any;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio permission or Web Audio unavailable
    }
  };

  // Safe Spawning function
  const findSafeSpawnY = (world: VoxelWorld, x: number, z: number): number => {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const block = world.getBlock(x, y, z);
      if (block !== BlockType.AIR && block !== BlockType.LAVA && block !== BlockType.LEAVES) {
        return y + 1.05; // Spawns directly on top of grass/dirt/stone
      }
    }
    return 10.0;
  };

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // 1. Create Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Define spawning item drops inside useEffect so it has direct closure access to 'scene'
    const spawnItemDrop = (itemId: string, count: number, x: number, y: number, z: number) => {
      const itemDef = ITEMS[itemId];
      if (!itemDef) return;

      const size = 0.22;
      const geom = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(itemDef.iconColor),
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      scene.add(mesh);

      // Random dispersion
      const angle = Math.random() * Math.PI * 2;
      const force = 0.8 + Math.random() * 1.2;
      const vx = Math.cos(angle) * force;
      const vy = 3.0 + Math.random() * 2.0;
      const vz = Math.sin(angle) * force;

      itemDrops.current.push({
        id: `drop_${Date.now()}_${Math.random()}`,
        itemId,
        count,
        x,
        y,
        z,
        vx,
        vy,
        vz,
        mesh,
        spawnTime: performance.now(),
      });
    };

    // Add to inventory following Minecraft hotbar-first logic
    const addItemToInventoryMC = (dropItemId: string, dropCount: number) => {
      const nextInv = [...stateRef.current.inventory];
      let remaining = dropCount;
      const targetDef = ITEMS[dropItemId];
      if (!targetDef) return remaining;

      // 1. First, try to top up existing stacks of this item in the ACTIVE HOTBAR slots first (indices 27-35)
      for (let i = 27; i <= 35; i++) {
        if (nextInv[i] && nextInv[i]!.itemId === dropItemId) {
          const canAdd = targetDef.maxStack - nextInv[i]!.count;
          if (canAdd > 0) {
            const adding = Math.min(canAdd, remaining);
            nextInv[i]!.count += adding;
            remaining -= adding;
            if (remaining <= 0) break;
          }
        }
      }

      // 2. Try to top up existing stacks in MAIN INVENTORY (indices 0-26)
      if (remaining > 0) {
        for (let i = 0; i <= 26; i++) {
          if (nextInv[i] && nextInv[i]!.itemId === dropItemId) {
            const canAdd = targetDef.maxStack - nextInv[i]!.count;
            if (canAdd > 0) {
              const adding = Math.min(canAdd, remaining);
              nextInv[i]!.count += adding;
              remaining -= adding;
              if (remaining <= 0) break;
            }
          }
        }
      }

      // 3. Place remaining in EMPTY slots in the active HOTBAR first
      if (remaining > 0) {
        for (let i = 27; i <= 35; i++) {
          if (!nextInv[i]) {
            nextInv[i] = { itemId: dropItemId, count: remaining };
            remaining = 0;
            break;
          }
        }
      }

      // 4. Finally place remaining in EMPTY slots in the MAIN INVENTORY
      if (remaining > 0) {
        for (let i = 0; i <= 26; i++) {
          if (!nextInv[i]) {
            nextInv[i] = { itemId: dropItemId, count: remaining };
            remaining = 0;
            break;
          }
        }
      }

      if (remaining < dropCount) {
        // We actually fit some items, so commit this update
        internalInventories.current.add(nextInv);
        if (internalInventories.current.size > 100) {
          internalInventories.current.clear();
          internalInventories.current.add(nextInv);
        }
        stateRef.current.inventory = nextInv;
        setInventory(nextInv);
      }

      return remaining;
    };

    // Darker / ambient atmosphere, night stars can show
    scene.background = new THREE.Color(0.53, 0.81, 0.98); // Sky blue to start
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.05);

    const reusableSkyColor = new THREE.Color();

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.rotation.order = 'YXZ'; // critical for FPS camera rotation look

    // 2. Initialize VoxelWorld
    const world = new VoxelWorld(
      activeWorld.seedOffsetX,
      activeWorld.seedOffsetZ,
      activeWorld.modifiedBlocks
    );
    worldRef.current = world;

    // Set spawn point based on terrain height dynamically (support saved pos load)
    const spawnX = activeWorld.playerPosition?.x ?? (WORLD_WIDTH / 2 + 0.5);
    const spawnZ = activeWorld.playerPosition?.z ?? (WORLD_DEPTH / 2 + 0.5);
    const spawnY = activeWorld.playerPosition?.y ?? findSafeSpawnY(world, Math.floor(spawnX), Math.floor(spawnZ));
    playerPos.current.set(spawnX, spawnY + 0.2, spawnZ);
    lastYPos.current = spawnY;

    // Load saved camera rotation pitch/yaw if present
    if (activeWorld.playerRotation) {
      cameraRot.current.x = activeWorld.playerRotation.pitch;
      cameraRot.current.y = activeWorld.playerRotation.yaw;
      camera.rotation.set(cameraRot.current.x, cameraRot.current.y, 0);
    }

    // 3. Spawning Block Meshes (Voxel Renderer via Chunk-based InstancedMesh)
    const blockGeom = new THREE.BoxGeometry(1, 1, 1);

    const rebuildChunkMeshes = (cx: number, cz: number) => {
      const chunkKey = `${cx},${cz}`;
      
      // Ensure the map exists for this chunk
      if (!chunkMeshes.current.has(chunkKey)) {
        chunkMeshes.current.set(chunkKey, new Map());
      }
      const existingMeshMap = chunkMeshes.current.get(chunkKey)!;

      // Group all coordinates of exposed blocks in this chunk by block type
      const blockCoordsMap = new Map<BlockType, { x: number; y: number; z: number }[]>();

      const startX = cx * 16;
      const endX = (cx + 1) * 16;
      const startZ = cz * 16;
      const endZ = (cz + 1) * 16;

      for (let x = startX; x < endX; x++) {
        for (let z = startZ; z < endZ; z++) {
          for (let y = 0; y < WORLD_HEIGHT; y++) {
            const block = world.getBlock(x, y, z);
            if (block !== BlockType.AIR) {
              const neighbors = [
                world.getBlockIfLoaded(x + 1, y, z),
                world.getBlockIfLoaded(x - 1, y, z),
                world.getBlockIfLoaded(x, y + 1, z),
                world.getBlockIfLoaded(x, y - 1, z),
                world.getBlockIfLoaded(x, y, z + 1),
                world.getBlockIfLoaded(x, y, z - 1),
              ];
              const exposed = neighbors.includes(BlockType.AIR) || 
                              neighbors.includes(BlockType.LAVA) || 
                              neighbors.includes(BlockType.LEAVES);
              if (exposed) {
                if (!blockCoordsMap.has(block)) {
                  blockCoordsMap.set(block, []);
                }
                blockCoordsMap.get(block)!.push({ x, y, z });
              }
            }
          }
        }
      }

      // Determine active visibility based on current view distance
      const pcx = Math.floor(playerPos.current.x / 16);
      const pcz = Math.floor(playerPos.current.z / 16);
      const currentViewDist = stateRef.current.viewDistance;
      const dist = Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz));
      const isVisible = (dist < currentViewDist);

      // Now update InstancedMeshes
      // 1. Remove and dispose previous meshes of block types that are no longer present
      existingMeshMap.forEach((mesh, type) => {
        if (!blockCoordsMap.has(type)) {
          scene.remove(mesh);
          mesh.dispose();
          existingMeshMap.delete(type);
        }
      });

      // 2. Spawn / Update InstancedMeshes for block types that have coordinates
      blockCoordsMap.forEach((coords, type) => {
        const oldMesh = existingMeshMap.get(type);
        if (oldMesh) {
          scene.remove(oldMesh);
          oldMesh.dispose();
        }

        if (coords.length > 0) {
          const materials = getVoxelMaterials(type);
          const instancedMesh = new THREE.InstancedMesh(blockGeom, materials, coords.length);
          instancedMesh.castShadow = false;
          instancedMesh.receiveShadow = false;

          const tempMatrix = new THREE.Matrix4();
          const tempPosition = new THREE.Vector3();

          coords.forEach((coord, i) => {
            tempPosition.set(coord.x + 0.5, coord.y + 0.5, coord.z + 0.5);
            tempMatrix.makeTranslation(tempPosition.x, tempPosition.y, tempPosition.z);
            instancedMesh.setMatrixAt(i, tempMatrix);
          });

          instancedMesh.instanceMatrix.needsUpdate = true;
          instancedMesh.visible = isVisible;

          scene.add(instancedMesh);
          existingMeshMap.set(type, instancedMesh);
        }
      });
    };

    // Helper to safely trigger chunk rebuild for a block and its immediate horizontal/vertical neighborhood
    const triggerChunkUpdateForBlock = (x: number, y: number, z: number) => {
      const cx = Math.floor(x / 16);
      const cz = Math.floor(z / 16);

      const chunksToUpdate = new Set<string>();
      chunksToUpdate.add(`${cx},${cz}`);

      // Neighbors can cross boundaries
      const neighbors = [
        [x + 1, z],
        [x - 1, z],
        [x, z + 1],
        [x, z - 1],
      ];

      neighbors.forEach(([nx, nz]) => {
        chunksToUpdate.add(`${Math.floor(nx / 16)},${Math.floor(nz / 16)}`);
      });

      chunksToUpdate.forEach((chunkKey) => {
        const [ccx, ccz] = chunkKey.split(',').map(Number);
        rebuildChunkMeshes(ccx, ccz);
      });
    };

    // Render world based on view chunk distance (Dynamic Chunk Loading optimization around player)
    const updateChunkVisibility = (pcx: number, pcz: number, currentViewDist: number) => {
      const activeChunkKeys = new Set<string>();
      const chunksToGenerate: string[] = [];

      // Generate and make visible within view distance
      for (let cx = pcx - currentViewDist; cx <= pcx + currentViewDist; cx++) {
        for (let cz = pcz - currentViewDist; cz <= pcz + currentViewDist; cz++) {
          const chunkKey = `${cx},${cz}`;
          activeChunkKeys.add(chunkKey);

          if (!chunkMeshes.current.has(chunkKey)) {
            chunksToGenerate.push(chunkKey);
          } else {
            const existingMeshMap = chunkMeshes.current.get(chunkKey);
            if (existingMeshMap) {
              existingMeshMap.forEach((mesh) => {
                mesh.visible = true;
              });
            }
          }
        }
      }

      // Hide distant chunks
      chunkMeshes.current.forEach((meshMap, chunkKey) => {
        if (!activeChunkKeys.has(chunkKey)) {
          meshMap.forEach((mesh) => {
            mesh.visible = false;
          });
        }
      });

      // Sort unbuilt chunks by Chebyshev distance to player chunk so closer ones load first
      chunksToGenerate.sort((a, b) => {
        const [ax, az] = a.split(',').map(Number);
        const [bx, bz] = b.split(',').map(Number);
        const distA = Math.max(Math.abs(ax - pcx), Math.abs(az - pcz));
        const distB = Math.max(Math.abs(bx - pcx), Math.abs(bz - pcz));
        return distA - distB;
      });

      chunkLoadQueue.current = chunksToGenerate;
    };

    // Initial Chunk visibility load
    const initialPcx = Math.floor(spawnX / 16);
    const initialPcz = Math.floor(spawnZ / 16);
    lastPlayerChunk.current = { cx: initialPcx, cz: initialPcz };
    lastViewDistance.current = stateRef.current.viewDistance;

    // Load spawn 3x3 chunks synchronously so player starts on solid terrain immediately
    for (let cx = initialPcx - 1; cx <= initialPcx + 1; cx++) {
      for (let cz = initialPcz - 1; cz <= initialPcz + 1; cz++) {
        rebuildChunkMeshes(cx, cz);
      }
    }

    updateChunkVisibility(initialPcx, initialPcz, stateRef.current.viewDistance);

    // 4. Highlight box wireframe target
    const outlineGeom = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.8 });
    const outlineMesh = new THREE.Mesh(outlineGeom, outlineMat);
    outlineMesh.visible = false;
    scene.add(outlineMesh);

    // --- PROCEDURAL 3D CLOUDS (MINECRAFT STYLE) ---
    const cloudsGroup = new THREE.Group();
    scene.add(cloudsGroup);

    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });

    const clouds: { mesh: THREE.Mesh; x: number; z: number; speed: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const cw = 15 + Math.random() * 25;
      const ch = 2 + Math.random() * 2;
      const cd = 15 + Math.random() * 25;
      const cMesh = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), cloudMaterial);
      const cx = (Math.random() - 0.5) * 350;
      const cz = (Math.random() - 0.5) * 350;
      const cy = 72 + Math.random() * 12;
      cMesh.position.set(cx, cy, cz);
      cloudsGroup.add(cMesh);
      
      clouds.push({
        mesh: cMesh,
        x: cx,
        z: cz,
        speed: 1.0 + Math.random() * 1.5,
      });
    }

    // --- PROCEDURAL MINECRAFT STEVE PLAYER MODEL ---
    const playerModelGroup = new THREE.Group();
    scene.add(playerModelGroup);

    const skinMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
    const shirtMaterial = new THREE.MeshLambertMaterial({ color: 0x008080 }); // Teal shirt
    const pantsMaterial = new THREE.MeshLambertMaterial({ color: 0x2e5c94 }); // Blue pants
    const hairMaterial = new THREE.MeshLambertMaterial({ color: 0x4e3629 }); // Brown hair

    // Head
    const headModel = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMaterial);
    headModel.position.set(0, 1.45, 0);
    playerModelGroup.add(headModel);

    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.1, 0.37), hairMaterial);
    hairMesh.position.set(0, 0.14, 0.01);
    headModel.add(hairMesh);

    const eyeGeom = new THREE.BoxGeometry(0.05, 0.03, 0.02);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x4a4ae6 }); // Blue eyes

    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(-0.08, 0.01, 0.176);
    const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.01), pupilMat);
    leftPupil.position.set(-0.01, 0, 0.01);
    leftEye.add(leftPupil);
    headModel.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(0.08, 0.01, 0.176);
    const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.01), pupilMat);
    rightPupil.position.set(0.01, 0, 0.01);
    rightEye.add(rightPupil);
    headModel.add(rightEye);

    // Torso
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.60, 0.22), shirtMaterial);
    torsoMesh.position.set(0, 0.9, 0);
    playerModelGroup.add(torsoMesh);

    // Arms
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.27, 1.15, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.12), shirtMaterial);
    leftArmMesh.position.set(0, -0.22, 0);
    leftArmPivot.add(leftArmMesh);
    playerModelGroup.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.27, 1.15, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.12), shirtMaterial);
    rightArmMesh.position.set(0, -0.22, 0);
    rightArmPivot.add(rightArmMesh);
    playerModelGroup.add(rightArmPivot);

    // Legs
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.1, 0.55, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.50, 0.13), pantsMaterial);
    leftLegMesh.position.set(0, -0.18, 0);
    leftLegPivot.add(leftLegMesh);
    playerModelGroup.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.1, 0.55, 0);
    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.50, 0.13), pantsMaterial);
    rightLegMesh.position.set(0, -0.18, 0);
    rightLegPivot.add(rightLegMesh);
    playerModelGroup.add(rightLegPivot);

    // Third-person held item
    const tpHeldItemGroup = new THREE.Group();
    tpHeldItemGroup.position.set(0, -0.26, 0.08);
    rightArmMesh.add(tpHeldItemGroup);

    // --- FIRST PERSON ARM SETUP ---
    const fpArmGroup = new THREE.Group();
    camera.add(fpArmGroup);
    fpArmGroup.position.set(0.48, -0.4, -0.6);

    const fpSleeveMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.45), shirtMaterial);
    fpSleeveMesh.position.set(0, 0, 0.1);
    fpArmGroup.add(fpSleeveMesh);

    const fpHandMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.12), skinMaterial);
    fpHandMesh.position.set(0, 0, -0.18);
    fpArmGroup.add(fpHandMesh);

    const fpHeldItemGroup = new THREE.Group();
    fpHeldItemGroup.position.set(0, -0.05, -0.24);
    fpArmGroup.add(fpHeldItemGroup);

    const lastActiveItemSig = { current: '' };

    const updateHeldItemVisuals = () => {
      const activeSlotIndex = stateRef.current.activeSlot;
      const equippedItem = stateRef.current.inventory[activeSlotIndex];

      while (fpHeldItemGroup.children.length > 0) {
        fpHeldItemGroup.remove(fpHeldItemGroup.children[0]);
      }
      while (tpHeldItemGroup.children.length > 0) {
        tpHeldItemGroup.remove(tpHeldItemGroup.children[0]);
      }

      if (equippedItem) {
        const itemDef = ITEMS[equippedItem.itemId];
        if (itemDef) {
          if (itemDef.isBlock) {
            const miniGeom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
            const miniMat = new THREE.MeshLambertMaterial({ color: itemDef.iconColor });
            
            const fpMiniMesh = new THREE.Mesh(miniGeom, miniMat);
            fpHeldItemGroup.add(fpMiniMesh);

            const tpMiniMesh = new THREE.Mesh(miniGeom, miniMat);
            tpHeldItemGroup.add(tpMiniMesh);
          } else {
            const miniGeom = new THREE.BoxGeometry(0.04, 0.22, 0.04);
            const miniMat = new THREE.MeshLambertMaterial({ color: itemDef.iconColor });
            
            const fpToolMesh = new THREE.Mesh(miniGeom, miniMat);
            fpToolMesh.rotation.z = Math.PI / 4;
            fpHeldItemGroup.add(fpToolMesh);

            const tpToolMesh = new THREE.Mesh(miniGeom, miniMat);
            tpToolMesh.rotation.z = Math.PI / 4;
            tpHeldItemGroup.add(tpToolMesh);
          }
        }
      }
    };

    // --- BLOCK BREAKING OVERLAY CRACKS & PARTICLES ---
    const miningCrackGroup = new THREE.Group();
    scene.add(miningCrackGroup);

    const crackMat = new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 2 });

    const updateMiningCracks = (progress: number) => {
      while (miningCrackGroup.children.length > 0) {
        const child = miningCrackGroup.children[0];
        miningCrackGroup.remove(child);
      }

      if (!currentTargetBlock.current || progress <= 0) return;

      const { x, y, z } = currentTargetBlock.current;
      miningCrackGroup.position.set(x + 0.5, y + 0.5, z + 0.5);

      const linePositions: number[] = [];
      const s = 0.505; // Slightly larger half-size to overlay seamlessly without depth fighting

      if (progress > 10) {
        // Draw cross cracks on each of the faces
        linePositions.push(-s, s, -s,  s, s,  s);
        linePositions.push( s, s, -s, -s, s,  s);

        linePositions.push(-s, -s, s,  s,  s, s);
        linePositions.push(-s,  s, s,  s, -s, s);
      }
      
      if (progress > 45) {
        linePositions.push(s, -s, -s, s,  s,  s);
        linePositions.push(s,  s, -s, s, -s,  s);

        linePositions.push(-s, -s, -s, -s,  s,  s);
        linePositions.push(-s,  s, -s, -s, -s,  s);
      }

      if (progress > 75) {
        linePositions.push(-s, -s, -s,  s,  s, -s);
        linePositions.push(-s,  s, -s,  s, -s, -s);

        linePositions.push(-s, -s, -s,  s, -s,  s);
        linePositions.push( s, -s, -s, -s, -s,  s);
        
        // Add full wire cracking frame
        linePositions.push(-s, -s, -s,  s, -s, -s);
        linePositions.push( s, -s, -s,  s,  s, -s);
        linePositions.push( s,  s, -s, -s,  s, -s);
        linePositions.push(-s,  s, -s, -s, -s, -s);

        linePositions.push(-s, -s,  s,  s, -s,  s);
        linePositions.push( s, -s,  s,  s,  s,  s);
        linePositions.push( s,  s,  s, -s,  s,  s);
        linePositions.push(-s,  s,  s, -s, -s,  s);

        linePositions.push(-s, -s, -s, -s, -s,  s);
        linePositions.push( s, -s, -s,  s, -s,  s);
        linePositions.push( s,  s, -s,  s,  s,  s);
        linePositions.push(-s,  s, -s, -s,  s,  s);
      }

      if (linePositions.length > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const segments = new THREE.LineSegments(geom, crackMat);
        miningCrackGroup.add(segments);
      }
    };

    const spawnBlockParticles = (bx: number, by: number, bz: number, bType: BlockType, count: number) => {
      const itemKey = Object.keys(ITEMS).find(k => ITEMS[k].blockType === bType);
      const colorHex = itemKey ? ITEMS[itemKey].iconColor : '#888888';
      const color = new THREE.Color(colorHex);

      const partMat = new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });

      for (let i = 0; i < count; i++) {
        const size = 0.08 + Math.random() * 0.08;
        const geom = new THREE.BoxGeometry(size, size, size);
        const pMesh = new THREE.Mesh(geom, partMat);

        const px = bx + 0.3 + Math.random() * 0.4;
        const py = by + 0.3 + Math.random() * 0.4;
        const pz = bz + 0.3 + Math.random() * 0.4;
        pMesh.position.set(px, py, pz);

        scene.add(pMesh);

        // Disperse with randomized drag and trajectory vectors
        const vx = (Math.random() - 0.5) * 4.0;
        const vy = 1.0 + Math.random() * 4.0;
        const vz = (Math.random() - 0.5) * 4.0;

        particles.current.push({
          mesh: pMesh,
          vx,
          vy,
          vz,
          age: 0,
          maxAge: 0.35 + Math.random() * 0.3,
        });
      }
    };

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaf0, 0.75);
    sunLight.position.set(20, 40, 20);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // 6. Mob Mesh Builders
    const zombieTexture = createMobTexture('zombie');
    const pigTexture = createMobTexture('pig');

    const createMobMesh = (type: 'zombie' | 'pig'): THREE.Group => {
      const group = new THREE.Group();

      if (type === 'zombie') {
        const mat = new THREE.MeshLambertMaterial({ map: zombieTexture });
        // Zombie shape: Head (0.6 cube), Torso (0.6x1.0), Arms (0.2x0.2x0.8 outstretched), Legs (0.25x1.0 each)
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
        head.position.y = 1.35;
        group.add(head);

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), mat);
        body.position.y = 0.7;
        group.add(body);

        // Arms straight forward
        const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.5), mat);
        leftArm.position.set(-0.3, 0.9, -0.22);
        group.add(leftArm);

        const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.5), mat);
        rightArm.position.set(0.3, 0.9, -0.22);
        group.add(rightArm);

        // Legs
        const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), mat);
        leftLeg.position.set(-0.15, 0.2, 0);
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), mat);
        rightLeg.position.set(0.15, 0.2, 0);
        group.add(rightLeg);
      } else {
        // Pig shape: Body (0.6x0.6x0.9), Head (0.4 cube), 4 legs (0.2x0.4 each)
        const mat = new THREE.MeshLambertMaterial({ map: pigTexture });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.5, 0.8), mat);
        body.position.y = 0.45;
        group.add(body);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
        head.position.set(0, 0.6, -0.45);
        group.add(head);

        const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), mat);
        l1.position.set(-0.2, 0.15, -0.25);
        group.add(l1);

        const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), mat);
        l2.position.set(0.2, 0.15, -0.25);
        group.add(l2);

        const l3 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), mat);
        l3.position.set(-0.2, 0.15, 0.25);
        group.add(l3);

        const l4 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), mat);
        l4.position.set(0.2, 0.15, 0.25);
        group.add(l4);
      }

      group.castShadow = true;
      group.receiveShadow = true;
      scene.add(group);
      return group;
    };

    // Spawn mobs dynamically near player
    const spawnMobItem = (type: 'pig' | 'zombie') => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 20;
      const mx = Math.floor(playerPos.current.x + Math.cos(angle) * radius) + 0.5;
      const mz = Math.floor(playerPos.current.z + Math.sin(angle) * radius) + 0.5;
      const my = findSafeSpawnY(world, Math.floor(mx), Math.floor(mz));

      const id = `${type}_${Date.now()}_${Math.random()}`;
      const mob: Mob = {
        id,
        type,
        x: mx,
        y: my,
        z: mz,
        vx: 0,
        vy: 0,
        vz: 0,
        hp: type === 'zombie' ? 15 : 6,
        maxHp: type === 'zombie' ? 15 : 6,
        isDead: false,
        isHurtTime: 0,
        stateTimer: 0,
      };

      mobsList.current.push(mob);
      const groupMesh = createMobMesh(type);
      groupMesh.position.set(mx, my, mz);
      mobMeshes.current.set(id, groupMesh);
    };

    for (let i = 0; i < 5; i++) spawnMobItem('pig');
    for (let i = 0; i < 3; i++) spawnMobItem('zombie');

    // 7. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;

    // 8. Handle Resize events through ResizeObserver accurately
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(containerRef.current);

    // Initial sizing
    const initialWidth = containerRef.current.clientWidth;
    const initialHeight = containerRef.current.clientHeight;
    camera.aspect = initialWidth / initialHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(initialWidth, initialHeight);

    // 9. Controls Event Triggers (Key Listerners)
    const onKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.isInventoryOpen) return;

      const code = e.code;
      keysPressed.current[code] = true;

      // Handle direct hotbar slot swapping (Keys 1-9)
      if (code.startsWith('Digit')) {
        const slot = parseInt(code.replace('Digit', '')) - 1;
        if (slot >= 0 && slot < 9) {
          // Speak back to parent state
          // Triggering direct active hotbar slot
        }
      }

      // Open Inventory standard key E
      if (code === 'KeyE') {
        e.preventDefault();
        // Exit mouse pointer pointerlock
        document.exitPointerLock();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 10. Pointer Lock Mouse binding hook
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvasRef.current;
      setIsLocked(locked);
      if (!locked) {
        // Clear buttons pressed to avoid gliding
        keysPressed.current = {};
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvasRef.current) return;
      const sensitivity = 0.0022;

      cameraRot.current.y -= e.movementX * sensitivity;
      cameraRot.current.x -= e.movementY * sensitivity;

      // Clamp vertical viewpoint pitch so player does not look upside down!
      cameraRot.current.x = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, cameraRot.current.x));

      camera.rotation.set(cameraRot.current.x, cameraRot.current.y, 0);
    };

    canvasRef.current.addEventListener('click', handleCanvasClick);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);

    // 12. Main Gameplay Core requestAnimationFrame Loop
    let lastTime = performance.now();
    let localTimeAccumulator = 0;
    let lavaDamageCooldown = 0;
    let hungerTimer = 0;

    let animFrameId: number;

    const gameLoop = (timeNow: number) => {
      animFrameId = requestAnimationFrame(gameLoop);

      let dt = (timeNow - lastTime) / 1000;
      if (dt > 0.15) dt = 0.15; // Cap to avoid collision glides during lag
      lastTime = timeNow;

      // Process at most 1 chunk per frame from the queue to maintain butter-smooth 60 FPS
      if (chunkLoadQueue.current.length > 0) {
        let nextChunkKey: string | undefined;
        while (chunkLoadQueue.current.length > 0) {
          const key = chunkLoadQueue.current.shift()!;
          if (!chunkMeshes.current.has(key)) {
            nextChunkKey = key;
            break;
          }
        }
        if (nextChunkKey) {
          const [ccx, ccz] = nextChunkKey.split(',').map(Number);
          rebuildChunkMeshes(ccx, ccz);
        }
      }

      // Ensure stats stay stable
      const localState = stateRef.current;
      if (localState.isInventoryOpen || localState.health <= 0) {
        renderer.render(scene, camera);
        return;
      }

      // --- DAYTIME CLOCK CYCLER ---
      // 24000 ticks in one Full Minecraft Day/Night loop (about 4 minutes real time)
      dayTimeRef.current += dt * 100;
      if (dayTimeRef.current >= 24000) {
        dayTimeRef.current = 0;
      }

      // Throttle the parent React state setDayTime once per second to avoid serious render lag
      localTimeAccumulator += dt;
      if (localTimeAccumulator >= 1.0) {
        setDayTime(Math.floor(dayTimeRef.current));
        localTimeAccumulator = 0;
      }

      // Ambient color changes between days
      const relativeTime = dayTimeRef.current; // 0 - 24000
      let skyR = 0.53, skyG = 0.81, skyB = 0.98; // Day clear blue
      let lightInten = 0.8;

      if (relativeTime > 11500 && relativeTime < 13000) {
        // Evening sunset: Blend to dark orange
        const ratio = (relativeTime - 11500) / 1500;
        skyR = THREE.MathUtils.lerp(0.53, 0.85, ratio);
        skyG = THREE.MathUtils.lerp(0.81, 0.45, ratio);
        skyB = THREE.MathUtils.lerp(0.98, 0.25, ratio);
        lightInten = THREE.MathUtils.lerp(0.8, 0.15, ratio);
      } else if (relativeTime >= 13000 && relativeTime < 22500) {
        // Midnight Navy blue
        skyR = 0.05; skyG = 0.06; skyB = 0.15;
        lightInten = 0.15;
      } else if (relativeTime >= 22500 && relativeTime < 24000) {
        // Sunrise: Dawn orange back to light blue
        const ratio = (relativeTime - 22500) / 1500;
        skyR = THREE.MathUtils.lerp(0.05, 0.53, ratio);
        skyG = THREE.MathUtils.lerp(0.06, 0.81, ratio);
        skyB = THREE.MathUtils.lerp(0.15, 0.98, ratio);
        lightInten = THREE.MathUtils.lerp(0.15, 0.8, ratio);
      }

      reusableSkyColor.setRGB(skyR, skyG, skyB);
      scene.background = reusableSkyColor;

      // Optimize existing fog color/density directly (avoids massive GC garbage churning)
      if (scene.fog) {
        if ('color' in scene.fog) {
          (scene.fog as THREE.FogExp2).color.setRGB(skyR, skyG, skyB);
        }
        // Drastically lower fog density (0.008 instead of 0.04) so blocks at far boundaries are fully visible!
        if ('density' in scene.fog) {
          (scene.fog as THREE.FogExp2).density = 0.008;
        }
      }

      sunLight.intensity = lightInten;
      ambientLight.intensity = lightInten * 0.5;

      // Handle Sun tracking arc
      const angle = (relativeTime / 24000) * Math.PI * 2 + Math.PI;
      sunLight.position.set(Math.cos(angle) * 30 + 16, Math.sin(angle) * 30 + 10, 16);

      // --- PLAYER CONTROLS & VELOCITY PHYSICS ---
      // Get movement coefficients
      const keyboard = keysPressed.current;

      const forwardX = -Math.sin(cameraRot.current.y);
      const forwardZ = -Math.cos(cameraRot.current.y);
      const rightX = Math.cos(cameraRot.current.y);
      const rightZ = -Math.sin(cameraRot.current.y);

      // Get move vector based on pressed WASD keys
      let moveX = 0;
      let moveZ = 0;
      if (keyboard['KeyW']) { moveX += forwardX; moveZ += forwardZ; }
      if (keyboard['KeyS']) { moveX -= forwardX; moveZ -= forwardZ; }
      if (keyboard['KeyA']) { moveX -= rightX; moveZ -= rightZ; }
      if (keyboard['KeyD']) { moveX += rightX; moveZ += rightZ; }

      // Normalize direction vector so diagonal movement is not faster!
      if (moveX !== 0 || moveZ !== 0) {
        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        moveX /= len;
        moveZ /= len;
      }

      const isSprinting = keyboard['ShiftLeft'] && (keyboard['KeyW'] || keyboard['KeyS'] || keyboard['KeyA'] || keyboard['KeyD']);
      const maxMoveSpeed = isSprinting ? 7.2 : 4.4;
      const accel = onGround.current ? 0.16 : 0.024; // Lower air control acceleration like real Minecraft!
      const friction = onGround.current ? 0.76 : 0.985; // Air drag matches floaty momentum!

      // Apply drag/friction
      playerVel.current.x *= friction;
      playerVel.current.z *= friction;

      // Add acceleration force
      playerVel.current.x += moveX * maxMoveSpeed * accel;
      playerVel.current.z += moveZ * maxMoveSpeed * accel;

      // Peak limit clamping
      const currentHorizSpeed = Math.sqrt(playerVel.current.x * playerVel.current.x + playerVel.current.z * playerVel.current.z);
      if (currentHorizSpeed > maxMoveSpeed) {
        playerVel.current.x = (playerVel.current.x / currentHorizSpeed) * maxMoveSpeed;
        playerVel.current.z = (playerVel.current.z / currentHorizSpeed) * maxMoveSpeed;
      }

      // Simple Swimming in lava or falling gravity
      const blockUnderFeet = world.getBlock(Math.floor(playerPos.current.x), Math.floor(playerPos.current.y - 0.2), Math.floor(playerPos.current.z));
      const headInsideBlock = world.getBlock(Math.floor(playerPos.current.x), Math.floor(playerPos.current.y + 1.0), Math.floor(playerPos.current.z));

      const isSubmerged = blockUnderFeet === BlockType.LAVA || headInsideBlock === BlockType.LAVA;

      if (isSubmerged) {
        // Fluid buoyancy in lava - fall very slowly, rise slowly on jump
        if (keyboard['Space']) {
          playerVel.current.y = 2.0;
        } else {
          playerVel.current.y = -1.2;
        }
      } else {
        // Standard air gravity (20 m/s^2)
        playerVel.current.y -= 21.0 * dt;

        // Jump trigger
        if (keyboard['Space'] && onGround.current) {
          playerVel.current.y = 8.0;
          onGround.current = false;
          playSound(280, 'sine', 0.08);

          // Hunger drops a tiny bit on jumps
          setHunger((h) => Math.max(0, h - 0.06));
        }
      }

      // --- RUN COLLISION CHECK STEP ---
      // Save height before step to calculate fall damage
      const preY = playerPos.current.y;

      const { onGround: hitGround, inLava } = moveWithCollisions(
        playerPos.current,
        playerVel.current,
        0.6, // player bounding width
        1.8, // player bounding height
        world,
        dt
      );

      onGround.current = hitGround;

      // Fall damage calculations
      if (playerVel.current.y < -3.5) {
        fallDistance.current += Math.abs(playerPos.current.y - preY);
      }

      if (hitGround) {
        if (fallDistance.current > 3.8) {
          // Half heart of damage per block fallen above 3.5m!
          const dmg = Math.floor((fallDistance.current - 3.5) * 1.5);
          if (dmg > 0) {
            setHealth((hp) => {
              const next = Math.max(0, hp - dmg);
              if (next <= 0) onGameOver();
              return next;
            });
            triggerHurtFlash();
            playSound(120, 'triangle', 0.25);
          }
        }
        fallDistance.current = 0;
      }

      // Submersion Lava burn damage
      if (inLava) {
        lavaDamageCooldown += dt;
        if (lavaDamageCooldown > 0.6) {
          setHealth((hp) => {
            const next = Math.max(0, hp - 4); // lava burns like crazy (2 full hearts per half second)
            if (next <= 0) onGameOver();
            return next;
          });
          triggerHurtFlash();
          playSound(80, 'square', 0.3);
          lavaDamageCooldown = 0;
        }
      }

      // --- DYNAMIC CHUNK RENDERING RESOLVER ---
      const pcx = Math.floor(playerPos.current.x / 16);
      const pcz = Math.floor(playerPos.current.z / 16);
      const activeVD = stateRef.current.viewDistance;
      if (pcx !== lastPlayerChunk.current.cx || pcz !== lastPlayerChunk.current.cz || activeVD !== lastViewDistance.current) {
        lastPlayerChunk.current = { cx: pcx, cz: pcz };
        lastViewDistance.current = activeVD;
        updateChunkVisibility(pcx, pcz, activeVD);
      }

      // Check if looking at a Crafting Table block nearby
      const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const hitBlock = world.raycast(
        camera.position.x,
        camera.position.y,
        camera.position.z,
        cameraDir.x,
        cameraDir.y,
        cameraDir.z,
        4.5 // limited hand reach
      );

      // Check adjacent crafting table proximity
      let foundWorkshop = false;
      // Scan surrounding boundaries manually
      const pxInt = Math.floor(playerPos.current.x);
      const pyInt = Math.floor(playerPos.current.y);
      const pzInt = Math.floor(playerPos.current.z);
      for (let sx = -3; sx <= 3; sx++) {
        for (let sy = -3; sy <= 3; sy++) {
          for (let sz = -3; sz <= 3; sz++) {
            if (world.getBlock(pxInt + sx, pyInt + sy, pzInt + sz) === BlockType.CRAFTING_TABLE) {
              foundWorkshop = true;
            }
          }
        }
      }
      if (foundWorkshop !== localState.isNearCraftingTable) {
        setIsNearCraftingTable(foundWorkshop);
      }

      // Update camera coordinates with authentic Minecraft View Bobbing!
      const horizontalSpeedSq = playerVel.current.x * playerVel.current.x + playerVel.current.z * playerVel.current.z;
      if (onGround.current && horizontalSpeedSq > 0.05) {
        bobbingTime.current += dt * (isSprinting ? 14.0 : 10.5);
      } else {
        // Smooth decresence of bobbing back to equilibrium
        const cycleRemainder = bobbingTime.current % (Math.PI * 2);
        if (cycleRemainder > 0.1) {
          bobbingTime.current -= dt * 6.0;
        } else {
          bobbingTime.current = 0;
        }
      }

      const bobY = Math.sin(bobbingTime.current) * (isSprinting ? 0.065 : 0.038);
      const bobX = Math.cos(bobbingTime.current / 2) * (isSprinting ? 0.032 : 0.018);

      // --- DYNAMIC CLOUDS MOTION CYCLE ---
      clouds.forEach((cloudObj) => {
        cloudObj.x += cloudObj.speed * dt * 0.15; // Slow ambient floating
        if (cloudObj.x > 250) cloudObj.x = -250;
        cloudObj.mesh.position.set(cloudObj.x, cloudObj.mesh.position.y, cloudObj.z);
      });

      // --- DYNAMIC HELD HAND ITEM UPDATE EVENT TRACING ---
      const activeSlotIndex = stateRef.current.activeSlot;
      const equippedItem = stateRef.current.inventory[activeSlotIndex];
      const currentActiveItemSig = `${activeSlotIndex}_${equippedItem?.itemId || 'empty'}`;
      if (lastActiveItemSig.current !== currentActiveItemSig) {
        lastActiveItemSig.current = currentActiveItemSig;
        updateHeldItemVisuals();
      }

      // --- CAMERA MODE POSITION CALCULATIONS & TRANSFORMS ---
      const currentCamMode = cameraModeRef.current;

      if (currentCamMode === 'first-person') {
        playerModelGroup.visible = false;
        fpArmGroup.visible = true;

        const movingCoeff = onGround.current && horizontalSpeedSq > 0.05 ? 1.0 : 0.0;
        const speedMultiplier = isSprinting ? 1.4 : 1.0;
        const armBobY = Math.sin(timeNow * 0.005) * 0.01 + Math.sin(bobbingTime.current) * 0.03 * movingCoeff * speedMultiplier;
        const armBobX = Math.cos(timeNow * 0.0025) * 0.006 + Math.sin(bobbingTime.current / 2) * 0.015 * movingCoeff * speedMultiplier;

        let swingZAngle = 0;
        if (isMiningRef.current) {
          swingZAngle = -Math.sin(timeNow * 0.02) * 0.4;
        }

        fpArmGroup.position.set(0.48 + armBobX, -0.4 + armBobY, -0.55);
        fpArmGroup.rotation.set(swingZAngle * 0.4, 0, swingZAngle);

        camera.position.set(
          playerPos.current.x + bobX,
          playerPos.current.y + 1.62 + bobY,
          playerPos.current.z
        );
      } else {
        playerModelGroup.visible = true;
        fpArmGroup.visible = false;

        const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const camTargetY = playerPos.current.y + 2.0;
        const camTargetX = playerPos.current.x - lookDir.x * 4.5;
        const camTargetZ = playerPos.current.z - lookDir.z * 4.5;

        let safeCamY = camTargetY;
        const groundHeightUnderCam = findSafeSpawnY(world, Math.floor(camTargetX), Math.floor(camTargetZ));
        if (camTargetY < groundHeightUnderCam) {
          safeCamY = groundHeightUnderCam + 0.3;
        }

        camera.position.set(camTargetX, safeCamY, camTargetZ);

        playerModelGroup.position.set(playerPos.current.x, playerPos.current.y, playerPos.current.z);
        playerModelGroup.rotation.y = cameraRot.current.y + Math.PI;

        const swingZAngle = isMiningRef.current ? -Math.sin(timeNow * 0.02) * 0.6 : 0;

        if (horizontalSpeedSq > 0.05) {
          const limbCycle = timeNow * 0.01;
          leftLegPivot.rotation.x = Math.sin(limbCycle) * 0.6;
          rightLegPivot.rotation.x = -Math.sin(limbCycle) * 0.6;
          leftArmPivot.rotation.x = Math.cos(limbCycle) * 0.4;
          rightArmPivot.rotation.x = -Math.cos(limbCycle) * 0.4 + swingZAngle;
        } else {
          leftLegPivot.rotation.x = 0;
          rightLegPivot.rotation.x = 0;
          leftArmPivot.rotation.x = Math.sin(timeNow * 0.003) * 0.05;
          rightArmPivot.rotation.x = -Math.sin(timeNow * 0.003) * 0.05 + swingZAngle;
        }
      }

      // --- VOXEL RAYCAST HOVER OUTLINE ---
      if (hitBlock) {
        outlineMesh.visible = true;
        outlineMesh.position.set(hitBlock.px + 0.5, hitBlock.py + 0.5, hitBlock.pz + 0.5);

        // Track target block
        currentTargetBlock.current = { x: hitBlock.px, y: hitBlock.py, z: hitBlock.pz, type: hitBlock.blockType };
      } else {
        outlineMesh.visible = false;
        currentTargetBlock.current = null;
        mineTimeAccumulator.current = 0;
        setMiningState(false);
        setMiningProgress(0);
        updateMiningCracks(0);
      }

      // --- SURVIVAL MOB INSTANCE AI LOOPS ---
      const activeItem = localState.inventory[localState.activeSlot];
      const activeDef = activeItem ? ITEMS[activeItem.itemId] : null;

      // Handle continuous mining trigger
      if (isMiningRef.current && currentTargetBlock.current) {
        const blockType = currentTargetBlock.current.type;
        mineTimeAccumulator.current += dt;

        // Pickaxes decrease stone mining times. Axes speed up wood. Hands cannot mine solid stone or metal blocks.
        let baseBreakTime = 2.0; // hand on grass/dirt
        if (blockType === BlockType.STONE || blockType === BlockType.COAL_ORE || blockType === BlockType.IRON_ORE) {
          if (activeDef?.isTool && activeDef?.toolMaterial === 'iron') {
            baseBreakTime = 0.25;
          } else if (activeDef?.isTool && activeDef?.toolMaterial === 'stone') {
            baseBreakTime = 0.6;
          } else if (activeDef?.isTool && activeDef?.toolMaterial === 'wood') {
            baseBreakTime = 1.25;
          } else {
            baseBreakTime = 6.5; // Hand mining stone is uselessly slow in survival!
          }
        } else if (blockType === BlockType.WOOD_TRUNK || blockType === BlockType.PLANKS) {
          baseBreakTime = activeDef?.id.includes('axe') ? 0.2 : 0.7; // easy wood chops
        } else if (blockType === BlockType.LEAVES) {
          baseBreakTime = 0.08; // Leaves clip instantly
        } else if (blockType === BlockType.BEDROCK) {
          baseBreakTime = Infinity; // Invulnerable!
        }

        const percentage = Math.min(100, Math.floor((mineTimeAccumulator.current / baseBreakTime) * 100));
        setMiningProgress(percentage);
        updateMiningCracks(percentage);

        // Sparkle click crunch sounds and tiny digging particles
        if (Math.random() < 0.2) {
          playSound(blockType === BlockType.STONE ? 150 : 250, 'triangle', 0.05);
          spawnBlockParticles(currentTargetBlock.current.x, currentTargetBlock.current.y, currentTargetBlock.current.z, blockType, 2);
        }

        if (mineTimeAccumulator.current >= baseBreakTime) {
          // MINING COMPLETE! Break the block and drop materials!
          const { x, y, z } = currentTargetBlock.current;
          world.setBlock(x, y, z, BlockType.AIR);

          // Rebuild instanced meshes for current and neighboring chunks
          triggerChunkUpdateForBlock(x, y, z);

          playSound(320, 'square', 0.12);
          spawnBlockParticles(x, y, z, blockType, 16);

          // Survival Item Drops math
          let dropItemId: string | null = null;
          let dropCount = 1;

          if (blockType === BlockType.GRASS) dropItemId = 'dirt';
          else if (blockType === BlockType.DIRT) dropItemId = 'dirt';
          else if (blockType === BlockType.STONE) {
            // Must have a wooden/stone/iron pickaxe to extract cobble stone blocks in survival!
            if (activeDef?.isTool && activeDef?.toolMaterial) {
              dropItemId = 'stone';
            }
          } else if (blockType === BlockType.COAL_ORE) {
            if (activeDef?.isTool && activeDef?.toolMaterial) {
              dropItemId = 'coal';
            }
          } else if (blockType === BlockType.IRON_ORE) {
            // Must have a stone or iron pickaxe to extract Iron Ore! Wood does not drop it.
            if (activeDef?.isTool && (activeDef.toolMaterial === 'stone' || activeDef.toolMaterial === 'iron')) {
              dropItemId = 'iron_ore';
            }
          } else if (blockType === BlockType.WOOD_TRUNK) dropItemId = 'wood_trunk';
          else if (blockType === BlockType.PLANKS) dropItemId = 'planks';
          else if (blockType === BlockType.CRAFTING_TABLE) dropItemId = 'crafting_table';
          else if (blockType === BlockType.LEAVES) {
            // Tiny chance to drop premium apples
            if (Math.random() < 0.2) {
              dropItemId = 'apple';
            }
          }

          if (dropItemId) {
            const itemX = x + 0.5;
            const itemY = y + 0.5;
            const itemZ = z + 0.5;
            spawnItemDrop(dropItemId, dropCount, itemX, itemY, itemZ);
          }

          // Reset mine trigger
          setMiningProgress(0);
          updateMiningCracks(0);
          setIsMining(false);
          mineTimeAccumulator.current = 0;
        }
      }

      // --- HOSTILE ZOMBIES AND CUTE PIGS AI ---
      mobsList.current.forEach((mob) => {
        if (mob.isDead) return;

        const mMesh = mobMeshes.current.get(mob.id);
        if (!mMesh) return;

        mob.stateTimer += dt;

        // Apply general gravity on mobs
        mob.vy -= 20 * dt;

        // Zombie logic: Target player
        if (mob.type === 'zombie') {
          // If daytime, Zombie catches fire and burns!
          const isDaytime = relativeTime < 13000 || relativeTime > 23000;
          if (isDaytime) {
            mob.hp -= dt * 2.5; // Burns to crisp in 6s
            // Make mesh glow orange
            mMesh.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material.color.setHex(0xffaa22);
              }
            });

            if (mob.hp <= 0) {
              mob.isDead = true;
              scene.remove(mMesh);
              mobMeshes.current.delete(mob.id);
              playSound(60, 'sawtooth', 0.4);
              setScore((s) => s + 0.5); // score increase for zombie deaths!
              
              // Zombie Death Drops!
              if (Math.random() < 0.6) {
                spawnItemDrop('coal', 1, mob.x, mob.y + 0.5, mob.z);
              } else if (Math.random() < 0.35) {
                spawnItemDrop('apple', 1, mob.x, mob.y + 0.5, mob.z);
              }
              return;
            }
          } else {
            // Restore normal color (or flashing white/red if hurt)
            const curTime = performance.now();
            const hurt = (curTime - mob.isHurtTime) < 300;
            mMesh.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material.color.setHex(hurt ? 0xff0000 : 0xffffff);
              }
            });
          }

          const dxToPlayer = playerPos.current.x - mob.x;
          const dzToPlayer = playerPos.current.z - mob.z;
          const distToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dzToPlayer * dzToPlayer);

          // Chase radius
          if (distToPlayer < 14 && distToPlayer > 0.8) {
            const angleToPlayer = Math.atan2(dxToPlayer, dzToPlayer);
            const moveSpeed = 2.4;
            mob.vx = Math.sin(angleToPlayer) * moveSpeed;
            mob.vz = Math.cos(angleToPlayer) * moveSpeed;

            // Make Zombie look at player
            mMesh.rotation.y = angleToPlayer;

            // Simple Attack: zombie is extremely close
            if (distToPlayer < 1.4 && Math.abs(mob.y - playerPos.current.y) < 1.5) {
              if (mob.stateTimer > 1.2) {
                // Bite! Deal 3 damage (1.5 hearts)
                setHealth((hp) => {
                  const next = Math.max(0, hp - 3);
                  if (next <= 0) onGameOver();
                  return next;
                });
                triggerHurtFlash();
                playSound(90, 'sawtooth', 0.3);
                mob.stateTimer = 0; // attack cooldown
              }
            }
          } else {
            // Idle wander
            if (mob.stateTimer > 4.5) {
              const rx = (Math.random() - 0.5) * 5;
              const rz = (Math.random() - 0.5) * 5;
              mob.vx = rx;
              mob.vz = rz;
              mob.stateTimer = 0;
            }
          }
        } else {
          // Cute Pig wander: runs away if hurt recently
          const curTime = performance.now();
          const pShed = (curTime - mob.isHurtTime) < 4000;
          const hurtFl = (curTime - mob.isHurtTime) < 300;

          mMesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material.color.setHex(hurtFl ? 0xff0000 : 0xffffff);
            }
          });

          if (pShed) {
            // Run away rapidly from threat!
            const dxToPlayer = playerPos.current.x - mob.x;
            const dzToPlayer = playerPos.current.z - mob.z;
            const angleAway = Math.atan2(dxToPlayer, dzToPlayer) + Math.PI;

            mob.vx = Math.sin(angleAway) * 4.8;
            mob.vz = Math.cos(angleAway) * 4.8;
            mMesh.rotation.y = angleAway;
          } else {
            // Standard peaceful wander
            if (mob.stateTimer > 4.0) {
              const angle = Math.random() * Math.PI * 2;
              const move = Math.random() > 0.45 ? 1.0 : 0;
              mob.vx = Math.sin(angle) * move;
              mob.vz = Math.cos(angle) * move;
              mMesh.rotation.y = angle;
              mob.stateTimer = 0;
            }
          }
        }

        // Apply velocities with full AABB collision check on Mobs!
        const mobCoord = { x: mob.x, y: mob.y, z: mob.z };
        const mobVel = { x: mob.vx, y: mob.vy, z: mob.vz };

        const { onGround: mobGround, collidedX, collidedZ } = moveWithCollisions(
          mobCoord,
          mobVel,
          0.55, // mob width
          1.0, // mob height
          world,
          dt
        );

        mob.x = mobCoord.x;
        mob.y = mobCoord.y;
        mob.z = mobCoord.z;
        mob.vy = mobVel.y;

        // Auto Jump over obstacles! If a mob collides horizontally, it hops
        if ((collidedX || collidedZ) && mobGround) {
          mob.vy = 5.2;
        }

        // Keep mesh aligned with game coord
        mMesh.position.set(mob.x, mob.y, mob.z);

        // Simple leg swing animation proportional to velocity
        const horizontalSpeed = Math.sqrt(mob.vx * mob.vx + mob.vz * mob.vz);
        if (horizontalSpeed > 0.1) {
          const legSwing = Math.sin(timeNow * 0.01) * 0.45;
          // Find legs (child 4, 5, etc.) and rotate
          let idx = 0;
          mMesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry.type === 'BoxGeometry') {
              // Legs are lower down (Y position < 0.4)
              if (child.position.y < 0.4) {
                child.rotation.x = idx % 2 === 0 ? legSwing : -legSwing;
                idx++;
              }
            }
          });
        }
      });

      // --- HUNGER DEGRADATION & HP REGENERATION ---
      hungerTimer += dt;
      if (hungerTimer > 5.0) {
        // Lose 0.5 hunger (0.25 points) every 5 seconds of activity
        const walkVelocity = playerVel.current.length();
        let cost = 0.15;
        if (walkVelocity > 5) cost = 0.4; // running starves faster!
        setHunger((h) => {
          const next = Math.max(0, h - cost);
          if (next === 0) {
            // Starvation damage! Deals 1 damage (half heart) every 4 seconds
            setHealth((hp) => {
              const updatedHp = Math.max(0, hp - 1);
              if (updatedHp <= 0) onGameOver();
              return updatedHp;
            });
            triggerHurtFlash();
            playSound(110, 'sawtooth', 0.2);
          }
          return next;
        });

        // Fast regeneration if health is depleted and hunger is full!
        if (localState.hunger >= 18 && localState.health < 20) {
          setHealth((hp) => Math.min(20, hp + 1));
          playSound(440, 'sine', 0.04);
        }

        hungerTimer = 0;
      }

      // --- UPDATE GRAPHICS, MOVEMENT AND LIFETIME OF FLOATING ITEM DROPS ---
      const activeItemDrops = itemDrops.current;
      const px = playerPos.current.x;
      const py = playerPos.current.y;
      const pz = playerPos.current.z;

      for (let i = activeItemDrops.length - 1; i >= 0; i--) {
        const drop = activeItemDrops[i];

        // Apply gravity to floating drops
        drop.vy -= 12.0 * dt;

        // Update position
        drop.x += drop.vx * dt;
        drop.y += drop.vy * dt;
        drop.z += drop.vz * dt;

        // Apply friction damping
        drop.vx *= 0.93;
        drop.vz *= 0.93;

        // Simple land/block collision check so they settle beautifully on ground
        const bx = Math.floor(drop.x);
        const by = Math.floor(drop.y);
        const bz = Math.floor(drop.z);
        const blockBelow = world.getBlock(bx, by, bz);

        if (blockBelow !== BlockType.AIR && blockBelow !== BlockType.LAVA) {
          drop.y = by + 1.0;
          drop.vy = 0;
          drop.vx *= 0.7;
          drop.vz *= 0.7;
        }

        // Bobbing & Rotation for visual float effect
        const ageSec = (performance.now() - drop.spawnTime) / 1000;
        drop.mesh.position.set(drop.x, drop.y + Math.sin(ageSec * 3.0) * 0.08 + 0.1, drop.z);
        drop.mesh.rotation.y += dt * 1.5;

        // Suction towards player after a brief delay (0.2s)
        if (ageSec > 0.20) {
          const dx = px - drop.x;
          const dy = (py + 0.8) - drop.y; // attract to chest center
          const dz = pz - drop.z;
          const distToPlayer = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (distToPlayer < 3.5) {
            const pullForce = 9.0 / (distToPlayer + 0.1);
            drop.vx += (dx / distToPlayer) * pullForce * dt;
            drop.vy += (dy / distToPlayer) * pullForce * dt;
            drop.vz += (dz / distToPlayer) * pullForce * dt;
          }

          // Collection boundary check
          if (distToPlayer < 1.25) {
            const remaining = addItemToInventoryMC(drop.itemId, drop.count);
            if (remaining < drop.count) {
              playSound(580, 'sine', 0.1);
              if (remaining <= 0) {
                scene.remove(drop.mesh);
                activeItemDrops.splice(i, 1);
              } else {
                drop.count = remaining; // update drop count if partially filled
              }
              continue;
            }
          }
        }
      }

      // --- CRUMBLING GRAPHICS PARTICLES REEVALUATION LOOP ---
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.age += dt;

        // Apply friction and gravitational drag
        p.vx *= 0.98;
        p.vy -= 16.0 * dt;
        p.vz *= 0.98;

        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;

        const ratio = Math.max(0, 1.0 - (p.age / p.maxAge));
        p.mesh.scale.set(ratio, ratio, ratio);

        if (p.age >= p.maxAge) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          if (Array.isArray(p.mesh.material)) {
            p.mesh.material.forEach((m: any) => m.dispose());
          } else {
            p.mesh.material.dispose();
          }
          particles.current.splice(i, 1);
        }
      }

      // 14. Finally Render frame
      renderer.render(scene, camera);
    };

    // Damage flash triggers red overlay screen
    const triggerHurtFlash = () => {
      setHurtOverlay(true);
      setTimeout(() => setHurtOverlay(false), 240);
    };

    animFrameId = requestAnimationFrame(gameLoop);

    // --- LEFT & RIGHT CLICKS (Attack / Mine, and Place Block) ---
    const handleMouseClicks = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvasRef.current || stateRef.current.isInventoryOpen) return;

      const actItem = stateRef.current.inventory[stateRef.current.activeSlot];
      const actDef = actItem ? ITEMS[actItem.itemId] : null;

      const typeOsc = (t: string) => t === 'zombie' ? 90 : 180;

      if (e.button === 0) {
        // --- LEFT CLICK: Attack Mobs or Break Blocks ---
        // First check if a mob is directly in range of our sight line (standard combat)
        const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        let mobStruck = false;

        // Perform ray collision with Mob models manually
        for (const mob of mobsList.current) {
          if (mob.isDead) continue;
          // Distance
          const dx = mob.x - playerPos.current.x;
          const dy = mob.y - playerPos.current.y;
          const dz = mob.z - playerPos.current.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < 4.2) {
            // Sight angle check (dot product)
            const playerToMob = new THREE.Vector3(dx, dy, dz).normalize();
            const headingAlignment = cameraDir.dot(playerToMob);

            if (headingAlignment > 0.88) {
              // HIT SUCCESSFUL!
              mobStruck = true;
              mob.isHurtTime = performance.now();
              // Combat damage (Sword buffs damage!)
              let damageVal = actDef?.attackDamage || 1; // base hand hit is 1
              mob.hp -= damageVal;

              playSound(typeOsc(mob.type), 'sawtooth', 0.15);

              // Knockback: propel mob backwards away from player
              const force = 4.0;
              mob.vx = playerToMob.x * force;
              mob.vz = playerToMob.z * force;
              mob.vy = 4.2; // hop a bit in hit reaction

              if (mob.hp <= 0) {
                mob.isDead = true;
                const mesh = mobMeshes.current.get(mob.id);
                if (mesh) {
                  scene.remove(mesh);
                  mobMeshes.current.delete(mob.id);
                }
                // Loot Drops!
                setScore((s) => s + 1.0);
                if (mob.type === 'pig') {
                  const dropQty = 1 + Math.floor(Math.random() * 2);
                  for (let d = 0; d < dropQty; d++) {
                    spawnItemDrop('porkchop_raw', 1, mob.x, mob.y + 0.5, mob.z);
                  }
                } else if (mob.type === 'zombie') {
                  if (Math.random() < 0.6) {
                    spawnItemDrop('coal', 1, mob.x, mob.y + 0.5, mob.z);
                  } else if (Math.random() < 0.35) {
                    spawnItemDrop('apple', 1, mob.x, mob.y + 0.5, mob.z);
                  }
                }
              }
              break; // strike only one mob per click
            }
          }
        }

        if (!mobStruck) {
          // If no mob struck, trigger block mining
          setMiningState(true);
        }
      } else if (e.button === 2) {
        // --- RIGHT CLICK: Place Blocks or Consume Food ---
        e.preventDefault();

        if (actDef?.isFood) {
          // Consume Food item!
          setHunger((curHung) => Math.min(20, curHung + (actDef.healHunger || 1)));
          setHealth((curHp) => Math.min(20, curHp + (actDef.healHealth || 0)));
          playSound(180, 'triangle', 0.2);

          // Deduct food count
          const nextInv = [...stateRef.current.inventory];
          if (nextInv[stateRef.current.activeSlot]) {
            nextInv[stateRef.current.activeSlot]!.count -= 1;
            if (nextInv[stateRef.current.activeSlot]!.count <= 0) {
              nextInv[stateRef.current.activeSlot] = null;
            }
            setInventory(nextInv);
          }
        } else if (actDef?.isBlock && currentTargetBlock.current) {
          // Place Block coordinate maths
          // We need the normal face where ray intersected
          const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          const hitBlock = world.raycast(
            camera.position.x,
            camera.position.y,
            camera.position.z,
            cameraDir.x,
            cameraDir.y,
            cameraDir.z,
            4.5
          );

          if (hitBlock) {
            const px = hitBlock.px + hitBlock.nx;
            const py = hitBlock.py + hitBlock.ny;
            const pz = hitBlock.pz + hitBlock.nz;

            // Make sure block location target is within world height bounds
            if (py >= 0 && py < WORLD_HEIGHT) {
              // Ensure placing the block doesn't collide with the player's own body box!
              const playerBox = {
                minX: playerPos.current.x - 0.3,
                maxX: playerPos.current.x + 0.3,
                minY: playerPos.current.y,
                maxY: playerPos.current.y + 1.8,
                minZ: playerPos.current.z - 0.3,
                maxZ: playerPos.current.z + 0.3,
              };

              const newBlockBox = {
                minX: px,
                minY: py,
                minZ: pz,
                maxX: px + 1,
                maxY: py + 1,
                maxZ: pz + 1,
              };

              // Overlap check
              const conflicts = (
                playerBox.minX < newBlockBox.maxX &&
                playerBox.maxX > newBlockBox.minX &&
                playerBox.minY < newBlockBox.maxY &&
                playerBox.maxY > newBlockBox.minY &&
                playerBox.minZ < newBlockBox.maxZ &&
                playerBox.maxZ > newBlockBox.minZ
              );

              if (!conflicts) {
                const blockType = actDef.blockType!;
                world.setBlock(px, py, pz, blockType);

                // Rebuild chunk meshes for placed block and its neighbors
                triggerChunkUpdateForBlock(px, py, pz);

                playSound(200, 'triangle', 0.08);

                // Deduct 1 block count
                const nextInv = [...stateRef.current.inventory];
                if (nextInv[stateRef.current.activeSlot]) {
                  nextInv[stateRef.current.activeSlot]!.count -= 1;
                  if (nextInv[stateRef.current.activeSlot]!.count <= 0) {
                    nextInv[stateRef.current.activeSlot] = null;
                  }
                  setInventory(nextInv);
                }
              }
            }
          }
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        setMiningState(false);
        setMiningProgress(0);
        updateMiningCracks(0);
        mineTimeAccumulator.current = 0;
      }
    };

    window.addEventListener('mousedown', handleMouseClicks);
    window.addEventListener('mouseup', handleMouseUp);

    // --- CLEANUP ALL TIMERS & EVENT HANDLERS ---
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      resizeObserver.disconnect();
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('click', handleCanvasClick);
      }
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', handleMouseClicks);
      window.removeEventListener('mouseup', handleMouseUp);
      // Clean scene and meshes
      itemDrops.current.forEach((drop) => {
        scene.remove(drop.mesh);
        drop.mesh.geometry.dispose();
        if (Array.isArray(drop.mesh.material)) {
          drop.mesh.material.forEach((mat) => mat.dispose());
        } else {
          drop.mesh.material.dispose();
        }
      });
      itemDrops.current = [];

      chunkMeshes.current.forEach((meshMap) => {
        meshMap.forEach((mesh) => {
          mesh.dispose();
        });
      });
      chunkMeshes.current.clear();

      blockGeom.dispose();
      outlineGeom.dispose();
      outlineMat.dispose();
      zombieTexture.dispose();
      pigTexture.dispose();
      renderer.dispose();
    };
  }, []);

  // Hotbar select slots triggers easily via clicking too
  const handleHotbarClick = (idx: number) => {
    // speaking to parent via custom hotbar click is supported inside React
  };

  return (
    <div ref={containerRef} className="relative w-full h-full select-none cursor-crosshair">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Pause Menu screen / overlay when not pointerlocked */}
      {!isLocked && !isInventoryOpen && (
        <div id="pause-menu-overlay" className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20 pointer-events-auto">
          <div className="bg-zinc-900 border-4 border-yellow-600 p-6 w-full max-w-md text-center shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex flex-col items-center gap-5 font-mono">
            
            <div className="flex flex-col items-center gap-1 border-b border-zinc-800 pb-2.5 w-full">
              <h2 className="text-xl font-extrabold tracking-widest text-yellow-400 uppercase">
                Game Paused
              </h2>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                World: {activeWorld?.name}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-3 w-full">
              <button
                id="btn-resume-game"
                onClick={handleCanvasClick}
                className="w-full bg-[#559944] hover:bg-[#5c9e31] font-bold uppercase py-2.5 px-6 rounded border-b-4 border-l-2 border-r-2 border-black active:translate-y-0.5 cursor-pointer text-xs text-white"
              >
                Resume Game
              </button>
              
              <button
                id="btn-save-world"
                onClick={handleSaveGameData}
                className="w-full bg-yellow-600 hover:bg-yellow-700 font-bold uppercase py-2.5 px-6 rounded border-b-4 border-l-2 border-r-2 border-black active:translate-y-0.5 cursor-pointer text-xs text-white flex items-center justify-center gap-1.5"
              >
                Save World Progress
              </button>

              <button
                id="btn-quit-to-title"
                onClick={() => {
                  handleSaveGameData();
                  onQuitToMenu();
                }}
                className="w-full bg-[#4e1e1e] hover:bg-[#682727] font-bold uppercase py-2.5 px-6 rounded border-b-4 border-l-2 border-r-2 border-[#1e1e1e] active:translate-y-0.5 cursor-pointer text-xs text-white"
              >
                Save & Quit to Title
              </button>
            </div>

            {showSaveMessage && (
              <div id="save-success-badge" className="bg-green-950/80 border border-green-500/50 text-green-400 text-[10px] font-bold uppercase px-3 py-10 animate-pulse tracking-wider w-full text-center">
                ✔ Progress Saved Safely!
              </div>
            )}

            {/* Togglable Controls reference */}
            <div className="w-full text-left bg-zinc-950 p-3 border-2 border-zinc-800 text-[11px] leading-relaxed flex flex-col gap-1 text-zinc-300">
              <span className="text-yellow-500 font-bold uppercase text-[9px] tracking-wider mb-1 block border-b border-zinc-800 pb-0.5 font-mono">Controls Reference:</span>
              <p>• <span className="text-white font-semibold">Left-Click the screen</span> or click Resume to play.</p>
              <p>• <span className="text-white font-semibold">W, A, S, D</span> to Move. <span className="text-white font-semibold">SHIFT</span> to Sprint.</p>
              <p>• <span className="text-white font-semibold">Spacebar</span> to Jump.</p>
              <p>• <span className="text-white font-semibold">Left Click</span> to break blocks / attack zombies.</p>
              <p>• <span className="text-white font-semibold">Right Click</span> to place blocks / eat food.</p>
              <p>• <span className="text-white font-semibold">Keys 1 to 9</span> to change active block.</p>
              <p>• Press <span className="text-white font-semibold">E</span> to open inventory / Craft tools.</p>
            </div>

          </div>
        </div>
      )}



      {/* Hurt Damage Flash Overlay */}
      {hurtOverlay && (
        <div className="absolute inset-0 bg-red-650/45 saturate-150 animate-ping duration-150 pointer-events-none z-40" />
      )}
    </div>
  );
}
