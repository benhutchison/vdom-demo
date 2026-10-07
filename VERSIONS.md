# VERSIONS.md — Actual tool & package versions

Generated: 2026-08-01

## System tools

| Tool | Version |
|---|---|
| Node.js | 22.20.0 |
| npm | 10.9.3 |
| Scala CLI | 1.15.0 |
| Java | 25 (LTS) |
| Elm | 0.19.2 |

## JavaScript packages

| Package | Version |
|---|---|
| react | 19.2.8 |
| react-dom | 19.2.8 |
| vite | 8.2.0 |
| @vitejs/plugin-react | 6.0.5 |
| @rolldown/plugin-babel | 0.2.3 |
| @babel/core | 8.0.1 |
| babel-plugin-react-compiler | 1.0.0 |
| solid-js | 1.9.14 |
| vite-plugin-solid | 2.11.14 |
| svelte | 5.56.8 |
| @sveltejs/vite-plugin-svelte | 7.2.0 |

## Scala / Scala.js

| Package | Version |
|---|---|
| Scala (via scala-cli) | 3.8.4 |
| Scala.js | 1.22.0 |
| com.raquo:laminar_sjs1_3 | 17.2.1 |

## Notes / deviations from spec

- **Node.js**: Spec says 24.x; actual is 22.20.0. Meets Vite 8 requirement (20.19+ or 22.12+).
- **Scala**: Spec says 3.8.3; actual is 3.8.4 (scala-cli default). Compatible.
- **@vitejs/plugin-react**: Spec says ^6 (6.0.4); actual is 6.0.5.
- **vite-plugin-solid**: Spec doesn't pin; actual is 2.11.14.
- **Laminar dependency resolution**: The spec's `//> using dep "com.raquo::laminar:17.2.1"` did not resolve to the Scala.js artifact. Used explicit artifact name `com.raquo:laminar_sjs1_3:17.2.1` instead. The `:::` syntax resolved to `_3.8.3` rather than `_sjs1_3`.
- **Svelte main.js**: The spec uses `$state()` in `main.js`, but runes require `.svelte.js` extension. Used `main.svelte.js` instead.
- **Elm Html.Lazy**: Removed unused `lazy2` import.
