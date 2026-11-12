// Interface for the actors of the supply chain.
let me = null;          // current actor (from the "Je suis" list)
let selected = null;    // selected batch id
let lastSteps = [];

const $ = (id) => document.getElementById(id);

// Messages shown when the smart contract refuses a transaction.
const REFUSALS = {
  NOT_ADMIN: "Seul l'administrateur peut faire cette action.",
  ONLY_FARMER: "Seul un agriculteur peut créer un lot.",
  NOT_OWNER: "Vous n'êtes pas le propriétaire actuel de ce lot : vous ne pouvez ni ajouter d'étape ni le transférer.",
  UNKNOWN_BATCH: "Ce lot n'existe pas.",
  UNKNOWN_ACTOR: "Le destinataire n'est pas un acteur enregistré.",
  SAME_OWNER: "Vous êtes déjà le propriétaire de ce lot.",
  BAD_QUANTITY: "La quantité doit être supérieure à zéro.",
};
const SUGGESTIONS = {
  1: ["Traitement biologique", "Stockage à la ferme"],
  2: ["Réception et tri", "Contrôle qualité", "Emballage"],
  3: ["Départ du transport", "Arrivée du transport"],
  4: ["Réception en magasin", "Mise en rayon"],
  0: [],
};
const EVENT_LABELS = { ActorRegistered: "Acteur enregistré", BatchCreated: "Lot créé", StepAdded: "Étape ajoutée", OwnershipTransferred: "Lot transféré" };

function toast(ok, title, text, code) {
  const t = $("toast");
  t.className = ok ? "ok" : "err";
  t.innerHTML = `<b>${AT.esc(title)}</b>${AT.esc(text || "")}${code ? `<br><code>${AT.esc(code)}</code>` : ""}`;
  t.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.style.display = "none"), ok ? 6000 : 10000);
}

function refusalText(e) {
  const raw = [e.reason, e.shortMessage, e.message, e.info && e.info.error && e.info.error.message].filter(Boolean).join(" ");
  const key = Object.keys(REFUSALS).find((k) => raw.includes(k));
  return key ? REFUSALS[key] : (e.shortMessage || e.message || "Erreur inconnue");
}

// Sends a transaction signed by the current actor.
async function send(buttonId, call, successTitle) {
  const btn = $(buttonId);
  btn.disabled = true;
  try {
    const signer = await AT.provider.getSigner(me.address);
    const contract = new ethers.Contract(AT.info.address, AT.info.abi, signer);
    const tx = await call(contract);
    const receipt = await tx.wait();
    toast(true, successTitle, `Transaction validée dans le bloc n° ${receipt.blockNumber}.`, tx.hash);
    await refresh();
    return receipt;
  } catch (e) {
    toast(false, "Transaction refusée par le smart contract", refusalText(e));
    return null;
  } finally {
    btn.disabled = false;
  }
}

async function fileHash(inputId) {
  const f = $(inputId).files[0];
  return f ? AT.hashFile(f) : AT.ZERO;
}

function setRole() {
  me = AT.info.actors[Number($("role").value)];
  $("myAddr").textContent = "Adresse : " + AT.short(me.address);
  $("actions").innerHTML = (SUGGESTIONS[me.role] || []).map((a) => `<option value="${a}">`).join("");
  $("sAction").value = "";
  $("tTo").innerHTML = AT.info.actors.filter((a) => a.role > 0 && a.address !== me.address)
    .map((a) => `<option value="${a.address}">${AT.esc(a.name)} (${a.roleLabel})</option>`).join("");
}

let generation = 0;   // if two refreshes overlap, only the newest one is displayed

