# opencode-usage-meter

A quota indicator for [OpenCode](https://opencode.ai) Desktop. It sits in the session
header next to the context window ring and shows **how much of your OpenCode Go
allowance is left** for the 5-hour, weekly and monthly windows. Click it for details,
today's activity, and a link to the Console.

```
 5h 85%   7d 89%   30d 95%  ▾
```

## What the popup shows

| Line | Meaning |
| --- | --- |
| `5-hour / Weekly / Monthly` | Remaining percentage of each Go allowance window, with a bar and the time until it resets |
| `Monthly budget` | Any Console member budget (`spent / limit`), only when one exists |
| `Today` | Today's requests (model steps), total tokens, input/output and cache reads, prompts and sessions |

Values are colour coded: green under 70% used, amber from 70%, red from 90%.

## Where the numbers come from

Nothing is scraped and nothing is guessed — the local OpenCode server already exposes
this data:

```sh
opencode api get /api/experimental/usage/limits
```

```json
{
  "workspace": { "id": "org_...", "name": "Personal", "usageURL": "https://opencode.ai/console/..." },
  "go": {
    "rolling": { "percent": 14, "limited": false, "resetsAt": 1793366176000 },
    "weekly":  { "percent": 10, "limited": false, "resetsAt": 1793577600000 },
    "monthly": { "percent": 5,  "limited": false, "resetsAt": 1795953708000 }
  },
  "budgets": []
}
```

- `rolling` is the 5-hour window (20% of the monthly allowance on Go), `weekly` 50%
  and `monthly` 100%.
- `percent` is the **used** percentage; the meter renders `100 - percent`.
- The daily block comes from `GET /api/experimental/session/stats`, the same source as
  `opencode stats --days 0`. Total tokens follow the same accounting:
  `input + output + reasoning + cache read + cache write` — cached reads are tokens the
  model processed too and they dominate the number.

The meter refreshes every 60 seconds, and never while the popup is closed (the daily
block is only fetched on open). With no Console session it renders nothing at all; if
the request fails it shows a small `kota ?` label whose tooltip carries the error.

## Install

### From GitHub

```sh
opencode plugin add github:olcanaskar/opencode-usage-meter
```

This installs the package and adds it to your global `opencode.json`. The `prepare`
script builds the GUI bundle during install.

### From a local clone

```sh
git clone https://github.com/olcanaskar/opencode-usage-meter
cd opencode-usage-meter
npm install
```

Then point OpenCode at the directory:

```jsonc
// ~/.config/opencode/opencode.json
{
  "plugins": [{ "package": "C:\\Projects\\opencode-usage-meter" }]
}
```

`dist/gui-experimental.cjs` is committed, so a clone works without building. The
desktop app reloads the plugin in every window when that file changes.

## Development

```sh
npm install
npm run watch   # rebuilds on save; the app reloads the plugin each time
```

| File | Purpose |
| --- | --- |
| `src/index.ts` | Server part. Gives the plugin its `usage-meter` id; does no work. |
| `src/gui.tsx` | Window part. Renders into the `session.header` slot. |
| `vite.config.ts` | Builds one CommonJS bundle with the `@opencode/plugin/gui/vite` preset. |
| `dist/gui-experimental.cjs` | Committed build output that the app loads. |

## Moving it elsewhere on screen

The GUI plugin API offers four slots: `window.bottom`, `session.header`,
`session.location.menu`, `session.panel.end`. Change the name at the bottom of
`src/gui.tsx` and rebuild:

```ts
ctx.add(Slot, { at: "session.header", order: 10, render: () => <UsageMeter /> })
```

## Notes and limitations

- The GUI plugin API is experimental (`./gui-experimental`); `Plugin`, `Slot` and
  `usePlugin` may change between OpenCode releases. Built against OpenCode 2.2.1 and
  `@opencode/plugin` 2.2.1.
- Only OpenCode Desktop loads `./gui-experimental`. The TUI reads plugins from
  `cli.json` and would need a `./tui` part (not shipped yet).
- The Go allowance is dollar-denominated, but a dollar estimate cannot be reproduced
  from local data alone: peak-hours pricing and the real `opencode.allowance` value per
  request are not exposed locally. A token × price-list estimate was tried and removed
  because it drifted from the Console by 20–30 cents. Use **Open Console ↗** for the
  exact figure.
- Interface strings are English.

## License

[MIT](LICENSE)
