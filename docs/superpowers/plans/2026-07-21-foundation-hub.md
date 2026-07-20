# Foundation and Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (<code>- [ ]</code>) syntax for tracking.

**Goal:** Build the independently deployable OpenTrade foundation: a strict Vite/React/TypeScript application, deterministic shared services, accessible shared UI and settings, lazy hash-routed game contracts, a polished responsive hub, automated browser coverage, and GitHub Pages delivery.

**Architecture:** The application is a static React shell using <code>HashRouter</code>, with one lightweight registry entry per game and dynamic imports for route modules. Pure shared services own randomness and versioned browser persistence; React contexts adapt settings, audio, and toast behavior without coupling any game to another. The hub consumes route metadata and a small persisted progress summary while game mechanics remain outside this subsystem.

**Tech Stack:** Node 24, npm, Vite, React, TypeScript strict mode, React Router hash routing, ESLint, Vitest, Vitest Browser Mode with Playwright, and Playwright end-to-end tests.

## Global Constraints

- Use Node 24 and npm, and commit the generated <code>package-lock.json</code>.
- Use Vite, React, TypeScript strict mode, React Router hash routing, Vitest, Playwright, and ESLint.
- Set the production Vite base to exactly <code>/Open-Trade/</code> for GitHub Pages.
- Do not add Phaser, game mechanics, a service worker, PWA installation, Higgsfield packaging, or generated media in this plan.
- Games may import shared services and route contracts but may not import one another.
- Store only game state, settings, ruleset version, seed, and timestamp in localStorage; never store identity, brokerage, payment, or sensitive financial data.
- Every local save is versioned. Corrupt or incompatible data must yield a recoverable reset state rather than crash application startup.
- Audio playback failures degrade silently to muted play.
- Every route provides retry and return-to-hub recovery.
- Every DOM action is keyboard reachable with visible focus; dialogs trap focus, close on Escape, and return focus.
- Color never carries meaning alone, meaningful updates use restrained live regions, and touch targets are at least 44 CSS pixels.
- Verify responsive behavior at 320, 375, 768, 1024, and 1440 CSS pixels.
- Shared controls expose sound and reduced-motion settings. The exact disclaimer is <code>Simulated game — not investment advice</code>.
- All readable interface text is HTML/CSS text, never embedded in an image.

## Scope Boundaries

This plan produces a working hub with deliberately simple route-boundary screens for FanStocks, Founder Mode, and Wallstreet Surfers. Each later game plan replaces only its route entry component and progress producer. Offline installation and asset generation begin only after the three core routes are stable, as required by the approved design.

## File Structure

The implementation creates or modifies these files:

