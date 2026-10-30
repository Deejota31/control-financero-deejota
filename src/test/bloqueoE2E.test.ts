import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { adquirirBloqueo, EDAD_MAXIMA_MS, esDueno, liberarBloqueo, procesoVivo, rutaBloqueo } from '../../e2e/bloqueo'

let dir = ''
let ruta = ''
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gd-bloqueo-'))
  ruta = rutaBloqueo('supabase_db_prueba', dir)
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('bloqueo exclusivo de las corridas E2E', () => {
  it('la primera corrida adquiere el bloqueo y deja constancia de su proceso', () => {
    expect(adquirirBloqueo(ruta, 'c', { pid: 111, ahora: 1000, vivo: () => true })).toEqual({ estado: 'adquirido' })
    expect(JSON.parse(readFileSync(ruta, 'utf8'))).toEqual({ pid: 111, inicio: 1000, contenedor: 'c' })
  })

  it('una segunda corrida con la primera viva queda «ocupada» y NO toca el bloqueo ajeno', () => {
    adquirirBloqueo(ruta, 'c', { pid: 111, ahora: 1000, vivo: () => true })
    const r = adquirirBloqueo(ruta, 'c', { pid: 222, ahora: 2000, vivo: () => true })
    expect(r).toMatchObject({ estado: 'ocupado', dueno: { pid: 111 } })
    expect(JSON.parse(readFileSync(ruta, 'utf8')).pid).toBe(111)
  })

  it('si el dueño murió sin liberar (cierre forzado), el bloqueo huérfano se recupera', () => {
    adquirirBloqueo(ruta, 'c', { pid: 111, ahora: 1000, vivo: () => true })
    const r = adquirirBloqueo(ruta, 'c', { pid: 222, ahora: 2000, vivo: () => false })
    expect(r).toMatchObject({ estado: 'recuperado', anterior: { pid: 111 } })
    expect(JSON.parse(readFileSync(ruta, 'utf8')).pid).toBe(222)
  })

  it('un bloqueo demasiado antiguo se recupera aunque su PID exista (PID reutilizado)', () => {
    adquirirBloqueo(ruta, 'c', { pid: 111, ahora: 0, vivo: () => true })
    const r = adquirirBloqueo(ruta, 'c', { pid: 222, ahora: EDAD_MAXIMA_MS + 1, vivo: () => true })
    expect(r.estado).toBe('recuperado')
  })

  it('un archivo de bloqueo ilegible se considera huérfano', () => {
    writeFileSync(ruta, 'no es json')
    expect(adquirirBloqueo(ruta, 'c', { pid: 222, ahora: 5, vivo: () => true })).toMatchObject({ estado: 'recuperado', anterior: null })
  })

  it('solo el dueño libera su bloqueo; el de otra corrida nunca se borra', () => {
    adquirirBloqueo(ruta, 'c', { pid: 111, ahora: 1, vivo: () => true })
    expect(liberarBloqueo(ruta, 222)).toBe(false)
    expect(existsSync(ruta)).toBe(true)
    expect(liberarBloqueo(ruta, 111)).toBe(true)
    expect(existsSync(ruta)).toBe(false)
    expect(liberarBloqueo(ruta, 111)).toBe(false) // idempotente
  })

  it('esDueno solo es cierto para el proceso que tiene el bloqueo (la corrida que aborta no limpia nada)', () => {
    expect(esDueno(ruta, 111)).toBe(false)
    adquirirBloqueo(ruta, 'c', { pid: 111, ahora: 1, vivo: () => true })
    expect(esDueno(ruta, 111)).toBe(true)
    expect(esDueno(ruta, 222)).toBe(false)
  })

  it('tras liberar, otra corrida puede adquirirlo normalmente', () => {
    adquirirBloqueo(ruta, 'c', { pid: 111, ahora: 1, vivo: () => true })
    liberarBloqueo(ruta, 111)
    expect(adquirirBloqueo(ruta, 'c', { pid: 222, ahora: 2, vivo: () => true })).toEqual({ estado: 'adquirido' })
  })

  it('el nombre del archivo depende de la base: bases distintas no se bloquean entre sí', () => {
    expect(rutaBloqueo('base_a', dir)).not.toBe(rutaBloqueo('base_b', dir))
    expect(rutaBloqueo('supabase db/raro', dir)).not.toMatch(/[ /]/)
  })

  it('procesoVivo distingue procesos existentes de inexistentes', () => {
    expect(procesoVivo(process.pid)).toBe(true)
    expect(procesoVivo(1, () => { throw Object.assign(new Error('x'), { code: 'ESRCH' }) })).toBe(false)
    expect(procesoVivo(1, () => { throw Object.assign(new Error('x'), { code: 'EPERM' }) })).toBe(true)
  })
})
