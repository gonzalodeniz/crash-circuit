import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { createCarState, inputFromKeys, stepCar } from '../src/logic/driving.js';
import { createRace } from '../src/logic/race.js';

const P = CONFIG.carPerformance;
const DT = 1 / 60;
const NONE = { accelerate: false, brake: false, left: false, right: false };
const GAS = { ...NONE, accelerate: true };
const BRAKE = { ...NONE, brake: true };

function run(state, input, seconds, dt = DT) {
  let s = state;
  for (let t = 0; t < seconds; t += dt) s = stepCar(s, input, dt, P);
  return s;
}

const start = () => createCarState({ x: 0, z: 0, heading: 0 });
// Coche lanzado a una velocidad concreta, sin pedales pulsados.
const moving = (speed) => ({ ...start(), speed });

test('con acelerador la velocidad aumenta hasta el máximo y no lo supera', () => {
  let s = start();
  let previous = 0;
  for (let i = 0; i < 60 * 3; i++) {
    s = stepCar(s, GAS, DT, P);
    assert.ok(s.speed >= previous);
    assert.ok(s.speed <= P.maxSpeed);
    previous = s.speed;
  }
  assert.ok(previous > 0);
  s = run(s, GAS, 30);
  assert.equal(s.speed, P.maxSpeed);
});

test('sin acelerador la velocidad disminuye hasta detenerse', () => {
  let s = moving(30);
  s = stepCar(s, NONE, DT, P);
  assert.ok(s.speed < 30);
  s = run(s, NONE, 30);
  assert.equal(s.speed, 0);
});

test('el freno detiene antes que soltar el acelerador', () => {
  const stopTime = (input) => {
    let s = moving(30);
    let t = 0;
    while (s.speed > 0 && t < 60) {
      s = stepCar(s, input, DT, P);
      t += DT;
    }
    return t;
  };
  assert.ok(stopTime(BRAKE) < stopTime(NONE));
});

test('frenar en marcha no da marcha atrás aunque se mantenga el freno', () => {
  let s = run(moving(30), BRAKE, 20);
  assert.equal(s.speed, 0);
  assert.ok(s.z >= 0);
});

test('la marcha atrás solo se activa al pulsar el freno desde parado', () => {
  let s = run(moving(30), BRAKE, 20); // frenada hasta parar sin soltar
  assert.equal(s.speed, 0);
  s = run(s, NONE, 0.1); // se suelta el freno
  const zBefore = s.z;
  s = run(s, BRAKE, 1); // se vuelve a pulsar con el coche parado
  assert.ok(s.speed < 0);
  assert.ok(s.z < zBefore); // retrocede (el rumbo 0 avanza hacia +z)
  s = run(s, BRAKE, 20);
  assert.equal(s.speed, -P.maxReverseSpeed);
});

test('con el coche en marcha un pulso nuevo del freno tampoco da marcha atrás', () => {
  let s = moving(30);
  s = run(s, BRAKE, 0.2);
  s = run(s, NONE, 0.05);
  s = run(s, BRAKE, 20);
  assert.equal(s.speed, 0);
});

test('retrocediendo más deprisa que la marcha atrás (por un golpe), el freno no cambia la velocidad de golpe', () => {
  const knocked = -2 * P.maxReverseSpeed;
  // Pulso nuevo (hay marcha atrás): el exceso se pierde como al soltar el acelerador, hasta el máximo.
  let car = moving(knocked);
  car = stepCar(car, BRAKE, DT, P);
  assert.ok(Math.abs(car.speed - (knocked + P.coastDeceleration * DT)) < 1e-9, `${car.speed}`);
  for (let i = 0; i < 600; i++) car = stepCar(car, BRAKE, DT, P);
  assert.equal(car.speed, -P.maxReverseSpeed);

  // Freno ya pulsado desde antes (sin marcha atrás): frena hasta pararse, sin saltos.
  car = { ...moving(knocked), brakeHeld: true, reverseAllowed: false };
  car = stepCar(car, BRAKE, DT, P);
  assert.ok(Math.abs(car.speed - (knocked + P.brakeDeceleration * DT)) < 1e-9, `${car.speed}`);
  for (let i = 0; i < 120; i++) car = stepCar(car, BRAKE, DT, P);
  assert.equal(car.speed, 0);
});

