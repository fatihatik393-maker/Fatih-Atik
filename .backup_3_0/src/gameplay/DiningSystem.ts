import { HeldItem, ITEM_LABELS, RecipeId } from '../core/GameConfig';

export type DiningSeatStatus = 'empty' | 'occupied' | 'dirty_tray' | 'needs_wipe';

export interface DiningSeatState {
  id: string;
  tableId: string;
  label: string;
  /** Open aisle waypoint so customers never walk through the table or booth back */
  approachPosition: { x: number; z: number };
  /** Exact seated position on the bench cushion */
  seatPosition: { x: number; z: number };
  /** Yaw angle (radians) the customer faces while seated */
  seatYaw: number;
  /** Position on the tabletop where the customer's meal tray / dirty tray is placed */
  trayPosition: { x: number; y: number; z: number };
  /** Y rotation of the tray on the tabletop */
  trayRotationY: number;
  status: DiningSeatStatus;
  occupiedByCustomerId: string | null;
  reservedForGroupId: string | null;
  dirtyTrayItem: HeldItem | null;
  /** Progressive cloth-wiping progress from 0.0 (unwiped) to 1.0 (sparkling clean) */
  wipeProgress: number;
}

export const INITIAL_DINING_SEATS: Omit<
  DiningSeatState,
  | 'status'
  | 'occupiedByCustomerId'
  | 'reservedForGroupId'
  | 'dirtyTrayItem'
  | 'wipeProgress'
>[] = [
  {
    id: 'seat_left_north',
    tableId: 'dining_table_left',
    label: 'Sol Salon Masası (#1) · Kuzey Koltuk',
    approachPosition: { x: -3.25, z: 2.02 },
    seatPosition: { x: -4.9, z: 2.02 },
    seatYaw: 0, // Facing +Z towards table center
    trayPosition: { x: -4.9, y: 0.798, z: 2.62 },
    trayRotationY: 0,
  },
  {
    id: 'seat_left_south',
    tableId: 'dining_table_left',
    label: 'Sol Salon Masası (#1) · Güney Koltuk',
    approachPosition: { x: -3.25, z: 3.78 },
    seatPosition: { x: -4.9, z: 3.78 },
    seatYaw: Math.PI, // Facing -Z towards table center
    trayPosition: { x: -4.9, y: 0.798, z: 3.18 },
    trayRotationY: Math.PI,
  },
  {
    id: 'seat_right_north',
    tableId: 'dining_table_right',
    label: 'Sağ Salon Masası (#2) · Kuzey Koltuk',
    approachPosition: { x: 3.25, z: 2.02 },
    seatPosition: { x: 4.9, z: 2.02 },
    seatYaw: 0, // Facing +Z towards table center
    trayPosition: { x: 4.9, y: 0.798, z: 2.62 },
    trayRotationY: 0,
  },
  {
    id: 'seat_right_south',
    tableId: 'dining_table_right',
    label: 'Sağ Salon Masası (#2) · Güney Koltuk',
    approachPosition: { x: 3.25, z: 3.78 },
    seatPosition: { x: 4.9, z: 3.78 },
    seatYaw: Math.PI, // Facing -Z towards table center
    trayPosition: { x: 4.9, y: 0.798, z: 3.18 },
    trayRotationY: Math.PI,
  },
];

/**
 * Pure, deterministic dining table, pair-group reservation & two-stage progressive cleaning state manager.
 * Stage 1: Customer finishes dining -> seat becomes `'dirty_tray'` (used tray + crumbs + napkins).
 * Stage 2: Player collects the dirty tray -> seat becomes `'needs_wipe'` (`wipeProgress = 0`).
 * Stage 3: Player wipes the table surface with a cloth (`advanceWipeSeatSurface` from `0.0 -> 1.0`) ->
 *          seat becomes `'empty'` (clean) and awards +5 $ bonus once upon reaching 1.0.
 */
