/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import InventoryScreen from './components/InventoryScreen';
import MainMenu from './components/MainMenu';
import { InventoryItem, SavedWorld, GameSettings, DEFAULT_SETTINGS } from './types';

export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  
  // Health: 0 to 20 (10 hearts)
  const [health, setHealth] = useState(20);
  
  // Hunger: 0 to 20 (10 drumsticks)
  const [hunger, setHunger] = useState(20);

  // Settings
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem('minecraft_settings');
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('minecraft_settings', JSON.stringify(settings));
    } catch (e) {
      console.error(e);
    }
  }, [settings]);

  // View Distance in Chunks (1 to 3) (Sync with settings)
  const viewDistance = settings.viewDistance ?? settings.fov ? Math.max(1, Math.min(3, Math.round(settings.fov / 25))) : 2;
  const setViewDistance = (dist: number) => {
    setSettings(prev => ({ ...prev, viewDistance: dist }));
  };
  
  // Active hotbar slot: 0 to 8
  const [activeSlot, setActiveSlot] = useState(0);
  
  // Time Cycle: 0 to 24000 ticks
  const [dayTime, setDayTime] = useState(2000); // starts shortly after sunrise!

  // High score tracking
  const [score, setScore] = useState(0);

  // Inventory storage: indices 0-26 (inventory chest), 27-35 (hotbar 1-9)
  const [inventory, setInventory] = useState<(InventoryItem | null)[]>(() => {
    const inv = Array(36).fill(null);
    inv[27] = { itemId: 'apple', count: 4 };
    return inv;
  });

  // World persistence
  const [worlds, setWorlds] = useState<SavedWorld[]>(() => {
    try {
      const stored = localStorage.getItem('minecraft_worlds');
      if (stored && stored !== '[]') {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    // Create a beautiful default starter world if none exists
    const defaultWorld: SavedWorld = {
      id: 'default_survival_world',
      name: 'Default Survival World',
      seedOffsetX: Math.random() * 10000,
      seedOffsetZ: Math.random() * 10000,
      modifiedBlocks: {},
      lastPlayed: Date.now(),
      health: 20,
      hunger: 20,
      dayTime: 2000,
      score: 0,
    };
    try {
      localStorage.setItem('minecraft_worlds', JSON.stringify([defaultWorld]));
    } catch (e) {
      console.error(e);
    }
    return [defaultWorld];
  });

  const [activeWorld, setActiveWorld] = useState<SavedWorld | null>(() => {
    return worlds[0] || null;
  });

  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isNearCraftingTable, setIsNearCraftingTable] = useState(false);

  // Key Listeners for Hotbar and Inventory toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;

      // Toggle inventory on E
      if (e.code === 'KeyE') {
        e.preventDefault();
        setIsInventoryOpen((prev) => !prev);
      }

      // Hotbar selection using digits 1-9
      if (!isInventoryOpen && e.code.startsWith('Digit')) {
        const slot = parseInt(e.code.replace('Digit', '')) - 1;
        if (slot >= 0 && slot < 9) {
          setActiveSlot(slot);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isInventoryOpen]);

  // Save changes back to localStorage
  const handleSaveActiveWorld = (updatedWorldProps: Partial<SavedWorld>) => {
    if (!activeWorld) return;

    const updatedWorld: SavedWorld = {
      ...activeWorld,
      ...updatedWorldProps,
      lastPlayed: Date.now(),
    };

    setActiveWorld(updatedWorld);

    setWorlds((prevWorlds) => {
      const nextWorlds = prevWorlds.map((w) => (w.id === updatedWorld.id ? updatedWorld : w));
      try {
        localStorage.setItem('minecraft_worlds', JSON.stringify(nextWorlds));
      } catch (e) {
        console.error('Failed to save worlds to storage:', e);
      }
      return nextWorlds;
    });
  };

  // Start the survival simulation for selected world
  const handleStartGame = (world: SavedWorld) => {
    setActiveWorld(world);
    
    // Load state from saved world
    setHealth(world.health ?? 20);
    setHunger(world.hunger ?? 20);
    setScore(world.score ?? 0);
    setDayTime(world.dayTime ?? 2000);

    if (world.inventory) {
      setInventory(world.inventory);
    } else {
      const defaultInv = Array(36).fill(null);
      defaultInv[27] = { itemId: 'apple', count: 4 };
      setInventory(defaultInv);
    }

    setGameState('playing');
  };

  // Safe respawn
  const handleRespawn = () => {
    setHealth(20);
    setHunger(20);
    // Survival rule: clear inventory on death, reset starting items
    const resetInv = Array(36).fill(null);
    resetInv[27] = { itemId: 'apple', count: 4 };
    setInventory(resetInv);
    setIsInventoryOpen(false);

    // Save state on respawn
    handleSaveActiveWorld({
      health: 20,
      hunger: 20,
      inventory: resetInv,
      score: 0,
    });

    setGameState('playing');
  };

  const handleGameOver = () => {
    setGameState('gameover');
    setIsInventoryOpen(false);
  };

  // World selection and actions called from MainMenu
  const handleSelectWorld = (world: SavedWorld | null) => {
    setActiveWorld(world);
  };

  const handleCreateWorld = (name: string, seedStr: string) => {
    let seedOffsetX = Math.random() * 10000;
    let seedOffsetZ = Math.random() * 10000;
    
    if (seedStr) {
      // Deterministic seed based on string hash
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
      }
      seedOffsetX = Math.abs(hash % 5000);
      seedOffsetZ = Math.abs((hash >> 3) % 5000);
    }

    const newWorld: SavedWorld = {
      id: `world_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      seedOffsetX,
      seedOffsetZ,
      modifiedBlocks: {},
      lastPlayed: Date.now(),
      health: 20,
      hunger: 20,
      dayTime: 2000,
      score: 0,
    };

    setWorlds((prev) => {
      const next = [newWorld, ...prev];
      try {
        localStorage.setItem('minecraft_worlds', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    setActiveWorld(newWorld);
  };

  const handleDeleteWorld = (id: string) => {
    setWorlds((prev) => {
      const next = prev.filter((w) => w.id !== id);
      try {
        localStorage.setItem('minecraft_worlds', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    if (activeWorld?.id === id) {
      setActiveWorld(null);
    }
  };

  const handleQuitToMenu = () => {
    setIsInventoryOpen(false);
    setGameState('menu');
  };

  return (
    <div id="game-container" className="relative w-screen h-screen overflow-hidden bg-zinc-950 flex select-none">
      
      {/* Dynamic 3D Voxel canvas engine */}
      {gameState === 'playing' && activeWorld && (
        <GameCanvas
          inventory={inventory}
          setInventory={setInventory}
          activeSlot={activeSlot}
          health={health}
          setHealth={setHealth}
          hunger={hunger}
          setHunger={setHunger}
          isInventoryOpen={isInventoryOpen}
          setIsInventoryOpen={setIsInventoryOpen}
          isNearCraftingTable={isNearCraftingTable}
          setIsNearCraftingTable={setIsNearCraftingTable}
          dayTime={dayTime}
          setDayTime={setDayTime}
          score={score}
          setScore={setScore}
          onGameOver={handleGameOver}
          viewDistance={viewDistance}
          activeWorld={activeWorld}
          onSaveActiveWorld={handleSaveActiveWorld}
          onQuitToMenu={handleQuitToMenu}
        />
      )}

      {/* Retro styled HUD panel overlay */}
      <HUD
        health={health}
        hunger={hunger}
        activeSlot={activeSlot}
        hotbar={inventory.slice(27, 36)}
        score={score}
        dayTime={dayTime}
        gameState={gameState}
        viewDistance={viewDistance}
        setViewDistance={setViewDistance}
      />

      {/* Crafting Inventory screens */}
      {isInventoryOpen && (
        <InventoryScreen
          isOpen={isInventoryOpen}
          onClose={() => setIsInventoryOpen(false)}
          inventory={inventory}
          setInventory={setInventory}
          isNearCraftingTable={isNearCraftingTable}
        />
      )}

      {/* Menus and Death screen triggers */}
      {(gameState === 'menu' || gameState === 'gameover') && (
        <MainMenu
          gameState={gameState}
          score={score}
          onStartGame={handleStartGame}
          onRespawn={handleRespawn}
          worlds={worlds}
          activeWorld={activeWorld}
          onSelectWorld={handleSelectWorld}
          onCreateWorld={handleCreateWorld}
          onDeleteWorld={handleDeleteWorld}
        />
      )}
    </div>
  );
}
