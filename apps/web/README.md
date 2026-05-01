# @aisecretary/web

React 19 + Vite 6 + Tailwind + shadcn-ready scaffold for the AI Secretary
web client. Storybook 8 attached for component development.

## Scripts

| script | purpose |
|---|---|
| `pnpm dev` | Vite dev server on `http://localhost:5173` |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | Biome (inherits root config) |
| `pnpm test` | Vitest |
| `pnpm storybook` | Storybook on `http://localhost:6006` |
| `pnpm build-storybook` | Static Storybook build |

## Environment variables

Copy `.env.example` to `.env.local` and adjust as needed:

| var | purpose |
|---|---|
| `VITE_API_URL` | Base URL for the AI Secretary API (auth, recordings, …). Defaults to `http://localhost:3001`. |

## Design tokens

Theme/density/motion variables, Tailwind theme extension, and CSS globals
all come from `@aisecretary/design-tokens`. Before first run:

```bash
pnpm install
pnpm --filter @aisecretary/design-tokens build
pnpm --filter @aisecretary/web dev
```

See `_bmad-output/planning-artifacts/arch-addendums.md` § 1 for the full
token build contract.
