import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createTestMcpServer } from './mcp-server-factory.js'

const server = createTestMcpServer('cli-mcp')
const transport = new StdioServerTransport()

await server.connect(transport)
