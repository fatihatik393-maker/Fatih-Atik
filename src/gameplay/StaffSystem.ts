import { STAFF_CANDIDATES, StaffMemberState } from '../core/GameConfig';

export const CASHIER_SPAWN_POS = { x: -3.6, y: 0, z: -2.2 };
export const CASHIER_POST_POS = { x: -1.55, y: 0, z: -1.28 };

export function hireCashierTransaction(
  currentStaff: StaffMemberState,
  currentMoney: number
): {
  ok: boolean;
  reason?: string;
  updatedStaff: StaffMemberState;
  newMoney: number;
  hireCost: number;
} {
  const candidate = STAFF_CANDIDATES[0];
  if (currentStaff.hired) {
    return {
      ok: false,
      reason: `${currentStaff.name} zaten kadroda aktif olarak çalışıyor!`,
      updatedStaff: currentStaff,
      newMoney: currentMoney,
      hireCost: 0,
    };
  }

  if (currentMoney < candidate.hireFee) {
    return {
      ok: false,
      reason: `Kasiyer işe alım ücreti için bakiye yetersiz! (${candidate.hireFee} $ gerekli)`,
      updatedStaff: currentStaff,
      newMoney: currentMoney,
      hireCost: 0,
    };
  }

  const updatedStaff: StaffMemberState = {
    ...currentStaff,
    hired: true,
    dailyWage: candidate.dailyWage,
    orderSpeedSeconds: candidate.orderSpeedSeconds,
    aiState: 'ARRIVING',
    activeCustomerId: null,
    orderTimer: 0,
    position: { ...CASHIER_SPAWN_POS },
    rotationY: 0,
  };

  return {
    ok: true,
    updatedStaff,
    newMoney: currentMoney - candidate.hireFee,
    hireCost: candidate.hireFee,
  };
}

export function dismissCashierState(currentStaff: StaffMemberState): {
  ok: boolean;
  reason?: string;
  updatedStaff: StaffMemberState;
} {
  if (!currentStaff.hired) {
    return {
      ok: false,
      reason: 'Şu anda aktif çalışan bir kasiyer bulunmuyor.',
      updatedStaff: currentStaff,
    };
  }

  return {
    ok: true,
    updatedStaff: {
      ...currentStaff,
      hired: false,
      aiState: 'OFF_DUTY',
      activeCustomerId: null,
      orderTimer: 0,
    },
  };
}

export interface FrontQueueCustomerDescriptor {
  id: string;
  state: string;
  queueIndex: number;
}

export function stepCashierAI(
  staff: StaffMemberState,
  dt: number,
  frontCustomer: FrontQueueCustomerDescriptor | null,
  activeOrderCustomerIds: Set<string>,
  canAcceptMoreOrders: boolean
): {
  updatedStaff: StaffMemberState;
  shouldBeginCustomerOrder?: string;
  shouldCompleteCustomerOrder?: string;
} {
  if (!staff.hired || staff.aiState === 'OFF_DUTY') {
    return { updatedStaff: staff };
  }

  const next: StaffMemberState = {
    ...staff,
    position: { ...staff.position },
  };

  if (next.aiState === 'ARRIVING') {
    next.aiState = 'WALKING_TO_POST';
  }

  if (next.aiState === 'WALKING_TO_POST') {
    const dx = CASHIER_POST_POS.x - next.position.x;
    const dz = CASHIER_POST_POS.z - next.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= 0.08) {
      next.position.x = CASHIER_POST_POS.x;
      next.position.z = CASHIER_POST_POS.z;
      next.rotationY = 0; // Face +Z toward POS and customer queue
      next.aiState = 'WAITING_FOR_CUSTOMER';
    } else {
      const step = Math.min(dist, 2.2 * dt);
      next.position.x += (dx / dist) * step;
      next.position.z += (dz / dist) * step;
      next.rotationY = Math.atan2(dx, dz);
      return { updatedStaff: next };
    }
  }

  // Ensure cashier stands at post facing +Z
  next.position.x = CASHIER_POST_POS.x;
  next.position.z = CASHIER_POST_POS.z;
  next.rotationY = 0;

  // Check if there is a valid customer at the front of the queue who doesn't already have an order
  const eligibleCustomer =
    frontCustomer &&
    frontCustomer.queueIndex === 0 &&
    (frontCustomer.state === 'WAITING_TO_ORDER' || frontCustomer.state === 'ORDERING') &&
    !activeOrderCustomerIds.has(frontCustomer.id) &&
    canAcceptMoreOrders
      ? frontCustomer
      : null;

  if (!eligibleCustomer) {
    next.aiState = 'WAITING_FOR_CUSTOMER';
    next.activeCustomerId = null;
    next.orderTimer = 0;
    return { updatedStaff: next };
  }

  // Start taking order for the front customer
  if (next.activeCustomerId !== eligibleCustomer.id) {
    next.activeCustomerId = eligibleCustomer.id;
    next.orderTimer = 0;
    next.aiState = 'TAKING_ORDER';
    return {
      updatedStaff: next,
      shouldBeginCustomerOrder: eligibleCustomer.id,
    };
  }

  next.orderTimer += dt;
  const speed = Math.max(0.8, next.orderSpeedSeconds);

  if (next.orderTimer < speed * 0.72) {
    next.aiState = 'TAKING_ORDER';
    return { updatedStaff: next };
  }

  if (next.orderTimer < speed) {
    next.aiState = 'SENDING_TO_KDS';
    return { updatedStaff: next };
  }

  // Order completed -> emit to KDS once and transition to READY
  const completedId = eligibleCustomer.id;
  next.aiState = 'READY';
  next.activeCustomerId = null;
  next.orderTimer = 0;
  next.ordersTakenToday += 1;

  return {
    updatedStaff: next,
    shouldCompleteCustomerOrder: completedId,
  };
}

export function processEndOfDayPayroll(
  staff: StaffMemberState,
  currentMoney: number
): {
  wagePaid: number;
  newMoney: number;
} {
  if (!staff.hired) {
    return { wagePaid: 0, newMoney: currentMoney };
  }
  const wage = staff.dailyWage;
  return {
    wagePaid: wage,
    newMoney: Math.max(0, currentMoney - wage),
  };
}
