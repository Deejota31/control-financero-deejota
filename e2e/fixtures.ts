import { test as base, expect } from '@playwright/test'
import { reiniciarUsuarioE2E } from './db'

/**
 * Cada prueba parte y termina con el hogar del usuario E2E reiniciado (también si la prueba falla),
 * de modo que nada de lo que creen las pruebas se mezcla con el seed demo ni se arrastra entre pruebas.
 */
export const test = base.extend<{ aislamiento: void }>({
  aislamiento: [
    // Playwright exige desestructurar el primer parámetro de un fixture, aunque no se use.
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use()
      reiniciarUsuarioE2E()
    },
    { auto: true },
  ],
})

export { expect }
