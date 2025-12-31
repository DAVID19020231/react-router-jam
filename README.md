# react-router-jam

A file-system/folder-based routing library for [React Router](https://reactrouter.com) v7 / [Remix](https://remix.run). Supports TypeScript (`.tsx`, `.ts`) and JavaScript (`.jsx`, `.js`).

## Installation

```bash
bun install react-router-jam
```

## Usage

In your `app/routes.ts`:

```typescript
import { type RouteConfig } from "@react-router/dev/routes";
import { jamRoutes } from "react-router-jam";

export default jamRoutes({
  ignoredFilePatterns: [], // Optional, files matching will be ignored
}) satisfies RouteConfig;
```

## Configuration

`jamRoutes` accepts an options object:

- `rootDirectory` (string): The root directory of your application. Defaults to `"./app"`.
- `ignoredFilePatterns` (string[]): Patterns to ignore (e.g., `["**/__tests__/**", "**/*.test.tsx"]`). Uses [minimatch](https://github.com/isaacs/minimatch) for glob pattern matching.

## Routing Conventions

`react-router-jam` defines routes based on your file system structure in the `routes` directory.

### Core Concepts

| Feature | Convention | Example | URL |
| :--- | :--- | :--- | :--- |
| **Index Route** | `page.tsx` | `routes/page.tsx` | `/` |
| **Nested Route** | Folder + `page.tsx` | `routes/about/page.tsx` | `/about` |
| **Dynamic Segment** | `[param]` | `routes/users/[id]/page.tsx` | `/users/123` |
| **Splat Route** | `[...param]` | `routes/files/[...path]/page.tsx` | `/files/a/b/c` |
| **Layout Route** | `layout.tsx` | `routes/layout.tsx` | *(wraps child routes)* |
| **Route Group** | `_folder` | `routes/_auth/login/page.tsx` | `/login` |
| **Not Found** | `not-found.tsx` | `routes/settings/not-found.tsx` | *(matches unknown paths)* |

### Detailed Examples

#### Nested Routes & Layouts

Layouts wrap all nested pages and child layouts within their directory.

```
app/
├── routes/
│   ├── layout.tsx          # Root Layout
│   ├── page.tsx            # /
│   ├── about/
│   │   └── page.tsx        # /about
│   └── dashboard/
│       ├── layout.tsx      # Dashboard Layout (wraps dashboard/ pages)
│       ├── page.tsx        # /dashboard
│       └── settings/
│           └── page.tsx    # /dashboard/settings
```

> [!NOTE]
> You don't need to create a `layout.tsx` just to nest routes. If a directory has no layout, `react-router-jam` automatically creates a "pass-through" layout for you.

#### Dynamic Routes

Use square brackets `[]` for dynamic path segments.

```
app/
├── routes/
│   ├── blog/
│   │   ├── [slug]/
│   │   │   └── page.tsx    # /blog/hello-world
│   │   └── page.tsx        # /blog
```

#### Route Groups (Groups without Path)

Folders starting with `_` are treated as "Route Groups". They allow you to organize files without affecting the URL path.

```ascii
app/
├── routes/
│   ├── _marketing/         # 🚫 No "/marketing" in URL
│   │   ├── layout.tsx      # Shared layout for marketing pages
│   │   ├── about/
│   │   │   └── page.tsx    # -> /about
│   │   └── contact/
│   │       └── page.tsx    # -> /contact
│   └── _app/               # 🚫 No "/app" in URL
│       ├── layout.tsx      # App-specific layout
│       └── dashboard/
│           └── page.tsx    # -> /dashboard
```

> [!TIP]
> You can add a `layout.tsx` inside a Route Group to share UI (like navigation or sidebars) across multiple routes without affecting the URL structure.

#### Splat Routes (Catch-all)

Use `[...param]` to capture multiple URL segments.

```
app/
├── routes/
│   ├── docs/
│   │   ├── [...slug]/
│   │   │   └── page.tsx    # matches /docs/getting-started, /docs/api/v1/auth
```

#### Not Found Routes

Use `not-found.tsx` to handle 404s or unknown paths within a specific directory scope.

```
app/
├── routes/
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── not-found.tsx   # Handles 404s under /dashboard/*
│   └── not-found.tsx       # Global 404
```

#### Automatic Colocation

Files that don't match the conventions (`page`, `layout`, `not-found`) are automatically ignored. You can safely co-locate components, styles, and tests inside your route directories.

```
app/
├── routes/
│   ├── dashboard/
│   │   ├── components/         # ⚠️ Directories are traversed by default! Add to ignoredFilePatterns.
│   │   │   └── Chart.tsx
│   │   ├── styles.css          # ✅ Ignored (file doesn't match convention)
│   │   ├── utils.ts            # ✅ Ignored
│   │   └── page.tsx
```

#### Ignored Files

Directories are traversed by default. To safely co-locate directories (like `components` or `hooks`), add them to `ignoredFilePatterns`.

```typescript
// react-router.config.ts
jamRoutes({
  ignoredFilePatterns: ["**/components/**", "**/*.test.tsx"],
})
```

## Route Matching Priority

Routes are matched in the following order of specificity:

1.  **Static Routes**: `routes/about/page.tsx` (matches `/about`)
2.  **Dynamic Segments**: `routes/[slug]/page.tsx` (matches `/anything`)
3.  **Splat/Catch-all Routes**: `routes/[...rest]/page.tsx` (matches `/anything/else`)

Sibling routes are sorted so that specific static paths always take precedence over dynamic parameters. This allows you to co-locate static and dynamic routes within the same directory.

## Comparisons

| Feature | `react-router/fs-routes` (v7) | `react-router-jam` |
| :--- | :--- | :--- |
| **File Structure** | Flat Files (`about.tsx`) | Folder-based (`about/page.tsx`) |
| **Route Definition** | `route.tsx` | `page.tsx` |
| **Layout Definition** | `layout.tsx` | `layout.tsx` |
| **Route Groups** | `(group)` | `_group` |
| **Colocation** | ❌ (defaults to route config) | ✅ (via ignored patterns) |

## Development

To install dependencies:

```bash
bun install
```

## Testing

To run the test suite:

```bash
bun test
```

This project was created using `bun init` in bun v1.3.4. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
