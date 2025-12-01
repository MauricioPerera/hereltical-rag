/**
 * Mock Tools for Testing
 */

import { Tool } from '../../types.js';

export const mockTools: Tool[] = [
  {
    id: 'http_request',
    name: 'HTTP Request',
    type: 'tool',
    category: 'network',
    description: 'Make HTTP requests to external APIs',
    parameters: [
      {
        name: 'url',
        type: 'string',
        required: true,
        description: 'Target URL'
      },
      {
        name: 'method',
        type: 'string',
        required: false,
        description: 'HTTP method (GET, POST, etc)',
        defaultValue: 'GET'
      },
      {
        name: 'headers',
        type: 'object',
        required: false,
        description: 'HTTP headers'
      },
      {
        name: 'body',
        type: 'any',
        required: false,
        description: 'Request body'
      }
    ],
    outputs: [
      {
        name: 'response',
        type: 'object',
        description: 'HTTP response'
      }
    ],
    examples: [
      {
        name: 'GET request',
        input: {
          url: 'https://api.example.com/data',
          method: 'GET'
        },
        output: {
          status: 200,
          data: {}
        }
      }
    ]
  },
  
  {
    id: 'db_query',
    name: 'Database Query',
    type: 'tool',
    category: 'database',
    description: 'Execute SQL queries against a database',
    parameters: [
      {
        name: 'query',
        type: 'string',
        required: true,
        description: 'SQL query to execute'
      },
      {
        name: 'params',
        type: 'array',
        required: false,
        description: 'Query parameters'
      }
    ],
    outputs: [
      {
        name: 'rows',
        type: 'array',
        description: 'Query results'
      },
      {
        name: 'rowCount',
        type: 'number',
        description: 'Number of rows affected'
      }
    ],
    examples: [
      {
        name: 'Select users',
        input: {
          query: 'SELECT * FROM users WHERE id = ?',
          params: [1]
        },
        output: {
          rows: [{ id: 1, name: 'John' }],
          rowCount: 1
        }
      }
    ]
  },
  
  {
    id: 'file_write',
    name: 'File Write',
    type: 'tool',
    category: 'filesystem',
    description: 'Write content to a file',
    parameters: [
      {
        name: 'path',
        type: 'string',
        required: true,
        description: 'File path'
      },
      {
        name: 'content',
        type: 'string',
        required: true,
        description: 'Content to write'
      },
      {
        name: 'encoding',
        type: 'string',
        required: false,
        description: 'File encoding',
        defaultValue: 'utf8'
      }
    ],
    outputs: [
      {
        name: 'success',
        type: 'boolean',
        description: 'Whether write succeeded'
      },
      {
        name: 'bytesWritten',
        type: 'number',
        description: 'Number of bytes written'
      }
    ],
    examples: [
      {
        name: 'Write text file',
        input: {
          path: '/tmp/test.txt',
          content: 'Hello world'
        },
        output: {
          success: true,
          bytesWritten: 11
        }
      }
    ]
  },
  
  {
    id: 'code_executor',
    name: 'Code Executor',
    type: 'tool',
    category: 'computation',
    description: 'Execute code in isolated environment',
    parameters: [
      {
        name: 'code',
        type: 'string',
        required: true,
        description: 'Code to execute'
      },
      {
        name: 'language',
        type: 'string',
        required: true,
        description: 'Programming language'
      },
      {
        name: 'timeout',
        type: 'number',
        required: false,
        description: 'Execution timeout in ms',
        defaultValue: 5000
      }
    ],
    outputs: [
      {
        name: 'result',
        type: 'any',
        description: 'Execution result'
      },
      {
        name: 'stdout',
        type: 'string',
        description: 'Standard output'
      },
      {
        name: 'stderr',
        type: 'string',
        description: 'Standard error'
      }
    ],
    examples: [
      {
        name: 'Execute Python',
        input: {
          code: 'print(2 + 2)',
          language: 'python'
        },
        output: {
          result: null,
          stdout: '4\n',
          stderr: ''
        }
      }
    ]
  },
  
  {
    id: 'email_sender',
    name: 'Email Sender',
    type: 'tool',
    category: 'communication',
    description: 'Send emails via SMTP',
    parameters: [
      {
        name: 'to',
        type: 'string',
        required: true,
        description: 'Recipient email'
      },
      {
        name: 'subject',
        type: 'string',
        required: true,
        description: 'Email subject'
      },
      {
        name: 'body',
        type: 'string',
        required: true,
        description: 'Email body'
      },
      {
        name: 'from',
        type: 'string',
        required: false,
        description: 'Sender email'
      }
    ],
    outputs: [
      {
        name: 'messageId',
        type: 'string',
        description: 'Sent message ID'
      },
      {
        name: 'success',
        type: 'boolean',
        description: 'Whether email was sent'
      }
    ],
    examples: [
      {
        name: 'Send notification',
        input: {
          to: 'user@example.com',
          subject: 'Test',
          body: 'Hello!'
        },
        output: {
          messageId: '<abc123@mail>',
          success: true
        }
      }
    ]
  }
];

/**
 * Get mock tool by ID
 */
export function getMockTool(id: string): Tool | undefined {
  return mockTools.find(t => t.id === id);
}

/**
 * Get mock tools by category
 */
export function getMockToolsByCategory(category: string): Tool[] {
  return mockTools.filter(t => t.category === category);
}

