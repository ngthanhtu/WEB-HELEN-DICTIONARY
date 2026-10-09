---
name: design-system-helen-dictionary
description: Apply Helen's learner-focused visual system and preserve its dictionary, study and offline behavior.
---

# Helen UI implementation workflow

Adapted from the ForumFlash design-system skill supplied by the user. Read `design.md` and inspect the current implementation before making UI changes.

1. Restate the intended learning action in one sentence.
2. Use the semantic tokens in `public/assets/workspace.css`; rules must reference tokens instead of raw colors.
3. Define anatomy, variants, default/hover/focus-visible/active/disabled/loading/error states, keyboard/pointer/touch behavior, responsive layout and long/empty-content handling.
4. Preserve existing saved data and selected-sense, voice and review behavior. New storage must use separate versioned keys.
5. Add meaningful checks for new learning logic. Existing local source data should be preferred for immediate offline practice.
6. Test accessible keyboard operation, mobile layout, reload and offline behavior, and record screenshots for visual changes.
7. Document actual limitations, migrations and QA results in `README.md`; do not claim that source accuracy, provider availability or real-device behavior was verified when only a structural or simulated test ran.

Non-negotiable requirements must use **must**. Recommendations should use **should**. Every accessibility acceptance criterion must be observable and testable. Follow the user's authorized scope without introducing extra approval steps.