async function refresh() {
  const g = ++generation;
  // 1) read everything from the blockchain
  const blockNo = parseInt(await AT.provider.send("eth_blockNumber", []), 16);
  const next = Number(await AT.read.nextId());
  const rows = [];
  for (let id = 1; id < next; id++) rows.push(await AT.read.batches(id));
  const b = rows.find((r) => Number(r.id) === selected);
  const steps = b ? await AT.read.getHistory(selected) : [];
  const logs = await AT.read.queryFilter("*", 0, blockNo);
  if (g !== generation) return;

  // 2) display it
  $("blockNo").textContent = blockNo;
  $("batches").innerHTML = rows.length === 0
    ? '<div class="empty">Aucun lot pour le moment. Choisissez « Agriculteur » puis créez un lot.</div>'
    : "<table><tr><th>Lot</th><th>Produit</th><th>Quantité</th><th>Origine</th><th>Propriétaire actuel</th></tr>" +
      rows.map((r) => `<tr class="click ${Number(r.id) === selected ? "sel" : ""}" data-id="${r.id}">
        <td><span class="badge">n° ${r.id}</span></td><td>${AT.esc(r.product)}</td><td>${r.quantityKg} kg</td>
        <td>${AT.esc(r.origin)}</td><td>${AT.esc(AT.actorLabel(r.currentOwner))}</td></tr>`).join("") + "</table>";
  document.querySelectorAll("#batches tr.click").forEach((tr) => tr.onclick = () => { selected = Number(tr.dataset.id); $("vRes").innerHTML = ""; $("vFile").value = ""; refresh(); });

  const label = b ? `lot n° ${b.id}, détenu par ${AT.actorLabel(b.currentOwner)}` : "aucun lot sélectionné";
  $("selInfo1").textContent = label;
  $("selInfo2").textContent = label;
  $("detailCard").style.display = b ? "block" : "none";
  if (b) {
    lastSteps = steps;
    $("dTitle").textContent = `Lot n° ${b.id} : ${b.product}`;
    $("dInfo").innerHTML = `<span>Quantité</span><span>${b.quantityKg} kg</span><span>Origine</span><span>${AT.esc(b.origin)}</span>
      <span>Propriétaire</span><span>${AT.esc(AT.actorLabel(b.currentOwner))}</span>`;
    $("dTimeline").innerHTML = AT.timelineHtml(steps);
    const qr = qrcode(0, "M");
    qr.addData(`${AT.config.lanUrl}/track.html?id=${b.id}`);
    qr.make();
    $("dQr").innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    $("dLink").href = `track.html?id=${b.id}`;
  }

  $("log").innerHTML = logs.length === 0 ? '<div class="empty">Aucune transaction.</div>'
    : "<table><tr><th>Bloc</th><th>Événement</th><th>Détail</th><th>Transaction</th></tr>" +
      logs.slice(-12).reverse().map((l) => {
        const n = l.eventName, a = l.args;
        let d = "";
        if (n === "ActorRegistered") d = `${a.name}`;
        if (n === "BatchCreated") d = `Lot n° ${a.id} par ${AT.actorLabel(a.farmer)}`;
        if (n === "StepAdded") d = `Lot n° ${a.id} : ${a.action} par ${AT.actorLabel(a.actor)}`;
        if (n === "OwnershipTransferred") d = `Lot n° ${a.id} : ${AT.actorLabel(a.from)} → ${AT.actorLabel(a.to)}`;
        return `<tr><td><span class="badge blue">${l.blockNumber}</span></td><td>${EVENT_LABELS[n] || n}</td><td>${AT.esc(d)}</td><td class="mono">${l.transactionHash.slice(0, 14)}…</td></tr>`;
      }).join("") + "</table>";
}

async function main() {
  await AT.init();
  $("role").innerHTML = AT.info.actors.map((a, i) => `<option value="${i}">${a.roleLabel} – ${AT.esc(a.name)}</option>`).join("");
  $("role").value = "1";
  $("role").onchange = () => { setRole(); };
  setRole();

  $("btnCreate").onclick = async () => {
    const hash = await fileHash("cFile");
    const qty = parseInt($("cQty").value, 10) || 0;
    const before = Number(await AT.read.nextId());
    const r = await send("btnCreate", (c) => c.createBatch($("cProduct").value.trim(), qty, $("cOrigin").value.trim(), hash), "Lot créé");
    if (r) { selected = before; $("cFile").value = ""; await refresh(); }
  };
  $("btnStep").onclick = async () => {
    if (!selected) return toast(false, "Aucun lot sélectionné", "Cliquez d'abord sur un lot dans la liste.");
    if (!$("sAction").value.trim()) return toast(false, "Action manquante", "Indiquez l'action réalisée.");
    const hash = await fileHash("sFile");
    const r = await send("btnStep", (c) => c.addStep(selected, $("sAction").value.trim(), $("sLocation").value.trim(), $("sDetails").value.trim(), hash), "Étape enregistrée");
    if (r) { $("sAction").value = ""; $("sDetails").value = ""; $("sFile").value = ""; }
  };
  $("btnTransfer").onclick = async () => {
    if (!selected) return toast(false, "Aucun lot sélectionné", "Cliquez d'abord sur un lot dans la liste.");
    await send("btnTransfer", (c) => c.transfer(selected, $("tTo").value), "Lot transféré");
  };
  $("vFile").onchange = async () => {
    const f = $("vFile").files[0];
    if (!f) return;
    const r = await AT.verifyFile(f, lastSteps);
    $("vRes").innerHTML = `<div class="res ${r.ok ? "ok" : "bad"}">${AT.esc(r.text)}</div>`;
  };

  await refresh();
  setInterval(() => refresh().catch(() => {}), 5000);
}

main().catch((e) => toast(false, "Impossible de se connecter à la blockchain", "Vérifiez que « npm start » est lancé. " + (e.message || "")));
