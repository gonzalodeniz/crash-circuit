// Catálogo de modelos de coche (RF-002, RF-003). Lógica pura: no importa Three.js ni el DOM (RNF-05).
// Los modelos solo difieren en el aspecto; el rendimiento es el compartido de `CONFIG.carPerformance`.

/** Modelos del catálogo, en el orden en que se muestran. */
export function carModels(config) {
  return config.cars.models;
}

/** Modelo con ese identificador, o `undefined` si no existe. */
export function findCarModel(config, id) {
  return config.cars.models.find((model) => model.id === id);
}

/** Modelo con ese identificador; lanza un error si no existe. */
export function requireCarModel(config, id) {
  const model = findCarModel(config, id);
  if (!model) throw new Error(`Modelo de coche desconocido: ${id}`);
  return model;
}
