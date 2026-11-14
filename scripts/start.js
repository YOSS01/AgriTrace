// ONE COMMAND DEMO:  npm start
// 1) starts a local blockchain (Hardhat node)   2) compiles + deploys the contract
// 3) registers the actors                       4) serves the web interface (Next.js)
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ethers } = require("ethers");
const { deploy } = require("./deploy");

const ROOT = path.join(__dirname, "..");
const WEB_PORT = 3000;
const RPC_PORT = 8545;
const RPC_URL = `http://127.0.0.1:${RPC_PORT}`;

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return "localhost";
}

async function waitForRpc(provider) {
  for (let i = 0; i < 60; i++) {
    try { await provider.getBlockNumber(); return; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  throw new Error("The local blockchain did not start");
}

// Runs the Next.js command line (build or start) and resolves when it exits / is ready.
const nextCli = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

function buildWeb() {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [nextCli, "build"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("The web interface could not be built"))));
  });
}

function startWeb() {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [nextCli, "start", "-H", "0.0.0.0", "-p", String(WEB_PORT)], { cwd: ROOT, env: { ...process.env, PORT: String(WEB_PORT) }, stdio: ["ignore", "pipe", "inherit"] });
    p.stdout.on("data", (d) => { if (String(d).includes("Ready")) resolve(p); });
    p.on("exit", (code) => reject(new Error("The web interface stopped (is port " + WEB_PORT + " already used?)")));
  });
}

async function main() {
  console.log("1/3  Starting the local blockchain...");
  const hardhatCli = path.join(ROOT, "node_modules", "hardhat", "internal", "cli", "cli.js");
  const node = spawn(process.execPath, [hardhatCli, "node", "--port", String(RPC_PORT)], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  let web = null;
  const stop = (code = 0) => { try { node.kill(); } catch {} try { web && web.kill(); } catch {} process.exit(code); };
  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
  node.on("exit", (code) => { if (code) { console.error("The blockchain node stopped (is port 8545 already used?)"); process.exit(1); } });

  const provider = new ethers.JsonRpcProvider(RPC_URL, 31337, { staticNetwork: true });
  await waitForRpc(provider);

  console.log("2/3  Compiling and deploying the AgriTrace smart contract...");
  const info = await deploy(provider);
  console.log("     Contract address:", info.address);
  info.actors.forEach((a) => console.log(`     ${a.roleLabel.padEnd(15)} ${a.name.padEnd(22)} ${a.address}`));

  if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    console.log("     First start: building the web interface (about one minute)...");
    await buildWeb();
  }
  console.log("3/3  Starting the web interface (Next.js)...");
  const lanUrl = `http://${lanAddress()}:${WEB_PORT}`;
  try { web = await startWeb(); } catch (e) { console.error(e.message); stop(1); }

  console.log("\n==============================================================");
  console.log("  AgriTrace is ready.");
  console.log(`  On this laptop : http://localhost:${WEB_PORT}`);
  console.log(`  On a phone (same Wi-Fi), QR codes point to : ${lanUrl}`);
  console.log("  Press Ctrl + C to stop. Every restart begins with an empty blockchain.");
  console.log("==============================================================\n");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
