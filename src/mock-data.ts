export function getMockTranscripts() {
  return [
    {
      id: 'transcript-001',
      clientName: 'Client X',
      date: '2024-10-15',
      participants: ['John (ACC)', 'Sarah (Client X)'],
      content: 'Discussion about Q4 forecasting concerns. The CFO expressed worry about accuracy...',
      chunks: [
        {
          speaker: 'Sarah',
          text: 'We are concerned about forecasting accuracy for Q4',
          timestamp: '00:05:23',
        },
      ],
      actionItems: [
        'Review forecasting models by month-end',
        'Schedule follow-up for November',
      ],
    },
    {
      id: 'transcript-002',
      clientName: 'Client Y',
      date: '2024-10-20',
      participants: ['John (ACC)', 'Mike (Client Y)'],
      content: 'Pipeline review and cash flow planning for next quarter...',
      chunks: [
        {
          speaker: 'Mike',
          text: 'Our cash flow projections need adjustment based on new contracts',
          timestamp: '00:10:45',
        },
      ],
      actionItems: [
        'Update cash flow model',
        'Send revised projections by Friday',
      ],
    },
    {
      id: 'transcript-003',
      clientName: 'Client X',
      date: '2024-10-22',
      participants: ['John (ACC)', 'Sarah (Client X)', 'Tom (Client X CFO)'],
      content: 'Follow-up on forecasting models. CFO wants better predictive accuracy by year-end...',
      chunks: [
        {
          speaker: 'Tom',
          text: 'We need those improved forecasting models implemented before Q4 close',
          timestamp: '00:15:30',
        },
      ],
      actionItems: [
        'Implement new forecasting algorithm',
        'Training session for Client X team',
      ],
    },
  ];
}