- <code>package.json</code>, <code>package-lock.json</code>, <code>.nvmrc</code>, <code>.editorconfig</code>, and <code>.gitignore</code>: reproducible Node/npm project metadata.
- <code>vite.config.ts</code>, <code>tsconfig*.json</code>, and <code>eslint.config.js</code>: strict build and lint configuration.
- <code>vitest.config.ts</code> and <code>vitest.browser.config.ts</code>: separate pure-unit and real-browser component projects.
- <code>src/shared/rng/seededRng.ts</code>: the deterministic RNG contract consumed by every game.
- <code>src/shared/routing/challenge.ts</code>: stable challenge query parsing, formatting, and guest seed creation.
- <code>src/shared/persistence/gameStore.ts</code>: versioned localStorage envelopes, codec validation, migrations, recovery results, and safe clearing.
- <code>src/shared/settings/SettingsContext.tsx</code>: persisted <code>muted</code> and <code>reducedMotion</code> state with the exact hook contract used by games.
- <code>src/shared/audio/AudioContext.tsx</code>: failure-tolerant audio playback governed by shared settings.
- <code>src/shared/ui/</code>: Button, Dialog, ProgressBar, and toast primitives plus design-system CSS.
- <code>src/app/routes/types.ts</code>: exact <code>GameRouteModule</code> and <code>GameProgressBadge</code> contracts.
- <code>src/app/routes/</code>: route metadata, lazy registry, focus management, route boundaries, and hash router.
- <code>src/app/hub/</code>: hub progress summary, responsive cards, how-to/reset dialogs, and the hub page.
- <code>src/games/*/route.tsx</code>: isolated foundation route modules that later vertical slices replace.
- <code>tests/e2e/hub.spec.ts</code> and <code>playwright.config.ts</code>: production-build navigation, responsive, persistence, and accessibility smoke coverage.
- <code>.github/workflows/ci.yml</code> and <code>.github/workflows/pages.yml</code>: quality gates and the single Pages deployment workflow later hardened by the release plan.

---

### Task 1: Bootstrap the strict Vite, React, lint, unit, and browser-test foundation

**Files:**

- Create: <code>package.json</code>
- Create: <code>package-lock.json</code>
- Create: <code>.nvmrc</code>
- Create: <code>.editorconfig</code>
- Create: <code>.gitignore</code>
- Create: <code>index.html</code>
- Create: <code>vite.config.ts</code>
- Create: <code>vitest.config.ts</code>
- Create: <code>vitest.browser.config.ts</code>
- Create: <code>tsconfig.json</code>
- Create: <code>tsconfig.app.json</code>
- Create: <code>tsconfig.node.json</code>
- Create: <code>eslint.config.js</code>
- Create: <code>src/vite-env.d.ts</code>
- Create: <code>src/test/setup.ts</code>
- Create: <code>src/app/appMeta.unit.test.ts</code>
- Create: <code>src/app/App.browser.test.tsx</code>
- Create: <code>src/app/appMeta.ts</code>
- Create: <code>src/app/App.tsx</code>
- Create: <code>src/main.tsx</code>

**Interfaces:**

- Produces: <code>APP_NAME: "OpenTrade"</code> and <code>APP_DISCLAIMER: "Simulated game — not investment advice"</code>.
- Produces: npm scripts <code>dev</code>, <code>build</code>, <code>preview</code>, <code>lint</code>, <code>typecheck</code>, <code>test:unit</code>, <code>test:browser</code>, <code>test:e2e</code>, and <code>check</code>.
- Produces: a Chromium-backed Vitest Browser project capable of rendering React components.

- [ ] **Step 1: Initialize npm and install only the foundation dependencies**

Run from the repository root:

~~~powershell
npm init -y
npm install react react-dom react-router-dom
npm install --save-dev vite @vitejs/plugin-react typescript @types/node @types/react @types/react-dom eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals vitest @vitest/browser-playwright vitest-browser-react @playwright/test jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm pkg set name=open-trade
npm pkg set private=true --json
npm pkg set type=module
npm pkg set engines.node=">=24 <25"
npm pkg set scripts.dev="vite"
npm pkg set scripts.build="vite build"
npm pkg set scripts.preview="vite preview"
npm pkg set scripts.lint="eslint . --max-warnings=0"
npm pkg set scripts.typecheck="tsc -b"
npm pkg set scripts.test:unit="vitest run --config vitest.config.ts"
npm pkg set scripts.test:browser="vitest run --config vitest.browser.config.ts"
npm pkg set scripts.test:e2e="playwright test"
npm pkg set scripts.test="vitest run --config vitest.config.ts"
npm pkg set scripts.check="npm run lint && npm run typecheck && npm test && npm run test:browser && npm run build"
npx playwright install chromium
~~~

Expected: npm creates <code>package.json</code> and <code>package-lock.json</code>, every install exits 0, and Chromium installation ends without an error.

- [ ] **Step 2: Add the exact project, TypeScript, Vite, Vitest, and ESLint configuration**

Create <code>.nvmrc</code>:

~~~text
24
~~~

Create <code>.editorconfig</code>:

~~~ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
~~~

Create <code>.gitignore</code>:

~~~gitignore
node_modules/
dist/
coverage/
playwright-report/
test-results/
.vite/
*.local
~~~

Create <code>index.html</code>:

~~~html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="OpenTrade is a collection of deterministic simulated finance games."
    />
    <meta name="theme-color" content="#171512" />
    <title>OpenTrade</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
~~~

Create <code>vite.config.ts</code>:

~~~ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/Open-Trade/',
  plugins: [react()],
  build: {
    sourcemap: true,
  },
})
~~~

Create <code>vitest.config.ts</code>:

~~~ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.browser.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
~~~

Create <code>src/test/setup.ts</code>:

~~~ts
import '@testing-library/jest-dom/vitest'
~~~

Create <code>vitest.browser.config.ts</code>:

~~~ts
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.browser.test.tsx'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
~~~

Create <code>tsconfig.json</code>:

~~~json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
~~~

Create <code>tsconfig.app.json</code>:

~~~json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
~~~

Create <code>tsconfig.node.json</code>:

~~~json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "strict": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": [
    "vite.config.ts",
    "vitest.config.ts",
    "vitest.browser.config.ts",
    "playwright.config.ts"
  ]
}
~~~

Create <code>eslint.config.js</code>:

~~~js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'playwright-report', 'test-results'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)
~~~

Create <code>src/vite-env.d.ts</code>:

~~~ts
/// <reference types="vite/client" />
~~~

- [ ] **Step 3: Write unit and browser tests before creating the app modules**

Create <code>src/app/appMeta.unit.test.ts</code>:

~~~ts
import { describe, expect, it } from 'vitest'
import { APP_DISCLAIMER, APP_NAME } from './appMeta'

describe('app metadata', () => {
  it('uses the approved product name and disclaimer', () => {
    expect(APP_NAME).toBe('OpenTrade')
    expect(APP_DISCLAIMER).toBe('Simulated game — not investment advice')
  })
})
~~~

Create <code>src/app/App.browser.test.tsx</code>:

~~~tsx
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from './App'

test('renders the product heading and disclaimer', async () => {
  const screen = await render(<App />)

  await expect.element(
    screen.getByRole('heading', { name: 'OpenTrade', level: 1 }),
  ).toBeVisible()
  await expect.element(
    screen.getByText('Simulated game — not investment advice'),
  ).toBeVisible()
})
~~~

- [ ] **Step 4: Run both tests and verify the missing modules produce the intended red state**

Run:

~~~powershell
npm run test:unit
npm run test:browser
~~~

Expected: the unit run fails because <code>src/app/appMeta.ts</code> cannot be resolved, and the browser run fails because <code>src/app/App.tsx</code> cannot be resolved.

- [ ] **Step 5: Add the minimum application code that satisfies both tests**

Create <code>src/app/appMeta.ts</code>:

~~~ts
export const APP_NAME = 'OpenTrade'
export const APP_DISCLAIMER = 'Simulated game — not investment advice'
~~~

Create <code>src/app/App.tsx</code>:

~~~tsx
import { APP_DISCLAIMER, APP_NAME } from './appMeta'

export function App() {
  return (
    <main id="main-content">
      <h1>{APP_NAME}</h1>
      <p>{APP_DISCLAIMER}</p>
    </main>
  )
}
~~~

Create <code>src/main.tsx</code>:

~~~tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('OpenTrade root element was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
~~~

- [ ] **Step 6: Run every local foundation gate**

Run:

~~~powershell
npm run test:unit
npm run test:browser
npm run lint
npm run typecheck
npm run build
~~~

Expected: both test files pass, ESLint reports zero warnings, TypeScript exits 0, and Vite writes <code>dist/index.html</code> with assets under <code>dist/assets/</code>.

- [ ] **Step 7: Commit the independently deployable bootstrap**

~~~powershell
git add package.json package-lock.json .nvmrc .editorconfig .gitignore index.html vite.config.ts vitest.config.ts vitest.browser.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js src/vite-env.d.ts src/app/appMeta.unit.test.ts src/app/App.browser.test.tsx src/app/appMeta.ts src/app/App.tsx src/main.tsx
git commit -m "chore: bootstrap React foundation and test harness"
~~~

### Task 2: Add design tokens and accessible shared UI contracts

**Files:**

- Create: <code>src/styles/tokens.css</code>
- Create: <code>src/styles/global.css</code>
- Create: <code>src/shared/ui/Button.tsx</code>
- Create: <code>src/shared/ui/Dialog.tsx</code>
- Create: <code>src/shared/ui/ProgressBar.tsx</code>
- Create: <code>src/shared/ui/ToastContext.tsx</code>
- Create: <code>src/shared/ui/ui.css</code>
- Create: <code>src/shared/ui/index.ts</code>
- Create: <code>src/shared/ui/ui.browser.test.tsx</code>
- Modify: <code>src/main.tsx</code>

**Interfaces:**

- Produces: <code>Button</code> with <code>primary | secondary | ghost | danger</code> variants.
- Produces: <code>Dialog</code> with native modal focus containment, Escape close, backdrop close, and focus restoration.
- Produces: <code>ProgressBar</code> with explicit label, value, and maximum semantics.
- Produces: <code>ToastProvider</code> and exact <code>useToasts(): { addToast(message, tone?): void }</code>.
- Produces: CSS tokens for warm ivory, off-black, market yellow, signal red, gain green, focus, spacing, radius, shadows, and motion.

- [ ] **Step 1: Write browser tests for the public UI API**

Create <code>src/shared/ui/ui.browser.test.tsx</code>:

~~~tsx
import { useState } from 'react'
import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
  Button,
  Dialog,
  ProgressBar,
  ToastProvider,
  useToasts,
} from './index'

function DialogHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Explain this game</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="How it works"
        description="Read the rules before playing."
      >
        <p>Make deliberate choices and compare the result.</p>
      </Dialog>
    </>
  )
}

function ToastHarness() {
  const { addToast } = useToasts()

  return (
    <Button onClick={() => addToast('Progress reset', 'success')}>
      Reset progress
    </Button>
  )
}

test('dialog closes on Escape and returns focus to its trigger', async () => {
  const screen = await render(<DialogHarness />)
  const trigger = screen.getByRole('button', { name: 'Explain this game' })

  await trigger.click()
  await expect.element(
    screen.getByRole('dialog', { name: 'How it works' }),
  ).toBeVisible()

  await userEvent.keyboard('{Escape}')
  await expect.element(
    screen.getByRole('dialog', { name: 'How it works' }),
  ).not.toBeVisible()
  await expect.element(trigger).toHaveFocus()
})

test('progress bar exposes a text label and numeric state', async () => {
  const screen = await render(
    <ProgressBar label="Draft progress" value={2} max={3} />,
  )

  await expect.element(
    screen.getByRole('progressbar', { name: 'Draft progress' }),
  ).toHaveAttribute('aria-valuenow', '2')
})

test('toast announcements are visible in a polite live region', async () => {
  const screen = await render(
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>,
  )

  await screen.getByRole('button', { name: 'Reset progress' }).click()
  await expect.element(screen.getByText('Progress reset')).toBeVisible()
  await expect.element(screen.getByRole('status')).toHaveAttribute(
    'aria-live',
    'polite',
  )
})
~~~

- [ ] **Step 2: Run the UI browser test and confirm it is red**

Run:

~~~powershell
npm run test:browser -- src/shared/ui/ui.browser.test.tsx
~~~

Expected: FAIL because <code>src/shared/ui/index.ts</code> does not exist.

- [ ] **Step 3: Create the design tokens and global page rules**

Create <code>src/styles/tokens.css</code>:

~~~css
:root {
  color-scheme: light;
  --color-ink: #171512;
  --color-ink-muted: #5d574e;
  --color-ivory: #f7f0e3;
  --color-paper: #fffaf0;
  --color-line: #cfc3b2;
  --color-market-yellow: #f4c542;
  --color-signal-red: #d84a3a;
  --color-gain-green: #2f8f60;
  --color-focus: #2457d6;
  --font-display: Georgia, 'Times New Roman', serif;
  --font-body: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --radius-sm: 0.5rem;
  --radius-md: 1rem;
  --radius-lg: 1.5rem;
  --shadow-card: 0 1rem 2.5rem rgb(23 21 18 / 0.12);
  --duration-fast: 140ms;
  --duration-standard: 220ms;
}
~~~

Create <code>src/styles/global.css</code>:

~~~css
@import './tokens.css';

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  min-height: 100%;
  background: var(--color-ivory);
  color: var(--color-ink);
  font-family: var(--font-body);
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  background:
    radial-gradient(circle at 10% 0%, rgb(244 197 66 / 0.2), transparent 28rem),
    var(--color-ivory);
}

button,
input,
select,
textarea {
  font: inherit;
}

button,
a {
  -webkit-tap-highlight-color: transparent;
}

:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 3px;
}

a {
  color: inherit;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

img,
svg,
canvas {
  display: block;
  max-width: 100%;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

html[data-reduced-motion='true'] *,
html[data-reduced-motion='true'] *::before,
html[data-reduced-motion='true'] *::after {
  scroll-behavior: auto !important;
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
~~~

- [ ] **Step 4: Implement Button, Dialog, ProgressBar, and toast primitives**

Create <code>src/shared/ui/Button.tsx</code>:

~~~tsx
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  children,
  ...props
}: PropsWithChildren<ButtonProps>) {
  const classes = ['ui-button', 'ui-button--' + variant, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  )
}
~~~

Create <code>src/shared/ui/Dialog.tsx</code>:

~~~tsx
import {
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useRef,
} from 'react'
import { Button } from './Button'

export interface DialogProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  actions?: ReactNode
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  actions,
  children,
}: PropsWithChildren<DialogProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = 'dialog-title-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const descriptionId = titleId + '-description'

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) {
      return
    }

    if (open && !dialog.open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      dialog.showModal()
      const firstControl = dialog.querySelector<HTMLElement>(
        '[data-autofocus], button, [href], input, select, textarea',
      )
      firstControl?.focus()
    }

    if (!open && dialog.open) {
      dialog.close()
      previousFocusRef.current?.focus()
    }

    return () => {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="ui-dialog"
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="ui-dialog__surface">
        <div className="ui-dialog__heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description === undefined ? null : (
              <p id={descriptionId}>{description}</p>
            )}
          </div>
          <Button
            variant="secondary"
            aria-label={'Close ' + title}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
        <div className="ui-dialog__body">{children}</div>
        {actions === undefined ? null : (
          <div className="ui-dialog__actions">{actions}</div>
        )}
      </div>
    </dialog>
  )
}
~~~

Create <code>src/shared/ui/ProgressBar.tsx</code>:

~~~tsx
export interface ProgressBarProps {
  label: string
  value: number
  max: number
}

export function ProgressBar({ label, value, max }: ProgressBarProps) {
  const boundedMax = Math.max(1, max)
  const boundedValue = Math.min(Math.max(0, value), boundedMax)
  const width = String((boundedValue / boundedMax) * 100) + '%'

  return (
    <div className="ui-progress">
      <div className="ui-progress__labels">
        <span>{label}</span>
        <span>
          {boundedValue} / {boundedMax}
        </span>
      </div>
      <div
        className="ui-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={boundedMax}
        aria-valuenow={boundedValue}
      >
        <span className="ui-progress__value" style={{ width }} />
      </div>
    </div>
  )
}
~~~

Create <code>src/shared/ui/ToastContext.tsx</code>:

~~~tsx
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export type ToastTone = 'info' | 'success' | 'warning'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  addToast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextIdRef = useRef(1)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  const addToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextIdRef.current
    nextIdRef.current += 1
    setToasts((current) => [...current, { id, message, tone }])
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4000)
    timersRef.current.push(timer)
  }, [])

  const value = useMemo(() => ({ addToast }), [addToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            className={'ui-toast ui-toast--' + toast.tone}
            key={toast.id}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToasts(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === null) {
    throw new Error('useToasts must be used within ToastProvider')
  }
  return context
}
~~~

Create <code>src/shared/ui/index.ts</code>:

~~~ts
export { Button, type ButtonProps } from './Button'
export { Dialog, type DialogProps } from './Dialog'
export { ProgressBar, type ProgressBarProps } from './ProgressBar'
export {
  ToastProvider,
  type ToastTone,
  useToasts,
} from './ToastContext'
~~~

Create <code>src/shared/ui/ui.css</code>:

~~~css
.ui-button {
  min-height: 44px;
  padding: 0.75rem 1rem;
  border: 2px solid var(--color-ink);
  border-radius: var(--radius-sm);
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  transition:
    transform var(--duration-fast) ease,
    box-shadow var(--duration-fast) ease;
}

.ui-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 0.35rem 0 var(--color-ink);
}

.ui-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ui-button--primary {
  background: var(--color-market-yellow);
  color: var(--color-ink);
}

.ui-button--secondary {
  background: var(--color-paper);
  color: var(--color-ink);
}

.ui-button--ghost {
  border-color: transparent;
  background: transparent;
  color: var(--color-ink);
  box-shadow: none;
}

.ui-button--danger {
  background: var(--color-signal-red);
  color: #fff;
}

.ui-dialog {
  width: min(92vw, 38rem);
  max-height: min(85vh, 44rem);
  padding: 0;
  border: 2px solid var(--color-ink);
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--color-ink);
  box-shadow: var(--shadow-card);
}

.ui-dialog::backdrop {
  background: rgb(23 21 18 / 0.68);
  backdrop-filter: blur(4px);
}

.ui-dialog__surface {
  padding: var(--space-5);
  overflow: auto;
  background: var(--color-paper);
}

.ui-dialog__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.ui-dialog__heading h2 {
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 5vw, 2.4rem);
}

.ui-dialog__body {
  margin-top: var(--space-4);
}

.ui-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.ui-progress__labels {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-2);
  font-size: 0.875rem;
  font-weight: 800;
}

.ui-progress__track {
  height: 0.75rem;
  overflow: hidden;
  border: 1px solid var(--color-ink);
  border-radius: 999px;
  background: var(--color-paper);
}

.ui-progress__value {
  display: block;
  height: 100%;
  background: var(--color-gain-green);
  transition: width var(--duration-standard) ease;
}

.ui-toasts {
  position: fixed;
  z-index: 50;
  right: var(--space-4);
  bottom: var(--space-4);
  display: grid;
  width: min(24rem, calc(100vw - 2rem));
  gap: var(--space-2);
  pointer-events: none;
}

.ui-toast {
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--color-ink);
  border-radius: var(--radius-sm);
  background: var(--color-paper);
  box-shadow: var(--shadow-card);
  font-weight: 750;
}

.ui-toast--success {
  border-left: 0.75rem solid var(--color-gain-green);
}

.ui-toast--warning {
  border-left: 0.75rem solid var(--color-signal-red);
}
~~~

Modify <code>src/main.tsx</code> so the two style sheets are imported before application code:

~~~tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/global.css'
import './shared/ui/ui.css'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('OpenTrade root element was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
~~~

- [ ] **Step 5: Run the UI test and all existing gates**

Run:

~~~powershell
npm run test:browser -- src/shared/ui/ui.browser.test.tsx
npm run test:unit
npm run lint
npm run typecheck
npm run build
~~~

Expected: all three UI tests pass, the bootstrap unit test passes, lint and typecheck exit 0, and the production build completes.

- [ ] **Step 6: Commit the shared visual and interaction layer**

~~~powershell
git add src/styles src/shared/ui src/main.tsx
git commit -m "feat: add accessible shared UI system"
~~~

### Task 3: Add deterministic RNG and stable challenge URL contracts

**Files:**

- Create: <code>src/shared/rng/seededRng.ts</code>
- Create: <code>src/shared/rng/seededRng.unit.test.ts</code>
- Create: <code>src/shared/routing/challenge.ts</code>
- Create: <code>src/shared/routing/challenge.unit.test.ts</code>

**Interfaces:**

- Produces exactly: <code>SeededRng { seed; next(); int(); pick(); shuffle(); fork() }</code> and <code>createSeededRng</code> from <code>src/shared/rng/seededRng.ts</code>.
- <code>int(minInclusive, maxExclusive)</code> includes the lower bound and excludes the upper bound.
- <code>pick</code> throws for an empty collection; <code>shuffle</code> returns a new array and never mutates the input.
- Produces exactly: <code>ChallengeDescriptor</code>, <code>parseChallenge</code>, <code>formatChallenge</code>, and <code>createGuestSeed</code> from <code>src/shared/routing/challenge.ts</code>.
- <code>ChallengeDescriptor</code> is exactly <code>{ seed: string; rulesetVersion: number }</code>.
- <code>createGuestSeed(): string</code> uses browser cryptography and returns a URL-safe seed.
- Challenge query strings use only <code>seed</code> and <code>rules</code>; seeds are 1–64 URL-safe characters and ruleset versions are positive integers.

- [ ] **Step 1: Write deterministic RNG tests**

Create <code>src/shared/rng/seededRng.unit.test.ts</code>:

~~~ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeededRng } from './seededRng'

describe('createSeededRng', () => {
  it('matches the approved Mulberry32 sequence', () => {
    const rng = createSeededRng(123456789)

    expect([rng.next(), rng.next(), rng.next()]).toEqual([
      0.2577907438389957,
      0.9707721115555614,
      0.7853280142880976,
    ])
  })

  it('normalizes string seeds deterministically', () => {
    expect(createSeededRng('guest-league').seed).toBe(
      createSeededRng('guest-league').seed,
    )
    expect(createSeededRng('guest-league').seed).not.toBe(
      createSeededRng('other-league').seed,
    )
  })

  it('keeps integer results inside a half-open range', () => {
    const rng = createSeededRng(42)
    const values = Array.from({ length: 200 }, () => rng.int(2, 5))

    expect(values.every((value) => value >= 2 && value < 5)).toBe(true)
    expect(new Set(values)).toEqual(new Set([2, 3, 4]))
  })

  it('picks and shuffles without mutating source content', () => {
    const rng = createSeededRng(9)
    const source = ['A', 'B', 'C', 'D'] as const
    const shuffled = rng.shuffle(source)

    expect(source).toEqual(['A', 'B', 'C', 'D'])
    expect([...shuffled].sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(source).toContain(rng.pick(source))
  })

  it('rejects invalid ranges and empty picks', () => {
    const rng = createSeededRng(1)

    expect(() => rng.int(4, 4)).toThrow('maxExclusive must be greater')
    expect(() => rng.pick([])).toThrow('Cannot pick from an empty list')
  })

  it('forks stable independent streams from a label', () => {
    const rng = createSeededRng(77)

    expect(rng.fork('prices').seed).toBe(rng.fork('prices').seed)
    expect(rng.fork('prices').seed).not.toBe(rng.fork('trades').seed)
  })
})
~~~

- [ ] **Step 2: Write challenge parsing and formatting tests**

Create <code>src/shared/routing/challenge.unit.test.ts</code>:

~~~ts
import { describe, expect, it } from 'vitest'
import {
  createGuestSeed,
  formatChallenge,
  parseChallenge,
} from './challenge'

describe('challenge descriptors', () => {
  it('round-trips a seed and ruleset in stable key order', () => {
    const descriptor = { seed: 'guest-314159', rulesetVersion: 1 }

    expect(formatChallenge(descriptor)).toBe(
      '?seed=guest-314159&rules=1',
    )
    expect(parseChallenge(formatChallenge(descriptor))).toEqual(descriptor)
  })

  it('rejects missing, unsafe, fractional, and non-positive values', () => {
    expect(parseChallenge('?rules=1')).toBeNull()
    expect(parseChallenge('?seed=contains%20spaces&rules=1')).toBeNull()
    expect(parseChallenge('?seed=guest&rules=1.5')).toBeNull()
    expect(parseChallenge('?seed=guest&rules=0')).toBeNull()
  })

  it('creates a guest seed from browser cryptography', () => {
    vi.stubGlobal('crypto', {
      getRandomValues(buffer: Uint32Array) {
        buffer[0] = 987654321
        buffer[1] = 123456789
        return buffer
      },
    })

    expect(createGuestSeed()).toBe('0gc0uy9021i3v9')
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
~~~

- [ ] **Step 3: Run the unit tests and confirm both modules are missing**

Run:

~~~powershell
npm run test:unit -- src/shared/rng/seededRng.unit.test.ts src/shared/routing/challenge.unit.test.ts
~~~

Expected: FAIL with unresolved imports for <code>./seededRng</code> and <code>./challenge</code>.

- [ ] **Step 4: Implement the RNG contract**

Create <code>src/shared/rng/seededRng.ts</code>:

~~~ts
const UINT32_RANGE = 4_294_967_296

export interface SeededRng {
  readonly seed: number
  next(): number
  int(minInclusive: number, maxExclusive: number): number
  pick<T>(values: readonly T[]): T
  shuffle<T>(values: readonly T[]): T[]
  fork(label: string): SeededRng
}

function hashString(value: string): number {
  let hash = 2_166_136_261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }

  return hash >>> 0
}

function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'string') {
    return hashString(seed)
  }

  if (!Number.isFinite(seed)) {
    throw new RangeError('Seed must be a finite number or string')
  }

  return Math.trunc(seed) >>> 0
}

export function createSeededRng(seedInput: number | string): SeededRng {
  const seed = normalizeSeed(seedInput)
  let state = seed

  const api: SeededRng = {
    seed,
    next() {
      state = (state + 0x6d2b79f5) | 0
      let value = state
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE
    },
    int(minInclusive, maxExclusive) {
      if (!Number.isSafeInteger(minInclusive)) {
        throw new RangeError('minInclusive must be a safe integer')
      }
      if (!Number.isSafeInteger(maxExclusive)) {
        throw new RangeError('maxExclusive must be a safe integer')
      }
      if (maxExclusive <= minInclusive) {
        throw new RangeError(
          'maxExclusive must be greater than minInclusive',
        )
      }
      return (
        minInclusive +
        Math.floor(api.next() * (maxExclusive - minInclusive))
      )
    },
    pick<T>(values: readonly T[]) {
      if (values.length === 0) {
        throw new RangeError('Cannot pick from an empty list')
      }
      const selected = values[api.int(0, values.length)]
      if (selected === undefined) {
        throw new RangeError('Selected index was outside the list')
      }
      return selected
    },
    shuffle<T>(values: readonly T[]) {
      const shuffled = [...values]
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = api.int(0, index + 1)
        const current = shuffled[index]
        const replacement = shuffled[swapIndex]
        if (current === undefined || replacement === undefined) {
          throw new RangeError('Shuffle index was outside the list')
        }
        shuffled[index] = replacement
        shuffled[swapIndex] = current
      }
      return shuffled
    },
    fork(label) {
      return createSeededRng(hashString(String(seed) + ':' + label))
    },
  }

  return api
}
~~~

- [ ] **Step 5: Implement the challenge contract**

Create <code>src/shared/routing/challenge.ts</code>:

~~~ts
const SEED_PATTERN = /^[a-z0-9_-]{1,64}$/i

export interface ChallengeDescriptor {
  readonly seed: string
  readonly rulesetVersion: number
}

export function parseChallenge(
  input: string | URLSearchParams,
): ChallengeDescriptor | null {
  const params =
    typeof input === 'string'
      ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
      : input
  const rawSeed = params.get('seed')
  const rawRuleset = params.get('rules')

  if (rawSeed === null || rawRuleset === null) {
    return null
  }

  const rulesetVersion = Number(rawRuleset)
  if (
    !SEED_PATTERN.test(rawSeed) ||
    !Number.isSafeInteger(rulesetVersion) ||
    rulesetVersion < 1
  ) {
    return null
  }

  return { seed: rawSeed, rulesetVersion }
}

export function formatChallenge(descriptor: ChallengeDescriptor): string {
  const parsed = parseChallenge(
    new URLSearchParams({
      seed: descriptor.seed,
      rules: String(descriptor.rulesetVersion),
    }),
  )

  if (parsed === null) {
    throw new RangeError('Challenge descriptor is invalid')
  }

  const params = new URLSearchParams()
  params.set('seed', parsed.seed)
  params.set('rules', String(parsed.rulesetVersion))
  return '?' + params.toString()
}

export function createGuestSeed(): string {
  const values = new Uint32Array(2)
  crypto.getRandomValues(values)
  return Array.from(values, (value) =>
    value.toString(36).padStart(7, '0'),
  ).join('')
}
~~~

- [ ] **Step 6: Run deterministic tests and the full foundation checks**

Run:

~~~powershell
npm run test:unit -- src/shared/rng/seededRng.unit.test.ts src/shared/routing/challenge.unit.test.ts
npm run check
~~~

Expected: nine new unit tests pass, existing browser tests pass, lint and typecheck exit 0, and Vite builds successfully.

- [ ] **Step 7: Commit deterministic shared services**

~~~powershell
git add src/shared/rng src/shared/routing
git commit -m "feat: add deterministic seed and challenge services"
~~~

### Task 4: Add the versioned localStorage game-store contract

**Files:**

- Create: <code>src/shared/persistence/gameStore.ts</code>
- Create: <code>src/shared/persistence/gameStore.unit.test.ts</code>

**Interfaces:**

- Produces exactly: <code>GameSaveCodec&lt;T&gt; { key; version; encode; decode }</code>, where <code>decode</code> returns <code>{ ok: true, value }</code> or <code>{ ok: false, reason }</code>.
- Produces exactly: <code>GameStore&lt;T&gt;</code> and <code>createGameStore</code>.
- <code>GameStore.load()</code> returns <code>empty</code>, <code>ready</code>, or <code>recovery-required</code>; callers never receive unchecked persisted data.
- Every stored envelope contains <code>version</code>, <code>savedAt</code>, <code>seed</code>, and encoded <code>data</code>.
- Produces <code>clearStoredGame</code> for route-level reset before a game-specific codec has been loaded.

- [ ] **Step 1: Write codec, migration, corruption, and storage-failure tests**

Create <code>src/shared/persistence/gameStore.unit.test.ts</code>:

~~~ts
import { describe, expect, it } from 'vitest'
import {
  createGameStore,
  type GameSaveCodec,
  type StorageLike,
} from './gameStore'

interface DemoState {
  score: number
}

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const codec: GameSaveCodec<DemoState> = {
  key: 'open-trade:test',
  version: 2,
  encode: (value) => ({ score: value.score }),
  decode: (value) => {
    if (
      typeof value === 'object' &&
      value !== null &&
      'score' in value &&
      typeof value.score === 'number'
    ) {
      return { ok: true, value: { score: value.score } }
    }
    return { ok: false, reason: 'score must be a number' }
  },
}

describe('createGameStore', () => {
  it('returns empty when no save exists', () => {
    const store = createGameStore(codec, {
      storage: new MemoryStorage(),
    })

    expect(store.load()).toEqual({ status: 'empty' })
  })

  it('round-trips encoded state, seed, and timestamp', () => {
    const storage = new MemoryStorage()
    const store = createGameStore(codec, {
      storage,
      now: () => new Date('2026-07-21T00:00:00.000Z'),
    })

    expect(store.save({ score: 42 }, { seed: 'league-77' })).toEqual({ ok: true })
    expect(store.load()).toEqual({
      status: 'ready',
      value: { score: 42 },
      seed: 'league-77',
      savedAt: '2026-07-21T00:00:00.000Z',
      migrated: false,
    })
  })

  it('migrates each older version before decoding', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      codec.key,
      JSON.stringify({
        version: 0,
        savedAt: '2026-07-20T00:00:00.000Z',
        seed: 'legacy-5',
        data: { points: 4 },
      }),
    )
    const store = createGameStore(codec, {
      storage,
      migrations: {
        0: (data) => {
          const points =
            typeof data === 'object' &&
            data !== null &&
            'points' in data &&
            typeof data.points === 'number'
              ? data.points
              : 0
          return { score: points * 10 }
        },
        1: (data) => data,
      },
    })

    const result = store.load()
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.value).toEqual({ score: 40 })
      expect(result.migrated).toBe(true)
    }
  })

  it('returns recovery-required for invalid JSON and future versions', () => {
    const corruptStorage = new MemoryStorage()
    corruptStorage.setItem(codec.key, '{not-json')
    const futureStorage = new MemoryStorage()
    futureStorage.setItem(
      codec.key,
      JSON.stringify({
        version: 99,
        savedAt: '2026-07-21T00:00:00.000Z',
        seed: null,
        data: { score: 1 },
      }),
    )

    expect(
      createGameStore(codec, { storage: corruptStorage }).load(),
    ).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
    })
    expect(
      createGameStore(codec, { storage: futureStorage }).load(),
    ).toMatchObject({
      status: 'recovery-required',
      reason: 'incompatible',
    })
  })

  it('does not throw when browser storage is unavailable', () => {
    const unavailable: StorageLike = {
      getItem() {
        throw new Error('denied')
      },
      setItem() {
        throw new Error('denied')
      },
      removeItem() {
        throw new Error('denied')
      },
    }
    const store = createGameStore(codec, { storage: unavailable })

    expect(store.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'storage-unavailable',
    })
    expect(store.save({ score: 1 })).toEqual({
      ok: false,
      reason: 'storage-unavailable',
    })
    expect(store.clear()).toEqual({
      ok: false,
      reason: 'storage-unavailable',
    })
  })
})
~~~

- [ ] **Step 2: Run the persistence test and verify the contract is missing**

Run:

~~~powershell
npm run test:unit -- src/shared/persistence/gameStore.unit.test.ts
~~~

Expected: FAIL because <code>src/shared/persistence/gameStore.ts</code> cannot be resolved.

- [ ] **Step 3: Implement the complete versioned game store**

Create <code>src/shared/persistence/gameStore.ts</code>:

~~~ts
export type GameSaveDecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string }

export interface GameSaveCodec<T> {
  readonly key: string
  readonly version: number
  encode(value: T): unknown
  decode(value: unknown): GameSaveDecodeResult<T>
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type GameStoreLoadResult<T> =
  | { readonly status: 'empty' }
  | {
      readonly status: 'ready'
      readonly value: T
      readonly seed: string | null
      readonly savedAt: string
      readonly migrated: boolean
    }
  | {
      readonly status: 'recovery-required'
      readonly reason: 'corrupt' | 'incompatible' | 'storage-unavailable'
      readonly detail: string
    }

export type GameStoreWriteResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason: 'encode-failed' | 'storage-unavailable'
    }

export interface GameStoreSaveMetadata {
  readonly seed?: string | null
  readonly savedAt?: string
}

export interface GameStore<T> {
  load(): GameStoreLoadResult<T>
  save(value: T, metadata?: GameStoreSaveMetadata): GameStoreWriteResult
  clear(): GameStoreWriteResult
}

export type GameSaveMigration = (data: unknown) => unknown

export interface GameStoreOptions {
  readonly storage?: StorageLike | null
  readonly now?: () => Date
  readonly migrations?: Readonly<Record<number, GameSaveMigration>>
}

interface SaveEnvelope {
  version: number
  savedAt: string
  seed: string | null
  data: unknown
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isSaveEnvelope(value: unknown): value is SaveEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'version' in value &&
    typeof value.version === 'number' &&
    Number.isInteger(value.version) &&
    'savedAt' in value &&
    typeof value.savedAt === 'string' &&
    'seed' in value &&
    (value.seed === null || typeof value.seed === 'string') &&
    'data' in value
  )
}

function recovery(
  reason: 'corrupt' | 'incompatible' | 'storage-unavailable',
  detail: string,
): GameStoreLoadResult<never> {
  return { status: 'recovery-required', reason, detail }
}

export function createGameStore<T>(
  codec: GameSaveCodec<T>,
  options: GameStoreOptions = {},
): GameStore<T> {
  if (!Number.isInteger(codec.version) || codec.version < 1) {
    throw new RangeError('Game save codec version must be a positive integer')
  }

  const storage =
    options.storage === undefined ? getBrowserStorage() : options.storage
  const now = options.now ?? (() => new Date())

  const save: GameStore<T>['save'] = (value, metadata = {}) => {
    if (storage === null) {
      return { ok: false, reason: 'storage-unavailable' }
    }

    let serialized: string
    try {
      const envelope: SaveEnvelope = {
        version: codec.version,
        savedAt: metadata.savedAt ?? now().toISOString(),
        seed: metadata.seed ?? null,
        data: codec.encode(value),
      }
      serialized = JSON.stringify(envelope)
    } catch {
      return { ok: false, reason: 'encode-failed' }
    }

    try {
      storage.setItem(codec.key, serialized)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'storage-unavailable' }
    }
  }

  return {
    load() {
      if (storage === null) {
        return recovery(
          'storage-unavailable',
          'Browser storage is not available',
        )
      }

      let raw: string | null
      try {
        raw = storage.getItem(codec.key)
      } catch {
        return recovery(
          'storage-unavailable',
          'Browser storage could not be read',
        )
      }

      if (raw === null) {
        return { status: 'empty' }
      }

      let envelope: unknown
      try {
        envelope = JSON.parse(raw) as unknown
      } catch {
        return recovery('corrupt', 'Saved JSON could not be parsed')
      }

      if (!isSaveEnvelope(envelope)) {
        return recovery('corrupt', 'Saved envelope is malformed')
      }

      if (envelope.version > codec.version) {
        return recovery(
          'incompatible',
          'Saved version is newer than this application',
        )
      }

      let version = envelope.version
      let data = envelope.data
      let migrated = false

      while (version < codec.version) {
        const migrate = options.migrations?.[version]
        if (migrate === undefined) {
          return recovery(
            'incompatible',
            'No migration exists for save version ' + String(version),
          )
        }
        try {
          data = migrate(data)
        } catch {
          return recovery(
            'corrupt',
            'Migration failed for save version ' + String(version),
          )
        }
        version += 1
        migrated = true
      }

      const decoded = codec.decode(data)
      if (!decoded.ok) {
        return recovery('corrupt', decoded.reason)
      }

      if (migrated) {
        save(decoded.value, {
          seed: envelope.seed,
          savedAt: envelope.savedAt,
        })
      }

      return {
        status: 'ready',
        value: decoded.value,
        seed: envelope.seed,
        savedAt: envelope.savedAt,
        migrated,
      }
    },
    save,
    clear() {
      if (storage === null) {
        return { ok: false, reason: 'storage-unavailable' }
      }
      try {
        storage.removeItem(codec.key)
        return { ok: true }
      } catch {
        return { ok: false, reason: 'storage-unavailable' }
      }
    },
  }
}

export function clearStoredGame(
  key: string,
  storage: StorageLike | null = getBrowserStorage(),
): GameStoreWriteResult {
  if (storage === null) {
    return { ok: false, reason: 'storage-unavailable' }
  }
  try {
    storage.removeItem(key)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'storage-unavailable' }
  }
}
~~~

- [ ] **Step 4: Run persistence and full checks**

Run:

~~~powershell
npm run test:unit -- src/shared/persistence/gameStore.unit.test.ts
npm run check
~~~

Expected: all five game-store tests pass; every earlier unit/browser test, lint, strict typecheck, and production build also passes.

- [ ] **Step 5: Commit the storage boundary**

~~~powershell
git add src/shared/persistence/gameStore.ts src/shared/persistence/gameStore.unit.test.ts
git commit -m "feat: add versioned game persistence"
~~~

### Task 5: Add persisted settings, reduced motion, and failure-tolerant audio

**Files:**

- Create: <code>src/shared/settings/settingsStore.ts</code>
- Create: <code>src/shared/settings/settingsStore.unit.test.ts</code>
- Create: <code>src/shared/settings/SettingsContext.tsx</code>
- Create: <code>src/shared/settings/SettingsPanel.tsx</code>
- Create: <code>src/shared/settings/settings.css</code>
- Create: <code>src/shared/settings/SettingsPanel.browser.test.tsx</code>
- Create: <code>src/shared/audio/AudioManager.ts</code>
- Create: <code>src/shared/audio/AudioManager.unit.test.ts</code>
- Create: <code>src/shared/audio/AudioContext.tsx</code>

**Interfaces:**

- Produces exactly: <code>useSettings()</code> returning <code>{ settings: { muted, reducedMotion }, updateSettings }</code> from <code>src/shared/settings/SettingsContext.tsx</code>.
- <code>updateSettings</code> accepts a partial settings object and persists the merged result.
- Produces: <code>AudioProvider</code> and <code>useAudio(): { play(src): Promise&lt;boolean&gt;; stopAll(): void }</code>.
- Audio does not instantiate or play an element while muted; rejected playback resolves to <code>false</code> without throwing.
- Applying reduced motion sets <code>html[data-reduced-motion="true"]</code>; operating-system reduced motion remains honored by CSS independently.

- [ ] **Step 1: Write settings codec and migration tests**

Create <code>src/shared/settings/settingsStore.unit.test.ts</code>:

~~~ts
import { describe, expect, it } from 'vitest'
import type { StorageLike } from '../persistence/gameStore'
import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  SETTINGS_SAVE_KEY,
} from './settingsStore'

class SettingsStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

describe('settings store', () => {
  it('round-trips the exact public settings shape', () => {
    const store = createSettingsStore(new SettingsStorage())

    expect(store.save({ muted: true, reducedMotion: true })).toEqual({
      ok: true,
    })
    expect(store.load()).toMatchObject({
      status: 'ready',
      value: { muted: true, reducedMotion: true },
    })
  })

  it('migrates the version-zero sound shape', () => {
    const storage = new SettingsStorage()
    storage.setItem(
      SETTINGS_SAVE_KEY,
      JSON.stringify({
        version: 0,
        savedAt: '2026-07-20T00:00:00.000Z',
        seed: null,
        data: { soundEnabled: false, reduceMotion: true },
      }),
    )

    expect(createSettingsStore(storage).load()).toMatchObject({
      status: 'ready',
      value: { muted: true, reducedMotion: true },
      migrated: true,
    })
  })

  it('exports immutable defaults', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      muted: false,
      reducedMotion: false,
    })
  })
})
~~~

- [ ] **Step 2: Write audio behavior tests**

Create <code>src/shared/audio/AudioManager.unit.test.ts</code>:

~~~ts
import { describe, expect, it, vi } from 'vitest'
import {
  AudioManager,
  type AudioFactory,
  type PlayableAudio,
} from './AudioManager'

function makeAudio(
  play: () => Promise<void> = () => Promise.resolve(),
): PlayableAudio {
  return {
    currentTime: 0,
    play,
    pause: vi.fn(),
    addEventListener: vi.fn(),
  }
}

describe('AudioManager', () => {
  it('does not create audio while muted', async () => {
    const factory = vi.fn<AudioFactory>(() => makeAudio())
    const manager = new AudioManager(factory)
    manager.setMuted(true)

    await expect(manager.play('/audio/coin.ogg')).resolves.toBe(false)
    expect(factory).not.toHaveBeenCalled()
  })

  it('degrades rejected playback to false', async () => {
    const manager = new AudioManager(() =>
      makeAudio(() => Promise.reject(new Error('blocked'))),
    )

    await expect(manager.play('/audio/coin.ogg')).resolves.toBe(false)
  })

  it('stops every active sound', async () => {
    const first = makeAudio()
    const second = makeAudio()
    const queue = [first, second]
    const manager = new AudioManager(() => {
      const audio = queue.shift()
      if (audio === undefined) {
        throw new Error('No audio left in the test queue')
      }
      return audio
    })

    await manager.play('/audio/first.ogg')
    await manager.play('/audio/second.ogg')
    manager.stopAll()

    expect(first.pause).toHaveBeenCalledOnce()
    expect(second.pause).toHaveBeenCalledOnce()
  })
})
~~~

- [ ] **Step 3: Write the settings panel browser test**

Create <code>src/shared/settings/SettingsPanel.browser.test.tsx</code>:

~~~tsx
import { useState } from 'react'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import {
  createGameStore,
  type GameSaveCodec,
} from '../persistence/gameStore'
import { Button } from '../ui'
import {
  type AppSettings,
  DEFAULT_SETTINGS,
} from './settingsStore'
import {
  SettingsProvider,
  useSettings,
} from './SettingsContext'
import { SettingsPanel } from './SettingsPanel'

const testCodec: GameSaveCodec<AppSettings> = {
  key: 'open-trade:test-settings-browser',
  version: 1,
  encode: (value) => value,
  decode: (value) => {
    if (
      typeof value === 'object' &&
      value !== null &&
      'muted' in value &&
      typeof value.muted === 'boolean' &&
      'reducedMotion' in value &&
      typeof value.reducedMotion === 'boolean'
    ) {
      return {
        ok: true,
        value: {
          muted: value.muted,
          reducedMotion: value.reducedMotion,
        },
      }
    }
    return { ok: false, reason: 'invalid settings' }
  },
}

function Harness() {
  const [open, setOpen] = useState(false)
  const { settings } = useSettings()

  return (
    <>
      <Button onClick={() => setOpen(true)}>Settings</Button>
      <output>
        {settings.muted ? 'Muted' : 'Sound on'} ·{' '}
        {settings.reducedMotion ? 'Reduced motion' : 'Standard motion'}
      </output>
      <SettingsPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}

test('updates and persists sound and reduced-motion settings', async () => {
  const store = createGameStore(testCodec, {
    storage: window.localStorage,
  })
  store.clear()

  const screen = await render(
    <SettingsProvider store={store} initialSettings={DEFAULT_SETTINGS}>
      <Harness />
    </SettingsProvider>,
  )

  await screen.getByRole('button', { name: 'Settings' }).click()
  await screen.getByRole('checkbox', { name: 'Sound' }).click()
  await screen.getByRole('checkbox', { name: 'Reduce motion' }).click()

  await expect.element(screen.getByText('Muted · Reduced motion')).toBeVisible()
  expect(store.load()).toMatchObject({
    status: 'ready',
    value: { muted: true, reducedMotion: true },
  })
})
~~~

- [ ] **Step 4: Run the new tests and confirm all three implementation modules are missing**

Run:

~~~powershell
npm run test:unit -- src/shared/settings/settingsStore.unit.test.ts src/shared/audio/AudioManager.unit.test.ts
npm run test:browser -- src/shared/settings/SettingsPanel.browser.test.tsx
~~~

Expected: FAIL because <code>settingsStore.ts</code>, <code>AudioManager.ts</code>, and <code>SettingsContext.tsx</code> do not exist.

- [ ] **Step 5: Implement the settings codec and store**

Create <code>src/shared/settings/settingsStore.ts</code>:

~~~ts
import {
  createGameStore,
  type GameSaveCodec,
  type GameStore,
  type StorageLike,
} from '../persistence/gameStore'

export interface AppSettings {
  readonly muted: boolean
  readonly reducedMotion: boolean
}

export const DEFAULT_SETTINGS: AppSettings = Object.freeze({
  muted: false,
  reducedMotion: false,
})

export const SETTINGS_SAVE_KEY = 'open-trade:settings'

const settingsCodec: GameSaveCodec<AppSettings> = {
  key: SETTINGS_SAVE_KEY,
  version: 1,
  encode: (value) => ({
    muted: value.muted,
    reducedMotion: value.reducedMotion,
  }),
  decode: (value) => {
    if (
      typeof value === 'object' &&
      value !== null &&
      'muted' in value &&
      typeof value.muted === 'boolean' &&
      'reducedMotion' in value &&
      typeof value.reducedMotion === 'boolean'
    ) {
      return {
        ok: true,
        value: {
          muted: value.muted,
          reducedMotion: value.reducedMotion,
        },
      }
    }
    return { ok: false, reason: 'Settings fields are invalid' }
  },
}

export function createSettingsStore(
  storage?: StorageLike,
): GameStore<AppSettings> {
  const migrations = {
    0: (value: unknown) => {
      if (
        typeof value === 'object' &&
        value !== null &&
        'soundEnabled' in value &&
        typeof value.soundEnabled === 'boolean' &&
        'reduceMotion' in value &&
        typeof value.reduceMotion === 'boolean'
      ) {
        return {
          muted: !value.soundEnabled,
          reducedMotion: value.reduceMotion,
        }
      }
      return DEFAULT_SETTINGS
    },
  }

  return storage === undefined
    ? createGameStore(settingsCodec, { migrations })
    : createGameStore(settingsCodec, { storage, migrations })
}
~~~

- [ ] **Step 6: Implement the exact SettingsContext hook contract and panel**

Create <code>src/shared/settings/SettingsContext.tsx</code>:

~~~tsx
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { GameStore } from '../persistence/gameStore'
import { Button } from '../ui'
import {
  type AppSettings,
  createSettingsStore,
  DEFAULT_SETTINGS,
} from './settingsStore'

export interface SettingsContextValue {
  readonly settings: AppSettings
  readonly updateSettings: (patch: Partial<AppSettings>) => void
}

interface SettingsProviderProps {
  readonly store?: GameStore<AppSettings>
  readonly initialSettings?: AppSettings
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({
  store: suppliedStore,
  initialSettings = DEFAULT_SETTINGS,
  children,
}: PropsWithChildren<SettingsProviderProps>) {
  const store = useMemo(
    () => suppliedStore ?? createSettingsStore(),
    [suppliedStore],
  )
  const initialLoad = useMemo(() => store.load(), [store])
  const [settings, setSettings] = useState<AppSettings>(
    initialLoad.status === 'ready' ? initialLoad.value : initialSettings,
  )
  const [showRecovery, setShowRecovery] = useState(
    initialLoad.status === 'recovery-required',
  )

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(
      settings.reducedMotion,
    )
  }, [settings.reducedMotion])

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch }
        store.save(next)
        return next
      })
    },
    [store],
  )

  const value = useMemo(
    () => ({ settings, updateSettings }),
    [settings, updateSettings],
  )

  return (
    <SettingsContext.Provider value={value}>
      {showRecovery ? (
        <div className="settings-recovery" role="alert">
          <span>Saved settings could not be read. Safe defaults are active.</span>
          <Button
            variant="secondary"
            onClick={() => {
              store.clear()
              setShowRecovery(false)
            }}
          >
            Clear damaged settings
          </Button>
        </div>
      ) : null}
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (context === null) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}
~~~

Create <code>src/shared/settings/SettingsPanel.tsx</code>:

~~~tsx
import { Dialog } from '../ui'
import { useSettings } from './SettingsContext'

export interface SettingsPanelProps {
  readonly open: boolean
  readonly onClose: () => void
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Settings"
      description="These preferences are stored only in this browser."
    >
      <div className="settings-list">
        <label className="settings-row">
          <span>
            <strong>Sound</strong>
            <small>Music and effects across all three games.</small>
          </span>
          <input
            type="checkbox"
            aria-label="Sound"
            checked={!settings.muted}
            onChange={(event) =>
              updateSettings({ muted: !event.currentTarget.checked })
            }
          />
        </label>
        <label className="settings-row">
          <span>
            <strong>Reduce motion</strong>
            <small>Limits transitions, shake, flashes, and parallax.</small>
          </span>
          <input
            type="checkbox"
            aria-label="Reduce motion"
            checked={settings.reducedMotion}
            onChange={(event) =>
              updateSettings({
                reducedMotion: event.currentTarget.checked,
              })
            }
          />
        </label>
      </div>
    </Dialog>
  )
}
~~~

Create <code>src/shared/settings/settings.css</code>:

~~~css
.settings-recovery {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 2px solid var(--color-signal-red);
  background: #fff3d6;
  font-weight: 700;
}

.settings-list {
  display: grid;
  gap: var(--space-4);
}

.settings-row {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
}

.settings-row span {
  display: grid;
  gap: var(--space-1);
}

.settings-row small {
  color: var(--color-ink-muted);
}

.settings-row input {
  width: 44px;
  height: 44px;
  margin: 0;
  accent-color: var(--color-gain-green);
}

@media (max-width: 420px) {
  .settings-recovery {
    align-items: stretch;
    flex-direction: column;
  }
}
~~~

- [ ] **Step 7: Implement the audio manager and React adapter**

Create <code>src/shared/audio/AudioManager.ts</code>:

~~~ts
export interface PlayableAudio {
  currentTime: number
  play(): Promise<void>
  pause(): void
  addEventListener(
    type: 'ended',
    listener: () => void,
    options: { once: true },
  ): void
}

export type AudioFactory = (src: string) => PlayableAudio

function browserAudioFactory(src: string): PlayableAudio {
  return new Audio(src)
}

export class AudioManager {
  private muted = false
  private readonly active = new Set<PlayableAudio>()

  constructor(
    private readonly createAudio: AudioFactory = browserAudioFactory,
  ) {}

  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) {
      this.stopAll()
    }
  }

  async play(src: string): Promise<boolean> {
    if (this.muted) {
      return false
    }

    let audio: PlayableAudio | null = null
    try {
      audio = this.createAudio(src)
      audio.currentTime = 0
      this.active.add(audio)
      audio.addEventListener(
        'ended',
        () => {
          this.active.delete(audio)
        },
        { once: true },
      )
      await audio.play()
      return true
    } catch {
      if (audio !== null) {
        this.active.delete(audio)
      }
      return false
    }
  }

  stopAll(): void {
    for (const audio of this.active) {
      audio.pause()
      audio.currentTime = 0
    }
    this.active.clear()
  }
}
~~~

Create <code>src/shared/audio/AudioContext.tsx</code>:

~~~tsx
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react'
import { useSettings } from '../settings/SettingsContext'
import { AudioManager } from './AudioManager'

interface AudioContextValue {
  readonly play: (src: string) => Promise<boolean>
  readonly stopAll: () => void
}

interface AudioProviderProps {
  readonly manager?: AudioManager
}

const AudioContext = createContext<AudioContextValue | null>(null)

export function AudioProvider({
  manager: suppliedManager,
  children,
}: PropsWithChildren<AudioProviderProps>) {
  const manager = useMemo(
    () => suppliedManager ?? new AudioManager(),
    [suppliedManager],
  )
  const { settings } = useSettings()

  useEffect(() => {
    manager.setMuted(settings.muted)
  }, [manager, settings.muted])

  useEffect(() => {
    return () => manager.stopAll()
  }, [manager])

  const play = useCallback((src: string) => manager.play(src), [manager])
  const stopAll = useCallback(() => manager.stopAll(), [manager])
  const value = useMemo(() => ({ play, stopAll }), [play, stopAll])

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  )
}

export function useAudio(): AudioContextValue {
  const context = useContext(AudioContext)
  if (context === null) {
    throw new Error('useAudio must be used within AudioProvider')
  }
  return context
}
~~~

- [ ] **Step 8: Import settings styles and run the settings/audio gates**

Add this import to <code>src/main.tsx</code> after the shared UI stylesheet:

~~~tsx
import './shared/settings/settings.css'
~~~

Run:

~~~powershell
npm run test:unit -- src/shared/settings/settingsStore.unit.test.ts src/shared/audio/AudioManager.unit.test.ts
npm run test:browser -- src/shared/settings/SettingsPanel.browser.test.tsx
npm run check
~~~

Expected: three settings tests, three audio tests, and the settings browser test pass; the complete lint, strict typecheck, browser suite, and build remain green.

- [ ] **Step 9: Commit settings and audio as one shared policy boundary**

~~~powershell
git add src/shared/settings src/shared/audio src/main.tsx
git commit -m "feat: add shared settings and audio policy"
~~~

### Task 6: Add hash routing, lazy game contracts, route recovery, and shell focus management

**Files:**

- Create: <code>src/app/routes/types.ts</code>
- Create: <code>src/app/routes/metadata.ts</code>
- Create: <code>src/app/routes/registry.ts</code>
- Create: <code>src/app/routes/LazyGameRoute.tsx</code>
- Create: <code>src/app/routes/RouteErrorBoundary.tsx</code>
- Create: <code>src/app/routes/RouteFocusManager.tsx</code>
- Create: <code>src/app/routes/AppRouter.tsx</code>
- Create: <code>src/app/routes/routes.browser.test.tsx</code>
- Create: <code>src/app/AppShell.tsx</code>
- Create: <code>src/app/app-shell.css</code>
- Create: <code>src/app/hub/HubFoundationPage.tsx</code>
- Create: <code>src/games/GameFoundationPage.tsx</code>
- Create: <code>src/games/fanstocks/route.tsx</code>
- Create: <code>src/games/founder-mode/route.tsx</code>
- Create: <code>src/games/wallstreet-surfers/route.tsx</code>
- Modify: <code>src/app/App.tsx</code>
- Modify: <code>src/main.tsx</code>

**Interfaces:**

- Produces exactly: <code>GameRouteModule</code> and <code>GameProgressBadge</code> from <code>src/app/routes/types.ts</code>.
- <code>GameRouteModule</code> exposes metadata, entry component, save key, reset function, progress getter, and optional challenge parser.
- Produces: <code>GAME_ROUTES</code>, whose <code>load()</code> functions are the only imports of game route modules.
- Consumes: <code>ChallengeDescriptor</code> and <code>parseChallenge</code> from Task 3.
- Consumes: <code>clearStoredGame</code> from Task 4.
- Consumes: <code>SettingsProvider</code>, <code>AudioProvider</code>, and <code>ToastProvider</code> from Tasks 2 and 5.

- [ ] **Step 1: Write browser tests for hash routing, lazy entries, focus, and route recovery**

Create <code>src/app/routes/routes.browser.test.tsx</code>:

~~~tsx
import { useState } from 'react'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from '../App'
import { RouteErrorBoundary } from './RouteErrorBoundary'

test('loads a game entry from its hash route and can return to the hub', async () => {
  window.location.hash = '#/fanstocks?seed=guest-42&rules=1'
  const screen = await render(<App />)

  await expect.element(
    screen.getByRole('heading', { name: 'FanStocks', level: 1 }),
  ).toBeVisible()
  await expect.element(
    screen.getByText('Challenge seed guest-42 · ruleset 1'),
  ).toBeVisible()

  await screen.getByRole('link', { name: 'Back to all games' }).click()
  await expect.element(
    screen.getByRole('heading', { name: 'Choose your market', level: 1 }),
  ).toBeVisible()
  await expect.element(screen.getByRole('main')).toHaveFocus()
})

test('shows retry and return actions after a route render failure', async () => {
  let shouldThrow = true

  function UnstableRoute() {
    const [, renderAgain] = useState(0)
    if (shouldThrow) {
      throw new Error('route exploded')
    }
    return (
      <button onClick={() => renderAgain((value) => value + 1)}>
        Route recovered
      </button>
    )
  }

  const screen = await render(
    <RouteErrorBoundary>
      <UnstableRoute />
    </RouteErrorBoundary>,
  )

  await expect.element(
    screen.getByRole('heading', { name: 'This game hit a snag' }),
  ).toBeVisible()
  shouldThrow = false
  await screen.getByRole('button', { name: 'Try again' }).click()
  await expect.element(
    screen.getByRole('button', { name: 'Route recovered' }),
  ).toBeVisible()
  await expect.element(
    screen.getByRole('link', { name: 'Return to games' }),
  ).toHaveAttribute('href', '#/')
})
~~~

- [ ] **Step 2: Run the routing test and verify the missing shell is red**

Run:

~~~powershell
npm run test:browser -- src/app/routes/routes.browser.test.tsx
~~~

Expected: FAIL because <code>RouteErrorBoundary.tsx</code> and the routed <code>App</code> implementation do not exist.

- [ ] **Step 3: Define the exact route types and static metadata**

Create <code>src/app/routes/types.ts</code>:

~~~ts
import type { ComponentType } from 'react'
import type { ChallengeDescriptor } from '../../shared/routing/challenge'

export type GameId =
  | 'fanstocks'
  | 'founder-mode'
  | 'wallstreet-surfers'

export interface GameProgressBadge {
  readonly label: string
  readonly value: string
  readonly tone: 'neutral' | 'positive' | 'warning'
}

export interface GameRouteMetadata {
  readonly id: GameId
  readonly path:
    | '/fanstocks'
    | '/founder-mode'
    | '/wallstreet-surfers'
  readonly title: string
  readonly eyebrow: string
  readonly tagline: string
  readonly description: string
  readonly howItWorks: readonly [string, string, string]
  readonly coverLabel: string
  readonly accent: 'yellow' | 'green' | 'red'
}

export interface GameRouteModule {
  readonly metadata: GameRouteMetadata
  readonly Entry: ComponentType
  readonly saveKey: string
  readonly reset: () => void
  readonly getProgressBadge: () => GameProgressBadge
  readonly parseChallenge?: (
    input: string | URLSearchParams,
  ) => ChallengeDescriptor | null
}

export interface GameRouteRegistration {
  readonly metadata: GameRouteMetadata
  readonly load: () => Promise<{ readonly gameRoute: GameRouteModule }>
}
~~~

Create <code>src/app/routes/metadata.ts</code>:

~~~ts
import type { GameRouteMetadata } from './types'

export const FANSTOCKS_METADATA: GameRouteMetadata = {
  id: 'fanstocks',
  path: '/fanstocks',
  title: 'FanStocks',
  eyebrow: 'Draft and simulation',
  tagline: 'Draft. Trade. Outperform.',
  description:
    'Build a three-stock portfolio, negotiate with rival bots, and race to Friday close.',
  howItWorks: [
    'Draft one stock from each of three candidate groups.',
    'Watch a seeded market week and answer one-for-one trade offers.',
    'Finish Friday with the highest simulated portfolio value.',
  ],
  coverLabel: 'Three stock cards arranged over a glowing market table',
  accent: 'yellow',
}

export const FOUNDER_MODE_METADATA: GameRouteMetadata = {
  id: 'founder-mode',
  path: '/founder-mode',
  title: 'Founder Mode',
  eyebrow: 'Five-decision narrative',
  tagline: 'Five calls. One legacy.',
  description:
    'Make five historical founder decisions and compare your valuation with reality.',
  howItWorks: [
    'Choose an episode and step into a documented founder dilemma.',
    'Make exactly five decisions with deterministic valuation feedback.',
    'Compare Reality versus You and review your founder-style mix.',
  ],
  coverLabel: 'Editorial founder portrait split by an upward valuation line',
  accent: 'green',
}

export const WALLSTREET_SURFERS_METADATA: GameRouteMetadata = {
  id: 'wallstreet-surfers',
  path: '/wallstreet-surfers',
  title: 'Wallstreet Surfers',
  eyebrow: 'Three-lane endless runner',
  tagline: 'Run the market.',
  description:
    'Dodge ticker trains, read market gates, collect coins, and keep Powell behind you.',
  howItWorks: [
    'Move across three lanes, jump barriers, and roll under hazards.',
    'Answer LONG with Up and SHORT with Down at market gates.',
    'Build score and streak while the pace and obstacle density rise.',
  ],
  coverLabel: 'A runner facing ticker trains in dramatic street perspective',
  accent: 'red',
}

export const GAME_METADATA = [
  FANSTOCKS_METADATA,
  FOUNDER_MODE_METADATA,
  WALLSTREET_SURFERS_METADATA,
] as const
~~~

- [ ] **Step 4: Add foundation game entry modules that obey the route contract**

Create <code>src/games/GameFoundationPage.tsx</code>:

~~~tsx
import { Link, useLocation } from 'react-router-dom'
import type { GameRouteMetadata } from '../app/routes/types'
import { APP_DISCLAIMER } from '../app/appMeta'
import { parseChallenge } from '../shared/routing/challenge'

export interface GameFoundationPageProps {
  readonly metadata: GameRouteMetadata
}

export function GameFoundationPage({
  metadata,
}: GameFoundationPageProps) {
  const location = useLocation()
  const challenge = parseChallenge(location.search)

  return (
    <section className="game-foundation" aria-labelledby="game-title">
      <p className="game-foundation__eyebrow">{metadata.eyebrow}</p>
      <h1 id="game-title">{metadata.title}</h1>
      <p>{metadata.description}</p>
      {challenge === null ? (
        <p>Start from the hub to create a fresh guest seed.</p>
      ) : (
        <p>
          Challenge seed {challenge.seed} · ruleset {challenge.rulesetVersion}
        </p>
      )}
      <p className="game-foundation__status">
        The shared shell, save boundary, and challenge contract are ready for
        this game vertical slice.
      </p>
      <p>{APP_DISCLAIMER}</p>
      <Link className="text-link" to="/">
        Back to all games
      </Link>
    </section>
  )
}
~~~

Create <code>src/games/fanstocks/route.tsx</code>:

~~~tsx
import { FANSTOCKS_METADATA } from '../../app/routes/metadata'
import type { GameRouteModule } from '../../app/routes/types'
import { clearStoredGame } from '../../shared/persistence/gameStore'
import { parseChallenge } from '../../shared/routing/challenge'
import { GameFoundationPage } from '../GameFoundationPage'

const SAVE_KEY = 'open-trade:game:fanstocks'

function FanStocksEntry() {
  return <GameFoundationPage metadata={FANSTOCKS_METADATA} />
}

export const gameRoute: GameRouteModule = {
  metadata: FANSTOCKS_METADATA,
  Entry: FanStocksEntry,
  saveKey: SAVE_KEY,
  reset: () => {
    clearStoredGame(SAVE_KEY)
  },
  getProgressBadge: () => ({
    label: 'League',
    value: 'No active league',
    tone: 'neutral',
  }),
  parseChallenge,
}
~~~

Create <code>src/games/founder-mode/route.tsx</code>:

~~~tsx
import { FOUNDER_MODE_METADATA } from '../../app/routes/metadata'
import type { GameRouteModule } from '../../app/routes/types'
import { clearStoredGame } from '../../shared/persistence/gameStore'
import { parseChallenge } from '../../shared/routing/challenge'
import { GameFoundationPage } from '../GameFoundationPage'

const SAVE_KEY = 'open-trade:game:founder-mode'

function FounderModeEntry() {
  return <GameFoundationPage metadata={FOUNDER_MODE_METADATA} />
}

export const gameRoute: GameRouteModule = {
  metadata: FOUNDER_MODE_METADATA,
  Entry: FounderModeEntry,
  saveKey: SAVE_KEY,
  reset: () => {
    clearStoredGame(SAVE_KEY)
  },
  getProgressBadge: () => ({
    label: 'Founder streak',
    value: '0 days',
    tone: 'neutral',
  }),
  parseChallenge,
}
~~~

Create <code>src/games/wallstreet-surfers/route.tsx</code>:

~~~tsx
import { WALLSTREET_SURFERS_METADATA } from '../../app/routes/metadata'
import type { GameRouteModule } from '../../app/routes/types'
import { clearStoredGame } from '../../shared/persistence/gameStore'
import { parseChallenge } from '../../shared/routing/challenge'
import { GameFoundationPage } from '../GameFoundationPage'

const SAVE_KEY = 'open-trade:game:wallstreet-surfers'

function WallstreetSurfersEntry() {
  return <GameFoundationPage metadata={WALLSTREET_SURFERS_METADATA} />
}

export const gameRoute: GameRouteModule = {
  metadata: WALLSTREET_SURFERS_METADATA,
  Entry: WallstreetSurfersEntry,
  saveKey: SAVE_KEY,
  reset: () => {
    clearStoredGame(SAVE_KEY)
  },
  getProgressBadge: () => ({
    label: 'Best score',
    value: '0',
    tone: 'neutral',
  }),
  parseChallenge,
}
~~~

- [ ] **Step 5: Add the lazy registry and route adapter**

Create <code>src/app/routes/registry.ts</code>:

~~~ts
import {
  FANSTOCKS_METADATA,
  FOUNDER_MODE_METADATA,
  WALLSTREET_SURFERS_METADATA,
} from './metadata'
import type { GameId, GameRouteRegistration } from './types'

export const GAME_ROUTES: readonly GameRouteRegistration[] = [
  {
    metadata: FANSTOCKS_METADATA,
    load: () => import('../../games/fanstocks/route'),
  },
  {
    metadata: FOUNDER_MODE_METADATA,
    load: () => import('../../games/founder-mode/route'),
  },
  {
    metadata: WALLSTREET_SURFERS_METADATA,
    load: () => import('../../games/wallstreet-surfers/route'),
  },
]

export function getGameRoute(id: GameId): GameRouteRegistration {
  const registration = GAME_ROUTES.find(
    (candidate) => candidate.metadata.id === id,
  )
  if (registration === undefined) {
    throw new RangeError('Unknown game route: ' + id)
  }
  return registration
}
~~~

Create <code>src/app/routes/LazyGameRoute.tsx</code>:

~~~tsx
import { lazy, Suspense, useMemo } from 'react'
import type { GameRouteRegistration } from './types'
import { RouteErrorBoundary } from './RouteErrorBoundary'

export interface LazyGameRouteProps {
  readonly registration: GameRouteRegistration
}

export function LazyGameRoute({ registration }: LazyGameRouteProps) {
  const Entry = useMemo(
    () =>
      lazy(async () => {
        const module = await registration.load()
        if (module.gameRoute.metadata.id !== registration.metadata.id) {
          throw new Error('Loaded game route metadata does not match registry')
        }
        return { default: module.gameRoute.Entry }
      }),
    [registration],
  )

  return (
    <RouteErrorBoundary>
      <Suspense fallback={<p role="status">Loading game shell</p>}>
        <Entry />
      </Suspense>
    </RouteErrorBoundary>
  )
}
~~~

- [ ] **Step 6: Add route error recovery and focus-on-navigation**

Create <code>src/app/routes/RouteErrorBoundary.tsx</code>:

~~~tsx
import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { Button } from '../../shared/ui'

interface RouteErrorBoundaryState {
  readonly error: Error | null
}

export class RouteErrorBoundary extends Component<
  PropsWithChildren<object>,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('OpenTrade route error', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children
    }

    return (
      <section className="route-error" role="alert">
        <p className="route-error__eyebrow">Recoverable route error</p>
        <h1>This game hit a snag</h1>
        <p>Your saved progress is still in this browser.</p>
        <div className="route-error__actions">
          <Button onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          <a className="ui-button ui-button--secondary" href="#/">
            Return to games
          </a>
        </div>
      </section>
    )
  }
}
~~~

Create <code>src/app/routes/RouteFocusManager.tsx</code>:

~~~tsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function RouteFocusManager() {
  const location = useLocation()

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname, location.search])

  return null
}
~~~

- [ ] **Step 7: Build the application shell and hash router**

Create <code>src/app/hub/HubFoundationPage.tsx</code>:

~~~tsx
import { APP_DISCLAIMER } from '../appMeta'

export function HubFoundationPage() {
  return (
    <section className="hub-foundation">
      <p className="hub-foundation__eyebrow">Three simulated markets</p>
      <h1>Choose your market</h1>
      <p>
        Draft a portfolio, rewrite a founder decision, or run the market.
      </p>
      <p>{APP_DISCLAIMER}</p>
    </section>
  )
}
~~~

Create <code>src/app/AppShell.tsx</code>:

~~~tsx
import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { APP_DISCLAIMER, APP_NAME } from './appMeta'
import { RouteFocusManager } from './routes/RouteFocusManager'
import { SettingsPanel } from '../shared/settings/SettingsPanel'
import { Button } from '../shared/ui'

export function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <RouteFocusManager />
      <header className="app-header">
        <Link className="app-brand" to="/" aria-label="OpenTrade games">
          {APP_NAME}
        </Link>
        <Button
          variant="secondary"
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
        >
          Settings
        </Button>
      </header>
      <main id="main-content" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>{APP_DISCLAIMER}</p>
        <p>Original simulations. No real money, accounts, or live quotes.</p>
      </footer>
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  )
}
~~~

Create <code>src/app/routes/AppRouter.tsx</code>:

~~~tsx
import { Route, Routes } from 'react-router-dom'
import { AppShell } from '../AppShell'
import { HubFoundationPage } from '../hub/HubFoundationPage'
import { LazyGameRoute } from './LazyGameRoute'
import { GAME_ROUTES } from './registry'

function NotFoundPage() {
  return (
    <section>
      <h1>Market not found</h1>
      <a className="text-link" href="#/">
        Return to games
      </a>
    </section>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HubFoundationPage />} />
        {GAME_ROUTES.map((registration) => (
          <Route
            key={registration.metadata.id}
            path={registration.metadata.id}
            element={<LazyGameRoute registration={registration} />}
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
~~~

Replace <code>src/app/App.tsx</code>:

~~~tsx
import { HashRouter } from 'react-router-dom'
import { AudioProvider } from '../shared/audio/AudioContext'
import { SettingsProvider } from '../shared/settings/SettingsContext'
import { ToastProvider } from '../shared/ui'
import { AppRouter } from './routes/AppRouter'

export function App() {
  return (
    <HashRouter>
      <SettingsProvider>
        <AudioProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AudioProvider>
      </SettingsProvider>
    </HashRouter>
  )
}
~~~

Replace <code>src/app/App.browser.test.tsx</code> so the bootstrap smoke test matches the routed shell:

~~~tsx
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from './App'

test('renders the routed product shell and disclaimer', async () => {
  window.location.hash = '#/'
  const screen = await render(<App />)

  await expect.element(
    screen.getByRole('link', { name: 'OpenTrade games' }),
  ).toBeVisible()
  await expect.element(
    screen.getByRole('heading', { name: 'Choose your market', level: 1 }),
  ).toBeVisible()
  await expect.element(
    screen.getByText('Simulated game — not investment advice'),
  ).toBeVisible()
})
~~~

Create <code>src/app/app-shell.css</code>:

~~~css
.skip-link {
  position: fixed;
  z-index: 100;
  top: var(--space-3);
  left: var(--space-3);
  padding: var(--space-3);
  transform: translateY(-200%);
  border: 2px solid var(--color-ink);
  border-radius: var(--radius-sm);
  background: var(--color-market-yellow);
  font-weight: 800;
}

.skip-link:focus {
  transform: translateY(0);
}

.app-header,
.app-footer {
  width: min(100% - 2rem, 78rem);
  margin-inline: auto;
}

.app-header {
  display: flex;
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-block: var(--space-4);
}

.app-brand {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 4vw, 2.1rem);
  font-weight: 900;
  text-decoration: none;
}

.app-main {
  width: min(100% - 2rem, 78rem);
  min-height: calc(100vh - 15rem);
  margin-inline: auto;
  padding-block: var(--space-6) var(--space-7);
}

.app-main:focus {
  outline: none;
}

.app-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-3);
  padding-block: var(--space-5);
  border-top: 1px solid var(--color-line);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.hub-foundation,
.game-foundation,
.route-error {
  max-width: 48rem;
}

.hub-foundation h1,
.game-foundation h1,
.route-error h1 {
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 8vw, 5.5rem);
  line-height: 0.95;
}

.hub-foundation__eyebrow,
.game-foundation__eyebrow,
.route-error__eyebrow {
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.game-foundation__status {
  padding: var(--space-4);
  border-left: 0.5rem solid var(--color-market-yellow);
  background: var(--color-paper);
}

.route-error__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.route-error__actions a {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

.text-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  font-weight: 850;
  text-decoration-thickness: 0.15em;
  text-underline-offset: 0.2em;
}
~~~

Add this stylesheet import to <code>src/main.tsx</code>:

~~~tsx
import './app/app-shell.css'
~~~

- [ ] **Step 8: Run routing tests and the complete gate**

Run:

~~~powershell
npm run test:browser -- src/app/routes/routes.browser.test.tsx
npm run check
~~~

Expected: the two routing browser tests pass, each game entry is emitted as a separate production chunk, and every previous check remains green.

- [ ] **Step 9: Commit the route shell**

~~~powershell
git add src/app src/games src/main.tsx
git commit -m "feat: add lazy hash-routed game shell"
~~~

### Task 7: Build the persisted progress summary and polished responsive hub

**Files:**

- Create: <code>src/app/routes/progressStore.ts</code>
- Create: <code>src/app/routes/progressStore.unit.test.ts</code>
- Create: <code>src/app/hub/GameCard.tsx</code>
- Create: <code>src/app/hub/HubPage.tsx</code>
- Create: <code>src/app/hub/hub.css</code>
- Create: <code>src/app/hub/HubPage.browser.test.tsx</code>
- Modify: <code>src/app/routes/AppRouter.tsx</code>
- Modify: <code>src/games/fanstocks/route.tsx</code>
- Modify: <code>src/games/founder-mode/route.tsx</code>
- Modify: <code>src/games/wallstreet-surfers/route.tsx</code>
- Modify: <code>src/main.tsx</code>
- Delete: <code>src/app/hub/HubFoundationPage.tsx</code>

**Interfaces:**

- Produces: <code>readGameProgress</code>, <code>setGameProgress</code>, <code>resetGameProgress</code>, <code>resetAllGameProgress</code>, and <code>subscribeToGameProgress</code>.
- Persisted progress is a derived summary only: active FanStocks league, Founder streak days, and runner best score.
- Game vertical slices call <code>setGameProgress(gameId, badge)</code> after meaningful progress changes.
- Consumes: <code>GameProgressBadge</code> and <code>GameId</code> from Task 6.
- Consumes: each lazy <code>GameRouteModule.reset()</code>; resetting a card clears both its game save and derived badge.

- [ ] **Step 1: Write progress-store tests**

Create <code>src/app/routes/progressStore.unit.test.ts</code>:

~~~ts
import { beforeEach, describe, expect, it } from 'vitest'
import type { StorageLike } from '../../shared/persistence/gameStore'
import {
  createProgressStore,
  DEFAULT_PROGRESS,
} from './progressStore'

class ProgressStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

describe('progress store', () => {
  let storage: ProgressStorage

  beforeEach(() => {
    storage = new ProgressStorage()
  })

  it('starts with the three approved badge summaries', () => {
    const progress = createProgressStore(storage)

    expect(progress.readAll()).toEqual(DEFAULT_PROGRESS)
  })

  it('persists and resets one game without changing the others', () => {
    const progress = createProgressStore(storage)
    progress.set('fanstocks', {
      label: 'League',
      value: 'Round 2 of 3',
      tone: 'positive',
    })
    progress.set('wallstreet-surfers', {
      label: 'Best score',
      value: '12,450',
      tone: 'positive',
    })
    progress.reset('fanstocks')

    expect(progress.read('fanstocks')).toEqual(DEFAULT_PROGRESS.fanstocks)
    expect(progress.read('wallstreet-surfers')).toEqual({
      label: 'Best score',
      value: '12,450',
      tone: 'positive',
    })
  })

  it('resets every badge to a fresh immutable snapshot', () => {
    const progress = createProgressStore(storage)
    progress.set('founder-mode', {
      label: 'Founder streak',
      value: '4 days',
      tone: 'positive',
    })
    progress.resetAll()

    expect(progress.readAll()).toEqual(DEFAULT_PROGRESS)
    expect(progress.readAll()).not.toBe(DEFAULT_PROGRESS)
  })
})
~~~

- [ ] **Step 2: Write hub browser tests before the hub exists**

Create <code>src/app/hub/HubPage.browser.test.tsx</code>:

~~~tsx
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from '../App'

test('renders three complete game cards and opens the how-to dialog', async () => {
  window.location.hash = '#/'
  const screen = await render(<App />)

  await expect.element(
    screen.getByRole('heading', { name: 'Choose your market', level: 1 }),
  ).toBeVisible()
  await expect.element(screen.getByText('FanStocks')).toBeVisible()
  await expect.element(screen.getByText('Founder Mode')).toBeVisible()
  await expect.element(screen.getByText('Wallstreet Surfers')).toBeVisible()

  await screen.getByRole('button', {
    name: 'How FanStocks works',
  }).click()
  await expect.element(
    screen.getByRole('dialog', { name: 'How FanStocks works' }),
  ).toBeVisible()
  await expect.element(
    screen.getByText(
      'Draft one stock from each of three candidate groups.',
    ),
  ).toBeVisible()
})

test('resets one game and announces success without touching other saves', async () => {
  window.location.hash = '#/'
  window.localStorage.setItem('open-trade:game:fanstocks', 'saved')
  window.localStorage.setItem('open-trade:game:founder-mode', 'keep')
  const screen = await render(<App />)

  await screen.getByRole('button', {
    name: 'Reset FanStocks progress',
  }).click()
  await screen.getByRole('button', {
    name: 'Confirm reset FanStocks',
  }).click()

  await expect.element(screen.getByText('FanStocks progress reset')).toBeVisible()
  expect(window.localStorage.getItem('open-trade:game:fanstocks')).toBeNull()
  expect(window.localStorage.getItem('open-trade:game:founder-mode')).toBe(
    'keep',
  )
})
~~~

- [ ] **Step 3: Run progress and hub tests and verify both are red**

Run:

~~~powershell
npm run test:unit -- src/app/routes/progressStore.unit.test.ts
npm run test:browser -- src/app/hub/HubPage.browser.test.tsx
~~~

Expected: FAIL because <code>progressStore.ts</code> and <code>HubPage.tsx</code> do not exist.

- [ ] **Step 4: Implement the versioned derived-progress store**

Create <code>src/app/routes/progressStore.ts</code>:

~~~ts
import {
  createGameStore,
  type GameSaveCodec,
  type StorageLike,
} from '../../shared/persistence/gameStore'
import type { GameId, GameProgressBadge } from './types'

type ProgressState = Readonly<Record<GameId, GameProgressBadge>>

export const DEFAULT_PROGRESS: ProgressState = Object.freeze({
  fanstocks: {
    label: 'League',
    value: 'No active league',
    tone: 'neutral',
  },
  'founder-mode': {
    label: 'Founder streak',
    value: '0 days',
    tone: 'neutral',
  },
  'wallstreet-surfers': {
    label: 'Best score',
    value: '0',
    tone: 'neutral',
  },
})

const PROGRESS_EVENT = 'open-trade:progress-changed'
const PROGRESS_SAVE_KEY = 'open-trade:hub-progress'
const TONES = new Set(['neutral', 'positive', 'warning'])

function isBadge(value: unknown): value is GameProgressBadge {
  return (
    typeof value === 'object' &&
    value !== null &&
    'label' in value &&
    typeof value.label === 'string' &&
    'value' in value &&
    typeof value.value === 'string' &&
    'tone' in value &&
    typeof value.tone === 'string' &&
    TONES.has(value.tone)
  )
}

const progressCodec: GameSaveCodec<ProgressState> = {
  key: PROGRESS_SAVE_KEY,
  version: 1,
  encode: (value) => value,
  decode: (value) => {
    if (
      typeof value === 'object' &&
      value !== null &&
      'fanstocks' in value &&
      isBadge(value.fanstocks) &&
      'founder-mode' in value &&
      isBadge(value['founder-mode']) &&
      'wallstreet-surfers' in value &&
      isBadge(value['wallstreet-surfers'])
    ) {
      return {
        ok: true,
        value: {
          fanstocks: value.fanstocks,
          'founder-mode': value['founder-mode'],
          'wallstreet-surfers': value['wallstreet-surfers'],
        },
      }
    }
    return { ok: false, reason: 'Hub progress fields are invalid' }
  },
}

export interface ProgressStore {
  read(id: GameId): GameProgressBadge
  readAll(): ProgressState
  set(id: GameId, badge: GameProgressBadge): void
  reset(id: GameId): void
  resetAll(): void
}

export function createProgressStore(
  storage?: StorageLike,
): ProgressStore {
  const store =
    storage === undefined
      ? createGameStore(progressCodec)
      : createGameStore(progressCodec, { storage })

  const readAll = (): ProgressState => {
    const result = store.load()
    if (result.status !== 'ready') {
      return {
        fanstocks: { ...DEFAULT_PROGRESS.fanstocks },
        'founder-mode': { ...DEFAULT_PROGRESS['founder-mode'] },
        'wallstreet-surfers': {
          ...DEFAULT_PROGRESS['wallstreet-surfers'],
        },
      }
    }
    return result.value
  }

  return {
    read: (id) => readAll()[id],
    readAll,
    set(id, badge) {
      store.save({ ...readAll(), [id]: badge })
    },
    reset(id) {
      store.save({ ...readAll(), [id]: DEFAULT_PROGRESS[id] })
    },
    resetAll() {
      store.save({
        fanstocks: { ...DEFAULT_PROGRESS.fanstocks },
        'founder-mode': { ...DEFAULT_PROGRESS['founder-mode'] },
        'wallstreet-surfers': {
          ...DEFAULT_PROGRESS['wallstreet-surfers'],
        },
      })
    },
  }
}

const browserProgressStore = createProgressStore()

function announceProgressChange(): void {
  window.dispatchEvent(new Event(PROGRESS_EVENT))
}

export function readGameProgress(id: GameId): GameProgressBadge {
  return browserProgressStore.read(id)
}

export function setGameProgress(
  id: GameId,
  badge: GameProgressBadge,
): void {
  browserProgressStore.set(id, badge)
  announceProgressChange()
}

export function resetGameProgress(id: GameId): void {
  browserProgressStore.reset(id)
  announceProgressChange()
}

export function resetAllGameProgress(): void {
  browserProgressStore.resetAll()
  announceProgressChange()
}

export function subscribeToGameProgress(listener: () => void): () => void {
  window.addEventListener(PROGRESS_EVENT, listener)
  return () => window.removeEventListener(PROGRESS_EVENT, listener)
}
~~~

- [ ] **Step 5: Make each route reset and read its shared progress badge**

In each of the three <code>src/games/*/route.tsx</code> files, import:

