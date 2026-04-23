# [Bug title — short, specific]

## Symptom

**What to include:**

- Concrete observable behavior that triggered investigation
- What was expected vs what actually happened
- (Optional) How it was surfaced — user report / test run / verification

**Anti-patterns to avoid:**

- "Bug happened" / "Something was wrong" — not observable
- Jumping straight to cause ("embedding was missing") — save for Root cause

**Example shape:**

> After the CMS gained the RAG backfill feature and a debug API, I ran five SQL tests to verify semantic retrieval.
Expected: each query returned a different scene. 
Actual: All five queries returned the same scene, regardless of input.
> 

## Investigation path

**What to include:**

- Each step = one hypothesis explored
- Each step should have:
    - **Hypothesis:** what I suspected was wrong
    - **Tested by:** what I did to check (query, log, git history, etc.)
    - **Learned:** result + what it ruled in or out

**Honesty rule:**

- If the real debug path was 1 step (pattern recognition / intuition),
write 1 step. Don't pad.
- If pattern recognition happened, label it explicitly:
"Pattern recognition: immediately suspected X based on prior context"
- The value of this section is the faithful reconstruction of the
reasoning chain, not ticking an "at least N steps" box.

**Anti-patterns to avoid:**

- Rewriting the debugging to look more systematic than it was
- Skipping the "what I learned" step (without it, each step reads as
disconnected actions, not a chain)

## Root cause

**What to include:**

- Event level: what specifically went wrong (e.g., "only 1 scene had
an embedding")
- Mechanism level: **why this class of bug is possible in the system**
(e.g., "the pipeline is decoupled from scene lifecycle — no trigger
keeps embeddings in sync with scenes")

**Key test:**
A good Root cause section should answer "If I want to prevent this
class of bug, where would I fix it?" — the answer is usually at the
mechanism level, not the event level.

**Anti-patterns to avoid:**

- Only writing the event ("I forgot to re-run backfill") — this doesn't
explain why it was possible to forget
- Blaming self ("I made a mistake") — describes agent, not system

## Lesson

**Structure (Principle / Why / When):**

Each lesson should have three layers:

- **Principle:** a rule or heuristic, phrased so it applies beyond
this specific bug
- **Why:** the mechanism that makes this principle true (the reasoning
behind the rule)
- **When:** the trigger — what situation in the future should remind
you of this principle

**Quality bar:**
A good Lesson is both **concrete enough to act on** AND **abstract
enough to generalize**. These aren't opposites — they're two
constraints that both need to hold.

- Too vague: "Be careful with data consistency"
(can't act on it + doesn't explain why)
- Too specific: "Remember to re-run backfill after adding scenes"
(only applies to this exact scenario)
- Right level: "Any derived state needs an explicit sync mechanism;
relying on manual discipline will silently drift"
(applies to any scene/embedding, cache/source, index/table pair)

**Minimum:**
At least 1 high-quality lesson. More is fine if they're distinct
principles, not variations of the same point.

## (Optional) References

- Link to related PRs, commits, issues
- Link to related ADRs if the bug revealed an architectural gap