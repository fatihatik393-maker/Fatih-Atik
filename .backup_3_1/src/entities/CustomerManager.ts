import * as THREE from 'three';
import {
  CustomerOrder,
  DayPhase,
  GAME_CONFIG,
  RECIPES,
  RecipeId,
} from '../core/GameConfig';
import { DiningSeatState, DiningTableSystem } from '../gameplay/DiningSystem';
import { CUSTOMER_WAYPOINTS } from '../world/RestaurantLayout';
import { CUSTOMER_PROFILES, CustomerActor } from './Customer';

export interface CustomerUpdateOptions {
  dayPhase?: DayPhase;
  unlockedRecipes?: RecipeId[];
  decorUpgraded?: boolean;
  reputation?: number;
  onCustomerEntered?: (customer: CustomerActor, isGroup: boolean) => void;
  onNewOrderPlaced?: (order: CustomerOrder) => void;
  onCustomerSeated?: (customer: CustomerActor, seat: DiningSeatState) => void;
  onCustomerLost?: (customer: CustomerActor, order: CustomerOrder | null) => void;
  onSeatBecameDirty?: (seat: DiningSeatState, customer: CustomerActor) => void;
}

export class CustomerManager {
  private scene: THREE.Scene;
  readonly dining = new DiningTableSystem();
  customers: CustomerActor[] = [];
  orders: CustomerOrder[] = [];
  private spawnTimer = 2.0;
  private customerCounter = 0;
  private orderCounter = 0;
  private groupCounter = 0;
  private spawnWaveCounter = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  reset(): void {
    for (const c of this.customers) {
      c.cleanupActiveMealProps(this.scene);
      this.scene.remove(c.root);
    }
    this.customers = [];
    this.orders = [];
    this.dining.reset();
    this.spawnTimer = 1.5;
    this.spawnWaveCounter = 0;
  }

  getActiveOrders(): CustomerOrder[] {
    return this.orders.filter(
      (o) => !o.delivered && o.status !== 'delivered' && o.status !== 'cancelled'
    );
  }

  getActiveOrderById(orderId: string | null): CustomerOrder | null {
    if (!orderId) return null;
    return (
      this.orders.find(
        (o) =>
          o.id === orderId &&
          !o.delivered &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled'
      ) || null
    );
  }

  getOrderById(orderId: string | null): CustomerOrder | null {
    if (!orderId) return null;
    return this.orders.find((o) => o.id === orderId) || null;
  }

  getFirstPendingOrder(): CustomerOrder | null {
    return (
      this.orders.find(
        (o) => !o.delivered && o.status !== 'delivered' && o.status !== 'cancelled'
      ) || null
    );
  }

  syncSelectedOrderHighlight(selectedOrderId: string | null): void {
    for (const c of this.customers) {
      const isSelected = Boolean(
        selectedOrderId &&
          c.orderId === selectedOrderId &&
          (c.state === 'ORDER_PLACED' || c.state === 'WAITING_FOR_FOOD')
      );
      c.setSelectedTarget(isSelected);
    }
  }

  getMaxConcurrentCustomers(dayPhase: DayPhase = 'normal'): number {
    if (dayPhase === 'rush_hour') return 5;
    if (dayPhase === 'normal') return 4;
    return 4;
  }

  /**
   * Returns customers actively in the ordering or pickup queues (seated diners do not block new arrivals).
   */
  private getActiveQueueCustomers(): CustomerActor[] {
    return this.customers.filter(
      (c) =>
        c.state === 'ENTERING' ||
        c.state === 'WALKING_TO_COUNTER' ||
        c.state === 'WAITING_TO_ORDER' ||
        c.state === 'ORDERING' ||
        c.state === 'ORDER_PLACED' ||
        c.state === 'WAITING_FOR_FOOD' ||
        c.state === 'RECEIVING_ORDER'
    );
  }

