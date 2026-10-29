import { ComposerNota, ListaNotas } from '../../components/notas/Notas'
import type { Adjunto, Nota } from '../../lib/types'

/** Notas generales de la oportunidad (las de cada tarea se ven dentro de la tarea). */
export function NotasLead({
  notas,
  adjuntos,
  usuarioId,
  soloLectura,
  onGuardar,
  onBorrar,
  onAdjuntoBorrado,
}: {
  /** null = la tabla aún no existe en el entorno. */
  notas: Nota[] | null
  adjuntos: Map<string, Adjunto[]>
  usuarioId?: string
  soloLectura: boolean
  onGuardar: (texto: string, archivos: File[]) => Promise<void>
  onBorrar: (n: Nota) => void
  onAdjuntoBorrado: (a: Adjunto) => void
}) {
  if (notas === null) return <p className="flow-meta">Las notas aún no están activadas en la base de datos.</p>
  return (
    <>
      {!soloLectura && <ComposerNota onGuardar={onGuardar} />}
      {notas.length === 0 ? (
        <p className="flow-meta notas-vacio">Sin notas todavía.</p>
      ) : (
        <ListaNotas notas={notas} adjuntos={adjuntos} usuarioId={usuarioId} soloLectura={soloLectura} onBorrar={onBorrar} onAdjuntoBorrado={onAdjuntoBorrado} />
      )}
    </>
  )
}
