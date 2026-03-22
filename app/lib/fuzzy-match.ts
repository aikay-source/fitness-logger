import { distance } from "fastest-levenshtein";

export type ClientStub = { id: string; name: string };

export type MatchResult =
  | { matched: true; client: ClientStub }
  | { matched: false; input: string };

const MAX_DISTANCE = 3; // allow up to 3 character edits

function normalize(s: string) {
  return s.toLowerCase().trim();
}

export function matchNames(
  names: string[],
  roster: ClientStub[]
): MatchResult[] {
  return names.map((name) => {
    const norm = normalize(name);

    // 1. Exact match (case-insensitive)
    const exact = roster.find((c) => normalize(c.name) === norm);
    if (exact) return { matched: true, client: exact };

    // 2. First-name match
    const firstNameMatch = roster.find(
      (c) => normalize(c.name).split(" ")[0] === norm
    );
    if (firstNameMatch) return { matched: true, client: firstNameMatch };

    // 3. Fuzzy match (Levenshtein)
    let best: ClientStub | null = null;
    let bestDist = Infinity;

    for (const client of roster) {
      // Compare against full name
      const d1 = distance(norm, normalize(client.name));
      // Also compare against first name only
      const firstName = normalize(client.name).split(" ")[0];
      const d2 = distance(norm, firstName);
      const d = Math.min(d1, d2);

      if (d < bestDist) {
        bestDist = d;
        best = client;
      }
    }

    if (best && bestDist <= MAX_DISTANCE) {
      return { matched: true, client: best };
    }

    return { matched: false, input: name };
  });
}