test('acelerar en marcha atrás primero detiene el coche y luego avanza', () => {
  let s = { ...moving(-8), brakeHeld: false };
  s = stepCar(s, GAS, DT, P);
  assert.ok(s.speed > -8);
  s = run(s, GAS, 10);
  assert.ok(s.speed > 0);
});

test('el giro cambia la orientación: izquierda aumenta el rumbo, derecha lo reduce', () => {
  const left = run(moving(20), { ...NONE, left: true }, 1);
  const right = run(moving(20), { ...NONE, right: true }, 1);
  assert.ok(left.heading > 0);
  assert.ok(right.heading < 0);
  // El coche gira hacia el lado pulsado: a la izquierda (rumbo 0 = +z) acaba en +x.
  assert.ok(left.x > 0);
  assert.ok(right.x < 0);
});

test('parado el coche no gira y la dirección se suaviza', () => {
  const stopped = run(start(), { ...NONE, left: true }, 2);
  assert.equal(stopped.heading, 0);
  const one = stepCar(moving(20), { ...NONE, left: true }, DT, P);
  assert.ok(one.steer > 0 && one.steer < 1);
});

test('en marcha atrás el giro se invierte', () => {
  const s = run({ ...moving(-8), reverseAllowed: true, brakeHeld: true }, { ...BRAKE, left: true }, 1);
  assert.ok(s.heading < 0);
});

test('el movimiento sigue el rumbo del coche', () => {
  const s = run({ ...start(), heading: Math.PI / 2, speed: 10 }, GAS, 1);
  assert.ok(s.x > 5);
  assert.ok(Math.abs(s.z) < 1e-9);
});

test('con el mismo paso de tiempo el resultado es determinista y no muta el estado', () => {
  const inputs = [GAS, { ...GAS, left: true }, BRAKE, NONE, { ...GAS, right: true }];
  const simulate = () => {
    let s = start();
    for (let i = 0; i < 300; i++) s = stepCar(s, inputs[i % inputs.length], DT, P);
    return s;
  };
  assert.deepEqual(simulate(), simulate());
  const original = moving(10);
  const copy = { ...original };
  stepCar(original, GAS, DT, P);
  assert.deepEqual(original, copy);
});

test('el paso de tiempo se limita para evitar saltos', () => {
  const big = stepCar(start(), GAS, 5, P);
  const limited = stepCar(start(), GAS, P.maxStep, P);
  assert.deepEqual(big, limited);
  assert.deepEqual(stepCar(start(), GAS, -1, P), start());
});

test('inputFromKeys traduce las flechas de CONFIG.controls', () => {
  assert.deepEqual(inputFromKeys(['ArrowUp', 'ArrowLeft'], CONFIG.controls), {
    accelerate: true,
    brake: false,
    left: true,
    right: false,
  });
  assert.deepEqual(inputFromKeys([], CONFIG.controls), NONE);
  assert.deepEqual(inputFromKeys(new Set(['ArrowDown', 'ArrowRight', 'KeyA']), CONFIG.controls), {
    accelerate: false,
    brake: true,
    left: false,
    right: true,
  });
});

test('el rendimiento del coche está en la configuración compartida', () => {
  for (const key of ['maxSpeed', 'acceleration', 'brakeDeceleration', 'coastDeceleration', 'steerRate', 'maxStep']) {
    assert.ok(typeof CONFIG.carPerformance[key] === 'number' && CONFIG.carPerformance[key] > 0, key);
  }
  assert.ok(P.brakeDeceleration > P.coastDeceleration);
});

test('los participantes de la carrera empiezan parados', () => {
  const race = createRace(CONFIG);
  assert.equal(race.player.speed, 0);
});
