# Preparación de producción — versión 1.0.86

Este documento separa lo ya implementado de lo que todavía requiere una ventana
controlada. La versión 1.0.85 continúa siendo la base estable de producción.

## Implementado en desarrollo

- Failover del TV Box sólo para lecturas; las escrituras nunca se envían al respaldo.
- Aviso visible cuando se usa el servidor de respaldo.
- Servidor secundario bloqueado en modo `STANDBY_READONLY`.
- Credenciales opacas por dispositivo; en la base sólo se guarda SHA-256.
- Compatibilidad transitoria con identificadores 1.0.85 hasta que cada equipo se registre
  de nuevo y reciba su credencial segura.
- Límites de cuerpo y frecuencia en registro, telemetría, logs, estadísticas y control.
- Validación SHA-256 de medios y APK antes de activarlos en Android.
- Descarga de medios a archivo temporal y reemplazo atómico después de verificarlo.
- Canal piloto de APK con promoción explícita a estable.
- Lint, pruebas, TypeScript y build de producción automatizados en CI.
- Dependencias del servidor auditadas sin vulnerabilidades conocidas; Next.js y Prisma
  actualizados a versiones corregidas y alineadas.

## Antes del primer piloto 1.0.86

1. Crear y verificar un backup restaurable.
2. Desplegar la migración `20261116160000_video_sha256`.
   El registro antiguo queda deshabilitado por defecto en producción. Sólo durante una
   transición controlada puede usarse `ALLOW_LEGACY_DEVICE_REGISTRATION=true`; debe volver a
   `false` apenas todos los equipos usen códigos de activación.
3. Ejecutar primero en modo simulación y luego aplicar:

   ```sh
   cd /var/www/loteria/server
   npm run backfill:media-sha256
   npm run backfill:media-sha256 -- --apply
   ```

4. Publicar la APK como `PILOT`; confirmar versión, URL y SHA-256.
5. Asignar un solo dispositivo de prueba durante 24–48 horas.
6. Verificar reproducción, reinicio, actualización OTA, captura, logs y recuperación de red.
7. Promover a estable por grupos, conservando la APK 1.0.85 para rollback.

La carpeta `app-tv/android` contiene código nativo propio (`SilentInstallModule`). Por eso no se
debe ejecutar `expo prebuild --clean` automáticamente: cualquier regeneración debe revisar y
reaplicar ese módulo antes de compilar la APK.

## Infraestructura pendiente para producción definitiva

- Contratar el servidor dedicado de 4 vCPU, 8 GB RAM y 50 GB SSD.
- Restringir PostgreSQL y Node a localhost; publicar sólo 80/443 y el puerto SSH acordado.
- Usar SSH por clave, deshabilitar contraseña y acceso root directo después de comprobar un
  usuario administrativo alternativo.
- Instalar TLS, monitoreo externo, alertas de disco/CPU/certificado y backups externos.
- Crear el secundario en `loteriarn-bk.patagonialive.media` y probar una caída real del
  principal antes de considerarlo disponible.
- Configurar la sincronización cada 30 minutos y alertar si se atrasa dos ciclos.
- Planificar la migración de Expo SDK en una rama separada: SDK 54 todavía arrastra avisos
  transitivos de herramientas de compilación que requieren un salto mayor y pruebas en TV Box.

## Condición de salida

No se considera listo al 100 % hasta completar un piloto real, una restauración de backup y
un simulacro de failover. Ninguno de esos pasos debe ejecutarse directamente sobre todos los
TV Box.
