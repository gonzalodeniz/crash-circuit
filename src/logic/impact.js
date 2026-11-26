// Intensidad de los golpes y daño de un coche (RF-034, y RF-032 parcial). Lógica pura, sin Three.js ni
// DOM (RNF-05). Vale igual para los diez participantes y para cualquier modelo (RN-07).
//
// La intensidad de un golpe es su velocidad de impacto: lo deprisa que se acercaban el coche y lo que
// golpea, medida en la dirección del choque. La calculan `collisions.js` (límites y obstáculos) y
// `carContacts.js` (otro coche). Un golpe fuerte es un accidente grave: además de la respuesta de siempre,
// el coche pierde casi toda su velocidad. En E4 ningún golpe destruye (la destrucción llega en E5 con el
// mismo umbral).
//
// El daño es solo visual: no lo lee la conducción, así que no cambia el rendimiento del coche.

/** Clases de golpe. Sus valores son también las claves de `CONFIG.impact` con las consecuencias. */
export const ImpactSeverity = Object.freeze({ LIGHT: 'light', STRONG: 'strong' });

/**
 * Clasifica un golpe por su velocidad de impacto.
 * @param {number} impactSpeed m/s en la dirección del choque
 * @param {object} params sección `impact` de CONFIG
 * @returns {string|null} un valor de `ImpactSeverity`, o `null` si es un simple contacto sin golpe
 */
export function classifyImpact(impactSpeed, params) {
  if (!(impactSpeed >= params.minSpeed)) return null;
  return impactSpeed >= params.strongSpeed ? ImpactSeverity.STRONG : ImpactSeverity.LIGHT;
}

/**
 * Movimiento de un coche tras un golpe, a partir del que le deja la respuesta física: si es fuerte solo
 * conserva la fracción `strong.speedKeep`. Anota además la mayor velocidad de impacto recibida
 * (`impactSpeed`), que la carrera convierte en daño y pone a cero en cada paso.
 * @param {{speed: number, slideX?: number, slideZ?: number, impactSpeed?: number}} motion no se modifica
 * @returns {{speed: number, slideX: number, slideZ: number, impactSpeed: number}}
 */
export function applyImpact(motion, impactSpeed, params) {
  const keep = classifyImpact(impactSpeed, params) === ImpactSeverity.STRONG ? params.strong.speedKeep : 1;
  return {
    speed: motion.speed * keep,
    slideX: (motion.slideX ?? 0) * keep,
    slideZ: (motion.slideZ ?? 0) * keep,
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
 * @returns {ReturnType<typeof createDamage>} el mismo objeto si no cambia nada
 */
export function stepDamage(damage, impactSpeed, dt, params) {
  const severity = classifyImpact(impactSpeed, params);
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
