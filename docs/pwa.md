# Control Financiero como aplicación instalable (PWA)

Control Financiero se puede instalar en el celular, la tablet o el escritorio y abrirse como una aplicación independiente, con su icono y sin las barras del navegador. Es la misma web: una sola base de código.

## Cómo instalarla

**Android (Chrome, Edge, Samsung Internet)**
1. Abre la web en el navegador e inicia sesión.
2. Pulsa **Instalar Control Financiero** en la invitación que aparece arriba, o abre el menú del navegador (⋮) → **Instalar aplicación** / **Agregar a la pantalla de inicio**.
3. Confirma. El icono queda en tu pantalla de inicio; ábrelo desde ahí.

**iPhone y iPad (Safari)**
1. Abre la web **en Safari** e inicia sesión.
2. Toca **Compartir** (el cuadrado con la flecha).
3. Elige **Agregar a pantalla de inicio** y confirma con **Agregar**.

La invitación de la web muestra estos mismos pasos con el botón **Cómo instalar** (iOS no permite instalar con un botón).

**Escritorio (Chrome o Edge)**: icono de instalación en la barra de direcciones, o menú → **Instalar Control Financiero**.

Si ya está instalada, la invitación no aparece. Si la cierras con **Ahora no**, no vuelve durante 14 días.

## Qué hace sin conexión

- La pantalla y los recursos estáticos se guardan en el dispositivo: la app abre rápido y, sin Internet, abre y muestra un aviso **«Sin conexión · guardar cambios requiere Internet»**.
- **Los datos financieros NO se guardan en el dispositivo por el Service Worker.** Todo viene de Supabase por la red directa. Sin conexión no se muestran datos nuevos ni se puede guardar nada.
- Registrar o editar sin conexión falla con su aviso habitual: **no se aparenta un guardado** ni queda nada «en cola» para enviarse solo después (las escrituras no se pausan). Las operaciones financieras llevan clave de idempotencia, así que reintentarlas al volver la conexión no duplica nada.
- No existe sincronización offline de gastos o fondos: requeriría diseñar antes una estrategia transaccional y de resolución de conflictos.

## Qué guarda y qué no guarda el Service Worker (`public/sw.js`)

| Sí (solo recursos estáticos del propio sitio) | Nunca |
|---|---|
| `index.html`, los `/assets/*` con hash, iconos y manifiesto, `offline.html` | Nada de otro origen (Supabase: API, Auth, Storage; fuentes de Google) |
| | Nada que no sea GET, nada con cabecera `Authorization`, ninguna ruta `/rest`, `/auth`, `/storage` |
| | Tokens, credenciales ni respuestas autenticadas |

Esto lo comprueban pruebas unitarias del propio `sw.js` y una prueba de navegador que inspecciona las cachés después de iniciar sesión.

## Actualizaciones

1. Cada build sella `sw.js` con una versión (hash de sus archivos). Netlify lo sirve **sin caché**, así que cada despliegue llega a quien tiene la app instalada.
2. La versión nueva se descarga y queda **en espera**: no se activa sola.
3. La app muestra **«Hay una nueva versión de Control Financiero»** con el botón **Actualizar**. Al aceptar, se activa y la página se recarga una vez; **la sesión se conserva** (vive en el almacenamiento del navegador).
4. Con un formulario con cambios sin guardar abierto no se puede aplicar (el diálogo bloquea el aviso; además la app comprueba los cambios pendientes antes de recargar). Tras guardar o descartar, se actualiza.
5. Los archivos llevan hash, así que un `index.html` nuevo nunca mezcla archivos de versiones distintas; las cachés antiguas se borran al activar la nueva.

## Para quien desarrolla

- El Service Worker **solo se registra en producción** (`npm run build`); en desarrollo no, para ver los cambios al instante.
- `npm run test:pwa` compila, sirve `dist/` con `vite preview` y prueba en Chrome: instalabilidad (el propio Chrome informa que no hay motivos de rechazo), manifiesto, iconos y zona segura *maskable*, Service Worker, cachés, sin conexión, actualización y flujos de instalación (Android/iOS/ya instalada). Comparte con la suite normal el usuario E2E aislado y el bloqueo: **no ejecutarlas a la vez**.
- Los iconos salen de `public/favicon.svg` y `public/icon-maskable.svg` con `node scripts/generar-iconos.mjs`. Al cambiar el logo, sube el `?v=` de `index.html` y del manifiesto.

## Qué NO se ha verificado

- **Dispositivos físicos** (Android, iPhone): el comportamiento de instalación y de ventana independiente en un teléfono real depende del sistema operativo y no se probó aquí. El evento de instalación de Android y «Agregar a pantalla de inicio» de iOS se comprobaron con simulaciones en Chrome, no en esos sistemas.
- Lighthouse: ya no incluye una categoría PWA; la instalabilidad se verifica con el protocolo de Chrome (`Page.getInstallabilityErrors`).
- Capturas de pantalla en el manifiesto: no se incluyen (opcionales).
