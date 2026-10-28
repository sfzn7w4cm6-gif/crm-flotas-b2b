import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Icon } from "../../components/Icon";
import { BarChart } from "../../components/charts/BarChart";
import { FaseBadge, FASE_COLORS } from "../../components/StatusBadge";
import { CalendarioTareas, FilaTarea } from "../../components/tareas/Tareas";
import { fetchMisLeads } from "../../lib/leadsService";
import {
  calcularHitos,
  fetchMiHistorico,
  formatoEuros,
  nombrePeriodo,
  periodoActual,
  rangoPeriodo,
  resumenPeriodo,
} from "../../lib/actividadService";
import type { Periodo } from "../../lib/actividadService";
import {
  cambiarEstadoTarea,
  fetchImportesVenta,
  fetchMisTareas,
  fetchObjetivoLeadsMes,
  tareaAbierta,
  tareaVencida,
} from "../../lib/tareasService";
import { FASES_ACTIVAS, Fase, FaseLabel } from "../../lib/types";
import type { EstadoTarea, FaseHistorico, Lead, Tarea } from "../../lib/types";
import { PeriodoFiltro } from "./PeriodoFiltro";
import "./MiActividad.css";

const PLEGADO_KEY = "crmflotas.inicio.tareasPlegadas";
const TAREAS_VISIBLES = 8;

function leerPlegado(): boolean {
  try {
    return localStorage.getItem(PLEGADO_KEY) === "1";
  } catch {
    return false;
  }
}

type Evento = { fecha: Date; valor: number };

