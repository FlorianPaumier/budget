import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
test.describe.configure({ mode: 'serial' })
const api = 'http://127.0.0.1:4333/api/v1'
async function apiCall(
  path: string,
  body?: unknown,
  credential?: string,
  method = body ? 'POST' : 'GET',
) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok)
    throw new Error(`Fixture API failed: ${path} ${response.status}`)
  return response.status === 204 ? null : (await response.json()).data
}
let credential: string
let firstCode: string
let categoryId: string
test.beforeAll(async () => {
  const setup = await apiCall('/bootstrap', {
    openingSpendableCents: 100000,
    openingSavingsCents: 50000,
    reminderTime: '09:00',
  })
  firstCode = setup.pairingCode
  const fixture = await apiCall('/pair', {
    pairingCode: firstCode,
    label: 'E2E fixture',
  })
  credential = fixture.credential
  const category = await apiCall(
    '/categories',
    { name: 'Épicerie' },
    credential,
  )
  categoryId = category.id
})
async function pairBrowser(page: Page) {
  const code = await apiCall('/pairing-codes', {}, credential)
  await page.goto('/pair')
  await page.getByLabel('Code d’association').fill(code.pairingCode)
  await page.getByRole('button', { name: 'Ouvrir mon budget' }).click()
  await expect(
    page.getByRole('heading', { name: 'Vue d’ensemble' }),
  ).toBeVisible()
}
test('pairing, ledger, budgets, recurring and settings against real Adonis', async ({
  page,
}) => {
  await pairBrowser(page)
  await expect(page.getByText(/1\s000,00/).first()).toBeVisible()
  await page.getByRole('link', { name: 'Transactions', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter une transaction' }).click()
  await page.getByRole('textbox', { name: /^Montant \(CAD\)/ }).fill('12,34')
  await page.getByLabel('Note', { exact: true }).fill('Épicerie de test')
  await page
    .getByRole('combobox', { name: 'Catégorie', exact: true })
    .first()
    .selectOption(categoryId)
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(
    page.getByText('Épicerie de test', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.getByRole('textbox', { name: /^Montant \(CAD\)/ }).fill('15.00')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByText('15,00', { exact: false }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Historique', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Historique de la transaction' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Budget mensuel', exact: true }).click()
  await page.getByRole('button', { name: 'Modifier le budget' }).click()
  await page.getByLabel('Budget pour Épicerie (CAD)').fill('200')
  await page.getByRole('button', { name: 'Enregistrer le budget' }).click()
  await expect(page.getByText('200,00', { exact: false }).first()).toBeVisible()
  await page.getByLabel('Montant prévu (CAD)').fill('50')
  await page.getByRole('button', { name: 'Enregistrer l’objectif' }).click()
  await page
    .getByRole('link', { name: 'Opérations régulières', exact: true })
    .click()
  await page.getByRole('button', { name: 'Ajouter une opération' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Abonnement test')
  await page.getByRole('textbox', { name: /^Montant \(CAD\)/ }).fill('10')
  await page.getByRole('button', { name: 'Enregistrer l’opération' }).click()
  await expect(
    page.getByText('Abonnement test', { exact: true }).first(),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Analyses', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Où va votre argent ?' }),
  ).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Période analysée' })
    .selectOption('quarter')
  await expect(
    page.getByText('3 mois chargés explicitement', { exact: false }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Paramètres', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Appareils associés' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Paramètres', exact: true }),
  ).toBeVisible()
  const cookies = await page.context().cookies()
  const session = cookies.find((c) => c.name === 'budget-dev-session')
  expect(session?.httpOnly).toBe(true)
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    'budget-dev-session',
  )
  expect(await page.content()).not.toContain(credential)
  const a11y = await new AxeBuilder({ page }).analyze()
  expect(a11y.violations).toEqual([])
})
test('used pairing code and forged session do not grant access', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'budget-dev-session',
      value: 'tampered',
      url: 'http://localhost:3000',
    },
  ])
  await page.goto('/overview')
  await expect(page).toHaveURL(/\/pair/)
  await page.getByText('Aucun appareil déjà associé ?').click()
  await expect(
    page.getByText('docker compose exec budget node build/ace.js pairing:code'),
  ).toBeVisible()
  await page.getByLabel('Code d’association').fill(firstCode)
  await page.getByRole('button', { name: 'Ouvrir mon budget' }).click()
  await expect(page.getByRole('alert')).toContainText('expiré')
})

test('concurrent corrections and deletions preserve the browser draft', async ({
  page,
}) => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const entry = await apiCall(
    '/entries',
    {
      kind: 'expense',
      entryDate: today,
      amountCents: 100,
      note: 'Conflit test',
    },
    credential,
  )
  await pairBrowser(page)
  await page.getByRole('link', { name: 'Transactions', exact: true }).click()
  await page
    .getByRole('row')
    .filter({ hasText: 'Conflit test' })
    .getByRole('button', { name: 'Modifier', exact: true })
    .click()
  await apiCall(
    `/entries/${entry.id}`,
    { amountCents: 200, revision: entry.revision },
    credential,
    'PATCH',
  )
  await page.getByRole('textbox', { name: /^Montant \(CAD\)/ }).fill('3,00')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('changé')
  await expect(
    page.getByRole('textbox', { name: /^Montant \(CAD\)/ }),
  ).toHaveValue('3,00')
  const server = await apiCall(`/entries/${entry.id}`, undefined, credential)
  expect(server.amountCents).toBe(200)
  await page
    .getByRole('button', { name: 'Consulter la version actuelle' })
    .click()
  await expect(page.getByText(/Serveur : 2,00/)).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Fermer le formulaire' }).click()
  await page
    .getByRole('row')
    .filter({ hasText: 'Conflit test' })
    .getByRole('button', { name: 'Modifier', exact: true })
    .click()
  await apiCall(
    `/entries/${entry.id}`,
    { revision: server.revision },
    credential,
    'DELETE',
  )
  await page.getByRole('textbox', { name: /^Montant \(CAD\)/ }).fill('4,00')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('supprimé')
  await expect(
    page.getByRole('textbox', { name: /^Montant \(CAD\)/ }),
  ).toHaveValue('4,00')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Fermer le formulaire' }).click()
  await page.getByRole('link', { name: 'Budget mensuel', exact: true }).click()
  await page.getByRole('button', { name: 'Modifier le budget' }).click()
  await page.getByLabel('Budget pour Épicerie (CAD)').fill('250')
  const month = today.slice(0, 7)
  const plan = await apiCall(`/months/${month}/plan`, undefined, credential)
  const estimate = plan.estimates.find(
    (value: { categoryId: string }) => value.categoryId === categoryId,
  )
  await apiCall(
    `/months/${month}/estimates/${categoryId}`,
    { amountCents: 30000, revision: estimate.revision },
    credential,
    'PUT',
  )
  await page.getByRole('button', { name: 'Actualiser les données' }).click()
  await expect(page.getByText('300,00', { exact: false }).first()).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Suggestion médiane' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Enregistrer le budget' }).click()
  await expect(page.getByRole('alert')).toContainText('changé')
  await expect(page.getByLabel('Budget pour Épicerie (CAD)')).toHaveValue('250')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Annuler', exact: true }).click()
  // A deleted category must not unmount a budget draft.
  const disposable = await apiCall(
    '/categories',
    { name: 'Brouillon supprimé' },
    credential,
  )
  await page.getByRole('button', { name: 'Actualiser les données' }).click()
  const budgetRow = page
    .locator('article')
    .filter({ has: page.getByText('Brouillon supprimé', { exact: true }) })
  await budgetRow.getByRole('button', { name: 'Modifier le budget' }).click()
  await page.getByLabel('Budget pour Brouillon supprimé (CAD)').fill('77')
  await apiCall(
    `/categories/${disposable.id}`,
    { revision: disposable.revision },
    credential,
    'DELETE',
  )
  await page.getByRole('button', { name: 'Actualiser les données' }).click()
  await expect(
    page.getByLabel('Budget pour Brouillon supprimé (CAD)'),
  ).toHaveValue('77')
  page.once('dialog', (dialog) => dialog.accept())
  await budgetRow.getByRole('button', { name: 'Annuler', exact: true }).click()

  await page.getByRole('link', { name: 'Paramètres', exact: true }).click()
  await page
    .getByRole('button', { name: 'Modifier Épicerie', exact: true })
    .click()
  await page
    .getByLabel('Nom de la catégorie', { exact: true })
    .fill('Mon brouillon')
  const category = (await apiCall('/categories', undefined, credential)).find(
    (c: { id: string }) => c.id === categoryId,
  )
  const updated = await apiCall(
    `/categories/${categoryId}`,
    { name: 'Épicerie serveur', revision: category.revision },
    credential,
    'PATCH',
  )
  await page.getByRole('button', { name: 'Actualiser les données' }).click()
  await expect(
    page.getByLabel('Nom de la catégorie', { exact: true }),
  ).toHaveValue('Mon brouillon')
  await page
    .getByRole('button', { name: 'Enregistrer Épicerie', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('changé')
  await apiCall(
    `/categories/${categoryId}`,
    { revision: updated.revision },
    credential,
    'DELETE',
  )
  await page.getByRole('button', { name: 'Actualiser les données' }).click()
  await expect(
    page.getByLabel('Nom de la catégorie', { exact: true }),
  ).toHaveValue('Mon brouillon')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Annuler', exact: true }).click()

  await page.getByLabel('Heure locale du ménage').fill('08:15')
  const household = await apiCall('/household', undefined, credential)
  await apiCall(
    '/household',
    { reminderTime: '10:30', revision: household.revision },
    credential,
    'PATCH',
  )
  await page.getByRole('button', { name: 'Actualiser les données' }).click()
  await expect(page.getByLabel('Heure locale du ménage')).toHaveValue('08:15')
  await page.getByRole('button', { name: 'Enregistrer l’heure' }).click()
  await expect(page.getByRole('alert')).toContainText('changé')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Charger l’heure actuelle' }).click()
  await expect(page.getByLabel('Heure locale du ménage')).toHaveValue('10:30')

  await page
    .getByRole('link', { name: 'Opérations régulières', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Confirmer', exact: true }).first(),
  ).toBeVisible()
  const through = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10)
  const occurrence = (
    await apiCall(
      `/occurrences?from=${month}-01&through=${through}`,
      undefined,
      credential,
    )
  )[0]
  await page
    .getByRole('button', { name: 'Confirmer', exact: true })
    .first()
    .click()
  await page.getByLabel('Montant réel (CAD)').fill('13')
  await apiCall(
    `/occurrences/${occurrence.id}/confirm`,
    {
      revision: occurrence.revision,
      actualAmountCents: 1100,
      actualDate: today,
    },
    credential,
  )
  await page.getByRole('button', { name: 'Actualiser les données' }).click()
  await expect(page.getByLabel('Montant réel (CAD)')).toHaveValue('13')
  await page
    .getByRole('button', { name: 'Enregistrer la confirmation' })
    .click()
  await expect(page.getByRole('alert')).toContainText('changé')
  const rule = await apiCall(
    `/recurring-rules/${occurrence.ruleId}`,
    undefined,
    credential,
  )
  await apiCall(
    `/recurring-rules/${rule.id}`,
    { revision: rule.revision, from: `${month}-01`, through },
    credential,
    'DELETE',
  )
  await page.getByRole('button', { name: 'Actualiser les données' }).click()
  await expect(page.getByLabel('Montant réel (CAD)')).toHaveValue('13')
})

