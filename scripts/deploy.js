// Deploys AgriTrace on the local blockchain and registers the actors of the supply chain.
// Result: frontend/contract.json  { address, abi, actors }
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { compile } = require("./compile");

// Account 0 of the local blockchain is the admin. Accounts 1-4 are the actors.
// Role numbers match the enum in the contract: 1 Farmer, 2 Cooperative, 3 Transporter, 4 Retailer.
const ACTORS = [
  { index: 1, role: 1, roleLabel: "Agriculteur", name: "Ferme Chtouka" },
  { index: 2, role: 2, roleLabel: "Coopérative", name: "Coopérative Souss" },
  { index: 3, role: 3, roleLabel: "Transporteur", name: "TransAtlas" },
  { index: 4, role: 4, roleLabel: "Magasin", name: "Marché Agadir" },
];

async function deploy(provider) {
  const { abi, bytecode } = compile();
  const admin = await provider.getSigner(0);
  const factory = new ethers.ContractFactory(abi, bytecode, admin);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  const actors = [{ index: 0, role: 0, roleLabel: "Administrateur", name: "Autorité de contrôle", address: await admin.getAddress() }];
  for (const a of ACTORS) {
    const signer = await provider.getSigner(a.index);
    const addr = await signer.getAddress();
    await (await contract.registerActor(addr, a.role, a.name)).wait();
    actors.push({ ...a, address: addr });
  }

  const info = { address, abi, actors };
  fs.writeFileSync(path.join(__dirname, "..", "frontend", "contract.json"), JSON.stringify(info, null, 2));
  return info;
}

module.exports = { deploy };

if (require.main === module) {
  deploy(new ethers.JsonRpcProvider("http://127.0.0.1:8545"))
    .then((i) => console.log("AgriTrace deployed at", i.address))
    .catch((e) => { console.error(e); process.exit(1); });
}
