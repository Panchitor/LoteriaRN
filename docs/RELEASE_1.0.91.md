# Hotfix piloto 1.0.91

Generado el 18 de noviembre de 2026 desde `723754c`.

- Cada revisión de la imagen de espera usa una URI local basada en su SHA-256 para evitar la
  caché de imágenes de Android.
- Las imágenes de contenido controlan su duración aunque sean el único elemento de la playlist.
- Si la única imagen se elimina, al finalizar su duración libera la playlist y permite mostrar
  la espera o comenzar el contenido nuevo.

| Artefacto | SHA-256 |
| --- | --- |
| `loteria-tv-v1_0_91-candidate.apk` | `99ac1745f3cb5b1c63243e2a991ba5ea187f1d4b831d3bcba0917b0d47312e9e` |

El servidor permanece en 1.0.90. Mantener esta APK únicamente en el canal piloto.
