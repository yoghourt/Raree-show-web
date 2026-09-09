/**
 * Cloudinary display URL builder.
 * Run: npx tsx scripts/verify-cloudinary-display.ts
 */
import assert from "node:assert/strict"
import {
  cloudinaryDisplayUrl,
  WORK_MAP_DISPLAY_OPTIONS,
} from "../src/lib/cloudinary-display"

const original =
  "https://res.cloudinary.com/dnuxz94n5/image/upload/v1788861483/vnsuqggr4fo6rxw08mhk.png"

assert.equal(
  cloudinaryDisplayUrl(original, { maxEdge: 2400 }),
  "https://res.cloudinary.com/dnuxz94n5/image/upload/w_2400,c_limit,f_auto,q_auto/v1788861483/vnsuqggr4fo6rxw08mhk.png"
)

assert.equal(
  cloudinaryDisplayUrl(original, WORK_MAP_DISPLAY_OPTIONS),
  "https://res.cloudinary.com/dnuxz94n5/image/upload/w_4200,c_limit,f_auto,q_auto:best/v1788861483/vnsuqggr4fo6rxw08mhk.png"
)

assert.equal(
  cloudinaryDisplayUrl(
    "https://res.cloudinary.com/dnuxz94n5/image/upload/w_2400,c_limit,f_auto,q_auto/v1788861483/vnsuqggr4fo6rxw08mhk.png",
    WORK_MAP_DISPLAY_OPTIONS
  ),
  "https://res.cloudinary.com/dnuxz94n5/image/upload/w_4200,c_limit,f_auto,q_auto:best/v1788861483/vnsuqggr4fo6rxw08mhk.png",
  "strips a previous display transform before applying the new one"
)

assert.equal(cloudinaryDisplayUrl("/maps/local.jpg"), "/maps/local.jpg")

console.log("verify-cloudinary-display: ok")
