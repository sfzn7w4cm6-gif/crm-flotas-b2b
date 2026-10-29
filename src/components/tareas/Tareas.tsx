import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../Icon'
import { ComposerNota, ListaAdjuntos, ListaNotas, SelectorAdjuntos } from '../notas/Notas'
import { EstadoTarea, EstadoTareaLabel, TipoTarea, TipoTareaLabel } from '../../lib/types'
import type { Adjunto, Nota, Tarea } from '../../lib/types'
import { formatoFechaTarea, inicioDia, tareaVencida } from '../../lib/tareasService'
import type { NuevaTareaInput } from '../../lib/tareasService'
import './Tareas.css'

const ICONO_TIPO: Record<TipoTarea, string> = {
  [TipoTarea.Llamada]: 'phone',
  [TipoTarea.Correo]: 'mail',
  [TipoTarea.Reunion]: 'people',
  [TipoTarea.Visita]: 'car',
  [TipoTarea.Otro]: 'check',
}

// Lo que se pregunta al cerrar la tarea, según su tipo. Se puede dejar para más tarde.
const PREGUNTA_COMPLETADA: Record<TipoTarea, string> = {
  [TipoTarea.Llamada]: '¿Cómo fue la llamada?',
  [TipoTarea.Correo]: '¿Hubo respuesta?',
  [TipoTarea.Reunion]: '¿Cómo fue la reunión?',
  [TipoTarea.Visita]: '¿Cómo fue la visita?',
  [TipoTarea.Otro]: '¿Cuál fue el resultado?',
}
function preguntaCierre(t: Tarea, estado: EstadoTarea): string {
  return estado === EstadoTarea.Cancelada ? '¿Por qué se cancela?' : (PREGUNTA_COMPLETADA[t.fl_tipo] ?? '¿Cuál fue el resultado?')
}

// Las de llamada y reunión pueden llevar el enlace de la videollamada.
const CON_ENLACE = new Set<TipoTarea>([TipoTarea.Llamada, TipoTarea.Reunion])

export type GuardarNotaTarea = (texto: string, archivos: File[]) => Promise<void>

/** Desplegable de estado: siempre del mismo color neutro, el estado se lee en el texto. */
export function EstadoTareaSelect({
  value,
  onChange,
  disabled,
}: {
  value: EstadoTarea
  onChange: (estado: EstadoTarea) => void
  disabled?: boolean
}) {
  return (
    <select
      className="tarea-estado"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value) as EstadoTarea)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Estado de la tarea"
    >
      {Object.entries(EstadoTareaLabel).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}

/** Al cerrar una tarea se ofrece apuntar cómo fue; tras guardar, solo se confirma. */
function useCierreConNota(tarea: Tarea, onCambiarEstado?: (e: EstadoTarea) => Promise<void>, onGuardarNota?: GuardarNotaTarea) {
  const [guardando, setGuardando] = useState(false)
  const [pregunta, setPregunta] = useState<string | null>(null)
  const [guardada, setGuardada] = useState(false)

  useEffect(() => {
    if (!guardada) return
    const t = setTimeout(() => setGuardada(false), 3000)
    return () => clearTimeout(t)
  }, [guardada])

  const cambiar = async (estado: EstadoTarea) => {
    if (!onCambiarEstado) return
    setGuardando(true)
    try {
      await onCambiarEstado(estado)
      const cierra = estado === EstadoTarea.Completada || estado === EstadoTarea.Cancelada
      setPregunta(cierra && onGuardarNota ? preguntaCierre(tarea, estado) : null)
    } finally {
      setGuardando(false)
    }
  }
  const guardarNota: GuardarNotaTarea = async (texto, archivos) => {
    await onGuardarNota?.(texto, archivos)
    setPregunta(null)
    setGuardada(true)
  }
  return { guardando, pregunta, setPregunta, guardada, setGuardada, cambiar, guardarNota }
}

