# English and German Language Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible, persisted English/German language choice that translates the current ForgeBoard frontend without changing backend contracts.

**Architecture:** A typed `i18n` module owns language identifiers, the complete English/German dictionary, safe localStorage persistence, and a React context. Existing screen components read the `t` function from that context for all UI copy; domain/API values and user content remain unchanged. A reusable toggle is rendered by signed-out and signed-in shells.

**Tech Stack:** React 19, TypeScript 5.8, Vite, Vitest, Testing Library, browser localStorage.

## Global Constraints

- Support only `en` and `de`; use English for absent, unavailable, malformed, or unsupported stored values.
- Store the selected valid language in `localStorage` under the exact key `forgeboard.language`.
- Do not add an i18n package or modify backend code, REST contracts, tenant headers, CSRF behavior, authorization, or persisted domain data.
- Translate all current frontend-owned user-visible copy; do not translate user-entered content, emails, identifiers, or API enum values.
- The controls must be keyboard-native buttons labelled `English` and `Deutsch`, with `aria-pressed` reflecting the selected language.
- Date, number, currency, and time-zone locale formatting are outside this feature.

---

## File Structure

- Create: `frontend/src/i18n.tsx` — language types, exact persistence key, translation dictionary, `LanguageProvider`, `useLanguage`, and `LanguageToggle`.
- Create: `frontend/src/i18n.test.tsx` — provider fallback, switch, persistence, and accessibility tests.
- Modify: `frontend/src/main.tsx` — place the app under `LanguageProvider`.
- Modify: `frontend/src/App.tsx` — translate access, shell, navigation, client view, and place both toggles.
- Modify: `frontend/src/WorkflowView.tsx`, `frontend/src/EngagementsView.tsx`, `frontend/src/EmployeesView.tsx`, `frontend/src/MyWorkDashboard.tsx`, `frontend/src/AuditTrailView.tsx` — replace every frontend-owned visible string and attribute with `t(...)`.
- Modify: `frontend/src/styles.css` — style the compact selector in desktop/mobile access and shell locations without reducing focus visibility.
- Modify: `frontend/src/App.test.tsx` and affected view tests — render through the provider and assert representative German UI in authenticated and unauthenticated paths.
- Modify: `CHANGELOG.md` — add an Unreleased M2 user-visible localization entry.

### Task 1: Build the typed language foundation

**Files:**
- Create: `frontend/src/i18n.tsx`
- Create: `frontend/src/i18n.test.tsx`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Produces: `Language = 'en' | 'de'`, `LANGUAGE_STORAGE_KEY = 'forgeboard.language'`, `LanguageProvider`, `useLanguage(): { language: Language; setLanguage(language: Language): void; t(key: TranslationKey): string }`, and `LanguageToggle`.
- Consumes: React context and browser localStorage only.

- [ ] **Step 1: Write failing provider and toggle tests**

```tsx
it('defaults to English and persists a German selection', () => {
  render(<LanguageProvider><Probe /></LanguageProvider>)
  expect(screen.getByText('Welcome back')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }))
  expect(screen.getByText('Willkommen zurück')).toBeInTheDocument()
  expect(localStorage.getItem('forgeboard.language')).toBe('de')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test -- i18n.test.tsx`

Expected: FAIL because `./i18n` does not exist.

- [ ] **Step 3: Implement the provider, dictionary, and toggle**

```tsx
export const LANGUAGE_STORAGE_KEY = 'forgeboard.language' as const
export type Language = 'en' | 'de'
export const messages = {
  en: { accessWelcome: 'Welcome back', languageEnglish: 'English', languageGerman: 'Deutsch' },
  de: { accessWelcome: 'Willkommen zurück', languageEnglish: 'English', languageGerman: 'Deutsch' },
} as const
export type TranslationKey = keyof typeof messages.en
const LanguageContext = createContext<LanguageContextValue | null>(null)
export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<Language>(() => readLanguage())
  const selectLanguage = (next: Language) => { setLanguage(next); writeLanguage(next) }
  const t = (key: TranslationKey) => messages[language][key]
  return <LanguageContext.Provider value={{ language, setLanguage: selectLanguage, t }}>{children}</LanguageContext.Provider>
}
export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider')
  return value
}
export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage()
  return <div className="language-toggle" role="group" aria-label={t('languageLabel')}><button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button><button type="button" aria-pressed={language === 'de'} onClick={() => setLanguage('de')}>Deutsch</button></div>
}
```

Complete both dictionaries with every key used by the six screen components in Task 2. Define `messages.de` with `satisfies Record<TranslationKey, string>` so a missing German message is a TypeScript error. Initialize language lazily and wrap storage reads/writes in `try/catch` to preserve the English fallback when storage is unavailable.

- [ ] **Step 4: Mount the provider at the application root**

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode><QueryClientProvider client={queryClient}><LanguageProvider><App /></LanguageProvider></QueryClientProvider></StrictMode>,
)
```

- [ ] **Step 5: Run focused tests and build**

Run: `pnpm --dir frontend test -- i18n.test.tsx`

Expected: PASS.

Run: `pnpm --dir frontend build`

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/i18n.tsx frontend/src/i18n.test.tsx frontend/src/main.tsx
git commit -m "feat: add persisted language context"
```

