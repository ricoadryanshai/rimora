import { parseWordReplacementsCsv, type WordReplacementInput } from "@/lib/word-replacements-csv";

const CSV_EXTENSION = '.csv';
const EXCEL_EXTENSIONS = ['.xlsx'];

const getFileExtension = (fileName: string) => {
  const extensionStart = fileName.lastIndexOf('.');
  return extensionStart >= 0 ? fileName.slice(extensionStart).toLowerCase() : '';
};

const parseWorksheetRows = (rows: unknown[][]): WordReplacementInput[] => {
  const populatedRows = rows.filter((row) => row.some((value) => String(value ?? '').trim() !== ''));
  if (populatedRows.length == 0) return [];

  const firstCell = String(populatedRows[0][0] ?? '').trim().toLowerCase();
  const dataRows = firstCell.includes('original') ? populatedRows.slice(1) : populatedRows;

  return dataRows.flatMap((row) => {
    const originalWord = String(row[0] ?? '').trim();
    const replacementWord = String(row[1] ?? '').trim();

    if (!originalWord || !replacementWord) return [];

    return [{
      original_word: originalWord,
      replacement_word: replacementWord,
    }];
  });
};

export const isSupportedWordMappingsFile = (file: File) => {
  const extension = getFileExtension(file.name);
  return extension === CSV_EXTENSION || EXCEL_EXTENSIONS.includes(extension);
};

export const parseWordMappingsFile = async (file: File): Promise<WordReplacementInput[]> => {
  const extension = getFileExtension(file.name);

  if (extension === CSV_EXTENSION) {
    return parseWordReplacementsCsv(await file.text());
  }

  if (!EXCEL_EXTENSIONS.includes(extension)) {
    throw new Error('Unsupported word mappings file type');
  }

  const { default: readXlsxFile } = await import('read-excel-file/browser');
  return parseWorksheetRows(await readXlsxFile(file));
};
