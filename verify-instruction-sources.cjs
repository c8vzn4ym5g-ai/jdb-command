const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");

const checks = {
  "instruction files have their own collection": /selectedInstructionFiles/.test(source),
  "instruction file picker is inside command input": /commandInput\.createEl\("input", \{ cls: "jdb-command-instruction-files"/.test(source),
  "voice recordings become instruction sources": /selectedInstructionFiles\.push\(\{ key, file \}\)/.test(source),
  "text is optional when an instruction file exists": /!command && !selectedInstructionFiles\.length/.test(source),
  "submit receives instruction sources separately": /this\.submit\(command, selectedInstructionFiles\.map/.test(source),
  "receipt records instruction source count": /instruction_source_count/.test(source),
  "note separates instruction sources from attachments": /## Instruction Sources/.test(source) && /## Attachments/.test(source)
};

const failed = Object.entries(checks).filter(([, passed]) => !passed);
console.log(JSON.stringify(checks, null, 2));
if (failed.length) {
  console.error(`Instruction source contract failed: ${failed.map(([name]) => name).join(", ")}`);
  process.exit(1);
}

