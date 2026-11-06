import test from 'node:test';
import assert from 'node:assert/strict';
import { CookingSystem } from './CookingSystem';
import { BurgerAssembly } from './BurgerAssembly';
import { EconomySystem, evaluateIndependentOrderStatuses } from './EconomySystem';
import { resolvePlayerMovement } from '../world/RestaurantLayout';
import { CustomerOrder, evaluateDayPhase, HeldItem } from '../core/GameConfig';
import { SaveManager } from '../core/SaveManager';
import {
  evaluateCustomerPose,
  FirstPersonHandAnimator,
  getSharedCustomerAnimationClips,
  computeCharacterHeadingYaw,
  shortestAngleDiff,
  stepCharacterYawShortestArc,
  computeCharacterForwardVector,
} from '../rendering/AnimationSystem';
import { SmartPlacementSystem } from './SmartPlacementSystem';
import { DiningTableSystem } from './DiningSystem';

test('CookingSystem transitions from raw -> cooked -> burnt and respects upgrade', () => {
  const grill = new CookingSystem(4, false);
  const slotIdx = grill.placeRawPatty();
  assert.equal(slotIdx, 0);
  assert.equal(grill.slots[0].state, 'cooking');

  // After 4 seconds on standard grill: still cooking
  grill.update(4);
  assert.equal(grill.slots[0].state, 'cooking');

  // At 8.5 seconds total: cooked
  const res1 = grill.update(4.5);
  assert.equal(grill.slots[0].state, 'cooked');
  assert.deepEqual(res1.newlyCooked, [0]);

  // At 18.5 seconds total: burnt
  const res2 = grill.update(10);
  assert.equal(grill.slots[0].state, 'burnt');
  assert.deepEqual(res2.newlyBurnt, [0]);

  // Upgraded grill cooks in 4.5s
  grill.isUpgraded = true;
  const slot2 = grill.placeRawPatty(1);
  assert.equal(slot2, 1);
  grill.update(4.6);
  assert.equal(grill.slots[1].state, 'cooked');
});

test('BurgerAssembly enforces valid layer order for Classic, Cheeseburger, and 7-layer Double Smash Burger', () => {
  const assembly = new BurgerAssembly();

  // Rejects starting with patty or cheese
  assert.equal(assembly.addIngredient('patty_cooked').canAdd, false);
  assert.equal(assembly.addIngredient('patty_raw').canAdd, false);

  // 1. Classic Burger: bun_bottom -> patty_cooked -> lettuce -> bun_top
  assert.equal(assembly.addIngredient('bun_bottom').canAdd, true);
  assert.equal(assembly.addIngredient('patty_cooked').canAdd, true);
  assert.equal(assembly.addIngredient('lettuce').canAdd, true);
  const finalStep = assembly.addIngredient('bun_top');
  assert.equal(finalStep.canAdd, true);
  assert.equal(finalStep.completedRecipe, 'classic_burger');
  assert.equal(assembly.getCompletedBurgerRecipe(), 'classic_burger');

  // 2. Cheeseburger sequence
  assembly.clear();
  assert.equal(assembly.addIngredient('bun_bottom').canAdd, true);
  assert.equal(assembly.addIngredient('patty_cooked').canAdd, true);
  assert.equal(assembly.addIngredient('cheese').canAdd, true);
  assert.equal(assembly.addIngredient('lettuce').canAdd, true);
  const cheeseFinish = assembly.addIngredient('bun_top');
  assert.equal(cheeseFinish.canAdd, true);
  assert.equal(cheeseFinish.completedRecipe, 'cheeseburger');
  assert.equal(assembly.getCompletedBurgerRecipe(), 'cheeseburger');

  // 3. Double Smash Burger (7 layers): bun_bottom -> patty_cooked -> cheese -> patty_cooked -> cheese -> lettuce -> bun_top
  assembly.clear();
  assert.equal(assembly.addIngredient('bun_bottom').canAdd, true);
  assert.equal(assembly.addIngredient('patty_cooked').canAdd, true);
  assert.equal(assembly.addIngredient('cheese').canAdd, true);
  assert.equal(assembly.addIngredient('patty_cooked').canAdd, true);
  assert.equal(assembly.addIngredient('cheese').canAdd, true);
  assert.equal(assembly.addIngredient('lettuce').canAdd, true);
  const smashFinish = assembly.addIngredient('bun_top');
  assert.equal(smashFinish.canAdd, true);
  assert.equal(smashFinish.completedRecipe, 'double_smash');
  assert.equal(assembly.getCompletedBurgerRecipe(), 'double_smash');
});

