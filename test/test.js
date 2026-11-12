// Automatic tests of the smart contract:  npm test
// They run on an in-memory blockchain (no need to start anything else).
const assert = require("assert");
const hre = require("hardhat");
const { ethers } = require("ethers");
const { compile } = require("../scripts/compile");

async function refused(promise, reason) {
  try { await promise; } catch (e) {
    const text = [e.reason, e.shortMessage, e.message].join(" ");
    assert.ok(text.includes(reason), `expected refusal ${reason}, got: ${text}`);
    return;
  }
  assert.fail(`expected the contract to refuse with ${reason}`);
}

async function main() {
  const provider = new ethers.BrowserProvider(hre.network.provider);
  const { abi, bytecode } = compile();
  const admin = await provider.getSigner(0);
  const c = await (await new ethers.ContractFactory(abi, bytecode, admin).deploy()).waitForDeployment();
  const signers = [];
  for (let i = 0; i < 6; i++) signers.push(await provider.getSigner(i));
  const [, farmer, coop, transporter, shop, stranger] = signers;
  const A = (s) => s.address;
  const NONE = ethers.ZeroHash;
  const cert = ethers.keccak256(ethers.toUtf8Bytes("certificat bio"));
  let n = 0;
  const ok = (label) => console.log(`  ok ${++n}  ${label}`);

  await (await c.registerActor(A(farmer), 1, "Ferme")).wait();
  await (await c.registerActor(A(coop), 2, "Coop")).wait();
  await (await c.registerActor(A(transporter), 3, "Transport")).wait();
  await (await c.registerActor(A(shop), 4, "Magasin")).wait();
  ok("admin registers the 4 actors");

  await refused(c.connect(farmer).registerActor(A(stranger), 1, "Faux"), "NOT_ADMIN");
  ok("a non-admin cannot register actors");

  await refused(c.connect(coop).createBatch("Tomates", 800, "Ferme", cert), "ONLY_FARMER");
  ok("only a farmer can create a batch");

  await (await c.connect(farmer).createBatch("Tomates", 800, "Ferme", cert)).wait();
  const b = await c.batches(1);
  assert.equal(b.currentOwner, A(farmer));
  assert.equal((await c.getHistory(1)).length, 1);
  ok("farmer creates batch n° 1 (history has 1 step)");

  await refused(c.connect(transporter).addStep(1, "Transport", "Agadir", "", NONE), "NOT_OWNER");
  ok("an actor who does not hold the batch cannot add a step");

  await refused(c.connect(farmer).transfer(1, A(stranger)), "UNKNOWN_ACTOR");
  ok("a batch cannot be transferred to an unregistered address");

  await (await c.connect(farmer).transfer(1, A(coop))).wait();
  assert.equal((await c.batches(1)).currentOwner, A(coop));
  await refused(c.connect(farmer).addStep(1, "Stockage", "", "", NONE), "NOT_OWNER");
  ok("after the transfer, the old owner loses the right to write");

  await (await c.connect(coop).addStep(1, "Emballage", "Agadir", "760 kg", NONE)).wait();
  const h = await c.getHistory(1);
  assert.equal(h.length, 3);
  assert.equal(h[0].docHash, cert);
  assert.equal(h[2].action, "Emballage");
  ok("history keeps every step in order, with the certificate fingerprint");

  await refused(c.getHistory(99), "UNKNOWN_BATCH");
  ok("an unknown batch is rejected");

  console.log(`\n${n} tests passed.`);
}

main().catch((e) => { console.error("\nTEST FAILED:", e.message); process.exit(1); });
