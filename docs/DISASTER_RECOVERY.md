# Recuperación y migración de Lotería RN

Este procedimiento recupera la base de datos, el servidor web, la configuración privada, los medios, Nginx y la configuración PM2. Los APK publicados se regeneran desde GitHub o se copian por separado si se desea conservar cada binario histórico.

La clave de firma compatible con los TV Box existentes se conserva fuera de Git en `.secrets/signing/debug.keystore`. Debe guardarse junto con el backup en un almacenamiento privado; sin esa clave Android no aceptará actualizaciones sobre las instalaciones actuales.

## Crear una copia completa

Desde WSL, exportar `SSHPASS` sin guardarla en el repositorio y ejecutar:

```sh
sh ops/backup-production.sh ./backups
```

Guardar el `.tar.gz` y su `.sha256` fuera de la VPS. La carpeta `backups/` está excluida de Git porque contiene `.env` y datos productivos.

Comprobar la copia restaurándola en una base temporal, sin detener producción:

```sh
sh ops/verify-backup.sh ./backups/loteria-full-FECHA.tar.gz
```

## Verificar una copia sin reemplazar producción

El restaurador comprueba hashes y primero restaura la base en `loteria_restore_check`. Si el dump está dañado, se detiene antes de reemplazar producción.

## Recuperar en la VPS preparada

Requisitos: Ubuntu, PostgreSQL, Node.js, npm, PM2, Nginx, usuario PostgreSQL `loteria_app`, directorios `/var/www/loteria/server` y `/var/www/loteria/storage`.

```sh
export CONFIRM_RESTORE=RESTORE_LOTERIA
sh ops/restore-production.sh ./backups/loteria-full-FECHA.tar.gz
```

La restauración es destructiva únicamente para la base `loteria` y las carpetas propias de Lotería. No modifica las demás bases ni aplicaciones de la VPS.

## Cambio de servidor

1. Instalar los requisitos en el servidor nuevo.
2. Crear el rol `loteria_app` con una contraseña exclusiva.
3. Copiar el backup completo al equipo de administración.
4. Cambiar host y puerto en los scripts o definir el nuevo destino.
5. Ejecutar la restauración.
6. Configurar DNS y certificado TLS.
7. Verificar `/login`, `/api/manifest`, subida de contenido y telemetría.
8. Mantener el servidor anterior sin modificaciones hasta completar las pruebas.

## Prueba periódica

Una vez por mes crear una copia y restaurarla en una base temporal. No se considera válido un backup que nunca fue restaurado.

## Copia automática en la VPS

`ops/backup-on-server.sh` crea cada día una copia liviana de base, código, `.env`, medios, Nginx y PM2, valida sus hashes y conserva 14 días. Las APK históricas se mantienen en el backup completo manual para no llenar el disco de la VPS.
