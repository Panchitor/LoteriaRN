# Hotfix piloto 1.0.89

Generado el 17 de noviembre de 2026 desde `8a652a9`.

- Expone la imagen de espera como recurso público para los TV autenticados por telemetría.
- Verifica que la imagen descargada coincida con su SHA-256.
- Conserva la playlist y el archivo activo hasta que finaliza la reproducción.
- Elimina el archivo local retirado solamente después de que el reproductor lo libera.
- Refuerza las rutas administrativas de Emergencia, Grupos y Programación.

| Artefacto | SHA-256 |
| --- | --- |
| `loteria-server-v1_0_89.tar.gz` | `49e3c558ec2bb5d66586246f8b2246f182a0bee2df19c7e9d9df197887cf020d` |
| `loteria-tv-v1_0_89-candidate.apk` | `9989461f1e40f3369c967caac779a26afe371a332f7e9c3fe060abc6c318541a` |

Servidor desplegado con backup `/var/backups/loteria/20261117-234517`. La APK debe permanecer
en canal piloto hasta repetir la prueba de eliminación durante reproducción.