export function MiActividad() {
  const { usuario, concesionario } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [historico, setHistorico] = useState<FaseHistorico[]>([]);
  // null = la tabla/columna aun no existe en el entorno (ver 15-tareas-objetivos.ps1)
  const [importes, setImportes] = useState<Map<string, number> | null>(null);
  const [tareas, setTareas] = useState<Tarea[] | null>(null);
  const [objetivo, setObjetivo] = useState<number | null | undefined>(
    undefined,
  );
  const [cargando, setCargando] = useState(true);
  const [plegado, setPlegado] = useState(leerPlegado);
  const [verTodas, setVerTodas] = useState(false);
  const [calendario, setCalendario] = useState(false);
  // Tareas cerradas desde esta pantalla: se siguen mostrando (tachadas) hasta recargar.
  const [cambiadas, setCambiadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      fetchMisLeads(),
      fetchMiHistorico(),
      fetchImportesVenta(),
      fetchMisTareas().catch(() => null),
      fetchObjetivoLeadsMes(concesionario?.fl_concesionarioid).catch(
        () => undefined,
      ),
    ])
      .then(([l, h, imp, t, obj]) => {
        setLeads(l);
        setHistorico(h);
        setImportes(imp);
        setTareas(t);
        setObjetivo(obj);
      })
      .finally(() => setCargando(false));
  }, [concesionario?.fl_concesionarioid]);

  const hitos = useMemo(
    () => calcularHitos(leads, historico),
    [leads, historico],
  );
  const leadPorId = useMemo(
    () => new Map(leads.map((l) => [l.fl_leadid, l])),
    [leads],
  );
  const nombreLead = useCallback(
    (id: string) => leadPorId.get(id)?.fl_razonsocial ?? "Lead",
    [leadPorId],
  );

  const eventosActivados = useMemo<Evento[]>(
    () =>
      [...hitos.values()]
        .filter((h) => h.activado)
        .map((h) => ({ fecha: h.activado!, valor: 1 })),
    [hitos],
  );
  const cierres = useMemo(
    () =>
      [...hitos.entries()]
        .filter(([, h]) => h.cerrado)
        .map(([id, h]) => ({ lead: leadPorId.get(id)!, fecha: h.cerrado! }))
        // Un lead que llego a cierre y luego se perdio no cuenta como venta.
        .filter((c) => c.lead && c.lead.fl_faseactual !== Fase.Perdido)
        .sort((a, b) => b.fecha.getTime() - a.fecha.getTime()),
    [hitos, leadPorId],
  );
  const eventosVentas = useMemo<Evento[]>(
    () => cierres.map((c) => ({ fecha: c.fecha, valor: 1 })),
    [cierres],
  );
  // Importe de cada venta en la fecha de cierre; null si la columna aun no existe.
  const eventosFacturado = useMemo<Evento[] | null>(
    () =>
      importes
        ? cierres.map((c) => ({
            fecha: c.fecha,
            valor: importes.get(c.lead.fl_leadid) ?? 0,
          }))
        : null,
    [cierres, importes],
  );
  const eventosCreados = useMemo<Evento[]>(
    () =>
      leads
        .filter((l) => l.fl_fechaprimercontacto)
        .map((l) => ({ fecha: new Date(l.fl_fechaprimercontacto), valor: 1 })),
    [leads],
  );
  // Primer año que se ofrece en los filtros: el del dato mas antiguo, y como minimo el anterior al actual.
  const primerAnio = useMemo(() => {
    const anios = eventosCreados.map((e) => e.fecha.getFullYear());
    return Math.min(new Date().getFullYear() - 1, ...anios);
  }, [eventosCreados]);

  const tareasLista = useMemo(
    () =>
      (tareas ?? []).filter(
        (t) => tareaAbierta(t) || cambiadas.has(t.fl_tareaid),
      ),
    [tareas, cambiadas],
  );
  const pendientes = (tareas ?? []).filter(tareaAbierta);
  const vencidas = pendientes.filter(tareaVencida).length;

  const cambiarEstado = async (tarea: Tarea, estado: EstadoTarea) => {
    await cambiarEstadoTarea(tarea.fl_tareaid, estado);
    setTareas((ts) =>
      (ts ?? []).map((t) =>
        t.fl_tareaid === tarea.fl_tareaid ? { ...t, fl_estado: estado } : t,
      ),
    );
    setCambiadas((s) => new Set(s).add(tarea.fl_tareaid));
  };

  const togglePlegado = () => {
    setPlegado((p) => {
      try {
        localStorage.setItem(PLEGADO_KEY, p ? "0" : "1");
      } catch {
        /* sin almacenamiento: solo dura esta sesion */
      }
      return !p;
    });
  };

  const porFase = useMemo(() => {
    const activos = leads.filter((l) => l.fl_faseactual !== Fase.Perdido);
    return FASES_ACTIVAS.map((f) => ({
      label: FaseLabel[f],
      value: activos.filter((l) => l.fl_faseactual === f).length,
      color: FASE_COLORS[f].bg,
      textColor: FASE_COLORS[f].fg,
    }));
  }, [leads]);

  if (cargando) return <p className="wizard-loading">Cargando…</p>;

  const hoy = new Date();
  const grafico = (
    <div className="chart-card">
      <div className="chart-card-title">Mis leads por fase</div>
      <BarChart data={porFase} />
    </div>
  );
  const tareasMostradas = verTodas
    ? tareasLista
    : tareasLista.slice(0, TAREAS_VISIBLES);

  return (
    <div className="inicio">
      <div className="page-header">
        <div>
          <h1>
            Hola
            {usuario?.fl_nombre ? `, ${usuario.fl_nombre.split(" ")[0]}` : ""}
          </h1>
          <p className="inicio-subtitulo">
            {hoy.toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {concesionario ? ` · ${concesionario.fl_nombre}` : ""}
          </p>
        </div>
        <Link to="/nuevo-lead" className="btn-primary inicio-nuevo">
          <Icon name="add" size={16} /> Nuevo lead
        </Link>
      </div>

      <div className="inicio-metricas">
        <Metrica
          icono="trendUp"
          titulo="Leads activados"
          ayuda="Leads con los que ya hubo al menos un primer contacto"
          eventos={eventosActivados}
          primerAnio={primerAnio}
        />
        <Metrica
          icono="trophy"
          titulo="Ventas cerradas"
          ayuda="Leads que han llegado a la fase de cierre"
          eventos={eventosVentas}
          primerAnio={primerAnio}
        />
        <TarjetaObjetivo
          objetivo={objetivo}
          eventos={eventosCreados}
          primerAnio={primerAnio}
        />
        {eventosFacturado ? (
          <Metrica
            icono="euro"
            titulo="Facturado"
            ayuda="Suma del importe de venta de los leads cerrados, en la fecha de cierre"
            eventos={eventosFacturado}
            formato={formatoEuros}
            primerAnio={primerAnio}
          />
        ) : (
          <div className="inicio-metrica">
            <CabeceraTarjeta icono="euro" titulo="Facturado" filtro={null} />
            <p className="flow-meta">
              El importe de venta aún no está activado en la base de datos.
            </p>
          </div>
        )}
      </div>

      <div className="inicio-grid">
        <section className="chart-card">
          <div className="chart-card-title-row">
            <div className="chart-card-title">Últimas ventas</div>
            {cierres.length > 0 && (
              <span className="inicio-etiqueta">{cierres.length} en total</span>
            )}
          </div>
          {cierres.length === 0 ? (
            <p className="flow-meta">Aún no hay ventas cerradas.</p>
          ) : (
            <ul className="ventas-lista">
              {cierres.slice(0, 6).map(({ lead, fecha }) => {
                const importe = importes?.get(lead.fl_leadid);
                const detalle = [
                  lead.fl_modelosinteres,
                  lead.fl_numvehiculosrenovarampliar
                    ? `${lead.fl_numvehiculosrenovarampliar} vehículos`
                    : "",
                ].filter(Boolean);
                return (
                  <li key={lead.fl_leadid}>
                    <Link to={`/lead/${lead.fl_leadid}`} className="venta-fila">
                      <span className="venta-fecha">
                        <span className="venta-fecha-dia">
                          {fecha.getDate()}
                        </span>
                        <span className="venta-fecha-mes">
                          {fecha
                            .toLocaleDateString("es-ES", { month: "short" })
                            .replace(".", "")}
                        </span>
                      </span>
                      <span className="venta-cuerpo">
                        <span className="venta-empresa">
                          {lead.fl_razonsocial}
                        </span>
                        {detalle.length > 0 && (
                          <span className="venta-meta">
                            {detalle.join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="venta-derecha">
                        <span className="venta-importe">
                          {importe != null ? formatoEuros(importe) : "—"}
                        </span>
                        <FaseBadge fase={lead.fl_faseactual} size="sm" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="inicio-lateral">
          <section
            className={`chart-card tareas-panel${plegado ? " is-plegado" : ""}`}
          >
            <div className="tareas-cabecera">
              <button
                type="button"
                className="tareas-toggle"
                onClick={togglePlegado}
                aria-expanded={!plegado}
              >
                <Icon
                  name={plegado ? "chevronRight" : "chevronDown"}
                  size={16}
                />
                <span className="chart-card-title">Mis tareas</span>
                {tareas && (
                  <span className="tareas-contador">
                    {pendientes.length} pendiente
                    {pendientes.length === 1 ? "" : "s"}
                    {vencidas > 0 && (
                      <span className="tareas-contador-vencidas">
                        {" "}
                        · {vencidas} vencida{vencidas === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                )}
              </button>
              {tareas && (
                <button
                  type="button"
                  className="tareas-calendario-btn"
                  onClick={() => setCalendario(true)}
                  title="Ver en el calendario"
                >
                  <Icon name="calendar" size={17} />
                </button>
              )}
            </div>

            {!plegado &&
              (tareas === null ? (
                <p className="flow-meta">
                  Las tareas aún no están activadas en la base de datos.
                </p>
              ) : tareasLista.length === 0 ? (
                <div className="tareas-vacio">
                  <Icon name="check" size={20} />
                  <p>No tienes tareas pendientes.</p>
                  <p className="flow-meta">
                    Se crean desde la ficha de cada lead, en Mis leads.
                  </p>
                </div>
              ) : (
                <>
                  <ul className="tarea-lista">
                    {tareasMostradas.map((t) => (
                      <FilaTarea
                        key={t.fl_tareaid}
                        tarea={t}
                        lead={{
                          id: t._fl_lead_value,
                          nombre: nombreLead(t._fl_lead_value),
                        }}
                        onCambiarEstado={(e) => cambiarEstado(t, e)}
                      />
                    ))}
                  </ul>
                  {tareasLista.length > TAREAS_VISIBLES && (
                    <button
                      type="button"
                      className="table-twin-toggle"
                      onClick={() => setVerTodas((v) => !v)}
                    >
                      {verTodas
                        ? "Ver menos"
                        : `Ver todas (${tareasLista.length})`}
                    </button>
                  )}
                </>
              ))}
          </section>
          {/* Con las tareas plegadas, el grafico sube a ocupar el hueco junto a Ultimas ventas. */}
          {plegado && grafico}
        </div>
      </div>

      {!plegado && (
        <>
          <h2 className="inicio-seccion">Mi pipeline</h2>
          {grafico}
        </>
      )}

      {calendario && tareas && (
        <CalendarioTareas
          tareas={tareas}
          nombreLead={nombreLead}
          onCambiarEstado={cambiarEstado}
          onClose={() => setCalendario(false)}
        />
      )}
    </div>
  );
}

function CabeceraTarjeta({
  icono,
  titulo,
  ayuda,
  filtro,
}: {
  icono: string;
  titulo: string;
  ayuda?: string;
  filtro: ReactNode;
}) {
  return (
    <div className="inicio-metrica-cabecera">
      <span className="inicio-metrica-icono">
        <Icon name={icono} size={16} />
      </span>
      <span className="inicio-metrica-titulo" title={ayuda}>
        {titulo}
      </span>
      {filtro}
    </div>
  );
}

function Metrica({
  icono,
  titulo,
  ayuda,
  eventos,
  formato = (n: number) => (Math.round(n * 10) / 10).toLocaleString("es-ES"),
  primerAnio,
}: {
  icono: string;
  titulo: string;
  ayuda: string;
  eventos: Evento[];
  formato?: (n: number) => string;
  primerAnio: number;
}) {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoActual());
  const r = resumenPeriodo(eventos, periodo);
  const diff = variacion(r.valor, r.comparado);

  return (
    <div className="inicio-metrica">
      <CabeceraTarjeta
        icono={icono}
        titulo={titulo}
        ayuda={ayuda}
        filtro={
          <PeriodoFiltro
            value={periodo}
            onChange={setPeriodo}
            primerAnio={primerAnio}
          />
        }
      />
      <div className="inicio-metrica-principal">
        <span className="inicio-metrica-valor">{formato(r.valor)}</span>
        <span className="inicio-metrica-periodo">
          en {nombrePeriodo(periodo)}
        </span>
      </div>
      {diff !== null && <Delta diff={diff} etiqueta={r.comparadoEtiqueta} />}
      <div className="inicio-metrica-pie">
        {r.pie.map((p) => (
          <Dato
            key={p.etiqueta}
            etiqueta={p.etiqueta}
            valor={formato(p.valor)}
          />
        ))}
      </div>
    </div>
  );
}

function variacion(valor: number, comparado: number): number | null {
  return comparado > 0
    ? Math.round(((valor - comparado) / comparado) * 100)
    : null;
}

function Delta({ diff, etiqueta }: { diff: number; etiqueta: string }) {
  return (
    <span
      className={`inicio-delta ${diff > 0 ? "is-up" : diff < 0 ? "is-down" : ""}`}
    >
      {diff > 0 ? "▲" : diff < 0 ? "▼" : "="}{" "}
      {diff === 0 ? "igual" : `${Math.abs(diff)} %`} {etiqueta}
    </span>
  );
}

function TarjetaObjetivo({
  objetivo,
  eventos,
  primerAnio,
}: {
  objetivo: number | null | undefined;
  eventos: Evento[];
  primerAnio: number;
}) {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoActual());
  const cabecera = (
    <CabeceraTarjeta
      icono="target"
      titulo="Objetivo de leads"
      ayuda="Leads creados frente al objetivo asignado"
      filtro={
        objetivo ? (
          <PeriodoFiltro
            value={periodo}
            onChange={setPeriodo}
            primerAnio={primerAnio}
          />
        ) : null
      }
    />
  );
  if (!objetivo) {
    return (
      <div className="inicio-metrica">
        {cabecera}
        <p className="flow-meta">
          {objetivo === undefined
            ? "Los objetivos aún no están activados en la base de datos."
            : "Todavía no hay un objetivo asignado. Lo define el equipo de ventas."}
        </p>
      </div>
    );
  }

  const { desde, hasta, meses } = rangoPeriodo(periodo);
  const meta = objetivo * meses;
  const creados = eventos.filter(
    (e) => e.fecha >= desde && e.fecha < hasta,
  ).length;
  const pct = Math.round((creados / meta) * 100);
  const cumplido = creados >= meta;

  return (
    <div className="inicio-metrica">
      {cabecera}
      <div className="objetivo-principal">
        <span className="inicio-metrica-valor">{creados}</span>
        <span className="objetivo-barra-sep">/</span>
        <span className={`objetivo-meta${cumplido ? " is-cumplido" : ""}`}>
          {meta}
        </span>
      </div>
      <span className="inicio-metrica-periodo">
        leads creados en {nombrePeriodo(periodo)} · objetivo {meta}
        {meses > 1 ? ` (${objetivo} al mes)` : ""}
      </span>
      <div className="objetivo-track">
        <div
          className={`objetivo-fill${cumplido ? " is-completo" : ""}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="inicio-metrica-pie">
        <Dato etiqueta="Cumplido" valor={`${pct} %`} />
        <Dato
          etiqueta={
            cumplido ? "Por encima del objetivo" : "Faltan para el objetivo"
          }
          valor={Math.abs(meta - creados)}
        />
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div className="inicio-dato">
      <span className="inicio-dato-valor">{valor}</span>
      <span className="inicio-dato-etiqueta">{etiqueta}</span>
    </div>
  );
}
