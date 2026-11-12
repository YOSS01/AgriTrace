// Compiles contracts/AgriTrace.sol with the JavaScript Solidity compiler (no download needed).
// Result: build/AgriTrace.json  { abi, bytecode }
const fs = require("fs");
const path = require("path");
const solc = require("solc");

function compile() {
  const file = path.join(__dirname, "..", "contracts", "AgriTrace.sol");
  const input = {
    language: "Solidity",
    sources: { "AgriTrace.sol": { content: fs.readFileSync(file, "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length) {
    errors.forEach((e) => console.error(e.formattedMessage));
    throw new Error("Compilation failed");
  }
  const c = output.contracts["AgriTrace.sol"].AgriTrace;
  const artifact = { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
  const outDir = path.join(__dirname, "..", "build");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "AgriTrace.json"), JSON.stringify(artifact, null, 2));
  return artifact;
}

module.exports = { compile };

if (require.main === module) {
  compile();
  console.log("Contract compiled -> build/AgriTrace.json");
}