~~~ts
import {
  readGameProgress,
  resetGameProgress,
} from '../../app/routes/progressStore'
~~~

Replace FanStocks <code>reset</code> and <code>getProgressBadge</code> with:

~~~ts
  reset: () => {
    clearStoredGame(SAVE_KEY)
    resetGameProgress('fanstocks')
  },
  getProgressBadge: () => readGameProgress('fanstocks'),
~~~

Replace Founder Mode <code>reset</code> and <code>getProgressBadge</code> with:

~~~ts
  reset: () => {
    clearStoredGame(SAVE_KEY)
    resetGameProgress('founder-mode')
  },
  getProgressBadge: () => readGameProgress('founder-mode'),
~~~

Replace Wallstreet Surfers <code>reset</code> and <code>getProgressBadge</code> with:

~~~ts
  reset: () => {
    clearStoredGame(SAVE_KEY)
    resetGameProgress('wallstreet-surfers')
  },
  getProgressBadge: () => readGameProgress('wallstreet-surfers'),
~~~

- [ ] **Step 6: Implement the responsive game card**

Create <code>src/app/hub/GameCard.tsx</code>:

~~~tsx
import { Link } from 'react-router-dom'
import type {
  GameProgressBadge,
  GameRouteMetadata,
} from '../routes/types'
import { Button } from '../../shared/ui'

