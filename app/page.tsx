"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { ArrowRightLeft, Blocks, ExternalLink, ListPlus, Loader2, PackagePlus, ShieldCheck, Sprout, Store, Truck, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Timeline } from "@/components/timeline";
import { VerifyDocument } from "@/components/verify-document";
import { type Batch, type Chain, type LogEntry, type Step, actorLabel, blockNumber, connect, hashFile, loadBatches, loadHistory, loadLogs, refusalText, sendAs, shortAddress } from "@/lib/chain";

const ROLE_ICONS = [ShieldCheck, Sprout, Warehouse, Truck, Store];
const SUGGESTIONS: Record<number, string[]> = {
  0: [],
  1: ["Traitement biologique", "Stockage à la ferme"],
  2: ["Réception et tri", "Contrôle qualité", "Emballage"],
  3: ["Départ du transport", "Arrivée du transport"],
  4: ["Réception en magasin", "Mise en rayon"],
};

export default function Home() {
  const [chain, setChain] = useState<Chain | null>(null);
  const [error, setError] = useState(false);
  const [me, setMe] = useState(1); // index of the current actor in the "Je suis" list
  const [selected, setSelected] = useState<number | null>(null);
  const [block, setBlock] = useState(0);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("create");

  // form fields
  const [product, setProduct] = useState("Tomates cerises bio");
  const [quantity, setQuantity] = useState("800");
  const [origin, setOrigin] = useState("Ferme Chtouka – parcelle B3");
  const [action, setAction] = useState("");
  const [location, setLocation] = useState("");
  const [details, setDetails] = useState("");
  const [recipient, setRecipient] = useState("");
  const certFile = useRef<HTMLInputElement>(null);
  const stepFile = useRef<HTMLInputElement>(null);

  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selected;
  const generation = useRef(0); // if two refreshes overlap, only the newest one is displayed

  const refresh = useCallback(async (c: Chain) => {
    const g = ++generation.current;
    const id = selectedRef.current;
    const n = await blockNumber(c);
    const rows = await loadBatches(c);
    const history = id ? await loadHistory(c, id) : [];
    const entries = await loadLogs(c, n);
    if (g !== generation.current) return;
    setBlock(n);
    setBatches(rows);
    setSteps(history);
    setLogs(entries);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    connect()
      .then(async (c) => {
        setChain(c);
        await refresh(c);
        timer = setInterval(() => refresh(c).catch(() => {}), 5000);
      })
      .catch(() => setError(true));
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (chain) refresh(chain).catch(() => {});
  }, [selected, chain, refresh]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl p-10 text-center">
        <h1 className="text-xl font-semibold">Impossible de se connecter à la blockchain</h1>
        <p className="text-muted-foreground mt-2">Vérifiez que « npm start » est lancé, puis rechargez la page.</p>
      </main>
    );
  }
  if (!chain) {
    return (
      <main className="text-muted-foreground flex min-h-screen items-center justify-center gap-2">
        <Loader2 className="size-5 animate-spin" /> Connexion à la blockchain…
      </main>
    );
  }

  const actors = chain.info.actors;
  const actor = actors[me];
  const current = batches.find((b) => b.id === selected) || null;
  const others = actors.filter((a) => a.role > 0 && a.address !== actor.address);
  const recipientValue = others.some((a) => a.address === recipient) ? recipient : others[0]?.address || "";
  const selectionLabel = current ? `lot n° ${current.id}, détenu par ${actorLabel(chain, current.currentOwner)}` : "aucun lot sélectionné";

  // Sends one transaction as the current actor and shows the result.
  async function run(title: string, call: Parameters<typeof sendAs>[2]) {
    if (!chain) return false;
    setBusy(true);
    try {
      const r = await sendAs(chain, actor, call);
      toast.success(title, { description: `Transaction validée dans le bloc n° ${r.block} · ${r.hash.slice(0, 18)}…` });
      await refresh(chain);
      return true;
    } catch (e) {
      toast.error("Transaction refusée par le smart contract", { description: refusalText(e), duration: 10000 });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createBatch() {
    const hash = await hashFile(certFile.current?.files?.[0]);
    const nextId = Number(await chain!.read.nextId());
    const ok = await run("Lot créé", (c) => c.createBatch(product.trim(), parseInt(quantity, 10) || 0, origin.trim(), hash));
    if (ok) {
      setSelected(nextId);
      if (certFile.current) certFile.current.value = "";
    }
  }

  async function addStep() {
    if (!selected) return toast.error("Aucun lot sélectionné", { description: "Cliquez d'abord sur un lot dans la liste." });
    if (!action.trim()) return toast.error("Action manquante", { description: "Indiquez l'action réalisée." });
    const hash = await hashFile(stepFile.current?.files?.[0]);
    const ok = await run("Étape enregistrée", (c) => c.addStep(selected, action.trim(), location.trim(), details.trim(), hash));
    if (ok) {
      setAction("");
      setDetails("");
      if (stepFile.current) stepFile.current.value = "";
    }
  }

  async function transfer() {
    if (!selected) return toast.error("Aucun lot sélectionné", { description: "Cliquez d'abord sur un lot dans la liste." });
    await run("Lot transféré", (c) => c.transfer(selected, recipientValue));
  }

  return (
    <div className="min-h-screen">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-white/15">
              <Sprout className="size-6" />
            </div>
            <div>
              <h1 className="text-lg leading-tight font-semibold">AgriTrace</h1>
              <p className="text-sm text-white/75">Traçabilité des produits agricoles sur blockchain</p>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm">
            <Blocks className="size-4" /> Bloc actuel : <span className="font-semibold" data-testid="block">{block}</span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="role" className="text-white/85">Je suis</Label>
            <Select value={String(me)} onValueChange={(v) => { setMe(Number(v)); setAction(""); }}>
              <SelectTrigger id="role" className="text-foreground w-72 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actors.map((a, i) => {
                  const Icon = ROLE_ICONS[a.role];
                  return (
                    <SelectItem key={a.address} value={String(i)}>
                      <Icon className="text-primary" /> {a.roleLabel} · {a.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[400px_1fr]">
        {/* Left column: the three actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Vous agissez en tant que <span className="text-foreground font-medium">{actor.name}</span> ({actor.roleLabel}), adresse{" "}
                <span className="font-mono text-xs">{shortAddress(actor.address)}</span>. Chaque action est une transaction signée.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="create"><PackagePlus /> Créer</TabsTrigger>
                  <TabsTrigger value="step"><ListPlus /> Étape</TabsTrigger>
                  <TabsTrigger value="transfer"><ArrowRightLeft /> Transférer</TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="space-y-4">
                  <p className="text-muted-foreground text-sm">Réservé à l&apos;agriculteur. C&apos;est « l&apos;acte de naissance » du produit.</p>
                  <div className="space-y-2">
                    <Label htmlFor="product">Produit</Label>
                    <Input id="product" value={product} onChange={(e) => setProduct(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-[110px_1fr] gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantité (kg)</Label>
                      <Input id="quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="origin">Origine</Label>
                      <Input id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cert">Certificat (facultatif)</Label>
                    <Input id="cert" type="file" ref={certFile} />
                    <p className="text-muted-foreground text-xs">Seule son empreinte est enregistrée sur la blockchain.</p>
                  </div>
                  <Button id="btn-create" className="w-full" disabled={busy} onClick={createBatch}>
                    <PackagePlus /> Créer le lot
                  </Button>
                </TabsContent>

                <TabsContent value="step" className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Réservé au propriétaire actuel du lot sélectionné : <span className="text-foreground font-medium">{selectionLabel}</span>.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="action">Action</Label>
                    <Input id="action" value={action} placeholder="Choisir ci-dessous ou écrire…" onChange={(e) => setAction(e.target.value)} />
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTIONS[actor.role].map((s) => (
                        <button key={s} type="button" onClick={() => setAction(s)} className="cursor-pointer">
                          <Badge variant="secondary">{s}</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="location">Lieu</Label>
                      <Input id="location" value={location} placeholder="Agadir" onChange={(e) => setLocation(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="details">Détails</Label>
                      <Input id="details" value={details} placeholder="760 kg catégorie A" onChange={(e) => setDetails(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="step-file">Document (facultatif)</Label>
                    <Input id="step-file" type="file" ref={stepFile} />
                  </div>
                  <Button id="btn-step" className="w-full" disabled={busy} onClick={addStep}>
                    <ListPlus /> Enregistrer l&apos;étape
                  </Button>
                </TabsContent>

                <TabsContent value="transfer" className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Le propriétaire passe le lot à l&apos;acteur suivant : <span className="text-foreground font-medium">{selectionLabel}</span>.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="recipient">Destinataire</Label>
                    <Select value={recipientValue} onValueChange={setRecipient}>
                      <SelectTrigger id="recipient">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {others.map((a) => {
                          const Icon = ROLE_ICONS[a.role];
                          return (
                            <SelectItem key={a.address} value={a.address}>
                              <Icon className="text-primary" /> {a.name} ({a.roleLabel})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button id="btn-transfer" className="w-full" disabled={busy} onClick={transfer}>
                    <ArrowRightLeft /> Transférer le lot
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acteurs de la chaîne</CardTitle>
              <CardDescription>Enregistrés par l&apos;administrateur dans le smart contract.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {actors.map((a) => {
                const Icon = ROLE_ICONS[a.role];
                return (
                  <div key={a.address} className="flex items-center gap-3">
                    <div className="bg-secondary text-primary flex size-9 items-center justify-center rounded-full">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.name}</div>
                      <div className="text-muted-foreground text-xs">{a.roleLabel}</div>
                    </div>
                    <span className="text-muted-foreground font-mono text-xs">{shortAddress(a.address)}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right column: what is stored on the blockchain */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lots enregistrés sur la blockchain</CardTitle>
              <CardDescription>Cliquez sur un lot pour voir son historique.</CardDescription>
            </CardHeader>
            <CardContent>
              {batches.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">Aucun lot pour le moment. Choisissez « Agriculteur » puis créez un lot.</p>
              ) : (
                <Table id="batches">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Origine</TableHead>
                      <TableHead>Propriétaire actuel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((b) => (
                      <TableRow key={b.id} className="cursor-pointer" data-state={b.id === selected ? "selected" : undefined} onClick={() => setSelected(b.id)}>
                        <TableCell><Badge variant="secondary">n° {b.id}</Badge></TableCell>
                        <TableCell className="font-medium">{b.product}</TableCell>
                        <TableCell>{b.quantityKg} kg</TableCell>
                        <TableCell>{b.origin}</TableCell>
                        <TableCell>{actorLabel(chain, b.currentOwner)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {current && (
            <Card id="detail">
              <CardHeader>
                <CardTitle>Lot n° {current.id} : {current.product}</CardTitle>
                <CardDescription>
                  {current.quantityKg} kg · {current.origin} · détenu par {actorLabel(chain, current.currentOwner)}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-8 md:grid-cols-[1fr_230px]">
                <Timeline chain={chain} steps={steps} />
                <div className="space-y-5">
                  <div className="space-y-2 text-center">
                    <div className="inline-block rounded-lg border bg-white p-3">
                      <QRCodeSVG value={`${chain.lanUrl}/track?id=${current.id}`} size={170} />
                    </div>
                    <p className="text-muted-foreground text-xs">QR code à imprimer sur l&apos;emballage</p>
                    <Button asChild variant="outline" size="sm">
                      <a id="consumer-link" href={`/track?id=${current.id}`} target="_blank" rel="noopener">
                        <ExternalLink /> Vue consommateur
                      </a>
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="verify-file">Vérifier un document</Label>
                    <VerifyDocument steps={steps} resetKey={current.id} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Journal de la blockchain</CardTitle>
              <CardDescription>Chaque action est une transaction signée, rangée dans un bloc. Rien ne peut être modifié ni supprimé.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table id="log">
                <TableHeader>
                  <TableRow>
                    <TableHead>Bloc</TableHead>
                    <TableHead>Événement</TableHead>
                    <TableHead>Détail</TableHead>
                    <TableHead>Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.slice(-12).reverse().map((l) => (
                    <TableRow key={l.tx + l.event}>
                      <TableCell><Badge variant="chain">{l.block}</Badge></TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{l.event}</TableCell>
                      <TableCell>{l.detail}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{l.tx.slice(0, 14)}…</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
