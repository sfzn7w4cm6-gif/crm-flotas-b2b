import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { useAuth } from './context/AuthContext'
import { RolApp } from './lib/types'
import { NuevoLead } from './pages/NuevoLead'
import { MisLeads } from './pages/MisLeads'
import { DetalleLead } from './pages/DetalleLead'
import { DetalleEmpresa } from './pages/DetalleEmpresa'
import { Empresas } from './pages/Empresas'
import { MiActividad } from './pages/MiActividad'
import { SeguimientoLeads } from './pages/SeguimientoLeads'
import { PanelKPI } from './pages/PanelKPI'
import { Info } from './pages/Info'
import './App.css'

function Home() {
  const { effectiveRol } = useAuth()
  if (effectiveRol === RolApp.EquipoVentas) return <Navigate to="/panel-kpi" replace />
  return <Navigate to="/mi-actividad" replace />
}

function App() {
  const { loading, error } = useAuth()

  if (loading) {
    return (
      <div className="app-status">
        <p className="wizard-loading">Cargando CRM Flotas B2B…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-status">
        <p className="app-status-error">{error}</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/nuevo-lead" element={<NuevoLead />} />
        <Route path="/mis-leads" element={<MisLeads />} />
        <Route path="/mi-actividad" element={<MiActividad />} />
        <Route path="/lead/:id" element={<DetalleLead />} />
        <Route path="/empresas" element={<Empresas />} />
        <Route path="/empresa/:id" element={<DetalleEmpresa />} />
        <Route path="/seguimiento" element={<SeguimientoLeads />} />
        <Route path="/panel-kpi" element={<PanelKPI />} />
        <Route path="/info" element={<Info />} />
      </Route>
    </Routes>
  )
}

export default App