  private getSpawnInterval(dayPhase: DayPhase = 'normal', reputation = 50): number {
    const repBonus = ((reputation - 50) / 50) * 1.1; // Faster spawn at high reputation
    const base =
      dayPhase === 'rush_hour'
        ? 4.6
        : dayPhase === 'normal'
        ? 7.2
        : 8.8;
    return Math.max(3.2, base - repBonus);
  }

  spawnCustomer(
    dayPhase: DayPhase = 'normal',
    decorUpgraded = false
  ): CustomerActor | null {
    const activeQueue = this.getActiveQueueCustomers();
    if (activeQueue.length >= this.getMaxConcurrentCustomers(dayPhase)) {
      return null;
    }

    const profile =
      CUSTOMER_PROFILES[this.customerCounter % CUSTOMER_PROFILES.length];
    this.customerCounter += 1;
    const id = `cust_${this.customerCounter}`;

    const basePatience =
      dayPhase === 'rush_hour'
        ? GAME_CONFIG.patience.rushHourSeconds
        : GAME_CONFIG.patience.baseSeconds;
    const maxPatience =
      basePatience +
      (decorUpgraded ? GAME_CONFIG.patience.decorBonusSeconds : 0);

    // Alternate sidewalk entry points for natural street flow
    const spawnPoint =
      this.customerCounter % 3 === 0
        ? CUSTOMER_WAYPOINTS.outsideSpawnRight
        : this.customerCounter % 2 === 0
        ? CUSTOMER_WAYPOINTS.outsideSpawnLeft
        : CUSTOMER_WAYPOINTS.outsideSpawn;

    const actor = new CustomerActor(
      id,
      profile,
      spawnPoint,
      this.customerCounter,
      maxPatience
    );
    actor.state = 'ENTERING';
    actor.targetPosition.copy(CUSTOMER_WAYPOINTS.doorThreshold);
    this.scene.add(actor.root);
    this.customers.push(actor);
    this.recalculateQueueTargets();
    return actor;
  }

  /**
   * Spawns a 2-person customer group (couple / two friends) that walks in together,
   * queues in order, places independent orders, and coordinates to sit across from each other
   * at the same booth table.
   */
  spawnCustomerGroup(
    dayPhase: DayPhase = 'normal',
    decorUpgraded = false
  ): [CustomerActor, CustomerActor] | null {
    const activeQueue = this.getActiveQueueCustomers();
    if (activeQueue.length + 2 > this.getMaxConcurrentCustomers(dayPhase) + 1) {
      return null;
    }

    this.groupCounter += 1;
    const groupId = `grp_${this.groupCounter}`;

    const profile1 =
      CUSTOMER_PROFILES[this.customerCounter % CUSTOMER_PROFILES.length];
    this.customerCounter += 1;
    const id1 = `cust_${this.customerCounter}`;

    const profile2 =
      CUSTOMER_PROFILES[this.customerCounter % CUSTOMER_PROFILES.length];
    this.customerCounter += 1;
    const id2 = `cust_${this.customerCounter}`;

    const basePatience =
      dayPhase === 'rush_hour'
        ? GAME_CONFIG.patience.rushHourSeconds
        : GAME_CONFIG.patience.baseSeconds;
    const maxPatience =
      basePatience +
      10 +
      (decorUpgraded ? GAME_CONFIG.patience.decorBonusSeconds : 0);

    const baseSpawn =
      this.groupCounter % 2 === 0
        ? CUSTOMER_WAYPOINTS.outsideSpawnLeft
        : CUSTOMER_WAYPOINTS.outsideSpawn;
    const spawn1 = baseSpawn.clone();
    const spawn2 = baseSpawn.clone().add(new THREE.Vector3(-0.55, 0, 0.45));

    const actor1 = new CustomerActor(
      id1,
      profile1,
      spawn1,
      this.customerCounter - 1,
      maxPatience
    );
    const actor2 = new CustomerActor(
      id2,
      profile2,
      spawn2,
      this.customerCounter,
      maxPatience
    );

    actor1.groupId = groupId;
    actor1.partnerCustomerId = actor2.id;
    actor1.partnerName = actor2.profile.name;

    actor2.groupId = groupId;
    actor2.partnerCustomerId = actor1.id;
    actor2.partnerName = actor1.profile.name;

    actor1.state = 'ENTERING';
    actor2.state = 'ENTERING';
    actor1.targetPosition.copy(CUSTOMER_WAYPOINTS.doorThreshold);
    actor2.targetPosition
      .copy(CUSTOMER_WAYPOINTS.doorThreshold)
      .add(new THREE.Vector3(0.32, 0, 0.42));

    actor1.updateBadgeText(
      `${actor1.profile.name} & ${actor2.profile.name}`,
      'Birlikte Geldi · Sırada',
      '#fbbf24',
      1.0
    );
    actor2.updateBadgeText(
      `${actor2.profile.name} & ${actor1.profile.name}`,
      'Birlikte Geldi · Sırada',
      '#fbbf24',
      1.0
    );

    this.scene.add(actor1.root);
    this.scene.add(actor2.root);
    this.customers.push(actor1, actor2);
    this.recalculateQueueTargets();
    return [actor1, actor2];
  }

