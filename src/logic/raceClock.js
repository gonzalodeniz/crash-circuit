// Cuenta atrás de salida y cronómetro de carrera (RF-020, RF-021, RF-045). Lógica pura (RNF-05):
// avanza solo con el paso de tiempo de la simulación, sin relojes del navegador, de modo que se
// puede probar sin navegador y congelar en la pausa (E7) con solo no avanzarla.

export const ClockPhase = Object.freeze({
  COUNTDOWN: 'COUNTDOWN', // cuenta atrás en curso: el cronómetro vale cero
  RUNNING: 'RUNNING', // señal de salida dada: el cronómetro acumula tiempo
});

/** Señal que se muestra al jugador. */
export const GO_SIGNAL = 'GO';

/**
 * Crea el reloj de una carrera, al comienzo de la cuenta atrás.
 * No modifica nada fuera de sí mismo.
 */
export function createRaceClock() {
  return {
    phase: ClockPhase.COUNTDOWN,
    countdownElapsed: 0, // s transcurridos de cuenta atrás
    raceTime: 0, // s transcurridos desde la señal de salida (cero hasta entonces)
  };
}

/**
 * Avanza el reloj `dt` segundos de simulación. No modifica el estado recibido.
 * Si la señal de salida cae dentro del paso, el sobrante cuenta ya como tiempo de carrera.
 * @param {ReturnType<typeof createRaceClock>} clock reloj actual
 * @param {number} dt segundos simulados (los negativos se ignoran)
 * @param {{steps: number, stepDuration: number}} countdown sección `race.countdown` de CONFIG
 */
export function stepRaceClock(clock, dt, countdown) {
  const step = Math.max(dt, 0);
  if (clock.phase === ClockPhase.RUNNING) {
    return { ...clock, raceTime: clock.raceTime + step };
  }
  const total = countdown.steps * countdown.stepDuration;
  const elapsed = clock.countdownElapsed + step;
  if (elapsed < total) return { ...clock, countdownElapsed: elapsed };
  return { phase: ClockPhase.RUNNING, countdownElapsed: total, raceTime: elapsed - total };
}

/**
 * Señal visible en este instante: el número de la cuenta atrás (3, 2, 1), `GO_SIGNAL` durante
 * `goDisplayDuration` tras la salida, o `null` si no hay nada que mostrar.
 * @param {ReturnType<typeof createRaceClock>} clock
 * @param {{steps: number, stepDuration: number, goDisplayDuration: number}} countdown
 */
export function countdownSignal(clock, countdown) {
  if (clock.phase === ClockPhase.COUNTDOWN) {
    const done = Math.floor(clock.countdownElapsed / countdown.stepDuration);
    return countdown.steps - done;
  }
  return clock.raceTime < countdown.goDisplayDuration ? GO_SIGNAL : null;
}

/**
 * Da formato al tiempo de carrera como `mm:ss.cc` (centésimas). Trunca, nunca redondea hacia arriba.
 * @param {number} seconds
 */
export function formatRaceTime(seconds) {
  const totalCentis = Math.floor(Math.max(seconds, 0) * 100 + 1e-9);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}.${String(centis).padStart(2, '0')}`;
}
