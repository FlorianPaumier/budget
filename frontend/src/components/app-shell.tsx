import { Link, useNavigate, useSearch, useRouter } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  House,
  LayoutDashboard,
  ArrowLeftRight,
  ChartNoAxesCombined,
  CalendarClock,
  Settings,
  PanelsTopLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  LogOut,
  Menu,
} from 'lucide-react'
import { Route } from '../routes/_authenticated'
import { householdQuery } from '../features/dashboard/queries'
import { householdToday, formatMonth, shiftMonth } from '../lib/dates'
import { logout } from '../features/access/functions'
const navigation = [
  { to: '/overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budget', label: 'Budget mensuel', icon: PanelsTopLeft },
  { to: '/insights', label: 'Analyses', icon: ChartNoAxesCombined },
  { to: '/recurring', label: 'Opérations régulières', icon: CalendarClock },
  { to: '/settings', label: 'Paramètres', icon: Settings },
] as const
export function AppShell({ children }: { children: ReactNode }) {
  const { access } = Route.useRouteContext(),
    cache = useQueryClient(),
    router = useRouter(),
    navigate = useNavigate()
  const household = useQuery(householdQuery(access.householdId))
  const search = useSearch({ strict: false }) as { month?: string }
  const month =
    search.month ||
    householdToday(
      new Date(),
      household.data?.timeZone || 'America/Toronto',
    ).slice(0, 7)
  const [open, setOpen] = useState(false),
    [leaving, setLeaving] = useState(false)
  async function disconnect() {
    if (!window.confirm('Déconnecter et révoquer cet appareil ?')) return
    setLeaving(true)
    const { revoked } = await logout()
    await cache.cancelQueries()
    cache.clear()
    window.location.assign(`/pair${revoked ? '' : '?revocation=failed'}`)
  }
  function changeMonth(offset: number) {
    void navigate({
      to: '.',
      search: (old: Record<string, unknown>) => ({
        ...old,
        month: shiftMonth(month, offset),
      }),
    })
  }
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <Link className="brand" to="/overview">
          <House aria-hidden="true" />
          foyer<span>Budget du ménage</span>
        </Link>
        <p className="nav-caption">VOTRE ESPACE</p>
        <nav aria-label="Navigation principale">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              search={{ month }}
              activeProps={{ className: 'active' }}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="household-avatar">F</div>
          <div>
            <strong>Notre foyer</strong>
            <p className="muted text-xs">
              CAD · {household.data?.timeZone || 'Canada'}
            </p>
          </div>
        </div>
        <button
          className="logout"
          onClick={() => void disconnect()}
          disabled={leaving}
        >
          <LogOut size={16} aria-hidden="true" />
          Déconnexion
        </button>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Afficher le menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
          <span className="topbar-title">Le budget, en toute simplicité.</span>
          <div className="month-picker">
            <button
              className="icon-button"
              aria-label="Mois précédent"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <label className="sr-only" htmlFor="selected-month">
              Mois sélectionné
            </label>
            <input
              id="selected-month"
              type="month"
              value={month}
              min="1900-01"
              max="9998-11"
              onChange={(e) => {
                if (e.target.validity.valid && e.target.value)
                  void navigate({
                    to: '.',
                    search: (old: Record<string, unknown>) => ({
                      ...old,
                      month: e.target.value,
                    }),
                  })
              }}
            />
            <button
              className="icon-button"
              aria-label="Mois suivant"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            className="icon-button"
            aria-label="Actualiser les données"
            onClick={() => {
              void cache.invalidateQueries()
              void router.invalidate()
            }}
          >
            <RefreshCw size={18} />
          </button>
        </header>
        <main id="main" className="page" tabIndex={-1}>
          {children}
        </main>
        <footer className="footer">
          <span>foyer / votre budget partagé</span>
          <span>{formatMonth(month)} · Données du serveur</span>
        </footer>
      </div>
    </div>
  )
}
