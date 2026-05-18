/**
 * Offline helper: compute expected_context_hash + expected_context_size for contexts.
 * Run: npx tsx eval/ragas/dataset/build-expected-hash.ts
 */
import { hashContexts } from "../oracle/normalize-context"

const contexts = process.argv.slice(2)
if (contexts.length === 0) {
  console.error("Usage: npx tsx eval/ragas/dataset/build-expected-hash.ts <context-file>...")
  console.error("  Or pipe JSON array of context strings via stdin")
  process.exit(1)
}

const { hash, size } = hashContexts(contexts)
console.log(JSON.stringify({ expected_context_hash: hash, expected_context_size: size }, null, 2))
