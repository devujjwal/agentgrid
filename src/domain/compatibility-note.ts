const preReleaseStatements = [
  'This editorial draft has not been tested on a real host and must not be advertised as verified until all required scenarios pass.',
  'Provider/model behavior must be checked against the included examples before this draft is advertised as tested.',
];

/** Keep immutable authoring text available, with its original release context. */
export function compatibilityNote(note: string, published: boolean) {
  const historical =
    published && preReleaseStatements.some((statement) => note.includes(statement));
  if (!historical) return { current: note, original: null };
  let current = note;
  for (const statement of preReleaseStatements)
    current = current.replace(
      statement,
      'This version is published. Check its behavior against the included examples in your own provider and model before relying on the output.',
    );
  return { current, original: note };
}
