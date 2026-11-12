/** Home tab title is the application name. */
export function homeDocumentTitle(brand: string): string {
  return brand
}

/** Reading tab title keeps the database subject, then the brand. */
export function readingDocumentTitle(subject: string, brand: string): string {
  const name = subject.trim()
  return name ? `${name} · ${brand}` : brand
}
