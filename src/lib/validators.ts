/** Validaciones de formato para los campos de contacto/identificacion del
 *  wizard de alta de lead. Solo valida formato (no existencia real del
 *  correo, ni el digito de control del CIF/NIF) — es la comprobacion que
 *  tiene sentido hacer en un formulario sin servicios externos. */

export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim())
}

/** Telefono fijo o movil espanol: 9 digitos empezando por 6, 7, 8 o 9,
 *  con prefijo +34 opcional y espacios opcionales. */
export function telefonoValido(valor: string): boolean {
  return /^(\+34[\s-]?)?[6789]\d{2}[\s-]?\d{3}[\s-]?\d{3}$/.test(valor.trim())
}

/** CIF (empresas), NIF (autonomos/particulares) o NIE — solo formato,
 *  sin comprobar la letra/digito de control. */
export function cifNifValido(valor: string): boolean {
  const v = valor.trim().toUpperCase()
  const cif = /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/
  const nif = /^\d{8}[A-Z]$/
  const nie = /^[XYZ]\d{7}[A-Z]$/
  return cif.test(v) || nif.test(v) || nie.test(v)
}
