export interface WordReplacementInput {
  original_word: string;
  replacement_word: string;
}

const parseCsvRow = (row: string): string[] => {
  const values: string[] = [];
  let value = '';
  let isQuoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];

    if (character === '"') {
      if (isQuoted && row[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
    } else if (character === ',' && !isQuoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
};

export const parseWordReplacementsCsv = (text: string): WordReplacementInput[] => {
  const rows = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((row) => row.trim() !== '');

  if (rows.length == 0) return [];

  const firstRow = parseCsvRow(rows[0]).map((value) => value.toLowerCase());
  const dataRows = firstRow[0]?.includes('original') ? rows.slice(1) : rows;

  return dataRows.flatMap((row) => {
    const [originalWord, replacementWord] = parseCsvRow(row);

    if (!originalWord || !replacementWord) return [];

    return [{
      original_word: originalWord,
      replacement_word: replacementWord,
    }];
  });
};
