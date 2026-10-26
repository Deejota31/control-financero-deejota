import { cargarFixtures, reiniciarUsuarioE2E } from './db'

export default function globalSetup() {
  cargarFixtures()
  reiniciarUsuarioE2E()
}
