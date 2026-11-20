import { z } from 'zod'

// La CSP de producción prohíbe eval: zod debe validar sin compilar (jitless) para no provocar violaciones.
// Se importa PRIMERO en main.tsx, antes de que ningún módulo construya esquemas.
z.config({ jitless: true })
