import { describe, expect, it } from 'vitest'
import { hayCambiosPendientes, registrarCambiosPendientes } from './cambiosPendientes'
import { DIAS_POSPONER, esIOS, invitacionPosponida, modoInstalacion, posponidaHasta } from './pwa'

describe('esIOS', () => {
  it('reconoce iPhone, iPad y el iPad que se anuncia como Mac', () => {
    expect(esIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5)).toBe(true)
    expect(esIOS('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'iPad', 5)).toBe(true)
    expect(esIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true) // iPadOS en modo escritorio
  })
  it('no confunde Android, Windows ni un Mac de verdad (sin pantalla táctil)', () => {
    expect(esIOS('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv81', 5)).toBe(false)
    expect(esIOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0)).toBe(false)
    expect(esIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false)
  })
})

describe('modoInstalacion (cuándo se ofrece instalar)', () => {
  it('ya instalada: no se ofrece nada, aunque haya evento o sea iOS', () => {
    expect(modoInstalacion({ instalada: true, promptDisponible: true, ios: true })).toBe('instalada')
  })
  it('con el evento del navegador, instalación nativa', () => {
    expect(modoInstalacion({ instalada: false, promptDisponible: true, ios: false })).toBe('nativa')
  })
  it('en iPhone sin evento, instrucciones', () => {
    expect(modoInstalacion({ instalada: false, promptDisponible: false, ios: true })).toBe('ios')
  })
  it('sin evento y sin iOS, no se muestra un botón que no haría nada', () => {
    expect(modoInstalacion({ instalada: false, promptDisponible: false, ios: false })).toBe('ninguna')
  })
})

describe('posponer la invitación', () => {
  const ahora = Date.UTC(2026, 10, 1)
  it('queda pospuesta durante el plazo y vuelve después', () => {
    const hasta = posponidaHasta(ahora)
    expect(hasta - ahora).toBe(DIAS_POSPONER * 86_400_000)
    expect(invitacionPosponida(hasta, ahora + 86_400_000)).toBe(true)
    expect(invitacionPosponida(hasta, hasta)).toBe(false)
    expect(invitacionPosponida(hasta, hasta + 1)).toBe(false)
  })
  it('sin marca (o con una marca inválida) la invitación no está pospuesta', () => {
    expect(invitacionPosponida(null, ahora)).toBe(false)
    expect(invitacionPosponida(Number.NaN, ahora)).toBe(false)
  })
})

describe('cambios pendientes (para no recargar y perder un formulario)', () => {
  it('hay cambios mientras algún formulario sucio está abierto y dejan de haberlos al liberarlo', () => {
    expect(hayCambiosPendientes()).toBe(false)
    const a = registrarCambiosPendientes()
    const b = registrarCambiosPendientes()
    expect(hayCambiosPendientes()).toBe(true)
    a()
    expect(hayCambiosPendientes()).toBe(true) // aún queda el otro
    b()
    expect(hayCambiosPendientes()).toBe(false)
    b() // liberar dos veces no rompe nada
    expect(hayCambiosPendientes()).toBe(false)
  })
})
