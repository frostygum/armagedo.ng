# Skill: Modern React & Next.js Production Builder

## Description
This skill equips the AI agent with strict rules, architectural conventions, and code-generation patterns for building scalable, high-performance web applications using React, Next.js (App Router), TypeScript, and Tailwind CSS.

## Framework Context & Architecture
You must enforce Next.js production standards. Prioritize explicit architectural boundaries and modern APIs over legacy patterns.

### 1. Component Boundaries (Server vs. Client)
* **Default to Server Components (RSC):** All components are React Server Components by default. Use them for data fetching, static layouts, and SEO-heavy sections.
* **Client Components ('use client'):** Restrict the use of `'use client'` strictly to components that require interactivity (e.g., `useState`, `useReducer`), browser-only APIs (`window`, `localStorage`), or custom React hooks.
* **Composition Rule:** Always pass Server Components as children to Client Components rather than importing Server Components directly inside Client Components.

### 2. Next.js Routing & Layouts
* **App Router Structure:** Exclusively use the `app/` directory. Leverage nested file-based routing (`layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`).
* **Route Groups:** Use parenthesis folders `(marketing)`, `(auth)`, `(dashboard)` to organize files cleanly without affecting the URL path structure.
* **Dynamic Routes:** Implement typed dynamic parameters `[id]` and catch-all routes `[[...slug]]`.

### 3. Modern Data Fetching & Caching
* **Async Server Components:** Fetch data directly inside Server Components using native `async/await`.
* **Streaming and Suspense:** Wrap heavy or slow data-loading components in React `<Suspense>` boundaries to enable progressive rendering and streaming.
* **Server Actions:** Perform mutations (POST, PUT, DELETE) using Server Actions (`'use server'`). Always handle loading states, validation errors, and success feedback gracefully on the client.
* **Cache Management:** Implement fine-grained cache revalidation using modern APIs like `revalidateTag()`, `updateTag()`, and `refresh()`. Prefer `use cache` directives for partial pre-rendering (PPR).

---

## Code Quality & Conventions

### 1. TypeScript & Typings
* Avoid `any` entirely. Enforce strict type definitions for all props, component states, and API responses.
* Explicitly type dynamic route parameters (`params: { id: string }`) and query parameters (`searchParams`).
* Utilize utility types (`ComponentPropsWithoutRef`, `Pick`, `Omit`) to ensure scalable data contracts.

### 2. Styling with Tailwind CSS
* Write utility-first classes following a logical ordering pattern (Layout -> Box Model -> Typography -> Visuals -> Interactive states).
* Rely heavily on the `clsx` and `tailwind-merge` libraries (often wrapped inside a `cn()` utility) to handle conditional class merging cleanly.

### 3. State Management & Composition
* Favor local or component-level state and React Context API for localized data sharing. 
* Use advanced compound component patterns and composition to prevent prop-drilling and boolean flag proliferation (avoid building mega-components with endless `isDisabled`, `hasBorder`, `isLarge` flags).

---

## Development & Verification Workflow

When executing tasks or generating features, you must follow this cyclical development loop:

1. **Scaffold & Structuring:** Organize new features into localized directories. Co-locate tests, styles, and secondary components alongside the primary page.
2. **Lint & Format Validation:** Before completing code generation, ensure structural integrity by running validation checks:
   ```bash
   npm run lint
   # or running prettier directly
   npx prettier --write .
   ```
3. **Build Target Check:** Ensure TypeScript compiled modules and bundle code split optimization will not fail production building:
   ```bash
   npm run build
   ```
4. **Interactive Verification:** If a dev server is available, verify route generation locally via `http://localhost:3000` before concluding the unattended loop.