test('rejects forged write origins, renders narrow/dark layouts and clears revoked access', async ({
  page,
}) => {
  let writeUrl = ''
  page.on('request', (request) => {
    if (request.method() === 'POST') writeUrl = request.url()
  })
  await pairBrowser(page)
  expect(writeUrl).toContain('/_serverFn/')
  const foreign = await page.request.post(writeUrl, {
    headers: { Origin: 'https://evil.example' },
    data: {},
  })
  expect(foreign.status()).toBe(403)
  const missing = await page.request.post(writeUrl, { data: {} })
  expect(missing.status()).toBe(403)
  await page.screenshot({ path: 'test-results/overview.png', fullPage: true })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await expect(
    page.getByRole('heading', { name: 'Vue d’ensemble' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Afficher le menu' }).click()
  await page.getByRole('link', { name: 'Paramètres', exact: true }).click()
  const devices = await apiCall('/devices', undefined, credential)
  const browser = devices
    .filter(
      (device: { label: string; revokedAt: string | null }) =>
        device.label === 'Ordinateur du foyer' && !device.revokedAt,
    )
    .at(-1)
  await apiCall(`/devices/${browser.id}`, undefined, credential, 'DELETE')
  await page
    .getByRole('button', { name: 'Actualiser les données' })
    .click()
    .catch(() => undefined)
  await expect(page).toHaveURL(/\/pair/)
})

test('a lost browser RPC response preserves the draft and blocks duplicate creation', async ({
  page,
}) => {
  await pairBrowser(page)
  let interrupted = false
  let releaseResponse: () => void = () => {}
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })
  await page.route('**/_serverFn/**', async (route) => {
    if (
      !interrupted &&
      route.request().method() === 'POST' &&
      route.request().postData()?.includes('lost-response-check')
    ) {
      interrupted = true
      await route.fetch({ maxRetries: 0 })
      await responseGate
      await route.abort('failed')
    } else await route.continue()
  })
  await page.getByRole('link', { name: 'Transactions', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter une transaction' }).click()
  await page.getByRole('textbox', { name: /^Montant \(CAD\)/ }).fill('1,00')
  await page.getByLabel('Note', { exact: true }).fill('lost-response-check')
  await expect(
    page.getByRole('button', { name: 'Ajouter une transaction' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByLabel('Note', { exact: true })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Fermer le formulaire' }),
  ).toBeDisabled()
  await page.getByRole('link', { name: 'Budget mensuel', exact: true }).click()
  await expect(page).toHaveURL(/\/transactions/)
  releaseResponse()
  await expect(page.getByRole('alert')).toContainText('incertain')
  await expect(
    page.getByRole('button', { name: 'Enregistrer', exact: true }),
  ).toBeDisabled()
  await expect(page.getByLabel('Note', { exact: true })).toHaveValue(
    'lost-response-check',
  )
  const entries = await apiCall('/entries', undefined, credential)
  expect(
    entries.filter(
      (entry: { note: string | null }) => entry.note === 'lost-response-check',
    ),
  ).toHaveLength(1)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Fermer le formulaire' }).click()
  await page
    .getByRole('link', { name: 'Opérations régulières', exact: true })
    .click()
  interrupted = false
  await page.getByRole('button', { name: 'Ajouter une opération' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('lost-response-check')
  await page.getByRole('textbox', { name: /^Montant \(CAD\)/ }).fill('2')
  await expect(
    page.getByRole('button', { name: 'Ajouter une opération' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Enregistrer l’opération' }).click()
  await expect(page.getByRole('alert')).toContainText('incertain')
  await expect(
    page.getByRole('button', { name: 'Enregistrer l’opération' }),
  ).toBeDisabled()
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue(
    'lost-response-check',
  )
  const rules = await apiCall('/recurring-rules', undefined, credential)
  expect(
    rules.filter(
      (rule: { name: string }) => rule.name === 'lost-response-check',
    ),
  ).toHaveLength(1)
})
