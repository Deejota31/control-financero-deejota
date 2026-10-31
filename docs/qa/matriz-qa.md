# Matriz de calidad — Control Financiero

Generada: 30/10/2026, 10:06:53 p. m. (hora de Lima) desde `qa/resultados-e2e.json`.

## Resultado global de la suite E2E

- Pruebas ejecutadas: **413** · Aprobadas: **397** · Fallidas: **7** · Omitidas: **9**
- Duración total: **2214.7 s**

## Comandos ejecutados

| Comando | Resultado | Duración |
|---|---|---|
| `npm run build` | OK | 0.1 min |
| `npm run typecheck` | OK | 0.0 min |
| `npm run lint` | OK | 0.0 min |
| `npm test (unitarias)` | OK | 0.5 min |
| `npm run db:test (SQL)` | OK | 0.1 min |
| `npm run verify:security` | OK | 0.1 min |
| `playwright test (E2E, toda la suite)` | FALLÓ (código 1) | 36.9 min |
| `playwright test (PWA, build de producción)` | FALLÓ (código 1) | 0.7 min |

## Cobertura por requisito

| ID | Requisito | Archivos de prueba | Aprobadas | Falladas | Omitidas | Estado |
|---|---|---|---|---|---|---|
| R1 | Acceso y sesión | auth.spec, recuperacion.spec | 17 | 0 | 0 | Aprobado (con la cobertura listada) |
| R2 | Navegación general y preferencias | navegacion.spec, barra-lateral.spec, arranque.spec | 9 | 0 | 0 | Aprobado (con la cobertura listada) |
| R3 | Catálogo | catalogo.spec, iconos.spec | 19 | 0 | 0 | Aprobado (con la cobertura listada) |
| R4 | Fondos (página y tabla) | fondos.spec, detalle-fondo.spec, fondos-tabla.spec, reglas-ui.spec | 30 | 1 | 1 | Falló |
| R5 | Copia de fondos | planificacion.spec | 20 | 0 | 0 | Aprobado (con la cobertura listada) |
| R6 | Planificación mensual | planificacion.spec | 20 | 0 | 0 | Aprobado (con la cobertura listada) |
| R7 | Formulario de gasto y motor financiero | gastos.spec, comprobantes.spec, qa-regresion.spec, dialogos.spec | 17 | 2 | 0 | Falló |
| R8 | Listado de Gastos | gastos.spec, filtros.spec, volumen.spec, gastos-diseno.spec | 16 | 1 | 0 | Falló |
| R9 | Plantillas y registro mensual | plantillas.spec | 2 | 0 | 0 | Aprobado (con la cobertura listada) |
| R10 | Dashboard y gráficos | dashboard.spec, analisis.spec | 31 | 0 | 0 | Aprobado (con la cobertura listada) |
| R11 | Salud financiera | salud.spec | 5 | 0 | 0 | Aprobado (con la cobertura listada) |
| R12 | Configuración | configuracion.spec | 9 | 0 | 0 | Aprobado (con la cobertura listada) |
| R13 | Independencia mensual y datos | planificacion.spec, integracion.spec, volumen.spec | 23 | 0 | 0 | Aprobado (con la cobertura listada) |
| R14 | Responsive y diseño | qa-responsive.spec, responsive.spec, modales.spec, visual.spec, fondos-tabla.spec | 60 | 1 | 0 | Falló |
| R15 | Accesibilidad y casos límite | a11y.spec, teclado.spec, recuperacion.spec | 13 | 0 | 0 | Aprobado (con la cobertura listada) |

Un requisito figura «Aprobado» solo respecto de los escenarios que sus pruebas ejecutan; lo que no está cubierto se lista más abajo.

## Escenarios NO cubiertos o bloqueados

| Escenario | Estado | Motivo |
|---|---|---|
| Teclado virtual del teléfono | Bloqueado | Exige un teléfono real; el entorno solo dispone de navegador de escritorio emulado. |
| Aislamiento de datos entre dos usuarios EN LA INTERFAZ | No ejecutado | Solo hay un usuario E2E y el del propietario. El aislamiento sí está probado en SQL (RLS) con dos usuarios: ver pruebas pgTAP rls_base y fondos_por_periodo. |
| Zoom del navegador al 200 % | No ejecutado | No hay prueba automática; el barrido responsive de 320 px y de 844×390 es el equivalente aproximado en ancho CSS, no el zoom real. |
| Lector de pantalla (anuncios reales) | No ejecutado | axe verifica nombres, etiquetas y relaciones; el anuncio real con NVDA/VoiceOver requiere una prueba manual. |
| Dos pestañas con cambios concurrentes | No ejecutado | No existe prueba con dos contextos de navegador editando a la vez. |
| Pérdida de conexión real a mitad de un guardado | No ejecutado | La idempotencia del reintento está probada en SQL (create_expense con la misma clave); no se cortó la red real en el navegador. |
| Catálogo con elementos inactivos, nombres repetidos bajo padres distintos, comillas y nombres largos como conjunto de datos dedicado | No ejecutado | No se sembró un catálogo extremo dedicado; se probó con el catálogo estándar del E2E y pruebas puntuales. |
| Comprobantes: abrir, reemplazar y quitar con PDF/WebP y 5 MB exactos | No ejecutado | comprobantes.spec cubre subida, límite y borrado básicos; no todas las combinaciones de formato y tamaño. |

## Defectos abiertos (pruebas fallidas)

