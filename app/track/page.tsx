"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Blocks, Loader2, SearchX, Sprout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline } from "@/components/timeline";
import { VerifyDocument } from "@/components/verify-document";
import { type Batch, type Chain, type Step, blockNumber, connect, loadBatch, loadHistory } from "@/lib/chain";

// What the consumer sees after scanning the QR code. Read only: no account is needed.
function Track() {
  const id = Number(useSearchParams().get("id"));
  const [state, setState] = useState<{ chain: Chain; batch: Batch; steps: Step[]; block: number } | "loading" | "missing">("loading");

  useEffect(() => {
    (async () => {
      const chain = await connect();
      const batch = id ? await loadBatch(chain, id) : null;
      if (!batch) return setState("missing");
      setState({ chain, batch, steps: await loadHistory(chain, id), block: await blockNumber(chain) });
    })().catch(() => setState("missing"));
  }, [id]);

  if (state === "loading") {
    return <div className="text-muted-foreground flex min-h-screen items-center justify-center gap-2"><Loader2 className="size-5 animate-spin" /> Lecture de la blockchain…</div>;
  }
  if (state === "missing") {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <SearchX className="text-muted-foreground mx-auto size-10" />
        <h1 className="mt-3 text-xl font-semibold">Lot introuvable</h1>
        <p className="text-muted-foreground mt-1 text-sm">Aucun lot ne correspond à ce QR code sur la blockchain.</p>
      </div>
    );
  }

  const { chain, batch, steps, block } = state;
  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <div className="bg-primary text-primary-foreground rounded-xl p-5">
        <div className="flex items-center gap-2 text-sm text-white/75"><Sprout className="size-4" /> AgriTrace · Vue consommateur</div>
        <h1 className="mt-1 text-2xl font-semibold">{batch.product}</h1>
        <p className="mt-1 text-sm text-white/85">Lot n° {batch.id} · {batch.quantityKg} kg · Origine : {batch.origin}</p>
        <Badge className="mt-3 bg-white/90 text-primary"><Blocks /> Lu sur la blockchain · bloc n° {block} · {steps.length} étapes</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Le parcours de ce produit</CardTitle>
          <CardDescription>De la ferme au magasin : chaque étape a été signée par l&apos;acteur responsable.</CardDescription>
        </CardHeader>
        <CardContent><Timeline chain={chain} steps={steps} /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Vérifier un certificat</CardTitle>
          <CardDescription>Choisissez le fichier du certificat : son empreinte est comparée à celle enregistrée sur la blockchain.</CardDescription>
        </CardHeader>
        <CardContent><VerifyDocument steps={steps} /></CardContent>
      </Card>
    </main>
  );
}

export default function TrackPage() {
  return (
    <Suspense>
      <Track />
    </Suspense>
  );
}
