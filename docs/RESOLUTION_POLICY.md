# RESOLUTION POLICY

How BharatPredict decides the result of a market. Play credits only. The public sees the
proposed result, the evidence link and the explanation, and whether it was self-approved.

**Draft — pending legal review.** Written by a non-lawyer; review before launch.

## 1. Before a market opens

- The question must have one clear answer that a stranger can check.
- The **resolution source** names where the answer will be checked (e.g. "ESPNcricinfo
  scorecard", "Election Commission of India results"). Publishing is refused without it.
- The end date is when trading stops, not necessarily when the answer is known.

## 2. Proposing a result

Who: a moderator or an admin. When: after trading has stopped (closed, or past the end
date).

1. Check the named resolution source. If it is unavailable, use the most authoritative
   official source and say so in the explanation.
2. Pick the outcome the source shows.
3. Link the evidence (a page that shows the result) and write one or two sentences:
   what happened and where it is shown.
4. Do not propose while the source still says "provisional" unless the market's question
   says provisional results count.

## 3. Voiding

Void (each trader's net cost — buys minus sale proceeds — refunded; no claw-back of
gains from earlier sales) only when:

- the event was cancelled, abandoned or postponed beyond a reasonable time;
- the question turned out ambiguous, or both/none of the outcomes happened in a way the
  question did not foresee;
- the resolution source no longer exists and no authoritative replacement does;
- trading continued after the result was known because of our mistake (e.g. a wrong end
  date), and the unfair trades cannot be separated.

Never void because the result is unpopular, unexpected or expensive.

## 4. Approval and the dispute window

- An admin approves the proposal by typing the market's slug.
- **Single admin (current):** the proposer may approve. The proposal is marked
  *self-approved* in the audit log and publicly. When there is a second admin, turn on
  `require_two_person_resolution`; the database then refuses self-approval.
- Approval opens the **dispute window** (`dispute_window_hours`, now 24 h). The public
  sees the proposed result and when the window ends.

## 5. Disputes

- Anyone can raise a grievance (category *resolution*) with the market and the reason,
  with evidence if they have it.
- Review every dispute before the window ends. If it is valid (wrong outcome, wrong
  source, misread result), **withdraw** the approved result with a reason; the market
  returns to *Closed* and a corrected proposal follows.
- Reply to the person who raised it, quoting the grievance reference.

## 6. Finalizing

- After the window, the scheduled job finalizes automatically; an admin may do it by
  typing the slug. Winning shares pay **1 credit each**, rounded down to the paisa; a void
  refunds each trader's net cost (buys minus sales). Shares sold before resolution are
  not paid; payouts use the shares still held.
- Finalized results are not reopened. If a finalized result is later shown to be wrong,
  record it as an incident and compensate affected users with credit adjustments
  (capped, with a reason) rather than reversing payouts.

## 7. Record keeping

Every proposal — approved, rejected, withdrawn or finalized — stays in the history with
who proposed and approved it, when, the evidence and the reasons. The audit log cannot be
edited or deleted.
