# Limpieza visual y revisión responsive

Revisión del 16 de noviembre de 2026 sobre el proyecto local. Se conservaron los cambios anteriores de descripciones inteligentes y Eventos.

## Criterios de diseño

Se mantuvieron los tokens semánticos, la paleta índigo, las superficies claras y oscuras, los iconos Lucide y la tipografía existente. La compactación utiliza la escala de espaciado actual: separación habitual de 16 px y tarjetas con 16 px de padding. No se añadieron librerías ni se redujo globalmente el tamaño del texto.

## Cambios por sección

| Sección | Cambio visual | Información conservada |
| --- | --- | --- |
| Dashboard | Se retiró el contexto duplicado de los filtros y las instrucciones de interacción de los gráficos. Se compactaron tarjetas y espacios. | Importes, filtros, leyendas, comparación temporal, base corta y estado de las estimaciones. |
| Presupuesto consolidado | Se retiraron notas que repetían el indicador. La explicación del cálculo se consulta desde información. | Asignado, gasto, imputación, disponible, exceso, porcentajes, advertencias y alcance del período. |
| Gastos | Se retiraron las instrucciones bajo Descripción y Nombre de plantilla y la explicación permanente de asociación a eventos. Se abreviaron las descripciones de clonado y plantillas. | Chips inteligentes, frecuencias, clasificación, evento, fecha, validación, restricciones de comprobantes y cobertura provisional. |
| Fondos | Se retiraron la definición permanente de fondo y los avisos repetidos de duración mensual y agrupación. | Importe, descripción, reglas, medios, Fondo General y restricciones. La definición y las reglas se consultan en ayuda. |
| Planificación | Se retiraron las introducciones de las etapas y la invitación redundante. Se abreviaron las consecuencias de finalizar. | Período, estados, etapas, importes, selección, resultados, avisos y confirmaciones. |
| Plantillas | Se retiraron instrucciones de confirmación evidentes; las diferencias entre plantilla y registro pasan a ayuda contextual cuando son relevantes. | Selección, importes, estados, registro por lote, independencia entre meses y confirmaciones de descarte/eliminación. |
| Eventos | Se compactó el encabezado y se retiraron frases decorativas, introducciones de formularios y la tarjeta explicativa de tres perspectivas. | Presupuesto, conceptos, contratos, pagos, estados, fechas, filtros, descripción escrita por el usuario y diferencias de planificación. |
| Catálogo | Se retiró la explicación general sobre el histórico y se abreviaron las indicaciones de herencia de color. | Controles de color, jerarquía, desactivación y advertencias al eliminar elementos usados. |
| Configuración | Se retiraron subtítulos de paneles y navegación, el ejemplo duplicado de fecha y explicaciones evidentes de búsqueda y tema. | Campos, vista previa de cada formato, estado de guardado, moneda y restricciones de seguridad/exportación. |

## Componentes compartidos

- `AyudaInfo`, en `src/components/ui/Hint.tsx`, reutiliza Radix Popover: botón con nombre accesible, apertura por clic/toque/teclado, foco restaurado, cierre con Escape y ajuste a los bordes del viewport. Se conserva `Hint` para las interacciones de gráficos existentes.
- Los modales reutilizan esta ayuda y mantienen el cuerpo desplazable y el pie separado. Las descripciones funcionales ya no se recortan a dos líneas ni se ocultan por la altura de pantalla.
- Las confirmaciones limitan su altura con `dvh`, desplazan su explicación y permiten envolver las acciones. Se conservan el foco, las confirmaciones destructivas y el descarte de cambios.

## Archivos de esta revisión

- Compartidos: `src/components/ui/Hint.tsx`, `Dialog.tsx`.
- Navegación: `src/app/modulos.ts`, reserva inferior del dashboard para el botón flotante.
- Dashboard: `src/features/dashboard/DashboardPage.tsx`, `PresupuestoConsolidado.tsx`, `Ranking.tsx`, `Tarjeta.tsx`.
- Gastos: `src/features/gastos/GastoForm.tsx`, `GestorGastos.tsx`, `Plantillas.tsx`.
- Fondos: `src/features/fondos/FondosPage.tsx`, `FondoForm.tsx`, `PlantillasFondos.tsx`.
- Eventos: `src/features/eventos/EventosPage.tsx`, `EventoDetalle.tsx`, `EventoForm.tsx`, `EventoVisual.tsx`, `PlanEventoForm.tsx`, `GastosEvento.tsx`, `SelectorEventoGasto.tsx`.
- Planificación: `src/features/planificacion/AsistentePlanificacion.tsx`, `EstadoPlanificacion.tsx`, `InvitacionPlanificacion.tsx`.
- Catálogo: `src/features/catalogo/CatalogoPage.tsx`, `EditorColor.tsx`, `ElementoEditor.tsx`.
- Configuración: `src/features/perfil/ConfiguracionPage.tsx`, `DatosHogar.tsx`, `Actividad.tsx`, `ExportarDatos.tsx`.
- Verificación: `e2e/limpieza-visual.spec.ts`, `playwright.visual.config.ts` y actualización de la comprobación de ayuda en `e2e/plantillas-integral.spec.ts`.

Los archivos de servicios, modelos y migraciones que ya estaban modificados pertenecen al trabajo anterior; no forman parte de esta limpieza.

## Alcance de las pruebas

