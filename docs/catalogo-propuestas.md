# Rediseño del Catálogo · propuestas de diseño

> **Estado: solo diseño.** No hay migraciones, modelos ni componentes de producción para esto. Los prototipos viven en `prototipos/catalogo/` (HTML/CSS/JS aislado, fuera de `src/` y del build, con datos de ejemplo y sin base de datos). La implementación espera tu aprobación.

## Cómo verlo

Abre `prototipos/catalogo/indice.html` en el navegador (doble clic, sin servidor). Cada propuesta incluye: página de **ámbitos**, **categorías con subcategorías**, **medios de pago**, **modal de crear/editar**, **selector de color normal** y **selector avanzado (HEX/RGB)**, en **tema claro y oscuro** (botón superior). `paleta.html` muestra los 20 colores con sus tratamientos. Capturas a 1440 px: `prototipos/catalogo/capturas/` (se regeneran con `node prototipos/catalogo/capturar.mjs`, que además verifica 58 comportamientos del selector y de las reglas de administración).

| Propuesta | Archivo |
|---|---|
| A · Tarjetas visuales | `a-tarjetas.html` |
| B · Explorador jerárquico | `b-explorador.html` |
| C · Administración compacta | `c-compacta.html` |

## Paleta de 20 colores

Un color base (HEX) produce cuatro valores por tema con **una sola regla**, que también se aplica a colores personalizados:

- **Claro:** fondo suave = 10 % de color sobre blanco · borde = 35 % · ícono = color base (oscurecido solo si no llega a 3:1) · texto = color oscurecido hasta 4.5:1 sobre el fondo suave.
- **Oscuro:** fondo suave = 22 % de color sobre la superficie (`#181829`) · borde = 50 % · ícono = color aclarado hasta 3:1 · texto aclarado hasta 4.5:1.

Los 20 cumplen 4.5:1 en texto en ambos temas (verificado por el script de capturas).