export interface GameCardProps {
  readonly metadata: GameRouteMetadata
  readonly badge: GameProgressBadge
  readonly onHowItWorks: () => void
  readonly onReset: () => void
}

export function GameCard({
  metadata,
  badge,
  onHowItWorks,
  onReset,
}: GameCardProps) {
  return (
    <article className={'game-card game-card--' + metadata.accent}>
      <div
        className="game-card__cover"
        role="img"
        aria-label={metadata.coverLabel}
      >
        <span aria-hidden="true">{metadata.title.slice(0, 2)}</span>
      </div>
      <div className="game-card__body">
        <p className="game-card__eyebrow">{metadata.eyebrow}</p>
        <h2>{metadata.title}</h2>
        <p className="game-card__tagline">{metadata.tagline}</p>
        <p>{metadata.description}</p>
        <p
          className={'game-card__badge game-card__badge--' + badge.tone}
          aria-label={badge.label + ': ' + badge.value}
        >
          <span>{badge.label}</span>
          <strong>{badge.value}</strong>
        </p>
        <div className="game-card__actions">
          <Link className="ui-button ui-button--primary" to={metadata.path}>
            Play {metadata.title}
          </Link>
          <Button variant="secondary" onClick={onHowItWorks}>
            How {metadata.title} works
          </Button>
          <Button variant="secondary" onClick={onReset}>
            Reset {metadata.title} progress
          </Button>
        </div>
      </div>
    </article>
  )
}
~~~

