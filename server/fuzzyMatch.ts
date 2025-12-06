import { compareTwoStrings } from 'string-similarity';

/**
 * Fuzzy Match Module
 *
 * Validates player answers against correct answers using string similarity.
 * Accepts answers with typos, missing punctuation, or slight variations.
 *
 * Algorithm: Dice's Coefficient (string-similarity library)
 * Threshold: 0.8 (80% similarity required)
 *
 * Examples:
 * ✅ "Smells Like Teen Spirit" accepts "smells like teen spirt"
 * ✅ "Don't Stop Believin'" accepts "dont stop believing"
 * ✅ "Hotel California" accepts "hotel californa"
 * ❌ "Bohemian Rhapsody" rejects "bo rap" (too short)
 */

/**
 * Normalize a string for comparison
 * - Convert to lowercase
 * - Trim whitespace
 * - Remove punctuation (keep letters, numbers, spaces)
 * - Collapse multiple spaces into one
 *
 * @param str - String to normalize
 * @returns Normalized string
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')      // Remove punctuation
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .trim();
}

/**
 * Validate if a player's answer matches the correct answer
 *
 * @param playerAnswer - Player's guess
 * @param correctAnswer - Correct answer from Spotify
 * @param threshold - Similarity threshold (0-1), default 0.8
 * @returns true if answer is correct enough
 */
export function validateAnswer(
  playerAnswer: string,
  correctAnswer: string,
  threshold: number = 0.8
): boolean {
  // Handle empty answers
  if (!playerAnswer || !correctAnswer) {
    return false;
  }

  // Normalize both strings
  const playerNormalized = normalizeString(playerAnswer);
  const correctNormalized = normalizeString(correctAnswer);

  // Exact match after normalization
  if (playerNormalized === correctNormalized) {
    return true;
  }

  // Reject if player answer is suspiciously short (< 3 chars)
  // This prevents "bo" matching "Bohemian Rhapsody"
  if (playerNormalized.length < 3) {
    return false;
  }

  // Calculate similarity using Dice's Coefficient
  const similarity = compareTwoStrings(playerNormalized, correctNormalized);

  // Debug logging (helpful for tuning threshold)
  if (process.env.NODE_ENV === 'development') {
    console.log(`Fuzzy match: "${playerAnswer}" vs "${correctAnswer}" = ${(similarity * 100).toFixed(1)}%`);
  }

  return similarity >= threshold;
}

/**
 * Batch validate multiple correct answers (for variations)
 *
 * Some songs have multiple valid names:
 * - "Bohemian Rhapsody / Rap"
 * - "Song (feat. Artist)"
 *
 * @param playerAnswer - Player's guess
 * @param correctAnswers - Array of valid answers
 * @param threshold - Similarity threshold
 * @returns true if matches any correct answer
 */
export function validateAnswerMultiple(
  playerAnswer: string,
  correctAnswers: string[],
  threshold: number = 0.8
): boolean {
  return correctAnswers.some(correctAnswer =>
    validateAnswer(playerAnswer, correctAnswer, threshold)
  );
}

/**
 * Get the best matching answer from a list
 * Useful for showing which variation the player was closest to
 *
 * @param playerAnswer - Player's guess
 * @param correctAnswers - Array of valid answers
 * @returns Object with best match and similarity score
 */
export function getBestMatch(
  playerAnswer: string,
  correctAnswers: string[]
): { answer: string; similarity: number } {
  const playerNormalized = normalizeString(playerAnswer);

  let bestMatch = correctAnswers[0];
  let bestSimilarity = 0;

  for (const correctAnswer of correctAnswers) {
    const correctNormalized = normalizeString(correctAnswer);
    const similarity = compareTwoStrings(playerNormalized, correctNormalized);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = correctAnswer;
    }
  }

  return { answer: bestMatch, similarity: bestSimilarity };
}
