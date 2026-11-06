import { GAME_CONFIG, HeldItemType } from '../core/GameConfig';

export type GrillSlotState = 'empty' | 'cooking' | 'cooked' | 'burnt';

export interface GrillSlot {
  id: number;
  state: GrillSlotState;
  elapsed: number;
  progress: number; // 0..1 during cooking, 0..1 towards burnt after cooked
}

export interface FryerSlot {
  id: number;
  state: GrillSlotState;
  elapsed: number;
  progress: number; // 0..1 during cooking, 0..1 towards burnt after cooked
  basketHeight: number; // 0 = lowered in hot oil, 1 = lifted draining
}

export class CookingSystem {
  slots: GrillSlot[];
  fryerSlots: FryerSlot[];
  isUpgraded: boolean;

  constructor(slotCount = 4, isUpgraded = false, fryerSlotCount = 2) {
    this.isUpgraded = isUpgraded;
    this.slots = Array.from({ length: slotCount }, (_, i) => ({
      id: i,
      state: 'empty',
      elapsed: 0,
      progress: 0,
    }));
    this.fryerSlots = Array.from({ length: fryerSlotCount }, (_, i) => ({
      id: i,
      state: 'empty',
      elapsed: 0,
      progress: 0,
      basketHeight: 1,
    }));
  }

  getThresholds() {
    return this.isUpgraded ? GAME_CONFIG.cooking.upgraded : GAME_CONFIG.cooking.standard;
  }

  getFryerThresholds() {
    return this.isUpgraded ? GAME_CONFIG.frying.upgraded : GAME_CONFIG.frying.standard;
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

  placeRawFries(slotIndex?: number): number {
    const targetIdx =
      slotIndex !== undefined
        ? slotIndex
        : this.fryerSlots.findIndex((s) => s.state === 'empty');
    if (
      targetIdx === -1 ||
      !this.fryerSlots[targetIdx] ||
      this.fryerSlots[targetIdx].state !== 'empty'
    ) {
      return -1;
    }
    this.fryerSlots[targetIdx].state = 'cooking';
    this.fryerSlots[targetIdx].elapsed = 0;
    this.fryerSlots[targetIdx].progress = 0;
    this.fryerSlots[targetIdx].basketHeight = 0;
    return targetIdx;
  }

  takeFries(
    slotIndex: number,
    allowEarlyPull = true
  ): { item: HeldItemType; fryState: 'undercooked' | 'cooked' | 'burnt' } | null {
    const slot = this.fryerSlots[slotIndex];
    if (!slot || slot.state === 'empty') return null;
    if (slot.state === 'cooking' && !allowEarlyPull) return null;

    let item: HeldItemType = 'fries_undercooked';
    let fryState: 'undercooked' | 'cooked' | 'burnt' = 'undercooked';
    if (slot.state === 'cooked') {
      item = 'fries_box';
      fryState = 'cooked';
    } else if (slot.state === 'burnt') {
      item = 'fries_burnt';
      fryState = 'burnt';
    }

    slot.state = 'empty';
    slot.elapsed = 0;
    slot.progress = 0;
    slot.basketHeight = 1;
    return { item, fryState };
  }

  update(dt: number): {
    newlyCooked: number[];
    newlyBurnt: number[];
    newlyFried: number[];
    newlyFryBurnt: number[];
  } {
    const newlyCooked: number[] = [];
    const newlyBurnt: number[] = [];
    const newlyFried: number[] = [];
    const newlyFryBurnt: number[] = [];
    const { cookedTime, burntTime } = this.getThresholds();
    const { cookedTime: fryCookedTime, burntTime: fryBurntTime } = this.getFryerThresholds();

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

    for (const fSlot of this.fryerSlots) {
      if (fSlot.state === 'empty') {
        fSlot.basketHeight = Math.min(1, fSlot.basketHeight + dt * 4.5);
        continue;
      }

      const prevState = fSlot.state;
      fSlot.elapsed += dt;

      if (fSlot.elapsed >= fryBurntTime) {
        fSlot.state = 'burnt';
        fSlot.progress = 1;
        fSlot.basketHeight = 0.25;
        if (prevState !== 'burnt') {
          newlyFryBurnt.push(fSlot.id);
        }
      } else if (fSlot.elapsed >= fryCookedTime) {
        fSlot.state = 'cooked';
        fSlot.progress = (fSlot.elapsed - fryCookedTime) / (fryBurntTime - fryCookedTime);
        fSlot.basketHeight = Math.min(0.65, fSlot.basketHeight + dt * 3.0);
        if (prevState === 'cooking') {
          newlyFried.push(fSlot.id);
        }
      } else {
        fSlot.state = 'cooking';
        fSlot.progress = Math.min(1, fSlot.elapsed / fryCookedTime);
        fSlot.basketHeight = Math.max(0, fSlot.basketHeight - dt * 5.0);
      }
    }

    return { newlyCooked, newlyBurnt, newlyFried, newlyFryBurnt };
  }

  hasActiveCooking(): boolean {
    return (
      this.slots.some((s) => s.state === 'cooking' || s.state === 'cooked') ||
      this.fryerSlots.some((s) => s.state === 'cooking' || s.state === 'cooked')
    );
  }

  reset(): void {
    for (const slot of this.slots) {
      slot.state = 'empty';
      slot.elapsed = 0;
      slot.progress = 0;
    }
    for (const fSlot of this.fryerSlots) {
      fSlot.state = 'empty';
      fSlot.elapsed = 0;
      fSlot.progress = 0;
      fSlot.basketHeight = 1;
    }
  }
}
