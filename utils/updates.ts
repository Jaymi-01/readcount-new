import Constants from 'expo-constants';
import { RELEASE_INFO } from '../constants/release';

export function extractUpdateMessage(manifest: any): string | null {
  if (manifest) {
    // 1. Check extra.expoClient.extra (Standard EAS Update manifest)
    const clientExtra = manifest.extra?.expoClient?.extra;
    if (clientExtra?.updateMessage && typeof clientExtra.updateMessage === 'string' && clientExtra.updateMessage.trim()) {
      return clientExtra.updateMessage.trim();
    }
    if (clientExtra?.message && typeof clientExtra.message === 'string' && clientExtra.message.trim()) {
      return clientExtra.message.trim();
    }

    // 2. Check metadata
    if (manifest.metadata && typeof manifest.metadata === 'object') {
      if (manifest.metadata.updateMessage && typeof manifest.metadata.updateMessage === 'string') {
        return manifest.metadata.updateMessage.trim();
      }
      if (manifest.metadata.message && typeof manifest.metadata.message === 'string') {
        return manifest.metadata.message.trim();
      }
    }
    if (manifest.metadata && typeof manifest.metadata === 'string') {
      try {
        const parsed = JSON.parse(manifest.metadata);
        if (parsed?.updateMessage && typeof parsed.updateMessage === 'string') {
          return parsed.updateMessage.trim();
        }
        if (parsed?.message && typeof parsed.message === 'string') {
          return parsed.message.trim();
        }
      } catch {}
    }

    // 3. Check extra directly
    if (manifest.extra?.updateMessage && typeof manifest.extra.updateMessage === 'string') {
      return manifest.extra.updateMessage.trim();
    }
    if (manifest.extra?.message && typeof manifest.extra.message === 'string') {
      return manifest.extra.message.trim();
    }
    if (manifest.extra?.eas?.message && typeof manifest.extra.eas.message === 'string') {
      return manifest.extra.eas.message.trim();
    }

    // 4. Check root fields
    if (manifest.updateMessage && typeof manifest.updateMessage === 'string') {
      return manifest.updateMessage.trim();
    }
    if (manifest.message && typeof manifest.message === 'string') {
      return manifest.message.trim();
    }

    // 5. Check rawManifest
    if (manifest.rawManifest) {
      const fromRaw = extractUpdateMessage(manifest.rawManifest);
      if (fromRaw) return fromRaw;
    }
  }

  // Fallback to Constants config (currently running app extra)
  const configExtra = Constants.expoConfig?.extra || (Constants.manifest as any)?.extra?.expoClient?.extra;
  if (configExtra?.updateMessage && typeof configExtra.updateMessage === 'string' && configExtra.updateMessage.trim()) {
    return configExtra.updateMessage.trim();
  }
  if (configExtra?.message && typeof configExtra.message === 'string' && configExtra.message.trim()) {
    return configExtra.message.trim();
  }

  // Fallback to bundled release info
  if (RELEASE_INFO?.message && typeof RELEASE_INFO.message === 'string' && RELEASE_INFO.message.trim()) {
    return RELEASE_INFO.message.trim();
  }

  return null;
}
