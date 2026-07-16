'use client'

import { useEffect, useState } from 'react'

export const LANGUAGE_STORAGE_KEY = 'forgeboard.language'
type Language = 'en' | 'de'

const german: Record<string, string> = {
  'Filters': 'Filter',
  'Client': 'Mandant',
  'Owner': 'Verantwortlich',
  'Due state': 'Fälligkeitsstatus',
  'All due states': 'Alle Fälligkeitsstatus',
  'Overdue': 'Überfällig', 'Due today': 'Heute fällig',
  'Due soon': 'Bald fällig', 'No due date': 'Kein Fälligkeitsdatum',
  'Priority': 'Priorität',
  'All priorities': 'Alle Prioritäten',
  'Unassigned': 'Nicht zugewiesen',
  'Reset filters': 'Filter zurücksetzen',
  'Client work': 'Mandantenarbeit',
  'Track every engagement from client request through review.': 'Verfolgen Sie jeden Auftrag von der Mandantenanfrage bis zur Prüfung.',
  'Loading workflow…': 'Arbeitsablauf wird geladen…',
  'The workflow could not be loaded.': 'Der Arbeitsablauf konnte nicht geladen werden.',
  'Drag a work item to another stage, or use its move left and move right buttons.': 'Ziehen Sie eine Aufgabe in eine andere Phase oder verwenden Sie die Schaltflächen zum Verschieben.',
  'Assigned:': 'Zugewiesen:',
  'No work items in this stage.': 'Keine Aufgaben in dieser Phase.',
  'Open task workspace': 'Aufgabenbereich öffnen',
  'Loading task…': 'Aufgabe wird geladen…',
  'This task is not available in this workflow.': 'Diese Aufgabe ist in diesem Arbeitsablauf nicht verfügbar.',
  'Work item': 'Aufgabe', 'Close': 'Schließen',
  'Reviewer': 'Prüfende Person',
  'Task workspace': 'Aufgabenbereich',
  'Back to workflow': 'Zurück zum Arbeitsablauf',
  'Task details': 'Aufgabendetails',
  'No description provided.': 'Keine Beschreibung vorhanden.',
  'Review': 'Prüfung', 'Select reviewer': 'Prüfende Person auswählen',
  'No reviewer assigned.': 'Keine prüfende Person zugewiesen.',
  'The owner is also the reviewer. This is allowed, but a separate reviewer is recommended.': 'Die verantwortliche Person ist auch die prüfende Person. Dies ist erlaubt, eine getrennte Prüfung wird jedoch empfohlen.',
  'Linked document requests': 'Verknüpfte Dokumentenanforderungen',
  'No document requests linked.': 'Keine Dokumentenanforderungen verknüpft.',
  'Recent activity': 'Letzte Aktivitäten',
  'No activity recorded for this work item.': 'Für diese Aufgabe wurden keine Aktivitäten erfasst.',
  'This work item was changed by another user. The board was refreshed; retry your move.': 'Diese Aufgabe wurde von einer anderen Person geändert. Das Board wurde aktualisiert; versuchen Sie die Verschiebung erneut.',
  'The work item could not be moved.': 'Die Aufgabe konnte nicht verschoben werden.',
}

export function useWorkflowLanguage() {
  const [language, setLanguage] = useState<Language>('en')
  useEffect(() => { if (window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'de') setLanguage('de') }, [])
  return (value: string) => language === 'de' ? german[value] ?? value : value
}
