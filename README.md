# AgriTrace – demo

Blockchain traceability of agricultural products, from the farm to the consumer.
Blockchain module, Subject 1 · Ait Lhamouss Hmad, Atbir Ilyass, Alahyane Youssef

The web interface is in French. This guide is in simple English.

## 1. What is inside

| Part | File | Role |
|---|---|---|
| Smart contract | `contracts/AgriTrace.sol` | The rules: who can create a batch, add a step, transfer it |
| Local blockchain | Hardhat node (started for you) | A real Ethereum-style blockchain running on the laptop |
| Web interface | `frontend/index.html`, `app.js` | Pages for the actors (farmer, cooperative, transporter, shop) |
| Consumer page | `frontend/track.html` | What the consumer sees after scanning the QR code |
| Tests | `test/test.js` | 9 automatic tests of the contract rules |
| Sample files | `docs/` | A demo organic certificate and a falsified copy |

## 2. Install (one time, needs internet)

You need Node.js 18 or newer.

```
cd agritrace
npm install
```

After this, the demo works **without internet**.

## 3. Start

```
npm start
```

Wait for "AgriTrace is ready", then open **http://localhost:3000**.
To stop: `Ctrl + C`. Every restart begins with a new, empty blockchain.

Other commands:

- `npm test` runs the 9 contract tests.
- `npm run scenario` (in a second terminal, while `npm start` runs) plays the whole story automatically. Use it as a backup if you are short on time.

## 4. Demo script (about 5 minutes)

At the top right, the list **"Je suis"** chooses which actor you are. Each actor is a different blockchain account, and every action is a transaction signed by that account.

1. **Show the page.** The "Journal de la blockchain" already has 4 transactions: the admin registered the 4 actors.
2. **Farmer creates the batch.** Choose "Agriculteur". In "Créer un lot", choose the file `docs/certificat-bio-ferme-chtouka.txt` as the certificate, then click "Créer le lot". Show the green message with the block number, the new line in the journal, and the QR code.
3. **Security test 1.** Choose "Transporteur". Write an action in "Ajouter une étape" and click. The contract **refuses**: the transporter does not hold the batch.
4. **Farmer transfers.** Choose "Agriculteur" again, then "Transférer" to "Coopérative Souss".
5. **Cooperative works.** Choose "Coopérative". Add "Contrôle qualité" (details: `760 kg catégorie A`), then "Emballage". Transfer to "TransAtlas".
6. **Transporter.** Add "Départ du transport" (details: `Camion frigorifique, 4 à 8 °C`), then "Arrivée du transport". Transfer to "Marché Agadir".
7. **Shop.** Add "Mise en rayon".
8. **Consumer.** Click "Ouvrir la vue consommateur" (or scan the QR code with a phone, see below). The full history appears, read from the blockchain.
9. **Security test 2.** In "Vérifier un document", choose the real certificate: **authentique**. Then choose `docs/certificat-bio-FALSIFIE.txt` (one word was changed): **inconnu ou modifié**.

What to say at the end: nobody can edit or delete a step, because the contract has no function for that and every block is linked to the previous one by its hash.

## 5. Scanning the QR code with a phone

The QR code contains the address of the laptop on the local network. It works when:

- the phone and the laptop are on the **same Wi-Fi** (a phone hotspot works well), and
- Windows Firewall allows Node.js (click "Allow" when Windows asks at the first `npm start`).

If it does not work in the room, use the link "Ouvrir la vue consommateur" on the laptop. It shows the same page.

## 6. If something goes wrong

| Problem | Solution |
|---|---|
| "The blockchain node stopped (is port 8545 already used?)" | Another copy is running. Close the other terminal, then `npm start` again. |
| Port 3000 already used | Close the other program, or change `WEB_PORT` in `scripts/start.js`. |
| The page says it cannot connect | Check that the terminal with `npm start` is still open. |
| The list of lots is empty after a restart | Normal: the local blockchain is reset at each start. |

## 7. Questions you may get

- **Is it a real blockchain?** Yes: a local Ethereum network (Hardhat). Blocks, hashes, signed transactions and the smart contract work as on Ethereum. It runs on one computer for the demo; in real life it would run on many nodes owned by different actors.
- **Why no MetaMask?** To keep the demo simple. The local node holds the test accounts and signs for the chosen actor. With MetaMask, each actor would sign with their own wallet.
- **Where is the certificate stored?** Not on the blockchain. Only its fingerprint (Keccak-256 hash) is stored. The file stays with its owner.
- **Does the blockchain prove the tomatoes are really organic?** No. It proves who declared it, when, and that nothing was changed afterwards.

## 8. Differences with the contract in the study guide

Same logic, with two small additions for a nicer display: each actor has a name stored in the contract, and a transfer also adds a line to the history.
