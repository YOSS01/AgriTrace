// Backup: plays the whole demo scenario automatically (run it while "npm start" is running).
//   npm run scenario
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

async function main() {
  const info = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "frontend", "contract.json"), "utf8"));
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const as = async (i) => new ethers.Contract(info.address, info.abi, await provider.getSigner(i));
  const [farmer, coop, transporter, shop] = [await as(1), await as(2), await as(3), await as(4)];
  const addr = (i) => info.actors[i].address;
  const cert = fs.readFileSync(path.join(__dirname, "..", "docs", "certificat-bio-ferme-chtouka.txt"));
  const NONE = ethers.ZeroHash;
  const id = Number(await farmer.nextId());
  const run = async (label, tx) => { await (await tx).wait(); console.log("OK ", label); };

  await run("Farmer creates the batch", farmer.createBatch("Tomates cerises bio", 800, "Ferme Chtouka – parcelle B3", ethers.keccak256(cert)));
  await run("Farmer -> Cooperative", farmer.transfer(id, addr(2)));
  await run("Cooperative: quality check", coop.addStep(id, "Contrôle qualité", "Aït Melloul", "760 kg catégorie A", NONE));
  await run("Cooperative: packing", coop.addStep(id, "Emballage", "Aït Melloul", "1 520 barquettes de 500 g", NONE));
  await run("Cooperative -> Transporter", coop.transfer(id, addr(3)));
  await run("Transporter: departure", transporter.addStep(id, "Départ du transport", "Agadir", "Camion frigorifique, 4 à 8 °C", NONE));
  await run("Transporter: arrival", transporter.addStep(id, "Arrivée du transport", "Casablanca", "Chaîne du froid respectée", NONE));
  await run("Transporter -> Shop", transporter.transfer(id, addr(4)));
  await run("Shop: on the shelf", shop.addStep(id, "Mise en rayon", "Casablanca", "À consommer avant 7 jours", NONE));
  console.log(`\nBatch n° ${id} is complete. Open http://localhost:3000 and click on it.`);
}

main().catch((e) => { console.error(e.shortMessage || e.message); process.exit(1); });