test('EconomySystem validates orders, calculates tips, tracks reputation, and applies all 3 upgrades', () => {
  const eco = new EconomySystem(1000);
  const order: CustomerOrder = {
    id: 'ord_1',
    customerId: 'cust_1',
    customerName: 'Emre',
    burger: 'double_smash',
    wantsSoda: true,
    totalPrice: 135,
    createdAt: 0,
    delivered: false,
    patience: 65,
    maxPatience: 72,
  };

  // Missing soda should fail
  const missingSoda = eco.validateAndDeliverOrder(order, {
    type: 'burger_double_smash',
    label: 'Hazır Double Smash Burger',
    hasSoda: false,
  });
  assert.equal(missingSoda.valid, false);
  assert.equal(eco.money, 1000);

  // Correct delivery with soda and high patience yields base price + tip + reputation gain
  const validDelivery = eco.validateAndDeliverOrder(order, {
    type: 'burger_double_smash',
    label: 'Hazır Double Smash Burger + İçecek',
    hasSoda: true,
  });
  assert.equal(validDelivery.valid, true);
  assert.ok(validDelivery.tip > 0);
  assert.equal(eco.money, 1000 + 135 + validDelivery.tip);
  assert.ok(eco.reputation > 50);

  // Second attempt on same order is blocked
  const duplicateDelivery = eco.validateAndDeliverOrder(order, {
    type: 'burger_double_smash',
    label: 'Hazır Double Smash Burger + İçecek',
    hasSoda: true,
  });
  assert.equal(duplicateDelivery.valid, false);

  // Customer lost reduces reputation by 8 and increments lostCustomers
  const repBeforeLoss = eco.reputation;
  eco.recordCustomerLost();
  assert.equal(eco.reputation, repBeforeLoss - 8);
  assert.equal(eco.dayStats.lostCustomers, 1);

  // Upgrades: Decor & Cold Storage
  assert.equal(eco.getMaxStockCapacity(), 25);
  const coldRes = eco.buyColdStorageUpgrade();
  assert.equal(coldRes.success, true);
  assert.equal(eco.coldStorageUpgraded, true);
  assert.equal(eco.getMaxStockCapacity(), 60);

  const decorRes = eco.buyDecorUpgrade();
  assert.equal(decorRes.success, true);
  assert.equal(eco.decorUpgraded, true);
});

