# Accesibilidad

## Qué se verifica automáticamente

`e2e/a11y.spec.ts` ejecuta **axe-core** (reglas WCAG 2.0/2.1 A y AA más buenas prácticas) sobre:

- Acceso, recuperación, restablecimiento y sesión vencida (también con errores de validación visibles).
- Dashboard, Gastos, Fondos, Catálogo y Configuración, en tema **claro y oscuro**.
- Barra inferior y botón «Registrar gasto» (`e2e/barra-inferior.spec.ts`): 7 tamaños de 320×700 a 844×390 (cinco columnas iguales, icono y etiqueta centrados, etiquetas completas en una línea y ≥ 11 px, zonas táctiles ≥ 44 px, botón de 52–56 px que no tapa ningún destino, sin desborde horizontal y con hueco al final de cada página), estado activo con `aria-current` al navegar, recargar y entrar por URL, orden de tabulación y anillo de foco visible, `prefers-reduced-motion`, contraste en tema claro y oscuro, formulario por encima de la barra con retorno del foco y ocultación con teclado virtual.
- Diálogos y estados con datos: formulario de gasto con previsualización de fondos, selector abierto, calendario, confirmación de anulación, formulario de fondo (árbol de reglas), formulario de catálogo y registro mensual por lote.

**Resultado actual: 0 violaciones y sin reglas desactivadas** (`REGLAS_EXCLUIDAS` vacío).

`e2e/teclado.spec.ts` comprueba además: foco visible, foco atrapado en diálogos, Escape, retorno del foco al control de origen (diálogos de formulario **y** cuadros de confirmación), calendario con flechas/Enter/Escape y selectores operables solo con teclado (abrir, buscar, navegar, elegir).

## Defectos que encontró la auditoría (corregidos)

- Enlaces de la barra inferior con un nombre accesible distinto del texto visible («Dashboard» frente a «Inicio», «Configuración» frente a «Ajustes»; WCAG 2.5.3): ahora el nombre es el texto visible.
- Botón "Salir" con nombre accesible que no contenía su texto visible (WCAG 2.5.3).
- Panel del selector (diálogo ARIA de Radix) sin nombre.
- Contraste insuficiente (4.16:1) del texto verde sobre fondo lavanda en indicadores de estado: se oscureció el tono `--ok` y se añadió `--ok-soft`.
- Páginas sin `h1`: el título del módulo pasó a ser el `h1` de la cabecera.
- Orden de encabezados en Fondos (`h1 → h3`): los nombres de fondo son `h2`.
- Calendario con `role="grid"` sin filas: ahora `grid → row → columnheader/gridcell`.
- Controles interactivos anidados en el árbol de reglas de fondos (`<summary>` con botones): reemplazado por botones de expansión independientes.
- Controles por fila del registro mensual sin nombre accesible.
- El selector sin búsqueda no recibía el foco al abrirse; el calendario no enfocaba el día seleccionado; el foco no volvía al botón de origen al cerrar diálogos.

## Limitaciones reales

- La barra inferior y el botón flotante usan `env(safe-area-inset-*)`, pero Playwright no emula el notch ni la barra de gestos: el comportamiento con áreas seguras reales y con el teclado virtual de un teléfono se probó simulando el viewport visual, no en dispositivos físicos.
- axe detecta solo una parte de los problemas posibles de WCAG. **No se ha probado con lectores de pantalla** (NVDA/VoiceOver) ni con zoom/reflow al 400 % de forma manual.
- Los gráficos de Recharts exponen un resumen textual (`role="img"` con la cifra total) y la misma información está disponible en listas y tablas navegables (distribución por ámbito y ranking con tendencia), pero los puntos individuales del gráfico no son operables con teclado: la selección de un día se hace con el puntero.
- Si la acción confirmada retira el control de origen (p. ej. una fila anulada), el foco pasa al contenido principal (`#contenido`) en lugar de a ese control.
- El contraste de los colores de las series de gráficos sobre el fondo se verificó con axe en el texto, no cada serie por separado; las series se acompañan siempre de leyenda y valores en texto.
