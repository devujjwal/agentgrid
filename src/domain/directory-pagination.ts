/** Only finite pages of the existing catalogue; search/filter URLs are not pages. */
export const directoryPageSize = 30;
export function directoryPages(resourceCount: number): number[] {
  const count = Math.ceil(Math.min(Math.max(resourceCount, 0), 10_000) / directoryPageSize);
  return Array.from({ length: Math.max(0, count - 1) }, (_, index) => index + 2);
}
export function directoryPagePath(page: number): string {
  return page === 1 ? '/agents/' : `/agents/page/${page}/`;
}