test('2.2 Order Management: evaluateIndependentOrderStatuses preserves per-order preparing status across KDS switches, handles concurrent identical recipes, and blocks cancelled/wrong deliveries', () => {
  const order1: CustomerOrder = {
    id: 'ord_101',
    customerId: 'cust_101',
    customerName: 'Ahmet',
    burger: 'classic_burger',
    wantsSoda: false,
    totalPrice: 80,
    createdAt: 1,
    delivered: false,
    patience: 60,
    maxPatience: 72,
    status: 'waiting',
  };
  const order2: CustomerOrder = {
    id: 'ord_102',
    customerId: 'cust_102',
    customerName: 'Zeynep',
    burger: 'cheeseburger',
    wantsSoda: false,
    totalPrice: 95,
    createdAt: 2,
    delivered: false,
    patience: 65,
    maxPatience: 72,
    status: 'waiting',
  };
  const order3: CustomerOrder = {
    id: 'ord_103',
    customerId: 'cust_103',
    customerName: 'Can',
    burger: 'classic_burger',
    wantsSoda: false,
    totalPrice: 80,
    createdAt: 3,
    delivered: false,
    patience: 70,
    maxPatience: 72,
    status: 'waiting',
  };

  // 1. Kitchen prep starts while Order #1 ('ord_101') is selected -> 'ord_101' enters startedOrderIds
  const startedOrderIds = new Set<string>(['ord_101']);
  evaluateIndependentOrderStatuses(
    [order1, order2, order3],
    'ord_101',
    null,
    null,
    false,
    true,
    startedOrderIds
  );
  assert.equal(order1.status, 'preparing');
  assert.equal(order2.status, 'waiting');
  assert.equal(order3.status, 'waiting');

  // 2. Player switches KDS selection to Order #2 ('ord_102') WITHOUT starting prep on #2 yet:
  // Order #1 MUST remain 'preparing' and Order #2 MUST remain 'waiting'!
  const switchedSelected = evaluateIndependentOrderStatuses(
    [order1, order2, order3],
    'ord_102',
    null,
    null,
    false,
    true,
    startedOrderIds
  );
  assert.equal(switchedSelected, 'ord_102');
  assert.equal(order1.status, 'preparing');
  assert.equal(order2.status, 'waiting');
  assert.equal(order3.status, 'waiting');

  // 3. Two customers (Ahmet #1 and Can #3) ordered the exact same recipe ('classic_burger').
  // When ONE classic_burger is finished on the board and Order #3 is selected in KDS,
  // Order #3 becomes 'ready' while Order #1 stays 'preparing' (not 'ready')!
  const effectiveSelected2 = evaluateIndependentOrderStatuses(
    [order1, order2, order3],
    'ord_103',
    null,
    'classic_burger',
    false,
    true,
    startedOrderIds
  );
  assert.equal(effectiveSelected2, 'ord_103');
  assert.equal(order1.status, 'preparing');
  assert.equal(order2.status, 'waiting');
  assert.equal(order3.status, 'ready');

  // 4. Wrong recipe delivery to selected customer is rejected and does not mark order delivered
  const eco = new EconomySystem(500);
  const wrongRecipeAttempt = eco.validateAndDeliverOrder(order2, {
    type: 'burger_classic',
    label: 'Hazır Klasik Burger',
    hasSoda: false,
  });
  assert.equal(wrongRecipeAttempt.valid, false);
  assert.equal(order2.delivered, false);
  assert.equal(eco.money, 500);

  // 5. Cancelled orders cannot be delivered even if delivered flag is false
  const cancelledOrder: CustomerOrder = {
    ...order1,
    id: 'ord_cancelled',
    status: 'cancelled',
    delivered: false,
  };
  const cancelAttempt = eco.validateAndDeliverOrder(cancelledOrder, {
    type: 'burger_classic',
    label: 'Hazır Klasik Burger',
    hasSoda: false,
  });
  assert.equal(cancelAttempt.valid, false);
  assert.equal(eco.money, 500);
});

test('evaluateDayPhase and SaveManager.migrateSaveData handle v2 progression accurately', () => {
  assert.equal(evaluateDayPhase(350, 360), 'opening');
  assert.equal(evaluateDayPhase(260, 360), 'normal');
  assert.equal(evaluateDayPhase(150, 360), 'rush_hour');
  assert.equal(evaluateDayPhase(40, 360), 'closing');

  // Legacy v1 save on Day 2 migrates cleanly and unlocks double_smash
  const migrated = SaveManager.migrateSaveData({
    money: 450,
    day: 2,
    grillUpgraded: true,
  });
  assert.equal(migrated.money, 450);
  assert.equal(migrated.day, 2);
  assert.equal(migrated.reputation, 50);
  assert.equal(migrated.decorUpgraded, false);
  assert.equal(migrated.coldStorageUpgraded, false);
  assert.ok(migrated.unlockedRecipes.includes('double_smash'));
});

test('resolvePlayerMovement prevents walking through walls and counters', () => {
  // Try walking past outer wall (maxX is 6.6, radius 0.42 -> max allowed 6.18)
  const wallCheck = resolvePlayerMovement(6.0, 0, 7.5, 0);
  assert.equal(wallCheck.collided, true);
  assert.ok(wallCheck.x <= 6.6 - 0.42 + 1e-4);

  // Try walking into front counter (z between -0.95 and 0.05, x between -4.2 and 3.0)
  const counterCheck = resolvePlayerMovement(0, -1.5, 0, -0.5);
  assert.equal(counterCheck.collided, true);
  assert.ok(counterCheck.z <= -0.95 - 0.42 + 1e-4);
});

