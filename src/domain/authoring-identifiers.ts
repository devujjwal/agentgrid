/** Pick a portable identifier without reusing a surviving row after removal. */
export function nextAuthoringIdentifier(prefix: string, existing: readonly string[]): string {
  const used = new Set(existing);
  let number = 1;
  while (used.has(prefix + '-' + number)) number++;
  return prefix + '-' + number;
}
