# Respaldo automático en modo degradado

## Dominios

- Principal: `https://loteriarn.patagonialive.media`
- Respaldo: `https://loteriarn-bk.patagonialive.media`

El respaldo es deliberadamente de solo lectura. Las aplicaciones Android usan el
respaldo únicamente para leer el manifiesto y descargar contenido ya sincronizado.
Telemetría, logs, estadísticas, vinculación y comandos nunca se envían al respaldo.

Cuando una TV lee desde el respaldo muestra: **Servidor principal en mantenimiento.
Las actualizaciones de contenido pueden demorar.** Los archivos locales más nuevos no
se eliminan mientras se utiliza un manifiesto de respaldo.

## Configuración del servidor de respaldo

Agregar a `/var/www/loteria/server/.env`:

```env
NODE_ENV=production
SERVER_MODE=STANDBY_READONLY
```

`GET /api/health` debe responder con `mode: STANDBY_READONLY`. El proxy rechaza con
HTTP 503 cualquier método que pueda escribir mientras ese modo esté activo.

## Sincronización desde el principal

Instalar `rsync`, copiar `ops/sync-standby.sh` y configurar una clave SSH dedicada con
acceso sólo entre ambos servidores. Crear `/etc/loteria/standby-sync.env` con permisos
`600`:

```env
STANDBY_HOST=root@IP_DEL_SERVIDOR_ANTERIOR
STANDBY_PORT=22
STANDBY_KEY=/root/.ssh/loteria_standby_ed25519
```

Copiar las unidades de `ops/systemd` a `/etc/systemd/system/` y activar el timer:

```sh
systemctl daemon-reload
systemctl enable --now loteria-standby-sync.timer
systemctl list-timers loteria-standby-sync.timer
```

El proceso sincroniza medios y APK con `rsync`, genera un snapshot consistente de
PostgreSQL, verifica SHA-256, restaura en una base nueva y hace un intercambio atómico.
Conserva la base anterior como `loteria_standby_previous` para recuperación.

Antes de habilitar el timer se debe ejecutar una vez manualmente para validar permisos,
rol PostgreSQL `loteria_app`, PM2 y `/api/health`. Después funciona automáticamente cada
30 minutos; `Persistent=true` recupera una ejecución perdida tras un reinicio.
