---
trigger: glob
globs: *.vue
---

# Vue/Nuxt Style

- **Order**: `<template>`, `<script setup>`, `<style lang="postcss">`.
- **Nuxt**: Native `useId`, `computed`, `ref` (no imports); `<NuxtLink>`.
- **Assets**: `import SvgName from "~/assets/svgs/name.svg"`
- **Safety**: Use `?.` for nested properties of possible undefined objects.
- **Classes**: `:class` as multi-line arrays; single quotes for groups; root block static.
- **BEM**: `c-` prefix; `__` element; `--` modifier.
- **CSS**: `:where(.root) { & .full-name { ... } }`. Low specificity; nested selectors.
- **Script Order**: 1. Imports, 2. Macros (Props -> Emits), 3. State (`ref`, `computed`), 4. Methods (`on` prefix for listeners).
- **General**: Tabs; single quotes; `v-if`/`v-for` first; `:key` required.
