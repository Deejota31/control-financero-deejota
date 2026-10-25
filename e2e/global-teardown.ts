import { reiniciarUsuarioE2E } from './db'

export default function globalTeardown() {
  reiniciarUsuarioE2E()
}