  private recalculateQueueTargets(): void {
    // Customers waiting to place order or currently ordering at counter
    const orderingQueue = this.customers.filter(
      (c) =>
        c.state === 'WALKING_TO_COUNTER' ||
        c.state === 'WAITING_TO_ORDER' ||
        c.state === 'ORDERING'
    );
    orderingQueue.forEach((c, idx) => {
      c.queueIndex = idx;
      const slot =
        CUSTOMER_WAYPOINTS.queueSlots[
          Math.min(idx, CUSTOMER_WAYPOINTS.queueSlots.length - 1)
        ];
      c.targetPosition.copy(slot);
    });

    // Customers waiting for food at pickup counter
    const pickupQueue = this.customers.filter(
      (c) => c.state === 'ORDER_PLACED' || c.state === 'WAITING_FOR_FOOD'
    );
    pickupQueue.forEach((c, idx) => {
      c.queueIndex = idx;
      const slot =
        CUSTOMER_WAYPOINTS.waitingForFoodSlots[
          Math.min(idx, CUSTOMER_WAYPOINTS.waitingForFoodSlots.length - 1)
        ];
      c.targetPosition.copy(slot);
    });
  }

  private createOrderForCustomer(
    customer: CustomerActor,
    unlockedRecipes: RecipeId[] = ['classic_burger', 'cheeseburger']
  ): CustomerOrder {
    this.orderCounter += 1;
    const isFirstEver = this.orderCounter === 1;
    const pool: RecipeId[] =
      unlockedRecipes.length > 0
        ? unlockedRecipes
        : ['classic_burger', 'cheeseburger'];

    let burger: RecipeId = 'classic_burger';
    if (!isFirstEver) {
      const r = Math.random();
      if (pool.includes('double_smash') && r < 0.36) {
        burger = 'double_smash';
      } else if (pool.includes('cheeseburger') && r < 0.72) {
        burger = 'cheeseburger';
      } else {
        burger = 'classic_burger';
      }
    }

    const wantsSoda = !isFirstEver && Math.random() < 0.48;

    const totalPrice =
      RECIPES[burger].price + (wantsSoda ? GAME_CONFIG.prices.soda : 0);

    const order: CustomerOrder = {
      id: `ORD-${100 + this.orderCounter}`,
      customerId: customer.id,
      customerName: customer.profile.name,
      burger,
      wantsSoda,
      totalPrice,
      createdAt: Date.now(),
      delivered: false,
      patience: customer.patience,
      maxPatience: customer.maxPatience,
      elapsedSeconds: 0,
      status: 'waiting',
    };

    this.orders.push(order);
    customer.orderId = order.id;
    const orderSummary = `${RECIPES[burger].name}${wantsSoda ? ' + İçecek' : ''}`;
    customer.updateBadgeText(
      customer.profile.name,
      orderSummary,
      '#38bdf8',
      customer.patienceRatio
    );
    return order;
  }

