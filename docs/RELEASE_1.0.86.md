# Candidato 1.0.86

Generado localmente el 17 de noviembre de 2026 desde el commit
`b0eacb686d282cb5441be770aa1f6d42870615d3` de `develop-1.0.86`.

## Artefactos

| Artefacto | Tamaño | SHA-256 |
| --- | ---: | --- |
| `loteria-server-v1_0_86.tar.gz` | 156.278 bytes | `a5160bc735f227e594d3580958fcf1fe4917de33fcc79fa81d7fd4b6a64d7cb3` |
| `loteria-tv-v1_0_86-candidate.apk` | 59.044.315 bytes | `1115a784321b98d8cffc3b2ae33b682bb677cd779ac8eb940562bea19643664b` |

Los archivos se conservan en `backups/releases-local/` y no se versionan.

## Verificaciones completadas

- Servidor: lint, 4 pruebas, TypeScript y build de producción.
- Dependencias del servidor: `npm audit` sin vulnerabilidades conocidas.
- Android: TypeScript, 4 pruebas y `assembleRelease` exitoso.
- APK: `versionCode=86`, `versionName=1.0.86`, minSdk 24 y targetSdk 36.
- Firma APK v2 válida.
- Certificado SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- El certificado coincide con la APK estable 1.0.85.
- Cachés y carpetas de build Android eliminadas después de generar el candidato.

## Despliegue del servidor

- Backend desplegado el 17 de noviembre de 2026.
- Backup completo local verificado mediante restauración temporal: 16 tablas, 1 dispositivo y
  4 contenidos.
- Migración `20261116160000_video_sha256` aplicada correctamente.
- SHA-256 completado para los 4 contenidos existentes.
- PM2, health, login, manifiesto público y telemetría compatible con 1.0.85 verificados.
- El registro heredado queda habilitado temporalmente hasta completar la migración de APK.

## No ejecutado todavía

- No se publicó la APK por OTA.
- No se instaló el candidato en un TV Box real.

El siguiente paso autorizado debe ser un despliegue controlado del servidor seguido por un
único TV Box en canal piloto. No promover a estable hasta completar 24–48 horas de observación.
