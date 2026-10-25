import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  Link,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import stylesheet from '../styles/app.css?url'
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: 'Foyer · Budget du ménage' },
      ],
      scripts: [
        {
          children:
            "try{var t=localStorage.getItem('budget-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}",
        },
      ],
      links: [
        { rel: 'stylesheet', href: stylesheet },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    }),
    component: () => <Outlet />,
    shellComponent: Document,
    notFoundComponent: () => (
      <main className="pair-layout">
        <h1>Page introuvable</h1>
        <Link to="/">Retour à l’accueil</Link>
      </main>
    ),
    errorComponent: ({ reset }) => (
      <main className="pair-layout">
        <h1>Cette page est indisponible</h1>
        <p>Vérifiez la connexion au serveur.</p>
        <button onClick={reset}>Réessayer</button>
        <a href="/">Accueil</a>
      </main>
    ),
  },
)
function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="fr-CA" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
