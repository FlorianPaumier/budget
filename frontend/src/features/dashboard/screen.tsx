import { Link } from '@tanstack/react-router'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Wallet,
  PiggyBank,
  Plus,
} from 'lucide-react'
import {
  useMonthData,
  PageHeading,
  QueryState,
  Freshness,
} from '../../components/month-page'
import { formatCad } from '../../lib/money'
import { formatMonth, formatDate } from '../../lib/dates'
export function Dashboard() {
  const query = useMonthData(),
    { data, month } = query
  return (
    <>
      <PageHeading
        eyebrow="VOTRE QUOTIDIEN, PLUS CLAIR"
        title="Vue d’ensemble"
        description={`Un regard sur votre foyer en ${formatMonth(month)}.`}
        action={
          <Link className="primary" to="/transactions" search={{ month }}>
            <Plus size={18} aria-hidden="true" />
            Ajouter une transaction
          </Link>
        }
      />
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {data && (
        <>
          <section className="balance-grid" aria-label="Soldes et prévisions">
            <article className="balance-hero">
              <div className="card-top">
                <span>SOLDE DISPONIBLE</span>
                <Wallet size={21} aria-hidden="true" />
              </div>
              <p className="hero-amount">
                {formatCad(data.balances.spendableCents)}
              </p>
              <p>Votre argent disponible au {formatDate(data.through)}.</p>
              <div className="hero-bottom">
                <span>Solde réel, confirmé par le serveur</span>
                <span className="status-dot" />
              </div>
            </article>
            <article className="metric-card">
              <div className="card-top">
                <span>DE CÔTÉ</span>
                <PiggyBank size={21} aria-hidden="true" />
              </div>
              <p className="metric-amount">
                {formatCad(data.balances.savingsCents)}
              </p>
              <p className="muted">Le solde de votre compte épargne.</p>
              <div className="metric-bottom">
                Un peu aujourd’hui, plus demain.
              </div>
            </article>
            <article className="metric-card">
              <div className="card-top">
                <span>RESTE PRÉVU</span>
                <ArrowUpRight size={21} aria-hidden="true" />
              </div>
              <p className="metric-amount">
                {formatCad(data.plan.moneyLeftCents)}
              </p>
              <p className="muted">
                Après les revenus, factures, budgets et objectif d’épargne
                prévus.
              </p>
              <Link
                className="text-link metric-bottom"
                to="/budget"
                search={{ month }}
              >
                Consulter le budget
                <ArrowRight size={15} />
              </Link>
            </article>
          </section>
          <section className="flow-grid" aria-label="Activité du mois">
            <div>
              <span className="flow-icon income">
                <ArrowDownLeft size={20} />
              </span>
              <div>
                <p className="muted">Revenus du mois</p>
                <strong>{formatCad(data.actuals.incomeCents)}</strong>
              </div>
            </div>
            <div>
              <span className="flow-icon expense">
                <ArrowUpRight size={20} />
              </span>
              <div>
                <p className="muted">Dépenses du mois</p>
                <strong>{formatCad(data.actuals.spendingCents)}</strong>
              </div>
            </div>
            <div>
              <span className="flow-icon">
                <PiggyBank size={20} />
              </span>
              <div>
                <p className="muted">Transferts vers l’épargne</p>
                <strong>
                  {formatCad(data.actuals.transferToSavingsCents)}
                </strong>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">LES DERNIERS MOUVEMENTS</p>
                <h2>Votre activité récente</h2>
              </div>
              <Link to="/transactions" search={{ month }} className="text-link">
                Tout voir
                <ArrowRight size={16} />
              </Link>
            </div>
            {data.entries.length ? (
              <div className="transaction-list">
                {data.entries.slice(0, 6).map((entry) => (
                  <div className="transaction-row" key={entry.id}>
                    <span
                      className={`flow-icon ${entry.kind === 'income' ? 'income' : 'expense'}`}
                    >
                      {entry.kind === 'income' ? (
                        <ArrowDownLeft size={19} />
                      ) : (
                        <ArrowUpRight size={19} />
                      )}
                    </span>
                    <div className="grow">
                      <strong>
                        {entry.note ||
                          data.categories.find((c) => c.id === entry.categoryId)
                            ?.name ||
                          'Transaction'}
                      </strong>
                      <p className="muted text-sm">
                        {formatDate(entry.entryDate)}
                      </p>
                    </div>
                    <strong className="tabular-nums">
                      {formatCad(entry.amountCents)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Wallet size={32} aria-hidden="true" />
                <h3>Un nouveau mois à écrire</h3>
                <p>Vos premières transactions apparaîtront ici.</p>
                <Link
                  to="/transactions"
                  search={{ month }}
                  className="text-link"
                >
                  Enregistrer une transaction
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </section>
          <Freshness updatedAt={query.dataUpdatedAt} error={query.error} />
        </>
      )}
    </>
  )
}
