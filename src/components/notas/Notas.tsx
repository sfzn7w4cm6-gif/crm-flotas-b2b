import { useRef, useState } from 'react'
import { Icon } from '../Icon'
import { borrarAdjunto, descargarAdjunto, tamanoArchivo, validarAdjunto } from '../../lib/adjuntosService'
import { haceCuanto } from '../../lib/formato'
import { autorNota } from '../../lib/notasService'
import type { Adjunto, Nota } from '../../lib/types'
import './Notas.css'

// Notas y adjuntos: el mismo editor y la misma lista en las notas de la oportunidad, en las
// de cada tarea y al completar una tarea desde Inicio.

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

/** Archivos adjuntos como pequeñas etiquetas: clic para descargar, × para quitar (solo los propios). */
export function ListaAdjuntos({
  adjuntos,
  puedeBorrar,
  onBorrado,
}: {
  adjuntos: Adjunto[]
  puedeBorrar?: (a: Adjunto) => boolean
  onBorrado?: (a: Adjunto) => void
}) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (adjuntos.length === 0) return null

  const accion = async (a: Adjunto, fn: () => Promise<void>) => {
    setOcupado(a.annotationid)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="adjuntos">
      <ul className="adjuntos-lista">
        {adjuntos.map((a) => (
          <li key={a.annotationid} className={`adjunto${ocupado === a.annotationid ? ' is-ocupado' : ''}`}>
            <button type="button" className="adjunto-nombre" onClick={() => accion(a, () => descargarAdjunto(a))} title={`Descargar ${a.filename}`}>
              <Icon name="file" size={13} />
              <span>{a.filename}</span>
              <span className="adjunto-tamano">{tamanoArchivo(a.filesize)}</span>
            </button>
            {puedeBorrar?.(a) && (
              <button
                type="button"
                className="adjunto-quitar"
                aria-label={`Quitar ${a.filename}`}
                onClick={() => {
                  if (!window.confirm(`¿Quitar ${a.filename}?`)) return
                  accion(a, async () => {
                    await borrarAdjunto(a.annotationid)
                    onBorrado?.(a)
                  })
                }}
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="wizard-error">{error}</p>}
    </div>
  )
}

/** Botón de clip y los archivos elegidos, antes de guardar. */
export function SelectorAdjuntos({ archivos, onChange, disabled }: { archivos: File[]; onChange: (f: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button type="button" className="adjuntar-btn" onClick={() => input.current?.click()} disabled={disabled} title="Adjuntar archivos" aria-label="Adjuntar archivos">
        <Icon name="clip" size={15} />
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const nuevos = [...(e.target.files ?? [])]
          const malos = nuevos.map(validarAdjunto).filter(Boolean)
          setError(malos.length ? malos.join(' ') : null)
          onChange([...archivos, ...nuevos.filter((f) => !validarAdjunto(f))])
          e.target.value = ''
        }}
      />
      {archivos.length > 0 && (
        <ul className="adjuntos-lista adjuntos-pendientes">
          {archivos.map((f, i) => (
            <li key={`${f.name}-${i}`} className="adjunto">
              <span className="adjunto-nombre">
                <Icon name="file" size={13} />
                <span>{f.name}</span>
                <span className="adjunto-tamano">{tamanoArchivo(f.size)}</span>
              </span>
              <button type="button" className="adjunto-quitar" aria-label={`Quitar ${f.name}`} onClick={() => onChange(archivos.filter((_, j) => j !== i))}>
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="wizard-error adjuntos-error">{error}</p>}
    </>
  )
}

/** Caja para escribir una nota, con adjuntos. Se guarda con el botón o con Ctrl + Intro. */
export function ComposerNota({
  placeholder = 'Escribe una nota…',
  textoBoton = 'Añadir nota',
  autoFocus,
  siempreAbierto,
  onGuardar,
  onCancelar,
}: {
  placeholder?: string
  textoBoton?: string
  autoFocus?: boolean
  /** Muestra los botones aunque esté vacío (p. ej. al preguntar cómo fue la tarea). */
  siempreAbierto?: boolean
  onGuardar: (texto: string, archivos: File[]) => Promise<void>
  onCancelar?: () => void
}) {
  const [texto, setTexto] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abierto = siempreAbierto || texto !== '' || archivos.length > 0
  const puedeGuardar = !guardando && (texto.trim() !== '' || archivos.length > 0)

  const guardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)
    try {
      await onGuardar(texto.trim(), archivos)
      setTexto('')
      setArchivos([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la nota.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={`nota-composer${abierto ? ' is-activo' : ''}`}>
      <textarea
        rows={abierto ? 3 : 1}
        autoFocus={autoFocus}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guardar()
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <div className="nota-composer-pie">
        <SelectorAdjuntos archivos={archivos} onChange={setArchivos} disabled={guardando} />
        {abierto && (
          <div className="nota-composer-acciones">
            {(onCancelar || texto || archivos.length > 0) && (
              <button
                type="button"
                className="btn-link"
                disabled={guardando}
                onClick={() => {
                  setTexto('')
                  setArchivos([])
                  onCancelar?.()
                }}
              >
                {onCancelar ? 'Ahora no' : 'Cancelar'}
              </button>
            )}
            <button type="button" className="btn-primary btn-sm" onClick={guardar} disabled={!puedeGuardar}>
              {guardando ? 'Guardando…' : textoBoton}
            </button>
          </div>
        )}
      </div>
      {error && <p className="wizard-error nota-composer-error">{error}</p>}
    </div>
  )
}

/** Notas con autor, fecha y adjuntos. `textoAntiguo` es el "cómo fue" anterior a las notas de tarea. */
export function ListaNotas({
  notas,
  adjuntos,
  usuarioId,
  soloLectura,
  compacta,
  onBorrar,
  onAdjuntoBorrado,
}: {
  notas: Nota[]
  adjuntos: Map<string, Adjunto[]>
  usuarioId?: string
  soloLectura: boolean
  /** Sin avatar, para dentro de una tarea. */
  compacta?: boolean
  onBorrar?: (n: Nota) => void
  onAdjuntoBorrado?: (a: Adjunto) => void
}) {
  if (notas.length === 0) return null
  return (
    <ul className={`notas-lista${compacta ? ' is-compacta' : ''}`}>
      {notas.map((n) => {
        const autor = autorNota(n)
        const propia = !!usuarioId && n._fl_autor_value === usuarioId
        return (
          <li key={n.fl_notaid} className="nota">
            {!compacta && (
              <span className="nota-avatar" aria-hidden="true">
                {autor ? iniciales(autor) : '·'}
              </span>
            )}
            <div className="nota-cuerpo">
              <div className="nota-cabecera">
                <span className="nota-autor">{autor || 'Sin autor'}</span>
                <span className="nota-fecha" title={new Date(n.createdon).toLocaleString('es-ES')}>
                  {haceCuanto(n.createdon)}
                </span>
                {propia && !soloLectura && onBorrar && (
                  <button type="button" className="nota-eliminar" onClick={() => onBorrar(n)} aria-label="Eliminar nota">
                    Eliminar
                  </button>
                )}
              </div>
              {n.fl_texto && <p className="nota-texto">{n.fl_texto}</p>}
              <ListaAdjuntos
                adjuntos={adjuntos.get(n.fl_notaid) ?? []}
                puedeBorrar={() => propia && !soloLectura}
                onBorrado={onAdjuntoBorrado}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
