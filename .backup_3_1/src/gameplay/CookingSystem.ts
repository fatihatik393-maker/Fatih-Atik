import { GAME_CONFIG, IngredientType, RecipeId, RECIPES } from '../core/GameConfig';

export type GrillSlotState = 'empty' | 'cooking' | 'cooked' | 'burnt';

export interface GrillSlot {
  id: number;
  state: GrillSlotState;
  elapsed: number;
  progress: number; // 0..1 during cooking, 0..1 towards burnt after cooked
}

export class CookingSystem {
  slots: GrillSlot[];
  isUpgraded: boolean;

  constructor(slotCount = 4, isUpgraded = false) {
    this.isUpgraded = isUpgraded;
    this.slots = Array.from({ length: slotCount }, (_, i) => ({
      id: i,
      state: 'empty',
      elapsed: 0,
      progress: 0,
    }));
  }

  getThresholds() {
    return this.isUpgraded ? GAME_CONFIG.cooking.upgraded : GAME_CONFIG.cooking.standard;
  }

  placeRawPatty(slotIndex?: number): number {
    const targetIdx =
      slotIndex !== undefined
        ? slotIndex
        : this.slots.findIndex((s) => s.state === 'empty');
    if (targetIdx === -1 || !this.slots[targetIdx] || this.slots[targetIdx].state !== 'empty') {
      return -1;
    }
    this.slots[targetIdx].state = 'cooking';
    this.slots[targetIdx].elapsed = 0;
    this.slots[targetIdx].progress = 0;
    return targetIdx;
  }

  takePatty(slotIndex: number): { item: 'patty_raw' | 'patty_cooked' | 'patty_burnt' } | null {
    const slot = this.slots[slotIndex];
    if (!slot || slot.state === 'empty') return null;

    let item: 'patty_raw' | 'patty_cooked' | 'patty_burnt' = 'patty_raw';
    if (slot.state === 'cooked') item = 'patty_cooked';
    else if (slot.state === 'burnt') item = 'patty_burnt';

    slot.state = 'empty';
    slot.elapsed = 0;
    slot.progress = 0;
    return { item };
  }

  update(dt: number): { newlyCooked: number[]; newlyBurnt: number[] } {
    const newlyCooked: number[] = [];
    const newlyBurnt: number[] = [];
    const { cookedTime, burntTime } = this.getThresholds();

    for (const slot of this.slots) {
      if (slot.state === 'empty') continue;

      const prevState = slot.state;
      slot.elapsed += dt;

      if (slot.elapsed >= burntTime) {
        slot.state = 'burnt';
        slot.progress = 1;
        if (prevState !== 'burnt') {
          newlyBurnt.push(slot.id);
        }
      } else if (slot.elapsed >= cookedTime) {
        slot.state = 'cooked';
        slot.progress = (slot.elapsed - cookedTime) / (burntTime - cookedTime);
        if (prevState === 'cooking') {
          newlyCooked.push(slot.id);
        }
      } else {
        slot.state = 'cooking';
        slot.progress = Math.min(1, slot.elapsed / cookedTime);
      }
    }

    return { newlyCooked, newlyBurnt };
  }

  hasActiveCooking(): boolean {
    return this.slots.some((s) => s.state === 'cooking' || s.state === 'cooked');
  }

  reset(): void {
    for (const slot of this.slots) {
      slot.state = 'empty';
      slot.elapsed = 0;
      slot.progress = 0;
    }
  }
}
