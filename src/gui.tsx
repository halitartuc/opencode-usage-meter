import { Plugin, Slot, usePlugin } from "@opencode/plugin/gui"
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js"

/**
 * Quota meter for the OpenCode Go plan.
 *
 * The numbers come from the local OpenCode server, not from a scrape of the
 * Console website: /api/experimental/usage/limits returns the rolling
 * (5-hour), weekly and monthly allowance of the signed-in Console workspace,
 * plus any member budgets. We poll it once a minute and render the remaining
 * percentage next to the context window ring in the session header.
 */

type Meter = { percent: number; limited: boolean; resetsAt: number }

type Budget = {
  id: string
  limit: number
  spent: number
  resetsAt: number
  coverage?: string
  scope?: string
}

type Limits = {
  workspace: { id: string; name?: string; usageURL: string }
  go?: { rolling: Meter; weekly: Meter; monthly: Meter }
  budgets: Budget[]
}

type Tokens = { input: number; output: number; reasoning: number; cache: { read: number; write: number } }

type Today = {
  sessions: number
  prompts: number
  steps: number
  tokens: Tokens
}

type Row = { key: string; label: string; meter: Meter }

const POLL_MS = 60_000

/** 1234 -> "1.2k", 346612480 -> "347M" */
function compact(value: number) {
  const abs = Math.abs(value)
  const trim = (text: string) => text.replace(/\.0$/, "")
  if (abs >= 1e9) return `${trim((value / 1e9).toFixed(1))}B`
  if (abs >= 1e6) return `${trim((value / 1e6).toFixed(1))}M`
  if (abs >= 1e3) return `${trim((value / 1e3).toFixed(1))}k`
  return String(Math.round(value))
}

const tone = (used: number) => (used >= 90 ? "#ef4444" : used >= 70 ? "#f5a623" : "#3fb950")

function remaining(percent: number) {
  return Math.max(0, Math.min(100, Math.round(100 - percent)))
}

