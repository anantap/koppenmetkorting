/**
 * Leest een feed van een lokaal pad (sample-CSV, of een door een refresh-script
 * al gedownloade live feed) of van een HTTP(S)-URL. Adapters weten zo niet of
 * hun bron lokaal of remote is -- alleen scripts/build-data.ts en de
 * refresh-scripts/workflow bepalen welke van de twee van toepassing is.
 */
export async function readFeedSource(pathOrUrl: string): Promise<string> {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const response = await fetch(pathOrUrl);
    if (!response.ok) {
      throw new Error(`Kon feed niet ophalen van ${pathOrUrl}: HTTP ${response.status}`);
    }
    return response.text();
  }
  const fs = await import('node:fs/promises');
  return fs.readFile(pathOrUrl, 'utf-8');
}
