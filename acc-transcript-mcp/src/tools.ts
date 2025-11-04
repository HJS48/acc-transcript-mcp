// Tool definitions - will be expanded later
export const toolDefinitions = {
  searchTranscripts: {
    name: 'searchTranscripts',
    description: 'Search call transcripts for specific topics or keywords',
    parameters: {
      query: 'string',
      clientFilter: 'string?',
      dateFrom: 'string?',
      dateTo: 'string?',
    },
  },
  getTranscriptDetails: {
    name: 'getTranscriptDetails',
    description: 'Get full details of a specific transcript',
    parameters: {
      transcriptId: 'string',
    },
  },
  listRecentCalls: {
    name: 'listRecentCalls',
    description: 'List recent client calls',
    parameters: {
      limit: 'number?',
    },
  },
};
