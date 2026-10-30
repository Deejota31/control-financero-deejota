# Matriz de calidad — Gasto Deejota

Generada: 30/10/2026, 4:23:43 p. m. (hora de Lima) desde `qa/resultados-e2e.json`.

## Resultado global de la suite E2E

- Pruebas ejecutadas: **336** · Aprobadas: **234** · Fallidas: **97** · Omitidas: **5**
- Duración total: **2412.5 s**

## Comandos ejecutados

| Comando | Resultado | Duración |
|---|---|---|
| `npm run build` | OK | 0.1 min |
| `npm run typecheck` | OK | 0.0 min |
| `npm run lint` | OK | 0.0 min |
| `npm test (unitarias)` | OK | 0.4 min |
| `npm run db:test (SQL)` | OK | 0.1 min |
| `npm run verify:security` | OK | 0.1 min |
| `playwright test (E2E, toda la suite)` | FALLÓ (código 1) | 40.2 min |

## Cobertura por requisito

| ID | Requisito | Archivos de prueba | Aprobadas | Falladas | Omitidas | Estado |
|---|---|---|---|---|---|---|
| R1 | Acceso y sesión | auth.spec, recuperacion.spec | 17 | 0 | 0 | Aprobado (con la cobertura listada) |
| R2 | Navegación general y preferencias | navegacion.spec, barra-lateral.spec, arranque.spec | 9 | 0 | 0 | Aprobado (con la cobertura listada) |
| R3 | Catálogo | catalogo.spec, iconos.spec | 9 | 10 | 0 | Falló |
| R4 | Fondos (página y tabla) | fondos.spec, detalle-fondo.spec, fondos-tabla.spec, reglas-ui.spec | 24 | 7 | 1 | Falló |
| R5 | Copia de fondos | planificacion.spec | 19 | 1 | 0 | Falló |
| R6 | Planificación mensual | planificacion.spec | 19 | 1 | 0 | Falló |
| R7 | Formulario de gasto y motor financiero | gastos.spec, comprobantes.spec, qa-regresion.spec, dialogos.spec | 18 | 1 | 0 | Falló |
| R8 | Listado de Gastos | gastos.spec, filtros.spec, volumen.spec, gastos-diseno.spec | 15 | 2 | 0 | Falló |
| R9 | Plantillas y registro mensual | plantillas.spec | 2 | 0 | 0 | Aprobado (con la cobertura listada) |
| R10 | Dashboard y gráficos | dashboard.spec, analisis.spec | 31 | 0 | 0 | Aprobado (con la cobertura listada) |
| R11 | Salud financiera | salud.spec | 0 | 5 | 0 | Falló |
| R12 | Configuración | configuracion.spec | 9 | 0 | 0 | Aprobado (con la cobertura listada) |
| R13 | Independencia mensual y datos | planificacion.spec, integracion.spec, volumen.spec | 20 | 3 | 0 | Falló |
| R14 | Responsive y diseño | qa-responsive.spec, responsive.spec, modales.spec, visual.spec, fondos-tabla.spec | 42 | 19 | 0 | Falló |
| R15 | Accesibilidad y casos límite | a11y.spec, teclado.spec, recuperacion.spec | 5 | 8 | 0 | Falló |

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
| F1 | a11y.spec.ts | Accesibilidad (axe) › pantallas de acceso, recuperación y sesión vencida | Error: page.evaluate: Execution context was destroyed, most likely because of a navigation | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\a11y-Accesibilidad-axe-pan-37220-cuperación-y-sesión-vencida\error-context.md |
| F2 | catalogo.spec.ts | Catálogo › administra ámbitos: crear, editar, ordenar, desactivar y eliminar | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\catalogo-Catálogo-administ-062bb-denar-desactivar-y-eliminar\error-context.md |
| F3 | catalogo.spec.ts | Catálogo › un ámbito con gastos no se elimina: se conserva el histórico | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\catalogo-Catálogo-un-ámbit-b8297-na-se-conserva-el-histórico\error-context.md |
| F4 | catalogo.spec.ts | Catálogo › los medios de pago nuevos quedan antes de "Otro" | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\catalogo-Catálogo-los-medi-ef582-uevos-quedan-antes-de-Otro-\error-context.md |
| F5 | catalogo.spec.ts | Catálogo › elegir un color de la paleta de 36 se marca, no hay tarjetas de ejemplo y se guarda | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\catalogo-Catálogo-elegir-u-c01c0-etas-de-ejemplo-y-se-guarda\error-context.md |
| F6 | catalogo.spec.ts | Catálogo › color personalizado en un popover compacto: HEX y RGB sincronizados, validación, Cancelar restaura y Aplicar modifica el borrador | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\catalogo-Catálogo-color-pe-aefc7-plicar-modifica-el-borrador\error-context.md |
| F7 | catalogo.spec.ts | Catálogo › una categoría puede heredar el color de su ámbito y lo sigue cuando cambia | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\catalogo-Catálogo-una-cate-20076-to-y-lo-sigue-cuando-cambia\error-context.md |
| F8 | fondos.spec.ts | Fondos presupuestales › elimina un fondo vacío tras confirmar; cancelar no cambia nada y los totales coinciden | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\fondos-Fondos-presupuestal-7f498-ada-y-los-totales-coinciden\error-context.md |
| F9 | fondos.spec.ts | Fondos presupuestales › elimina un fondo con gastos imputados eligiendo un destino compatible, sin alterar los gastos | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\fondos-Fondos-presupuestal-237ab-ible-sin-alterar-los-gastos\error-context.md |
| F10 | gastos.spec.ts | Gastos › bloquea una combinación incompatible y explica el motivo | Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\gastos-Gastos-bloquea-una--eefd2-patible-y-explica-el-motivo\error-context.md |
| F11 | iconos.spec.ts | Selector de íconos › seleccionar un ícono, abrir/cerrar o cambiar de sección no envía el formulario ni borra cambios; Descartar restaura | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\iconos-Selector-de-íconos--70b8e--cambios-Descartar-restaura\error-context.md |
| F12 | iconos.spec.ts | Selector de íconos › al editar se conserva el ícono guardado (incluida una clave antigua) y compatibilidad con íconos previos | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\iconos-Selector-de-íconos--6bd47-ibilidad-con-íconos-previos\error-context.md |
| F13 | iconos.spec.ts | Selector de íconos › crea y edita con íconos nuevos en ámbitos, categorías, subcategorías y medios de pago; persisten tras recargar | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\iconos-Selector-de-íconos--d67dd-ago-persisten-tras-recargar\error-context.md |
| F14 | iconos.spec.ts | Selector de íconos › sin desborde horizontal ni bloque fuera de pantalla en 1366×768, 1440×900, 1920×1080 y móvil | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\iconos-Selector-de-íconos--b7104--1440×900-1920×1080-y-móvil\error-context.md |
| F15 | integracion.spec.ts | Integración entre módulos › los catálogos administrables se reflejan, con icono, en los selectores del formulario de gastos | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\integracion-Integración-en-68770-es-del-formulario-de-gastos\error-context.md |
| F16 | planificacion-optimizada.spec.ts | Planificación: plantillas de fondos compactas › filas horizontales de poca altura con encabezados, estados Disponible/Seleccionada/Aplicada y cobertura con «+N» | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\planificacion-optimizada-P-c8993-licada-y-cobertura-con-«-N»\error-context.md |
| F17 | planificacion-optimizada.spec.ts | Planificación: etapa Gastos y Resumen › la etapa Gastos es un gestor: selecciona, edita, registra varios sin cerrar el asistente y actualiza estados; el Resumen cuadra y finaliza | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\planificacion-optimizada-P-a68bb-l-Resumen-cuadra-y-finaliza\error-context.md |
| F18 | planificacion-optimizada.spec.ts | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › accesibilidad (light): modal de gastos imputados, gestor de gastos y resumen sin violaciones graves | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\planificacion-optimizada-G-cf5e2-umen-sin-violaciones-graves\error-context.md |
| F19 | planificacion-optimizada.spec.ts | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › accesibilidad (dark): modal de gastos imputados, gestor de gastos y resumen sin violaciones graves | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\planificacion-optimizada-G-52211-umen-sin-violaciones-graves\error-context.md |
| F20 | planificacion-optimizada.spec.ts | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › MES_SIG se usa para fechas dentro del mes siguiente en la etapa de gastos | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\planificacion-optimizada-G-72afc-iente-en-la-etapa-de-gastos\error-context.md |
| F21 | planificacion.spec.ts | Fondos independientes por mes y planificación mensual › F · gastos mensuales: abrir plantillas y registrar por lote sin salir ni duplicar | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\planificacion-Fondos-indep-79e6c--lote-sin-salir-ni-duplicar\error-context.md<br>C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\planificacion-Fondos-indep-79e6c--lote-sin-salir-ni-duplicar\error-context.md |
| F22 | plantillas-gestor.spec.ts | gestores responsive 320px: sin desbordes, con selección, edición y acción principal accesibles | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-d6a2a-acción-principal-accesibles\error-context.md |
| F23 | plantillas-gestor.spec.ts | gestores responsive 375px: sin desbordes, con selección, edición y acción principal accesibles | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-1ddb8-acción-principal-accesibles\error-context.md |
| F24 | plantillas-gestor.spec.ts | gestores responsive 390px: sin desbordes, con selección, edición y acción principal accesibles | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-7cb80-acción-principal-accesibles\error-context.md |
| F25 | plantillas-gestor.spec.ts | gestores responsive 430px: sin desbordes, con selección, edición y acción principal accesibles | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-87773-acción-principal-accesibles\error-context.md |
| F26 | plantillas-gestor.spec.ts | gestores responsive 768px: sin desbordes, con selección, edición y acción principal accesibles | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-4bf00-acción-principal-accesibles\error-context.md |
| F27 | plantillas-gestor.spec.ts | gestores responsive 1024px: sin desbordes, con selección, edición y acción principal accesibles | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-f3c2f-acción-principal-accesibles\error-context.md |
| F28 | plantillas-gestor.spec.ts | gestores responsive 1280px: sin desbordes, con selección, edición y acción principal accesibles | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-c3ccf-acción-principal-accesibles\error-context.md |
| F29 | plantillas-gestor.spec.ts | gestores responsive 1366px: sin desbordes, con selección, edición y acción principal accesibles | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-d926a-acción-principal-accesibles\error-context.md |
| F30 | plantillas-gestor.spec.ts | gestores responsive 1440px: sin desbordes, con selección, edición y acción principal accesibles | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-a27d7-acción-principal-accesibles\error-context.md |
| F31 | plantillas-gestor.spec.ts | gestores responsive 1920px: sin desbordes, con selección, edición y acción principal accesibles | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-5aa19-acción-principal-accesibles\error-context.md |
| F32 | plantillas-gestor.spec.ts | gestores accesibles (light): sin violaciones graves | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-1e9bb-ight-sin-violaciones-graves\error-context.md |
| F33 | plantillas-gestor.spec.ts | gestores accesibles (dark): sin violaciones graves | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-gestores-f2411-dark-sin-violaciones-graves\error-context.md |
| F34 | plantillas-gestor.spec.ts | Gestor de plantillas de gastos › secciones por categoría reales del catálogo, con selección individual, por sección y de visibles (estado indeterminado) | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-Gestor-d-cf437-ibles-estado-indeterminado-\error-context.md |
| F35 | plantillas-gestor.spec.ts | Gestor de plantillas de gastos › filtrar no pierde las selecciones y «Seleccionar visibles» solo toca lo que se ve | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-Gestor-d-ad0fe-les»-solo-toca-lo-que-se-ve\error-context.md |
| F36 | plantillas-gestor.spec.ts | Gestor de plantillas de gastos › edición inline (importe, medio y fechas) solo vale para el registro: se registran varias y la plantilla no cambia | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-Gestor-d-b3102-as-y-la-plantilla-no-cambia\error-context.md |
| F37 | plantillas-gestor.spec.ts | Gestor de plantillas de gastos › importe variable exige confirmación, nunca se asume cero y no se llega a la revisión con datos pendientes | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-gestor-Gestor-d-23ffb-visión-con-datos-pendientes\error-context.md |
| F38 | plantillas-integral.spec.ts | Plantillas de gastos y de fondos › planificación: aplicar varias plantillas ajustando importes, sin cerrar el asistente ni duplicar | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-integral-Planti-4fb7e-ar-el-asistente-ni-duplicar\error-context.md |
| F39 | plantillas-integral.spec.ts | Plantillas de gastos y de fondos › un mes no admite dos Fondos Generales: la segunda plantilla general queda bloqueada | [31mTest timeout of 30000ms exceeded.[39m | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\plantillas-integral-Planti-125c5-lla-general-queda-bloqueada\error-context.md |
| F40 | reglas-ui.spec.ts | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › los radios de regla cambian con flechas, Inicio y Fin y solo uno entra en el orden de tabulación | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\reglas-ui-Formulario-de-fo-cafc6-a-en-el-orden-de-tabulación\error-context.md |
| F41 | reglas-ui.spec.ts | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › contraer una rama no borra reglas, muestra su resumen y un ámbito incluido puede contraerse | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\reglas-ui-Formulario-de-fo-399cc-o-incluido-puede-contraerse\error-context.md |
| F42 | reglas-ui.spec.ts | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › con cambios sin guardar, Escape, X y Cancelar piden confirmar; Seguir editando conserva el borrador y el foco vuelve al disparador | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\reglas-ui-Formulario-de-fo-19818-l-foco-vuelve-al-disparador\error-context.md |
| F43 | reglas-ui.spec.ts | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › abrir y cerrar diálogos y selectores de inmediato no hace desaparecer el siguiente | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\reglas-ui-Formulario-de-fo-35733-ce-desaparecer-el-siguiente\error-context.md |
| F44 | reglas-ui.spec.ts | Formulario de fondo: orden de campos y color › la descripción va tras los importes, el color se elige en un popover y se guarda con su nombre (no como «c1») | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\reglas-ui-Formulario-de-fo-600a3-con-su-nombre-no-como-«c1»-\error-context.md |
| F45 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 320×640 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-7e4de-nido-seis-módulos-a-320×640\error-context.md |
| F46 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 375×812 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-7dead-nido-seis-módulos-a-375×812\error-context.md |
| F47 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 430×932 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-4a0da-nido-seis-módulos-a-430×932\error-context.md |
| F48 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 640×360 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-68a77-nido-seis-módulos-a-640×360\error-context.md |
| F49 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 1920×1080 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-87acd-do-seis-módulos-a-1920×1080\error-context.md |
| F50 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 360×800 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-c461a-nido-seis-módulos-a-360×800\error-context.md |
| F51 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 390×844 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-e734f-nido-seis-módulos-a-390×844\error-context.md |
| F52 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 768×1024 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-c9f82-ido-seis-módulos-a-768×1024\error-context.md |
| F53 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 1024×768 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-a4367-ido-seis-módulos-a-1024×768\error-context.md |
| F54 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 1366×768 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-dcd6c-ido-seis-módulos-a-1366×768\error-context.md |
| F55 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 1440×900 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-8a93f-ido-seis-módulos-a-1440×900\error-context.md |
| F56 | responsive.spec.ts | Responsive: ningún módulo recorta su contenido › seis módulos a 844×390 | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-ning-e7190-nido-seis-módulos-a-844×390\error-context.md |
| F57 | responsive.spec.ts | Responsive: apartados descubribles › Configuración muestra sus cinco apartados dentro de la pantalla a 360 px | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-apar-7ec8a-tro-de-la-pantalla-a-360-px\error-context.md |
| F58 | responsive.spec.ts | Responsive: apartados descubribles › Configuración muestra sus cinco apartados dentro de la pantalla a 390 px | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-apar-24f3b-tro-de-la-pantalla-a-390-px\error-context.md |
| F59 | responsive.spec.ts | Responsive: apartados descubribles › Configuración muestra sus cinco apartados dentro de la pantalla a 768 px | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\responsive-Responsive-apar-5caf6-tro-de-la-pantalla-a-768-px\error-context.md |
| F60 | salud.spec.ts | Salud financiera › responde las cuatro preguntas con datos del historial y distingue cálculo de sugerencia | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\salud-Salud-financiera-res-a4098-ingue-cálculo-de-sugerencia\error-context.md |
| F61 | salud.spec.ts | Salud financiera › la reducción supuesta cambia el ahorro posible y se explica el cálculo | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\salud-Salud-financiera-la--1d534-ble-y-se-explica-el-cálculo\error-context.md |
| F62 | salud.spec.ts | Salud financiera › un mes sin historial anterior informa datos insuficientes en vez de inventar conclusiones | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\salud-Salud-financiera-un--2830a-ez-de-inventar-conclusiones\error-context.md |
| F63 | salud.spec.ts | Salud financiera › el mes más antiguo con datos no tiene base de comparación suficiente | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\salud-Salud-financiera-el--eb2b4-e-de-comparación-suficiente\error-context.md |
| F64 | salud.spec.ts | Salud financiera › cambiar de mes recalcula el análisis | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\salud-Salud-financiera-cambiar-de-mes-recalcula-el-análisis\error-context.md |
| F65 | teclado.spec.ts | Teclado y foco › el foco es visible al navegar con Tab | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\teclado-Teclado-y-foco-el-foco-es-visible-al-navegar-con-Tab\error-context.md |
| F66 | teclado.spec.ts | Teclado y foco › un diálogo de formulario atrapa el foco, se cierra con Escape y devuelve el foco al botón que lo abrió | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\teclado-Teclado-y-foco-un--2b88c--foco-al-botón-que-lo-abrió\error-context.md |
| F67 | teclado.spec.ts | Teclado y foco › el cuadro de confirmación se cierra con Escape y devuelve el foco al botón de origen | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\teclado-Teclado-y-foco-el--69a03--el-foco-al-botón-de-origen\error-context.md |
| F68 | teclado.spec.ts | Teclado y foco › Cancelar en una confirmación también devuelve el foco | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\teclado-Teclado-y-foco-Can-187e2-ón-también-devuelve-el-foco\error-context.md |
| F69 | teclado.spec.ts | Teclado y foco › tras confirmar una acción que retira la fila, el foco no se pierde en el documento | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\teclado-Teclado-y-foco-tra-56a29-o-se-pierde-en-el-documento\error-context.md |
| F70 | teclado.spec.ts | Teclado y foco › el calendario se maneja con flechas, Enter y Escape | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\teclado-Teclado-y-foco-el--0e33b--con-flechas-Enter-y-Escape\error-context.md |
| F71 | teclado.spec.ts | Teclado y foco › los selectores se operan solo con teclado: abrir, buscar, navegar y elegir | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\teclado-Teclado-y-foco-los-c6b3b-rir-buscar-navegar-y-elegir\error-context.md |
| F72 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › sin «Fecha general», filtros en una sola fila, «Pendientes» como interruptor y acciones de selección discretas | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-a73a8-ones-de-selección-discretas\error-context.md |
| F73 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › nombres largos en una línea con tooltip, chips dentro de su columna, encabezados alineados y filas/grupos compactos | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-999a9-os-y-filas-grupos-compactos\error-context.md |
| F74 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1920px: sin desbordes ni controles cortados | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-bcc48-ordes-ni-controles-cortados\error-context.md |
| F75 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1440px: sin desbordes ni controles cortados | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-2d94c-ordes-ni-controles-cortados\error-context.md |
| F76 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1366px: sin desbordes ni controles cortados | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-7656a-ordes-ni-controles-cortados\error-context.md |
| F77 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1280px: sin desbordes ni controles cortados | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-c8377-ordes-ni-controles-cortados\error-context.md |
| F78 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1024px: sin desbordes ni controles cortados | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-a5802-ordes-ni-controles-cortados\error-context.md |
| F79 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 768px: sin desbordes ni controles cortados | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-5c9bd-ordes-ni-controles-cortados\error-context.md |
| F80 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 430px: sin desbordes ni controles cortados | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-7ad20-ordes-ni-controles-cortados\error-context.md |
| F81 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 390px: sin desbordes ni controles cortados | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-7b6ee-ordes-ni-controles-cortados\error-context.md |
| F82 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 375px: sin desbordes ni controles cortados | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-1845f-ordes-ni-controles-cortados\error-context.md |
| F83 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 320px: sin desbordes ni controles cortados | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-7777c-ordes-ni-controles-cortados\error-context.md |
| F84 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › accesibilidad (light): gestor compacto y formulario sin violaciones graves | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-223bf-ario-sin-violaciones-graves\error-context.md |
| F85 | visual-plantillas.spec.ts | Plantillas mensuales: layout compacto y sin desbordes › accesibilidad (dark): gestor compacto y formulario sin violaciones graves | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Plantill-c21d8-ario-sin-violaciones-graves\error-context.md |
| F86 | visual-plantillas.spec.ts | Nueva plantilla de gasto: formulario simplificado › «¿El importe varía?», Día sugerido y Tipo de gasto en una fila, sin párrafos de ayuda; el guardado sigue igual | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Nueva-pl-f3734-uda-el-guardado-sigue-igual\error-context.md |
| F87 | visual-plantillas.spec.ts | Paginación unificada › Gastos: rango breve, tamaños 10/20/50/100, números con «…», filtros y orden conservados, sin duplicados | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Paginaci-c6115--conservados-sin-duplicados\error-context.md |
| F88 | visual-plantillas.spec.ts | Paginación unificada › paginador a 320px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Paginaci-86f8c-a-«n-m»-en-lugar-de-números\error-context.md |
| F89 | visual-plantillas.spec.ts | Paginación unificada › paginador a 375px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Paginaci-ec0fc-a-«n-m»-en-lugar-de-números\error-context.md |
| F90 | visual-plantillas.spec.ts | Paginación unificada › paginador a 430px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Paginaci-686c7-a-«n-m»-en-lugar-de-números\error-context.md |
| F91 | visual-plantillas.spec.ts | Paginación unificada › paginador a 768px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Paginaci-cec3d-a-«n-m»-en-lugar-de-números\error-context.md |
| F92 | visual-plantillas.spec.ts | Paginación unificada › paginador a 1366px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-plantillas-Paginaci-a7968-a-«n-m»-en-lugar-de-números\error-context.md |
| F93 | visual.spec.ts | Revisión visual y de accesibilidad › páginas completas a 1440 px, tema claro | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-Revisión-visual-y-d-3f64a-pletas-a-1440-px-tema-claro\error-context.md |
| F94 | visual.spec.ts | Revisión visual y de accesibilidad › páginas completas a 1440 px, tema oscuro | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-Revisión-visual-y-d-91685-letas-a-1440-px-tema-oscuro\error-context.md |
| F95 | visual.spec.ts | Revisión visual y de accesibilidad › en 390 px no hay desborde horizontal y la navegación inferior funciona | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-Revisión-visual-y-d-0f5dd-avegación-inferior-funciona\error-context.md |
| F96 | visual.spec.ts | Revisión visual y de accesibilidad › los formularios y diálogos principales se pueden recorrer con teclado | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\visual-Revisión-visual-y-d-64630-pueden-recorrer-con-teclado\error-context.md |
| F97 | volumen.spec.ts | Volumen: totales exactos con más gastos que el límite anterior › Dashboard, Gastos, Fondos y Salud incluyen todos los registros | Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/acceso | C:\Users\yanez\OneDrive\Documentos\controlgastosdeejota\control-financero-deejota\test-results\volumen-Volumen-totales-ex-70c3c-ncluyen-todos-los-registros\error-context.md |

## Matriz de escenarios ejecutados

| ID | Módulo (archivo) | Escenario | Estado | Duración | Reintentos |
|---|---|---|---|---|---|
| QA-001 | a11y.spec | Accesibilidad (axe) › pantallas de acceso, recuperación y sesión vencida | Falló | 4.1 s | 0 |
| QA-002 | a11y.spec | Accesibilidad (axe) › páginas principales, tema claro | Aprobado | 22.8 s | 0 |
| QA-003 | a11y.spec | Accesibilidad (axe) › diálogos y estados con datos, tema claro | Aprobado | 16.3 s | 0 |
| QA-004 | a11y.spec | Accesibilidad (axe) › páginas principales, tema oscuro | Aprobado | 23.1 s | 0 |
| QA-005 | a11y.spec | Accesibilidad (axe) › diálogos y estados con datos, tema oscuro | Aprobado | 17.2 s | 0 |
| QA-006 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Gastos: deslizar a la izquierda abre todas las acciones; el botón abre las mismas; derecha, fuera y Escape cierran; solo una fila abierta | Aprobado | 4.1 s | 0 |
| QA-007 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Gastos: vertical, gesto corto y diagonal no abren nada; la casilla y el botón siguen funcionando; el gesto no modifica datos | Aprobado | 4.0 s | 0 |
| QA-008 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Gastos: acciones no destructivas llegan a su flujo; Anular abre su confirmación y cancelarla no cambia el gasto | Aprobado | 4.3 s | 0 |
| QA-009 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Gastos anulado: muestra «Anulado», Restaurar y Editar deshabilitado con su motivo | Aprobado | 2.1 s | 0 |
| QA-010 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Fondos: el panel ofrece todas las acciones con sus restricciones; eliminar abre la simulación y se cancela | Aprobado | 3.7 s | 0 |
| QA-011 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Fondo General: sin acciones de prioridad (no existen para él) | Aprobado | 2.5 s | 0 |
| QA-012 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Catálogo a 320 px: el nombre completo es legible y el panel ofrece subir, bajar, editar, desactivar y eliminar | Aprobado | 3.8 s | 0 |
| QA-013 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Plantillas mensuales a 844 × 390: el panel cabe, se recorre por dentro y todas las acciones son alcanzables | Aprobado | 4.1 s | 0 |
| QA-014 | acciones-moviles.spec | Acciones por elemento con gesto táctil › Plantillas de fondos a 844 × 390: etiquetas comprensibles, acciones completas y una plantilla aplicada no se puede preparar otra vez | Aprobado | 3.8 s | 0 |
| QA-015 | acciones-moviles.spec | Acciones por elemento con gesto táctil › sin desplazamiento horizontal ni controles tras la barra inferior en la matriz de tamaños (con el panel abierto) | Aprobado | 19.2 s | 0 |
| QA-016 | acciones-moviles.spec | Acciones por elemento con gesto táctil › el panel abierto no tiene fallos de accesibilidad (light) | Aprobado | 3.3 s | 0 |
| QA-017 | acciones-moviles.spec | Acciones por elemento con gesto táctil › el panel abierto no tiene fallos de accesibilidad (dark) | Aprobado | 3.3 s | 0 |
| QA-018 | acciones-moviles.spec | Ventana estrecha con ratón (pointer: fine) › el botón de acciones mide ≥ 44 px, abre el panel y arrastrar con el ratón también lo abre | Aprobado | 3.2 s | 0 |
| QA-019 | acciones-moviles.spec | Ventana estrecha con ratón (pointer: fine) › escritorio 1440 × 900: la tabla de Gastos conserva sus iconos de acción y no hay panel | Aprobado | 2.5 s | 0 |
| QA-020 | acciones-moviles.spec | Ventana estrecha con ratón (pointer: fine) › menús de escritorio con poca altura: acotados a la pantalla y con desplazamiento interno (sin coordenadas negativas) | Aprobado | 2.5 s | 0 |
| QA-021 | analisis.spec | Análisis conectado del Dashboard › perfil y ranking van en una fila al final, tras Distribución y Top 5, y no queda ni el flujo ni las tarjetas anteriores | Aprobado | 2.1 s | 0 |
| QA-022 | analisis.spec | Análisis conectado del Dashboard › el cursor inspecciona con detalle y el clic filtra todo el panel sin abrir modales; Limpiar filtros lo quita | Aprobado | 3.4 s | 0 |
| QA-023 | analisis.spec | Análisis conectado del Dashboard › en móvil las tres tarjetas se apilan, el perfil pasa a barras y no hay desborde | Aprobado | 2.4 s | 0 |
| QA-024 | arranque.spec | sin sesión, la app lleva al acceso y está conectada a Supabase local | Aprobado | 1.2 s | 0 |
| QA-025 | auth.spec | rutas y errores sin sesión › protege / | Aprobado | 1.1 s | 0 |
| QA-026 | auth.spec | rutas y errores sin sesión › protege /gastos | Aprobado | 1.1 s | 0 |
| QA-027 | auth.spec | rutas y errores sin sesión › protege /fondos | Aprobado | 1.1 s | 0 |
| QA-028 | auth.spec | rutas y errores sin sesión › protege /configuracion | Aprobado | 1.0 s | 0 |
| QA-029 | auth.spec | rutas y errores sin sesión › valida campos requeridos | Aprobado | 1.2 s | 0 |
| QA-030 | auth.spec | rutas y errores sin sesión › rechaza credenciales incorrectas y orienta al usuario | Aprobado | 1.2 s | 0 |
| QA-031 | auth.spec | rutas y errores sin sesión › muestra un error claro si no hay conexión con Supabase | Aprobado | 1.1 s | 0 |
| QA-032 | auth.spec | rutas y errores sin sesión › recuperación de contraseña responde sin revelar si el correo existe | Aprobado | 1.1 s | 0 |
| QA-033 | auth.spec | rutas y errores sin sesión › un enlace de restablecimiento sin sesión se informa como vencido | Aprobado | 1.1 s | 0 |
| QA-034 | auth.spec | rutas y errores sin sesión › la pantalla de sesión vencida ofrece volver a entrar | Aprobado | 1.1 s | 0 |
| QA-035 | auth.spec | con el usuario demo local › inicia sesión, navega, conserva la sesión al recargar y cierra sesión | Aprobado | 2.0 s | 0 |
| QA-036 | auth.spec | con el usuario demo local › un usuario con sesión no ve la pantalla de acceso | Aprobado | 1.5 s | 0 |
| QA-037 | auth.spec | con el usuario demo local › guarda el perfil en Supabase y lo recupera tras recargar | Aprobado | 2.8 s | 0 |
| QA-038 | auth.spec | con el usuario demo local › el tema claro/oscuro cambia, se guarda en el perfil y persiste | Aprobado | 3.1 s | 0 |
| QA-039 | auth.spec | con el usuario demo local › la validación de contraseña nueva funciona en Configuración | Aprobado | 1.8 s | 0 |
| QA-040 | auth.spec | con el usuario demo local › en pantalla pequeña se usa la barra de navegación inferior | Aprobado | 1.4 s | 0 |
| QA-041 | barra-lateral.spec | Barra lateral: expandida y compacta › alterna entre modos por clic y teclado en los seis módulos, sin dejar márgenes vacíos | Aprobado | 27.7 s | 0 |
| QA-042 | barra-lateral.spec | Barra lateral: expandida y compacta › en modo compacto el nombre completo aparece al enfocar con teclado y la preferencia sobrevive a recargar | Aprobado | 2.2 s | 0 |
| QA-043 | barra-lateral.spec | Barra lateral: expandida y compacta › la preferencia de tablet no sobrescribe la de escritorio | Aprobado | 2.8 s | 0 |
| QA-044 | barra-lateral.spec | Barra lateral: expandida y compacta › con movimiento reducido el cambio de ancho no se anima | Aprobado | 1.3 s | 0 |
| QA-045 | capturas-acciones.spec | Capturas de acciones por elemento › capturas antes 320x640 _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-046 | capturas-acciones.spec | Capturas de acciones por elemento › capturas antes 390x844 _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-047 | capturas-acciones.spec | Capturas de acciones por elemento › capturas antes 844x390 _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-048 | capturas-acciones.spec | Capturas de acciones por elemento › capturas antes 1440x900 _(omitida: Define CAPTURAS_DIR y las credenciales E2E)_ | No ejecutado | 0.0 s | 0 |
| QA-049 | capturas-diseno.spec | Capturas de diseño: Gastos › tabla, selección y detalle a 1440 px, tema claro | Aprobado | 4.5 s | 0 |
| QA-050 | capturas-diseno.spec | Capturas de diseño: Gastos › tabla, selección y detalle a 1440 px, tema oscuro | Aprobado | 5.0 s | 0 |
| QA-051 | catalogo.spec | Catálogo › administra ámbitos: crear, editar, ordenar, desactivar y eliminar | Falló | 30.4 s | 0 |
| QA-052 | catalogo.spec | Catálogo › un ámbito con gastos no se elimina: se conserva el histórico | Falló | 30.5 s | 0 |
| QA-053 | catalogo.spec | Catálogo › los medios de pago nuevos quedan antes de "Otro" | Falló | 30.4 s | 0 |
| QA-054 | catalogo.spec | Catálogo › rechaza una categoría duplicada dentro del mismo ámbito y valida el nombre | Aprobado | 2.6 s | 0 |
| QA-055 | catalogo.spec | Catálogo › subcategorías: se filtran por ámbito y categoría | Aprobado | 1.7 s | 0 |
| QA-056 | catalogo.spec | Catálogo › elegir un color de la paleta de 36 se marca, no hay tarjetas de ejemplo y se guarda | Falló | 30.4 s | 0 |
| QA-057 | catalogo.spec | Catálogo › color personalizado en un popover compacto: HEX y RGB sincronizados, validación, Cancelar restaura y Aplicar modifica el borrador | Falló | 30.4 s | 0 |
| QA-058 | catalogo.spec | Catálogo › una categoría puede heredar el color de su ámbito y lo sigue cuando cambia | Falló | 30.4 s | 0 |
| QA-059 | catalogo.spec | Catálogo › Armonizar paleta asigna colores distintos y se puede deshacer | Aprobado | 2.9 s | 0 |
| QA-060 | catalogo.spec | Catálogo › el color nuevo se refleja en el Dashboard | Aprobado | 2.0 s | 0 |
| QA-061 | comprobantes.spec | Comprobantes: sin archivos huérfanos › si falla el guardado tras subir el archivo, el archivo recién subido se elimina | Aprobado | 4.3 s | 0 |
| QA-062 | comprobantes.spec | Comprobantes: sin archivos huérfanos › si el borrado compensatorio también falla, queda una tarea de limpieza que se reintenta y completa | Aprobado | 4.5 s | 0 |
| QA-063 | comprobantes.spec | Comprobantes: sin archivos huérfanos › editar: un fallo no borra el comprobante existente; al guardar con éxito se elimina el reemplazado | Aprobado | 4.8 s | 0 |
| QA-064 | comprobantes.spec | Comprobantes: sin archivos huérfanos › quitar el comprobante de un gasto lo elimina solo después de guardar | Aprobado | 5.3 s | 0 |
| QA-065 | configuracion.spec | Configuración › tiene cinco secciones con navegación interna y datos de cuenta de solo lectura | Aprobado | 2.6 s | 0 |
| QA-066 | configuracion.spec | Configuración › moneda fija, zona horaria con búsqueda por teclado, vista previa de fecha y estados de guardado | Aprobado | 4.0 s | 0 |
| QA-067 | configuracion.spec | Configuración › un error al guardar se comunica y conserva los cambios | Aprobado | 1.9 s | 0 |
| QA-068 | configuracion.spec | Configuración › el tema se guarda y se aplica | Aprobado | 2.0 s | 0 |
| QA-069 | configuracion.spec | Configuración › renombra el hogar | Aprobado | 1.8 s | 0 |
| QA-070 | configuracion.spec | Configuración › actividad: resumen de 8, sin eventos de sistema, y vista completa con filtros y paginación | Aprobado | 5.5 s | 0 |
| QA-071 | configuracion.spec | Configuración › exporta CSV de gastos: nombre, UTF-8, nombres legibles, anulados opcionales y protección de fórmulas | Aprobado | 6.6 s | 0 |
| QA-072 | configuracion.spec | Configuración › el respaldo JSON pide confirmación, trae versión de esquema y no incluye secretos ni autoría | Aprobado | 3.6 s | 0 |
| QA-073 | configuracion.spec | Configuración › si la lectura falla a mitad de la exportación se avisa y no se descarga un archivo incompleto | Aprobado | 9.3 s | 0 |
| QA-074 | dashboard.spec | Dashboard › muestra KPIs, gráficos, presupuesto consolidado y paneles con datos demo | Aprobado | 2.3 s | 0 |
| QA-075 | dashboard.spec | Dashboard › alterna el Top 5 entre categorías y subcategorías | Aprobado | 2.2 s | 0 |
| QA-076 | dashboard.spec | Dashboard › seleccionar un ámbito en la dona filtra KPIs, gráficos y gastos; volver a seleccionarlo lo quita | Aprobado | 3.3 s | 0 |
| QA-077 | dashboard.spec | Dashboard › seleccionar un día con el gráfico filtra todo el panel y se quita con Limpiar filtros | Aprobado | 2.8 s | 0 |
| QA-078 | dashboard.spec | Dashboard › Top 5 categorías: una barra por nombre con la suma de todos los ámbitos | Aprobado | 2.1 s | 0 |
| QA-079 | dashboard.spec | Dashboard › seleccionar una categoría del Top 5 filtra la dona y los KPIs sin reducir el propio Top 5 | Aprobado | 2.3 s | 0 |
| QA-080 | dashboard.spec | Dashboard › los filtros se combinan (Y lógico), se quitan por chip y "Limpiar filtros" conserva el período | Aprobado | 4.1 s | 0 |
| QA-081 | dashboard.spec | Dashboard › "Ver en Gastos" conserva los criterios y la tabla coincide con los KPIs | Aprobado | 2.9 s | 0 |
| QA-082 | dashboard.spec | Dashboard › una respuesta antigua no sobrescribe a una reciente al cambiar filtros rápido | Aprobado | 8.7 s | 0 |
| QA-083 | dashboard.spec | Dashboard › el tooltip de la dona aparece al pasar el cursor y no tapa el total central | Aprobado | 2.4 s | 0 |
| QA-084 | dashboard.spec | Dashboard › los gráficos temporales muestran un tooltip con fecha, gasto del día, movimientos y acumulado | Aprobado | 2.2 s | 0 |
| QA-085 | dashboard.spec | Dashboard › el filtro por teclado: Enter en una fila de la dona activa y desactiva el filtro | Aprobado | 2.3 s | 0 |
| QA-086 | dashboard.spec | Dashboard › cambiar el período actualiza todo y compara con el anterior | Aprobado | 3.4 s | 0 |
| QA-087 | dashboard.spec | Dashboard › un rango sin gastos muestra un estado vacío y uno inválido explica el problema | Aprobado | 2.9 s | 0 |
| QA-088 | dashboard.spec | Dashboard › acceso rápido: registrar gasto desde el Dashboard sin salir de él | Aprobado | 2.1 s | 0 |
| QA-089 | dashboard.spec | Dashboard › un gasto nuevo en Gastos se refleja en los KPIs del Dashboard y al anularlo vuelve | Aprobado | 5.2 s | 0 |
| QA-090 | dashboard.spec | Dashboard › si Supabase falla, el dashboard muestra un error con opción de reintentar | Aprobado | 3.5 s | 0 |
| QA-091 | dashboard.spec | Dashboard › el tema oscuro mantiene gráficos y componentes flotantes legibles | Aprobado | 2.1 s | 0 |
| QA-092 | dashboard.spec | Dashboard: barra de filtros e indicadores › a 1440 px todos los controles caben en una sola fila, sin desborde y a la misma altura | Aprobado | 2.0 s | 0 |
| QA-093 | dashboard.spec | Dashboard: barra de filtros e indicadores › el selector de período acepta fechas personalizadas, valida el rango y limpia | Aprobado | 3.7 s | 0 |
| QA-094 | dashboard.spec | Dashboard: barra de filtros e indicadores › Ámbito, Categoría y Subcategoría se filtran entre sí y el Top 5 sigue conectado | Aprobado | 3.1 s | 0 |
| QA-095 | dashboard.spec | Dashboard: barra de filtros e indicadores › los cuatro indicadores tienen ícono y acento propios y la variación usa verde/rojo según el sentido | Aprobado | 2.1 s | 0 |
| QA-096 | dashboard.spec | Dashboard: barra de filtros e indicadores › el Presupuesto consolidado tiene encabezado degradado y los ocho indicadores en cuadrícula de 4 × 2 | Aprobado | 2.1 s | 0 |
| QA-097 | dashboard.spec | Presupuesto consolidado › caso normal: métricas, barra de consumo y disponible = asignado − imputado | Aprobado | 2.2 s | 0 |
| QA-098 | dashboard.spec | Presupuesto consolidado › presupuesto agotado: disponible exactamente cero y estado "Agotado" | Aprobado | 2.0 s | 0 |
| QA-099 | dashboard.spec | Presupuesto consolidado › presupuesto excedido: muestra el exceso real, el límite y la advertencia | Aprobado | 2.7 s | 0 |
| QA-100 | dashboard.spec | Presupuesto consolidado › con filtros activos no resta el gasto filtrado del presupuesto: lo muestra aparte | Aprobado | 2.2 s | 0 |
| QA-101 | dashboard.spec | Presupuesto consolidado › sin gasto sin fondo asignable: el indicador muestra S/ 0.00 y la ayuda se abre con teclado | Aprobado | 2.0 s | 0 |
| QA-102 | detalle-fondo.spec | Gastos imputados a un fondo › el Fondo General separa consumo directo y excedentes sin sumarlos dos veces; buscar no cambia el resumen | Aprobado | 4.2 s | 0 |
| QA-103 | detalle-fondo.spec | Gastos imputados a un fondo › un gasto compartido muestra con qué fondo, el importe de este fondo y el total del gasto | Aprobado | 2.6 s | 0 |
| QA-104 | detalle-fondo.spec | Gastos imputados a un fondo › se adapta a 360×800: filas compactas, sin recortes y con el cierre visible | Aprobado | 2.9 s | 0 |
| QA-105 | detalle-fondo.spec | Gastos imputados a un fondo › se adapta a 390×844: filas compactas, sin recortes y con el cierre visible | Aprobado | 2.8 s | 0 |
| QA-106 | detalle-fondo.spec | Gastos imputados a un fondo › se adapta a 768×1024: filas compactas, sin recortes y con el cierre visible | Aprobado | 2.9 s | 0 |
| QA-107 | detalle-fondo.spec | Gastos imputados a un fondo › se adapta a 1024×768: filas compactas, sin recortes y con el cierre visible | Aprobado | 2.9 s | 0 |
| QA-108 | detalle-fondo.spec | Gastos imputados a un fondo › un fondo sin gastos muestra un estado vacío cuidado y se adapta al contenido _(omitida: No hay un fondo sin gastos en los datos de prueba)_ | No ejecutado | 1.5 s | 0 |
| QA-109 | dialogos.spec | Fondos: la explicación de reglas está tras un icono de información junto a la X | Aprobado | 2.2 s | 0 |
| QA-110 | dialogos.spec | Diálogos: el borde de foco no se recorta › Fondos: nuevo fondo, editar fondo y presupuesto del período | Aprobado | 3.4 s | 0 |
| QA-111 | dialogos.spec | Diálogos: el borde de foco no se recorta › Gastos: nuevo gasto, plantillas y registro mensual | Aprobado | 3.3 s | 0 |
| QA-112 | dialogos.spec | Diálogos: el borde de foco no se recorta › Catálogo: nuevo ámbito y nueva categoría | Aprobado | 2.4 s | 0 |
| QA-113 | filtros.spec | Filtros: sin opciones repetidas › Dashboard: cada nombre aparece una sola vez (las homónimas se agrupan en una opción) | Aprobado | 2.5 s | 0 |
| QA-114 | filtros.spec | Filtros: sin opciones repetidas › Gastos: cada nombre aparece una sola vez (las homónimas se agrupan en una opción) | Aprobado | 2.1 s | 0 |
| QA-115 | filtros.spec | Filtros: sin opciones repetidas › con un ámbito elegido, las categorías siguen sin repetirse y los filtros dependientes siguen funcionando | Aprobado | 2.4 s | 0 |
| QA-116 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 1–3 · columnas proporcionales: el nombre no deja un hueco y los encabezados coinciden con sus datos | Aprobado | 2.4 s | 0 |
| QA-117 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 2 · la cobertura refleja las reglas reales del fondo | Aprobado | 2.7 s | 0 |
| QA-118 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 2 · con muchas reglas se muestran dos etiquetas, un «+N» y el detalle completo con inclusiones y exclusiones | Aprobado | 3.1 s | 0 |
| QA-119 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 6 · un fondo sin presupuesto no muestra porcentajes engañosos ni divide entre cero | Aprobado | 2.8 s | 0 |
| QA-120 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 6 · la barra de uso refleja el consumo real y el estado (habitual, atención, sobregasto) | Aprobado | 1.6 s | 0 |
| QA-121 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 8 · sin desbordes de 320 a 1920 px, con las columnas que caben y tarjetas en móvil | Aprobado | 10.9 s | 0 |
| QA-122 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 8 · modo oscuro: tabla y tarjetas sin desbordes | Aprobado | 2.1 s | 0 |
| QA-123 | fondos-tabla.spec | Tabla de Fondos: distribución, cobertura y uso › 10 · la independencia mensual se mantiene: el mes siguiente no muestra estos fondos | Aprobado | 2.5 s | 0 |
| QA-124 | fondos.spec | Fondos presupuestales › muestra resumen, tabla compacta con el Fondo General primero y el excedente transferido | Aprobado | 2.6 s | 0 |
| QA-125 | fondos.spec | Fondos presupuestales › busca por nombre y filtra por Activos / Inactivos / Todos sin alterar los totales | Aprobado | 2.1 s | 0 |
| QA-126 | fondos.spec | Fondos presupuestales › el período cerrado muestra el histórico sin acciones de edición | Aprobado | 2.1 s | 0 |
| QA-127 | fondos.spec | Fondos presupuestales › un cambio que recalcula gastos explica su efecto y no se aplica hasta confirmar | Aprobado | 7.2 s | 0 |
| QA-128 | fondos.spec | Fondos presupuestales › crea un fondo específico con reglas, valida, lo clona y lo desactiva desde el menú | Aprobado | 5.6 s | 0 |
| QA-129 | fondos.spec | Fondos presupuestales › cambia la prioridad con el menú y arrastrando; el General sigue primero y el orden persiste | Aprobado | 3.8 s | 0 |
| QA-130 | fondos.spec | Fondos presupuestales › elimina un fondo vacío tras confirmar; cancelar no cambia nada y los totales coinciden | Falló | 9.4 s | 0 |
| QA-131 | fondos.spec | Fondos presupuestales › elimina un fondo con gastos imputados eligiendo un destino compatible, sin alterar los gastos | Falló | 12.0 s | 0 |
| QA-132 | fondos.spec | Fondos presupuestales › un mes cerrado conserva sus fondos sin acciones, y el Fondo General explica el motivo y ofrece desactivar, no eliminar | Aprobado | 4.7 s | 0 |
| QA-133 | fondos.spec | Fondos presupuestales › si la eliminación falla, se avisa y el fondo queda intacto | Aprobado | 3.6 s | 0 |
| QA-134 | fondos.spec | Fondos presupuestales › el diálogo de fondo tiene altura fija (al desplegar ámbitos no crece) y todos los diálogos aparecen centrados sin saltar | Aprobado | 2.6 s | 0 |
| QA-135 | fondos.spec | Fondos presupuestales › en móvil la tabla pasa a tarjetas compactas sin desborde y con las acciones disponibles | Aprobado | 2.4 s | 0 |
| QA-136 | gastos-diseno.spec | Gastos: tabla y detalle › la columna de selección es angosta y centrada, con estado indeterminado y barra contextual | Aprobado | 2.1 s | 0 |
| QA-137 | gastos-diseno.spec | Gastos: tabla y detalle › los chips de fondos muestran nombre e importe imputado de cada fondo | Aprobado | 2.0 s | 0 |
| QA-138 | gastos-diseno.spec | Gastos: tabla y detalle › el detalle de un gasto con varios fondos reparte el importe sin alterarlo | Aprobado | 2.4 s | 0 |
| QA-139 | gastos-diseno.spec | Gastos: tabla y detalle › el detalle de un gasto con un solo fondo y sin comprobante | Aprobado | 2.1 s | 0 |
| QA-140 | gastos-diseno.spec | Gastos: tabla y detalle › el detalle de un gasto anulado lo identifica y no ofrece editar; Editar y Duplicar abren el formulario | Aprobado | 5.2 s | 0 |
| QA-141 | gastos-diseno.spec | Gastos: tabla y detalle › las acciones de fila son botones con nombre, foco visible y la anulación pide confirmación | Aprobado | 2.4 s | 0 |
| QA-142 | gastos.spec | Gastos › crea, valida, edita, clona con la misma fecha, anula y restaura un gasto | Aprobado | 9.2 s | 0 |
| QA-143 | gastos.spec | Gastos › bloquea una combinación incompatible y explica el motivo | Falló | 8.1 s | 0 |
| QA-144 | gastos.spec | Gastos › el fondo agotado deriva el excedente al Fondo General en la previsualización | Aprobado | 3.8 s | 0 |
| QA-145 | gastos.spec | Gastos › los filtros se reflejan en la URL, se combinan y se limpian | Aprobado | 5.2 s | 0 |
| QA-146 | gastos.spec | Gastos › ordena, pagina y exporta con los filtros aplicados | Aprobado | 3.6 s | 0 |
| QA-147 | gastos.spec | Gastos › plantillas mensuales: crear, decidir "No aplica", registrar por lote y detectar lo ya registrado | Aprobado | 9.6 s | 0 |
| QA-148 | gastos.spec | Gastos › si Supabase falla, la tabla muestra un error con opción de reintentar | Aprobado | 16.9 s | 0 |
| QA-149 | iconos.spec | Selector de íconos › contraído muestra el ícono y su nombre; sugiere según el nombre y preselecciona en elementos nuevos | Aprobado | 1.8 s | 0 |
| QA-150 | iconos.spec | Selector de íconos › la elección manual gana sobre la sugerencia y no se pierde al cambiar el nombre | Aprobado | 2.0 s | 0 |
| QA-151 | iconos.spec | Selector de íconos › la cuadrícula se ajusta a los resultados (máx. ~240 px con scroll interno) y el diálogo nunca crece más que la pantalla | Aprobado | 2.4 s | 0 |
| QA-152 | iconos.spec | Selector de íconos › busca ignorando tildes y mayúsculas, por sinónimos, y muestra resultados vacíos | Aprobado | 2.3 s | 0 |
| QA-153 | iconos.spec | Selector de íconos › teclado: Enter abre y enfoca la búsqueda, flechas recorren los íconos y Escape contrae sin cerrar el diálogo | Aprobado | 2.0 s | 0 |
| QA-154 | iconos.spec | Selector de íconos › seleccionar un ícono, abrir/cerrar o cambiar de sección no envía el formulario ni borra cambios; Descartar restaura | Falló | 30.4 s | 0 |
| QA-155 | iconos.spec | Selector de íconos › al editar se conserva el ícono guardado (incluida una clave antigua) y compatibilidad con íconos previos | Falló | 30.4 s | 0 |
| QA-156 | iconos.spec | Selector de íconos › crea y edita con íconos nuevos en ámbitos, categorías, subcategorías y medios de pago; persisten tras recargar | Falló | 30.4 s | 0 |
| QA-157 | iconos.spec | Selector de íconos › sin desborde horizontal ni bloque fuera de pantalla en 1366×768, 1440×900, 1920×1080 y móvil | Falló | 30.4 s | 0 |
| QA-158 | integracion.spec | Integración entre módulos › los catálogos administrables se reflejan, con icono, en los selectores del formulario de gastos | Falló | 30.4 s | 0 |
| QA-159 | integracion.spec | Integración entre módulos › los gráficos del Dashboard corresponden al período y a los filtros que llevan a Gastos | Aprobado | 5.8 s | 0 |
| QA-160 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 320×640 | Aprobado | 6.1 s | 0 |
| QA-161 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 375×812 | Aprobado | 6.5 s | 0 |
| QA-162 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 430×932 | Aprobado | 6.6 s | 0 |
| QA-163 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 640×360 | Aprobado | 6.5 s | 0 |
| QA-164 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 1920×1080 | Aprobado | 7.3 s | 0 |
| QA-165 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 360×800 | Aprobado | 6.4 s | 0 |
| QA-166 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 390×844 | Aprobado | 6.4 s | 0 |
| QA-167 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 768×1024 | Aprobado | 6.3 s | 0 |
| QA-168 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 1024×768 | Aprobado | 6.8 s | 0 |
| QA-169 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 1366×768 | Aprobado | 6.7 s | 0 |
| QA-170 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 1440×900 | Aprobado | 6.7 s | 0 |
| QA-171 | modales.spec | Modales: acciones visibles y campos contenidos en todos los tamaños › Nuevo gasto, Nuevo fondo y editor de catálogo a 844×390 | Aprobado | 6.4 s | 0 |
| QA-172 | navegacion.spec | Navegación y registro global de gastos › escritorio: botón flotante «Registrar gasto» en todas las páginas, sin cambiar de ruta y oculto con un diálogo abierto | Aprobado | 3.1 s | 0 |
| QA-173 | navegacion.spec | Navegación y registro global de gastos › guardar desde Fondos conserva ruta y filtros, refresca los datos y confirma | Aprobado | 3.8 s | 0 |
| QA-174 | navegacion.spec | Navegación y registro global de gastos › móvil: seis módulos, + central, áreas táctiles de 44 px y contenido sobre la barra | Aprobado | 10.1 s | 0 |
| QA-175 | navegacion.spec | Navegación y registro global de gastos › tablet y escritorio estrecho: barra inferior a 768 px y barra lateral compacta a 1024 px | Aprobado | 1.4 s | 0 |
| QA-176 | planificacion-optimizada.spec | Planificación: plantillas de fondos compactas › filas horizontales de poca altura con encabezados, estados Disponible/Seleccionada/Aplicada y cobertura con «+N» | Falló | 30.5 s | 0 |
| QA-177 | planificacion-optimizada.spec | Planificación: plantillas de fondos compactas › menú de fila: preparar fondo con el formulario, actualizar la plantilla con confirmación y duplicar | Aprobado | 5.5 s | 0 |
| QA-178 | planificacion-optimizada.spec | Planificación: etapa Gastos y Resumen › la etapa Gastos es un gestor: selecciona, edita, registra varios sin cerrar el asistente y actualiza estados; el Resumen cuadra y finaliza | Falló | 30.4 s | 0 |
| QA-179 | planificacion-optimizada.spec | Planificación: etapa Gastos y Resumen › el Resumen sin fondos ni gastos muestra ceros coherentes y pide confirmar las etapas | Aprobado | 3.2 s | 0 |
| QA-180 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › paginación real de 10/20/50/100, búsqueda sobre todos los registros, orden global y filtros combinados | Aprobado | 5.1 s | 0 |
| QA-181 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › scroll independiente: el diálogo no crece al expandir, los encabezados y el pie permanecen visibles | Aprobado | 3.6 s | 0 |
| QA-182 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › Fondo General: directas, compartidas y excedentes se filtran con el selector visual y no se duplican importes | Aprobado | 4.5 s | 0 |
| QA-183 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 320px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.0 s | 0 |
| QA-184 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 375px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 2.8 s | 0 |
| QA-185 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 390px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 2.8 s | 0 |
| QA-186 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 430px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.0 s | 0 |
| QA-187 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 768px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 2.9 s | 0 |
| QA-188 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 1024px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 2.9 s | 0 |
| QA-189 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 1280px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 2.8 s | 0 |
| QA-190 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 1366px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 2.8 s | 0 |
| QA-191 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 1440px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 2.9 s | 0 |
| QA-192 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › responsive 1920px: filtros, listado y paginación sin desbordes y con el pie accesible | Aprobado | 3.0 s | 0 |
| QA-193 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › accesibilidad (light): modal de gastos imputados, gestor de gastos y resumen sin violaciones graves | Falló | 30.5 s | 0 |
| QA-194 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › accesibilidad (dark): modal de gastos imputados, gestor de gastos y resumen sin violaciones graves | Falló | 30.4 s | 0 |
| QA-195 | planificacion-optimizada.spec | Gastos imputados a un fondo: filtros, paginación real y scroll independiente › MES_SIG se usa para fechas dentro del mes siguiente en la etapa de gastos | Falló | 30.5 s | 0 |
| QA-196 | planificacion.spec | Fondos independientes por mes y planificación mensual › A · un mes nuevo no hereda fondos: estado vacío con sus tres acciones | Aprobado | 3.1 s | 0 |
| QA-197 | planificacion.spec | Fondos independientes por mes y planificación mensual › B/H · copia parcial con importe editado: independiente del origen e idempotente | Aprobado | 4.6 s | 0 |
| QA-198 | planificacion.spec | Fondos independientes por mes y planificación mensual › C · editar el importe de un fondo en un mes no cambia los demás meses | Aprobado | 5.5 s | 0 |
| QA-199 | planificacion.spec | Fondos independientes por mes y planificación mensual › A · crear un fondo desde la planificación no cierra el asistente | Aprobado | 4.2 s | 0 |
| QA-200 | planificacion.spec | Fondos independientes por mes y planificación mensual › B · tres fondos seguidos sin salir del asistente, sin duplicados | Aprobado | 6.1 s | 0 |
| QA-201 | planificacion.spec | Fondos independientes por mes y planificación mensual › C · cancelar el formulario vuelve al mismo punto sin crear nada ni perder selecciones | Aprobado | 3.8 s | 0 |
| QA-202 | planificacion.spec | Fondos independientes por mes y planificación mensual › C · un error al guardar mantiene el formulario abierto con sus datos | Aprobado | 4.6 s | 0 |
| QA-203 | planificacion.spec | Fondos independientes por mes y planificación mensual › D · los estados de las etapas siguen lo confirmado, no lo visitado | Aprobado | 5.6 s | 0 |
| QA-204 | planificacion.spec | Fondos independientes por mes y planificación mensual › D · omitir una etapa la deja «Omitida», no «Completada» | Aprobado | 3.4 s | 0 |
| QA-205 | planificacion.spec | Fondos independientes por mes y planificación mensual › E · guardado progresivo: cerrar y volver conserva fondos y estados | Aprobado | 6.8 s | 0 |
| QA-206 | planificacion.spec | Fondos independientes por mes y planificación mensual › E · editar la etapa de fondos ya completada la vuelve a pendiente | Aprobado | 5.3 s | 0 |
| QA-207 | planificacion.spec | Fondos independientes por mes y planificación mensual › F · gastos mensuales: abrir plantillas y registrar por lote sin salir ni duplicar | Falló | 30.5 s | 0 |
| QA-208 | planificacion.spec | Fondos independientes por mes y planificación mensual › G · finalizar y volver a abrir: completada, etapas correctas y sin registros duplicados | Aprobado | 6.9 s | 0 |
| QA-209 | planificacion.spec | Fondos independientes por mes y planificación mensual › I · los meses son independientes: fondos y planificación de un mes no tocan los de otro | Aprobado | 5.2 s | 0 |
| QA-210 | planificacion.spec | Fondos independientes por mes y planificación mensual › E · con selecciones temporales sin confirmar se advierte antes de abandonar | Aprobado | 4.0 s | 0 |
| QA-211 | planificacion.spec | Fondos independientes por mes y planificación mensual › A · editar un fondo desde el asistente vuelve a la misma etapa con el dato actualizado | Aprobado | 4.7 s | 0 |
| QA-212 | planificacion.spec | Fondos independientes por mes y planificación mensual › A · tras cerrar subformularios y el asistente no quedan clics ni scroll bloqueados y el foco vuelve | Aprobado | 4.5 s | 0 |
| QA-213 | planificacion.spec | Fondos independientes por mes y planificación mensual › H · el asistente y su formulario secundario caben de 320 a 1920 px y en modo oscuro | Aprobado | 21.4 s | 0 |
| QA-214 | planificacion.spec | Fondos independientes por mes y planificación mensual › accesibilidad (axe) del estado vacío, la copia, el estado y el asistente, tema light | Aprobado | 8.5 s | 0 |
| QA-215 | planificacion.spec | Fondos independientes por mes y planificación mensual › accesibilidad (axe) del estado vacío, la copia, el estado y el asistente, tema dark | Aprobado | 8.7 s | 0 |
| QA-216 | plantillas-gestor.spec | gestores responsive 320px: sin desbordes, con selección, edición y acción principal accesibles | Falló | 30.5 s | 0 |
| QA-217 | plantillas-gestor.spec | gestores responsive 375px: sin desbordes, con selección, edición y acción principal accesibles | Falló | 30.5 s | 0 |
| QA-218 | plantillas-gestor.spec | gestores responsive 390px: sin desbordes, con selección, edición y acción principal accesibles | Falló | 30.5 s | 0 |
| QA-219 | plantillas-gestor.spec | gestores responsive 430px: sin desbordes, con selección, edición y acción principal accesibles | Falló | 30.5 s | 0 |
| QA-220 | plantillas-gestor.spec | gestores responsive 768px: sin desbordes, con selección, edición y acción principal accesibles | Falló | 30.5 s | 0 |
| QA-221 | plantillas-gestor.spec | gestores responsive 1024px: sin desbordes, con selección, edición y acción principal accesibles | Falló | 30.5 s | 0 |
| QA-222 | plantillas-gestor.spec | gestores responsive 1280px: sin desbordes, con selección, edición y acción principal accesibles | Falló | 30.6 s | 0 |
| QA-223 | plantillas-gestor.spec | gestores responsive 1366px: sin desbordes, con selección, edición y acción principal accesibles | Falló | 30.5 s | 0 |
| QA-224 | plantillas-gestor.spec | gestores responsive 1440px: sin desbordes, con selección, edición y acción principal accesibles | Falló | 30.5 s | 0 |
| QA-225 | plantillas-gestor.spec | gestores responsive 1920px: sin desbordes, con selección, edición y acción principal accesibles | Falló | 30.5 s | 0 |
| QA-226 | plantillas-gestor.spec | gestores accesibles (light): sin violaciones graves | Falló | 30.5 s | 0 |
| QA-227 | plantillas-gestor.spec | gestores accesibles (dark): sin violaciones graves | Falló | 30.5 s | 0 |
| QA-228 | plantillas-gestor.spec | Gestor de plantillas de gastos › secciones por categoría reales del catálogo, con selección individual, por sección y de visibles (estado indeterminado) | Falló | 30.6 s | 0 |
| QA-229 | plantillas-gestor.spec | Gestor de plantillas de gastos › filtrar no pierde las selecciones y «Seleccionar visibles» solo toca lo que se ve | Falló | 30.5 s | 0 |
| QA-230 | plantillas-gestor.spec | Gestor de plantillas de gastos › edición inline (importe, medio y fechas) solo vale para el registro: se registran varias y la plantilla no cambia | Falló | 30.6 s | 0 |
| QA-231 | plantillas-gestor.spec | Gestor de plantillas de gastos › importe variable exige confirmación, nunca se asume cero y no se llega a la revisión con datos pendientes | Falló | 30.5 s | 0 |
| QA-232 | plantillas-gestor.spec | Gestor de plantillas de gastos › «Actualizar plantilla con estos valores» pide confirmación y es la única forma de cambiar la configuración original | Aprobado | 4.9 s | 0 |
| QA-233 | plantillas-gestor.spec | Gestor de plantillas de gastos › orden manual: subir/bajar y arrastrar cambian solo el orden, persisten y no tocan la clasificación; agrupar persiste | Aprobado | 6.3 s | 0 |
| QA-234 | plantillas-gestor.spec | Gestor de plantillas de fondos › secciones por tipo y por grupo propio, orden manual y prioridad propuesta editable que no toca la plantilla | Aprobado | 7.1 s | 0 |
| QA-235 | plantillas-integral.spec | Plantillas de gastos y de fondos › el formulario de plantilla de gasto es el de Nuevo gasto: mismos chips, sin comprobante ni cobertura | Aprobado | 3.4 s | 0 |
| QA-236 | plantillas-integral.spec | Plantillas de gastos y de fondos › guardar un gasto como plantilla: precarga, no copia datos reales y el gasto original no cambia | Aprobado | 5.9 s | 0 |
| QA-237 | plantillas-integral.spec | Plantillas de gastos y de fondos › registrar gastos desde una plantilla: varias veces, con ajustes y sin modificar la plantilla | Aprobado | 5.4 s | 0 |
| QA-238 | plantillas-integral.spec | Plantillas de gastos y de fondos › fondo → plantilla: copia la configuración, no el consumo ni el período, y el fondo original no cambia | Aprobado | 3.9 s | 0 |
| QA-239 | plantillas-integral.spec | Plantillas de gastos y de fondos › biblioteca de plantillas de fondos: crear, duplicar, desactivar, usar y eliminar | Aprobado | 8.0 s | 0 |
| QA-240 | plantillas-integral.spec | Plantillas de gastos y de fondos › planificación: aplicar varias plantillas ajustando importes, sin cerrar el asistente ni duplicar | Falló | 30.5 s | 0 |
| QA-241 | plantillas-integral.spec | Plantillas de gastos y de fondos › un mes no admite dos Fondos Generales: la segunda plantilla general queda bloqueada | Falló | 30.5 s | 0 |
| QA-242 | plantillas-integral.spec | Plantillas de gastos y de fondos › crear plantillas desde el asistente (formularios anidados) no cierra la planificación | Aprobado | 5.3 s | 0 |
| QA-243 | plantillas-integral.spec | Plantillas de gastos y de fondos › responsive 320px: formularios de plantilla sin desbordes y con acciones visibles | Aprobado | 4.7 s | 0 |
| QA-244 | plantillas-integral.spec | Plantillas de gastos y de fondos › responsive 375px: formularios de plantilla sin desbordes y con acciones visibles | Aprobado | 4.8 s | 0 |
| QA-245 | plantillas-integral.spec | Plantillas de gastos y de fondos › responsive 768px: formularios de plantilla sin desbordes y con acciones visibles | Aprobado | 4.8 s | 0 |
| QA-246 | plantillas-integral.spec | Plantillas de gastos y de fondos › responsive 1024px: formularios de plantilla sin desbordes y con acciones visibles | Aprobado | 4.6 s | 0 |
| QA-247 | plantillas-integral.spec | Plantillas de gastos y de fondos › responsive 1366px: formularios de plantilla sin desbordes y con acciones visibles | Aprobado | 4.8 s | 0 |
| QA-248 | plantillas-integral.spec | Plantillas de gastos y de fondos › accesibilidad (light): formulario de plantilla y biblioteca sin violaciones graves | Aprobado | 6.7 s | 0 |
| QA-249 | plantillas-integral.spec | Plantillas de gastos y de fondos › accesibilidad (dark): formulario de plantilla y biblioteca sin violaciones graves | Aprobado | 6.7 s | 0 |
| QA-250 | plantillas.spec | Plantillas mensuales › el formulario exige importe salvo que cambie cada mes, valida el día y explica la naturaleza del gasto | Aprobado | 8.1 s | 0 |
| QA-251 | plantillas.spec | Plantillas mensuales › registro mensual: importe variable pide revisión, los datos pendientes se señalan y un mes corto usa su último día | Aprobado | 9.1 s | 0 |
| QA-252 | qa-regresion.spec | Revisión de calidad: regresiones › 1 · Nuevo gasto: el foco inicial cae en el primer dato (Ámbito), no en «Cerrar» | Aprobado | 2.6 s | 0 |
| QA-253 | qa-regresion.spec | Revisión de calidad: regresiones › 2 · Guardar vacío envía el foco al primer error lógico (Ámbito), con mensajes asociados | Aprobado | 3.2 s | 0 |
| QA-254 | qa-regresion.spec | Revisión de calidad: regresiones › 3 · Gastos a 320 px: buscador y acciones en pocas filas, con nombres accesibles y Nuevo gasto a la vista | Aprobado | 2.2 s | 0 |
| QA-255 | qa-regresion.spec | Revisión de calidad: regresiones › 4 · Navegación inferior a 320 px: etiquetas completas, sin cortes y con zonas táctiles suficientes | Aprobado | 1.6 s | 0 |
| QA-256 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 320×640 | Aprobado | 10.1 s | 0 |
| QA-257 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 320×640 | Aprobado | 6.3 s | 0 |
| QA-258 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 375×812 | Aprobado | 9.8 s | 0 |
| QA-259 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 375×812 | Aprobado | 6.4 s | 0 |
| QA-260 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 390×844 | Aprobado | 9.9 s | 0 |
| QA-261 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 390×844 | Aprobado | 6.1 s | 0 |
| QA-262 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 430×932 | Aprobado | 9.6 s | 0 |
| QA-263 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 430×932 | Aprobado | 6.3 s | 0 |
| QA-264 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 768×1024 | Aprobado | 9.8 s | 0 |
| QA-265 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 768×1024 | Aprobado | 6.2 s | 0 |
| QA-266 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 1024×768 | Aprobado | 9.8 s | 0 |
| QA-267 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 1024×768 | Aprobado | 6.2 s | 0 |
| QA-268 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 1280×720 | Aprobado | 9.8 s | 0 |
| QA-269 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 1280×720 | Aprobado | 6.3 s | 0 |
| QA-270 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 1366×768 | Aprobado | 9.9 s | 0 |
| QA-271 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 1366×768 | Aprobado | 6.3 s | 0 |
| QA-272 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 1440×900 | Aprobado | 10.0 s | 0 |
| QA-273 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 1440×900 | Aprobado | 6.4 s | 0 |
| QA-274 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 1920×1080 | Aprobado | 10.3 s | 0 |
| QA-275 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 1920×1080 | Aprobado | 6.8 s | 0 |
| QA-276 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › módulos 844×390 | Aprobado | 10.0 s | 0 |
| QA-277 | qa-responsive.spec | Revisión de calidad: responsive por módulo y diálogo › diálogos 844×390 | Aprobado | 6.6 s | 0 |
| QA-278 | recuperacion.spec | restablecimiento de contraseña (Mailpit local) › el enlace del correo permite crear una contraseña nueva y luego se restaura la original | Aprobado | 7.5 s | 0 |
| QA-279 | reglas-ui.spec | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › los radios de regla cambian con flechas, Inicio y Fin y solo uno entra en el orden de tabulación | Falló | 1.6 s | 0 |
| QA-280 | reglas-ui.spec | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › contraer una rama no borra reglas, muestra su resumen y un ámbito incluido puede contraerse | Falló | 1.8 s | 0 |
| QA-281 | reglas-ui.spec | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › con cambios sin guardar, Escape, X y Cancelar piden confirmar; Seguir editando conserva el borrador y el foco vuelve al disparador | Falló | 1.8 s | 0 |
| QA-282 | reglas-ui.spec | Formulario de fondo: reglas por teclado, ramas contraíbles, descarte y aperturas rápidas › abrir y cerrar diálogos y selectores de inmediato no hace desaparecer el siguiente | Falló | 1.6 s | 0 |
| QA-283 | reglas-ui.spec | Formulario de fondo: orden de campos y color › la descripción va tras los importes, el color se elige en un popover y se guarda con su nombre (no como «c1») | Falló | 1.6 s | 0 |
| QA-284 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 320×640 | Falló | 1.8 s | 0 |
| QA-285 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 375×812 | Falló | 1.6 s | 0 |
| QA-286 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 430×932 | Falló | 1.6 s | 0 |
| QA-287 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 640×360 | Falló | 1.6 s | 0 |
| QA-288 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 1920×1080 | Falló | 1.6 s | 0 |
| QA-289 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 360×800 | Falló | 1.6 s | 0 |
| QA-290 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 390×844 | Falló | 1.6 s | 0 |
| QA-291 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 768×1024 | Falló | 1.7 s | 0 |
| QA-292 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 1024×768 | Falló | 1.6 s | 0 |
| QA-293 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 1366×768 | Falló | 1.7 s | 0 |
| QA-294 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 1440×900 | Falló | 1.8 s | 0 |
| QA-295 | responsive.spec | Responsive: ningún módulo recorta su contenido › seis módulos a 844×390 | Falló | 1.7 s | 0 |
| QA-296 | responsive.spec | Responsive: apartados descubribles › Configuración muestra sus cinco apartados dentro de la pantalla a 360 px | Falló | 1.6 s | 0 |
| QA-297 | responsive.spec | Responsive: apartados descubribles › Configuración muestra sus cinco apartados dentro de la pantalla a 390 px | Falló | 1.6 s | 0 |
| QA-298 | responsive.spec | Responsive: apartados descubribles › Configuración muestra sus cinco apartados dentro de la pantalla a 768 px | Falló | 1.6 s | 0 |
| QA-299 | salud.spec | Salud financiera › responde las cuatro preguntas con datos del historial y distingue cálculo de sugerencia | Falló | 1.6 s | 0 |
| QA-300 | salud.spec | Salud financiera › la reducción supuesta cambia el ahorro posible y se explica el cálculo | Falló | 1.6 s | 0 |
| QA-301 | salud.spec | Salud financiera › un mes sin historial anterior informa datos insuficientes en vez de inventar conclusiones | Falló | 1.6 s | 0 |
| QA-302 | salud.spec | Salud financiera › el mes más antiguo con datos no tiene base de comparación suficiente | Falló | 1.6 s | 0 |
| QA-303 | salud.spec | Salud financiera › cambiar de mes recalcula el análisis | Falló | 1.6 s | 0 |
| QA-304 | teclado.spec | Teclado y foco › el foco es visible al navegar con Tab | Falló | 1.6 s | 0 |
| QA-305 | teclado.spec | Teclado y foco › un diálogo de formulario atrapa el foco, se cierra con Escape y devuelve el foco al botón que lo abrió | Falló | 1.6 s | 0 |
| QA-306 | teclado.spec | Teclado y foco › el cuadro de confirmación se cierra con Escape y devuelve el foco al botón de origen | Falló | 1.6 s | 0 |
| QA-307 | teclado.spec | Teclado y foco › Cancelar en una confirmación también devuelve el foco | Falló | 1.6 s | 0 |
| QA-308 | teclado.spec | Teclado y foco › tras confirmar una acción que retira la fila, el foco no se pierde en el documento | Falló | 1.6 s | 0 |
| QA-309 | teclado.spec | Teclado y foco › el calendario se maneja con flechas, Enter y Escape | Falló | 1.6 s | 0 |
| QA-310 | teclado.spec | Teclado y foco › los selectores se operan solo con teclado: abrir, buscar, navegar y elegir | Falló | 1.8 s | 0 |
| QA-311 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › sin «Fecha general», filtros en una sola fila, «Pendientes» como interruptor y acciones de selección discretas | Falló | 1.7 s | 0 |
| QA-312 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › nombres largos en una línea con tooltip, chips dentro de su columna, encabezados alineados y filas/grupos compactos | Falló | 1.6 s | 0 |
| QA-313 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1920px: sin desbordes ni controles cortados | Falló | 1.6 s | 0 |
| QA-314 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1440px: sin desbordes ni controles cortados | Falló | 1.6 s | 0 |
| QA-315 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1366px: sin desbordes ni controles cortados | Falló | 1.6 s | 0 |
| QA-316 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1280px: sin desbordes ni controles cortados | Falló | 1.6 s | 0 |
| QA-317 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 1024px: sin desbordes ni controles cortados | Falló | 1.6 s | 0 |
| QA-318 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 768px: sin desbordes ni controles cortados | Falló | 1.6 s | 0 |
| QA-319 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 430px: sin desbordes ni controles cortados | Falló | 1.6 s | 0 |
| QA-320 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 390px: sin desbordes ni controles cortados | Falló | 1.6 s | 0 |
| QA-321 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 375px: sin desbordes ni controles cortados | Falló | 1.7 s | 0 |
| QA-322 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › gestor de plantillas a 320px: sin desbordes ni controles cortados | Falló | 1.6 s | 0 |
| QA-323 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › accesibilidad (light): gestor compacto y formulario sin violaciones graves | Falló | 1.6 s | 0 |
| QA-324 | visual-plantillas.spec | Plantillas mensuales: layout compacto y sin desbordes › accesibilidad (dark): gestor compacto y formulario sin violaciones graves | Falló | 1.6 s | 0 |
| QA-325 | visual-plantillas.spec | Nueva plantilla de gasto: formulario simplificado › «¿El importe varía?», Día sugerido y Tipo de gasto en una fila, sin párrafos de ayuda; el guardado sigue igual | Falló | 1.7 s | 0 |
| QA-326 | visual-plantillas.spec | Paginación unificada › Gastos: rango breve, tamaños 10/20/50/100, números con «…», filtros y orden conservados, sin duplicados | Falló | 1.6 s | 0 |
| QA-327 | visual-plantillas.spec | Paginación unificada › paginador a 320px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Falló | 1.6 s | 0 |
| QA-328 | visual-plantillas.spec | Paginación unificada › paginador a 375px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Falló | 1.9 s | 0 |
| QA-329 | visual-plantillas.spec | Paginación unificada › paginador a 430px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Falló | 1.8 s | 0 |
| QA-330 | visual-plantillas.spec | Paginación unificada › paginador a 768px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Falló | 1.6 s | 0 |
| QA-331 | visual-plantillas.spec | Paginación unificada › paginador a 1366px: compacto, sin desbordes; en estrecho muestra «n/m» en lugar de números | Falló | 1.6 s | 0 |
| QA-332 | visual.spec | Revisión visual y de accesibilidad › páginas completas a 1440 px, tema claro | Falló | 1.6 s | 0 |
| QA-333 | visual.spec | Revisión visual y de accesibilidad › páginas completas a 1440 px, tema oscuro | Falló | 1.7 s | 0 |
| QA-334 | visual.spec | Revisión visual y de accesibilidad › en 390 px no hay desborde horizontal y la navegación inferior funciona | Falló | 1.7 s | 0 |
| QA-335 | visual.spec | Revisión visual y de accesibilidad › los formularios y diálogos principales se pueden recorrer con teclado | Falló | 1.7 s | 0 |
| QA-336 | volumen.spec | Volumen: totales exactos con más gastos que el límite anterior › Dashboard, Gastos, Fondos y Salud incluyen todos los registros | Falló | 10.7 s | 0 |