| Color | HEX base | Claro: fondo / borde / ícono / texto | Oscuro: fondo / borde / ícono / texto |
|---|---|---|---|
| Índigo | `#4F46E5` | `#EDEDFC` / `#C1BEF6` / `#4F46E5` / `#4F46E5` (5.4:1) | `#242252` / `#342F87` / `#6D65E9` / `#8D87EE` (4.8:1) |
| Azul | `#2563EB` | `#E9EFFD` / `#B3C8F8` / `#2563EB` / `#235DDD` (5.0:1) | `#1B2954` / `#1F3E8A` / `#326CEC` / `#6993F1` (4.8:1) |
| Celeste | `#0EA5E9` | `#E7F6FD` / `#ABE0F7` / `#0D9BDB` / `#0A72A1` (4.8:1) | `#163753` / `#135F89` / `#0EA5E9` / `#1CAAEA` (4.7:1) |
| Turquesa | `#06B6D4` | `#E6F8FB` / `#A8E5F0` / `#05A1BB` / `#047689` (4.8:1) | `#143B4F` / `#0F677F` / `#06B6D4` / `#06B6D4` (4.9:1) |
| Teal | `#0D9488` | `#E7F4F3` / `#AADAD5` / `#0D9488` / `#0B7B71` (4.6:1) | `#16333E` / `#135659` / `#0D9488` / `#42ABA2` (4.8:1) |
| Esmeralda | `#059669` | `#E6F5F0` / `#A8DACB` / `#059669` / `#047D57` (4.6:1) | `#143437` / `#0F5749` / `#059669` / `#3CAD8A` (4.8:1) |
| Verde | `#16A34A` | `#E8F6ED` / `#ADDFC0` / `#16A34A` / `#117F3A` (4.5:1) | `#183730` / `#175E3A` / `#16A34A` / `#31AE5F` (4.5:1) |
| Lima | `#65A30D` | `#F0F6E7` / `#C9DFAA` / `#65A30D` / `#4A780A` (4.8:1) | `#293723` / `#3F5E1B` / `#65A30D` / `#77AE29` (4.7:1) |
| Oliva | `#7C8B2A` | `#F2F3EA` / `#D1D6B4` / `#7C8B2A` / `#677323` (4.6:1) | `#2E3129` / `#4A522A` / `#7C8B2A` / `#929F4E` (4.6:1) |
| Amarillo | `#CA8A04` | `#FAF3E6` / `#ECD6A7` / `#BE8204` / `#946503` (4.6:1) | `#3F3121` / `#715117` / `#CA8A04` / `#CD9113` (4.6:1) |
| Ámbar | `#D97706` | `#FBF1E6` / `#F2CFA8` / `#D97706` / `#9F5704` (4.9:1) | `#422D21` / `#794818` / `#D97706` / `#DD8723` (4.6:1) |
| Naranja | `#EA580C` | `#FDEEE7` / `#F8C5AA` / `#EA580C` / `#B74509` (4.8:1) | `#462623` / `#81381B` / `#EA580C` / `#EE7435` (4.6:1) |
| Coral | `#F0614E` | `#FEEFED` / `#FAC8C1` / `#F0614E` / `#B04739` (4.9:1) | `#482831` / `#843D3C` / `#F0614E` / `#F27363` (4.6:1) |
| Rojo | `#DC2626` | `#FCE9E9` / `#F3B3B3` / `#DC2626` / `#CF2424` (4.6:1) | `#431B28` / `#7A1F28` / `#DC2626` / `#E76969` (4.6:1) |
| Carmesí | `#BE123C` | `#F9E7EC` / `#E8ACBB` / `#BE123C` / `#BE123C` (5.3:1) | `#3D172D` / `#6B1533` / `#C93A5D` / `#D76F88` (4.8:1) |
| Rosa | `#DB2777` | `#FBE9F1` / `#F2B3CF` / `#DB2777` / `#C22269` (4.9:1) | `#431B3A` / `#7A2050` / `#DB2777` / `#E66AA1` (4.8:1) |
| Magenta | `#C026D3` | `#F9E9FB` / `#E9B3F0` / `#C026D3` / `#B424C6` (4.5:1) | `#3D1B4E` / `#6C1F7E` / `#C026D3` / `#D469E1` (4.7:1) |
| Violeta | `#7C3AED` | `#F2EBFD` / `#D1BAF9` / `#7C3AED` / `#7C3AED` (4.9:1) | `#2E1F54` / `#4A298B` / `#8B51EF` / `#A577F3` (4.5:1) |
| Púrpura | `#7E22CE` | `#F2E9FA` / `#D2B2EE` / `#7E22CE` / `#7E22CE` (5.9:1) | `#2E1A4D` / `#4B1D7C` / `#9447D6` / `#B078E1` (4.8:1) |
| Pizarra | `#64748B` | `#F0F1F3` / `#C9CED6` / `#64748B` / `#5E6D83` (4.7:1) | `#292C3F` / `#3E465A` / `#6D7C92` / `#8D99AA` (4.8:1) |

Usos reales de ejemplo (ver `paleta.html`): Hogar = Índigo, Personal = Teal, Familia = Naranja, Trabajo = Azul; Alimentación = Verde, Ocio = Violeta, Educación = Rosa; Yape = Púrpura, Tarjeta de crédito = Azul, Efectivo = Esmeralda; «Otros» = Pizarra.

## Herencia de color (solo diseñada)

- **Categoría** → puede **heredar** el color de su ámbito o tener **color propio**. En el modal: control segmentado «Heredar de {ámbito}» / «Color propio». Con herencia, la paleta se atenúa y la vista previa dice que seguirá los cambios del ámbito.
- **Subcategoría** → siempre usa el color efectivo de su categoría (punto de color, sin selector propio).
- **Ámbitos y medios de pago** → siempre color propio.
- En las listas se indica el origen: «Hereda de Hogar» (ícono de enlace) o «Color propio».

## Selector avanzado (HEX / RGB)

