/**
 * Offline helper: compute expected_context_hash + expected_context_size for raw captions.
 * v2: uses production-authoritative raw-byte semantics (no join separator).
 * Run: npx tsx eval/ragas/dataset/build-expected-hash.ts "caption A" "caption B" ...
 */
import { captionHash } from "../oracle/normalize-context"

const captions = process.argv.slice(2)
if (captions.length === 0) {
  console.error("Usage: npx tsx eval/ragas/dataset/build-expected-hash.ts <caption1> <caption2> ...")
  process.exit(1)
}

const { hash, size } = captionHash(captions)
console.log(JSON.stringify({ expected_context_hash: hash, expected_context_size: size }, null, 2))