### Task 2: Translate every frontend screen and expose the toggle

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/WorkflowView.tsx`, `frontend/src/EngagementsView.tsx`, `frontend/src/EmployeesView.tsx`, `frontend/src/MyWorkDashboard.tsx`, `frontend/src/AuditTrailView.tsx`, and `frontend/src/styles.css`.
- Modify: `frontend/src/App.test.tsx`, `frontend/src/WorkflowView.test.tsx`, `frontend/src/EmployeesView.test.tsx`, `frontend/src/MyWorkDashboard.test.tsx`, and `frontend/src/AuditTrailView.test.tsx`.

**Interfaces:**
- Consumes: `useLanguage` and `LanguageToggle` from `./i18n`.
- Produces: a fully translated frontend UI with language controls rendered in signed-out and signed-in layouts.

- [ ] **Step 1: Write failing integration tests**

```tsx
it('switches the signed-out access screen to German and restores it on a new render', async () => {
  vi.mocked(session.currentSession).mockRejectedValue(new Error('unauthenticated'))
  const { unmount } = renderApp()
  fireEvent.click(await screen.findByRole('button', { name: 'Deutsch' }))
  expect(screen.getByRole('heading', { name: 'Willkommen zurück' })).toBeInTheDocument()
  unmount()
  renderApp()
  expect(await screen.findByRole('heading', { name: 'Willkommen zurück' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir frontend test -- App.test.tsx`

Expected: FAIL because German copy and language controls are not yet rendered by the application.

- [ ] **Step 3: Replace all frontend-owned copy with translation keys**

Import `useLanguage` in every listed view and destructure `const { t } = useLanguage()`. Replace all headings, descriptions, labels, placeholders, button captions, ARIA labels, empty/loading/error copy, status labels, filter labels, action labels, and generated local phrases. Preserve API enum and user-data values exactly; translate their presentation labels only.

```text
App: access/onboarding copy, client directory, shell navigation, sign-out, mobile Menu, empty selection, loading state.
WorkflowView: board setup, stage forms, work-item forms, move/assignment labels, activity, errors, loading, and empty states.
EngagementsView: template/engagement/request forms, recurrence labels, summaries, actions, errors, loading, and empty states.
EmployeesView: staff form, role display labels, errors, loading, and empty states.
MyWorkDashboard: heading, group labels, region, empty/error/loading wording, and due text.
AuditTrailView: filters, display labels, errors, empty/loading wording, and load-more text.
```

- [ ] **Step 4: Place and style the language control**

Render `<LanguageToggle />` inside the access panel near the ForgeBoard name and inside the signed-in sidebar above the user card. Use one `.language-toggle` class with compact grouped-button styling, selected-state contrast, and `:focus-visible` outline. Keep it visible in the 800px mobile sidebar and access layouts; do not use color as the only selected-state cue.

- [ ] **Step 5: Update test render helpers**

Wrap direct component renders in `LanguageProvider`, or update the shared `renderApp` helper so `App` is mounted inside the provider. Ensure each test clears `forgeboard.language` along with the existing firm key, then update expected English source strings where the translated accessibility name intentionally changes.

- [ ] **Step 6: Run the full frontend suite and production build**

Run: `pnpm --dir frontend test`

Expected: all Vitest suites PASS.

Run: `pnpm --dir frontend build`

Expected: TypeScript compilation and Vite production build exit 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/WorkflowView.tsx frontend/src/EngagementsView.tsx frontend/src/EmployeesView.tsx frontend/src/MyWorkDashboard.tsx frontend/src/AuditTrailView.tsx frontend/src/styles.css frontend/src/App.test.tsx frontend/src/WorkflowView.test.tsx frontend/src/EmployeesView.test.tsx frontend/src/MyWorkDashboard.test.tsx frontend/src/AuditTrailView.test.tsx
git commit -m "feat: translate ForgeBoard interface to German"
```

### Task 3: Record the product change and verify it

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: completed translation feature and test suite.
- Produces: a concise M2 release-note entry and verified final diff.

- [ ] **Step 1: Add the Unreleased release-note entry**

```markdown
### Added

- Added a browser-persisted English/German language choice across signed-out and signed-in ForgeBoard screens, with accessible controls and English fallback. (`M2`)
```

- [ ] **Step 2: Verify source completeness and whitespace**

Run: `rg -n "Welcome back|Sign out|Loading|No .* yet|Create .*|Save .*|Apply filters" frontend/src --glob "*.tsx"`

Expected: no untranslated frontend-owned English copy remains outside the English dictionary or intentional test fixtures.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Run final frontend verification**

Run: `pnpm --dir frontend test && pnpm --dir frontend build`

Expected: both commands exit 0.

- [ ] **Step 4: Inspect final diff and commit documentation**

Run: `git status -sb && git diff --check`

Expected: only intended source, tests, stylesheet, and changelog changes are present.

```bash
git add CHANGELOG.md
git commit -m "docs: record language selection"
```

## Plan Self-Review

- Spec coverage: Tasks 1 and 2 cover typed EN/DE messages, local browser persistence, controls in both shell states, responsive accessibility, all current frontend copy, and tests. Task 3 covers the required release note and final validation.
- Placeholder scan: no deferred work, generic validation language, or undefined interface names remain. The dictionary is completed in Task 1 before screen code consumes keys.
- Type consistency: all consumers use the `useLanguage` contract produced by Task 1; all persistence uses `LANGUAGE_STORAGE_KEY`.
