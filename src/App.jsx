import { useState, useEffect, Component } from 'react'
import { Routes, Route, NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import './App.css'
import { supabase } from './services/supabase'
import { listarAreas } from './utils/areasOrder'
import { useAdmin } from './context/AdminContext'
import Areas from './pages/Areas'
import Workload from './pages/Workload'
import WorkloadNovo from './pages/WorkloadNovo'
import Indicadores from './pages/Indicadores'
import Carometro from './pages/Carometro'
import Gantt from './pages/Gantt'
import Cadastros from './pages/Cadastros'
import Todo from './pages/Todo'
import DashboardProdutos from './pages/DashboardProdutos'
import LogAuditoria from './pages/LogAuditoria'
import Conquistas from './pages/Conquistas'

function Layout() {
  const [areas, setAreas] = useState([])
  const location = useLocation()
  const { isAdmin, setAdmin } = useAdmin()

  useEffect(() => {
    listarAreas(supabase, 'id, nome').then(({ data }) => setAreas(data || []))
  }, [])

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2 className="sidebar-title">Carômetro</h2>
        <nav className="nav">
          <NavLink to="/metas-comportamentos" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Comportamentos e Atividades</NavLink>
          <NavLink to="/gantt" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Planejamento (Gantt)</NavLink>
          <NavLink to="/conquistas" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Conquistas</NavLink>
          <NavLink to="/indicadores" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Indicadores</NavLink>
          {isAdmin && (
            <NavLink to="/workload" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Workload</NavLink>
          )}
          <NavLink to="/carometro" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Carômetro</NavLink>
          <NavLink to="/dashboard-produtos" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard Casas Moní</NavLink>
          <NavLink to="/todo" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>TO DO</NavLink>
          {isAdmin && (
            <NavLink to="/cadastros" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Cadastros</NavLink>
          )}
          {isAdmin && (
            <NavLink to="/log" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Log</NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          {isAdmin ? (
            <button type="button" className="nav-link nav-link-footer" onClick={() => setAdmin(false)} title="Sair do modo admin">
              Sair (admin)
            </button>
          ) : (
            <button type="button" className="nav-link nav-link-footer" onClick={() => setAdmin(true)} title="Acesso restrito a administradores">
              Acesso admin
            </button>
          )}
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

function CadastrosGuard() {
  const { isAdmin } = useAdmin()
  if (!isAdmin) return <Navigate to="/" replace />
  return <Cadastros />
}

function WorkloadGuard() {
  const { isAdmin } = useAdmin()
  if (!isAdmin) return <Navigate to="/" replace />
  return <WorkloadNovo />
}

function LogAuditoriaGuard() {
  const { isAdmin } = useAdmin()
  if (!isAdmin) return <Navigate to="/" replace />
  return <LogAuditoria />
}

/** Evita página em branco se o Gantt lançar erro de render — mostra mensagem e indica o console. */
class GanttRouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || this.state.error || 'Erro desconhecido')
      return (
        <div className="card" style={{ margin: '1rem', padding: '1.25rem', maxWidth: 720 }}>
          <h2 style={{ marginTop: 0, color: '#8b2c2c' }}>Não foi possível carregar o Planejamento</h2>
          <p style={{ margin: '0 0 0.75rem' }}>Abra o console do navegador (F12 → Console) para o stack completo.</p>
          <pre
            style={{
              margin: 0,
              padding: '12px',
              background: '#f5f0f0',
              borderRadius: 8,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {msg}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/metas-comportamentos" replace />} />
        <Route path="areas" element={<Areas />} />
        <Route path="metas-comportamentos" element={<Workload />} />
        <Route path="indicadores" element={<Indicadores />} />
        <Route path="conquistas" element={<Conquistas />} />
        <Route path="workload" element={<WorkloadGuard />} />
        <Route path="carometro" element={<Carometro />} />
        <Route path="dashboard-produtos" element={<DashboardProdutos />} />
        <Route path="todo" element={<Todo />} />
        <Route path="log-eventos" element={<Navigate to="/metas-comportamentos" replace />} />
        <Route path="gantt" element={<GanttRouteErrorBoundary><Gantt /></GanttRouteErrorBoundary>} />
        <Route path="cadastros" element={<CadastrosGuard />} />
        <Route path="log" element={<LogAuditoriaGuard />} />
        <Route path="dashboard" element={<Navigate to="/metas-comportamentos" replace />} />
      </Route>
    </Routes>
  )
}

export default App