/**
 * Fila de tarea de las listas que mezclan oportunidades (Inicio, calendario): qué, cuándo, de qué
 * empresa y oportunidad, y un botón para ir a ella. Las notas no se muestran aquí, solo se pueden añadir.
 */
export function FilaTarea({
  tarea,
  lead,
  onCambiarEstado,
  onGuardarNota,
}: {
  tarea: Tarea
  lead?: { id: string; nombre: string; numero?: string }
  onCambiarEstado?: (estado: EstadoTarea) => Promise<void>
  onGuardarNota?: GuardarNotaTarea
}) {
  const c = useCierreConNota(tarea, onCambiarEstado, onGuardarNota)
  const vencida = tareaVencida(tarea)
  const cerrada = tarea.fl_estado === EstadoTarea.Completada || tarea.fl_estado === EstadoTarea.Cancelada

  return (
    <li className={`tarea-fila${cerrada ? ' is-cerrada' : ''}`}>
      <span className="tarea-icono" title={TipoTareaLabel[tarea.fl_tipo]}>
        <Icon name={ICONO_TIPO[tarea.fl_tipo] ?? 'check'} size={15} />
      </span>
      <div className="tarea-cuerpo">
        <span className="tarea-titulo">{tarea.fl_titulo}</span>
        <span className="tarea-meta">
          <span className={vencida ? 'tarea-vencida' : undefined}>
            {vencida && 'Vencida · '}
            {formatoFechaTarea(tarea.fl_fecha)}
          </span>
          {lead && (
            <>
              <span className="tarea-sep">·</span>
              <span className="tarea-empresa">{lead.nombre}</span>
              {lead.numero && <span className="tarea-numero">{lead.numero}</span>}
            </>
          )}
        </span>
        {c.pregunta && (
          <div className="tarea-cierre">
            <ComposerNota placeholder={c.pregunta} textoBoton="Guardar nota" autoFocus siempreAbierto onGuardar={c.guardarNota} onCancelar={() => c.setPregunta(null)} />
          </div>
        )}
        {c.guardada && (
          <span className="tarea-nota-guardada" role="status">
            <Icon name="check" size={13} /> Nota guardada
          </span>
        )}
      </div>
      {onCambiarEstado ? (
        <EstadoTareaSelect value={tarea.fl_estado} onChange={c.cambiar} disabled={c.guardando} />
      ) : (
        <span className="tarea-estado tarea-estado-fijo">{EstadoTareaLabel[tarea.fl_estado]}</span>
      )}
      {lead && (
        <Link to={`/lead/${lead.id}`} className="tarea-ir" title={`Abrir la oportunidad${lead.numero ? ` ${lead.numero}` : ''}`} aria-label="Abrir la oportunidad">
          <Icon name="chevronRight" size={16} />
        </Link>
      )}
    </li>
  )
}

/**
 * Tarea dentro de la ficha de la oportunidad: una línea que se despliega con la descripción, el
 * enlace de la llamada, sus adjuntos y sus notas. Se pueden añadir notas cuando se quiera; al
 * completarla o cancelarla se pregunta directamente cómo fue.
 */
