# Helen Dictionary design system

## Context and goals

Helen must make the loop **Discover → Keep → Practice → Review** easy to follow on a phone and on a desktop. The audience is English learners; the product is a personal dictionary and learning PWA. The supplied ForumFlash extraction's “developer documentation site” classification has low confidence and does not describe Helen's audience.

Reference: the user's ForumFlash guidance and annotated screenshots, https://forumflash.vercel.app/. The reference site could not be opened from the current restricted environment; this document uses the material supplied in chat. Existing dictionary sources, selected senses, favorite voice, artwork, review schedule and offline caches must be preserved.

## Design tokens and foundations

The implementation source is `public/assets/workspace.css`. Component guidance must use semantic token names. Brand direction: quiet cream canvas, white panels, deep teal navigation, restrained mint feedback and warm gold highlights. Dark mode must use the same semantic roles.

| Role | Token |
| --- | --- |
| Main / supporting / inverse text | `--text-primary`, `--text-tertiary`, `--text-inverse` |
| Page / panel / raised / selected surface | `--surface-page`, `--surface-base`, `--surface-raised`, `--surface-selected` |
| Action / hover / focus / success / error | `--action`, `--action-hover`, `--focus`, `--success`, `--danger` |
| Borders / accent / soft wash | `--border`, `--accent`, `--translation-bg` |
| Spacing | `--space-1` … `--space-8`: 4, 8, 12, 16, 24, 32, 48, 64 px |
| Radius | `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-pill` |
| Depth / motion | `--shadow-1`, `--shadow-hover`, `--motion` |
| Typography | `--font`, `--font-small`, `--font-base`, `--font-title` |

Body text must be at least 16px; supporting text should be 14px. The reference's 8–13px scale must not be used for reading tasks. The system font stack avoids a font download and layout shifts; a future locally served Alexandria font should keep equivalent metrics. Typography must wrap and grow with zoom rather than truncate definitions.

## Component-level rules

### Layout and navigation

The header must provide five separate destinations: Dictionary (`/`), Study (`/study`), My words (`/words`), History (`/history`) and Offline (`/offline`). Only one page must be visible and reachable by keyboard at a time. Voice, meaning language, theme and dog controls must remain in the shared Preferences disclosure. Navigation must mark the current link with `aria-current=page`, update the title and move focus to the destination heading. It must support direct URLs, refresh, Back/Forward and legacy anchors. Internal page changes must retain the current word and unfinished quiz without a new network request. Only Dictionary must restore a saved lookup. No fixed toolbar may cover answers or the next-question action. Desktop panels should share `--content-width`; mobile panels must keep `--space-4` side gutters. Install, offline pack and the visible Save favorite audio action must live on Offline. The service worker must support offline navigation to all five app routes without capturing API, health or unknown URLs.

### Search and word results

Search anatomy: source language, combobox, microphone and submit action; suggestions below, with announced state. Search must retain its existing IME, pointer and keyboard behavior. The field must be 16px on mobile to avoid iOS auto-zoom. The result must retain headword, IPA, selected-voice playback, definition rows, eye translation controls and collapsed Explore more sections.

### Study overview and practice

The dashboard must provide Review due, Word sets and Your progress cards. Practice must explicitly select a source set and a style: mixed quiz, multiple choice, fill in the blank, typing or matching. All non-review practice must require at least three usable words. Fill in the blank must use exact word occurrences in source examples; it must not invent sentences. Multiple choice should show up to four choices; when distinct choices are insufficient it must fall back to typing rather than add ambiguous distractors. Matching must reject duplicate definitions and known synonym pairs, shuffle the meaning column, and allow either column to be selected first.

Answers must show a textual correct/incorrect state, the correct word, definition, available example and source. Feedback must provide audio, dictionary access and an explicit Mark for review action. Translation must be asynchronous and discard replies from previous questions. Ordinary quiz attempts must not reschedule review. Mark for review is an explicit user action that makes the card due; Review ratings update spaced repetition.

### Word sets

Set cards must display name, saved-word count, prepared-word count and Practice/Edit/Delete actions. A set must be a grouping of existing favorites: a word can belong to several sets. The editor must use a native modal dialog, labeled fields and checkbox selection. Filtering must only hide options, preserving checked selections. Empty sets must be allowed. Names must be unique ignoring case, with 1–50 characters; storage must cap at 100 sets. Deleting a set must ask for confirmation and must retain its words and schedule.

Starter sets should be small and editable through `study-starters.json`. Adding one must be initiated by the user, merge existing membership and respect the 500-favorite limit. Source definitions must come from the licensed offline pack; no AI/API generation is needed.

### Progress

Progress must show answer count, accuracy, reviewed-word count, due count, words to revisit and recent completed sessions. It must describe its limit: the latest 500 answer attempts and 100 completed sessions on this device. Wrong-answer statistics must be separated from mastery and review intervals. Answer events must save immediately; a stopped session must not be counted as completed. Review counts must derive from the existing cards.

### Shared state contract

Every interactive family above must define all seven states:

| State | Required behavior |
| --- | --- |
| Default | Semantic text/surface/border tokens, descriptive label, 44px hit area |
| Hover | Action border or soft wash, optional subtle lift; no layout expansion |
| Focus-visible | Visible 3px outline with 4px offset; header uses accent outline |
| Active | Small press offset or selected surface; text/`aria-pressed` identifies selection |
| Disabled | Readable muted styling, native disabled control, no hover movement; explain missing prerequisites nearby |
| Loading | Existing hamster loader, announced short status, cancel or bounded wait; no blocking quiz grading |
| Error | Short human explanation with retry where useful; never display raw provider errors or keys |

Pointer and touch must use the same actions. Buttons and summaries must work with Enter/Space; links with Enter; dialogs must close with Escape and restore focus. Matching must not require dragging. Long names, sentences and translated text must wrap inside their panel; layouts must not require horizontal scrolling at 320px. Empty states must state the next available action rather than show fabricated results.

## Accessibility requirements and acceptance criteria

- At 320, 390, 768 and 1440px, the document must not overflow horizontally; touch controls must have a 44px minimum dimension.
- At 200% browser zoom, primary actions and text must remain visible and reachable.
- Active text must achieve WCAG 2.2 AA contrast: 4.5:1 normal text, 3:1 large text; focus and component boundaries must be visibly distinguishable.
- Keyboard-only users must be able to search, choose a practice style, answer, match pairs, create/edit a set and close the dialog. Focus must return to a surviving trigger after saving/deleting.
- Correct/wrong states must include words and symbols, not color alone. Matching selections must set `aria-pressed`; completed pairs must be labeled and disabled.
- Live regions must announce short status changes. Auto-playing question pronunciation must not be added. Quiz feedback sound must respect its persisted mute switch.
- `prefers-reduced-motion` must disable lifts and transitions. No essential control may exist only on hover.
- Reloads and service-worker updates must preserve favorites, study cards, selected sense, chosen voice, sets, attempts and cached audio. Cross-tab changes must stop stale sessions safely.

## Content and tone

Feature headings should use English; help and Vietnamese translations should stay in Vietnamese. Examples: **Word sets**, **Your progress**, **Matching pairs**. Helpful errors: “Cần ít nhất 3 cặp từ có nghĩa khác nhau.”, “Bộ nhớ đầy. Thay đổi chỉ giữ trong phiên này.” Avoid certification claims or guaranteed translations when providers are unavailable.

## Anti-patterns and migration notes

Implementations must not copy the reference's tiny type scale, hard-code one-off component colors, replace source definitions with AI guesses, fabricate a synonym/antonym, reset review intervals during ordinary quiz grading, or hide the next action beneath sticky UI. The extraction's density counts are observations of another interface, not a target number of controls for Helen.

This release adds `helen-learning-library-v1` alongside `helen-study-v1`; it must not overwrite or rename existing storage keys. Sets and progress currently remain on this device; database history sync does not imply cross-device study sync. The service worker must install versioned scripts/styles plus starter assets before activating a new offline shell. Cached words/audio must remain intact.

## QA checklist

- [ ] Verify light/dark tokens, contrast, focus and reduced motion.
- [ ] Verify navigation, Preferences, IME suggestions and pronunciation controls.
- [ ] Verify empty/undersized/long-content study libraries and every practice style.
- [ ] Verify matching ambiguity guards, meaning-first selection and repeated wrong attempts.
- [ ] Verify set filtering, duplicate names, deletion, favorite limits and storage errors.
- [ ] Verify immediate attempt persistence, completion totals and unchanged quiz review schedule.
- [ ] Verify reload, cross-tab changes, offline starter sets, selected-voice audio and stale translation replies.
- [ ] Record desktop/mobile screenshots and local interaction timing; distinguish simulation from real iPhone testing.


## Daily learning, backups and privacy controls

- Daily goal/streak must use the existing semantic tokens, show progress without color alone, and announce storage errors clearly. Goal changes must preserve the goal of a day already started. These controls should stay local and immediate; they must not wait for AI.
- Word of the day must use local licensed pack data. Its Explore/Save buttons must be keyboard and touch operable with visible focus and 44px targets. A failed pack load must leave the rest of Dictionary usable.
- Backup buttons must expose default, hover, focus-visible, active, disabled/busy and error feedback. JSON import must validate size/schema before confirming a merge; it must retain the newer review schedule, and storage failure must roll back the changes. Exports must exclude credentials and escape spreadsheet/HTML content.
- Analytics must default off and respect DNT/GPC. The label must describe the actual events and data sent; it must not imply that history/provider requests are anonymous. Opt-out must clear pending events and stop sending.
- On mobile Preferences must be anchored within the page width and scroll inside the available viewport. The selected sense button must meet AA contrast in both themes. Reduced-motion and existing offline/reload behavior must remain intact.

Acceptance: answer five questions → daily counter 5/5 and one-day streak → reload preserves it; restore the same JSON twice → no duplicate sets or schedule rollback; offline reload → Study and goal remain usable; opt-out → no metrics calls; at 320px Preferences and answer/next controls stay visible; automated WCAG AA checks pass in landing, Study, Preferences and dark theme.