function formatReset(ms: number) {
  const left = ms - Date.now()
  if (left <= 0) return "şimdi"
  const minutes = Math.floor(left / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days}g ${hours}s`
  if (hours > 0) return `${hours}s ${minutes % 60}dk`
  return `${Math.max(1, minutes)}dk`
}

function UsageMeter() {
  const ctx = usePlugin()
  const [limits, setLimits] = createSignal<Limits | null | undefined>(undefined)
  const [today, setToday] = createSignal<Today | null | undefined>(undefined)
  const [problem, setProblem] = createSignal<string | undefined>(undefined)
  const [open, setOpen] = createSignal(false)

  let wrapper: HTMLDivElement | undefined

  const load = async () => {
    try {
      // ctx.client is read on every call: it changes when the server restarts.
      const response = await ctx.client.experimental.usage.limits()
      setLimits(response.data ?? null)
      setProblem(undefined)
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause))
    }
  }

  // Today's activity, straight from the same source as `opencode stats`.
  const loadToday = async () => {
    try {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const stats = await ctx.client.experimental.session.stats({
        from: start.getTime(),
        to: Date.now(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        tools: "none",
      })
      setToday(stats)
    } catch {
      setToday(null)
    }
  }

  void load()
  const timer = setInterval(() => {
    void load()
    if (open()) void loadToday()
  }, POLL_MS)
  onCleanup(() => clearInterval(timer))

  const rows = createMemo<Row[]>(() => {
    const go = limits()?.go
    if (!go) return []
    return [
      { key: "5h", label: "5 saatlik", meter: go.rolling },
      { key: "7d", label: "Haftalık", meter: go.weekly },
      { key: "30d", label: "Aylık", meter: go.monthly },
    ]
  })

  const todayTotals = createMemo(() => {
    const stats = today()
    if (!stats) return undefined
    const { input, output, reasoning, cache } = stats.tokens
    // Same accounting as `opencode stats`: cached reads are tokens the model
    // processed too, and they dominate the number.
    return { total: input + output + reasoning + cache.read + cache.write, input, output, reasoning, cache }
  })

  const closeOnOutsideClick = (event: MouseEvent) => {
    if (wrapper && event.target instanceof Node && !wrapper.contains(event.target)) setOpen(false)
  }

  const toggle = () => {
    setOpen((current) => {
      const next = !current
      if (next) {
        void load()
        void loadToday()
        document.addEventListener("click", closeOnOutsideClick)
      } else {
        document.removeEventListener("click", closeOnOutsideClick)
      }
      return next
    })
  }

  onCleanup(() => document.removeEventListener("click", closeOnOutsideClick))

  return (
    <>
      <Show when={rows().length > 0}>
      <div ref={(element) => (wrapper = element)} style={{ position: "relative", display: "flex", "align-items": "center" }}>
        <button
          type="button"
          onClick={toggle}
          title="OpenCode Go kotası"
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            padding: "3px 8px",
            "border-radius": "999px",
            border: "1px solid rgba(127,127,127,0.25)",
            background: "rgba(127,127,127,0.10)",
            color: "inherit",
            cursor: "pointer",
            "font-size": "11px",
            "font-variant-numeric": "tabular-nums",
            "line-height": "1.2",
          }}
        >
          <For each={rows()}>
            {(row) => (
              <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <span style={{ opacity: 0.55 }}>{row.key}</span>
                <span style={{ "font-weight": 600, color: tone(row.meter.percent) }}>{remaining(row.meter.percent)}%</span>
              </span>
            )}
          </For>
          <span style={{ opacity: 0.4, "font-size": "9px" }}>{open() ? "▲" : "▼"}</span>
        </button>

        <Show when={open()}>
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: "0",
              "z-index": 50,
              width: "268px",
              padding: "10px 12px",
              "border-radius": "10px",
              border: "1px solid rgba(127,127,127,0.28)",
              background: "var(--background-base, rgba(24,24,27,0.98))",
              "box-shadow": "0 12px 32px rgba(0,0,0,0.35)",
              "font-size": "11px",
              color: "inherit",
              "font-variant-numeric": "tabular-nums",
            }}
          >
            <div style={{ display: "flex", "justify-content": "space-between", "margin-bottom": "8px" }}>
              <span style={{ "font-weight": 600 }}>OpenCode Go</span>
              <span style={{ opacity: 0.55 }}>{limits()?.workspace.name ?? "Personal"}</span>
            </div>

            <For each={rows()}>
              {(row) => (
                <div style={{ "margin-bottom": "8px" }}>
                  <div style={{ display: "flex", "justify-content": "space-between", "margin-bottom": "3px" }}>
                    <span style={{ opacity: 0.75 }}>{row.label}</span>
                    <span>
                      <span style={{ color: tone(row.meter.percent), "font-weight": 600 }}>{remaining(row.meter.percent)}% kaldı</span>
                      <span style={{ opacity: 0.45 }}> · {formatReset(row.meter.resetsAt)}</span>
                    </span>
                  </div>
                  <div style={{ height: "4px", "border-radius": "999px", background: "rgba(127,127,127,0.22)" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(0, row.meter.percent))}%`,
                        "border-radius": "999px",
                        background: tone(row.meter.percent),
                      }}
                    />
                  </div>
                </div>
              )}
            </For>

            <For each={limits()?.budgets ?? []}>
              {(budget) => (
                <div style={{ "margin-bottom": "8px" }}>
                  <div style={{ display: "flex", "justify-content": "space-between" }}>
                    <span style={{ opacity: 0.75 }}>Aylık bütçe</span>
                    <span>
                      ${budget.spent.toFixed(2)} / ${budget.limit.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ height: "4px", "border-radius": "999px", background: "rgba(127,127,127,0.22)", "margin-top": "3px" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${budget.limit > 0 ? Math.min(100, (budget.spent / budget.limit) * 100) : 0}%`,
                        "border-radius": "999px",
                        background: tone(budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0),
                      }}
                    />
                  </div>
                </div>
              )}
            </For>

            <Show when={todayTotals()}>
              <div
                style={{
                  "border-top": "1px solid rgba(127,127,127,0.18)",
                  "margin-top": "2px",
                  "padding-top": "8px",
                }}
              >
                <div style={{ display: "flex", "justify-content": "space-between", "margin-bottom": "3px" }}>
                  <span style={{ opacity: 0.75 }}>Bugün</span>
                  <span>
                    <span style={{ "font-weight": 600 }}>{compact(today()!.steps)}</span>
                    <span style={{ opacity: 0.45 }}> istek · </span>
                    <span
                      title="giriş + çıkış + reasoning + önbellek okuması"
                      style={{ "font-weight": 600, cursor: "help" }}
                    >
                      {compact(todayTotals()!.total)}
                    </span>
                    <span style={{ opacity: 0.45 }}> token</span>
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    "justify-content": "space-between",
                    "font-size": "10px",
                    opacity: 0.5,
                  }}
                >
                  <span>
                    giriş {compact(todayTotals()!.input)} · çıkış {compact(todayTotals()!.output)}
                  </span>
                  <span>cache {compact(todayTotals()!.cache.read)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    "justify-content": "space-between",
                    "font-size": "10px",
                    opacity: 0.5,
                    "margin-top": "2px",
                  }}
                >
                  <span>
                    {compact(today()!.prompts)} prompt · {compact(today()!.sessions)} oturum
                  </span>
                </div>
              </div>
            </Show>

            <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-top": "2px" }}>
              <button
                type="button"
                onClick={() => {
                  void load()
                  void loadToday()
                }}
                style={{ background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer", padding: 0, "font-size": "10px" }}
              >
                yenile
              </button>
              <button
                type="button"
                onClick={() => ctx.system.openExternal(limits()!.workspace.usageURL)}
                style={{ background: "none", border: "none", color: "inherit", opacity: 0.75, cursor: "pointer", padding: 0, "font-size": "10px" }}
              >
                Console'da aç ↗
              </button>
            </div>
          </div>
        </Show>
      </div>
      </Show>

      <Show when={!!problem() && rows().length === 0}>
        <span
          title={problem()}
          style={{
            "font-size": "11px",
            opacity: 0.45,
            cursor: "help",
            "font-variant-numeric": "tabular-nums",
          }}
        >
          kota ?
        </span>
      </Show>
    </>
  )
}

export default Plugin.define({
  setup(ctx) {
    ctx.add(Slot, {
      at: "session.header",
      order: 10,
      render: () => <UsageMeter />,
    })
  },
})
