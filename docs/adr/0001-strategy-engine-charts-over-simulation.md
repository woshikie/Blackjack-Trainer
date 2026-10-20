# Basic strategy via curated charts + rule-conditioned overrides, not runtime simulation

The trainer must grade every player decision as correct or incorrect under the configured rules. We decided to encode published basic-strategy tables (per deck family: 1, 2, 4+ decks; per dealer rule: S17/H17) and resolve rule-conditioned overrides at runtime (DAS, late surrender, double restrictions, split-ace mode) rather than computing expected values by simulation at startup.

Why: charts are auditable against reference sources cell-by-cell, grading is instant, and the resolver is unit-testable. A runtime optimizer would be heavyweight, slower to start, and its correctness would be as hard to argue as the charts it would replace.

ENHC (dealer checks last) applies a small, sourced override layer (Wizard of Odds via Wikipedia, "No hole card and OBO"): against a dealer 10 or Ace, doubles become hits and splits become hits — except splitting a pair of aces against a 10 remains correct. Late surrender does not exist under ENHC. The 4–8 deck H17 chart is verified against the Wizard of Odds table; 1- and 2-deck families follow WoO conventions and are flagged for audit in the README.

## Considered Options

- Runtime EV optimizer (rejected: weight, latency, unverifiable correctness)
- Hardcoded full tables per rule combination (rejected: combinatorial explosion of near-duplicate tables)
