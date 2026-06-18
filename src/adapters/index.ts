import { affiliateFeedAdapters } from './affiliate-feed.js';
import { bolAdapter } from './bol.js';
import type { SourceAdapter } from '../lib/types.js';

// amazonAdapter bewust NIET opgenomen — zie src/adapters/amazon.ts voor de
// reden (PA-API-toegang vereist eerst kwalificerende sales). Voeg
// `amazonAdapter` hier toe zodra credentials beschikbaar zijn.

/**
 * Actieve adapter-registry. Een nieuwe bron toevoegen = één regel hier
 * (en eventueel een nieuwe FeedConfig-entry in affiliate-feed.ts).
 */
export const adapters: SourceAdapter[] = [bolAdapter, ...affiliateFeedAdapters];
