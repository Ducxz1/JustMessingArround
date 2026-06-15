/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Hammer, ArrowRight, BookOpen, User } from 'lucide-react';
import { InventoryItem, ITEMS, CRAFTING_RECIPES, Recipe } from '../types';

interface InventoryScreenProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: (InventoryItem | null)[]; // size 36 (0-26 inventory, 27-35 hotbar)
  setInventory: (inv: (InventoryItem | null)[]) => void;
  isNearCraftingTable: boolean;
}

export default function InventoryScreen({
  isOpen,
  onClose,
  inventory,
  setInventory,
  isNearCraftingTable,
}: InventoryScreenProps) {
  if (!isOpen) return null;

  // Local Crafting Grid state
  // 2x2 grid if isNearCraftingTable is false, 3x3 if true
  const gridSize = isNearCraftingTable ? 9 : 4;
  const gridWidth = isNearCraftingTable ? 3 : 2;

  const [craftingGrid, setCraftingGrid] = useState<(InventoryItem | null)[]>(
    Array(gridSize).fill(null)
  );

  const [heldItem, setHeldItem] = useState<InventoryItem | null>(null);
  const [craftedOutput, setCraftedOutput] = useState<InventoryItem | null>(null);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);

  // Return any items in crafting grid to inventory on close
  useEffect(() => {
    return () => {
      // This runs on unmount or when onClose triggers and clears the component
      // We will return items in the final integration in App.tsx
    };
  }, []);

  // When crafting grid coordinates change, evaluate recipes
  useEffect(() => {
    checkMatchingRecipe();
  }, [craftingGrid, isNearCraftingTable]);

  // Handle returning items to inventory when closing
  const handleClose = () => {
    // Return all items from crafting grid to inventory
    const newInv = [...inventory];
    
    // Return grid items
    for (let i = 0; i < craftingGrid.length; i++) {
      const item = craftingGrid[i];
      if (item) {
        addItemToInventoryList(newInv, item.itemId, item.count);
      }
    }
    
    // Return held item
    if (heldItem) {
      addItemToInventoryList(newInv, heldItem.itemId, heldItem.count);
      setHeldItem(null);
    }

    setCraftingGrid(Array(gridSize).fill(null));
    setInventory(newInv);
    onClose();
  };

  const addItemToInventoryList = (inv: (InventoryItem | null)[], itemId: string, count: number) => {
    const def = ITEMS[itemId];
    let remaining = count;

    // First try stacking
    for (let i = 0; i < inv.length; i++) {
      if (inv[i] && inv[i]!.itemId === itemId) {
        const canAdd = def.maxStack - inv[i]!.count;
        if (canAdd > 0) {
          const adding = Math.min(canAdd, remaining);
          inv[i]!.count += adding;
          remaining -= adding;
          if (remaining <= 0) break;
        }
      }
    }

    // Then find empty slots
    if (remaining > 0) {
      for (let i = 0; i < inv.length; i++) {
        if (!inv[i]) {
          inv[i] = { itemId, count: remaining };
          remaining = 0;
          break;
        }
      }
    }

    // If still remaining, we just drop it (lossy, but standard bounds)
    return remaining === 0;
  };

  // Recipe matcher
  const checkMatchingRecipe = () => {
    let match: Recipe | null = null;

    for (const recipe of CRAFTING_RECIPES) {
      if (recipe.requiresTable && !isNearCraftingTable) continue;

      // Check dimensions
      if (isNearCraftingTable) {
        // 3x3 matcher
        let isMatch = true;
        for (let r = 0; r < 9; r++) {
          const recipeItem = recipe.grid[r] || null;
          const gridItem = craftingGrid[r]?.itemId || null;
          if (recipeItem !== gridItem) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) {
          match = recipe;
          break;
        }
      } else {
        // 2x2 matcher
        let isMatch = true;
        for (let r = 0; r < 4; r++) {
          const recipeItem = recipe.grid[r] || null;
          const gridItem = craftingGrid[r]?.itemId || null;
          if (recipeItem !== gridItem) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) {
          match = recipe;
          break;
        }
      }
    }

    if (match) {
      setActiveRecipe(match);
      setCraftedOutput({ itemId: match.output.itemId, count: match.output.count });
    } else {
      setActiveRecipe(null);
      setCraftedOutput(null);
    }
  };

  // Click handler on slots
  const handleSlotClick = (type: 'inventory' | 'hotbar' | 'crafting', index: number) => {
    // Translate type/index to inventory access
    let invIndex = index;
    if (type === 'hotbar') {
      invIndex = 27 + index; // hotbar is 27-35
    }

    const currentInventory = [...inventory];
    const targetItem = type === 'crafting' ? craftingGrid[index] : currentInventory[invIndex];

    // Case 1: Players possess a HELD item
    if (heldItem) {
      if (!targetItem) {
        // Place held item in empty slot
        if (type === 'crafting') {
          const newGrid = [...craftingGrid];
          newGrid[index] = { ...heldItem };
          setCraftingGrid(newGrid);
        } else {
          currentInventory[invIndex] = { ...heldItem };
          setInventory(currentInventory);
        }
        setHeldItem(null);
      } else if (targetItem.itemId === heldItem.itemId) {
        // Try to stack them
        const def = ITEMS[heldItem.itemId];
        const canAdd = def.maxStack - targetItem.count;
        if (canAdd > 0) {
          const adding = Math.min(canAdd, heldItem.count);
          const newCount = targetItem.count + adding;
          const remCount = heldItem.count - adding;

          if (type === 'crafting') {
            const newGrid = [...craftingGrid];
            newGrid[index] = { itemId: heldItem.itemId, count: newCount };
            setCraftingGrid(newGrid);
          } else {
            currentInventory[invIndex] = { itemId: heldItem.itemId, count: newCount };
            setInventory(currentInventory);
          }

          if (remCount > 0) {
            setHeldItem({ itemId: heldItem.itemId, count: remCount });
          } else {
            setHeldItem(null);
          }
        }
      } else {
        // Swap different items
        if (type === 'crafting') {
          const newGrid = [...craftingGrid];
          newGrid[index] = { ...heldItem };
          setCraftingGrid(newGrid);
        } else {
          currentInventory[invIndex] = { ...heldItem };
          setInventory(currentInventory);
        }
        setHeldItem({ ...targetItem });
      }
    }
    // Case 2: No held item, pick up target item
    else {
      if (targetItem) {
        setHeldItem({ ...targetItem });
        if (type === 'crafting') {
          const newGrid = [...craftingGrid];
          newGrid[index] = null;
          setCraftingGrid(newGrid);
        } else {
          currentInventory[invIndex] = null;
          setInventory(currentInventory);
        }
      }
    }
  };

  // Taking the output of a crafting recipe
  const handleCraftOutputClick = () => {
    if (!craftedOutput || !activeRecipe) return;

    // Decide what to do with output
    if (heldItem) {
      // If we are already holding an item, we can only retrieve it if it is the SAME item and can stack
      if (heldItem.itemId === craftedOutput.itemId) {
        const def = ITEMS[heldItem.itemId];
        const canAdd = def.maxStack - heldItem.count;
        if (canAdd >= craftedOutput.count) {
          setHeldItem({ itemId: heldItem.itemId, count: heldItem.count + craftedOutput.count });
          consumeIngredients();
        }
      }
    } else {
      // Just take it in hand (held)
      setHeldItem({ ...craftedOutput });
      consumeIngredients();
    }
  };

  const consumeIngredients = () => {
    const newGrid = [...craftingGrid];
    for (let i = 0; i < newGrid.length; i++) {
      if (newGrid[i]) {
        newGrid[i]!.count -= 1;
        if (newGrid[i]!.count <= 0) {
          newGrid[i] = null;
        }
      }
    }
    setCraftingGrid(newGrid);
  };

  // Search query filter for Recipe Guide Book
  const [searchQuery, setSearchQuery] = useState('');

  const fillCraftingGrid = (recipe: Recipe) => {
    let nextInventory = [...inventory];
    let nextCraftingGrid = Array(gridSize).fill(null);

    // Return all existing elements in the crafting grid back to inventory first
    for (let i = 0; i < craftingGrid.length; i++) {
      const item = craftingGrid[i];
      if (item) {
        addItemToInventoryList(nextInventory, item.itemId, item.count);
      }
    }

    // Count available items in inventory
    const counts: Record<string, number> = {};
    nextInventory.forEach((item) => {
      if (item) {
        counts[item.itemId] = (counts[item.itemId] || 0) + item.count;
      }
    });

    // Count ingredients required in recipe
    const reqCounts: Record<string, number> = {};
    recipe.grid.forEach((id) => {
      if (id) {
        reqCounts[id] = (reqCounts[id] || 0) + 1;
      }
    });

    // Check if we have enough materials overall
    let canFill = true;
    for (const [id, req] of Object.entries(reqCounts)) {
      if ((counts[id] || 0) < req) {
        canFill = false;
        break;
      }
    }

    if (!canFill) return;

    // Deduct required ingredients from nextInventory
    for (const [id, req] of Object.entries(reqCounts)) {
      let needed = req;
      for (let i = 0; i < nextInventory.length; i++) {
        if (nextInventory[i] && nextInventory[i]!.itemId === id) {
          if (nextInventory[i]!.count >= needed) {
            nextInventory[i]!.count -= needed;
            needed = 0;
          } else {
            needed -= nextInventory[i]!.count;
            nextInventory[i] = null;
          }
        }
        if (needed <= 0) break;
      }
    }

    // Populate crafting workspace with the recipe shape!
    for (let i = 0; i < gridSize; i++) {
      const recipeItemId = recipe.grid[i] || null;
      if (recipeItemId) {
        nextCraftingGrid[i] = { itemId: recipeItemId, count: 1 };
      }
    }

    setCraftingGrid(nextCraftingGrid);
    setInventory(nextInventory);
  };

  // Render a nice grid cell for crafting, inventory, or hotbar
  const renderCell = (
    type: 'inventory' | 'hotbar' | 'crafting',
    index: number,
    item: InventoryItem | null
  ) => {
    const def = item ? ITEMS[item.itemId] : null;

    return (
      <div
        key={`${type}-${index}`}
        className="relative w-11 h-11 border-2 border-[#1e1e1e] bg-[#373737]/65 hover:bg-[#373737] flex items-center justify-center cursor-pointer transition-all active:scale-95 group"
        onClick={() => handleSlotClick(type, index)}
      >
        {def && (
          <div className="relative w-8 h-8 flex items-center justify-center">
            {def.isBlock ? (
              <div className="relative w-5 h-5 transform rotate-x-[30deg] rotate-y-[45deg] select-none">
                <div
                  className="absolute inset-0 origin-top transform -rotate-x-[90deg] h-2.5 translate-y-[-5px]"
                  style={{ backgroundColor: def.id === 'grass' ? '#5c9e31' : def.iconColor }}
                ></div>
                <div
                  className="absolute inset-0 saturate-75"
                  style={{ backgroundColor: def.iconColor, filter: 'brightness(0.85)' }}
                ></div>
                <div
                  className="absolute inset-0 transform origin-left rotate-y-[90deg] w-2.5"
                  style={{ backgroundColor: def.iconColor, filter: 'brightness(0.6)' }}
                ></div>
              </div>
            ) : (
              <div
                className="w-5 h-5 rounded-none flex items-center justify-center text-[9px] font-bold text-white shadow shadow-black"
                style={{ backgroundColor: def.iconColor }}
              >
                {def.name[0]}
              </div>
            )}

            {/* Stack Count */}
            {item!.count > 1 && (
              <span className="absolute bottom-[-5px] right-[-5px] bg-[#1e1e1e] border border-white/20 font-mono text-[9px] px-1 text-white font-bold select-none">
                {item!.count}
              </span>
            )}
          </div>
        )}

        {/* Hover Tooltip (simple native titles) */}
        {def && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#1e1e1e] text-white text-[10px] p-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap shadow-lg border border-white/20 font-mono">
            <span className="font-bold text-yellow-300">{def.name}</span>
            {def.description && <p className="text-[9px] text-gray-300 mt-0.5">{def.description}</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      
      {/* Wooden Chest-like Border */}
      <div className="bg-[#8b8b8b] border-4 border-[#1e1e1e] w-full max-w-4xl max-h-[85vh] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden font-mono text-zinc-900">
        
        {/* Header Bar */}
        <div className="bg-[#1e1e1e] p-4 border-b border-black flex justify-between items-center">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-yellow-400" />
            <h2 className="text-sm font-bold tracking-wider uppercase text-zinc-100">
              Workbench & Inventory
            </h2>
            {isNearCraftingTable && (
              <span className="bg-[#559944] text-[#1e1e1e] border-2 border-white px-2 py-0.5 text-[9px] font-bold animate-pulse uppercase">
                🛠️ Table Accessed
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 px-3 bg-[#373737] hover:bg-[#1e1e1e] text-white rounded-none font-bold text-xs uppercase cursor-pointer border-2 border-white active:scale-95 flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Close (E)
          </button>
        </div>

        {/* Main Side-by-Side Sections */}
        <div className="flex flex-1 overflow-auto min-h-0 divide-x divide-[#1e1e1e]">
          
          {/* LEFT COLUMN: Recipes Guide Book */}
          <div className="w-1/3 p-4 flex flex-col gap-3 overflow-auto min-w-[250px] bg-[#7a7a7a]/20">
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-bold uppercase text-zinc-900 tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-zinc-900" /> Recipe Guide Book
              </h3>
              <p className="text-[9px] text-zinc-800 leading-tight">
                Click any recipe to automatically extract details and arrange items on the Workbench.
              </p>
            </div>

            {/* Search Input Filter */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search item recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border-2 border-zinc-700 text-white px-2.5 py-1.5 text-xs rounded shadow-inner font-mono focus:border-yellow-600 outline-none placeholder-zinc-500"
              />
            </div>
            
            <div className="flex flex-col gap-2.5 mt-1">
              {CRAFTING_RECIPES.filter((recipe) => {
                const outputDef = ITEMS[recipe.output.itemId];
                return !searchQuery || outputDef?.name.toLowerCase().includes(searchQuery.toLowerCase());
              }).map((recipe, index) => {
                const isTableOnly = recipe.requiresTable;
                const canShow = isNearCraftingTable || !isTableOnly;
                const outputDef = ITEMS[recipe.output.itemId];

                if (!outputDef) return null;

                // Check ingredients
                const requiredCounts: Record<string, number> = {};
                recipe.grid.forEach((id) => {
                  if (id) requiredCounts[id] = (requiredCounts[id] || 0) + 1;
                });

                // Check player inventory counts
                const availableCounts: Record<string, number> = {};
                inventory.forEach((item) => {
                  if (item) {
                    availableCounts[item.itemId] = (availableCounts[item.itemId] || 0) + item.count;
                  }
                });

                let hasIngredients = true;
                const ingredCheckList = Object.entries(requiredCounts).map(([id, req]) => {
                  const got = availableCounts[id] || 0;
                  if (got < req) hasIngredients = false;
                  return {
                    name: ITEMS[id]?.name || id,
                    req,
                    got,
                  };
                });

                if (!canShow) return null;

                return (
                  <div
                    key={`recipe-guide-${index}`}
                    className={`p-2.5 rounded border-2 flex flex-col gap-1.5 transition-all text-[11px] ${
                      hasIngredients
                        ? 'border-yellow-600/60 bg-zinc-900 hover:bg-zinc-900 border-b-4 hover:border-yellow-500 cursor-pointer text-zinc-100 shadow'
                        : 'border-zinc-700/40 bg-zinc-950/20 opacity-65 text-zinc-500'
                    }`}
                    onClick={() => hasIngredients && fillCraftingGrid(recipe)}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className={hasIngredients ? "text-yellow-400" : "text-zinc-500"}>
                        {outputDef.name} (x{recipe.output.count})
                      </span>
                      {hasIngredients ? (
                        <span className="text-emerald-400 text-[9px] uppercase font-bold bg-emerald-950/80 px-1 border border-emerald-500/30">
                          Ready
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-[9px]">
                          Missing items
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-zinc-400 flex flex-col gap-0.5">
                      {ingredCheckList.map((ing, i) => (
                        <span
                          key={`ing-${i}`}
                          className={ing.got >= ing.req ? 'text-green-400 font-medium' : 'text-stone-500'}
                        >
                          • {ing.req}x {ing.name} ({ing.got}/{ing.req})
                        </span>
                      ))}
                    </div>

                    {hasIngredients && (
                      <div className="text-[8px] text-yellow-500/80 mt-0.5 italic text-right font-bold uppercase tracking-wider">
                        Click to place in grid ➔
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: Survival Grid & Custom Crafting Panel */}
          <div className="flex-1 p-6 flex flex-col justify-between overflow-auto gap-6 min-w-[400px]">
            
            {/* Crafting Desk area */}
            <div className="bg-zinc-900/40 border border-zinc-700/50 p-4 rounded-xl flex items-center justify-center gap-8 shadow-inner">
              
              <div className="flex flex-col gap-2 items-center">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hammer className="w-3.5 h-3.5 text-zinc-400" /> Workbench
                </span>
                
                {/* Visual Crafting Grid */}
                <div
                  className="grid bg-zinc-950/50 p-3 rounded-lg border-2 border-zinc-700 max-w-fit gap-1.5 shadow-lg"
                  style={{
                    gridTemplateColumns: `repeat(${gridWidth}, minmax(0, 1fr))`,
                  }}
                >
                  {craftingGrid.map((item, idx) => renderCell('crafting', idx, item))}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center gap-1 text-zinc-500">
                <ArrowRight className="w-8 h-8 text-yellow-600 animate-pulse" />
                <span className="text-[9px] uppercase tracking-wider">Combines</span>
              </div>

              {/* Crafting recipe output */}
              <div className="flex flex-col gap-2 items-center">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Result</span>
                
                {/* Result Block Box */}
                <div
                  className={`w-14 h-14 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-all ${
                    craftedOutput
                      ? 'border-yellow-500 bg-yellow-500/20 shadow-lg scale-105 active:scale-95'
                      : 'border-zinc-700 bg-zinc-950/40 opacity-40 cursor-default'
                  }`}
                  onClick={handleCraftOutputClick}
                >
                  {craftedOutput ? (
                    <div className="relative w-10 h-10 flex items-center justify-center">
                      {/* Voxel isometric style cube */}
                      {ITEMS[craftedOutput.itemId].isBlock ? (
                        <div className="relative w-6 h-6 transform rotate-x-[30deg] rotate-y-[45deg] select-none">
                          <div
                            className="absolute inset-0 origin-top transform -rotate-x-[90deg] h-3 translate-y-[-6px]"
                            style={{
                              backgroundColor:
                                craftedOutput.itemId === 'grass'
                                  ? '#5c9e31'
                                  : ITEMS[craftedOutput.itemId].iconColor,
                            }}
                          ></div>
                          <div
                            className="absolute inset-0 bg-stone-500/80 saturate-75"
                            style={{
                              backgroundColor: ITEMS[craftedOutput.itemId].iconColor,
                              filter: 'brightness(0.85)',
                            }}
                          ></div>
                          <div
                            className="absolute inset-0 bg-stone-700/80 transform origin-left rotate-y-[90deg] w-3"
                            style={{
                              backgroundColor: ITEMS[craftedOutput.itemId].iconColor,
                              filter: 'brightness(0.6)',
                            }}
                          ></div>
                        </div>
                      ) : (
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white shadow shadow-black"
                          style={{ backgroundColor: ITEMS[craftedOutput.itemId].iconColor }}
                        >
                          {ITEMS[craftedOutput.itemId].name[0]}
                        </div>
                      )}

                      <span className="absolute bottom-[-6px] right-[-6px] bg-yellow-600 border border-yellow-400 text-white font-mono text-[9px] px-1 rounded-sm font-bold shadow">
                        {craftedOutput.count}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-500/80 text-center uppercase tracking-wider font-semibold scale-90">
                      Empty
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Core Storage Bags (3 Rows of 9) */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider">
                Chest Storage (27 Slots)
              </span>
              <div className="grid grid-cols-9 gap-1.5 p-3 border-4 border-[#1e1e1e] bg-zinc-950/20">
                {Array(27)
                  .fill(null)
                  .map((_, idx) => renderCell('inventory', idx, inventory[idx]))}
              </div>
            </div>

            {/* Quick Access Hotbar (1 Row of 9) */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-[#373737] uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#559944]"></span> Active Hotbar (9 Slots)
              </span>
              <div className="grid grid-cols-9 gap-1.5 p-3 border-4 border-[#1e1e1e] bg-stone-500/10">
                {Array(9)
                  .fill(null)
                  .map((_, idx) => renderCell('hotbar', idx, inventory[27 + idx]))}
              </div>
            </div>
          </div>
        </div>

        {/* HELD FLOATING CURSOR COMPONENT INDICATOR */}
        {heldItem && (
          <div className="absolute top-2 right-4 bg-[#8b8b8b] border-4 border-[#1e1e1e] p-3 flex items-center gap-2 text-xs font-semibold shadow-2xl animate-bounce pointer-events-none z-50 text-zinc-900">
            <span className="text-zinc-800 uppercase font-mono text-[9px] font-bold">Holding:</span>
            <span className="text-white bg-[#1e1e1e] px-2.5 py-0.5">{ITEMS[heldItem.itemId]?.name}</span>
            <span className="bg-[#559944] text-white px-1.5 rounded-none font-bold">x{heldItem.count}</span>
          </div>
        )}
      </div>
    </div>
  );
}
