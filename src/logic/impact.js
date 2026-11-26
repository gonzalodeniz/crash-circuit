// Intensidad de los golpes y daño de un coche (RF-034, y RF-032 parcial). Lógica pura, sin Three.js ni
// DOM (RNF-05). Vale igual para los diez participantes y para cualquier modelo (RN-07).
//
// La intensidad de un golpe es su velocidad de impacto: lo deprisa que se acercaban el coche y lo que
// golpea, medida en la dirección del choque. La calculan `collisions.js` (límites y obstáculos) y
// `carContacts.js` (otro coche). Un golpe fuerte es un accidente grave: destruye el coche (RF-035, RF-036),
// que se queda parado donde ha chocado; el bloqueo posterior es de `destruction.js`.
//
// Un coche protegido tras reaparecer (`respawn.js`, RF-042) no se destruye: para él, un golpe fuerte
// cuenta como leve.
//
// El daño es solo visual: no lo lee la conducción, así que no cambia el rendimiento del coche.

/** Clases de golpe. Sus valores son también las claves de `CONFIG.impact` con las consecuencias. */
export const ImpactSeverity = Object.freeze({ LIGHT: 'light', STRONG: 'strong' });

/**
 * Clasifica un golpe por su velocidad de impacto.
 * @param {number} impactSpeed m/s en la dirección del choque
 * @param {object} params sección `impact` de CONFIG
 * @param {boolean} [isProtected] el coche que lo recibe está protegido: como mucho es leve (RF-042)
 * @returns {string|null} un valor de `ImpactSeverity`, o `null` si es un simple contacto sin golpe
 */
export function classifyImpact(impactSpeed, params, isProtected = false) {
  if (!(impactSpeed >= params.minSpeed)) return null;
  return !isProtected && impactSpeed >= params.strongSpeed ? ImpactSeverity.STRONG : ImpactSeverity.LIGHT;
}

/**
 * Movimiento de un coche tras un golpe, a partir del que le deja la respuesta física: si es fuerte se
 * queda parado. Anota además la mayor velocidad de impacto recibida (`impactSpeed`), que la carrera
 * convierte en daño y destrucción y pone a cero en cada paso.
 * @param {{speed: number, slideX?: number, slideZ?: number, impactSpeed?: number, protection?: object|null}} motion
 *   no se modifica; con `protection`, el coche está protegido y no se para
 * @returns {{speed: number, slideX: number, slideZ: number, impactSpeed: number}}
 */
export function applyImpact(motion, impactSpeed, params) {
  const stops = classifyImpact(impactSpeed, params, Boolean(motion.protection)) === ImpactSeverity.STRONG;
  return {
    speed: stops ? 0 : motion.speed,
    slideX: stops ? 0 : (motion.slideX ?? 0),
    slideZ: stops ? 0 : (motion.slideZ ?? 0),
    impactSpeed: Math.max(motion.impactSpeed ?? 0, impactSpeed),
  };
}

/**
 * Daño de un coche sin golpes.
 * - `level`: daño acumulado, de 0 a 1.
 * - `worst`: el golpe más grave recibido (`ImpactSeverity`), o `null`.
 * - `effect`: golpe cuya reacción (chispas, humo) se está viendo, o `null`; le quedan `effectTime`
 *   segundos de los `effectDuration` que dura.
 */
export function createDamage() {
  return Object.freeze({ level: 0, worst: null, effect: null, effectTime: 0, effectDuration: 0 });
}

/**
 * Avanza el daño `dt` segundos de simulación y le suma el golpe de este paso, si lo hay. Cada clase de
 * golpe suma `damage` sin pasar de su `maxDamage`, así que el daño está acotado y las rozaduras repetidas
 * nunca dejan el coche como un accidente grave. La reacción de un golpe leve no reinicia la que está en
 * curso (un roce continuo da ráfagas sucesivas); la de un golpe fuerte siempre empieza de nuevo.
 * @param {ReturnType<typeof createDamage>} damage no se modifica
 * @param {number} impactSpeed velocidad de impacto del paso (cero si no ha habido golpe)
 * @param {object} params sección `impact` de CONFIG
 * @param {boolean} [isProtected] el coche está protegido: el golpe suma como mucho el daño de uno leve
 * @returns {ReturnType<typeof createDamage>} el mismo objeto si no cambia nada
 */
export function stepDamage(damage, impactSpeed, dt, params, isProtected = false) {
  const severity = classifyImpact(impactSpeed, params, isProtected);
  if (severity === null && damage.effect === null) return damage;

  const effectTime = Math.max(0, damage.effectTime - dt);
  const running = effectTime > 0 ? damage.effect : null;
  let next = { ...damage, effect: running, effectTime: running ? effectTime : 0 };
  if (severity !== null) {
    const { damage: added, maxDamage, effectDuration } = params[severity];
    next.level = Math.max(damage.level, Math.min(damage.level + added, maxDamage));
    next.worst = damage.worst === ImpactSeverity.STRONG ? damage.worst : severity;
    if (severity === ImpactSeverity.STRONG || running === null) {
      next = { ...next, effect: severity, effectTime: effectDuration, effectDuration };
    }
  }
  return Object.freeze(next);
}