  /**
   * Completes the customer's order at the pickup counter.
   * Assigns an available dining table seat (coordinating same-table seating for 2-person groups)
   * or falls back to takeaway if all tables are currently occupied or dirty.
   */
  completeCustomerOrder(
    orderId: string,
    preferDineIn = true
  ): { dinedIn: boolean; seat: DiningSeatState | null } {
    const order = this.orders.find((o) => o.id === orderId);
    if (order) {
      order.delivered = true;
      order.status = 'delivered';
    }

    const customer = this.customers.find((c) => c.orderId === orderId);
    if (!customer) return { dinedIn: false, seat: null };

    customer.setSelectedTarget(false);
    customer.prepareDeliveredMealProps(
      order ? order.burger : 'classic_burger',
      Boolean(order?.wantsSoda)
    );

    let assignedSeat: DiningSeatState | null = null;
    if (preferDineIn) {
      assignedSeat = this.dining.reserveSeatForCustomer(
        customer.id,
        customer.groupId,
        customer.seedIndex
      );
      if (!assignedSeat && customer.groupId) {
        this.dining.releaseGroupReservation(customer.groupId);
      }
    }

    customer.assignedSeat = assignedSeat;
    customer.state = 'RECEIVING_ORDER';
    customer.reactionTimer = 0.85;

    if (assignedSeat) {
      const seatSubtitle = customer.partnerName
        ? `${customer.partnerName} ile Masaya Geçiyor ★`
        : 'Masaya Geçiyor ★';
      customer.updateBadgeText(
        customer.profile.name,
        seatSubtitle,
        '#4ade80',
        1.0
      );
    } else {
      customer.updateBadgeText(
        customer.profile.name,
        'Paket Servis · Teşekkürler!',
        '#4ade80',
        1.0
      );
    }

    this.recalculateQueueTargets();
    return { dinedIn: Boolean(assignedSeat), seat: assignedSeat };
  }

  refuseCustomerOrder(orderId: string): void {
    const customer = this.customers.find((c) => c.orderId === orderId);
    if (!customer) return;
    customer.triggerRefusalReaction('Yanlış Sipariş!');
  }

  update(
    dt: number,
    elapsed: number,
    shopOpen: boolean,
    optionsOrCallback?:
      | ((order: CustomerOrder) => void)
      | CustomerUpdateOptions
  ): void {
    const opts: CustomerUpdateOptions =
      typeof optionsOrCallback === 'function'
        ? { onNewOrderPlaced: optionsOrCallback }
        : optionsOrCallback || {};

    const dayPhase = opts.dayPhase || 'normal';
    const unlockedRecipes = opts.unlockedRecipes || [
      'classic_burger',
      'cheeseburger',
    ];
    const decorUpgraded = Boolean(opts.decorUpgraded);
    const reputation = opts.reputation ?? 50;

    if (shopOpen) {
      this.spawnTimer -= dt;
      const activeQueue = this.getActiveQueueCustomers();
      if (
        this.spawnTimer <= 0 &&
        activeQueue.length < this.getMaxConcurrentCustomers(dayPhase)
      ) {
        this.spawnWaveCounter += 1;
        // Periodically spawn a 2-person customer group when queue space allows
        const shouldTryPair =
          this.spawnWaveCounter % 2 === 1 &&
          activeQueue.length + 2 <= this.getMaxConcurrentCustomers(dayPhase) + 1;
        if (shouldTryPair) {
          const pair = this.spawnCustomerGroup(dayPhase, decorUpgraded);
          if (pair) {
            opts.onCustomerEntered?.(pair[0], true);
          } else {
            const solo = this.spawnCustomer(dayPhase, decorUpgraded);
            if (solo) opts.onCustomerEntered?.(solo, false);
          }
        } else {
          const solo = this.spawnCustomer(dayPhase, decorUpgraded);
          if (solo) opts.onCustomerEntered?.(solo, false);
        }
        this.spawnTimer = this.getSpawnInterval(dayPhase, reputation);
      }
    }

    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];