- [ ] **Step 7: Implement hub dialogs, reset behavior, progress refresh, and copy**

Create <code>src/app/hub/HubPage.tsx</code>:

~~~tsx
import { useEffect, useState } from 'react'
import { APP_DISCLAIMER } from '../appMeta'
import {
  readGameProgress,
  subscribeToGameProgress,
} from '../routes/progressStore'
import { GAME_ROUTES } from '../routes/registry'
import type {
  GameId,
  GameRouteRegistration,
} from '../routes/types'
import { Button, Dialog, useToasts } from '../../shared/ui'
import { GameCard } from './GameCard'

export function HubPage() {
  const [howRoute, setHowRoute] =
    useState<GameRouteRegistration | null>(null)
  const [resetRoute, setResetRoute] =
    useState<GameRouteRegistration | null>(null)
  const [, refreshProgress] = useState(0)
  const { addToast } = useToasts()

  useEffect(
    () =>
      subscribeToGameProgress(() => {
        refreshProgress((value) => value + 1)
      }),
    [],
  )

  const confirmReset = async () => {
    if (resetRoute === null) {
      return
    }
    const module = await resetRoute.load()
    module.gameRoute.reset()
    addToast(resetRoute.metadata.title + ' progress reset', 'success')
    setResetRoute(null)
  }

  return (
    <section className="hub" aria-labelledby="hub-title">
      <div className="hub__hero">
        <p className="hub__eyebrow">Three original simulated markets</p>
        <h1 id="hub-title">Choose your market</h1>
        <p className="hub__lede">
          Draft a portfolio, rewrite a founder decision, or run the market.
          Every result is deterministic, replayable, and entirely fictional.
        </p>
        <p className="hub__disclaimer">{APP_DISCLAIMER}</p>
      </div>

      <div className="hub__grid" aria-label="OpenTrade games">
        {GAME_ROUTES.map((route) => (
          <GameCard
            key={route.metadata.id}
            metadata={route.metadata}
            badge={readGameProgress(route.metadata.id)}
            onHowItWorks={() => setHowRoute(route)}
            onReset={() => setResetRoute(route)}
          />
        ))}
      </div>

      <Dialog
        open={howRoute !== null}
        onClose={() => setHowRoute(null)}
        title={
          howRoute === null
            ? 'How the game works'
            : 'How ' + howRoute.metadata.title + ' works'
        }
        description={
          howRoute === null ? undefined : howRoute.metadata.description
        }
      >
        {howRoute === null ? null : (
          <ol className="hub__rules">
            {howRoute.metadata.howItWorks.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        )}
      </Dialog>

      <Dialog
        open={resetRoute !== null}
        onClose={() => setResetRoute(null)}
        title={
          resetRoute === null
            ? 'Reset progress'
            : 'Reset ' + resetRoute.metadata.title + ' progress'
        }
        description="This removes only this game save from this browser."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setResetRoute(null)}
            >
              Keep progress
            </Button>
            <Button
              variant="danger"
              onClick={() => void confirmReset()}
              aria-label={
                resetRoute === null
                  ? 'Confirm reset'
                  : 'Confirm reset ' + resetRoute.metadata.title
              }
            >
              Reset progress
            </Button>
          </>
        }
      />
    </section>
  )
}
~~~

