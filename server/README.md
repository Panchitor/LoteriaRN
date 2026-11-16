# Lotería RN — servidor de cartelería

Panel administrativo y API central para administrar agencias, terminales Android TV,
contenido institucional, transmisiones en vivo, alertas, telemetría y actualizaciones OTA.

## Requisitos

- Node.js 20
- PostgreSQL 15 o superior
- FFmpeg
- Variables `DATABASE_URL` y `JWT_SECRET` en `.env`

`JWT_SECRET` es obligatorio cuando `NODE_ENV=production`.
El alta antigua por número de agencia está deshabilitada en producción; sólo puede habilitarse
temporalmente con `ALLOW_LEGACY_DEVICE_REGISTRATION=true` durante una migración controlada.

## Desarrollo

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

El servidor de producción escucha en el puerto `3008`.

## Validación

```sh
npm run check
```

La aplicación Android se valida desde `../app-tv` con `npm run check`.

Después de agregar la columna SHA-256, los medios históricos se auditan primero en seco y
se actualizan únicamente con confirmación explícita:

```sh
npm run backfill:media-sha256
npm run backfill:media-sha256 -- --apply
```

## Producción

Los procedimientos operativos se encuentran en `../ops`:

- `deploy-production.sh`: backup, despliegue, migraciones, build y smoke tests.
- `verify-production.sh`: estado de PM2 y últimas terminales activas.
- `audit-production-security.sh`: configuración y roles de base de datos.
- `backup-production.sh` y `verify-backup.sh`: creación y restauración de prueba.
- `restore-production.sh`: recuperación controlada.

El procedimiento completo está en
[`../docs/DISASTER_RECOVERY.md`](../docs/DISASTER_RECOVERY.md).

No se deben versionar `.env`, claves de firma, backups, APK, medios, datos de
PostgreSQL ni resultados de compilación.
