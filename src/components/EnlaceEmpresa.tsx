import type { Lead } from '../lib/types'

/** Nombre de la empresa de un lead que lleva a su ficha, sin abrir el lead de la fila. */
export function EnlaceEmpresa({ lead }: { lead: Lead }) {
  if (!lead._fl_empresa_value) return <>{lead.fl_razonsocial}</>
  return (
    <button
      type="button"
      className="link-empresa"
      title="Ver la empresa y sus oportunidades"
      onClick={(e) => {
        e.stopPropagation()
        window.location.hash = `#/empresa/${lead._fl_empresa_value}`
      }}
    >
      {lead.fl_razonsocial}
    </button>
  )
}
