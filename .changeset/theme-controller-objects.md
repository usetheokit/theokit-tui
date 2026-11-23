---
"@theokit/tui": minor
---

`createThemeController` holds any `TheoThemeProp` (built-in name, `{ base, override }` or a plain override), not only a built-in name. Type change: `ThemeController.get()` now returns `TheoThemeProp` instead of `TheoBuiltinThemeName`, and `set()` / `initial` take `TheoThemeProp`; narrow the result if you need a name. Only names are persisted (#294).
