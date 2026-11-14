import { ArrowRightLeft, FileCheck2 } from "lucide-react";
import { type Chain, type Step, ZERO_HASH, actionLabel, actorLabel, formatDate } from "@/lib/chain";
import { cn } from "@/lib/utils";

// The history of a batch, one step under the other.
export function Timeline({ chain, steps }: { chain: Chain; steps: Step[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const isTransfer = s.action === "Transfert";
        const meta = [actorLabel(chain, s.actor), formatDate(s.timestamp), s.location].filter(Boolean).join(" · ");
        return (
          <li key={i} className="relative pb-5 pl-10 last:pb-0">
            {i < steps.length - 1 && <span className="bg-border absolute top-7 bottom-0 left-[13px] w-0.5" />}
            <span className={cn("absolute top-0 left-0 flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white", isTransfer ? "bg-chain" : "bg-primary")}>
              {isTransfer ? <ArrowRightLeft className="size-3.5" /> : i + 1}
            </span>
            <div className="leading-tight font-semibold">{actionLabel(s)}</div>
            {!isTransfer && s.details && <div className="text-sm">{s.details}</div>}
            <div className="text-muted-foreground text-xs">{meta}</div>
            {s.docHash !== ZERO_HASH && (
              <div className="text-chain mt-1 flex flex-wrap items-center gap-1 text-xs">
                <FileCheck2 className="size-3.5" /> Document joint, empreinte : <span className="font-mono">{s.docHash.slice(0, 18)}…</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