test('AnimationSystem evaluates distinct customer poses, per-customer seed offsets, and skeletal AnimationClips', () => {
  const idleQueueA = evaluateCustomerPose('idle_queue', 1.2, 0.5, 0, 0.2);
  const idleQueueB = evaluateCustomerPose('idle_queue', 1.2, 0.5, 0, 2.7);
  // Different seedOffset creates distinct natural posture desync
  assert.notEqual(idleQueueA.headRotY, idleQueueB.headRotY);

  const ordering = evaluateCustomerPose('ordering', 1.2, 0.25, 0, 1);
  const waitingFood = evaluateCustomerPose('idle_waiting_food', 2.0, 0.8, 0, 1);
  const impatient = evaluateCustomerPose('impatient_watch', 0.5, 0.5, 0, 0);
  const happy = evaluateCustomerPose('receiving_happy', 3.0, 0.2, 0, 1);
  const angry = evaluateCustomerPose('leaving_angry', 1.0, 0.5, 1.2, 0);

  // Ordering pose leans toward counter, raises right arm forward to gesture, and opens mouth
  assert.ok(ordering.torsoRotX > 0.05);
  assert.ok(ordering.rightArmRotX < -1.0);
  assert.ok(ordering.mouthScaleY > 1.05);

  // Impatient watch pose raises left forearm to check wristwatch and furrows eyebrows
  assert.ok(impatient.leftForeArmRotX < -1.0);
  assert.ok(impatient.browTilt > 0.15);

  // Angry leaving pose leans forward with furrowed brows
  assert.ok(angry.torsoRotX > 0.1);
  assert.ok(angry.browTilt > 0.2);

  // Waiting food and idle queue keep arms lower than ordering gesture
  assert.ok(idleQueueA.rightArmRotX > -0.3);
  assert.ok(waitingFood.leftArmRotX < -0.2);

  // Happy receiving pose raises both arms in celebration
  assert.ok(happy.leftArmRotX < -2.0);
  assert.ok(happy.rightArmRotX < -2.0);

  // Shared skeletal animation clips include multi-node tracks (Torso, Head, LeftArm, RightArm, LeftLeg, RightLeg)
  const clips = getSharedCustomerAnimationClips();
  assert.equal(clips.size, 13);
  const walkClip = clips.get('walk');
  assert.ok(walkClip);
  assert.ok(walkClip.tracks.length >= 6);

  // Seated dining poses bend hips/knees into a natural 90-degree seated posture
  const sitDownPose = evaluateCustomerPose('sit_down', 0.5, 0.8, 0, 0);
  const seatedEatPose = evaluateCustomerPose('seated_eat', 0.5, 0.8, 0, 0);
  const seatedDrinkPose = evaluateCustomerPose('seated_drink', 0.7, 0.8, 0, 0);
  const seatedPhonePose = evaluateCustomerPose('seated_phone', 1.0, 0.8, 0, 0);
  assert.ok(sitDownPose.leftLegRotX < -1.2);
  assert.ok(seatedEatPose.leftLegRotX < -1.3);
  assert.ok(seatedEatPose.rightArmRotX < -1.0);
  assert.ok(seatedDrinkPose.leftArmRotX < -0.5);
  assert.ok(seatedPhonePose.headRotX > 0.2);

  // First-person hand animator reaches forward during pickup/place and returns to rest after completion
  const hand = new FirstPersonHandAnimator();
  const restSample = hand.evaluate(0.016, 0, false);
  assert.equal(hand.isAnimating(), false);

  hand.triggerAction('pickup');
  assert.equal(hand.isAnimating(), true);
  const midPickup = hand.evaluate(0.12, 0, false);
  assert.ok(midPickup.posZ < restSample.posZ - 0.1);
  assert.ok(midPickup.scalePunch > 1.05);

  // Finish animation
  const endPickup = hand.evaluate(0.25, 0, false);
  assert.equal(hand.isAnimating(), false);
  assert.ok(Math.abs(endPickup.posZ - restSample.posZ) < 0.01);

  // 2.6 Cloth-wiping hand animation sweeps horizontally across the table and exposes activeAction = 'wipe'
  hand.triggerAction('wipe');
  assert.equal(hand.isAnimating(), true);
  assert.equal(hand.getActiveAction(), 'wipe');
  const midWipe = hand.evaluate(0.15, 0, false);
  assert.ok(midWipe.posZ < restSample.posZ - 0.1);
  hand.evaluate(0.5, 0, false);
  assert.equal(hand.isAnimating(), false);
  assert.equal(hand.getActiveAction(), null);
});

