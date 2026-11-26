// Modelo de conducción arcade (RF-010, RF-011). Lógica pura: recibe entradas y un paso de
// tiempo y devuelve el nuevo estado del coche, sin Three.js ni DOM (RNF-05).
// Convención del trazado: avance = (sin h, cos h); girar a la izquierda aumenta el rumbo.

/**
 * Estado dinámico de un coche.
 * @param {{x: number, z: number, heading: number}} pose posición y rumbo iniciales
 */
export function createCarState(pose) {
  return {
    x: pose.x,
    z: pose.z,
    heading: pose.heading,
    speed: 0, // m/s con signo: negativo = marcha atrás
    steer: 0, // dirección suavizada, de -1 (derecha) a 1 (izquierda)
    slideX: 0, // m/s de deslizamiento que deja un golpe de otro coche (véase `carContacts.js`)
    slideZ: 0,
    impactSpeed: 0, // m/s: mayor velocidad de impacto de los golpes aún sin contar como daño (`impact.js`)
    brakeHeld: false, // el freno estaba pulsado en la actualización anterior
    reverseAllowed: false, // este pulso del freno puede dar marcha atrás (empezó con el coche parado)
  };
}

/**
 * Traduce las teclas pulsadas a las entradas de conducción.
 * @param {Iterable<string>} pressedKeys códigos de las teclas pulsadas
 * @param {object} controls sección `controls` de CONFIG
 * @returns {{accelerate: boolean, brake: boolean, left: boolean, right: boolean}}
 */
export function inputFromKeys(pressedKeys, controls) {
  const pressed = new Set(pressedKeys);
  return {
    accelerate: pressed.has(controls.accelerate),
    brake: pressed.has(controls.brakeReverse),
    left: pressed.has(controls.steerLeft),
    right: pressed.has(controls.steerRight),
  };
}

function approach(value, target, maxDelta) {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

/**
 * Fuera de la calzada (RF-013): quien supera la velocidad máxima de esa superficie la pierde poco a poco,
 * al menos a `surface.deceleration`, sin saltos (si el freno la reduce más deprisa, manda el freno).
 * Quien está por debajo no puede superarla.
 */
function limitSpeed(speed, previousSpeed, step, params, surface) {
  const limit = (speed < 0 ? params.maxReverseSpeed : params.maxSpeed) * surface.maxSpeedFactor;
  if (Math.abs(speed) <= limit) return speed;
  const slowed = Math.min(Math.abs(speed), Math.abs(previousSpeed) - surface.deceleration * step);
  return Math.sign(speed) * Math.max(limit, slowed);
}

/**
 * Avanza el coche un paso de tiempo. No modifica el estado recibido.
 * Si se pulsan a la vez acelerar y frenar, gana el freno.
 * @param {ReturnType<typeof createCarState>} state estado actual
 * @param {{accelerate: boolean, brake: boolean, left: boolean, right: boolean}} input entradas
 * @param {number} dt segundos desde la actualización anterior (se limita a `params.maxStep`)
 * @param {object} params sección `carPerformance` de CONFIG
 * @param {{maxSpeedFactor: number, accelerationFactor: number, deceleration: number}|null} [surface]
 *   penalización de la superficie (sección `offRoad` de CONFIG) si el coche va fuera de la calzada;
 *   `null` sobre el asfalto
 */
export function stepCar(state, input, dt, params, surface = null) {
  const step = Math.min(Math.max(dt, 0), params.maxStep);
  const next = { ...state };
  if (step === 0) return next;

  // La marcha atrás solo se activa si el freno se pulsa con el coche parado.
  if (input.brake && !state.brakeHeld) next.reverseAllowed = state.speed <= params.stopSpeedEpsilon;
  if (!input.brake) next.reverseAllowed = false;
  next.brakeHeld = input.brake;

  // Velocidad longitudinal.
  const traction = surface?.accelerationFactor ?? 1;
  let speed = state.speed;
  if (input.brake) {
    // Un golpe de otro coche puede dejarlo retrocediendo más deprisa que la marcha atrás: el freno no
    // cambia esa velocidad de golpe, se pierde poco a poco.
    if (speed > 0) {
      speed = Math.max(0, speed - params.brakeDeceleration * step);
    } else if (!next.reverseAllowed) {
      speed = Math.min(0, speed + params.brakeDeceleration * step);
    } else if (speed < -params.maxReverseSpeed) {
      speed = Math.min(-params.maxReverseSpeed, speed + params.coastDeceleration * step);
    } else {
      speed = Math.max(-params.maxReverseSpeed, speed - params.reverseAcceleration * traction * step);
    }
  } else if (input.accelerate) {
    // Si el coche va marcha atrás, primero se detiene con la fuerza del freno.
    const rate = speed < 0 ? params.brakeDeceleration : params.acceleration * traction;
    speed = Math.min(params.maxSpeed, speed + rate * step);
  } else {
    speed = approach(speed, 0, params.coastDeceleration * step);
  }
  if (surface) speed = limitSpeed(speed, state.speed, step, params, surface);
  next.speed = speed;

  // Dirección: el volante tarda un poco en responder y el giro depende de la velocidad.
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  next.steer = approach(state.steer, steerTarget, params.steerResponse * step);
  const grip = Math.min(1, Math.abs(speed) / params.fullSteerSpeed);
  const speedLoss = 1 - params.highSpeedSteerLoss * Math.min(1, Math.abs(speed) / params.maxSpeed);
  const direction = speed < 0 ? -1 : 1;
  next.heading = state.heading + next.steer * params.steerRate * grip * speedLoss * direction * step;

  // Desplazamiento con el rumbo ya actualizado.
  next.x = state.x + Math.sin(next.heading) * speed * step;
  next.z = state.z + Math.cos(next.heading) * speed * step;
  return next;
}