| ID | Archivo | Escenario | Error | Evidencia |
|---|---|---|---|---|
| F1 | dialogos.spec.ts | Diálogos: el borde de foco no se recorta › Gastos: nuevo gasto, plantillas y registro mensual | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\dialogos-Diálogos-el-borde-841d1-antillas-y-registro-mensual\error-context.md |
| F2 | fondos-tabla.spec.ts | Tabla de Fondos: distribución, cobertura y uso › 8 · sin desbordes de 320 a 1920 px, con las columnas que caben y tarjetas en móvil | Error: columna Cobertura visible solo con espacio (1366px) | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\fondos-tabla-Tabla-de-Fond-102b0-e-caben-y-tarjetas-en-móvil\error-context.md |
| F3 | gastos.spec.ts | Gastos › ordena, pagina y exporta con los filtros aplicados | Error: [2mexpect([22m[31mpage[39m[2m).[22mtoHaveURL[2m([22m[32mexpected[39m[2m)[22m failed | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\gastos-Gastos-ordena-pagin-42996-a-con-los-filtros-aplicados\error-context.md |
| F4 | plantillas-encabezados.spec.ts | Plantillas de fondos: encabezados alineados con sus columnas › a 1920×1080 cada encabezado coincide con su columna (sin columnas fantasma) | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-encabezados-Pla-e62ad-umna-sin-columnas-fantasma-\error-context.md |
| F5 | plantillas-encabezados.spec.ts | Plantillas de fondos: encabezados alineados con sus columnas › a 1440×900 cada encabezado coincide con su columna (sin columnas fantasma) | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-encabezados-Pla-025ec-umna-sin-columnas-fantasma-\error-context.md |
| F6 | plantillas-encabezados.spec.ts | Plantillas de fondos: encabezados alineados con sus columnas › a 1280×800 cada encabezado coincide con su columna (sin columnas fantasma) | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-encabezados-Pla-32bb0-umna-sin-columnas-fantasma-\error-context.md |
| F7 | plantillas-encabezados.spec.ts | Plantillas de fondos: encabezados alineados con sus columnas › a 1024×768 cada encabezado coincide con su columna (sin columnas fantasma) | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-encabezados-Pla-ea209-umna-sin-columnas-fantasma-\error-context.md |

## Matriz de escenarios ejecutados

| ID | Módulo (archivo) | Escenario | Estado | Duración | Reintentos |
|---|---|---|---|---|---|
| QA-001 | a11y.spec | Accesibilidad (axe) › pantallas de acceso, recuperación y sesión vencida | Aprobado | 11.3 s | 0 |
| QA-002 | a11y.spec | Accesibilidad (axe) › páginas principales, tema claro | Aprobado | 23.5 s | 0 |
| QA-003 | a11y.spec | Accesibilidad (axe) › diálogos y estados con datos, tema claro | Aprobado | 17.9 s | 0 |
| QA-004 | a11y.spec | Accesibilidad (axe) › páginas principales, tema oscuro | Aprobado | 24.1 s | 0 |
| QA-005 | a11y.spec | Accesibilidad (axe) › diálogos y estados con datos, tema oscuro | Aprobado | 17.6 s | 0 |
| QA-006 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Gastos: deslizar a la izquierda abre todas las acciones; el botón abre las mismas; derecha, fuera y Escape cierran; solo una fila abierta | Aprobado | 5.0 s | 0 |
| QA-007 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Gastos: vertical, gesto corto y diagonal no abren nada; la casilla y el botón siguen funcionando; el gesto no modifica datos | Aprobado | 5.3 s | 0 |
| QA-008 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Gastos: acciones no destructivas llegan a su flujo; Anular abre su confirmación y cancelarla no cambia el gasto | Aprobado | 5.3 s | 0 |
| QA-009 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Gastos anulado: muestra «Anulado», Restaurar y Editar deshabilitado con su motivo | Aprobado | 3.7 s | 0 |
| QA-010 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Fondos: el panel ofrece todas las acciones con sus restricciones; eliminar abre la simulación y se cancela | Aprobado | 4.4 s | 0 |
| QA-011 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Fondo General: sin acciones de prioridad (no existen para él) | Aprobado | 3.3 s | 0 |
| QA-012 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Catálogo a 320 px: el nombre completo es legible y el panel ofrece subir, bajar, editar, desactivar y eliminar | Aprobado | 4.8 s | 0 |
| QA-013 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Plantillas mensuales a 844 × 390: el panel cabe, se recorre por dentro y todas las acciones son alcanzables | Aprobado | 5.1 s | 0 |
| QA-014 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Plantillas de fondos a 844 × 390: etiquetas comprensibles, acciones completas y una plantilla aplicada no se puede preparar otra vez | Aprobado | 4.9 s | 0 |
| QA-015 | acciones-moviles.spec | Acciones por elemento con gesto táctil › sin desplazamiento horizontal ni controles tras la barra inferior en la matriz de tamaños (con el panel abierto) | Aprobado | 20.5 s | 0 |
| QA-016 | acciones-moviles.spec | Acciones por elemento con gesto táctil › el panel abierto no tiene fallos de accesibilidad (light) | Aprobado | 4.2 s | 0 |
| QA-017 | acciones-moviles.spec | Acciones por elemento con gesto táctil › el panel abierto no tiene fallos de accesibilidad (dark) | Aprobado | 4.3 s | 0 |
| QA-018 | acciones-moviles.spec | Ventana estrecha con ratón (pointer: fine) › el botón de acciones mide ≥ 44 px, abre el panel y arrastrar con el ratón también lo abre | Aprobado | 4.1 s | 0 |
| QA-019 | acciones-moviles.spec | Ventana estrecha con ratón (pointer: fine) › escritorio 1440 × 900: la tabla de Gastos conserva sus iconos de acción y no hay panel | Aprobado | 3.5 s | 0 |
| QA-020 | acciones-moviles.spec | Ventana estrecha con ratón (pointer: fine) › menús de escritorio con poca altura: acotados a la pantalla y con desplazamiento interno (sin coordenadas negativas) | Aprobado | 3.4 s | 0 |
| QA-021 | analisis.spec | Análisis conectado del Dashboard › perfil y ranking van en una fila al final, tras Distribución y Top 5, y no queda ni el flujo ni las tarjetas anteriores | Aprobado | 3.2 s | 0 |
| QA-022 | analisis.spec | Análisis conectado del Dashboard › el cursor inspecciona con detalle y el clic filtra todo el panel sin abrir modales; Limpiar filtros lo quita | Aprobado | 4.4 s | 0 |
| QA-023 | analisis.spec | Análisis conectado del Dashboard › en móvil las tres tarjetas se apilan, el perfil pasa a barras y no hay desborde | Aprobado | 3.0 s | 0 |
| QA-024 | arranque.spec | sin sesión, la app lleva al acceso y está conectada a Supabase local | Aprobado | 1.1 s | 0 |
| QA-025 | auth.spec | rutas y errores sin sesión › protege / | Aprobado | 0.9 s | 0 |
| QA-026 | auth.spec | rutas y errores sin sesión › protege /gastos | Aprobado | 0.9 s | 0 |
| QA-027 | auth.spec | rutas y errores sin sesión › protege /fondos | Aprobado | 1.0 s | 0 |
| QA-028 | auth.spec | rutas y errores sin sesión › protege /configuracion | Aprobado | 0.9 s | 0 |
| QA-029 | auth.spec | rutas y errores sin sesión › valida campos requeridos | Aprobado | 2.2 s | 0 |
| QA-030 | auth.spec | rutas y errores sin sesión › rechaza credenciales incorrectas y orienta al usuario | Aprobado | 2.2 s | 0 |
| QA-031 | auth.spec | rutas y errores sin sesión › muestra un error claro si no hay conexión con Supabase | Aprobado | 2.2 s | 0 |
| QA-032 | auth.spec | rutas y errores sin sesión › recuperación de contraseña responde sin revelar si el correo existe | Aprobado | 2.1 s | 0 |
| QA-033 | auth.spec | rutas y errores sin sesión › un enlace de restablecimiento sin sesión se informa como vencido | Aprobado | 1.1 s | 0 |
| QA-034 | auth.spec | rutas y errores sin sesión › la pantalla de sesión vencida ofrece volver a entrar | Aprobado | 2.1 s | 0 |
| QA-035 | auth.spec | con el usuario demo local › inicia sesión, navega, conserva la sesión al recargar y cierra sesión | Aprobado | 3.0 s | 0 |
| QA-036 | auth.spec | con el usuario demo local › un usuario con sesión no ve la pantalla de acceso | Aprobado | 2.5 s | 0 |
| QA-037 | auth.spec | con el usuario demo local › guarda el perfil en Supabase y lo recupera tras recargar | Aprobado | 3.9 s | 0 |
| QA-038 | auth.spec | con el usuario demo local › el tema claro/oscuro cambia, se guarda en el perfil y persiste | Aprobado | 3.0 s | 0 |
| QA-039 | auth.spec | con el usuario demo local › la validación de contraseña nueva funciona en Configuración | Aprobado | 2.8 s | 0 |
| QA-040 | auth.spec | con el usuario demo local › en pantalla pequeña se usa la barra de navegación inferior | Aprobado | 2.3 s | 0 |
| QA-041 | barra-lateral.spec | Barra lateral: expandida y compacta › alterna entre modos por clic y teclado en los seis módulos, sin dejar márgenes vacíos | Aprobado | 28.9 s | 0 |
| QA-042 | barra-lateral.spec | Barra lateral: expandida y compacta › en modo compacto el nombre completo aparece al enfocar con teclado y la preferencia sobrevive a recargar | Aprobado | 3.2 s | 0 |
| QA-043 | barra-lateral.spec | Barra lateral: expandida y compacta › la preferencia de tablet no sobrescribe la de escritorio | Aprobado | 4.0 s | 0 |
| QA-044 | barra-lateral.spec | Barra lateral: expandida y compacta › con movimiento reducido el cambio de ancho no se anima | Aprobado | 1.4 s | 0 |
| QA-045 | capturas-acciones.spec | Capturas de acciones por elemento › capturas antes 320x640 _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-046 | capturas-acciones.spec | Capturas de acciones por elemento › capturas antes 390x844 _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-047 | capturas-acciones.spec | Capturas de acciones por elemento › capturas antes 844x390 _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-048 | capturas-acciones.spec | Capturas de acciones por elemento › capturas antes 1440x900 _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-049 | capturas-diseno.spec | Capturas de diseño: Gastos › tabla, selección y detalle a 1440 px, tema claro | Aprobado | 5.0 s | 0 |
| QA-050 | capturas-diseno.spec | Capturas de diseño: Gastos › tabla, selección y detalle a 1440 px, tema oscuro | Aprobado | 5.5 s | 0 |
| QA-051 | capturas-v3.spec | Capturas del rediseño global › antes 1440x900 claro _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-052 | capturas-v3.spec | Capturas del rediseño global › antes 1440x900 oscuro _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-053 | capturas-v3.spec | Capturas del rediseño global › antes 390x844 claro _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-054 | capturas-v3.spec | Capturas del rediseño global › antes 390x844 oscuro _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-055 | catalogo.spec | Catálogo › administra ámbitos: crear, editar, ordenar, desactivar y eliminar | Aprobado | 5.6 s | 0 |
| QA-056 | catalogo.spec | Catálogo › un ámbito con gastos no se elimina: se conserva el histórico | Aprobado | 3.0 s | 0 |
| QA-057 | catalogo.spec | Catálogo › los medios de pago nuevos quedan antes de "Otro" | Aprobado | 4.0 s | 0 |
| QA-058 | catalogo.spec | Catálogo › rechaza una categoría duplicada dentro del mismo ámbito y valida el nombre | Aprobado | 3.5 s | 0 |
| QA-059 | catalogo.spec | Catálogo › subcategorías: se filtran por ámbito y categoría | Aprobado | 2.7 s | 0 |
| QA-060 | catalogo.spec | Catálogo › elegir un color de la paleta de 36 se marca, no hay tarjetas de ejemplo y se guarda | Aprobado | 4.4 s | 0 |
| QA-061 | catalogo.spec | Catálogo › color personalizado en un popover compacto: HEX y RGB sincronizados, validación, Cancelar restaura y Aplicar modifica el borrador | Aprobado | 4.3 s | 0 |
| QA-062 | catalogo.spec | Catálogo › una categoría puede heredar el color de su ámbito y lo sigue cuando cambia | Aprobado | 5.5 s | 0 |
| QA-063 | catalogo.spec | Catálogo › Armonizar paleta asigna colores distintos y se puede deshacer | Aprobado | 3.9 s | 0 |
| QA-064 | catalogo.spec | Catálogo › el color nuevo se refleja en el Dashboard | Aprobado | 3.5 s | 0 |
| QA-065 | comprobantes.spec | Comprobantes: sin archivos huérfanos › si falla el guardado tras subir el archivo, el archivo recién subido se elimina | Aprobado | 5.3 s | 0 |
| QA-066 | comprobantes.spec | Comprobantes: sin archivos huérfanos › si el borrado compensatorio también falla, queda una tarea de limpieza que se reintenta y completa | Aprobado | 5.5 s | 0 |
| QA-067 | comprobantes.spec | Comprobantes: sin archivos huérfanos › editar: un fallo no borra el comprobante existente; al guardar con éxito se elimina el reemplazado | Aprobado | 6.2 s | 0 |
| QA-068 | comprobantes.spec | Comprobantes: sin archivos huérfanos › quitar el comprobante de un gasto lo elimina solo después de guardar | Aprobado | 5.9 s | 0 |
| QA-069 | configuracion.spec | Configuración › tiene cinco secciones con navegación interna y datos de cuenta de solo lectura | Aprobado | 3.3 s | 0 |
| QA-070 | configuracion.spec | Configuración › moneda fija, zona horaria con búsqueda por teclado, vista previa de fecha y estados de guardado | Aprobado | 5.0 s | 0 |
| QA-071 | configuracion.spec | Configuración › un error al guardar se comunica y conserva los cambios | Aprobado | 2.7 s | 0 |
| QA-072 | configuracion.spec | Configuración › el tema se guarda y se aplica | Aprobado | 3.0 s | 0 |
| QA-073 | configuracion.spec | Configuración › renombra el hogar | Aprobado | 2.9 s | 0 |
| QA-074 | configuracion.spec | Configuración › actividad: resumen de 8, sin eventos de sistema, y vista completa con filtros y paginación | Aprobado | 6.4 s | 0 |
| QA-075 | configuracion.spec | Configuración › exporta CSV de gastos: nombre, UTF-8, nombres legibles, anulados opcionales y protección de fórmulas | Aprobado | 7.2 s | 0 |
| QA-076 | configuracion.spec | Configuración › el respaldo JSON pide confirmación, trae versión de esquema y no incluye secretos ni autoría | Aprobado | 4.1 s | 0 |
| QA-077 | configuracion.spec | Configuración › si la lectura falla a mitad de la exportación se avisa y no se descarga un archivo incompleto | Aprobado | 10.2 s | 0 |
| QA-078 | dashboard.spec | Dashboard › muestra KPIs, gráficos, presupuesto consolidado y paneles con datos demo | Aprobado | 3.2 s | 0 |
| QA-079 | dashboard.spec | Dashboard › alterna el Top 5 entre categorías y subcategorías | Aprobado | 3.5 s | 0 |
| QA-080 | dashboard.spec | Dashboard › seleccionar un ámbito en la dona filtra KPIs, gráficos y gastos; volver a seleccionarlo lo quita | Aprobado | 4.1 s | 0 |
| QA-081 | dashboard.spec | Dashboard › seleccionar un día con el gráfico filtra todo el panel y se quita con Limpiar filtros | Aprobado | 4.0 s | 0 |
| QA-082 | dashboard.spec | Dashboard › Top 5 categorías: una barra por nombre con la suma de todos los ámbitos | Aprobado | 3.0 s | 0 |
| QA-083 | dashboard.spec | Dashboard › seleccionar una categoría del Top 5 filtra la dona y los KPIs sin reducir el propio Top 5 | Aprobado | 3.4 s | 0 |
| QA-084 | dashboard.spec | Dashboard › los filtros se combinan (Y lógico), se quitan por chip y "Limpiar filtros" conserva el período | Aprobado | 5.1 s | 0 |
| QA-085 | dashboard.spec | Dashboard › "Ver en Gastos" conserva los criterios y la tabla coincide con los KPIs | Aprobado | 4.0 s | 0 |
| QA-086 | dashboard.spec | Dashboard › una respuesta antigua no sobrescribe a una reciente al cambiar filtros rápido | Aprobado | 9.2 s | 0 |
| QA-087 | dashboard.spec | Dashboard › el tooltip de la dona aparece al pasar el cursor y no tapa el total central | Aprobado | 3.7 s | 0 |
| QA-088 | dashboard.spec | Dashboard › los gráficos temporales muestran un tooltip con fecha, gasto del día, movimientos y acumulado | Aprobado | 3.3 s | 0 |
| QA-089 | dashboard.spec | Dashboard › el filtro por teclado: Enter en una fila de la dona activa y desactiva el filtro | Aprobado | 3.7 s | 0 |
| QA-090 | dashboard.spec | Dashboard › cambiar el período actualiza todo y compara con el anterior | Aprobado | 4.7 s | 0 |
| QA-091 | dashboard.spec | Dashboard › un rango sin gastos muestra un estado vacío y uno inválido explica el problema | Aprobado | 3.5 s | 0 |
| QA-092 | dashboard.spec | Dashboard › acceso rápido: registrar gasto desde el Dashboard sin salir de él | Aprobado | 2.9 s | 0 |
| QA-093 | dashboard.spec | Dashboard › un gasto nuevo en Gastos se refleja en los KPIs del Dashboard y al anularlo vuelve | Aprobado | 6.5 s | 0 |
| QA-094 | dashboard.spec | Dashboard › si Supabase falla, el dashboard muestra un error con opción de reintentar | Aprobado | 4.7 s | 0 |
| QA-095 | dashboard.spec | Dashboard › el tema oscuro mantiene gráficos y componentes flotantes legibles | Aprobado | 3.1 s | 0 |
| QA-096 | dashboard.spec | Dashboard: barra de filtros e indicadores › a 1440 px todos los controles caben en una sola fila, sin desborde y a la misma altura | Aprobado | 3.0 s | 0 |
| QA-097 | dashboard.spec | Dashboard: barra de filtros e indicadores › el selector de período acepta fechas personalizadas, valida el rango y limpia | Aprobado | 4.8 s | 0 |
| QA-098 | dashboard.spec | Dashboard: barra de filtros e indicadores › Ámbito, Categoría y Subcategoría se filtran entre sí y el Top 5 sigue conectado | Aprobado | 4.2 s | 0 |
| QA-099 | dashboard.spec | Dashboard: barra de filtros e indicadores › los cuatro indicadores tienen ícono y acento propios y la variación usa verde/rojo según el sentido | Aprobado | 3.1 s | 0 |
| QA-100 | dashboard.spec | Dashboard: barra de filtros e indicadores › el Presupuesto consolidado tiene encabezado degradado y los ocho indicadores en cuadrícula de 4 × 2 | Aprobado | 3.2 s | 0 |
| QA-101 | dashboard.spec | Presupuesto consolidado › caso normal: métricas, barra de consumo y disponible = asignado − imputado | Aprobado | 3.4 s | 0 |
| QA-102 | dashboard.spec | Presupuesto consolidado › presupuesto agotado: disponible exactamente cero y estado "Agotado" | Aprobado | 3.0 s | 0 |
| QA-103 | dashboard.spec | Presupuesto consolidado › presupuesto excedido: muestra el exceso real, el límite y la advertencia | Aprobado | 3.8 s | 0 |
| QA-104 | dashboard.spec | Presupuesto consolidado › con filtros activos no resta el gasto filtrado del presupuesto: lo muestra aparte | Aprobado | 3.5 s | 0 |
| QA-105 | dashboard.spec | Presupuesto consolidado › sin gasto sin fondo asignable: el indicador muestra S/ 0.00 y la ayuda se abre con teclado | Aprobado | 3.1 s | 0 |
| QA-106 | detalle-fondo.spec | Gastos imputados a un fondo › el Fondo General separa consumo directo y excedentes sin sumarlos dos veces; buscar no cambia el resumen | Aprobado | 5.4 s | 0 |
| QA-107 | detalle-fondo.spec | Gastos imputados a un fondo › un gasto compartido muestra con qué fondo, el importe de este fondo y el total del gasto | Aprobado | 3.7 s | 0 |
| QA-108 | detalle-fondo.spec | Gastos imputados a un fondo › se adapta a 360×800: filas compactas, sin recortes y con el cierre visible | Aprobado | 3.8 s | 0 |
| QA-109 | detalle-fondo.spec | Gastos imputados a un fondo › se adapta a 390×844: filas compactas, sin recortes y con el cierre visible | Aprobado | 3.8 s | 0 |
| QA-110 | detalle-fondo.spec | Gastos imputados a un fondo › se adapta a 768×1024: filas compactas, sin recortes y con el cierre visible | Aprobado | 3.8 s | 0 |
| QA-111 | detalle-fondo.spec | Gastos imputados a un fondo › se adapta a 1024×768: filas compactas, sin recortes y con el cierre visible | Aprobado | 3.8 s | 0 |
| QA-112 | detalle-fondo.spec | Gastos imputados a un fondo › un fondo sin gastos muestra un estado vacío cuidado y se adapta al contenido _(omitida: No hay un fondo sin gastos en los datos de prueba)_ | No ejecutado | 2.1 s | 0 |
| QA-113 | dialogos.spec | Fondos: la explicación de reglas está tras un icono de información junto a la X | Aprobado | 3.1 s | 0 |
| QA-114 | dialogos.spec | Diálogos: el borde de foco no se recorta › Fondos: nuevo fondo, editar fondo y presupuesto del período | Aprobado | 4.9 s | 0 |
| QA-115 | dialogos.spec | Diálogos: el borde de foco no se recorta › Gastos: nuevo gasto, plantillas y registro mensual | Falló | 30.5 s | 0 |
| QA-116 | dialogos.spec | Diálogos: el borde de foco no se recorta › Catálogo: nuevo ámbito y nueva categoría | Aprobado | 3.1 s | 0 |
| QA-117 | filtros.spec | Filtros: sin opciones repetidas › Dashboard: cada nombre aparece una sola vez (las homónimas se agrupan en una opción) | Aprobado | 3.5 s | 0 |
| QA-118 | filtros.spec | Filtros: sin opciones repetidas › Gastos: cada nombre aparece una sola vez (las homónimas se agrupan en una opción) | Aprobado | 3.1 s | 0 |
| QA-119 | filtros.spec | Filtros: sin opciones repetidas › con un ámbito elegido, las categorías siguen sin repetirse y los filtros dependientes siguen funcionando | Aprobado | 3.7 s | 0 |
| QA-120 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 1–3 · columnas proporcionales: el nombre no deja un hueco y los encabezados coinciden con sus datos | Aprobado | 3.5 s | 0 |
| QA-121 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 2 · la cobertura refleja las reglas reales del fondo | Aprobado | 3.7 s | 0 |
| QA-122 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 2 · con muchas reglas se muestran dos etiquetas, un «+N» y el detalle completo con inclusiones y exclusiones | Aprobado | 3.5 s | 0 |
| QA-123 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 6 · un fondo sin presupuesto no muestra porcentajes engañosos ni divide entre cero | Aprobado | 3.9 s | 0 |
| QA-124 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 6 · la barra de uso refleja el consumo real y el estado (habitual, atención, sobregasto) | Aprobado | 2.6 s | 0 |
| QA-125 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 8 · sin desbordes de 320 a 1920 px, con las columnas que caben y tarjetas en móvil | Falló | 8.6 s | 0 |
| QA-126 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 8 · modo oscuro: tabla y tarjetas sin desbordes | Aprobado | 3.4 s | 0 |
| QA-127 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 10 · la independencia mensual se mantiene: el mes siguiente no muestra estos fondos | Aprobado | 3.6 s | 0 |
| QA-128 | fondos.spec | Fondos presupuestales › muestra resumen, tabla compacta con el Fondo General primero y el excedente transferido | Aprobado | 3.1 s | 0 |
| QA-129 | fondos.spec | Fondos presupuestales › busca por nombre y filtra por Activos / Inactivos / Todos sin alterar los totales | Aprobado | 3.2 s | 0 |
| QA-130 | fondos.spec | Fondos presupuestales › el período cerrado muestra el histórico sin acciones de edición | Aprobado | 3.6 s | 0 |
| QA-131 | fondos.spec | Fondos presupuestales › un cambio que recalcula gastos explica su efecto y no se aplica hasta confirmar | Aprobado | 8.2 s | 0 |
| QA-132 | fondos.spec | Fondos presupuestales › crea un fondo específico con reglas, valida, lo clona y lo desactiva desde el menú | Aprobado | 6.4 s | 0 |
| QA-133 | fondos.spec | Fondos presupuestales › cambia la prioridad con el menú y arrastrando; el General sigue primero y el orden persiste | Aprobado | 5.2 s | 0 |
| QA-134 | fondos.spec | Fondos presupuestales › elimina un fondo vacío tras confirmar; cancelar no cambia nada y los totales coinciden | Aprobado | 5.9 s | 0 |
| QA-135 | fondos.spec | Fondos presupuestales › elimina un fondo con gastos imputados eligiendo un destino compatible, sin alterar los gastos | Aprobado | 9.1 s | 0 |
| QA-136 | fondos.spec | Fondos presupuestales › un mes cerrado conserva sus fondos sin acciones, y el Fondo General explica el motivo y ofrece desactivar, no eliminar | Aprobado | 4.7 s | 0 |
| QA-137 | fondos.spec | Fondos presupuestales › si la eliminación falla, se avisa y el fondo queda intacto | Aprobado | 4.4 s | 0 |
| QA-138 | fondos.spec | Fondos presupuestales › el diálogo de fondo tiene altura fija (al desplegar ámbitos no crece) y todos los diálogos aparecen centrados sin saltar | Aprobado | 3.6 s | 0 |
| QA-139 | fondos.spec | Fondos presupuestales › en móvil la tabla pasa a tarjetas compactas sin desborde y con las acciones disponibles | Aprobado | 3.4 s | 0 |
| QA-140 | gastos-diseno.spec | Gastos: tabla y detalle › la columna de selección es angosta y centrada, con estado indeterminado y barra contextual | Aprobado | 3.3 s | 0 |
| QA-141 | gastos-diseno.spec | Gastos: tabla y detalle › los chips de fondos muestran nombre e importe imputado de cada fondo | Aprobado | 3.0 s | 0 |
| QA-142 | gastos-diseno.spec | Gastos: tabla y detalle › el detalle de un gasto con varios fondos reparte el importe sin alterarlo | Aprobado | 3.4 s | 0 |
| QA-143 | gastos-diseno.spec | Gastos: tabla y detalle › el detalle de un gasto con un solo fondo y sin comprobante | Aprobado | 3.1 s | 0 |
| QA-144 | gastos-diseno.spec | Gastos: tabla y detalle › el detalle de un gasto anulado lo identifica y no ofrece editar; Editar y Duplicar abren el formulario | Aprobado | 6.4 s | 0 |
| QA-145 | gastos-diseno.spec | Gastos: tabla y detalle › las acciones de fila son botones con nombre, foco visible y la anulación pide confirmación | Aprobado | 3.8 s | 0 |
| QA-146 | gastos.spec | Gastos › crea, valida, edita, clona con la misma fecha, anula y restaura un gasto | Aprobado | 10.0 s | 0 |
| QA-147 | gastos.spec | Gastos › bloquea una combinación incompatible y explica el motivo | Aprobado | 4.8 s | 0 |
| QA-148 | gastos.spec | Gastos › el fondo agotado deriva el excedente al Fondo General en la previsualización | Aprobado | 4.6 s | 0 |
| QA-149 | gastos.spec | Gastos › los filtros se reflejan en la URL, se combinan y se limpian | Aprobado | 6.2 s | 0 |
| QA-150 | gastos.spec | Gastos › ordena, pagina y exporta con los filtros aplicados | Falló | 8.4 s | 0 |
| QA-151 | gastos.spec | Gastos › plantillas mensuales: crear, decidir "No aplica", registrar por lote y detectar lo ya registrado | Aprobado | 10.7 s | 0 |
| QA-152 | gastos.spec | Gastos › si Supabase falla, la tabla muestra un error con opción de reintentar | Aprobado | 17.9 s | 0 |
| QA-153 | iconos.spec | Selector de íconos › contraído muestra el ícono y su nombre; sugiere según el nombre y preselecciona en elementos nuevos | Aprobado | 3.0 s | 0 |
| QA-154 | iconos.spec | Selector de íconos › la elección manual gana sobre la sugerencia y no se pierde al cambiar el nombre | Aprobado | 3.2 s | 0 |
| QA-155 | iconos.spec | Selector de íconos › la cuadrícula se ajusta a los resultados (máx. ~240 px con scroll interno) y el diálogo nunca crece más que la pantalla | Aprobado | 3.4 s | 0 |
| QA-156 | iconos.spec | Selector de íconos › busca ignorando tildes y mayúsculas, por sinónimos, y muestra resultados vacíos | Aprobado | 3.2 s | 0 |
| QA-157 | iconos.spec | Selector de íconos › teclado: Enter abre y enfoca la búsqueda, flechas recorren los íconos y Escape contrae sin cerrar el diálogo | Aprobado | 2.9 s | 0 |
| QA-158 | iconos.spec | Selector de íconos › seleccionar un ícono, abrir/cerrar o cambiar de sección no envía el formulario ni borra cambios; Descartar restaura | Aprobado | 3.0 s | 0 |
| QA-159 | iconos.spec | Selector de íconos › al editar se conserva el ícono guardado (incluida una clave antigua) y compatibilidad con íconos previos | Aprobado | 3.1 s | 0 |
| QA-160 | iconos.spec | Selector de íconos › crea y edita con íconos nuevos en ámbitos, categorías, subcategorías y medios de pago; persisten tras recargar | Aprobado | 8.1 s | 0 |
| QA-161 | iconos.spec | Selector de íconos › sin desborde horizontal ni bloque fuera de pantalla en 1366×768, 1440×900, 1920×1080 y móvil | Aprobado | 4.1 s | 0 |
| QA-162 | integracion.spec | Integración entre módulos › los catálogos administrables se reflejan, con icono, en los selectores del formulario de gastos | Aprobado | 8.6 s | 0 |
| QA-163 | integracion.spec | Integración entre módulos › los gráficos del Dashboard corresponden al período y a los filtros que llevan a Gastos | Aprobado | 6.6 s | 0 |
| QA-164 | marca.spec | Acceso: identidad y rediseño › muestra Control Financiero, el logo nuevo y la pestaña «Iniciar sesión \| Control Financiero» sin rastro del nombre anterior | Aprobado | 1.1 s | 0 |
| QA-165 | marca.spec | Acceso: identidad y rediseño › el campo de contraseña se muestra y oculta sin perder el valor; Enter envía; el botón no envía | Aprobado | 2.5 s | 0 |
| QA-166 | marca.spec | Acceso: identidad y rediseño › el botón «Iniciar sesión» muestra su estado de carga y no permite un segundo envío | Aprobado | 3.1 s | 0 |
| QA-167 | marca.spec | Acceso: identidad y rediseño › Google y Facebook son solo visuales: deshabilitados, sin etiqueta «Próximamente», sin peticiones ni navegación ni sesión | Aprobado | 1.2 s | 0 |
| QA-168 | marca.spec | Acceso: identidad y rediseño › los botones sociales no compiten con «Iniciar sesión»: van debajo y el principal es el único relleno | Aprobado | 1.2 s | 0 |
| QA-169 | marca.spec | Acceso: identidad y rediseño › responsive 1920×1080 (claro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.3 s | 0 |
| QA-170 | marca.spec | Acceso: identidad y rediseño › responsive 1920×1080 (oscuro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.3 s | 0 |
| QA-171 | marca.spec | Acceso: identidad y rediseño › responsive 1440×900 (claro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.3 s | 0 |
| QA-172 | marca.spec | Acceso: identidad y rediseño › responsive 1440×900 (oscuro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.3 s | 0 |
| QA-173 | marca.spec | Acceso: identidad y rediseño › responsive 1366×768 (claro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.3 s | 0 |
| QA-174 | marca.spec | Acceso: identidad y rediseño › responsive 1366×768 (oscuro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.3 s | 0 |
| QA-175 | marca.spec | Acceso: identidad y rediseño › responsive 1280×720 (claro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.3 s | 0 |
| QA-176 | marca.spec | Acceso: identidad y rediseño › responsive 1280×720 (oscuro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.3 s | 0 |
| QA-177 | marca.spec | Acceso: identidad y rediseño › responsive 1024×768 (claro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.2 s | 0 |
| QA-178 | marca.spec | Acceso: identidad y rediseño › responsive 1024×768 (oscuro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.1 s | 0 |
| QA-179 | marca.spec | Acceso: identidad y rediseño › responsive 768×1024 (claro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.3 s | 0 |
| QA-180 | marca.spec | Acceso: identidad y rediseño › responsive 768×1024 (oscuro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.2 s | 0 |
| QA-181 | marca.spec | Acceso: identidad y rediseño › responsive 430×932 (claro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.2 s | 0 |
| QA-182 | marca.spec | Acceso: identidad y rediseño › responsive 430×932 (oscuro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.2 s | 0 |
| QA-183 | marca.spec | Acceso: identidad y rediseño › responsive 390×844 (claro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.2 s | 0 |
| QA-184 | marca.spec | Acceso: identidad y rediseño › responsive 390×844 (oscuro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.1 s | 0 |
| QA-185 | marca.spec | Acceso: identidad y rediseño › responsive 375×812 (claro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.2 s | 0 |
| QA-186 | marca.spec | Acceso: identidad y rediseño › responsive 375×812 (oscuro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.2 s | 0 |
| QA-187 | marca.spec | Acceso: identidad y rediseño › responsive 320×640 (claro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.3 s | 0 |
| QA-188 | marca.spec | Acceso: identidad y rediseño › responsive 320×640 (oscuro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.2 s | 0 |
| QA-189 | marca.spec | Acceso: identidad y rediseño › responsive 844×390 (claro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.2 s | 0 |
| QA-190 | marca.spec | Acceso: identidad y rediseño › responsive 844×390 (oscuro): sin desbordes, todo accesible con scroll y botones sociales bien distribuidos | Aprobado | 2.2 s | 0 |
| QA-191 | marca.spec | Acceso: identidad y rediseño › accesibilidad (claro): pantalla de acceso sin violaciones graves | Aprobado | 1.9 s | 0 |
| QA-192 | marca.spec | Acceso: identidad y rediseño › accesibilidad (oscuro): pantalla de acceso sin violaciones graves | Aprobado | 2.0 s | 0 |
| QA-193 | marca.spec | Acceso: identidad y rediseño › la composición del panel es decorativa: oculta a lectores de pantalla y sin datos reales ni peticiones de datos | Aprobado | 1.2 s | 0 |
| QA-194 | marca.spec | Acceso: identidad y rediseño › a 1280×720 la escena completa cabe sin scroll y nada se corta | Aprobado | 1.1 s | 0 |
| QA-195 | marca.spec | Acceso: identidad y rediseño › el botón principal usa el degradado de la marca y los sociales no compiten (borde, sin relleno) | Aprobado | 1.1 s | 0 |
| QA-196 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (1920×1080, claro) | Aprobado | 1.2 s | 0 |
| QA-197 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (1920×1080, oscuro) | Aprobado | 1.2 s | 0 |
| QA-198 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (1440×900, claro) | Aprobado | 1.2 s | 0 |
| QA-199 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (1440×900, oscuro) | Aprobado | 1.1 s | 0 |
| QA-200 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (1366×768, claro) | Aprobado | 1.2 s | 0 |
| QA-201 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (1366×768, oscuro) | Aprobado | 1.2 s | 0 |
| QA-202 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (1280×720, claro) | Aprobado | 1.2 s | 0 |
| QA-203 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (1280×720, oscuro) | Aprobado | 1.2 s | 0 |
| QA-204 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (1024×768, claro) | Aprobado | 1.1 s | 0 |
| QA-205 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (1024×768, oscuro) | Aprobado | 1.1 s | 0 |
| QA-206 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (768×1024, claro) | Aprobado | 1.1 s | 0 |
| QA-207 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (768×1024, oscuro) | Aprobado | 1.1 s | 0 |
| QA-208 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (430×932, claro) | Aprobado | 1.1 s | 0 |
| QA-209 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (430×932, oscuro) | Aprobado | 1.2 s | 0 |
| QA-210 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (390×844, claro) | Aprobado | 1.2 s | 0 |
| QA-211 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (390×844, oscuro) | Aprobado | 1.1 s | 0 |
| QA-212 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (375×812, claro) | Aprobado | 1.1 s | 0 |
| QA-213 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (375×812, oscuro) | Aprobado | 1.1 s | 0 |
| QA-214 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (320×640, claro) | Aprobado | 1.2 s | 0 |
| QA-215 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (320×640, oscuro) | Aprobado | 1.1 s | 0 |
| QA-216 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (844×390, claro) | Aprobado | 1.1 s | 0 |
| QA-217 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema queda dentro del viewport y de su pista, sin tapar ni desbordar (844×390, oscuro) | Aprobado | 1.1 s | 0 |
| QA-218 | marca.spec | Acceso: identidad y rediseño › el interruptor funciona con el teclado (Espacio e Intro) y anuncia su estado | Aprobado | 1.2 s | 0 |
| QA-219 | marca.spec | Acceso: identidad y rediseño › las tarjetas financieras se renderizan nítidas: el contenido no recibe transform, filter, perspective ni animación (claro) | Aprobado | 1.2 s | 0 |
| QA-220 | marca.spec | Acceso: identidad y rediseño › las tarjetas financieras se renderizan nítidas: el contenido no recibe transform, filter, perspective ni animación (oscuro) | Aprobado | 1.1 s | 0 |
| QA-221 | marca.spec | Acceso: identidad y rediseño › cifras con números tabulares, tipografía del proyecto y clúster sin solaparse con la tarjeta de acceso (1280–1920 px) | Aprobado | 2.1 s | 0 |
| QA-222 | marca.spec | Acceso: identidad y rediseño › el interruptor de tema cambia claro/oscuro, es un switch accesible y la preferencia se conserva al recargar | Aprobado | 1.5 s | 0 |
| QA-223 | marca.spec | Acceso: identidad y rediseño › el movimiento es sutil y con «reducir movimiento» las tarjetas dejan de animarse | Aprobado | 1.1 s | 0 |
| QA-224 | marca.spec | Acceso: identidad y rediseño › el teclado recorre el formulario en orden lógico (correo, contraseña, mostrar, olvidé, enviar) | Aprobado | 1.1 s | 0 |
| QA-225 | marca.spec | Acceso: identidad y rediseño › recuperar contraseña y sesión vencida usan la misma identidad y su título de pestaña | Aprobado | 1.5 s | 0 |
| QA-226 | marca.spec | Recursos de identidad › favicon, icono de la app y manifiesto existen, con versión, y los metadatos usan el nombre nuevo | Aprobado | 1.1 s | 0 |
| QA-227 | marca.spec | Aplicación con sesión › el inicio de sesión con correo y contraseña sigue funcionando y aterriza en «Dashboard \| Control Financiero» | Aprobado | 2.2 s | 0 |
| QA-228 | marca.spec | Aplicación con sesión › cada módulo lleva su título de pestaña y ninguna pantalla muestra el nombre anterior | Aprobado | 4.7 s | 0 |
| QA-229 | marca.spec | Aplicación con sesión › barra lateral: logo y nombre completos sin cortarse; contraída conserva solo el isotipo y la transición no mueve los iconos | Aprobado | 3.6 s | 0 |
| QA-230 | marca.spec | Aplicación con sesión › el cierre de sesión vuelve al acceso renovado | Aprobado | 2.4 s | 0 |
| QA-231 | marca.spec | Aplicación con sesión › la barra lateral y el encabezado se ven bien en tema claro (axe) | Aprobado | 3.8 s | 0 |
| QA-232 | marca.spec | Aplicación con sesión › la barra lateral y el encabezado se ven bien en tema oscuro (axe) | Aprobado | 3.7 s | 0 |
| QA-233 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 320×640 | Aprobado | 7.3 s | 0 |
| QA-234 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 375×812 | Aprobado | 7.0 s | 0 |
| QA-235 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 430×932 | Aprobado | 7.0 s | 0 |
| QA-236 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 640×360 | Aprobado | 6.9 s | 0 |
| QA-237 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 1920×1080 | Aprobado | 7.6 s | 0 |
| QA-238 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 360×800 | Aprobado | 7.0 s | 0 |
| QA-239 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 390×844 | Aprobado | 7.5 s | 0 |
| QA-240 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 768×1024 | Aprobado | 7.1 s | 0 |
| QA-241 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 1024×768 | Aprobado | 7.6 s | 0 |
| QA-242 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 1366×768 | Aprobado | 7.8 s | 0 |
| QA-243 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 1440×900 | Aprobado | 7.8 s | 0 |
| QA-244 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 844×390 | Aprobado | 7.0 s | 0 |
| QA-245 | navegacion.spec | Navegación y registro global de gastos › escritorio: botón flotante «Registrar gasto» en todas las páginas, sin cambiar de ruta y oculto con un diálogo abierto | Aprobado | 4.2 s | 0 |
| QA-246 | navegacion.spec | Navegación y registro global de gastos › guardar desde Fondos conserva ruta y filtros, refresca los datos y confirma | Aprobado | 4.6 s | 0 |
| QA-247 | navegacion.spec | Navegación y registro global de gastos › móvil: seis módulos, + central, áreas táctiles de 44 px y contenido sobre la barra | Aprobado | 10.9 s | 0 |
| QA-248 | navegacion.spec | Navegación y registro global de gastos › tablet y escritorio estrecho: barra inferior a 768 px y barra lateral compacta a 1024 px | Aprobado | 2.3 s | 0 |
| QA-249 | planificacion-optimizada.spec | Planificación: plantillas de fondos compactas › filas horizontales de poca altura con encabezados, estados Disponible/Seleccionada/Aplicada y cobertura con «+N» | Aprobado | 6.1 s | 0 |
| QA-250 | planificacion-optimizada.spec | Planificación: plantillas de fondos compactas › menú de fila: preparar fondo con el formulario, actualizar la plantilla con confirmación y duplicar | Aprobado | 6.2 s | 0 |
| QA-251 | planificacion-optimizada.spec | Planificación: etapa Gastos y Resumen › la etapa Gastos es un gestor: selecciona, edita, registra varios sin cerrar el asistente y actualiza estados; el Resumen cuadra y finaliza | Aprobado | 9.1 s | 0 |
| QA-252 | planificacion-optimizada.spec | Planificación: etapa Gastos y Resumen › el Resumen sin fondos ni gastos muestra ceros coherentes y pide confirmar las etapas | Aprobado | 4.0 s | 0 |
| QA-253 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › paginación real de 10/20/50/100, búsqueda sobre todos los registros, orden global y filtros combinados | Aprobado | 6.4 s | 0 |
| QA-254 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › scroll independiente: el diálogo no crece al expandir, los encabezados y el pie permanecen visibles | Aprobado | 4.4 s | 0 |
| QA-255 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › Fondo General: directas, compartidas y excedentes se filtran con el selector visual y no se duplican importes | Aprobado | 5.5 s | 0 |
| QA-256 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 320px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.8 s | 0 |
| QA-257 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 375px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.8 s | 0 |
| QA-258 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 390px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.8 s | 0 |
| QA-259 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 430px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.8 s | 0 |
| QA-260 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 768px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.8 s | 0 |
| QA-261 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 1024px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.9 s | 0 |
| QA-262 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 1280px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.9 s | 0 |
| QA-263 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 1366px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.9 s | 0 |
| QA-264 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 1440px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.8 s | 0 |
| QA-265 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 1920px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 4.1 s | 0 |
| QA-266 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › accesibilidad (light): modal de gastos imputados, gestor de gastos y resumen sin violaciones graves | Aprobado | 9.1 s | 0 |
| QA-267 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › accesibilidad (dark): modal de gastos imputados, gestor de gastos y resumen sin violaciones graves | Aprobado | 9.1 s | 0 |
| QA-268 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › MES_SIG se usa para fechas dentro del mes siguiente en la etapa de gastos | Aprobado | 4.9 s | 0 |
| QA-269 | planificacion.spec | Fondos independientes por mes y planificación mensual › A · un mes nuevo no hereda fondos: estado vacío con sus tres acciones | Aprobado | 3.9 s | 0 |
| QA-270 | planificacion.spec | Fondos independientes por mes y planificación mensual › B/H · copia parcial con importe editado: independiente del origen e idempotente | Aprobado | 5.4 s | 0 |
| QA-271 | planificacion.spec | Fondos independientes por mes y planificación mensual › C · editar el importe de un fondo en un mes no cambia los demás meses | Aprobado | 6.4 s | 0 |
| QA-272 | planificacion.spec | Fondos independientes por mes y planificación mensual › A · crear un fondo desde la planificación no cierra el asistente | Aprobado | 5.1 s | 0 |
| QA-273 | planificacion.spec | Fondos independientes por mes y planificación mensual › B · tres fondos seguidos sin salir del asistente, sin duplicados | Aprobado | 6.7 s | 0 |
| QA-274 | planificacion.spec | Fondos independientes por mes y planificación mensual › C · cancelar el formulario vuelve al mismo punto sin crear nada ni perder selecciones | Aprobado | 4.8 s | 0 |
| QA-275 | planificacion.spec | Fondos independientes por mes y planificación mensual › C · un error al guardar mantiene el formulario abierto con sus datos | Aprobado | 5.7 s | 0 |
| QA-276 | planificacion.spec | Fondos independientes por mes y planificación mensual › D · los estados de las etapas siguen lo confirmado, no lo visitado | Aprobado | 6.7 s | 0 |
| QA-277 | planificacion.spec | Fondos independientes por mes y planificación mensual › D · omitir una etapa la deja «Omitida», no «Completada» | Aprobado | 4.3 s | 0 |
| QA-278 | planificacion.spec | Fondos independientes por mes y planificación mensual › E · guardado progresivo: cerrar y volver conserva fondos y estados | Aprobado | 7.8 s | 0 |
| QA-279 | planificacion.spec | Fondos independientes por mes y planificación mensual › E · editar la etapa de fondos ya completada la vuelve a pendiente | Aprobado | 6.2 s | 0 |
| QA-280 | planificacion.spec | Fondos independientes por mes y planificación mensual › F · gastos mensuales: abrir plantillas y registrar por lote sin salir ni duplicar | Aprobado | 6.1 s | 0 |
| QA-281 | planificacion.spec | Fondos independientes por mes y planificación mensual › G · finalizar y volver a abrir: completada, etapas correctas y sin registros duplicados | Aprobado | 7.3 s | 0 |
| QA-282 | planificacion.spec | Fondos independientes por mes y planificación mensual › I · los meses son independientes: fondos y planificación de un mes no tocan los de otro | Aprobado | 6.0 s | 0 |
| QA-283 | planificacion.spec | Fondos independientes por mes y planificación mensual › E · con selecciones temporales sin confirmar se advierte antes de abandonar | Aprobado | 4.9 s | 0 |
| QA-284 | planificacion.spec | Fondos independientes por mes y planificación mensual › A · editar un fondo desde el asistente vuelve a la misma etapa con el dato actualizado | Aprobado | 5.6 s | 0 |
| QA-285 | planificacion.spec | Fondos independientes por mes y planificación mensual › A · tras cerrar subformularios y el asistente no quedan clics ni scroll bloqueados y el foco vuelve | Aprobado | 5.6 s | 0 |
| QA-286 | planificacion.spec | Fondos independientes por mes y planificación mensual › H · el asistente y su formulario secundario caben de 320 a 1920 px y en modo oscuro | Aprobado | 22.3 s | 0 |
| QA-287 | planificacion.spec | Fondos independientes por mes y planificación mensual › accesibilidad (axe) del estado vacío, la copia, el estado y el asistente, tema light | Aprobado | 9.6 s | 0 |
| QA-288 | planificacion.spec | Fondos independientes por mes y planificación mensual › accesibilidad (axe) del estado vacío, la copia, el estado y el asistente, tema dark | Aprobado | 9.7 s | 0 |
| QA-289 | plantillas-encabezados.spec | Plantillas de fondos: encabezados alineados con sus columnas › a 1920×1080 cada encabezado coincide con su columna (sin columnas fantasma) | Falló | 30.4 s | 0 |
| QA-290 | plantillas-encabezados.spec | Plantillas de fondos: encabezados alineados con sus columnas › a 1440×900 cada encabezado coincide con su columna (sin columnas fantasma) | Falló | 30.5 s | 0 |
| QA-291 | plantillas-encabezados.spec | Plantillas de fondos: encabezados alineados con sus columnas › a 1280×800 cada encabezado coincide con su columna (sin columnas fantasma) | Falló | 30.5 s | 0 |
| QA-292 | plantillas-encabezados.spec | Plantillas de fondos: encabezados alineados con sus columnas › a 1024×768 cada encabezado coincide con su columna (sin columnas fantasma) | Falló | 30.4 s | 0 |
| QA-293 | plantillas-gestor.spec | gestores responsive 320px: sin desbordes, con selección, edición y acción principal accesibles | Aprobado | 5.6 s | 0 |
| QA-294 | plantillas-gestor.spec | gestores responsive 375px: sin desbordes, con selección, edición y acción principal accesibles | Aprobado | 5.6 s | 0 |
| QA-295 | plantillas-gestor.spec | gestores responsive 390px: sin desbordes, con selección, edición y acción principal accesibles | Aprobado | 5.5 s | 0 |
| QA-296 | plantillas-gestor.spec | gestores responsive 430px: sin desbordes, con selección, edición y acción principal accesibles | Aprobado | 5.5 s | 0 |
| QA-297 | plantillas-gestor.spec | gestores responsive 768px: sin desbordes, con selección, edición y acción principal accesibles | Aprobado | 5.5 s | 0 |
| QA-298 | plantillas-gestor.spec | gestores responsive 1024px: sin desbordes, con selección, edición y acción principal accesibles | Aprobado | 5.7 s | 0 |
| QA-299 | plantillas-gestor.spec | gestores responsive 1280px: sin desbordes, con selección, edición y acción principal accesibles | Aprobado | 5.7 s | 0 |
| QA-300 | plantillas-gestor.spec | gestores responsive 1366px: sin desbordes, con selección, edición y acción principal accesibles | Aprobado | 5.8 s | 0 |
| QA-301 | plantillas-gestor.spec | gestores responsive 1440px: sin desbordes, con selección, edición y acción principal accesibles | Aprobado | 5.8 s | 0 |
| QA-302 | plantillas-gestor.spec | gestores responsive 1920px: sin desbordes, con selección, edición y acción principal accesibles | Aprobado | 5.7 s | 0 |
| QA-303 | plantillas-gestor.spec | gestores accesibles (light): sin violaciones graves | Aprobado | 7.5 s | 0 |
| QA-304 | plantillas-gestor.spec | gestores accesibles (dark): sin violaciones graves | Aprobado | 7.3 s | 0 |
| QA-305 | plantillas-gestor.spec | Gestor de plantillas de gastos › secciones por categoría reales del catálogo, con selección individual, por sección y de visibles (estado indeterminado) | Aprobado | 4.1 s | 0 |
| QA-306 | plantillas-gestor.spec | Gestor de plantillas de gastos › filtrar no pierde las selecciones y «Seleccionar visibles» solo toca lo que se ve | Aprobado | 3.9 s | 0 |
| QA-307 | plantillas-gestor.spec | Gestor de plantillas de gastos › edición inline (importe, medio y fechas) solo vale para el registro: se registran varias y la plantilla no cambia | Aprobado | 7.2 s | 0 |
| QA-308 | plantillas-gestor.spec | Gestor de plantillas de gastos › importe variable exige confirmación, nunca se asume cero y no se llega a la revisión con datos pendientes | Aprobado | 4.0 s | 0 |
| QA-309 | plantillas-gestor.spec | Gestor de plantillas de gastos › «Actualizar plantilla con estos valores» pide confirmación y es la única forma de cambiar la configuración original | Aprobado | 5.7 s | 0 |
| QA-310 | plantillas-gestor.spec | Gestor de plantillas de gastos › orden manual: subir/bajar y arrastrar cambian solo el orden, persisten y no tocan la clasificación; agrupar persiste | Aprobado | 7.0 s | 0 |
| QA-311 | plantillas-gestor.spec | Gestor de plantillas de fondos › secciones por tipo y por grupo propio, orden manual y prioridad propuesta editable que no toca la plantilla | Aprobado | 7.9 s | 0 |
| QA-312 | plantillas-integral.spec | Plantillas de gastos y de fondos › el formulario de plantilla de gasto es el de Nuevo gasto: mismos chips, sin comprobante ni cobertura | Aprobado | 4.2 s | 0 |
| QA-313 | plantillas-integral.spec | Plantillas de gastos y de fondos › guardar un gasto como plantilla: precarga, no copia datos reales y el gasto original no cambia | Aprobado | 6.6 s | 0 |
| QA-314 | plantillas-integral.spec | Plantillas de gastos y de fondos › registrar gastos desde una plantilla: varias veces, con ajustes y sin modificar la plantilla | Aprobado | 6.1 s | 0 |
| QA-315 | plantillas-integral.spec | Plantillas de gastos y de fondos › fondo → plantilla: copia la configuración, no el consumo ni el período, y el fondo original no cambia | Aprobado | 5.0 s | 0 |
| QA-316 | plantillas-integral.spec | Plantillas de gastos y de fondos › biblioteca de plantillas de fondos: crear, duplicar, desactivar, usar y eliminar | Aprobado | 8.8 s | 0 |
| QA-317 | plantillas-integral.spec | Plantillas de gastos y de fondos › planificación: aplicar varias plantillas ajustando importes, sin cerrar el asistente ni duplicar | Aprobado | 6.9 s | 0 |
| QA-318 | plantillas-integral.spec | Plantillas de gastos y de fondos › un mes no admite dos Fondos Generales: la segunda plantilla general queda bloqueada | Aprobado | 4.7 s | 0 |
| QA-319 | plantillas-integral.spec | Plantillas de gastos y de fondos › crear plantillas desde el asistente (formularios anidados) no cierra la planificación | Aprobado | 6.2 s | 0 |
| QA-320 | plantillas-integral.spec | Plantillas de gastos y de fondos › responsive 320px: formularios de plantilla sin desbordes y con acciones visibles | Aprobado | 5.7 s | 0 |
| QA-321 | plantillas-integral.spec | Plantillas de gastos y de fondos › responsive 375px: formularios de plantilla sin desbordes y con acciones visibles | Aprobado | 5.7 s | 0 |
| QA-322 | plantillas-integral.spec | Plantillas de gastos y de fondos › responsive 768px: formularios de plantilla sin desbordes y con acciones visibles | Aprobado | 5.4 s | 0 |
| QA-323 | plantillas-integral.spec | Plantillas de gastos y de fondos › responsive 1024px: formularios de plantilla sin desbordes y con acciones visibles | Aprobado | 5.8 s | 0 |
| QA-324 | plantillas-integral.spec | Plantillas de gastos y de fondos › responsive 1366px: formularios de plantilla sin desbordes y con acciones visibles | Aprobado | 5.6 s | 0 |
| QA-325 | plantillas-integral.spec | Plantillas de gastos y de fondos › accesibilidad (light): formulario de plantilla y biblioteca sin violaciones graves | Aprobado | 7.5 s | 0 |
| QA-326 | plantillas-integral.spec | Plantillas de gastos y de fondos › accesibilidad (dark): formulario de plantilla y biblioteca sin violaciones graves | Aprobado | 7.5 s | 0 |
| QA-327 | plantillas.spec | Plantillas mensuales › el formulario exige importe salvo que cambie cada mes, valida el día y explica la naturaleza del gasto | Aprobado | 8.8 s | 0 |
| QA-328 | plantillas.spec | Plantillas mensuales › registro mensual: importe variable pide revisión, los datos pendientes se señalan y un mes corto usa su último día | Aprobado | 10.1 s | 0 |
| QA-329 | qa-regresion.spec | Revisión de calidad: regresiones › 1 · Nuevo gasto: el foco inicial cae en el primer dato (Ámbito), no en «Cerrar» | Aprobado | 3.5 s | 0 |
| QA-330 | qa-regresion.spec | Revisión de calidad: regresiones › 2 · Guardar vacío envía el foco al primer error lógico (Ámbito), con mensajes asociados | Aprobado | 4.0 s | 0 |
| QA-331 | qa-regresion.spec | Revisión de calidad: regresiones › 3 · Gastos a 320 px: buscador y acciones en pocas filas, con nombres accesibles y Nuevo gasto a la vista | Aprobado | 3.1 s | 0 |
| QA-332 | qa-regresion.spec | Revisión de calidad: regresiones › 4 · Navegación inferior a 320 px: etiquetas completas, sin cortes y con zonas táctiles suficientes | Aprobado | 2.4 s | 0 |
| QA-333 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 320×640 | Aprobado | 10.6 s | 0 |
| QA-334 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 320×640 | Aprobado | 7.1 s | 0 |
| QA-335 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 375×812 | Aprobado | 10.7 s | 0 |
| QA-336 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 375×812 | Aprobado | 7.3 s | 0 |
| QA-337 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 390×844 | Aprobado | 10.8 s | 0 |
| QA-338 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 390×844 | Aprobado | 7.1 s | 0 |
| QA-339 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 430×932 | Aprobado | 10.8 s | 0 |
| QA-340 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 430×932 | Aprobado | 7.1 s | 0 |
| QA-341 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 768×1024 | Aprobado | 10.8 s | 0 |
| QA-342 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 768×1024 | Aprobado | 7.3 s | 0 |
| QA-343 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 1024×768 | Aprobado | 10.8 s | 0 |
| QA-344 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 1024×768 | Aprobado | 7.2 s | 0 |
| QA-345 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 1280×720 | Aprobado | 10.8 s | 0 |
| QA-346 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 1280×720 | Aprobado | 7.4 s | 0 |
| QA-347 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 1366×768 | Aprobado | 10.8 s | 0 |
| QA-348 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 1366×768 | Aprobado | 7.5 s | 0 |
| QA-349 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 1440×900 | Aprobado | 10.9 s | 0 |
| QA-350 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 1440×900 | Aprobado | 7.2 s | 0 |
| QA-351 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 1920×1080 | Aprobado | 10.7 s | 0 |
| QA-352 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 1920×1080 | Aprobado | 7.5 s | 0 |
| QA-353 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 844×390 | Aprobado | 10.8 s | 0 |
| QA-354 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 844×390 | Aprobado | 7.2 s | 0 |
| QA-355 | recuperacion.spec | restablecimiento de contraseña (Mailpit local) › el enlace del correo permite crear una contraseña nueva y luego se restaura la original | Aprobado | 10.0 s | 0 |
| QA-356 | reglas-ui.spec | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › los radios de regla cambian con flechas, Inicio y Fin y solo uno entra en el orden de tabulación | Aprobado | 3.6 s | 0 |
| QA-357 | reglas-ui.spec | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › contraer una rama no borra reglas, muestra su resumen y un ámbito incluido puede contraerse | Aprobado | 4.2 s | 0 |
| QA-358 | reglas-ui.spec | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › con cambios sin guardar, Escape, X y Cancelar piden confirmar; Seguir editando conserva el borrador y el foco vuelve al disparador | Aprobado | 5.2 s | 0 |
| QA-359 | reglas-ui.spec | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › abrir y cerrar diálogos y selectores de inmediato no hace desaparecer el siguiente | Aprobado | 10.9 s | 0 |
| QA-360 | reglas-ui.spec | Formulario de fondo: orden de campos y color › la descripción va tras los importes, el color se elige en un popover y se guarda con su nombre (no como «c1») | Aprobado | 4.5 s | 0 |
| QA-361 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 320×640 | Aprobado | 11.6 s | 0 |
| QA-362 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 375×812 | Aprobado | 11.6 s | 0 |
| QA-363 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 430×932 | Aprobado | 11.5 s | 0 |
| QA-364 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 640×360 | Aprobado | 11.6 s | 0 |
| QA-365 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 1920×1080 | Aprobado | 11.7 s | 0 |
| QA-366 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 360×800 | Aprobado | 11.6 s | 0 |
| QA-367 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 390×844 | Aprobado | 11.5 s | 0 |
| QA-368 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 768×1024 | Aprobado | 11.4 s | 0 |
| QA-369 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 1024×768 | Aprobado | 11.5 s | 0 |
| QA-370 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 1366×768 | Aprobado | 11.7 s | 0 |
| QA-371 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 1440×900 | Aprobado | 11.8 s | 0 |
| QA-372 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 844×390 | Aprobado | 11.6 s | 0 |
| QA-373 | responsive.spec | Responsive: apartados descubribles › Configuración muestra sus cinco apartados dentro de la pantalla a 360 px | Aprobado | 3.1 s | 0 |
| QA-374 | responsive.spec | Responsive: apartados descubribles › Configuración muestra sus cinco apartados dentro de la pantalla a 390 px | Aprobado | 2.9 s | 0 |
| QA-375 | responsive.spec | Responsive: apartados descubribles › Configuración muestra sus cinco apartados dentro de la pantalla a 768 px | Aprobado | 2.9 s | 0 |
| QA-376 | salud.spec | Salud financiera › responde las cuatro preguntas con datos del historial y distingue cálculo de sugerencia | Aprobado | 2.7 s | 0 |
| QA-377 | salud.spec | Salud financiera › la reducción supuesta cambia el ahorro posible y se explica el cálculo | Aprobado | 2.7 s | 0 |
| QA-378 | salud.spec | Salud financiera › un mes sin historial anterior informa datos insuficientes en vez de inventar conclusiones | Aprobado | 3.4 s | 0 |
| QA-379 | salud.spec | Salud financiera › el mes más antiguo con datos no tiene base de comparación suficiente | Aprobado | 3.4 s | 0 |
| QA-380 | salud.spec | Salud financiera › cambiar de mes recalcula el análisis | Aprobado | 2.8 s | 0 |
| QA-381 | teclado.spec | Teclado y foco › el foco es visible al navegar con Tab | Aprobado | 3.1 s | 0 |
| QA-382 | teclado.spec | Teclado y foco › un diálogo de formulario atrapa el foco, se cierra con Escape y devuelve el foco al botón que lo abrió | Aprobado | 3.6 s | 0 |
| QA-383 | teclado.spec | Teclado y foco › el cuadro de confirmación se cierra con Escape y devuelve el foco al botón de origen | Aprobado | 3.7 s | 0 |
| QA-384 | teclado.spec | Teclado y foco › Cancelar en una confirmación también devuelve el foco | Aprobado | 3.9 s | 0 |
| QA-385 | teclado.spec | Teclado y foco › tras confirmar una acción que retira la fila, el foco no se pierde en el documento | Aprobado | 5.0 s | 0 |
| QA-386 | teclado.spec | Teclado y foco › el calendario se maneja con flechas, Enter y Escape | Aprobado | 3.5 s | 0 |
| QA-387 | teclado.spec | Teclado y foco › los selectores se operan solo con teclado: abrir, buscar, navegar y elegir | Aprobado | 3.5 s | 0 |
| QA-388 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › sin «Fecha general», filtros en una sola fila, «Pendientes» como interruptor y acciones de selección discretas | Aprobado | 4.1 s | 0 |
| QA-389 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › nombres largos en una línea con tooltip, chips dentro de su columna, encabezados alineados y filas/grupos compactos | Aprobado | 3.9 s | 0 |
| QA-390 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1920px: sin desbordes ni controles cortados | Aprobado | 3.8 s | 0 |
| QA-391 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1440px: sin desbordes ni controles cortados | Aprobado | 3.8 s | 0 |
| QA-392 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1366px: sin desbordes ni controles cortados | Aprobado | 4.0 s | 0 |
| QA-393 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1280px: sin desbordes ni controles cortados | Aprobado | 3.8 s | 0 |
| QA-394 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1024px: sin desbordes ni controles cortados | Aprobado | 3.7 s | 0 |
| QA-395 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 768px: sin desbordes ni controles cortados | Aprobado | 3.8 s | 0 |
| QA-396 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 430px: sin desbordes ni controles cortados | Aprobado | 3.6 s | 0 |
| QA-397 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 390px: sin desbordes ni controles cortados | Aprobado | 3.8 s | 0 |
| QA-398 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 375px: sin desbordes ni controles cortados | Aprobado | 3.7 s | 0 |
| QA-399 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 320px: sin desbordes ni controles cortados | Aprobado | 3.7 s | 0 |
| QA-400 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › accesibilidad (light): gestor compacto y formulario sin violaciones graves | Aprobado | 6.1 s | 0 |
| QA-401 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › accesibilidad (dark): gestor compacto y formulario sin violaciones graves | Aprobado | 6.0 s | 0 |
| QA-402 | visual-plantillas.spec | Nueva plantilla de gasto: formulario simplificado › «¿El importe varía?», Día sugerido y Tipo de gasto en una fila, sin párrafos de ayuda; el guardado sigue igual | Aprobado | 5.3 s | 0 |
| QA-403 | visual-plantillas.spec | Paginación unificada › Gastos: rango breve, tamaños 10/20/50/100, números con «…», filtros y orden conservados, sin duplicados | Aprobado | 9.8 s | 0 |
| QA-404 | visual-plantillas.spec | Paginación unificada › paginador a 320px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Aprobado | 3.6 s | 0 |
| QA-405 | visual-plantillas.spec | Paginación unificada › paginador a 375px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Aprobado | 4.1 s | 0 |
| QA-406 | visual-plantillas.spec | Paginación unificada › paginador a 430px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Aprobado | 3.6 s | 0 |
| QA-407 | visual-plantillas.spec | Paginación unificada › paginador a 768px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Aprobado | 3.6 s | 0 |
| QA-408 | visual-plantillas.spec | Paginación unificada › paginador a 1366px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Aprobado | 4.1 s | 0 |
| QA-409 | visual.spec | Revisión visual y de accesibilidad › páginas completas a 1440 px, tema claro | Aprobado | 5.0 s | 0 |
| QA-410 | visual.spec | Revisión visual y de accesibilidad › páginas completas a 1440 px, tema oscuro | Aprobado | 5.3 s | 0 |
| QA-411 | visual.spec | Revisión visual y de accesibilidad › en 390 px no hay desborde horizontal y la navegación inferior funciona | Aprobado | 10.2 s | 0 |
| QA-412 | visual.spec | Revisión visual y de accesibilidad › los formularios y diálogos principales se pueden recorrer con teclado | Aprobado | 3.7 s | 0 |
| QA-413 | volumen.spec | Volumen: totales exactos con más gastos que el límite anterior › Dashboard, Gastos, Fondos y Salud incluyen todos los registros | Aprobado | 27.7 s | 0 |
