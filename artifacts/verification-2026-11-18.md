# Compact training and fringe ranges — 18 November 2026

The training surface now reserves one viewport for notation, a fixed answer/resolve/next dock, and a short feedback panel. Settings and full explanations use dialogs. The score and dock retain their positions when a solution is revealed.

Range examples use the same eligible edge and presentation for both outcomes: a correct anchor is 0–2 semitones inside, an incorrect anchor 1–2 semitones outside. Other pitches remain near that edge; the correction restores an inside-edge anchor. Existing model qualifications remain in effect: bowed strings/woodwinds use the lower physical/model edge, brass the declared upper reference, and fixed mallet models either edge. No extreme outlier is used as a clue.

17 automated tests pass, including paired-seed checks across all 23 models, both outcomes, all eligible boundaries and anchor positions, clean corrections, 1,000-question generation sessions, and persistence/scoring invariants.

Live Chrome checks passed at 1366 × 768, 1000 × 620 and 390 × 844. The document scroll height equalled the viewport height at every size. On the laptop, the answer dock stayed at y=530.4 before and after resolving; on the phone, it stayed at y=605, with the resolution and action buttons inside the screen.

Checked K/F changes while Resolve has focus, Enter to resolve/advance, a valid G3 violin boundary example, an invalid F3 example two semitones below G3, the corrected fragment remaining in the same register, and opening/closing the detailed explanation dialog without moving the dock. Preview runs use the isolated `?preview=1` namespace; the normal saved student session was preserved.

[Compact desktop preview](training-compact-desktop.jpg) · [Compact phone preview](training-compact-mobile.jpg)