- [ ] **Step 8: Add the complete responsive hub styling**

Create <code>src/app/hub/hub.css</code>:

~~~css
.hub__hero {
  display: grid;
  max-width: 58rem;
  gap: var(--space-3);
  margin-bottom: var(--space-7);
}

.hub__eyebrow,
.game-card__eyebrow {
  margin-bottom: 0;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.hub h1 {
  max-width: 11ch;
  margin-bottom: 0;
  font-family: var(--font-display);
  font-size: clamp(3rem, 10vw, 7.5rem);
  line-height: 0.88;
  letter-spacing: -0.055em;
}

.hub__lede {
  max-width: 48rem;
  margin-bottom: 0;
  color: var(--color-ink-muted);
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  line-height: 1.55;
}

.hub__disclaimer {
  width: fit-content;
  margin-bottom: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-ink);
  border-radius: 999px;
  background: var(--color-paper);
  font-size: 0.82rem;
  font-weight: 850;
}

.hub__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
}

.game-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 2px solid var(--color-ink);
  border-radius: var(--radius-lg);
  background: var(--color-paper);
  box-shadow: var(--shadow-card);
}

.game-card__cover {
  display: grid;
  min-height: 14rem;
  place-items: center;
  overflow: hidden;
  border-bottom: 2px solid var(--color-ink);
  background:
    repeating-linear-gradient(
      -12deg,
      transparent 0 1rem,
      rgb(255 255 255 / 0.24) 1rem 1.1rem
    ),
    var(--cover-color);
}