export class DiningTableSystem {
  readonly seats: DiningSeatState[];

  constructor() {
    this.seats = INITIAL_DINING_SEATS.map((spec) => ({
      ...spec,
      approachPosition: { ...spec.approachPosition },
      seatPosition: { ...spec.seatPosition },
      trayPosition: { ...spec.trayPosition },
      status: 'empty',
      occupiedByCustomerId: null,
      reservedForGroupId: null,
      dirtyTrayItem: null,
      wipeProgress: 0,
    }));
  }

  reset(): void {
    for (const seat of this.seats) {
      seat.status = 'empty';
      seat.occupiedByCustomerId = null;
      seat.reservedForGroupId = null;
      seat.dirtyTrayItem = null;
      seat.wipeProgress = 0;
    }
  }

  getSeatById(seatId: string | null | undefined): DiningSeatState | null {
    if (!seatId) return null;
    return this.seats.find((s) => s.id === seatId) || null;
  }

  getSeatsByTableId(tableId: string): DiningSeatState[] {
    return this.seats.filter((s) => s.tableId === tableId);
  }

  getEmptySeats(includeGroupReserved = false): DiningSeatState[] {
    return this.seats.filter(
      (s) =>
        s.status === 'empty' &&
        (includeGroupReserved || s.reservedForGroupId === null)
    );
  }

  /**
   * Returns all seats that are not yet clean (either `'dirty_tray'` or `'needs_wipe'`).
   */
  getDirtySeats(): DiningSeatState[] {
    return this.seats.filter(
      (s) => s.status === 'dirty_tray' || s.status === 'needs_wipe'
    );
  }

  getTrayDirtySeats(): DiningSeatState[] {
    return this.seats.filter(
      (s) => s.status === 'dirty_tray' && s.dirtyTrayItem !== null
    );
  }

  getWipeNeededSeats(): DiningSeatState[] {
    return this.seats.filter((s) => s.status === 'needs_wipe');
  }

  getOccupiedSeats(): DiningSeatState[] {
    return this.seats.filter((s) => s.status === 'occupied');
  }

  /**
   * Finds an available clean ('empty' and unreserved) seat for a solo diner.
   * Prefers tables that currently have no occupants so solo diners spread out across tables first,
   * then fills the opposite bench seat when busy.
   */
  findAvailableSeat(preferredIndexSeed = 0): DiningSeatState | null {
    const empty = this.getEmptySeats(false);
    if (empty.length === 0) return null;

    const occupiedOrDirtyTables = new Set(
      this.seats
        .filter((s) => s.status !== 'empty' || s.reservedForGroupId !== null)
        .map((s) => s.tableId)
    );
    const completelyFreeTableSeats = empty.filter(
      (s) => !occupiedOrDirtyTables.has(s.tableId)
    );

    const pool =
      completelyFreeTableSeats.length > 0 ? completelyFreeTableSeats : empty;
    const idx = Math.abs(Math.round(preferredIndexSeed)) % pool.length;
    return pool[idx];
  }

  /**
   * Reserves both opposite seats of a clean table for a 2-person customer group (`groupId`).
   * Returns the two seats if a completely clean, unreserved 2-seat booth table is available;
   * otherwise returns null so the pair can safely fall back to takeaway.
   */
  reserveTableForGroup(
    groupId: string,
    preferredIndexSeed = 0
  ): [DiningSeatState, DiningSeatState] | null {
    const existing = this.seats.filter((s) => s.reservedForGroupId === groupId);
    if (existing.length === 2) {
      return [existing[0], existing[1]];
    }

    const tableIds = ['dining_table_left', 'dining_table_right'];
    const cleanTables: [DiningSeatState, DiningSeatState][] = [];

    for (const tid of tableIds) {
      const tSeats = this.getSeatsByTableId(tid);
      if (
        tSeats.length === 2 &&
        tSeats.every(
          (s) => s.status === 'empty' && s.reservedForGroupId === null
        )
      ) {
        cleanTables.push([tSeats[0], tSeats[1]]);
      }
    }

    if (cleanTables.length === 0) return null;
    const chosen =
      cleanTables[Math.abs(Math.round(preferredIndexSeed)) % cleanTables.length];
    chosen[0].reservedForGroupId = groupId;
    chosen[1].reservedForGroupId = groupId;
    return chosen;
  }

