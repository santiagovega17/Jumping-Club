const LOWERCASE_WORDS_ES = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "en",
  "y",
  "a",
  "con",
]);

export function toTitleCase(str: string) {
  const words = str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((word, index) => {
      if (index > 0 && LOWERCASE_WORDS_ES.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
