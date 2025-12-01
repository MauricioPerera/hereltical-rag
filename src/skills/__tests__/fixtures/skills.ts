/**
 * Mock Skills for Testing
 */

import { Skill } from '../../types.js';

export const mockSkills: Skill[] = [
  {
    id: 'stripe_api_handler',
    name: 'Stripe API Handler',
    type: 'skill',
    skillType: 'tool_based',
    category: 'payment',
    overview: 'Handle Stripe API operations including customer management, payment processing, and subscription handling',
    usesTools: ['http_request'],
    instructions: {
      steps: [
        'Configure Stripe API credentials',
        'Prepare request with appropriate endpoint',
        'Set authentication headers',
        'Execute HTTP request',
        'Parse and validate response'
      ],
      prerequisites: [
        'Valid Stripe API key',
        'Network connectivity'
      ],
      bestPractices: [
        'Always use HTTPS',
        'Handle rate limiting',
        'Validate webhook signatures'
      ],
      antiPatterns: [
        'Hardcoding API keys',
        'Ignoring error responses',
        'Not handling idempotency'
      ]
    },
    parameters: [
      {
        name: 'action',
        type: 'string',
        required: true,
        description: 'Stripe action (create_customer, charge, etc)'
      },
      {
        name: 'data',
        type: 'object',
        required: true,
        description: 'Action-specific data'
      }
    ],
    outputs: [
      {
        name: 'result',
        type: 'object',
        description: 'Stripe API response'
      }
    ],
    examples: [
      {
        name: 'Create customer',
        input: {
          action: 'create_customer',
          data: { email: 'test@example.com' }
        },
        output: {
          id: 'cus_123',
          email: 'test@example.com'
        }
      }
    ]
  },
  
  {
    id: 'pdf_report_generator',
    name: 'PDF Report Generator',
    type: 'skill',
    skillType: 'tool_based',
    category: 'reporting',
    overview: 'Generate PDF reports from data using code execution and file writing',
    usesTools: ['code_executor', 'file_write'],
    instructions: {
      steps: [
        'Prepare data for report',
        'Execute Python code with reportlab',
        'Generate PDF bytes',
        'Write PDF to file system',
        'Return file path'
      ],
      prerequisites: [
        'reportlab library available',
        'Write permissions'
      ],
      bestPractices: [
        'Validate data before generation',
        'Use templates for consistency',
        'Handle large datasets efficiently'
      ],
      antiPatterns: [
        'Loading entire dataset in memory',
        'Not handling special characters',
        'Ignoring page breaks'
      ]
    },
    parameters: [
      {
        name: 'data',
        type: 'object',
        required: true,
        description: 'Report data'
      },
      {
        name: 'template',
        type: 'string',
        required: false,
        description: 'Report template'
      },
      {
        name: 'outputPath',
        type: 'string',
        required: true,
        description: 'Output file path'
      }
    ],
    outputs: [
      {
        name: 'filePath',
        type: 'string',
        description: 'Generated PDF path'
      },
      {
        name: 'pageCount',
        type: 'number',
        description: 'Number of pages'
      }
    ],
    examples: [
      {
        name: 'Sales report',
        input: {
          data: { sales: [100, 200, 300] },
          outputPath: '/reports/sales.pdf'
        },
        output: {
          filePath: '/reports/sales.pdf',
          pageCount: 1
        }
      }
    ]
  },
  
  {
    id: 'user_crud_manager',
    name: 'User CRUD Manager',
    type: 'skill',
    skillType: 'tool_based',
    category: 'database',
    overview: 'Complete user management with CRUD operations',
    usesTools: ['db_query'],
    instructions: {
      steps: [
        'Validate input data',
        'Prepare SQL query based on operation',
        'Execute query with parameters',
        'Handle constraints and errors',
        'Return formatted result'
      ],
      prerequisites: [
        'Database connection configured',
        'Users table exists'
      ],
      bestPractices: [
        'Use parameterized queries',
        'Validate email format',
        'Hash passwords',
        'Use transactions'
      ],
      antiPatterns: [
        'SQL injection vulnerabilities',
        'Storing plain passwords',
        'Not handling unique constraints'
      ]
    },
    parameters: [
      {
        name: 'operation',
        type: 'string',
        required: true,
        description: 'CRUD operation (create, read, update, delete)'
      },
      {
        name: 'userData',
        type: 'object',
        required: true,
        description: 'User data'
      }
    ],
    outputs: [
      {
        name: 'user',
        type: 'object',
        description: 'User record'
      },
      {
        name: 'affected',
        type: 'number',
        description: 'Rows affected'
      }
    ],
    examples: [
      {
        name: 'Create user',
        input: {
          operation: 'create',
          userData: { email: 'john@example.com', name: 'John' }
        },
        output: {
          user: { id: 1, email: 'john@example.com', name: 'John' },
          affected: 1
        }
      }
    ]
  },
  
  {
    id: 'data_fetcher_aggregator',
    name: 'Data Fetcher & Aggregator',
    type: 'skill',
    skillType: 'tool_based',
    category: 'data',
    overview: 'Fetch data from multiple HTTP endpoints and aggregate results',
    usesTools: ['http_request', 'code_executor'],
    instructions: {
      steps: [
        'Parse list of endpoints',
        'Execute parallel HTTP requests',
        'Collect all responses',
        'Run aggregation code',
        'Return aggregated data'
      ],
      prerequisites: [
        'All endpoints accessible',
        'Response format consistent'
      ],
      bestPractices: [
        'Handle timeouts gracefully',
        'Implement retry logic',
        'Cache when possible',
        'Aggregate efficiently'
      ],
      antiPatterns: [
        'Sequential requests (slow)',
        'Not handling partial failures',
        'Memory overflow on large datasets'
      ]
    },
    parameters: [
      {
        name: 'endpoints',
        type: 'array',
        required: true,
        description: 'List of URLs to fetch'
      },
      {
        name: 'aggregationLogic',
        type: 'string',
        required: false,
        description: 'Custom aggregation code'
      }
    ],
    outputs: [
      {
        name: 'aggregatedData',
        type: 'object',
        description: 'Aggregated results'
      },
      {
        name: 'fetchCount',
        type: 'number',
        description: 'Number of successful fetches'
      }
    ],
    examples: [
      {
        name: 'Aggregate API responses',
        input: {
          endpoints: ['https://api1.com/data', 'https://api2.com/data']
        },
        output: {
          aggregatedData: { total: 100, sources: 2 },
          fetchCount: 2
        }
      }
    ]
  },
  
  {
    id: 'create_cornell_notes',
    name: 'Create Cornell Notes',
    type: 'skill',
    skillType: 'instructional',
    category: 'knowledge',
    overview: 'Structure text content into Cornell Notes format using native LLM capabilities',
    usesTools: [],
    nativeCapabilities: ['text_generation', 'summarization', 'structuring'],
    template: `# Cornell Notes

## Cue Column (Questions/Keywords)
- [Key question 1]
- [Key question 2]

## Notes Column (Main content)
[Detailed notes here]

## Summary Section
[Brief summary of the entire content]`,
    methodology: 'Cornell Note-Taking System: divide page into cue, notes, and summary sections',
    instructions: {
      steps: [
        'Read and understand the input text',
        'Extract key concepts and questions for Cue column',
        'Structure main content in Notes column',
        'Write concise summary at bottom',
        'Format according to Cornell template'
      ],
      prerequisites: [
        'Input text provided'
      ],
      bestPractices: [
        'Keep cue column concise',
        'Use bullet points in notes',
        'Summary should be 2-3 sentences',
        'Focus on main ideas'
      ],
      antiPatterns: [
        'Too detailed cue column',
        'Missing summary section',
        'Not following template structure'
      ]
    },
    parameters: [
      {
        name: 'inputText',
        type: 'string',
        required: true,
        description: 'Text to convert to Cornell notes'
      },
      {
        name: 'focusAreas',
        type: 'array',
        required: false,
        description: 'Specific areas to emphasize'
      }
    ],
    outputs: [
      {
        name: 'cornellNotes',
        type: 'string',
        description: 'Formatted Cornell notes'
      }
    ],
    examples: [
      {
        name: 'Lecture notes',
        input: {
          inputText: 'Photosynthesis is the process by which plants...'
        },
        output: {
          cornellNotes: '# Cornell Notes\n## Cue\n- What is photosynthesis?...'
        }
      }
    ]
  }
];

/**
 * Get mock skill by ID
 */
export function getMockSkill(id: string): Skill | undefined {
  return mockSkills.find(s => s.id === id);
}

/**
 * Get mock skills by category
 */
export function getMockSkillsByCategory(category: string): Skill[] {
  return mockSkills.filter(s => s.category === category);
}

/**
 * Get skills that use a specific tool
 */
export function getMockSkillsByTool(toolId: string): Skill[] {
  return mockSkills.filter(s => s.usesTools.includes(toolId));
}

