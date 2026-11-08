# opencode-usage-meter (free-plan + Turkish edition)

**Fork of [olcanaskar/opencode-usage-meter](https://github.com/olcanaskar/opencode-usage-meter)** — a quota indicator
for [OpenCode](https://opencode.ai) Desktop that sits in the session header next to the context window ring.

This fork adds:

1. **Free-plan support** — on a free OpenCode account the original renders nothing. Here the chip still shows
   your *today* usage (requests · tokens) so you are no longer blind while deciding whether Go is worth it.
2. **Turkish interface** — strings follow OpenCode's UI language: English and Turkish are bundled.
3. **Git-install fix** — the `prepare` script was removed, so `opencode plugin add github:...` no longer needs
   a build toolchain. `dist/gui-experimental.cjs` is committed and ships pre-built.

Everything else is the original plugin, kept intact. Original author: **Olcan Askar** (MIT).

```
 5sa 85%   7g 89%   30g 95%  ▾
```

## Install

```sh
opencode plugin add github:halitartuc/opencode-usage-meter
```

No build runs during install; the desktop app reloads the plugin in every window when the bundle changes.

## What the popup shows

| Line | Meaning |
| --- | --- |
| `5-hour / Weekly / Monthly` | Remaining percentage of each Go allowance window, with a bar and the time until it resets |
| `Monthly budget` | Any Console member budget (`spent / limit`), only when one exists |
| `Today` | Today's requests (model steps), total tokens, input/output and cache reads, prompts and sessions |

Values are colour coded: green under 70% used, amber from 70%, red from 90%.
On a free plan the Go rows stay silent and the chip header reads `Free plan`; with no Console session
at all it renders nothing; if the request fails it shows a small `kota ?` label whose tooltip carries the error.

## Where the numbers come from

Nothing is scraped and nothing is guessed — the local OpenCode server already exposes this data:

```sh
opencode api get /api/experimental/usage/limits
```

```json
{
  "workspace": { "id": "wrk_...", "name": "Default", "usageURL": "https://opencode.ai/console/..." },
  "go": {
    "rolling": { "percent": 14, "limited": false, "resetsAt": 1793366176000 },
    "weekly":  { "percent": 10, "limited": false, "resetsAt": 1793577600000 },
    "monthly": { "percent": 5,  "limited": false, "resetsAt": 1795953708000 }
  },
  "budgets": []
}
```

- `rolling` is the 5-hour window (20% of the monthly allowance on Go), `weekly` 50% and `monthly` 100%.
- `percent` is the **used** percentage; the meter renders `100 - percent`.
- The daily block comes from `GET /api/experimental/session/stats`, the same source as `opencode stats --days 0`.
  Total tokens follow the same accounting: `input + output + reasoning + cache read + cache write`.

The meter refreshes every 60 seconds, and never while the popup is closed (the daily block is only fetched on open).

## Development

```sh
git clone https://github.com/halitartuc/opencode-usage-meter
cd opencode-usage-meter
npm install
npm run watch   # rebuilds on save; the desktop app reloads the plugin each time
```

| File | Purpose |
| --- | --- |
| `src/index.ts` | Server part. Gives the plugin its `usage-meter` id; does no work. |
| `src/gui.tsx` | Window part. Renders into the `session.header` slot. |
| `src/i18n.ts` | String catalog per locale (adds a language = ~30 translated values, no code change). |
| `vite.config.ts` | Builds one CommonJS bundle with the `@opencode/plugin/gui/vite` preset. |
| `dist/gui-experimental.cjs` | Committed build output that the app loads. |

The GUI plugin API offers four slots: `window.bottom`, `session.header`, `session.location.menu`,
`session.panel.end`. Change the name at the bottom of `src/gui.tsx` and rebuild.

## Notes and limitations

- The GUI plugin API is experimental (`./gui-experimental`); `Plugin`, `Slot` and `usePlugin` may change
  between OpenCode releases. Built against OpenCode 2.2.1 / `@opencode/plugin` 2.2.1, tested on 2.2.6.
- Only OpenCode Desktop loads `./gui-experimental`. The TUI reads plugins from `cli.json` (not shipped here).
- Local free-plan usage cannot be turned into a remaining-percentage of a hard limit: OpenCode does not
  expose free-tier quota numbers locally (limits surface only as reactive `FreeUsageLimitError` 429s), so
  the free chip shows honest local usage counts instead.
- Interface strings follow OpenCode's UI language; English and Turkish are bundled. Requests spin up no
  extra refresh keys.

## Türkçe (TR)

**Türkçe sürüm notu:** Bu depo, [*olcanaskar'ın*](https://github.com/olcanaskar/opencode-usage-meter)
`opencode-usage-meter` eklentisinin forkudur ve üç ek özellik taşır: ücretsiz planda da ekran üstü rozet
(`Ücretsiz plan · N istek · N token`), OpenCode arayüz diline uyumlu **Türkçe metinler** ve `prepare`
betiğinin kaldırılması sayesinde **sorunsuz `plugin add github:...` kurulumu**.

Kurulum:

```sh
opencode plugin add github:halitartuc/opencode-usage-meter
```

Rozet oturum başlığında durur; tıklayınca `5 saatlik / Haftalık / Aylık` pencere satırları (%X kaldı +
sıfırlama sayacı), `Aylık bütçe` ve `Bugün · N istek · N token` bloğu açılır. Renkler: <70% yeşil,
70+ sarı, 90+ kırmızı. Ücretsiz planda Go satırları sessiz kalır, rozet `Ücretsiz plan` başlığını taşır;
oluşan hatalarda `kota ?` etiketi gösterilir. Konsoldaki kesin dolar rakamları için `Konsolu aç ↗`.

## License

[MIT](LICENSE) — © Olcan Askar (original)
