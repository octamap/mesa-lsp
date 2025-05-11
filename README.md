# ⚙️ **Mesa Language Server (LSP)**

This repository contains the **Mesa Language Server**, which powers editor features like completions and semantic highlighting for [Mesa](https://github.com/octamap/mesa), the build-time HTML component engine.

> **Note:** This is not a standalone tool. It is **used by other repositories**, such as the [Mesa VS Code Extension](https://github.com/octamap/mesa-vs-code), to provide language features in editors.

---

## 🧠 What This Language Server Provides

### ✅ Component Tag Completions

Provides `<`-triggered completions for components registered in `vite.config.ts`.

### ✅ Named Target Completions

If a component includes targets like `<div #my-label>`, completions for `my-label` are shown when inside that component’s parent.

### ✅ Semantic Highlighting

Tags and slot targets are semantically highlighted using standard LSP semantic tokens — enabling themes to apply consistent styling across editors.

---

## 🏗️ Used In

This language server is **consumed by editor extensions**, for example:

* [Mesa VS Code Extension](https://github.com/octamap/mesa-vs-code)

It is not intended to be installed or run directly by end-users.

## 📁 Project Structure

* `src/` – core language server logic
* `middleware/` – Mesa-specific helpers for parsing component and slot definitions
* `server.ts` – LSP server entry point (Node/stdio)
* `types/` – shared types

---

## 🔍 Related Projects

* [Mesa](https://github.com/octamap/mesa) – the HTML component engine
* [Mesa VS Code Extension](https://github.com/octamap/mesa-vs-code) – editor integration using this LSP
