import { Plugin } from "@opencode/plugin"

/**
 * Server part of the usage meter.
 *
 * It exists so the plugin has a stable id ("usage-meter") and shows up in
 * Settings › Extensions › Plugins. All of the work happens in the GUI part,
 * which reads the quota from the OpenCode Console usage endpoint.
 */
export default Plugin.define({
  id: "usage-meter",
  setup() {},
})
