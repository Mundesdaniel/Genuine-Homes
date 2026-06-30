/**
 * Favorites contracts. Listing favorites returns full property summaries (so
 * the saved-properties page renders like search results); the lightweight ids
 * endpoint lets the client mark which cards are already favorited without
 * refetching every property.
 */

export interface FavoriteIdsResponse {
  propertyIds: string[];
}
