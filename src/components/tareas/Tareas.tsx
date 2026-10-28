import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../Icon'
import { EstadoTarea, EstadoTareaLabel, TipoTarea, TipoTareaLabel } from '../../lib/types'
import type { Tarea } from '../../lib/types'
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

const CLASE_ESTADO: Record<EstadoTarea, string> = {
  [EstadoTarea.Pendiente]: 'is-pendiente',
  [EstadoTarea.EnCurso]: 'is-encurso',
  [EstadoTarea.Completada]: 'is-completada',
  [EstadoTarea.Cancelada]: 'is-cancelada',
}

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
      className={`tarea-estado ${CLASE_ESTADO[value]}`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value) as EstadoTarea)}
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

/** Fila de tarea. `lead` se muestra cuando la lista mezcla varios leads (inicio). */
export function FilaTarea({
  tarea,
  lead,
  onCambiarEstado,
  soloLectura,
}: {
  tarea: Tarea
  lead?: { id: string; nombre: string }
  onCambiarEstado?: (estado: EstadoTarea) => Promise<void>
  soloLectura?: boolean
}) {
  const [guardando, setGuardando] = useState(false)
  const vencida = tareaVencida(tarea)
  const cerrada = tarea.fl_estado === EstadoTarea.Completada || tarea.fl_estado === EstadoTarea.Cancelada

  const cambiar = async (estado: EstadoTarea) => {
    if (!onCambiarEstado) return
    setGuardando(true)
    try {
      await onCambiarEstado(estado)
    } finally {
      setGuardando(false)
    }
  }

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
              {' · '}
              <Link to={`/lead/${lead.id}`} className="tarea-lead">
                {lead.nombre}
              </Link>
            </>
          )}
        </span>
        {tarea.fl_notas && <span className="tarea-notas">{tarea.fl_notas}</span>}
      </div>
      {soloLectura || !onCambiarEstado ? (
        <span className={`tarea-estado tarea-estado-fijo ${CLASE_ESTADO[tarea.fl_estado]}`}>
          {EstadoTareaLabel[tarea.fl_estado]}
        </span>
      ) : (
        <EstadoTareaSelect value={tarea.fl_estado} onChange={cambiar} disabled={guardando} />
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
  nombreLead,
  onCambiarEstado,
  onClose,
}: {
  tareas: Tarea[]
  nombreLead: (leadId: string) => string
  /** Si se pasa, el detalle del dia permite cambiar el estado de cada tarea. */
  onCambiarEstado?: (tarea: Tarea, estado: EstadoTarea) => Promise<void>
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
                    {del.slice(0, 3).map((t) => (
                      <span key={t.fl_tareaid} className={`calendario-chip ${CLASE_ESTADO[t.fl_estado]}${tareaVencida(t) ? ' is-vencida' : ''}`}>
                        {new Date(t.fl_fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} {t.fl_titulo}
                      </span>
                    ))}
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
                    lead={{ id: t._fl_lead_value, nombre: nombreLead(t._fl_lead_value) }}
                    onCambiarEstado={onCambiarEstado ? (estado) => onCambiarEstado(t, estado) : undefined}
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
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guardar = async () => {
    if (!titulo.trim() || !fecha) {
      setError('Indica qué hay que hacer y cuándo.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await onGuardar({ tipo, titulo: titulo.trim(), fecha: new Date(fecha).toISOString(), notas: notas.trim() })
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
      <div className="field">
        <label>Notas</label>
        <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
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
