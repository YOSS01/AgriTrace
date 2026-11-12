// Shared code for index.html (actors) and track.html (consumer).
const AT = {};

AT.init = async function () {
  const info = await (await fetch("contract.json", { cache: "no-store" })).json();
  AT.info = info;
  AT.config = await (await fetch("config.json", { cache: "no-store" })).json().catch(() => ({ lanUrl: location.origin }));
  // All calls go through /rpc, which the local server forwards to the blockchain node.
  AT.provider = new ethers.JsonRpcProvider(location.origin + "/rpc", 31337, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 });
  AT.read = new ethers.Contract(info.address, info.abi, AT.provider);
};

AT.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
AT.short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
AT.actor = (address) => AT.info.actors.find((a) => a.address.toLowerCase() === address.toLowerCase());
AT.actorLabel = (address) => { const a = AT.actor(address); return a ? `${a.name} (${a.roleLabel})` : AT.short(address); };
AT.date = (ts) => new Date(Number(ts) * 1000).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
AT.ZERO = "0x" + "0".repeat(64);

// Fingerprint (hash) of a file, computed in the browser. The file itself never leaves the computer.
AT.hashFile = async (file) => ethers.keccak256(new Uint8Array(await file.arrayBuffer()));

// The contract stores two fixed action names without accents; we display them properly.
AT.actionLabel = (s) => (s.action === "Recolte" ? "Récolte et création du lot" : s.action === "Transfert" ? "Transfert à " + s.details : s.action);

AT.timelineHtml = function (steps) {
  return '<ol class="timeline">' + steps.map((s, i) => {
    const isTr = s.action === "Transfert";
    const meta = [AT.actorLabel(s.actor), AT.date(s.timestamp)];
    if (s.location) meta.push(s.location);
    return `<li><span class="dot ${isTr ? "tr" : ""}">${i + 1}</span>
      <div class="t">${AT.esc(AT.actionLabel(s))}</div>
      ${!isTr && s.details ? `<div>${AT.esc(s.details)}</div>` : ""}
      <div class="m">${AT.esc(meta.join(" · "))}</div>
      ${s.docHash !== AT.ZERO ? `<div class="doc">Document joint, empreinte : <span class="mono">${s.docHash.slice(0, 18)}…</span></div>` : ""}
    </li>`;
  }).join("") + "</ol>";
};

// Compare a file with the fingerprints stored on the blockchain for this batch.
AT.verifyFile = async function (file, steps) {
  const h = await AT.hashFile(file);
  const i = steps.findIndex((s) => s.docHash === h);
  return i >= 0
    ? { ok: true, text: `Document authentique : son empreinte est enregistrée à l'étape ${i + 1} (${AT.actionLabel(steps[i])}).` }
    : { ok: false, text: "Document inconnu ou modifié : son empreinte ne correspond à aucune empreinte enregistrée pour ce lot." };
};
