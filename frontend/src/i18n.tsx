import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react'

export const LANGUAGE_STORAGE_KEY = 'forgeboard.language'
export type Language = 'en' | 'de'

const german: Record<string, string> = {
  'Welcome back': 'Willkommen zurück',
  'Build your workspace': 'Erstellen Sie Ihren Arbeitsbereich',
  'Sign in': 'Anmelden',
  'Workflow': 'Arbeitsablauf',
  'My work': 'Meine Aufgaben',
  'Clients': 'Mandanten',
  'Engagements': 'Aufträge',
  'Employees': 'Mitarbeitende',
  'Audit trail': 'Aktivitätsprotokoll',
  'Sign out': 'Abmelden',
  'Menu': 'Menü',
  'English': 'English',
  'Deutsch': 'Deutsch',
  'Language': 'Sprache',
  'Firm directory': 'Mandantenverzeichnis',
  'New client': 'Neuer Mandant',
  'Cancel': 'Abbrechen',
  'Workspace': 'Arbeitsbereich',
  'Primary navigation': 'Hauptnavigation',
  'Everything in view': 'Alles im Blick',
  'Deadlines, ownership, and handoffs in one accountable workspace.': 'Fristen, Verantwortlichkeiten und Übergaben in einem nachvollziehbaren Arbeitsbereich.',
  'Select a firm': 'Firma auswählen',
  'Create a firm in this browser before managing work.': 'Erstellen Sie in diesem Browser eine Firma, bevor Sie Aufgaben verwalten.',
  'The client-work operating system': 'Das Betriebssystem für Mandatsarbeit',
  'Clarity for every ': 'Klarheit für jeden ',
  'client engagement.': 'Mandatsauftrag.',
  'Secure firm access': 'Sicherer Firmenzugang',
  'I have an account': 'Ich habe ein Konto',
  'Create a firm': 'Firma erstellen',
  'Email address': 'E-Mail-Adresse',
  'Password': 'Passwort',
  'Firm name': 'Firmenname',
  'Your name': 'Ihr Name',
  'Confirm password': 'Passwort bestätigen',
  'Please wait...': 'Bitte warten ...',
  'Workflows': 'Arbeitsabläufe',
  'No workflow yet': 'Noch kein Arbeitsablauf',
  'Loading employees…': 'Mitarbeitende werden geladen …',
  'Loading your work...': 'Ihre Aufgaben werden geladen ...',
  'Loading audit activity…': 'Aktivitätsprotokoll wird geladen …',
  'Apply filters': 'Filter anwenden',
  'Reset': 'Zurücksetzen',
  'Load more': 'Mehr laden',
  'Overdue': 'Überfällig',
  'Due soon': 'Bald fällig',
  'Blocked': 'Blockiert',
  'Awaiting review': 'Wartet auf Prüfung',
  'Active': 'Aktiv',
  'No work items.': 'Keine Aufgaben.',
  'Loading engagements...': 'Aufträge werden geladen ...',
  'Loading requests...': 'Anfragen werden geladen ...',
  'Client': 'Mandant',
  'Title': 'Titel',
  'Due date': 'Fälligkeitsdatum',
  'Description': 'Beschreibung',
  'Save work item': 'Aufgabe speichern',
  'Create workflow': 'Arbeitsablauf erstellen',
  'Create employee': 'Mitarbeitende erstellen',
  'Employee name': 'Name der Mitarbeitenden',
  'Work email': 'Geschäftliche E-Mail',
  'Temporary password': 'Temporäres Passwort',
  'Role': 'Rolle',
  'Action': 'Aktion',
  'Actor': 'Akteur',
  'Source': 'Quelle',
  'From': 'Von',
  'To': 'Bis',
  'Keep client identities and contact details ready for every engagement.': 'Halten Sie Mandantenidentitäten und Kontaktdaten für jeden Auftrag bereit.',
  'Legal name': 'Rechtlicher Name',
  'Display name': 'Anzeigename',
  'Primary email': 'Primäre E-Mail-Adresse',
  'Save client': 'Mandant speichern',
  'No clients yet': 'Noch keine Mandanten',
  'Add the first client to begin organizing their work.': 'Fügen Sie den ersten Mandanten hinzu, um dessen Arbeit zu organisieren.',
  'Client work': 'Mandantenarbeit',
  'Track every engagement from client request through review.': 'Verfolgen Sie jeden Auftrag von der Mandantenanfrage bis zur Prüfung.',
  'Workflow name': 'Name des Arbeitsablaufs',
  'Stage name': 'Phasenname',
  'Create a workflow with the stages your firm uses every day.': 'Erstellen Sie einen Arbeitsablauf mit den Phasen, die Ihre Firma täglich nutzt.',
  'Add work item': 'Aufgabe hinzufügen',
  'Recent activity': 'Letzte Aktivitäten',
  'No activity recorded yet.': 'Noch keine Aktivitäten erfasst.',
  'Recurring client work': 'Wiederkehrende Mandantenarbeit',
  'New engagement template': 'Neue Auftragsvorlage',
  'Start an engagement': 'Auftrag starten',
  'Save template': 'Vorlage speichern',
  'Saving template…': 'Vorlage wird gespeichert …',
  'Select a workflow': 'Arbeitsablauf auswählen',
  'Select a template': 'Vorlage auswählen',
  'Select a client': 'Mandant auswählen',
  'Recurrence': 'Wiederholung',
  'Monthly': 'Monatlich',
  'Quarterly': 'Vierteljährlich',
  'Annual': 'Jährlich',
  'Document requests': 'Dokumentenanforderungen',
  'Send request': 'Anfrage senden',
  'Mark received': 'Als erhalten markieren',
  'No document requests': 'Keine Dokumentenanforderungen',
  'Firm access': 'Firmenzugang',
  'Create staff logins and make them available for work-item assignment.': 'Erstellen Sie Mitarbeitenden-Zugänge und machen Sie sie für Aufgabenzuweisungen verfügbar.',
  'No employees yet': 'Noch keine Mitarbeitenden',
  'Create the first employee login for this firm.': 'Erstellen Sie den ersten Mitarbeitenden-Zugang für diese Firma.',
  'Personal work queue': 'Persönliche Aufgabenliste',
  'Only work assigned to you in this firm is shown here.': 'Hier werden nur Aufgaben angezeigt, die Ihnen in dieser Firma zugewiesen sind.',
  'Your assigned work could not be loaded.': 'Ihre zugewiesenen Aufgaben konnten nicht geladen werden.',
  'My assigned work': 'Meine zugewiesenen Aufgaben',
  'Firm oversight': 'Firmenübersicht',
  'Review every recorded change across this firm.': 'Prüfen Sie jede erfasste Änderung in dieser Firma.',
  'All actions': 'Alle Aktionen',
  'All actors': 'Alle Akteure',
  'All sources': 'Alle Quellen',
  'No activity found': 'Keine Aktivitäten gefunden',
  'Try changing the selected filters or return later.': 'Ändern Sie die ausgewählten Filter oder versuchen Sie es später erneut.',
}

