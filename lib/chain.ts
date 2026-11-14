// Everything that talks to the blockchain lives in this file.
import { ethers } from "ethers";

export type Actor = { index: number; role: number; roleLabel: string; name: string; address: string };
export type ContractInfo = { address: string; abi: ethers.InterfaceAbi; actors: Actor[] };
export type Batch = { id: number; product: string; quantityKg: number; origin: string; currentOwner: string };
export type Step = { actor: string; action: string; location: string; details: string; docHash: string; timestamp: number };
export type LogEntry = { block: number; tx: string; event: string; detail: string };
export type Chain = { info: ContractInfo; lanUrl: string; provider: ethers.JsonRpcProvider; read: ethers.Contract };

export const ZERO_HASH = ethers.ZeroHash;

export async function connect(): Promise<Chain> {
  const info: ContractInfo = await (await fetch("/contract.json", { cache: "no-store" })).json();
  const lanUrl: string = await fetch("/api/config", { cache: "no-store" })
    .then((r) => r.json())
    .then((c) => c.lanUrl)
    .catch(() => window.location.origin);
  // All calls go through /rpc, which Next.js forwards to the local blockchain node.
  const provider = new ethers.JsonRpcProvider(window.location.origin + "/rpc", 31337, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 });
  const read = new ethers.Contract(info.address, info.abi, provider);
  return { info, lanUrl, provider, read };
}

export const shortAddress = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);

export function actorOf(chain: Chain, address: string) {
  return chain.info.actors.find((a) => a.address.toLowerCase() === address.toLowerCase());
}
export function actorLabel(chain: Chain, address: string) {
  const a = actorOf(chain, address);
  return a ? `${a.name} (${a.roleLabel})` : shortAddress(address);
}

export const formatDate = (ts: number) => new Date(ts * 1000).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

// The contract stores two fixed action names without accents; we display them properly.
export const actionLabel = (s: Step) =>
  s.action === "Recolte" ? "Récolte et création du lot" : s.action === "Transfert" ? "Transfert à " + s.details : s.action;

// Fingerprint (hash) of a file, computed in the browser. The file itself never leaves the computer.
export async function hashFile(file: File | null | undefined) {
  return file ? ethers.keccak256(new Uint8Array(await file.arrayBuffer())) : ZERO_HASH;
}

export async function blockNumber(chain: Chain) {
  return parseInt(await chain.provider.send("eth_blockNumber", []), 16);
}

export async function loadBatches(chain: Chain): Promise<Batch[]> {
  const next = Number(await chain.read.nextId());
  const rows: Batch[] = [];
  for (let id = 1; id < next; id++) {
    const b = await chain.read.batches(id);
    rows.push({ id: Number(b.id), product: b.product, quantityKg: Number(b.quantityKg), origin: b.origin, currentOwner: b.currentOwner });
  }
  return rows;
}

export async function loadBatch(chain: Chain, id: number): Promise<Batch | null> {
  const b = await chain.read.batches(id);
  return b.exists ? { id: Number(b.id), product: b.product, quantityKg: Number(b.quantityKg), origin: b.origin, currentOwner: b.currentOwner } : null;
}

export async function loadHistory(chain: Chain, id: number): Promise<Step[]> {
  const steps = await chain.read.getHistory(id);
  return steps.map((s: Step) => ({ actor: s.actor, action: s.action, location: s.location, details: s.details, docHash: s.docHash, timestamp: Number(s.timestamp) }));
}

const EVENT_LABELS: Record<string, string> = {
  ActorRegistered: "Acteur enregistré",
  BatchCreated: "Lot créé",
  StepAdded: "Étape ajoutée",
  OwnershipTransferred: "Lot transféré",
};

export async function loadLogs(chain: Chain, toBlock: number): Promise<LogEntry[]> {
  const logs = await chain.read.queryFilter("*", 0, toBlock);
  return logs.map((l) => {
    const e = l as ethers.EventLog;
    const a = e.args;
    let detail = "";
    if (e.eventName === "ActorRegistered") detail = a.name;
    if (e.eventName === "BatchCreated") detail = `Lot n° ${a.id} par ${actorLabel(chain, a.farmer)}`;
    if (e.eventName === "StepAdded") detail = `Lot n° ${a.id} : ${a.action} par ${actorLabel(chain, a.actor)}`;
    if (e.eventName === "OwnershipTransferred") detail = `Lot n° ${a.id} : ${actorLabel(chain, a.from)} → ${actorLabel(chain, a.to)}`;
    return { block: e.blockNumber, tx: e.transactionHash, event: EVENT_LABELS[e.eventName] || e.eventName, detail };
  });
}

// Messages shown when the smart contract refuses a transaction.
const REFUSALS: Record<string, string> = {
  NOT_ADMIN: "Seul l'administrateur peut faire cette action.",
  ONLY_FARMER: "Seul un agriculteur peut créer un lot.",
  NOT_OWNER: "Vous n'êtes pas le propriétaire actuel de ce lot : vous ne pouvez ni ajouter d'étape ni le transférer.",
  UNKNOWN_BATCH: "Ce lot n'existe pas.",
  UNKNOWN_ACTOR: "Le destinataire n'est pas un acteur enregistré.",
  SAME_OWNER: "Vous êtes déjà le propriétaire de ce lot.",
  BAD_QUANTITY: "La quantité doit être supérieure à zéro.",
};

export function refusalText(e: unknown) {
  const err = e as { reason?: string; shortMessage?: string; message?: string; info?: { error?: { message?: string } } };
  const raw = [err.reason, err.shortMessage, err.message, err.info?.error?.message].filter(Boolean).join(" ");
  const key = Object.keys(REFUSALS).find((k) => raw.includes(k));
  return key ? REFUSALS[key] : err.shortMessage || err.message || "Erreur inconnue";
}

// Sends a transaction signed by the given actor's account. Returns the block number and the hash.
export async function sendAs(chain: Chain, actor: Actor, call: (c: ethers.Contract) => Promise<ethers.ContractTransactionResponse>) {
  const signer = await chain.provider.getSigner(actor.address);
  const contract = new ethers.Contract(chain.info.address, chain.info.abi, signer);
  const tx = await call(contract);
  const receipt = await tx.wait();
  return { block: receipt!.blockNumber, hash: tx.hash };
}

// Compare a file with the fingerprints stored on the blockchain for a batch.
export async function verifyFile(file: File, steps: Step[]) {
  const h = await hashFile(file);
  const i = steps.findIndex((s) => s.docHash === h);
  return i >= 0
    ? { ok: true, text: `Son empreinte est enregistrée à l'étape ${i + 1} (${actionLabel(steps[i])}).` }
    : { ok: false, text: "Son empreinte ne correspond à aucune empreinte enregistrée pour ce lot." };
}
