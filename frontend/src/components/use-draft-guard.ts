import { useEffect } from 'react'
import { useBlocker } from '@tanstack/react-router'
export function useDraftGuard(dirty: boolean, busy = false) {
  useBlocker({
    shouldBlockFn: () =>
      busy ||
      (dirty && !window.confirm('Quitter sans enregistrer ce brouillon ?')),
    enableBeforeUnload: dirty || busy,
  })
  useEffect(() => {
    function before(event: BeforeUnloadEvent) {
      if (dirty || busy) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', before)
    return () => window.removeEventListener('beforeunload', before)
  }, [dirty, busy])
}