  /**
   * Releases any unused seat reservations for a group (e.g., if a group member leaves angry or takes takeaway).
   */
  releaseGroupReservation(groupId: string | null | undefined): void {
    if (!groupId) return;
    for (const seat of this.seats) {
      if (seat.reservedForGroupId === groupId && seat.status === 'empty') {
        seat.reservedForGroupId = null;
      }
    }
  }

  /**
   * Finds and reserves a seat for either a paired group customer or a solo customer.
   * Paired customers (`groupId != null`) only sit if both seats at the same booth table
   * can be secured for their group; otherwise returns `null` for safe takeaway fallback.
   */
  reserveSeatForCustomer(
    customerId: string,
    groupId: string | null = null,
    preferredIndexSeed = 0
  ): DiningSeatState | null {
    if (groupId) {
      const reservedEmpty = this.seats.find(
        (s) => s.status === 'empty' && s.reservedForGroupId === groupId
      );
      if (reservedEmpty) {
        return this.reserveSeat(reservedEmpty.id, customerId, groupId);
      }
      const pairSeats = this.reserveTableForGroup(groupId, preferredIndexSeed);
      if (!pairSeats) {
        return null;
      }
      return this.reserveSeat(pairSeats[0].id, customerId, groupId);
    }

    const soloSeat = this.findAvailableSeat(preferredIndexSeed);
    if (!soloSeat) return null;
    return this.reserveSeat(soloSeat.id, customerId, null);
  }

  /**
   * Reserves a specific empty seat for a customer who just received their order.
   */
  reserveSeat(
    seatId: string,
    customerId: string,
    groupId: string | null = null
  ): DiningSeatState | null {
    const seat = this.getSeatById(seatId);
    if (!seat || seat.status !== 'empty') return null;
    if (
      seat.reservedForGroupId !== null &&
      seat.reservedForGroupId !== groupId
    ) {
      return null;
    }
    seat.status = 'occupied';
    seat.occupiedByCustomerId = customerId;
    seat.reservedForGroupId = groupId;
    seat.dirtyTrayItem = null;
    seat.wipeProgress = 0;
    return seat;
  }

  /**
   * Called when a seated customer finishes eating and stands up to leave.
   * If `leaveDirtyTray` is true, transitions the seat to `'dirty_tray'` (Stage 1 of cleaning)
   * and spawns a `dirty_tray` item on the tabletop; otherwise frees the seat to `'empty'`.
   */
  finishDiningAtSeat(
    seatId: string,
    leaveDirtyTray = true,
    burgerRecipe?: RecipeId,
    hadSoda?: boolean
  ): DiningSeatState | null {
    const seat = this.getSeatById(seatId);
    if (!seat) return null;

    seat.occupiedByCustomerId = null;
    seat.reservedForGroupId = null;
    seat.wipeProgress = 0;
    if (leaveDirtyTray) {
      seat.status = 'dirty_tray';
      seat.dirtyTrayItem = {
        type: 'dirty_tray',
        label: ITEM_LABELS.dirty_tray,
        burgerRecipe,
        hasSoda: Boolean(hadSoda),
        cleanBonusPending: false,
      };
    } else {
      seat.status = 'empty';
      seat.dirtyTrayItem = null;
    }
    return seat;
  }

