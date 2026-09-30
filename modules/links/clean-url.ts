import { getTrackerCategory, type TrackerCategory } from "./tracker-categories";

export interface RemovedTracker {
  name: string;
  category: TrackerCategory;
}

export interface CleanUrlResult {
  originalUrl: string;
  cleanedUrl: string;
  changed: boolean;
  /** One entry per distinct tracker name, for display. */
  removed: RemovedTracker[];
  /** One count per occurrence removed from the query, including repeats. */
  removedCount: number;
}

export interface UrlAnalysis {
  originalUrl: string;
  cleanUrl: string;
  statistics: {
    totalParameters: number;
    trackingParameters: number;
    preservedParameters: number;
    originalLength: number;
    cleanLength: number;
    charactersRemoved: number;
  };
  removedParameters: string[];
  preservedParameters: string[];
}

/**
 * Removes only parameters explicitly classified as tracking and only from the
 * selected categories. Unknown parameters, path, port and fragment are kept.
 */
export function cleanUrl(
  input: string,
  categories?: ReadonlyArray<TrackerCategory>,
): CleanUrlResult {
  const original = new URL(input);
  const url = new URL(input);

  const removedByName = new Map<string, TrackerCategory>();
  let removedCount = 0;

  for (const [name] of original.searchParams) {
    const category = getTrackerCategory(name);
    if (!category || (categories && !categories.includes(category))) continue;
    removedCount += 1;
    removedByName.set(name, category);
    url.searchParams.delete(name);
  }

  return {
    originalUrl: input,
    cleanedUrl: url.toString(),
    changed: removedByName.size > 0,
    removed: [...removedByName].map(([name, category]) => ({ name, category })),
    removedCount,
  };
}

/**
 * Statistics count every occurrence so that
 * `trackingParameters + preservedParameters === totalParameters` always holds.
 * The `removedParameters` / `preservedParameters` lists hold distinct names and
 * are meant for display.
 */
export function analyzeUrl(
  input: string,
  categories?: ReadonlyArray<TrackerCategory>,
): UrlAnalysis {
  const original = new URL(input);
  const totalParameters = [...original.searchParams].length;

  const cleaned = cleanUrl(input, categories);
  const clean = new URL(cleaned.cleanedUrl);
  const preservedEntries = [...clean.searchParams];
  const preservedParameters = [
    ...new Set(preservedEntries.map(([name]) => name)),
  ];
  const cleanLength = cleaned.cleanedUrl.length;

  return {
    originalUrl: input,
    cleanUrl: cleaned.cleanedUrl,
    statistics: {
      totalParameters,
      trackingParameters: cleaned.removedCount,
      preservedParameters: preservedEntries.length,
      originalLength: input.length,
      cleanLength,
      charactersRemoved: Math.max(0, input.length - cleanLength),
    },
    removedParameters: cleaned.removed.map(({ name }) => name),
    preservedParameters,
  };
}
