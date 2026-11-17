# Candidato 1.0.87

Generado localmente el 17 de noviembre de 2026.

## Corrección

- Mantiene la pantalla encendida mediante `FLAG_KEEP_SCREEN_ON` mientras la aplicación está
  abierta, evitando que el protector de pantalla del TV Box cubra la reproducción.
- La protección se vuelve a aplicar cada vez que la aplicación regresa al primer plano.
- Conserva la recuperación automática del reproductor incorporada en la versión 1.0.86.

## Artefacto

| Artefacto | SHA-256 |
| --- | --- |
| `loteria-tv-v1_0_87-candidate.apk` | `df0673ad9a353cd6c75aaa33ce4412775639ad5696a05992298541128c5bd720` |

## Verificaciones

- TypeScript y 6 pruebas exitosas.
- `assembleRelease` exitoso.
- APK `versionCode=87`, `versionName=1.0.87`.
- Firma APK v2 válida y certificado coincidente con la versión estable 1.0.85.

Debe instalarse primero únicamente en el TV Box piloto.
