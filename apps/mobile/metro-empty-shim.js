/**
 * metro-empty-shim.js — empty CJS module used by metro.config.js to stub
 * Node-only packages (@opentelemetry/sdk-trace-node, exporter-zipkin,
 * async_hooks) out of the React Native bundle. Their call sites are guarded
 * behind isNodeRuntime()/appKind checks and never execute on native.
 */
module.exports = {};