      // Tick patience while customer is waiting in queue or waiting for food
      if (
        c.state === 'WAITING_TO_ORDER' ||
        c.state === 'ORDER_PLACED' ||
        c.state === 'WAITING_FOR_FOOD'
      ) {
        const drainRate = c.state === 'WAITING_TO_ORDER' ? 0.45 : 1.0;
        c.patience = Math.max(0, c.patience - dt * drainRate);
        c.patienceRatio = c.maxPatience > 0 ? c.patience / c.maxPatience : 1;

        const linkedOrder = c.orderId
          ? this.orders.find((o) => o.id === c.orderId) || null
          : null;
        if (linkedOrder && !linkedOrder.delivered && linkedOrder.status !== 'cancelled') {
          linkedOrder.patience = c.patience;
          linkedOrder.elapsedSeconds = (linkedOrder.elapsedSeconds || 0) + dt;
          if (c.refusalTimer <= 0) {
            const orderSummary = `${RECIPES[linkedOrder.burger].name}${
              linkedOrder.wantsSoda ? ' + İçecek' : ''
            }`;
            const accent =
              c.patienceRatio < 0.35
                ? '#ef4444'
                : c.patienceRatio < 0.6
                ? '#f59e0b'
                : '#38bdf8';
            c.updateBadgeText(
              c.profile.name,
              c.patienceRatio < 0.35 ? `Acele! ${orderSummary}` : orderSummary,
              accent,
              c.patienceRatio
            );
          }
        }

        // Customer loses patience and walks out angrily!
        if (c.patience <= 0) {
          if (linkedOrder && !linkedOrder.delivered) {
            linkedOrder.status = 'cancelled';
            linkedOrder.delivered = false;
          }
          if (c.groupId) {
            this.dining.releaseGroupReservation(c.groupId);
          }
          if (c.assignedSeat) {
            this.dining.finishDiningAtSeat(c.assignedSeat.id, false);
            c.assignedSeat = null;
          }
          c.cleanupActiveMealProps(this.scene);
          c.state = 'LEAVING_ANGRY';
          c.setSelectedTarget(false);
          c.targetPosition.copy(CUSTOMER_WAYPOINTS.exitTarget);
          c.updateBadgeText(
            c.profile.name,
            'Çok Bekledim! Gidiyorum!',
            '#ef4444',
            0
          );
          this.recalculateQueueTargets();
          opts.onCustomerLost?.(c, linkedOrder);
          continue;
        }
      }

      // Tick reaction timer even before movement check
      if (c.state === 'RECEIVING_ORDER') {
        c.reactionTimer -= dt;
      }

      const reached = c.update(dt, elapsed);

      if (!reached) continue;