test('2.4 SmartPlacementSystem & Service Tray: validates surface bounds, collisions, rotation, tray burger+soda combination, and order delivery', () => {
  const placement = new SmartPlacementSystem();

  // 1. Place an empty service_tray onto main_service_counter (x: 0.35, z: -0.45)
  const emptyTray: HeldItem = {
    type: 'service_tray',
    label: 'Boş Servis Tepsisi',
    hasSoda: false,
  };
  const eval1 = placement.evaluate('main_service_counter', 0.35, -0.45, emptyTray);
  assert.equal(eval1.valid, true);
  assert.equal(eval1.y, 0.964);

  const placedRes1 = placement.placeOrCombine(eval1, emptyTray);
  assert.equal(placedRes1.success, true);
  assert.equal(placedRes1.mode, 'placed');
  assert.equal(placement.placedItems.length, 1);

  const trayRecordId = placedRes1.placedRecord!.id;

  // 2. Attempting to place a second service_tray at the exact same spot fails due to collision
  const evalOverlap = placement.evaluate('main_service_counter', 0.36, -0.45, emptyTray);
  assert.equal(evalOverlap.valid, false);

  // 3. Hovering near the placed service_tray while holding a completed burger snaps & combines into the tray!
  const classicBurger: HeldItem = {
    type: 'burger_classic',
    label: 'Hazır Klasik Burger',
    layers: ['bun_bottom', 'patty_cooked', 'lettuce', 'bun_top'],
  };
  const evalCombineBurger = placement.evaluate('main_service_counter', 0.35, -0.45, classicBurger);
  assert.equal(evalCombineBurger.valid, true);
  assert.equal(evalCombineBurger.combineTargetTrayId, trayRecordId);

  const combRes1 = placement.placeOrCombine(evalCombineBurger, classicBurger);
  assert.equal(combRes1.success, true);
  assert.equal(combRes1.mode, 'combined');
  assert.equal(placement.placedItems[0].item.burgerRecipe, 'classic_burger');
  assert.equal(placement.placedItems[0].item.hasSoda, false);

  // 4. Attempting to add a SECOND burger to the same tray is rejected
  const evalSecondBurger = placement.evaluate('main_service_counter', 0.35, -0.45, classicBurger);
  assert.equal(evalSecondBurger.valid, false);

  // 5. Hovering near the same placed service_tray while holding a soda_cup combines the drink into the tray!
  const sodaCup: HeldItem = {
    type: 'soda_cup',
    label: 'Gazlı İçecek',
  };
  const evalCombineSoda = placement.evaluate('main_service_counter', 0.35, -0.45, sodaCup);
  assert.equal(evalCombineSoda.valid, true);
  assert.equal(evalCombineSoda.combineTargetTrayId, trayRecordId);

  const combRes2 = placement.placeOrCombine(evalCombineSoda, sodaCup);
  assert.equal(combRes2.success, true);
  assert.equal(combRes2.mode, 'combined');
  assert.equal(placement.placedItems[0].item.burgerRecipe, 'classic_burger');
  assert.equal(placement.placedItems[0].item.hasSoda, true);

  // 6. Rotation increments by 45 degrees (PI / 4)
  const rot1 = placement.rotatePreview();
  assert.ok(Math.abs(rot1 - Math.PI / 4) < 1e-6);

  // 7. Pick up the loaded service_tray from the counter and deliver it to a customer who ordered Classic Burger + Soda
  const takenTray = placement.takeItem(trayRecordId);
  assert.ok(takenTray);
  assert.equal(placement.placedItems.length, 0);

  const eco = new EconomySystem(200);
  const orderWithSoda: CustomerOrder = {
    id: 'ord_tray_1',
    customerId: 'cust_tray_1',
    customerName: 'Selin',
    burger: 'classic_burger',
    wantsSoda: true,
    totalPrice: 80,
    createdAt: 0,
    delivered: false,
    patience: 68,
    maxPatience: 72,
  };

  const deliveryRes = eco.validateAndDeliverOrder(orderWithSoda, takenTray.item);
  assert.equal(deliveryRes.valid, true);
  assert.ok(eco.money > 280);
});

