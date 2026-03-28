import services from './services';
import { McpSwitchboard } from './mcp-switchboard';
import { McpSwitchboardServer } from './mcp-switchboard-server';

const port = Number(process.env.PORT ?? '4000');

const switchboard = services.resolveSingleton(McpSwitchboard);
const server = services.resolveSingleton(McpSwitchboardServer);

await switchboard.addServer('test-server', 'http://127.0.0.1:3000/mcp');

await server.start(port);
