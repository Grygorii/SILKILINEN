// One owner for "how many questions the Style Finder asks", because the number
// is spoken about in two places: the quiz page's own intro and the homepage
// band that sells it.
//
// They drifted once already — the homepage promised four while the quiz page's
// intro said five. The quiz page now derives its copy from QUESTIONS.length, but
// the homepage band still needed the number in prose, and a code comment saying
// "keep these in sync" is not a guard. Importing the QUESTIONS array there is
// not an option: it would pull the whole quiz (all its option copy) into the
// homepage bundle for one word.
//
// So the count lives here, and StyleFinder.tsx asserts QUESTIONS.length against
// it — add or remove a question without updating this file and the quiz throws
// in development, loudly, next to the change that caused it.

export const QUESTION_COUNT = 4;

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

/** Spelled-out count for prose ("four"). */
export const QUESTION_COUNT_WORD = WORDS[QUESTION_COUNT] ?? String(QUESTION_COUNT);

/** Same, capitalised for the start of a sentence ("Four"). */
export const QUESTION_COUNT_WORD_CAPITALISED =
  QUESTION_COUNT_WORD.charAt(0).toUpperCase() + QUESTION_COUNT_WORD.slice(1);