Cuadro de saturación/brillo (puntero y teclado con flechas) + deslizador de tono + campo HEX + campos R, G, B sincronizados (`#5B5BD6` ↔ `91, 91, 214`). Vista previa en claro y oscuro, indicador de contraste (texto 4.5:1, ícono 3:1) con el ajuste automático que se aplicará, validación («Usa 6 dígitos hexadecimales», «Cada canal RGB va de 0 a 255») y «← Volver a la paleta».

## Reglas de administración reflejadas

Crear, editar, ordenar (subir/bajar con botones, usable por teclado), activar/desactivar, eliminar **solo si no tiene referencias** (el botón se deshabilita y explica por qué), y **«Otros» siempre al final** (sin subir/bajar/eliminar, con candado). Todo es operable con teclado y los diálogos cierran con Escape.

## Cómo se guardaría (futuro, sin implementar)

Hoy `ambitos`, `categorias` y `medios_pago` guardan `color_token` (lista cerrada: `c1…c5`, `pri`, `acc`, `muted`) e `icon_key`. Una implementación necesitaría, **tras tu aprobación**:

1. **Esquema (migración reversible):** `color_hex text` (formato `^#[0-9A-F]{6}$`, nullable) y `color_mode text` (`'own' | 'inherit'`, solo en categorías). `color_token` se conserva durante la transición y se rellena con el HEX equivalente de la paleta.
2. **Resolución del color:** función SQL/TS única `color_efectivo(categoria)` = propio, o el del ámbito si `inherit`. Subcategoría = el de su categoría.
3. **Integridad histórica:** los gastos guardan referencias (ids), no colores; cambiar un color recolorea la vista, nunca altera importes ni períodos cerrados. Las exportaciones usan nombres, no colores. El respaldo JSON incluiría `color_hex`/`color_mode` con la versión de esquema incrementada.
4. **Validación:** CHECK de formato en BD + validación Zod; el contraste se ajusta al renderizar (texto/ícono derivados), por lo que no puede guardarse un color que vuelva ilegible la interfaz.
5. **Reglas de eliminación:** ya existen (claves foráneas `restrict` y desactivación); la interfaz solo las explica.

### Componentes reutilizables (previstos)

`ColorPicker` (paleta + avanzado), `ColorChip`/`ItemBadge` (insignia con tonos por tema, `tonos(hex, tema)`), `ContrastMeter`, `InheritToggle`, `CatalogItemModal`, `ReorderButtons`, `DeleteGuard` (explica por qué no se puede eliminar). Los tonos de la paleta serían tokens CSS calculados una vez por color.

## Comparación

| Criterio | A · Tarjetas | B · Explorador | C · Compacta |
|---|---|---|---|
| Ver el color de un vistazo | ★★★ | ★★ | ★★ |
| Entender la jerarquía ámbito → categoría → subcategoría | ★★ | ★★★ | ★★ |
| Eficiencia con muchos elementos (50+) | ★ | ★★ | ★★★ |
| Edición rápida (activar, ordenar) | ★★ | ★★ | ★★★ |
| Vista previa de cómo se verá (claro/oscuro) | ★★ | ★★★ | ★ |
| Descubribilidad para uso familiar | ★★★ | ★★ | ★★ |
| Uso en móvil (adaptabilidad) | ★★★ | ★ (dos paneles) | ★★ (tabla con scroll) |
| Coste de implementación | Medio | Alto | Bajo-medio |
| Densidad de información | Baja | Media | Alta |

## Recomendación

**Combinar C como base + elementos de B y A:** tabla compacta (C) para administrar, **panel lateral de detalle con vista previa claro/oscuro de B** al seleccionar una fila (en lugar del modal para edición rápida; el modal queda para crear), y la **insignia de color grande de A** en el encabezado del detalle. Motivos: el catálogo de una familia es chico pero se *administra* (ordenar, activar, renombrar) más de lo que se *contempla*; C lo hace en menos clics, B resuelve la herencia de color de forma visible y A da identidad sin sacrificar densidad. Si prefieres una sola propuesta pura: **B** para fidelidad a la jerarquía, **A** si el uso móvil familiar es lo principal.

**¿Qué propuesta prefieres para el Catálogo: A, B o C? ¿Quieres combinar elementos de varias propuestas?**
