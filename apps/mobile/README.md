# @aisecretary/mobile

Expo SDK 52+ + Expo Router + NativeWind scaffold for the AI Secretary
mobile client. Storybook for React Native attached for on-device
component development.

## Scripts

| script | purpose |
|---|---|
| `pnpm start` | Expo dev server (choose target from CLI) |
| `pnpm ios` | Boot iOS simulator + dev client |
| `pnpm android` | Boot Android emulator + dev client |
| `pnpm web` | Expo web target (ad-hoc preview only — primary web target is `apps/web`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | Biome (inherits root config) |
| `pnpm test` | Vitest |
| `pnpm storybook` | Boots Expo with `STORYBOOK_ENABLED=true` so the Storybook UI mounts in-app |

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

| var | purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL for the AI Secretary API. On a real device, replace `localhost` with the dev machine's LAN IP. |

## Storybook

`@storybook/react-native` runs in-app on a real device/simulator. The
common pattern is to conditionally swap the root component when
`STORYBOOK_ENABLED=true`. The `storybook` script sets that env var; the
`expo-router/entry` shim picks it up and mounts `./.storybook/index.ts`
instead of `app/_layout.tsx`. (Wiring lands when Story 4.1 introduces
the first non-stub component.)

## Design tokens

NativeWind classes (`bg-bg`, `text-fg`, `bg-accent`, …) are powered by
`@aisecretary/design-tokens/build/tokens.tailwind.js`. Imperative
consumers (Animated, Reanimated worklets) read from
`@aisecretary/design-tokens/build/tokens.native` via `src/lib/tokens.ts`.
Before first run:

```bash
pnpm install
pnpm --filter @aisecretary/design-tokens build
pnpm --filter @aisecretary/mobile start
```

iOS background-audio entitlement and Android foreground-service
declaration are TODO and land with the recording-engine epic.
