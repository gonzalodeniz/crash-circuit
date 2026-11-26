# Crash Circuit

Crash Circuit es un juego de carreras arcade en 3D para el navegador de escritorio. Compites con una cámara de seguimiento contra 9 pilotos controlados por el ordenador en circuitos cerrados.

## Estado actual

El juego está en desarrollo. Ahora mismo están disponibles la base técnica, el menú principal, la selección de coche entre cuatro modelos, la selección de circuito entre cuatro trazados de dificultad creciente, la elección de 1, 3, 5 o 10 vueltas, el resumen antes de correr, tu coche en el circuito elegido y su conducción con las flechas, la pérdida de velocidad al salirte de la calzada, el muro exterior y los obstáculos contra los que puedes chocar, los choques entre coches, la cuenta atrás de salida, el cronómetro, el contador de vueltas y la pantalla de resultados, con el ganador y tu puesto. Al abrir el juego aparece el menú con el botón «Empezar». Al pulsarlo eliges uno de los cuatro coches, que se diferencian en el aspecto pero se conducen igual. Después eliges uno de los cuatro circuitos (muy fácil, fácil, medio o difícil) y cuántas vueltas dura la carrera (1, 3, 5 o 10). Después ves un resumen con tu elección: «Volver» retrocede un paso y «¡A correr!» empieza la carrera. Entonces ves el circuito y puedes conducir tu coche con las flechas (arriba acelera, abajo frena y da marcha atrás, izquierda y derecha giran). Antes de salir hay una cuenta atrás 3, 2, 1 y, al empezar, un cronómetro cuenta el tiempo y el contador «Vuelta X/Y» avanza cuando completas una vuelta válida, pasando por todos los puntos de control. Al completar la carrera ves tu tiempo y puedes repetir o volver al menú. Tu coche sale último en una parrilla con nueve rivales con nombre propio. Tras la señal de salida, los rivales conducen solos por el circuito, con pequeñas variaciones y más exigentes cuanto más difícil es el circuito. Los diez coches son sólidos: al tocarse cambian de velocidad y dirección. Los golpes dejan daños visibles, y uno fuerte deja el coche casi parado, sin destruirlo.

## Requisitos

- Un navegador de escritorio con WebGL.
- Para arrancarlo en local: Node 20 o superior y npm.

## Cómo arrancarlo en local

Desde la carpeta del proyecto:

1. Instala las dependencias: `npm install`
2. Arranca el servidor local: `npm run dev`
3. Abre <http://127.0.0.1:5190/> en el navegador.

Para probar la versión final empaquetada: `npm run build` y después `npm run preview`, y abre <http://127.0.0.1:5191/>.

El juego no guarda nada ni usa servidores: al recargar la página todo vuelve al principio.

## Entregas disponibles

- E1 (terminada): base técnica, menú principal, selección de coche (cuatro modelos de aspecto distinto), selección de circuito (cuatro trazados), conducción con las flechas, cuenta atrás, cronómetro, vueltas válidas y fin de carrera con resultados (repetir o volver al menú) disponibles. Consulta el [changelog](CHANGELOG.md) para ver qué se ha terminado.
- E2 (terminada): puedes elegir entre cuatro coches, cuatro circuitos y 1, 3, 5 o 10 vueltas, ver un resumen y jugar cualquiera de las 64 combinaciones. Al volver al menú, la selección vuelve a los valores por defecto.
- E3 (terminada): cada carrera tiene diez participantes. Sales el último de la parrilla junto a nueve pilotos con nombre propio (provisional). Tras la señal de salida los rivales conducen solos, con trayectoria propia y variaciones, y más exigentes en los circuitos difíciles. Gana el primero en llegar, aunque sea un rival, y tú sigues hasta cruzar tu meta; los resultados muestran el ganador, tu puesto sobre diez y quién llegó antes que tú.
- E4 (en curso): salirse de la calzada hace perder velocidad, a ti y a los rivales, y atajar por fuera no hace ganar posiciones. Cada circuito tiene además un muro exterior y obstáculos (neumáticos y rocas) fuera de la calzada, que no se pueden atravesar. Los diez coches chocan entre sí en lugar de atravesarse, y un empujón puede hacer ganar o perder posiciones. Los golpes pueden ser leves (pequeñas marcas y pocas chispas) o fuertes (coche casi parado, ennegrecido y abollado, con chispas y humo). La destrucción de coches todavía no está disponible.

## Más documentación

- [Manual de usuario](docs/user/MANUAL_USUARIO.md)
- [Changelog](CHANGELOG.md)
- [Visión del producto](docs/product/01_VISION_DEL_PRODUCTO.md)
- [Roadmap](docs/product/03_ROADMAP.md)
