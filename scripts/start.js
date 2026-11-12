// ONE COMMAND DEMO:  npm start
// 1) starts a local blockchain (Hardhat node)   2) compiles + deploys the contract
// 3) registers the actors                       4) serves the web interface
const { spawn } = require("child_process");
const http = require("http");
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

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8" };

function startWebServer(lanUrl) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    // /rpc -> forwards JSON-RPC calls to the blockchain node (so a phone on the same Wi-Fi can read it too)
    if (url.pathname === "/rpc" && req.method === "POST") {
      const proxy = http.request(RPC_URL, { method: "POST", headers: { "content-type": "application/json" } }, (r) => {
        res.writeHead(r.statusCode, { "content-type": "application/json" });
        r.pipe(res);
      });
      proxy.on("error", () => { res.writeHead(502); res.end("{}"); });
      req.pipe(proxy);
      return;
    }
    if (url.pathname === "/config.json") {
      res.writeHead(200, { "content-type": MIME[".json"], "cache-control": "no-store" });
      res.end(JSON.stringify({ lanUrl }));
      return;
    }
    let file = path.normalize(path.join(ROOT, "frontend", url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname)));
    if (!file.startsWith(path.join(ROOT, "frontend")) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end("Not found"); return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(WEB_PORT, "0.0.0.0", () => resolve(server));
  });
}

async function main() {
  console.log("1/3  Starting the local blockchain...");
  const hardhatCli = path.join(ROOT, "node_modules", "hardhat", "internal", "cli", "cli.js");
  const node = spawn(process.execPath, [hardhatCli, "node", "--port", String(RPC_PORT)], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  const stop = () => { try { node.kill(); } catch {} process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  node.on("exit", (code) => { if (code) { console.error("The blockchain node stopped (is port 8545 already used?)"); process.exit(1); } });

  const provider = new ethers.JsonRpcProvider(RPC_URL, 31337, { staticNetwork: true });
  await waitForRpc(provider);

  console.log("2/3  Compiling and deploying the AgriTrace smart contract...");
  const info = await deploy(provider);
  console.log("     Contract address:", info.address);
  info.actors.forEach((a) => console.log(`     ${a.roleLabel.padEnd(15)} ${a.name.padEnd(22)} ${a.address}`));

  console.log("3/3  Starting the web interface...");
  const lanUrl = `http://${lanAddress()}:${WEB_PORT}`;
  await startWebServer(lanUrl);

  console.log("\n==============================================================");
  console.log("  AgriTrace is ready.");
  console.log(`  On this laptop : http://localhost:${WEB_PORT}`);
  console.log(`  On a phone (same Wi-Fi), QR codes point to : ${lanUrl}`);
  console.log("  Press Ctrl + C to stop. Every restart begins with an empty blockchain.");
  console.log("==============================================================\n");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