test('2.6 Multi-Stage Table Cleaning: picking up dirty_tray transitions seat to needs_wipe (not empty), and wiping with cloth opens the seat and awards +5$ once', () => {
  const dining = new DiningTableSystem();
  assert.equal(dining.seats.length, 4);
  assert.equal(dining.getDirtySeats().length, 0);

  // 1. First customer gets an empty seat at Table 1 ('seat_left_north')
  const seat1 = dining.findAvailableSeat();
  assert.ok(seat1);
  assert.equal(seat1.id, 'seat_left_north');
  dining.reserveSeat(seat1.id, 'cust_1');

  // 2. Second, third, and fourth customers fill the remaining seats
  const seat2 = dining.findAvailableSeat();
  assert.ok(seat2);
  assert.equal(seat2.id, 'seat_right_north');
  dining.reserveSeat(seat2.id, 'cust_2');

  const seat3 = dining.findAvailableSeat();
  assert.ok(seat3);
  dining.reserveSeat(seat3.id, 'cust_3');

  const seat4 = dining.findAvailableSeat();
  assert.ok(seat4);
  dining.reserveSeat(seat4.id, 'cust_4');

  // 3. Fifth customer arrives while all 4 seats are occupied -> returns null (takeaway fallback)
  assert.equal(dining.findAvailableSeat(), null);

  // 4. Customer 1 finishes dining -> seat transitions to 'dirty_tray'
  const dirtySeat1 = dining.finishDiningAtSeat(seat1.id, true, 'classic_burger', true);
  assert.ok(dirtySeat1);
  assert.equal(dirtySeat1.status, 'dirty_tray');
  assert.equal(dirtySeat1.occupiedByCustomerId, null);
  assert.ok(dirtySeat1.dirtyTrayItem);
  assert.equal(dirtySeat1.dirtyTrayItem.type, 'dirty_tray');
  assert.equal(dining.getDirtySeats().length, 1);
  assert.equal(dining.getTrayDirtySeats().length, 1);
  assert.equal(dining.getWipeNeededSeats().length, 0);

  // 5. Attempting to wipe BEFORE picking up the dirty tray is rejected
  const prematureWipe = dining.wipeSeatSurface(seat1.id);
  assert.equal(prematureWipe.success, false);
  assert.equal(prematureWipe.bonusMoney, 0);

  // 6. Stage 1: Player picks up the dirty tray from seat1 -> seat transitions to 'needs_wipe' (NOT 'empty' yet!)
  const pickupRes = dining.pickupDirtyTrayFromSeat(seat1.id);
  assert.equal(pickupRes.success, true);
  assert.ok(pickupRes.item);
  assert.equal(pickupRes.item.type, 'dirty_tray');
  assert.equal(dining.getSeatById(seat1.id)?.status, 'needs_wipe');
  assert.equal(dining.getDirtySeats().length, 1);
  assert.equal(dining.getTrayDirtySeats().length, 0);
  assert.equal(dining.getWipeNeededSeats().length, 1);

  // Because seat1 still needs wiping, findAvailableSeat() MUST STILL return null!
  assert.equal(dining.findAvailableSeat(), null);

  // 7. Stage 2: Player wipes the table surface with a cleaning cloth -> seat transitions to 'empty' and awards +5$ & +1 rep once!
  const wipeRes = dining.wipeSeatSurface(seat1.id);
  assert.equal(wipeRes.success, true);
  assert.equal(wipeRes.bonusMoney, 5);
  assert.equal(wipeRes.bonusReputation, 1);
  assert.equal(dining.getSeatById(seat1.id)?.status, 'empty');
  assert.equal(dining.getDirtySeats().length, 0);

  // Attempting to wipe an already-clean seat does not award duplicate bonus
  const duplicateWipe = dining.wipeSeatSurface(seat1.id);
  assert.equal(duplicateWipe.success, false);
  assert.equal(duplicateWipe.bonusMoney, 0);

  // Seat 1 is now open for a new diner!
  const reopenedSeat = dining.findAvailableSeat();
  assert.ok(reopenedSeat);
  assert.equal(reopenedSeat.id, seat1.id);
});

