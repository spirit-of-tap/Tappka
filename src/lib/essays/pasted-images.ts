/**
 * Images arriving via clipboard paste (Ctrl+V) or file drop.
 *
 * Kept as a pure helper so the "which files do we handle?" decision is
 * unit-testable without spinning up the editor: anything image-typed is
 * ours and flows into the normal upload pipeline, everything else is left
 * for the editor's default paste/drop handling.
 */
export function extractImageFiles(
  files: ArrayLike<File> | File[] | null | undefined,
): File[] {
  if (!files) return [];
  return Array.from(files).filter((file) => file.type.startsWith('image/'));
}
