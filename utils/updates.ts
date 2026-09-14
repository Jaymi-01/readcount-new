export function extractUpdateMessage(manifest: any): string | null {
  if (!manifest) return null;
  if (manifest.metadata && typeof manifest.metadata === 'object' && manifest.metadata.message) {
    return manifest.metadata.message;
  }
  if (manifest.metadata && typeof manifest.metadata === 'string') {
    try {
      const parsed = JSON.parse(manifest.metadata);
      if (parsed?.message) return parsed.message;
    } catch {}
  }
  if (manifest.extra?.eas?.message) return manifest.extra.eas.message;
  if (manifest.extra?.expoClient?.extra?.message) return manifest.extra.expoClient.extra.message;
  if (manifest.extra?.message) return manifest.extra.message;
  if (manifest.message) return manifest.message;
  if (manifest.rawManifest) return extractUpdateMessage(manifest.rawManifest);
  return null;
}