test('2.6 Paired Customer Groups: reserves both seats at the same booth table for 2-person groups and safely falls back to takeaway when no 2-seat table is free', () => {
  const dining = new DiningTableSystem();

  // 1. A 2-person group ('grp_1') arrives when both tables are empty -> reserves Table 1 ('dining_table_left') for both members
  const memberASeat = dining.reserveSeatForCustomer('cust_pair_1', 'grp_1', 0);
  assert.ok(memberASeat);
  assert.equal(memberASeat.tableId, 'dining_table_left');
  assert.equal(memberASeat.id, 'seat_left_north');

  // While Member B hasn't received their food yet, a solo customer ('cust_solo') arrives.
  // Because Table 1's second seat is held for 'grp_1', the solo customer is directed to Table 2 ('dining_table_right')!
  const soloSeat = dining.reserveSeatForCustomer('cust_solo', null, 0);
  assert.ok(soloSeat);
  assert.equal(soloSeat.tableId, 'dining_table_right');

  // Now Member B of 'grp_1' receives their food -> claims the paired seat opposite Member A at Table 1 ('seat_left_south')!
  const memberBSeat = dining.reserveSeatForCustomer('cust_pair_2', 'grp_1', 0);
  assert.ok(memberBSeat);
  assert.equal(memberBSeat.tableId, 'dining_table_left');
  assert.equal(memberBSeat.id, 'seat_left_south');

  // 2. Now Table 1 has 2 diners and Table 2 has 1 diner ('cust_solo').
  // If a new 2-person group ('grp_2') arrives now, neither table has 2 clean seats available -> both safely fall back to takeaway (null)!
  const grp2SeatA = dining.reserveSeatForCustomer('cust_pair_3', 'grp_2', 0);
  assert.equal(grp2SeatA, null);

  // 3. Releasing a group reservation frees held seats immediately so a solo customer can claim the second seat once other tables have 1 diner
  const dining2 = new DiningTableSystem();
  const g1 = dining2.reserveSeatForCustomer('c1', 'grp_cancel', 0);
  assert.ok(g1);
  dining2.releaseGroupReservation('grp_cancel');
  const soloRight = dining2.reserveSeatForCustomer('c_solo_1', null, 0);
  assert.ok(soloRight);
  assert.equal(soloRight.tableId, 'dining_table_right');
  const soloOnSameTable = dining2.reserveSeatForCustomer('c_solo_2', null, 0);
  assert.ok(soloOnSameTable);
  assert.equal(soloOnSameTable.tableId, 'dining_table_left');
  assert.equal(soloOnSameTable.id, 'seat_left_south');
});

test('2.7 Progressive Hold-to-Wipe Table Cleaning: advanceWipeSeatSurface tracks partial wipeProgress, preserves progress on early release, and awards +5$ strictly once at 100%', () => {
  const dining = new DiningTableSystem();
  const seat = dining.reserveSeat('seat_left_north', 'cust_wipe_1');
  assert.ok(seat);

  dining.finishDiningAtSeat(seat.id, true, 'cheeseburger', true);
  dining.pickupDirtyTrayFromSeat(seat.id);
  assert.equal(dining.getSeatById(seat.id)?.status, 'needs_wipe');
  assert.equal(dining.getSeatById(seat.id)?.wipeProgress, 0);

  // Step 1: Partial wipe (35%) — seat remains 'needs_wipe', no bonus yet
  const step1 = dining.advanceWipeSeatSurface(seat.id, 0.35);
  assert.equal(step1.success, true);
  assert.equal(step1.completed, false);
  assert.ok(Math.abs(step1.wipeProgress - 0.35) < 1e-5);
  assert.equal(step1.bonusMoney, 0);
  assert.equal(dining.getSeatById(seat.id)?.status, 'needs_wipe');

  // Step 2: Another partial wipe (+40% -> 75%) — progress is preserved and accumulated
  const step2 = dining.advanceWipeSeatSurface(seat.id, 0.40);
  assert.equal(step2.success, true);
  assert.equal(step2.completed, false);
  assert.ok(Math.abs(step2.wipeProgress - 0.75) < 1e-5);
  assert.equal(step2.bonusMoney, 0);
  assert.equal(dining.getSeatById(seat.id)?.status, 'needs_wipe');

  // Step 3: Final wipe (+30% -> 100%) — completes cleaning, opens seat, and awards +5$ & +1 rep once!
  const step3 = dining.advanceWipeSeatSurface(seat.id, 0.30);
  assert.equal(step3.success, true);
  assert.equal(step3.completed, true);
  assert.equal(step3.wipeProgress, 1);
  assert.equal(step3.bonusMoney, 5);
  assert.equal(step3.bonusReputation, 1);
  assert.equal(dining.getSeatById(seat.id)?.status, 'empty');
  assert.equal(dining.getSeatById(seat.id)?.wipeProgress, 0);

  // Step 4: Subsequent wipe calls on the clean seat do not award duplicate bonuses
  const step4 = dining.advanceWipeSeatSurface(seat.id, 0.5);
  assert.equal(step4.success, false);
  assert.equal(step4.bonusMoney, 0);
});