La prueba reproducible está en `e2e/limpieza-visual.spec.ts`; `playwright.visual.config.ts` permite ejecutarla con Chromium, Firefox, WebKit y los canales instalados de Chrome y Edge, usando perfiles temporales:

```powershell
npx.cmd playwright test -c playwright.visual.config.ts --reporter=line
```

La matriz incluye los seis módulos con ambos temas en 320, 360, 375, 390, 414, 428, 600, 768, 1024, 1280, 1440 y 1920 px; las cinco secciones de configuración; formularios de gasto, fondo y evento con alturas reducidas y orientación horizontal; las tres etapas de planificación; ayuda con teclado/toque; análisis de accesibilidad automatizado y reflujo equivalente al 200 % mediante viewport reducido a 640×450 CSS px con escala de píxel 2.

Las capturas locales de los seis módulos, en claro y oscuro y a 390/1440 px, están en `qa/limpieza/antes/` y `qa/limpieza/despues/<navegador>/`. Los formularios tienen capturas posteriores en la segunda carpeta. Los archivos de QA están excluidos de Git para evitar incorporar capturas con datos al repositorio.

Comparación de altura total con los mismos fixtures y ancho de 390 px en Chromium, tema claro:

| Pantalla | Antes | Después | Reducción |
| --- | ---: | ---: | ---: |
| Dashboard | 4010 px | 3658 px | 352 px (8,8 %) |
| Eventos | 1032 px | 916 px | 116 px (11,2 %) |
| Configuración, perfil | 1431 px | 1149 px | 282 px (19,7 %) |
| Catálogo | 1519 px | 1423 px | 96 px (6,3 %) |

En Fondos, la distribución de filtros, acciones y KPIs utiliza el ancho real del contenedor. En móvil, el árbol coloca las reglas debajo de cada nombre para conservar su legibilidad al expandir la jerarquía. La navegación de planificación permanece dentro del cuerpo desplazable con posición sticky y espacio propio, sin superponerse al contenido final. El dashboard reserva al final el mismo margen para el botón flotante que los otros módulos: se detectó y corrigió que podía tapar la última fila del ranking después de compactar el contenido.

### Resultados

- TypeScript y lint: aprobados.
- Pruebas unitarias: 552 aprobadas en 46 archivos.
- Matriz inicial de seis módulos: aprobada en los doce anchos y ambos temas.
- Chromium, Firefox y WebKit: páginas, formularios, planificación y ayuda aprobados. La revisión final de formularios con clasificación expandida y reflujo equivalente al 200 % pasó sus seis escenarios entre los tres motores.
- Chrome y Edge instalados: matriz de páginas en ambos temas y doce anchos, formularios, accesibilidad de formularios y ayuda táctil aprobados. Chrome completó su matriz al repetir una medición interrumpida por una navegación transitoria.
- Regresiones de descripciones, gastos, Eventos y plantillas: los 33 casos existentes completaron sus comprobaciones, incluida la prueba de ayuda de fondos actualizada.
- Navegación y cierre: 12 casos aprobados, con siete tamaños móviles/tablet/horizontal, teclado virtual simulado, dos tamaños de escritorio, traslado de filtros a Gastos y conservación del fondo original al crear una plantilla.
- Build de producción (`npm run build`, ejecutada por la configuración PWA): aprobada, incluido TypeScript. Permanece el aviso de Vite sobre bundles mayores de 500 kB.
- PWA sobre la build: 4 casos aprobados. Chrome considera instalable el manifiesto; el modo standalone simulado oculta la invitación; el registro de gastos sigue accesible; las instrucciones de iPhone emulado no desbordan.
- Capturas finales del dashboard actualizadas en los cinco navegadores tras corregir la reserva del botón flotante. No se registraron errores de consola en las matrices aprobadas.

Para ejecutar solo los motores descargados por Playwright, agrega `--project=chromium --project=firefox --project=webkit`. Los proyectos `chrome` y `edge` requieren esos navegadores instalados.

### Límites de la verificación

Playwright verifica navegadores y dispositivos emulados. WebKit no equivale a probar Safari instalado en un iPhone. La reducción de altura comprueba el espacio disponible, pero no reproduce todos los teclados nativos. La combinación de viewport reducido y escala 2 verifica el reflujo esperado de la ampliación; no certifica el zoom de la interfaz nativa del navegador ni el escalado del sistema operativo. No se utiliza CSS zoom como sustituto del zoom del navegador, porque conserva los puntos de corte del viewport original. No se probaron lectores de pantalla físicos ni una instalación PWA en un dispositivo real. Esas comprobaciones requieren dispositivos reales.

## Integridad del negocio

Esta revisión no modifica cálculos, servicios, contratos, autenticación, RLS, tablas ni migraciones. Los cambios de presentación conservan las acciones y el contenido financiero. Las pruebas con escritura utilizan únicamente el usuario E2E reservado y sus fixtures; no se reinicia la base ni se modifican los hogares del usuario o de demostración.

## Pendientes

No quedan fallos reproducibles de presentación en las comprobaciones descritas. Quedan por realizar las comprobaciones físicas indicadas en los límites: Safari/iPhone y Android reales, teclados nativos, safe areas reales, zoom del navegador y escalado del sistema, lectores de pantalla e instalación real de la PWA. El aviso de tamaño de bundle queda como optimización de rendimiento separada; no impide compilar ni usar la aplicación.
