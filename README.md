# Crash Circuit

Crash Circuit es un juego de carreras arcade en 3D para el navegador de escritorio. Compites con una cámara de seguimiento contra 9 pilotos controlados por el ordenador en circuitos cerrados.

## Estado actual

El juego está en desarrollo. Ahora mismo están disponibles la base técnica, el menú principal, un circuito provisional con tu coche y su conducción con las flechas, la cuenta atrás de salida, el cronómetro y el contador de vueltas de la entrega E1. Al abrir el juego aparece el menú con el botón «Empezar». Al pulsarlo ves el circuito y puedes conducir tu coche con las flechas (arriba acelera, abajo frena y da marcha atrás, izquierda y derecha giran). Antes de salir hay una cuenta atrás 3, 2, 1 y, al empezar, un cronómetro cuenta el tiempo y el contador «Vuelta X/Y» avanza cuando completas una vuelta válida, pasando por todos los puntos de control. Todavía no hay rivales ni carrera completa.

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

- E1 (en curso): base técnica, menú principal, circuito, conducción con las flechas, cuenta atrás, cronómetro y vueltas válidas disponibles. Consulta el [changelog](CHANGELOG.md) para ver qué se ha terminado.

## Más documentación

- [Manual de usuario](docs/user/MANUAL_USUARIO.md)
- [Changelog](CHANGELOG.md)
- [Visión del producto](docs/product/01_VISION_DEL_PRODUCTO.md)
- [Roadmap](docs/product/03_ROADMAP.md)