      switch (c.state) {
        case 'ENTERING': {
          c.state = 'WALKING_TO_COUNTER';
          const queueLabel = c.partnerName
            ? `${c.partnerName} ile Sırada`
            : 'Sırada...';
          c.updateBadgeText(c.profile.name, queueLabel, '#fbbf24', c.patienceRatio);
          this.recalculateQueueTargets();
          break;
        }
        case 'WALKING_TO_COUNTER': {
          c.state = 'WAITING_TO_ORDER';
          const menuLabel = c.partnerName
            ? `${c.partnerName} ile Menüyü İnceliyor`
            : 'Menüyü İnceliyor...';
          c.updateBadgeText(
            c.profile.name,
            menuLabel,
            '#fbbf24',
            c.patienceRatio
          );
          break;
        }
        case 'WAITING_TO_ORDER': {
          if (c.queueIndex === 0) {
            c.state = 'ORDERING';
            c.orderingTimer = 1.25;
            c.updateBadgeText(
              c.profile.name,
              'Sipariş Veriyor...',
              '#f59e0b',
              c.patienceRatio
            );
          }
          break;
        }
        case 'ORDERING': {
          c.orderingTimer -= dt;
          if (c.orderingTimer <= 0) {
            const newOrder = this.createOrderForCustomer(c, unlockedRecipes);
            c.state = 'ORDER_PLACED';
            this.recalculateQueueTargets();
            opts.onNewOrderPlaced?.(newOrder);
          }
          break;
        }
        case 'ORDER_PLACED': {
          c.state = 'WAITING_FOR_FOOD';
          break;
        }
        case 'RECEIVING_ORDER': {
          if (c.reactionTimer <= 0) {
            if (c.assignedSeat) {
              c.state = 'WALKING_TO_SEAT_APPROACH';
              c.targetPosition.set(
                c.assignedSeat.approachPosition.x,
                0,
                c.assignedSeat.approachPosition.z
              );
            } else {
              c.state = 'LEAVING';
              c.targetPosition.copy(CUSTOMER_WAYPOINTS.exitDoorInside);
            }
            this.recalculateQueueTargets();
          }
          break;
        }
        case 'WALKING_TO_SEAT_APPROACH': {
          if (c.assignedSeat) {
            c.state = 'WALKING_TO_SEAT';
            c.targetPosition.set(
              THREE.MathUtils.lerp(
                c.assignedSeat.approachPosition.x,
                c.assignedSeat.seatPosition.x,
                0.65
              ),
              0,
              THREE.MathUtils.lerp(
                c.assignedSeat.approachPosition.z,
                c.assignedSeat.seatPosition.z,
                0.65
              )
            );
          } else {
            c.state = 'LEAVING';
            c.targetPosition.copy(CUSTOMER_WAYPOINTS.exitDoorInside);
          }
          break;
        }
        case 'WALKING_TO_SEAT': {
          if (c.assignedSeat) {
            c.state = 'SITTING_DOWN';
            c.seatTransitionTimer = 0.78;
            c.targetPosition.set(
              c.assignedSeat.seatPosition.x,
              0,
              c.assignedSeat.seatPosition.z
            );
            c.placeMealOnAssignedSeatTable(this.scene);
            opts.onCustomerSeated?.(c, c.assignedSeat);
            c.updateBadgeText(
              c.profile.name,
              c.partnerName
                ? `${c.partnerName} ile Masada ★`
                : 'Afiyetle Yiyor ★',
              '#fbbf24',
              1.0
            );
          } else {
            c.state = 'LEAVING';
            c.targetPosition.copy(CUSTOMER_WAYPOINTS.exitDoorInside);
          }
          break;
        }
        case 'SITTING_DOWN': {
          c.seatTransitionTimer -= dt;
          if (c.seatTransitionTimer <= 0) {
            c.state = 'DINING';
            // Give paired customers a slightly longer initial window so the first partner waits for the second partner
            c.diningDuration = c.groupId
              ? 18.0
              : 14.0 + (c.seedIndex % 3) * 2.0;
            c.diningTimer = c.diningDuration;
          }
          break;
        }
        case 'DINING': {
          // Check if paired partner is also seated at the same table
          const partner = c.partnerCustomerId
            ? this.customers.find((p) => p.id === c.partnerCustomerId) || null
            : null;
          const partnerSeatedHere = Boolean(
            partner &&
              (partner.state === 'SITTING_DOWN' || partner.state === 'DINING') &&
              partner.assignedSeat &&
              c.assignedSeat &&
              partner.assignedSeat.tableId === c.assignedSeat.tableId
          );
          c.isDiningWithPartner = partnerSeatedHere;

          // If partner is still waiting for their food at the counter, keep at least 8s of dining time so they eat together
          if (
            partner &&
            (partner.state === 'WAITING_FOR_FOOD' ||
              partner.state === 'ORDER_PLACED' ||
              partner.state === 'RECEIVING_ORDER' ||
              partner.state === 'WALKING_TO_SEAT_APPROACH' ||
              partner.state === 'WALKING_TO_SEAT') &&
            c.diningTimer < 9.5
          ) {
            c.diningTimer = 9.5;
          } else {
            c.diningTimer -= dt;
          }

          const diningElapsed = Math.max(0, c.diningDuration - c.diningTimer);
          if (partnerSeatedHere && diningElapsed >= 5.2 && diningElapsed < 8.4) {
            c.updateBadgeText(
              c.profile.name,
              `${c.partnerName} ile Sohbet Ediyor 💬`,
              '#fbbf24',
              1.0
            );
          } else if (diningElapsed >= 5.2 && diningElapsed < 8.4 && c.orderedSoda) {
            c.updateBadgeText(
              c.profile.name,
              'İçeceğini Yudumluyor',
              '#38bdf8',
              1.0
            );
          } else if (diningElapsed >= 12.0) {
            c.updateBadgeText(
              c.profile.name,
              partnerSeatedHere
                ? `${c.partnerName} ile Çok Beğendi ★`
                : 'Çok Beğendi ★',
              '#4ade80',
              1.0
            );
          } else {
            c.updateBadgeText(
              c.profile.name,
              partnerSeatedHere
                ? `Afiyetle Yiyor · ${c.partnerName} ile`
                : 'Afiyetle Yiyor ★',
              '#fbbf24',
              1.0
            );
          }

          if (c.diningTimer <= 0) {
            c.isDiningWithPartner = false;
            c.cleanupActiveMealProps(this.scene);
            if (c.groupId && (!partner || partner.state === 'LEAVING' || partner.state === 'LEAVING_ANGRY')) {
              this.dining.releaseGroupReservation(c.groupId);
            }
            if (c.assignedSeat) {
              const updatedSeat = this.dining.finishDiningAtSeat(
                c.assignedSeat.id,
                true,
                c.orderedBurgerRecipe,
                c.orderedSoda
              );
              if (updatedSeat) {
                opts.onSeatBecameDirty?.(updatedSeat, c);
              }
            }
            c.state = 'STANDING_UP';
            c.seatTransitionTimer = 0.75;
            c.updateBadgeText(
              c.profile.name,
              'Elinize Sağlık! ★',
              '#4ade80',
              1.0
            );
          }
          break;
        }
        case 'STANDING_UP': {
          c.seatTransitionTimer -= dt;
          if (c.seatTransitionTimer <= 0) {
            c.state = 'STEPPING_OUT_OF_SEAT';
            if (c.assignedSeat) {
              c.targetPosition.set(
                c.assignedSeat.approachPosition.x,
                0,
                c.assignedSeat.approachPosition.z
              );
            } else {
              c.targetPosition.copy(CUSTOMER_WAYPOINTS.exitDoorInside);
            }
          }
          break;
        }
        case 'STEPPING_OUT_OF_SEAT': {
          c.assignedSeat = null;
          c.state = 'LEAVING';
          c.targetPosition.copy(CUSTOMER_WAYPOINTS.exitDoorInside);
          break;
        }
        case 'LEAVING':
        case 'LEAVING_ANGRY': {
          if (c.root.position.z < 6.5) {
            c.targetPosition.copy(CUSTOMER_WAYPOINTS.exitTarget);
          } else {
            c.cleanupActiveMealProps(this.scene);
            this.scene.remove(c.root);
            this.customers.splice(i, 1);
          }
          break;
        }
      }
    }
  }
}
