import { Inquirerer, Question } from "inquirerer";

import { ExtractedVariables } from "./types";

const PLACEHOLDER_BOUNDARY = "____";

/**
 * Generate questions from extracted variables
 * @param extractedVariables - Variables extracted from the template
 * @returns Array of questions to prompt the user
 */
export function generateQuestions(
  extractedVariables: ExtractedVariables
): Question[] {
  const questions: Question[] = [];
  const askedVariables = new Set<string>();
  
  if (extractedVariables.projectQuestions) {
    for (const question of extractedVariables.projectQuestions.questions) {
      const normalizedName = normalizeQuestionName(question.name);
      question.name = normalizedName;
      questions.push(question);
      askedVariables.add(normalizedName);
    }
  }
  
  for (const replacer of extractedVariables.fileReplacers) {
    if (!askedVariables.has(replacer.variable)) {
      questions.push({
        name: replacer.variable,
        type: "text",
        message: `Enter value for ${replacer.variable}:`,
        required: true
      });
      askedVariables.add(replacer.variable);
    }
  }
  
  for (const replacer of extractedVariables.contentReplacers) {
    if (!askedVariables.has(replacer.variable)) {
      questions.push({
        name: replacer.variable,
        type: "text",
        message: `Enter value for ${replacer.variable}:`,
        required: true
      });
      askedVariables.add(replacer.variable);
    }
  }
  
  return questions;
}

function normalizeQuestionName(name: string): string {
  if (
    name.startsWith(PLACEHOLDER_BOUNDARY) &&
    name.endsWith(PLACEHOLDER_BOUNDARY)
  ) {
    return name.slice(
      PLACEHOLDER_BOUNDARY.length,
      -PLACEHOLDER_BOUNDARY.length
    );
  }
  if (name.startsWith("__") && name.endsWith("__")) {
    return name.slice(2, -2);
  }
  return name;
}

/**
 * Prompt the user for variable values
 * @param extractedVariables - Variables extracted from the template
 * @param argv - Command-line arguments to pre-populate answers
 * @param noTty - Whether to disable TTY mode
 * @returns Answers from the user
 */
export async function promptUser(
  extractedVariables: ExtractedVariables,
  argv: Record<string, any> = {},
  noTty: boolean = false
): Promise<Record<string, any>> {
  const questions = generateQuestions(extractedVariables);
  
  if (questions.length === 0) {
    return argv;
  }

  const preparedArgv = mapArgvToQuestions(argv, questions);
  
  const prompter = new Inquirerer({
    noTty
  });

  try {
    const promptAnswers = await prompter.prompt(preparedArgv, questions);
    const mergedAnswers = {
      ...argv,
      ...promptAnswers,
    };
    return expandAnswersForVariables(mergedAnswers, extractedVariables);
  } finally {
    if (typeof (prompter as any).close === "function") {
      (prompter as any).close();
    }
  }
}

function mapArgvToQuestions(
  argv: Record<string, any>,
  questions: Question[]
): Record<string, any> {
  if (!questions.length) {
    return argv;
  }

  const prepared = { ...argv };
  const argvEntries = Object.entries(argv);

  for (const question of questions) {
    const name = question.name;
    if (prepared[name] !== undefined) {
      continue;
    }

    const matchValue = findMatchingArgValue(name, argvEntries);
    if (matchValue !== null) {
      prepared[name] = matchValue;
    }
  }

  return prepared;
}

function findMatchingArgValue(
  targetName: string,
  argvEntries: [string, any][]
): any | null {
  const normalizedTarget = normalizeIdentifier(targetName);

  for (const [key, value] of argvEntries) {
    if (value === undefined || value === null) {
      continue;
    }

    if (key === targetName) {
      return value;
    }

    const normalizedKey = normalizeIdentifier(key);
    if (identifiersMatch(normalizedTarget, normalizedKey)) {
      return value;
    }
  }

  return null;
}

function normalizeIdentifier(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function identifiersMatch(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  if (a.includes(b) || b.includes(a)) {
    return true;
  }
  return hasSignificantOverlap(a, b);
}

function hasSignificantOverlap(a: string, b: string): boolean {
  const minLength = 4;
  if (a.length < minLength || b.length < minLength) {
    return false;
  }

  const shorter = a.length <= b.length ? a : b;
  const longer = shorter === a ? b : a;

  for (let i = 0; i <= shorter.length - minLength; i++) {
    const slice = shorter.slice(i, i + minLength);
    if (longer.includes(slice)) {
      return true;
    }
  }

  return false;
}

function expandAnswersForVariables(
  answers: Record<string, any>,
  extractedVariables: ExtractedVariables
): Record<string, any> {
  const expanded = { ...answers };
  const variables = collectVariableNames(extractedVariables);
  const answerEntries = Object.entries(expanded).map(([key, value]) => ({
    key,
    value,
    normalized: normalizeIdentifier(key),
  }));

  for (const variable of variables) {
    if (expanded[variable] !== undefined) {
      continue;
    }

    const normalizedVar = normalizeIdentifier(variable);
    const match = answerEntries.find(({ normalized }) =>
      identifiersMatch(normalizedVar, normalized)
    );

    if (match) {
      expanded[variable] = match.value;
      answerEntries.push({
        key: variable,
        value: match.value,
        normalized: normalizedVar,
      });
    }
  }

  return expanded;
}

function collectVariableNames(
  extractedVariables: ExtractedVariables
): Set<string> {
  const names = new Set<string>();
  for (const replacer of extractedVariables.fileReplacers) {
    names.add(replacer.variable);
  }
  for (const replacer of extractedVariables.contentReplacers) {
    names.add(replacer.variable);
  }
  if (extractedVariables.projectQuestions) {
    for (const question of extractedVariables.projectQuestions.questions) {
      names.add(normalizeQuestionName(question.name));
    }
  }
  return names;
}
