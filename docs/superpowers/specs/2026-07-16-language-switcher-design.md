# English and German Language Switcher Design

## Goal

Let ForgeBoard users switch the current browser interface between English and German, and restore the selected language on later visits.

## Scope

- Support English (`en`) and German (`de`) in the frontend.
- Default to English when no valid saved preference exists.
- Provide compact, clearly labelled `EN` and `DE` controls on the signed-out access screen and in the authenticated application shell, including the mobile layout.
- Translate all existing user-visible frontend copy: headings, descriptions, navigation, labels, buttons, helper text, status wording, loading and empty states, validation messages, and recoverable error messages.
- Keep API response values, user-entered content, email addresses, IDs, and persisted domain data unchanged.
- Keep backend endpoints, data model, tenancy behavior, and authentication unchanged.

## Architecture

The frontend will own localization through a small typed language module rather than adding an i18n dependency. It will define the supported language identifiers, a complete English and German message dictionary, and a translation function keyed by the message contract.

A React language context will expose the current language, translation function, and language-selection action to the application tree. The provider reads `forgeboard.language` from `localStorage` once during initialization, validates it against the supported languages, and writes a new value whenever the user selects English or German. This keeps the preference local to the browser and avoids treating a convenience preference as server-side account data.

Reusable language-toggle controls will use semantic buttons labelled `English` and `Deutsch`, visibly indicate the selected language through `aria-pressed`, and remain keyboard operable. The signed-out access view and signed-in shell will each render the control in locations that remain reachable in their desktop and responsive mobile layouts.

## User Flow

1. A new visitor sees the application in English and can choose `DE`.
2. Choosing German immediately re-renders visible interface copy in German and stores `de` under `forgeboard.language`.
3. On a later visit or browser refresh, the provider restores the saved valid value before the application content renders.
4. Choosing `EN` immediately restores English and overwrites the saved preference with `en`.

## Error Handling and Resilience

- If `localStorage` is absent, inaccessible, malformed, or contains a value other than `en` or `de`, the app uses English without preventing access to the application.
- Missing translation keys are a development defect. TypeScript must require both dictionaries to satisfy the same message-key contract.
- Translation must not interpolate untrusted HTML; messages remain ordinary React text.

## Testing

Frontend tests will verify that:

- English is the default when no valid language preference exists.
- Selecting German updates representative signed-out and signed-in UI copy and the selected state of the toggle.
- The selected value is written to and restored from `forgeboard.language`.
- The control has accessible labels and keyboard-native button behavior.
- Existing navigation, authentication, tenant selection, and role-sensitive content still render correctly under the language provider.

## Non-goals

- Language preference synchronization across browsers or user accounts.
- Locale-specific date, number, currency, or time-zone formatting.
- Backend-provided translated content, translated API values, or translation of user-authored data.
- Additional languages beyond English and German in this change.

## Acceptance Criteria

- Users can find and use an `EN` / `DE` language choice while signed out and signed in, on desktop and mobile layouts.
- The entire current frontend interface has English and German translations, with no mixed-language UI caused by hard-coded user-facing strings.
- English is the fallback and default.
- A selected valid language persists across a browser refresh.
- The frontend test suite and production build pass.