.game-card__cover span {
  transform: rotate(-8deg);
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: clamp(5rem, 10vw, 8rem);
  font-weight: 900;
  letter-spacing: -0.12em;
}

.game-card--yellow {
  --cover-color: var(--color-market-yellow);
}

.game-card--green {
  --cover-color: #7ec9a2;
}

.game-card--red {
  --cover-color: #ec7c6f;
}

.game-card__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  padding: var(--space-5);
}

.game-card h2 {
  margin-block: var(--space-2);
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 0.95;
}

.game-card__tagline {
  margin-bottom: var(--space-3);
  font-size: 1.05rem;
  font-weight: 900;
}

.game-card__badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: auto;
  padding: var(--space-3);
  border: 1px solid var(--color-ink);
  border-left-width: 0.6rem;
  border-radius: var(--radius-sm);
  background: #fff;
}

.game-card__badge--neutral {
  border-left-color: var(--color-line);
}

.game-card__badge--positive {
  border-left-color: var(--color-gain-green);
}

.game-card__badge--warning {
  border-left-color: var(--color-signal-red);
}

.game-card__actions {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.game-card__actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  text-decoration: none;
}

.hub__rules {
  display: grid;
  gap: var(--space-3);
  padding-left: 1.5rem;
}

.hub__rules li {
  padding-left: var(--space-2);
  line-height: 1.55;
}

