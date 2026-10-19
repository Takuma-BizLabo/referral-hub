import { StatusSelect } from "./StatusSelect";
import { setVendorProposalStatusAction } from "@/app/(app)/vendors/actions";
import { VENDOR_PROPOSAL_LABEL, VENDOR_PROPOSAL_ORDER } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { VendorProposalStatus } from "@prisma/client";

/** 提案状況の色（提案済みは塗りつぶしで一目でわかるように） */
const TONE: Record<VendorProposalStatus, string> = {
  NOT_PROPOSED: "bg-white text-slate-600 border-slate-300",
  PROPOSING: "bg-amber-100 text-amber-900 border-amber-300",
  PROPOSED: "bg-emerald-600 text-white border-emerald-600",
};
const MARK: Record<VendorProposalStatus, string> = { NOT_PROPOSED: "○ ", PROPOSING: "… ", PROPOSED: "✓ " };

/** ベンダーの提案状況を色付きのセレクトで表示・その場で変更（ベンダー単位） */
export function ProposalStatusSelect({ vendorId, value, className }: { vendorId: number; value: VendorProposalStatus; className?: string }) {
  return (
    <StatusSelect
      action={setVendorProposalStatusAction}
      id={vendorId}
      value={value}
      options={VENDOR_PROPOSAL_ORDER.map((p) => ({ value: p, label: MARK[p] + VENDOR_PROPOSAL_LABEL[p] }))}
      className={cn("cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-semibold w-auto", TONE[value], className)}
    />
  );
}
