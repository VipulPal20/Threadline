const STOPWORDS = new Set(
  "a an and are as at be but by for from has have i in is it its me my of on or our so that the their them this to us was we with you your am can will would should need needs looking want help get any some who what how".split(" "),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9+#.]*/g) ?? [])
    .map((token) => token.replace(/\.+$/, ""))
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

/**
 * TF-IDF cosine similarity between one query text and each document. Inverse document
 * frequency is computed over the query plus all documents, so it adapts to the candidate pool.
 * Pure and deterministic.
 */
export function tfidfCosine(query: string, documents: readonly string[]): number[] {
  const docs = [query, ...documents].map((text) => termFrequencies(tokenize(text)));
  const total = docs.length;
  const documentFrequency = new Map<string, number>();
  for (const doc of docs) for (const term of doc.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);

  const vector = (doc: Map<string, number>) => {
    const weights = new Map<string, number>();
    let norm = 0;
    for (const [term, count] of doc) {
      const weight = (1 + Math.log(count)) * (Math.log((total + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1);
      weights.set(term, weight);
      norm += weight * weight;
    }
    return { weights, norm: Math.sqrt(norm) };
  };

  const queryVector = vector(docs[0]!);
  return docs.slice(1).map((doc) => {
    const docVector = vector(doc);
    if (queryVector.norm === 0 || docVector.norm === 0) return 0;
    let dot = 0;
    for (const [term, weight] of queryVector.weights) dot += weight * (docVector.weights.get(term) ?? 0);
    return Math.max(0, Math.min(1, dot / (queryVector.norm * docVector.norm)));
  });
}

/** Share of the smaller token set that also appears in the other (0 to 1). */
export function tokenOverlap(a: string | null | undefined, b: string | null | undefined): number {
  const left = new Set(tokenize(a ?? ""));
  const right = new Set(tokenize(b ?? ""));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = a?.trim().toLowerCase();
  return Boolean(left) && left === b?.trim().toLowerCase();
}
