# Hotfix piloto 1.0.92

Generado el 18 de noviembre de 2026 desde `f68408e`.

- Corrige el caso en que una imagen de contenido eliminada quedaba congelada si su tiempo de
  exhibición ya había terminado antes de recibir la actualización del servidor.
- Si la imagen se elimina antes de completar su duración, permanece solamente el tiempo restante.
- Al liberar la imagen eliminada, la APK aplica el manifiesto más reciente y puede iniciar el video
  nuevo o mostrar la pantalla de espera.
- Conserva la corrección de caché de la imagen de espera incorporada en 1.0.91.

| Artefacto | SHA-256 |
| --- | --- |
| `loteria-tv-v1_0_92-candidate.apk` | `b52e06443dbba9702504b330ffc016952d3fda8deed07e26f5d7223a0b85ec88` |

Validaciones realizadas: control de tipos, 6 pruebas automáticas, compilación Android release,
firma compatible con la versión estable y metadatos de versión 1.0.92.

El servidor permanece en 1.0.90. Mantener esta APK únicamente en el canal piloto hasta completar
la prueba en el dispositivo.
