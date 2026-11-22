# Manual de usuario

Este manual explica cómo jugar a Crash Circuit. Se ampliará a medida que se terminen las entregas.

## Menú principal

Al abrir el juego ves el título «Crash Circuit» y el botón «Empezar». El botón ya está seleccionado al cargar.

- Con el ratón: haz clic en «Empezar».
- Con el teclado: pulsa Intro o Espacio.

Al empezar, el menú desaparece y ves un circuito cerrado provisional con tu coche en la parrilla de salida, visto desde una cámara situada detrás. Enseguida empieza la cuenta atrás (ver «Salida y cronómetro»). La escena se adapta si cambias el tamaño de la ventana. Cuando termines la carrera podrás volver al menú desde la pantalla de resultados (ver «Fin de carrera y resultados»).

## Controles

Se juega solo con las flechas del teclado. Mientras estás en la carrera, las flechas no mueven la página ni hacen nada más en el navegador.

| Flecha | Qué hace |
|---|---|
| Arriba | Acelera. |
| Abajo | Frena. Si el coche está parado, da marcha atrás. |
| Izquierda | Gira a la izquierda. |
| Derecha | Gira a la derecha. |

Cómo se conduce:

- La conducción es arcade: el coche acelera hasta una velocidad máxima y no la supera.
- Si sueltas el acelerador, el coche va perdiendo velocidad poco a poco. Frenar lo detiene antes.
- El coche solo gira cuando se mueve. A mucha velocidad gira un poco menos.
- La marcha atrás solo se activa si pulsas abajo con el coche parado. Si frenas en marcha y mantienes la flecha, el coche se queda parado: suelta y vuelve a pulsar para ir marcha atrás.
- Si pulsas arriba y abajo a la vez, gana el freno.
- La cámara acompaña al coche y se mantiene detrás al girar.

No puedes conducir hasta la señal de salida. Por ahora no hay penalización por salirte de la pista ni choques. Los valores de conducción (velocidad máxima, aceleración, giro) son iniciales y pueden cambiar tras probarlos.

## Salida y cronómetro

Al pulsar «Empezar», el coche espera en la parrilla y aparece en pantalla una cuenta atrás: 3, 2, 1. Cada número dura un segundo. Después se muestra «¡YA!» durante un segundo y ya puedes conducir.

- Durante la cuenta atrás el coche no se mueve, aunque pulses las flechas. Si mantienes una flecha pulsada, el coche responde en cuanto se da la salida.
- Arriba a la derecha hay un cronómetro con formato minutos:segundos.centésimas (por ejemplo, 00:12.34). Marca 00:00.00 durante la cuenta atrás y empieza a contar en la señal de salida.
- El cronómetro sigue el tiempo del juego. Si el navegador va a trompicones, puede ir algo por detrás del reloj real.

La duración de la cuenta atrás es un valor inicial y puede cambiar tras probarla. Todavía no hay sonido en la cuenta atrás ni pausa.

## Vueltas

Arriba a la izquierda ves la vuelta en la que vas, por ejemplo «Vuelta 1/1». El primer número es tu vuelta actual y el segundo, el total de vueltas de la carrera. Por ahora la carrera es de una sola vuelta; más adelante podrás elegir cuántas.

Para que una vuelta cuente, tienes que hacerla entera:

- En el circuito hay varios puntos de control invisibles repartidos por la pista (por ahora, 8). No se ven, pero el juego los anota.
- Tienes que pasar por todos, en orden, y después cruzar la línea de meta hacia delante. Solo entonces suma la vuelta.
- Si recortas por fuera de la calzada y te saltas un punto de control, al cruzar la meta la vuelta no cuenta.
- Si das marcha atrás o retrocedes por el circuito, no ganas ni pierdes vueltas. Cruzar la meta hacia atrás y volver a cruzarla hacia delante tampoco suma nada.
- Cada punto de control es algo más ancho que la calzada. Si cortas por la hierba pegada al borde, puede seguir contando. Este margen puede cambiar tras probarlo.
- Cuando completas la última vuelta, la carrera termina (ver «Fin de carrera y resultados»).

## Fin de carrera y resultados

Al completar la última vuelta válida, tu carrera termina:

- Tus flechas dejan de controlar el coche. El coche sigue rodando un poco por inercia y se detiene.
- Tu tiempo final queda fijo. Es el que marcaba el cronómetro en ese momento.
- El cronómetro y el contador de vueltas desaparecen y aparece la pantalla de resultados, con el texto «Carrera terminada» y «Tu tiempo».

En la pantalla de resultados hay dos botones. Se activan con el ratón o con el teclado (Tab cambia de botón; Intro o Espacio lo pulsa). «Repetir» está seleccionado al abrirse.

- **Repetir:** empieza una carrera nueva con la misma configuración. El coche vuelve a la parrilla, hay una nueva cuenta atrás y el cronómetro y las vueltas empiezan de cero.
- **Menú:** vuelve al menú principal sin recargar la página. No se conserva nada de la carrera anterior.

El juego no guarda nada: si recargas la página, vuelves al menú y no queda ningún resultado anterior. Por ahora los resultados solo muestran tu tiempo; no hay clasificación ni puntuación.

## Qué falta

Todavía no hay selección de coche o circuito, rivales, choques, puntuación ni clasificación. Se irán añadiendo en las próximas entregas.

Para abrir el juego, mira el [README](../../README.md).
