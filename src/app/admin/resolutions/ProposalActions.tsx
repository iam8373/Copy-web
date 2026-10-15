"use client";

import { useRouter } from "next/navigation";
import { COPY } from "../_copy";
import { ConfirmSlug } from "../_components/ConfirmSlug";
import { ReasonDialog } from "../_components/ReasonDialog";
import { approveResolution, finalizeResolution, rejectResolution } from "./actions";

const C = COPY.resolutions;

/** Admin actions on the live proposal of a market. */
export function ProposalActions({
  proposalId,
  slug,
  status,
  windowOver,
  proposedByMe,
}: {
  proposalId: string;
  slug: string;
  status: "pending" | "approved";
  windowOver: boolean;
  proposedByMe: boolean;
}) {
  const router = useRouter();
  const done = (r: { ok: boolean; error?: string }) => {
    if (!r.ok) return r.error ?? "FAILED";
    router.refresh();
    return null;
  };
  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" && (
        <>
          <ConfirmSlug
            slug={slug}
            trigger={C.approve}
            title={C.approveTitle}
            body={proposedByMe ? `${C.approveBody} ${C.approveSelfBody}` : C.approveBody}
            onConfirm={async (typed) => done(await approveResolution(proposalId, typed))}
          />
          <ReasonDialog trigger={C.reject} title={C.rejectTitle} body={C.rejectBody} onConfirm={async (why) => done(await rejectResolution(proposalId, why))} />
        </>
      )}
      {status === "approved" && windowOver && (
        <ConfirmSlug
          slug={slug}
          trigger={C.finalize}
          title={C.finalizeTitle}
          body={C.finalizeBody}
          onConfirm={async (typed) => done(await finalizeResolution(proposalId, typed))}
        />
      )}
      {status === "approved" && (
        <ReasonDialog trigger={C.withdraw} title={C.withdrawTitle} body={C.rejectBody} onConfirm={async (why) => done(await rejectResolution(proposalId, why))} />
      )}
    </div>
  );
}