export function TareaEnFicha({
  tarea,
  notas,
  adjuntos,
  usuarioId,
  soloLectura,
  onCambiarEstado,
  onGuardarNota,
  onBorrarNota,
  onAdjuntoBorrado,
}: {
  tarea: Tarea
  /** Notas de esta tarea (fl_nota con fl_tarea), de la más reciente a la más antigua. */
  notas: Nota[]
  /** Adjuntos por id de tarea o de nota. */
  adjuntos: Map<string, Adjunto[]>
  usuarioId?: string
  soloLectura: boolean
  onCambiarEstado: (estado: EstadoTarea) => Promise<void>
  onGuardarNota: GuardarNotaTarea
  onBorrarNota: (n: Nota) => void
  onAdjuntoBorrado: (a: Adjunto) => void
}) {
  const [abierta, setAbierta] = useState(false)
  const c = useCierreConNota(tarea, onCambiarEstado, onGuardarNota)
  const vencida = tareaVencida(tarea)
  const cerrada = tarea.fl_estado === EstadoTarea.Completada || tarea.fl_estado === EstadoTarea.Cancelada
  const adjTarea = adjuntos.get(tarea.fl_tareaid) ?? []
  const totalNotas = notas.length + (tarea.fl_resultado ? 1 : 0)
  const totalAdjuntos = adjTarea.length + notas.reduce((acc, n) => acc + (adjuntos.get(n.fl_notaid)?.length ?? 0), 0)

  const cambiar = async (estado: EstadoTarea) => {
    await c.cambiar(estado)
    if (estado === EstadoTarea.Completada || estado === EstadoTarea.Cancelada) setAbierta(true)
  }

  return (
    <li className={`tarea-ficha${cerrada ? ' is-cerrada' : ''}${abierta ? ' is-abierta' : ''}`}>
      <div className="tarea-ficha-linea">
        <button type="button" className="tarea-ficha-toggle" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta}>
          <span className="tarea-icono" title={TipoTareaLabel[tarea.fl_tipo]}>
            <Icon name={ICONO_TIPO[tarea.fl_tipo] ?? 'check'} size={14} />
          </span>
          <span className="tarea-cuerpo">
            <span className="tarea-titulo">{tarea.fl_titulo}</span>
            <span className="tarea-meta">
              <span className={vencida ? 'tarea-vencida' : undefined}>
                {vencida && 'Vencida · '}
                {formatoFechaTarea(tarea.fl_fecha)}
              </span>
              {totalNotas > 0 && (
                <span className="tarea-contador" title={`${totalNotas} ${totalNotas === 1 ? 'nota' : 'notas'}`}>
                  <Icon name="note" size={12} /> {totalNotas}
                </span>
              )}
              {totalAdjuntos > 0 && (
                <span className="tarea-contador" title={`${totalAdjuntos} ${totalAdjuntos === 1 ? 'adjunto' : 'adjuntos'}`}>
                  <Icon name="clip" size={12} /> {totalAdjuntos}
                </span>
              )}
            </span>
          </span>
          <Icon name="chevronDown" size={14} className="tarea-ficha-chevron" />
        </button>
        {soloLectura ? (
          <span className="tarea-estado tarea-estado-fijo">{EstadoTareaLabel[tarea.fl_estado]}</span>
        ) : (
          <EstadoTareaSelect value={tarea.fl_estado} onChange={cambiar} disabled={c.guardando} />
        )}
      </div>

      {abierta && (
        <div className="tarea-ficha-detalle">
          {tarea.fl_notas && <p className="tarea-descripcion">{tarea.fl_notas}</p>}
          {tarea.fl_enlace && (
            <a className="tarea-enlace" href={tarea.fl_enlace} target="_blank" rel="noreferrer">
              <Icon name="link" size={13} />
              {tarea.fl_tipo === TipoTarea.Reunion ? 'Abrir enlace de la reunión' : 'Abrir enlace de la llamada'}
            </a>
          )}
          <ListaAdjuntos adjuntos={adjTarea} puedeBorrar={() => !soloLectura} onBorrado={onAdjuntoBorrado} />

          {!soloLectura && (
            <div className="tarea-ficha-composer">
              <ComposerNota
                key={c.pregunta ?? 'nota'}
                placeholder={c.pregunta ?? 'Añadir una nota a esta tarea…'}
                textoBoton="Guardar nota"
                autoFocus={!!c.pregunta}
                siempreAbierto={!!c.pregunta}
                onGuardar={c.guardarNota}
                onCancelar={c.pregunta ? () => c.setPregunta(null) : undefined}
              />
            </div>
          )}
          {c.guardada && (
            <span className="tarea-nota-guardada" role="status">
              <Icon name="check" size={13} /> Nota guardada
            </span>
          )}
          <ListaNotas notas={notas} adjuntos={adjuntos} usuarioId={usuarioId} soloLectura={soloLectura} compacta onBorrar={onBorrarNota} onAdjuntoBorrado={onAdjuntoBorrado} />
          {tarea.fl_resultado && (
            <div className="tarea-resultado-antiguo">
              <span className="nota-autor">Resultado</span>
              <p className="nota-texto">{tarea.fl_resultado}</p>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------- calendario

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function claveDia(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function CalendarioTareas({
  tareas,
  infoLead,
  onCambiarEstado,
  onGuardarNota,
  onClose,
}: {
  tareas: Tarea[]
  infoLead: (leadId: string) => { nombre: string; numero?: string }
  /** Si se pasa, el detalle del dia permite cambiar el estado de cada tarea. */
  onCambiarEstado?: (tarea: Tarea, estado: EstadoTarea) => Promise<void>
  onGuardarNota?: (tarea: Tarea, texto: string, archivos: File[]) => Promise<void>
  onClose: () => void
}) {
  const [mes, setMes] = useState(() => {
    const h = new Date()
    return new Date(h.getFullYear(), h.getMonth(), 1)
  })
  const [diaSel, setDiaSel] = useState<Date>(() => inicioDia(new Date()))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const porDia = useMemo(() => {
    const m = new Map<string, Tarea[]>()
    for (const t of tareas) {
      const k = claveDia(new Date(t.fl_fecha))
      m.set(k, [...(m.get(k) ?? []), t])
    }
    return m
  }, [tareas])

  // Cuadricula de semanas completas, empezando en lunes.
  const celdas = useMemo(() => {
    const desfase = (mes.getDay() + 6) % 7
    const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1 - desfase)
    const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0)
    const total = Math.ceil((desfase + ultimo.getDate()) / 7) * 7
    return Array.from({ length: total }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i))
  }, [mes])

  const hoy = claveDia(new Date())
  const tareasDia = porDia.get(claveDia(diaSel)) ?? []
  const moverMes = (n: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))

  return (
    <div className="table-modal-backdrop" onClick={onClose}>
      <div className="table-modal calendario-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Calendario de tareas">
        <div className="table-modal-header">
          <div className="calendario-nav">
            <button type="button" className="calendario-flecha" onClick={() => moverMes(-1)} aria-label="Mes anterior">
              <Icon name="chevronLeft" size={16} />
            </button>
            <h2>{mes.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
            <button type="button" className="calendario-flecha" onClick={() => moverMes(1)} aria-label="Mes siguiente">
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
          <div className="table-modal-header-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const h = new Date()
                setMes(new Date(h.getFullYear(), h.getMonth(), 1))
                setDiaSel(inicioDia(h))
              }}
            >
              Hoy
            </button>
            <button type="button" className="table-modal-close" onClick={onClose} aria-label="Cerrar">
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        <div className="calendario-cuerpo">
          <div className="calendario-grid">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="calendario-diasemana">
                {d}
              </div>
            ))}
            {celdas.map((d) => {
              const k = claveDia(d)
              const del = porDia.get(k) ?? []
              const clases = [
                'calendario-dia',
                d.getMonth() !== mes.getMonth() && 'is-fuera',
                k === hoy && 'is-hoy',
                k === claveDia(diaSel) && 'is-sel',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button key={k} type="button" className={clases} onClick={() => setDiaSel(d)}>
                  <span className="calendario-num">{d.getDate()}</span>
                  <span className="calendario-chips">
                    {del.slice(0, 3).map((t) => {
                      const cerrada = t.fl_estado === EstadoTarea.Completada || t.fl_estado === EstadoTarea.Cancelada
                      return (
                        <span key={t.fl_tareaid} className={`calendario-chip${cerrada ? ' is-cerrada' : ''}${tareaVencida(t) ? ' is-vencida' : ''}`}>
                          {new Date(t.fl_fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} {t.fl_titulo}
                        </span>
                      )
                    })}
                    {del.length > 3 && <span className="calendario-mas">+{del.length - 3} más</span>}
                  </span>
                </button>
              )
            })}
          </div>

          <aside className="calendario-detalle">
            <h3>{diaSel.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            {tareasDia.length === 0 ? (
              <p className="flow-meta">Sin tareas este día.</p>
            ) : (
              <ul className="tarea-lista">
                {tareasDia.map((t) => (
                  <FilaTarea
                    key={t.fl_tareaid}
                    tarea={t}
                    lead={{ id: t._fl_lead_value, ...infoLead(t._fl_lead_value) }}
                    onCambiarEstado={onCambiarEstado ? (estado) => onCambiarEstado(t, estado) : undefined}
                    onGuardarNota={onGuardarNota ? (texto, archivos) => onGuardarNota(t, texto, archivos) : undefined}
                  />
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- alta de tarea

function valorLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function NuevaTareaForm({
  onGuardar,
  onCancelar,
}: {
  onGuardar: (input: NuevaTareaInput) => Promise<void>
  onCancelar: () => void
}) {
  const [tipo, setTipo] = useState<TipoTarea>(TipoTarea.Llamada)
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
    return valorLocal(d)
  })
  const [notas, setNotas] = useState('')
  const [enlace, setEnlace] = useState('')
  const [adjuntos, setAdjuntos] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conEnlace = CON_ENLACE.has(tipo)

  const guardar = async () => {
    if (!titulo.trim() || !fecha) {
      setError('Indica qué hay que hacer y cuándo.')
      return
    }
    const url = enlace.trim()
    if (conEnlace && url && !/^https?:\/\//i.test(url)) {
      setError('El enlace debe empezar por https://')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await onGuardar({
        tipo,
        titulo: titulo.trim(),
        fecha: new Date(fecha).toISOString(),
        notas: notas.trim(),
        enlace: conEnlace ? url : '',
        adjuntos,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la tarea.')
      setGuardando(false)
    }
  }

  return (
    <div className="tarea-form">
      <div className="tarea-tipos" role="radiogroup" aria-label="Tipo de tarea">
        {Object.entries(TipoTareaLabel).map(([v, l]) => {
          const valor = Number(v) as TipoTarea
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={tipo === valor}
              className={`tarea-tipo${tipo === valor ? ' is-activo' : ''}`}
              onClick={() => setTipo(valor)}
            >
              <Icon name={ICONO_TIPO[valor]} size={14} />
              {l}
            </button>
          )
        })}
      </div>
      <div className="field">
        <label>¿Qué hay que hacer? *</label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder={tipo === TipoTarea.Correo ? 'Ej. Enviar presupuesto por correo' : 'Ej. Llamar para revisar la oferta'}
        />
      </div>
      <div className="field">
        <label>Fecha y hora *</label>
        <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      {conEnlace && (
        <div className="field">
          <label>Enlace de la {tipo === TipoTarea.Reunion ? 'reunión' : 'llamada'}</label>
          <input type="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://teams.microsoft.com/…" />
        </div>
      )}
      <div className="field">
        <label>Descripción</label>
        <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Lo que haya que tener en cuenta" />
      </div>
      <div className="tarea-form-adjuntos">
        <SelectorAdjuntos archivos={adjuntos} onChange={setAdjuntos} disabled={guardando} />
        {adjuntos.length === 0 && <span className="flow-meta">Adjuntar archivos (presupuesto, ficha técnica…)</span>}
      </div>
      {error && <p className="wizard-error">{error}</p>}
      <div className="tarea-form-acciones">
        <button type="button" className="btn-secondary" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar tarea'}
        </button>
      </div>
    </div>
  )
}
