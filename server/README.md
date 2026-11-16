# Lotería RN — servidor de cartelería

Panel administrativo y API central para administrar agencias, terminales Android TV,
contenido institucional, transmisiones en vivo, alertas, telemetría y actualizaciones OTA.

## Requisitos

- Node.js 20
- PostgreSQL 15 o superior
- FFmpeg
- Variables `DATABASE_URL` y `JWT_SECRET` en `.env`

`JWT_SECRET` es obligatorio cuando `NODE_ENV=production`.

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
npm run lint
npm run build
```

La aplicación Android se valida desde `../app-tv` con `npm run check`.

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
