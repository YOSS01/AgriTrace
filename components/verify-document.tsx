"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { type Step, verifyFile } from "@/lib/chain";

// Choose a file: its fingerprint is compared with those stored on the blockchain.
export function VerifyDocument({ steps, resetKey }: { steps: Step[]; resetKey?: number }) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setResult(null);
    if (input.current) input.current.value = "";
  }, [resetKey]);

  return (
    <div className="space-y-3">
      <Input
        ref={input}
        id="verify-file"
        type="file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          setResult(f ? await verifyFile(f, steps) : null);
        }}
      />
      {result && (
        <Alert variant={result.ok ? "success" : "destructive"} data-testid="verify-result">
          {result.ok ? <ShieldCheck /> : <ShieldAlert />}
          <AlertTitle>{result.ok ? "Document authentique" : "Document inconnu ou modifié"}</AlertTitle>
          <AlertDescription>{result.text}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