  /**
   * Stage 1 Cleanup: Player picks up the used service tray (`dirty_tray`) from the table.
   * The seat is NOT clean yet — it transitions to `'needs_wipe'`, leaving crumbs and napkins
   * on the tabletop until the player wipes the surface with a cloth!
   */
  pickupDirtyTrayFromSeat(seatId: string): {
    success: boolean;
    item?: HeldItem;
    reason: string;
  } {
    const seat = this.getSeatById(seatId);
    if (!seat || seat.status !== 'dirty_tray' || !seat.dirtyTrayItem) {
      return {
        success: false,
        reason: 'Bu masada toplanacak kirli tepsi yok.',
      };
    }

    const item: HeldItem = { ...seat.dirtyTrayItem };
    seat.status = 'needs_wipe';
    seat.occupiedByCustomerId = null;
    seat.dirtyTrayItem = null;
    seat.wipeProgress = 0;

    return {
      success: true,
      item,
      reason: `${seat.label}: Kirli tepsi alındı! Masayı açmak için tepsiyi bırakıp yüzeyi bezle silin.`,
    };
  }

  /**
   * Stage 2 Progressive Cleanup: Advances the cloth-wiping progress (`0.0 -> 1.0`) on a `'needs_wipe'` seat.
   * If `wipeProgress < 1.0`, preserves partial progress (`status === 'needs_wipe'`) so releasing early
   * leaves remaining crumbs consistent. When `wipeProgress >= 1.0`, transitions the seat to `'empty'`
   * and awards the +5 $ cleanliness bonus and +1 reputation strictly once.
   */
  advanceWipeSeatSurface(
    seatId: string,
    deltaProgress: number
  ): {
    success: boolean;
    completed: boolean;
    wipeProgress: number;
    bonusMoney: number;
    bonusReputation: number;
    reason: string;
  } {
    const seat = this.getSeatById(seatId);
    if (!seat) {
      return {
        success: false,
        completed: false,
        wipeProgress: 0,
        bonusMoney: 0,
        bonusReputation: 0,
        reason: 'Masa bulunamadı.',
      };
    }
    if (seat.status === 'dirty_tray') {
      return {
        success: false,
        completed: false,
        wipeProgress: 0,
        bonusMoney: 0,
        bonusReputation: 0,
        reason: 'Önce masadaki kullanılmış servis tepsisini toplayın!',
      };
    }
    if (seat.status !== 'needs_wipe') {
      return {
        success: false,
        completed: false,
        wipeProgress: 1,
        bonusMoney: 0,
        bonusReputation: 0,
        reason: 'Bu masa zaten temiz.',
      };
    }

    const step = Math.max(0.01, deltaProgress);
    seat.wipeProgress = Math.min(1, Number((seat.wipeProgress + step).toFixed(4)));

    if (seat.wipeProgress < 0.999) {
      const pct = Math.round(seat.wipeProgress * 100);
      return {
        success: true,
        completed: false,
        wipeProgress: seat.wipeProgress,
        bonusMoney: 0,
        bonusReputation: 0,
        reason: `${seat.label} bezle siliniyor... (%${pct})`,
      };
    }

    seat.status = 'empty';
    seat.occupiedByCustomerId = null;
    seat.reservedForGroupId = null;
    seat.dirtyTrayItem = null;
    seat.wipeProgress = 0;

    return {
      success: true,
      completed: true,
      wipeProgress: 1,
      bonusMoney: 5,
      bonusReputation: 1,
      reason: `${seat.label} bezle silindi ve yeni müşterilere açıldı! (+5 $ Temizlik Primi · +1 İtibar)`,
    };
  }

  /**
   * Completes Stage 2 table wiping (`deltaProgress = 1.0`).
   */
  wipeSeatSurface(seatId: string): {
    success: boolean;
    bonusMoney: number;
    bonusReputation: number;
    reason: string;
  } {
    const res = this.advanceWipeSeatSurface(seatId, 1.0);
    return {
      success: res.success && res.completed,
      bonusMoney: res.bonusMoney,
      bonusReputation: res.bonusReputation,
      reason: res.reason,
    };
  }
}

