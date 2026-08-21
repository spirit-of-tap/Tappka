export function formatFileSize(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round((bytes / 1_000) * 10) / 10} KB`;
  return `${Math.round((bytes / 1_000_000) * 10) / 10} MB`;
}
