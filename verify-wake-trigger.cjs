const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "obsidian") {
    return {
      Plugin: class Plugin {},
      Notice: class Notice {},
      normalizePath: (value) => value
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const plugin = require("./main.js");
const {
  buildWakeRequest,
  parseWakeEndpoint,
  validateCommandId,
  SYNCED_WAKE_CONFIG_PATHS
} = plugin.__test;

const id = "20260723123456789-acde1234";
assert.equal(validateCommandId(id), id);
assert.throws(() => validateCommandId("../not-a-command"), /Invalid JDB command id/);

const request = buildWakeRequest("https://ntfy.sh/jdb-0123456789abcdef", id);
assert.equal(request.method, "POST");
assert.equal(request.body, id);
assert.equal(request.headers["Content-Type"], "text/plain; charset=utf-8");
assert.equal(request.headers.Firebase, "no");
assert.equal(request.headers.Cache, undefined, "wake ids remain briefly replayable after reconnect");
assert.ok(!JSON.stringify(request).includes("instruction"), "wake event must not contain command content");

assert.equal(buildWakeRequest("", id), null, "unconfigured wake channel must be explicit");
assert.equal(
  parseWakeEndpoint("  https://ntfy.sh/jdb-0123456789abcdef/\n"),
  "https://ntfy.sh/jdb-0123456789abcdef",
  "a Vault-synced endpoint is normalized"
);
assert.equal(
  parseWakeEndpoint('{"endpoint":"https://ntfy.sh/jdb-fedcba9876543210/"}'),
  "https://ntfy.sh/jdb-fedcba9876543210",
  "the existing Vault-synced JSON config is supported"
);
assert.throws(
  () => parseWakeEndpoint("http://ntfy.sh/not-private"),
  /must use HTTPS/,
  "a synced endpoint must remain HTTPS-only"
);
assert.deepEqual(SYNCED_WAKE_CONFIG_PATHS, [
  "config/local.wake.json",
  "config/local.wake.md"
]);

process.stdout.write(JSON.stringify({
  passed: true,
  evidence: "wake request is id-only, replayable, and can use a private Vault-synced HTTPS endpoint"
}));
