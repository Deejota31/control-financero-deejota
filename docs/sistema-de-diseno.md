# Sistema de diseño «Aurora Fintech Premium»

Una sola fuente de colores, tipografía y componentes para toda la aplicación. Las pruebas automáticas (`src/domain/tokens.test.ts`, `src/domain/color.test.ts`) fallan si alguien rompe el contraste, deja un token sin definir, edita a mano un acento o escribe un HEX dentro de un componente.

## Capas de tokens (`src/index.css`)

1. **Paleta de marca (`--aur-*`)**: Midnight Navy `#0F1045`, Deep Indigo `#181A5C`, Slate Indigo `#293064`, Electric Indigo `#5D58F0`, Aurora Violet `#8B5CF6`, Soft Lavender `#D6C4FE`, Ice Blue `#67D9F5`, Muted Lavender `#A5A8BE`, Cloud White `#F5F5FF`. No se usa directamente en componentes.
2. **Tokens base por tema** (`--bg`, `--surface`, `--fg`, `--pri`…): Tailwind los expone como `bg-surface`, `text-fg`, `border-line`, `text-pri`… Cada par texto/fondo usado cumple **WCAG AA (4.5:1)**.
3. **Tokens semánticos**: `--background-*`, `--surface-*`, `--text-*`, `--border-*`, `--brand-*`, estados (`--success/warning/danger/info/neutral-*`), gráficos (`--chart-series-1…8`, `--chart-grid`, `--chart-axis`…), sombras, transiciones y `--focus-ring`.

## Modos

- **Claro**: fondo lavanda muy claro (`#F1F0FD`) con superficies blancas, bordes suaves y sombra con matiz índigo.
- **Oscuro**: azul medianoche (`#0F1045`) con superficies Deep Indigo que se distinguen por elevación y borde. Nunca negro puro.
- Un único interruptor global (`ThemeSwitch`, `role="switch"`); el tema se guarda en este navegador y, con sesión, en el perfil. La barra del navegador/PWA (`theme-color`) sigue el tema elegido.

## Gráficos

Ocho series con tonos distintos (no solo variaciones del violeta), una versión más clara para el tema oscuro y contraste ≥ 3:1 sobre la superficie (WCAG 1.4.11). Los estados usan colores semánticos y **siempre** van acompañados de texto o ícono. Las barras de progreso usan `--barra-ok-*`, `--barra-aviso-*` y `--barra-exceso`.

## Paleta de 36 colores del Catálogo

Cada color tiene un id estable (`idDeColor`), un HEX base y variantes derivadas por tema (`tonos()`: fondo suave, borde, ícono ≥ 3:1 y texto ≥ 4.5:1). Los colores guardados antes (HEX libres o `c1…c5`) **nunca se modifican solos**.

**Azules** — Índigo `#4F46E5` (`indigo`) · Azul `#2563EB` (`azul`) · Celeste `#0EA5E9` (`celeste`) · Turquesa `#06B6D4` (`turquesa`) · Cobalto `#1D4ED8` (`cobalto`) · Marino `#1E40AF` (`marino`)

**Verdes** — Teal `#0D9488` (`teal`) · Esmeralda `#059669` (`esmeralda`) · Verde `#16A34A` (`verde`) · Lima `#65A30D` (`lima`) · Oliva `#7C8B2A` (`oliva`) · Menta `#10B981` (`menta`)

**Cálidos** — Amarillo `#CA8A04` (`amarillo`) · Ámbar `#D97706` (`ambar`) · Naranja `#EA580C` (`naranja`) · Coral `#F0614E` (`coral`) · Terracota `#B45309` (`terracota`) · Mostaza `#A16207` (`mostaza`)

**Rojos y rosas** — Rojo `#DC2626` (`rojo`) · Carmesí `#BE123C` (`carmesi`) · Rosa `#DB2777` (`rosa`) · Magenta `#C026D3` (`magenta`) · Frambuesa `#9D174D` (`frambuesa`) · Rubí `#E11D48` (`rubi`)

**Violetas** — Violeta `#7C3AED` (`violeta`) · Púrpura `#7E22CE` (`purpura`) · Lavanda `#8B5CF6` (`lavanda`) · Ciruela `#6B21A8` (`ciruela`) · Orquídea `#A855F7` (`orquidea`) · Berenjena `#581C87` (`berenjena`)

**Neutros** — Pizarra `#64748B` (`pizarra`) · Grafito `#374151` (`grafito`) · Piedra `#78716C` (`piedra`) · Cobre `#92400E` (`cobre`) · Arena `#A8A29E` (`arena`) · Carbón `#1F2937` (`carbon`)

«Armonizar paleta» muestra el color actual y el propuesto de cada elemento, deja elegir cuáles cambian, avisa de los que pasarían de heredar a color propio y no cambia nada hasta pulsar «Aplicar». Cancelar no modifica nada.

## Reglas para código nuevo

- Ningún componente escribe un HEX: usa un token o el color del elemento (`--k` / `domain/color.ts`). Excepciones justificadas: logotipos de Google/Facebook, el tile del isotipo y la barra del navegador.
- Las clases `.acento-*` se generan desde la paleta con `tonos()`; no se editan a mano (la prueba lo verifica).
- `--c1…--c5` existen **solo** para que los datos guardados con esos colores se sigan viendo igual.
- Cifras financieras con `.num` (números tabulares). Texto nítido: sin `transform`/`filter` sobre capas con contenido; los efectos van en capas decorativas.
- Respeta `prefers-reduced-motion`: toda transición lleva `motion-reduce`.
