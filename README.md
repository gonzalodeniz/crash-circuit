# Crash Circuit

Crash Circuit es un juego de carreras arcade en 3D para el navegador de escritorio. Compites con una cámara de seguimiento contra 9 pilotos controlados por el ordenador en circuitos cerrados.

## Estado actual

El juego está en desarrollo. Ahora mismo están disponibles la base técnica, el menú principal, la selección de coche entre cuatro modelos, la selección de circuito entre cuatro trazados de dificultad creciente, la elección de 1, 3, 5 o 10 vueltas, el resumen antes de correr, tu coche en el circuito elegido y su conducción con las flechas, la cuenta atrás de salida, el cronómetro, el contador de vueltas y la pantalla de resultados de la entrega E1. Al abrir el juego aparece el menú con el botón «Empezar». Al pulsarlo eliges uno de los cuatro coches, que se diferencian en el aspecto pero se conducen igual. Después eliges uno de los cuatro circuitos (muy fácil, fácil, medio o difícil) y cuántas vueltas dura la carrera (1, 3, 5 o 10). Después ves un resumen con tu elección: «Volver» retrocede un paso y «¡A correr!» empieza la carrera. Entonces ves el circuito y puedes conducir tu coche con las flechas (arriba acelera, abajo frena y da marcha atrás, izquierda y derecha giran). Antes de salir hay una cuenta atrás 3, 2, 1 y, al empezar, un cronómetro cuenta el tiempo y el contador «Vuelta X/Y» avanza cuando completas una vuelta válida, pasando por todos los puntos de control. Al completar la carrera ves tu tiempo y puedes repetir o volver al menú. Todavía no hay rivales.

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

- E1 (en curso): base técnica, menú principal, selección de coche (cuatro modelos de aspecto distinto), selección de circuito (cuatro trazados), conducción con las flechas, cuenta atrás, cronómetro, vueltas válidas y fin de carrera con resultados (repetir o volver al menú) disponibles. Consulta el [changelog](CHANGELOG.md) para ver qué se ha terminado.
- E2 (en curso): puedes elegir entre cuatro coches, cuatro circuitos y 1, 3, 5 o 10 vueltas, ver un resumen y jugar cualquiera de las 64 combinaciones. Al volver al menú, la selección vuelve a los valores por defecto.

## Más documentación

- [Manual de usuario](docs/user/MANUAL_USUARIO.md)
- [Changelog](CHANGELOG.md)
- [Visión del producto](docs/product/01_VISION_DEL_PRODUCTO.md)
- [Roadmap](docs/product/03_ROADMAP.md)
