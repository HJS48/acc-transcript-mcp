// src/types.ts
export interface SearchTranscriptsArgs {
  query: string;
  clientFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface GetTranscriptDetailsArgs {
  transcriptId: string;
}

export interface ListRecentCallsArgs {
  limit?: number;
}