// Fuente de aleatoriedad inyectable (RF-029). Lógica pura (RNF-05).
// Una fuente es una función sin argumentos que devuelve un número en [0, 1), como `Math.random`.
// Quien necesita azar la recibe por parámetro; las pruebas le pasan una fuente con semilla para que
// el resultado sea reproducible.

/**
 * Crea una fuente de números pseudoaleatorios reproducible (mulberry32): la misma semilla da siempre
 * la misma secuencia.
 * @param {number} seed entero cualquiera
 * @returns {() => number} función que devuelve números en [0, 1)
 */
export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
