import { retirarFixtures } from './db'

/** Al terminar, la base queda sin usuario ni datos de prueba y sin las funciones de fixtures. */
export default function globalTeardown() {
  retirarFixtures()
}
