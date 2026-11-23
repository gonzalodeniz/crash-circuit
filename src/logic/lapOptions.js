// Opciones de vueltas de la carrera (RF-006): exactamente las de `race.lapOptions`. Lógica pura (RNF-05).

/** Números de vueltas que se pueden elegir, en el orden en que se muestran. */
export function lapOptions(config) {
  return config.race.lapOptions;
}

/** El número de vueltas si es una de las opciones permitidas; si no, lanza un error. */
export function requireLapOption(config, laps) {
  if (!lapOptions(config).includes(laps)) {
    throw new Error(`Número de vueltas no permitido: ${laps}`);
  }
  return laps;
}
