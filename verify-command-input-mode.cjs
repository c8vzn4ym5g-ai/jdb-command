const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");

const checks = {
  "voice control lives inside the command input": /commandInput[\s\S]*createDiv\(\{ cls: "jdb-command-voice-actions"/.test(source),
  "recording has an active visual state": /recordingStatus\.classList\.add\("is-recording"\)/.test(source),
  "recording shows elapsed time": /formatRecordingTime\(elapsedSeconds\)/.test(source),
  "recording timer is cleared": /clearRecordingTimer\(\)/.test(source),
  "active state has a red recording indicator": /\.jdb-command-recording-status\.is-recording::before/.test(styles),
  "stop control is prominent while recording": /\.jdb-command-stop-voice:not\(\[hidden\]\)/.test(styles)
};

const failed = Object.entries(checks).filter(([, passed]) => !passed);
console.log(JSON.stringify(checks, null, 2));
if (failed.length) {
  console.error(`Command input mode contract failed: ${failed.map(([name]) => name).join(", ")}`);
  process.exit(1);
}

