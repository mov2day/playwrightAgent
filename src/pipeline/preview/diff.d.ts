declare module 'diff' {
  export interface DiffPatchOptions {
    context?: number;
  }

  export interface StructuredPatchHunk {
    lines: string[];
  }

  export interface StructuredPatch {
    hunks: StructuredPatchHunk[];
  }

  export function createTwoFilesPatch(
    oldFileName: string,
    newFileName: string,
    oldStr: string,
    newStr: string,
    oldHeader?: string,
    newHeader?: string,
    options?: DiffPatchOptions
  ): string;

  export function structuredPatch(
    oldFileName: string,
    newFileName: string,
    oldStr: string,
    newStr: string,
    oldHeader?: string,
    newHeader?: string,
    options?: DiffPatchOptions
  ): StructuredPatch;
}
