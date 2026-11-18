# Candidato 1.0.88

Generado localmente el 17 de noviembre de 2026 desde el commit `9b410a2`.

## Cambios

- Carga múltiple de videos e imágenes, arrastrar y soltar, cola secuencial y progreso individual.
- Pantalla de espera configurable y disponible sin conexión después de sincronizarla.
- Un contenido eliminado termina de reproducirse antes de borrarse en cada TV.
- Actualización inmediata del listado de contenido después de eliminar.
- Colores configurables para fondo, título y mensaje de emergencia.
- Reproductores local y en vivo mutuamente excluyentes para evitar audio superpuesto.
- Configuración simplificada; claves internas y acciones de borrado quedan ocultas.
- Grupos, Programación y Configuración verifican rol administrador al abrir la página.
- El canal piloto compara su versión contra la APK piloto y no contra la estable.

## Artefactos

| Artefacto | Tamaño | SHA-256 |
| --- | ---: | --- |
| `loteria-server-v1_0_88.tar.gz` | 159.726 bytes | `2a6d0b0acb877d76f28f6bf374f25d597b924cd869bb7710384e3b1f9a1ab611` |
| `loteria-tv-v1_0_88-candidate.apk` | 59.052.919 bytes | `920bacc4caa516cc0798ffe7e351ec3c1b78c15651f6ebe91d100ebf0ac0fb1b` |

## Verificaciones

- Servidor: ESLint, 4 pruebas, TypeScript y build de producción exitosos.
- APK: TypeScript, 6 pruebas y `assembleRelease` exitosos.
- APK `versionCode=88`, `versionName=1.0.88` y firma v2 válida.
- Certificado coincidente con la APK estable 1.0.85.

Primero debe desplegarse el servidor y luego publicarse la APK únicamente en el canal piloto.