@media (max-width: 1023px) {
  .hub__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .game-card:last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 767px) {
  .hub__hero {
    margin-bottom: var(--space-6);
  }

  .hub__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .game-card:last-child {
    grid-column: auto;
  }

  .game-card__cover {
    min-height: 11rem;
  }
}

@media (max-width: 374px) {
  .game-card__body {
    padding: var(--space-4);
  }

  .hub__disclaimer {
    border-radius: var(--radius-sm);
  }
}
~~~

Replace the index route import and element in <code>src/app/routes/AppRouter.tsx</code>:

~~~tsx
import { HubPage } from '../hub/HubPage'
~~~

~~~tsx
<Route index element={<HubPage />} />
~~~

Delete <code>src/app/hub/HubFoundationPage.tsx</code>.

Add the hub stylesheet import to <code>src/main.tsx</code>:

~~~tsx
import './app/hub/hub.css'
~~~

- [ ] **Step 9: Run hub tests, routing regressions, and build checks**

Run:

~~~powershell
npm run test:unit -- src/app/routes/progressStore.unit.test.ts
npm run test:browser -- src/app/hub/HubPage.browser.test.tsx src/app/routes/routes.browser.test.tsx
npm run check
~~~

Expected: three progress tests, two hub tests, and two route tests pass. Lint and strict typecheck report no errors, and the production build retains separate lazy route chunks.

- [ ] **Step 10: Commit the complete hub subsystem**

~~~powershell
git add src/app/routes/progressStore.ts src/app/routes/progressStore.unit.test.ts src/app/routes/AppRouter.tsx src/app/hub src/games src/main.tsx
git commit -m "feat: build responsive OpenTrade game hub"
~~~

### Task 8: Add production-build E2E coverage, CI, and GitHub Pages deployment

**Files:**

- Create: <code>playwright.config.ts</code>
- Create: <code>tests/e2e/hub.spec.ts</code>
- Create: <code>.github/workflows/ci.yml</code>
- Create: <code>.github/workflows/pages.yml</code>
- Modify: <code>tsconfig.node.json</code>

**Interfaces:**

- Consumes: production output at <code>/Open-Trade/</code>.
- Verifies: hash navigation, dialogs, settings persistence, game-only reset, focus, 44px controls, and no horizontal overflow at 320, 375, 768, 1024, and 1440 CSS pixels.
- CI gates: lint, strict typecheck, unit tests, Chromium component tests, production build, and Chromium E2E.
- Deployment occurs only from <code>main</code> or manual dispatch and uploads <code>dist/</code> through GitHub Pages Actions.

- [ ] **Step 1: Write the Playwright production-server configuration**

Create <code>playwright.config.ts</code>:

~~~ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://127.0.0.1:4173/Open-Trade/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'chromium-touch',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 720 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command:
      'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/Open-Trade/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
~~~

- [ ] **Step 2: Write E2E tests against the production build**

Create <code>tests/e2e/hub.spec.ts</code>:

~~~ts
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/Open-Trade/#/')
})

test('navigates through a lazy hash route and restores hub focus', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Play FanStocks' }).click()
  await expect(page).toHaveURL(/#\/fanstocks$/)
  await expect(
    page.getByRole('heading', { name: 'FanStocks', level: 1 }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Back to all games' }).click()
  await expect(
    page.getByRole('heading', { name: 'Choose your market', level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('main')).toBeFocused()
})

test('persists shared sound and reduced-motion settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('checkbox', { name: 'Sound' }).uncheck()
  await page.getByRole('checkbox', { name: 'Reduce motion' }).check()
  await page.getByRole('button', { name: 'Close Settings' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()

  await expect(page.getByRole('checkbox', { name: 'Sound' })).not.toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: 'Reduce motion' }),
  ).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute(
    'data-reduced-motion',
    'true',
  )
})

test('resets one game save and leaves another untouched', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('open-trade:game:fanstocks', 'remove')
    localStorage.setItem('open-trade:game:founder-mode', 'keep')
  })

  await page
    .getByRole('button', { name: 'Reset FanStocks progress' })
    .click()
  await page
    .getByRole('button', { name: 'Confirm reset FanStocks' })
    .click()

  await expect(page.getByText('FanStocks progress reset')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('open-trade:game:fanstocks'),
      ),
    )
    .toBeNull()
  expect(
    await page.evaluate(() =>
      localStorage.getItem('open-trade:game:founder-mode'),
    ),
  ).toBe('keep')
})

test('has no horizontal overflow and preserves 44px controls', async ({
  page,
}) => {
  const viewports = [
    { width: 320, height: 720 },
    { width: 375, height: 720 },
    { width: 768, height: 900 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/Open-Trade/#/')

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    const sizes = await page
      .locator('button, a.ui-button')
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().height),
      )
    expect(sizes.every((height) => height >= 44)).toBe(true)
  }
})

test('supports keyboard-only access to settings and how-to content', async ({
  page,
}) => {
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()

  await page
    .getByRole('button', { name: 'How Founder Mode works' })
    .focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('dialog', { name: 'How Founder Mode works' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'How Founder Mode works' }),
  ).toBeFocused()
})
~~~

- [ ] **Step 3: Run E2E first and record any production-only failures**

Run:

~~~powershell
npm run test:e2e
~~~

Expected on the first run: tests start both Chromium projects against <code>dist/</code>. If a failure exposes a real base-path, focus, or sizing defect, fix that defect in the owning file and rerun the exact failed test with <code>npx playwright test tests/e2e/hub.spec.ts --project=chromium-desktop</code>. Do not weaken assertions or add arbitrary waits.

- [ ] **Step 4: Add pull-request and branch CI**

Create <code>.github/workflows/ci.yml</code>:

~~~yaml
name: CI

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7
      - name: Use Node 24
        uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Install Chromium
        run: npx playwright install --with-deps chromium
      - name: Run lint, typecheck, unit, browser, and build gates
        run: npm run check
      - name: Run production E2E
        run: npm run test:e2e
~~~

- [ ] **Step 5: Add the gated GitHub Pages workflow**

Create <code>.github/workflows/pages.yml</code>:

~~~yaml
name: Deploy GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  verify-and-deploy:
    environment:
      name: github-pages
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7
      - name: Use Node 24
        uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Install Chromium
        run: npx playwright install --with-deps chromium
      - name: Run quality gates
        run: npm run check
      - name: Run production E2E
        run: npm run test:e2e
      - name: Configure Pages
        uses: actions/configure-pages@v6
      - name: Upload production site
        uses: actions/upload-pages-artifact@v5
        with:
          path: dist
      - name: Deploy production site
        uses: actions/deploy-pages@v5
~~~

- [ ] **Step 6: Confirm TypeScript covers Playwright configuration**

Ensure <code>tsconfig.node.json</code> contains:

~~~json
{
  "include": [
    "vite.config.ts",
    "vitest.config.ts",
    "vitest.browser.config.ts",
    "playwright.config.ts"
  ]
}
~~~

Run:

~~~powershell
npm run check
npm run test:e2e
git diff --check
~~~

Expected: lint, strict typecheck, all unit and browser tests, production build, ten Playwright project/test combinations, and whitespace validation pass with zero errors.

- [ ] **Step 7: Commit automation and deployment**

~~~powershell
git add playwright.config.ts tests/e2e/hub.spec.ts .github/workflows/ci.yml .github/workflows/pages.yml tsconfig.node.json
git commit -m "ci: verify and deploy the OpenTrade hub"
~~~

- [ ] **Step 8: Enable Pages and smoke the deployed base path**

In GitHub repository settings, set Pages source to <code>GitHub Actions</code>. Run the <code>Deploy GitHub Pages</code> workflow from <code>main</code>, then open <code>https://frenzy2004.github.io/Open-Trade/</code>.

Expected: the hub loads without a network 404 or console error; all three Play links use hash URLs below <code>/Open-Trade/</code>; refreshing a game route returns the application; settings persist after reload; and returning from a game focuses the main region.

## Plan Completion Criteria

- <code>npm run check</code> exits 0.
- <code>npm run test:e2e</code> passes in desktop and touch Chromium projects.
- <code>git diff --check</code> exits 0.
- The production build contains a small eager hub chunk plus three lazy route chunks.
- No game imports another game, and no game engine or Phaser dependency is installed.
- The exact shared contracts named in this plan compile and are available to FanStocks, Founder Mode, and Wallstreet Surfers plans.
- The hub has visible Play, How it works, Reset progress, sound, reduced-motion, disclaimer, and progress affordances.
- The deployed Pages URL works at the repository base path with hash-route refresh safety.
