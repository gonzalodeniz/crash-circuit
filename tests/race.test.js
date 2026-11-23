import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { ParticipantStatus, createRace } from '../src/logic/race.js';
import { GameState } from '../src/logic/gameState.js';
import { computeChaseCamera } from '../src/logic/chaseCamera.js';
import { forwardOf, gridSlot, isOnRoad } from '../src/logic/track.js';

test('el estado de participante es propio y no se mezcla con los estados del juego', () => {
  assert.ok(Object.isFrozen(ParticipantStatus));
  assert.deepEqual(Object.keys(ParticipantStatus), ['PARRILLA', 'EN_CARRERA']);
  assert.equal(createRace(CONFIG).player.status, ParticipantStatus.PARRILLA);
  assert.equal(Object.keys(GameState).length, 7);
  assert.ok(!('DESTRUIDO' in GameState));
});

test('en E1 la carrera tiene solo al jugador, colocado en la parrilla', () => {
  const race = createRace(CONFIG);
  assert.equal(race.participants.length, 1);
  assert.equal(race.player.isPlayer, true);
  const slot = gridSlot(race.track, CONFIG.grid, 0);
  assert.deepEqual([race.player.x, race.player.z, race.player.heading], [slot.x, slot.z, slot.heading]);
  assert.ok(isOnRoad(race.track, race.player.x, race.player.z, CONFIG.race.car.width / 2));
});

test('la lista de participantes admite hasta diez, con identificadores únicos', () => {
  const entries = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isPlayer: i === 0 }));
  const race = createRace(CONFIG, entries);
  assert.equal(race.participants.length, 10);
  assert.deepEqual(race.participants.map((p) => p.gridIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.throws(() => createRace(CONFIG, [...entries, { id: 'extra', name: 'Extra' }]), /1 a 10/);
  assert.throws(() => createRace(CONFIG, [entries[0], { ...entries[1], id: 'p0' }]), /únicos/);
  assert.throws(() => createRace(CONFIG, [{ id: 'a', name: 'A' }]), /jugador/);
});

test('la cámara de seguimiento queda detrás del coche, elevada y mirando hacia delante', () => {
  const pose = { x: 10, z: -20, heading: 0.7 };
  const { position, target } = computeChaseCamera(pose, CONFIG.render.chaseCamera);
  const forward = forwardOf(pose.heading);
  const behind = (position[0] - pose.x) * forward.x + (position[2] - pose.z) * forward.z;
  const ahead = (target[0] - pose.x) * forward.x + (target[2] - pose.z) * forward.z;
  assert.ok(Math.abs(behind + CONFIG.render.chaseCamera.distance) < 1e-9);
  assert.ok(Math.abs(ahead - CONFIG.render.chaseCamera.lookAhead) < 1e-9);
  assert.ok(position[1] > target[1]);
  // Sin desplazamiento lateral: el coche queda centrado en la vista.
  const lateral = (position[0] - pose.x) * forward.z - (position[2] - pose.z) * forward.x;
  assert.ok(Math.abs(lateral) < 1e-9);
});
