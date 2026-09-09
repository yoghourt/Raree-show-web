/**
 * Cloudinary delivery helpers (display representation only).
 * Mirrors raree-show-admin/lib/cloudinary-display.ts (no shared package).
 */

const CLOUDINARY_UPLOAD_RE =
  /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload)\/(.*)$/i

export type CloudinaryDisplayOptions = {
  maxEdge?: number
  /** Cloudinary `q_` value, e.g. `auto`, `auto:good`, `auto:best`, `80`. */
  quality?: string
}

/**
 * Work-map Reader delivery. 2400 + `q_auto` (~0.2–0.3MB) is too soft once
 * the background camera crops at 2.2× cover; original PNG is ~9MB.
 * 4200 + `q_auto:best` stays readable at that crop (~1.4MB on the Sanguo map).
 */
export const WORK_MAP_DISPLAY_OPTIONS: CloudinaryDisplayOptions = {
  maxEdge: 4200,
  quality: "auto:best",
}

export function cloudinaryDisplayUrl(
  url: string,
  options?: CloudinaryDisplayOptions
): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed

  const match = CLOUDINARY_UPLOAD_RE.exec(trimmed)
  if (!match) return trimmed

  const base = match[1]
  let rest = match[2]
  rest = stripManagedDisplayTransforms(rest)

  const maxEdge = options?.maxEdge ?? 2400
  const quality = options?.quality?.trim() || "auto"
  const transforms = `w_${maxEdge},c_limit,f_auto,q_${quality}`
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
