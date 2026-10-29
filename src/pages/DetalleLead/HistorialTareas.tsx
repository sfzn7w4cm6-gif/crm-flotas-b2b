import type { CSSProperties } from 'react'
import { FASE_COLORS } from '../../components/StatusBadge'
import { TareaEnFicha, type GuardarNotaTarea } from '../../components/tareas/Tareas'
import { FaseLabel } from '../../lib/types'
import type { Adjunto, EstadoTarea, FaseHistorico, Nota, Tarea } from '../../lib/types'

const FECHA: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES', FECHA).replace('.', '')

/**
 * Historial de fases con las tareas de cada una debajo. Una tarea pertenece a la fase en la que
 * estaba la oportunidad cuando se creó; las anteriores al primer registro van a la primera fase.
 */
export function HistorialTareas({
  historico,
  tareas,
  notasPorTarea,
  adjuntos,
  usuarioId,
  soloLectura,
  onCambiarEstado,
  onGuardarNota,
  onBorrarNota,
  onAdjuntoBorrado,
}: {
  historico: FaseHistorico[]
  tareas: Tarea[]
  notasPorTarea: Map<string, Nota[]>
  adjuntos: Map<string, Adjunto[]>
  usuarioId?: string
  soloLectura: boolean
  onCambiarEstado: (t: Tarea, estado: EstadoTarea) => Promise<void>
  onGuardarNota: (t: Tarea, ...args: Parameters<GuardarNotaTarea>) => Promise<void>
  onBorrarNota: (n: Nota) => void
  onAdjuntoBorrado: (a: Adjunto) => void
}) {
  // Del más antiguo al más reciente; cada fase va desde su inicio hasta el inicio de la siguiente.
  const fases = [...historico].sort((a, b) => a.fl_fechainicio.localeCompare(b.fl_fechainicio))
  const porFase = new Map<string, Tarea[]>(fases.map((h) => [h.fl_fasehistoricoid, []]))
  for (const t of [...tareas].sort((a, b) => a.fl_fecha.localeCompare(b.fl_fecha))) {
    const creada = new Date(t.createdon ?? t.fl_fecha).getTime()
    const fase = [...fases].reverse().find((h) => new Date(h.fl_fechainicio).getTime() <= creada) ?? fases[0]
    if (fase) porFase.get(fase.fl_fasehistoricoid)!.push(t)
  }

  const fila = (t: Tarea) => (
    <TareaEnFicha
      key={t.fl_tareaid}
      tarea={t}
      notas={notasPorTarea.get(t.fl_tareaid) ?? []}
      adjuntos={adjuntos}
      usuarioId={usuarioId}
      soloLectura={soloLectura}
      onCambiarEstado={(e) => onCambiarEstado(t, e)}
      onGuardarNota={(texto, archivos) => onGuardarNota(t, texto, archivos)}
      onBorrarNota={onBorrarNota}
      onAdjuntoBorrado={onAdjuntoBorrado}
    />
  )

  if (fases.length === 0) {
    return tareas.length ? <ul className="tarea-lista">{tareas.map(fila)}</ul> : null
  }

  return (
    <ol className="historial">
      {fases.map((h, i) => {
        const siguiente = fases[i + 1]
        const tareasFase = porFase.get(h.fl_fasehistoricoid) ?? []
        return (
          <li key={h.fl_fasehistoricoid} className={`historial-fase${h.fl_esactual ? ' is-actual' : ''}`} style={{ '--fase-color': FASE_COLORS[h.fl_fase].dot } as CSSProperties}>
            <div className="historial-fase-cabecera">
              <span className="historial-punto" aria-hidden="true" />
              <span className="historial-nombre">{FaseLabel[h.fl_fase]}</span>
              <span className="historial-fechas">
                {h.fl_esactual ? (
                  <>
                    desde {fecha(h.fl_fechainicio)} · <span className="historial-en-curso">en curso</span>
                  </>
                ) : (
                  <>
                    {fecha(h.fl_fechainicio)}
                    {siguiente || h.fl_fechafin ? ` – ${fecha(h.fl_fechafin ?? siguiente!.fl_fechainicio)}` : ''}
                    {h.fl_diasenfase !== undefined && h.fl_diasenfase !== null && ` · ${h.fl_diasenfase} ${h.fl_diasenfase === 1 ? 'día' : 'días'}`}
                  </>
                )}
              </span>
            </div>
            {tareasFase.length > 0 && <ul className="historial-tareas">{tareasFase.map(fila)}</ul>}
          </li>
        )
      })}
    </ol>
  )
}
