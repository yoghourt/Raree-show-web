/**
 * Cloudinary delivery helpers (display representation only).
 * Mirrors raree-show-admin/lib/cloudinary-display.ts — no shared package.
 */

const CLOUDINARY_UPLOAD =
  /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload)\/(.*)$/i

export type CloudinaryDisplayOptions = {
  maxEdge?: number
}

export function cloudinaryDisplayUrl(
  url: string,
  options?: CloudinaryDisplayOptions
): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed

  const match = CLOUDINARY_UPLOAD.exec(trimmed)
  if (!match) return trimmed

  const base = match[1]
  let rest = match[2]
  rest = stripManagedDisplayTransforms(rest)

  const maxEdge = options?.maxEdge ?? 2400
  const transforms = `w_${maxEdge},c_limit,f_auto,q_auto`
  return `${base}/${transforms}/${rest}`
}

function stripManagedDisplayTransforms(rest: string): string {
  const parts = rest.split("/")
  if (parts.length === 0) return rest
  const first = parts[0] ?? ""
  if (isTransformSegment(first)) {
    return parts.slice(1).join("/")
  }
  return rest
}

function isTransformSegment(segment: string): boolean {
  if (!segment) return false
  if (/^v\d+$/i.test(segment)) return false
  return /(?:^|,)(?:w_|h_|c_|f_|q_|fl_|dpr_)/.test(segment)
}