const english = Object.fromEntries(Object.entries(german).map(([source, translated]) => [translated, source]))

function translateNode(root: Node, language: Language) {
  const dictionary = language === 'de' ? german : english
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? ''
      const translated = dictionary[value]
      if (translated) node.textContent = translated
      return
    }
    if (!(node instanceof Element)) return
    for (const attribute of ['aria-label', 'placeholder', 'title']) {
      const value = node.getAttribute(attribute)
      if (value && dictionary[value]) node.setAttribute(attribute, dictionary[value])
    }
    node.childNodes.forEach(visit)
  }
  visit(root)
}

function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'de'
}

function readLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isLanguage(stored) ? stored : 'en'
  } catch {
    return 'en'
  }
}

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (english: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setCurrentLanguage] = useState<Language>(readLanguage)
  function setLanguage(next: Language) {
    setCurrentLanguage(next)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    } catch {
      // Language choice remains available for the current page.
    }
  }
  function t(english: string) {
    return language === 'de' ? german[english] ?? english : english
  }
  useEffect(() => {
    translateNode(document.body, language)
    const observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => translateNode(node, language))))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [language])
  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage()
  return <div className="language-toggle" role="group" aria-label={t('Language')}>
    <button type="button" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
    <button type="button" aria-label="Deutsch" aria-pressed={language === 'de'} onClick={() => setLanguage('de')}>DE</button>
  </div>
}
