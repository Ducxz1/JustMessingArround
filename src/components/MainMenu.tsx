/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Skull, Play, RefreshCw, Trophy, ShieldAlert, Plus, Trash2, Globe, Sparkles, Calendar } from 'lucide-react';
import { SavedWorld } from '../types';

interface MainMenuProps {
  gameState: 'menu' | 'gameover' | 'playing';
  score: number;
  onStartGame: (world: SavedWorld) => void;
  onRespawn: () => void;
  worlds: SavedWorld[];
  activeWorld: SavedWorld | null;
  onSelectWorld: (world: SavedWorld | null) => void;
  onCreateWorld: (name: string, seedStr: string) => void;
  onDeleteWorld: (id: string) => void;
}

export default function MainMenu({
  gameState,
  score,
  onStartGame,
  onRespawn,
  worlds,
  activeWorld,
  onSelectWorld,
  onCreateWorld,
  onDeleteWorld,
}: MainMenuProps) {
  const [newWorldName, setNewWorldName] = useState('New Survival World');
  const [newWorldSeed, setNewWorldSeed] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  if (gameState === 'playing') return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorldName.trim()) return;
    onCreateWorld(newWorldName.trim(), newWorldSeed.trim());
    setNewWorldName('New Survival World');
    setNewWorldSeed('');
    setShowCreateForm(false);
  };

  return (
    <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-4 z-40 select-none font-mono overflow-y-auto">
      
      {/* 1. MAIN MENU SCREEN Overlay */}
      {gameState === 'menu' && (
        <div className="bg-[#8b8b8b] border-8 border-[#1e1e1e] p-6 w-full max-w-4xl text-center shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col gap-6 text-[#1e1e1e]">
          
          {/* Logo Title */}
          <div className="flex flex-col items-center gap-1 border-b border-[#1e1e1e]/20 pb-4">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-widest text-yellow-300 drop-shadow-[0_4px_0_#1e1e1e] uppercase">
              MINECRAFT SURVIVAL
            </h1>
            <span className="text-[10px] text-white tracking-widest uppercase font-bold bg-[#1e1e1e] px-4 py-1.5 border border-white/20 mt-1">
              ⚡ INFINITE PROCEDURAL CHUNKS EDITION ⚡
            </span>
          </div>

          {/* Two-Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            
            {/* Left Column: Guides and Instructions */}
            <div className="flex flex-col gap-4">
              <div className="text-zinc-900 text-xs leading-relaxed space-y-2">
                <p className="font-bold border-b border-[#1e1e1e]/10 pb-1">ABOUT THE SIMULATOR:</p>
                <p>
                  Explore infinite terrain that generates seamlessly around you. Every biome, tree, and pocket of iron ore is mathematically generated based on the seed.
                </p>
                <p>
                  Create multiple worlds, mine blocks to alter the terrain, and your houses/creations will save automatically!
                </p>
              </div>

              {/* Quick instructions details */}
              <div className="text-white text-xs flex flex-col gap-3 bg-[#1e1e1e] p-4 border-4 border-[#373737]">
                <h3 className="text-yellow-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 border-b border-zinc-700 pb-1">
                  <ShieldAlert className="w-4 h-4 text-yellow-400" /> Survival Guide:
                </h3>
                <ul className="flex flex-col gap-1.5 list-disc pl-4 text-zinc-300 text-[11px]">
                  <li>
                    <strong className="text-white">Hearts & Hunger:</strong> Sprinting drains hunger. Eat <span className="text-red-400 font-semibold">Apples</span> (from leaves) or Pig <span className="text-pink-300 font-semibold">Porkchops</span>.
                  </li>
                  <li>
                    <strong className="text-white">Progression:</strong> Wood logs ➔ planks ➔ craft table ➔ sticks ➔ wood pickaxe (mine cobblestone) ➔ stone pickaxe (mine iron)!
                  </li>
                  <li>
                    <strong className="text-white">Mobs:</strong> Hostile zombies spawn at sunset. Craft a <span className="text-sky-300 font-semibold">Sword</span> and build a shelter!
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column: World Selection and Management */}
            <div className="bg-[#c6c6c6] border-4 border-[#555] p-4 flex flex-col gap-3 max-h-[340px] md:max-h-[380px] overflow-y-auto">
              
              <div className="flex justify-between items-center border-b-2 border-zinc-700/30 pb-2">
                <h2 className="text-xs font-bold uppercase text-zinc-800 tracking-wider flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-zinc-700" /> Select Worlds
                </h2>
                {!showCreateForm && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white text-[10px] font-bold py-1 px-2 border-b-2 border-yellow-800 active:translate-y-0.5 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Create New
                  </button>
                )}
              </div>

              {/* Create World Form Expansion */}
              {showCreateForm ? (
                <form onSubmit={handleCreate} className="bg-black/5 p-3 border-2 border-[#888] flex flex-col gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-zinc-700 mb-1">World Name:</label>
                    <input
                      type="text"
                      value={newWorldName}
                      onChange={(e) => setNewWorldName(e.target.value)}
                      maxLength={24}
                      className="w-full bg-[#373737] text-white text-xs p-2 border-2 border-[#1e1e1e] rounded-sm focus:outline-none focus:border-yellow-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-zinc-700 mb-0.5">Seed (Optional):</label>
                    <span className="block text-[9px] text-zinc-600 mb-1 leading-none">leave blank for random seed</span>
                    <input
                      type="text"
                      placeholder="e.g. 198273"
                      value={newWorldSeed}
                      onChange={(e) => setNewWorldSeed(e.target.value)}
                      className="w-full bg-[#373737] text-white text-xs p-2 border-2 border-[#1e1e1e] rounded-sm focus:outline-none focus:border-yellow-500 font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-green-700 hover:bg-green-800 text-white text-xs font-bold py-2 px-3 border-b-4 border-green-900 cursor-pointer uppercase active:translate-y-0.5"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="bg-neutral-600 hover:bg-neutral-700 text-white text-xs font-bold py-2 px-3 border-b-4 border-neutral-800 cursor-pointer uppercase"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[290px] pr-1">
                  {worlds.length === 0 ? (
                    <div className="text-center py-8 text-[#555] text-xs">
                      <p className="font-bold">No Worlds Found.</p>
                      <p className="text-[10px] mt-1">Click "Create New" above to start your first survival adventure!</p>
                    </div>
                  ) : (
                    worlds.map((world) => {
                      const isSelected = activeWorld?.id === world.id;
                      const dateString = new Date(world.lastPlayed).toLocaleDateString();

                      return (
                        <div
                          key={world.id}
                          onClick={() => onSelectWorld(world)}
                          className={`p-2.5 border-2 transition-all cursor-pointer flex justify-between items-center gap-2 ${
                            isSelected
                              ? 'bg-yellow-100 border-yellow-600 shadow-md'
                              : 'bg-white/40 border-zinc-450 hover:bg-white/60'
                          }`}
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-bold text-zinc-900 truncate">
                              {world.name}
                            </span>
                            <div className="text-[9px] text-zinc-600 flex items-center gap-3">
                              <span className="flex items-center gap-0.5">
                                <Calendar className="w-2.5 h-2.5" /> {dateString}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5" /> Seed: {world.seedOffsetX ? Math.floor(world.seedOffsetX) : 'Custom'}
                              </span>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete "${world.name}"?`)) {
                                onDeleteWorld(world.id);
                              }
                            }}
                            className="text-red-700 hover:text-red-950 hover:bg-red-200/50 p-1.5 rounded transition-all cursor-pointer"
                            title="Delete World"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Start Actions bar */}
          <div className="border-t border-[#1e1e1e]/20 pt-4 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="text-zinc-800 text-[11px] text-left">
              Selected: <span className="text-zinc-950 font-bold underline">{activeWorld ? activeWorld.name : 'None (Please select a world)'}</span>
            </div>
            
            <button
              onClick={() => activeWorld && onStartGame(activeWorld)}
              disabled={!activeWorld}
              className={`w-full sm:w-auto font-bold uppercase py-3 px-12 border-b-4 border-l-2 border-r-2 border-black active:border-b-2 shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer ${
                activeWorld
                  ? 'bg-[#559944] hover:bg-[#5c9e31] hover:scale-[1.02] text-white active:scale-95'
                  : 'bg-zinc-400 border-zinc-600 cursor-not-allowed opacity-60 text-zinc-700'
              }`}
            >
              <Play className="w-4 h-4 text-white fill-white" /> Play Selected World
            </button>
          </div>
        </div>
      )}

      {/* 2. GAME OVER DEATH SCREEN Overlay */}
      {gameState === 'gameover' && (
        <div className="bg-[#4e1e1e] border-8 border-[#1e1e1e] p-8 max-w-sm text-center shadow-[0_20px_50px_rgba(239,68,68,0.3)] flex flex-col items-center gap-6 text-white">
          <div className="w-16 h-16 rounded-none bg-[#1e1e1e] border-4 border-red-500 flex items-center justify-center shadow-lg animate-bounce">
            <Skull className="w-9 h-9 text-red-400" />
          </div>

          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold tracking-wider text-red-500 uppercase drop-shadow-[0_3px_0_#000000]">
              You Died!
            </h1>
            <p className="text-xs text-red-300/80 italic">
              "Left click to strike zombies, mine blocks, and stay alive next turn."
            </p>
          </div>

          {/* Stats Box */}
          <div className="bg-black/40 border-4 border-[#1e1e1e] p-4 w-full flex flex-col gap-1 text-center font-mono text-xs">
            <div className="text-zinc-300 flex justify-between items-center px-2">
              <span>Day Time Status:</span>
              <span className="text-red-400 font-bold">Hardcore Survival</span>
            </div>
            <div className="text-zinc-200 flex justify-between items-center px-2 font-bold mt-1.5 pt-1.5 border-t border-[#1e1e1e]">
              <span className="flex items-center gap-1.5 text-yellow-400"><Trophy className="w-3.5 h-3.5" /> score:</span>
              <span className="text-yellow-400 text-sm">{Math.floor(score * 10)} Survival Pts</span>
            </div>
          </div>

          <button
            onClick={onRespawn}
            className="w-full bg-[#559944] hover:bg-[#5c9e31] active:translate-y-1 text-white font-bold uppercase py-2.5 px-6 border-b-4 border-l-2 border-r-2 border-black shadow-xl flex items-center justify-center gap-2 text-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-white" /> Respawn & Recover
          </button>

          <span className="text-[9px] text-red-300/60 leading-normal">
            Your inventory will be reset. Spawns you back safely onto a green hill in the world.
          </span>
        </div>
      )}
    </div>
  );
}
