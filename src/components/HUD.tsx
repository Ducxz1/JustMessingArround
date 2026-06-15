/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Heart, Drumstick, Shield, HelpCircle, Moon, Sun } from 'lucide-react';
import { InventoryItem, ITEMS } from '../types';

interface HUDProps {
  health: number; // 0 - 20
  hunger: number; // 0 - 20
  activeSlot: number; // 0 - 8
  hotbar: (InventoryItem | null)[];
  score: number;
  dayTime: number; // 0 - 24000 (standard minecraft time)
  gameState: 'playing' | 'gameover' | 'menu';
  viewDistance: number;
  setViewDistance: (dist: number) => void;
}

export default function HUD({
  health,
  hunger,
  activeSlot,
  hotbar,
  score,
  dayTime,
  gameState,
  viewDistance,
  setViewDistance,
}: HUDProps) {
  if (gameState !== 'playing') return null;

  // Render Hearts (10 hearts = 20 HP)
  const renderHearts = () => {
    const hearts = [];
    for (let i = 0; i < 10; i++) {
      const heartValue = (i + 1) * 2;
      let fillType: 'full' | 'half' | 'empty' = 'empty';

      if (health >= heartValue) {
        fillType = 'full';
      } else if (health === heartValue - 1) {
        fillType = 'half';
      }

      hearts.push(
        <div key={`heart-${i}`} className="relative w-5 h-5 flex-shrink-0 animate-pulse duration-1000">
          {fillType === 'full' && (
            <Heart className="w-5 h-5 text-red-600 fill-red-600 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
          )}
          {fillType === 'half' && (
            <div className="relative w-5 h-5 overflow-hidden">
              <Heart className="absolute left-0 w-5 h-5 text-red-600 fill-red-600 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }} />
              <Heart className="absolute left-0 w-5 h-5 text-gray-700/50 fill-none opacity-40" />
            </div>
          )}
          {fillType === 'empty' && (
            <Heart className="w-5 h-5 text-gray-800 fill-gray-900/60 opacity-60 stroke-[1.5px]" />
          )}
        </div>
      );
    }
    return hearts;
  };

  // Render Hunger (10 drumsticks = 20 Hunger)
  const renderHunger = () => {
    const hungerIconList = [];
    for (let i = 0; i < 10; i++) {
      const hungerValue = (i + 1) * 2;
      let fillType: 'full' | 'half' | 'empty' = 'empty';

      if (hunger >= hungerValue) {
        fillType = 'full';
      } else if (hunger === hungerValue - 1) {
        fillType = 'half';
      }

      hungerIconList.push(
        <div key={`hunger-${i}`} className="relative w-5 h-5 flex-shrink-0">
          {fillType === 'full' && (
            <Drumstick className="w-5 h-5 text-[#df8e47] fill-[#cf762b] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
          )}
          {fillType === 'half' && (
            <div className="relative w-5 h-5 overflow-hidden">
              <Drumstick className="absolute left-0 w-5 h-5 text-[#df8e47] fill-[#cf762b] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }} />
              <Drumstick className="absolute left-0 w-5 h-5 text-gray-700/50 fill-none opacity-40" />
            </div>
          )}
          {fillType === 'empty' && (
            <Drumstick className="w-5 h-5 text-gray-800 fill-gray-900/60 opacity-60 stroke-[1.5px]" />
          )}
        </div>
      );
    }
    return hungerIconList;
  };

  // Convert game ticks to friendly time
  // daytime from 0 to 24000. Noon is 6000, Night starts around 13000, Sunrise is 0/24000
  const isNight = dayTime > 13000 && dayTime < 23000;
  const hour = Math.floor(((dayTime + 6000) % 24000) / 1000);
  const minute = Math.floor((((dayTime + 6000) % 24000) % 1000) / 16.6);
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  const currentItem = hotbar[activeSlot];
  const itemDef = currentItem ? ITEMS[currentItem.itemId] : null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between p-4">
      
      {/* Target Crosshair from Design XML styled with absolute screen centering */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-6 h-6 border-2 border-white/40 relative">
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/60 -translate-y-1/2"></div>
          <div className="absolute left-1/2 top-0 h-full w-[2px] bg-white/60 -translate-x-1/2"></div>
        </div>
      </div>

      {/* Top Banner: Status, Clock, and Survival Info */}
      <div className="w-full flex justify-between items-start">
        <div className="bg-black/40 p-3 rounded border border-white/20 text-white font-mono text-xs flex flex-col gap-1.5 max-w-sm pointer-events-auto">
          <div className="text-[10px] text-gray-300 leading-relaxed">
            • <span className="text-yellow-300 font-bold">Left Click</span> to mine/attack<br />
            • <span className="text-yellow-300 font-bold">Right Click</span> to place/use<br />
            • Press <span className="text-yellow-400 font-bold">E</span> for Inventory & Table<br />
            • FPS: 60 • Biome: Plains
          </div>
          
          <div className="border-t border-white/10 pt-1.5 mt-0.5 flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px] font-bold text-yellow-300">
              <span>VIEW DISTANCE:</span>
              <span className="bg-yellow-400 text-zinc-950 px-1 py-0.5 rounded text-[9px]">{viewDistance} Chunks</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="3" 
              value={viewDistance} 
              onChange={(e) => setViewDistance(Number(e.target.value))}
              className="w-full accent-yellow-400 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[8px] text-gray-400 leading-none">
              (Press <span className="text-white font-semibold">ESC</span> to release mouse and slide)
            </span>
          </div>
        </div>

        {/* Time, Health and Monsters Alert */}
        <div className="flex flex-col items-end gap-2 font-mono">
          <div className="bg-black/40 border border-white/20 p-3 rounded text-white text-right text-xs">
            <div className="opacity-70 text-[10px]">TIME: {timeStr}</div>
            <div className="font-bold text-yellow-300 mt-0.5">DAY {Math.floor(score + 1)}</div>
            <div className="font-semibold text-red-400 text-[9px] uppercase tracking-wider mt-1 bg-red-950/40 px-1.5 py-0.5 border border-red-800/30">Difficulty: Hard</div>
          </div>

          {isNight && (
            <div className="bg-red-900/60 text-red-250 px-3 py-1.5 uppercase font-bold tracking-wider border border-red-500/50 rounded text-[10px] animate-pulse">
              🧟 DANGER: Zombies are Hunting!
            </div>
          )}
        </div>
      </div>

      {/* Bottom HUD: Hearts, Hunger, Selected Item Title, Hotbar */}
      <div className="w-full flex flex-col items-center gap-1.5 mb-2">
        {/* Active Item Title pop-up */}
        {itemDef && (
          <div className="bg-black/80 px-2.5 py-1 text-white text-xs font-mono border border-white/10 tracking-wide translate-y-[-2px]">
            {itemDef.name} {itemDef.isTool ? <span className="text-blue-400">(Tool)</span> : `(x${currentItem?.count})`}
          </div>
        )}

        {/* Stats Indicators: Health & Hunger (Exactly 364px wide from Design HTML) */}
        <div className="w-[364px] flex justify-between items-center px-1">
          {/* Health (10 Hearts) */}
          <div className="flex gap-[2px] items-center">
            {renderHearts()}
          </div>

          {/* Hunger (10 Drumsticks) */}
          <div className="flex gap-[2px] items-center">
            {renderHunger()}
          </div>
        </div>

        {/* EXP Advancement Bar (Exactly 364px wide from Design HTML) */}
        <div className="w-[364px] h-2 bg-gray-900 border border-black overflow-hidden relative">
          <div 
            className="h-full bg-lime-500 shadow-[inset_0_0_4px_rgba(0,0,0,0.5)] transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(8, ((score * 47) % 100) || 45))}%` }}
          ></div>
        </div>
        <div className="text-[10px] text-lime-400 font-bold font-mono -mt-1 mb-1">
          Lvl {Math.floor(score * 3) + 1}
        </div>

        {/* HOTBAR CONTAINER: Styled exactly like Natural Tones palette details */}
        <div className="pointer-events-auto flex gap-0 border-4 border-[#1e1e1e] bg-[#8b8b8b] p-0 shadow-lg">
          {hotbar.map((item, index) => {
            const isActive = index === activeSlot;
            const def = item ? ITEMS[item.itemId] : null;

            return (
              <div
                key={`hotbar-slot-${index}`}
                className={`relative w-12 h-12 flex items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? 'border-2 border-white bg-[#373737]'
                    : 'border-2 border-[#1e1e1e] hover:bg-[#373737]/40'
                }`}
              >
                {/* Item / Block Visuals inside slot */}
                {def && (
                  <div className="relative w-8 h-8 flex items-center justify-center">
                    {def.isBlock ? (
                      /* Render 3D isometric styled cube with classic shading */
                      <div className="relative w-5 h-5 transform rotate-x-[30deg] rotate-y-[45deg] select-none">
                        {/* Top Face */}
                        <div
                          className="absolute inset-0 origin-top transform -rotate-x-[90deg] h-2 translate-y-[-4px]"
                          style={{ backgroundColor: def.id === 'grass' ? '#5c9e31' : def.iconColor }}
                        ></div>
                        {/* Front Face */}
                        <div
                          className="absolute inset-0 saturate-75"
                          style={{ backgroundColor: def.iconColor, filter: 'brightness(0.85)' }}
                        ></div>
                        {/* Left Face */}
                        <div
                          className="absolute inset-0 transform origin-left rotate-y-[90deg] w-2"
                          style={{ backgroundColor: def.iconColor, filter: 'brightness(0.6)' }}
                        ></div>
                      </div>
                    ) : (
                      /* Retro solid color representation */
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shadow shadow-black"
                        style={{ backgroundColor: def.iconColor }}
                      >
                        {def.name[0]}
                      </div>
                    )}

                    {/* Stack Count */}
                    {item.count > 1 && (
                      <span className="absolute bottom-[-5px] right-[-5px] text-white font-mono text-[9px] bg-[#1e1e1e] px-1 rounded-sm border border-white/20 font-bold scale-90">
                        {item.count}
                      </span>
                    )}
                  </div>
                )}

                {/* Hotbar Slot Number indicator (small) */}
                <span className="absolute top-0.5 left-0.5 text-[8px] text-[#1e1e1e] opacity-60 font-mono font-bold scale-75">
                  {index + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