test('3.0 Character & Pedestrian Orientation Standard: computeCharacterHeadingYaw, computeCharacterForwardVector, and stepCharacterYawShortestArc align local +Z forward axis in all 5 directions (+X, -X, +Z, -Z, Diagonal) without ±π spin bugs', () => {
  // 1. Verify exact forward vector alignment across all 5 required walking directions:
  // Right (+X), Left (-X), Forward (+Z), Backward (-Z), and 4 Diagonals
  const movementVectors = [
    { name: 'Right (+X)', vx: 1.4, vz: 0 },
    { name: 'Left (-X)', vx: -1.4, vz: 0 },
    { name: 'Forward (+Z)', vx: 0, vz: 1.4 },
    { name: 'Backward (-Z)', vx: 0, vz: -1.4 },
    { name: 'Diagonal NE (+X, +Z)', vx: 1.0, vz: 1.0 },
    { name: 'Diagonal NW (-X, +Z)', vx: -1.0, vz: 1.0 },
    { name: 'Diagonal SE (+X, -Z)', vx: 1.0, vz: -1.0 },
    { name: 'Diagonal SW (-X, -Z)', vx: -1.0, vz: -1.0 },
  ];

  for (const dir of movementVectors) {
    const yaw = computeCharacterHeadingYaw(dir.vx, dir.vz, 0);
    const fwd = computeCharacterForwardVector(yaw);
    const len = Math.hypot(dir.vx, dir.vz);
    const nx = dir.vx / len;
    const nz = dir.vz / len;
    const dot = fwd.x * nx + fwd.z * nz;
    assert.ok(
      dot > 0.99999,
      `Expected character forward vector for ${dir.name} to align with velocity (dot=${dot})`
    );
  }

  // 2. Verify shortestAngleDiff across the ±π (-Z) discontinuity
  // Turning from +3.10 rad (just East of -Z) to -3.10 rad (just West of -Z) is a small +0.083 rad turn across π,
  // NOT a -6.20 rad spin around 0!
  const diffAcrossPi = shortestAngleDiff(3.1, -3.1);
  assert.ok(
    diffAcrossPi > 0 && diffAcrossPi < 0.09,
    `Expected small positive shortest angle across π, got ${diffAcrossPi}`
  );

  // 3. Verify stepCharacterYawShortestArc smoothly crosses ±π without ever swinging through 0 (+Z)
  let currentYaw = 3.1;
  const targetYaw = -3.1;
  for (let i = 0; i < 10; i++) {
    currentYaw = stepCharacterYawShortestArc(currentYaw, targetYaw, 0.05, 10);
    const fwd = computeCharacterForwardVector(currentYaw);
    // Throughout the turn near -Z, forward Z must remain strongly negative (< -0.98)
    assert.ok(
      fwd.z < -0.98,
      `Character spun toward +Z during ±π turn! fwd.z=${fwd.z} at step ${i}`
    );
  }
  assert.ok(Math.abs(shortestAngleDiff(currentYaw, targetYaw)) < 1e-3);
});







