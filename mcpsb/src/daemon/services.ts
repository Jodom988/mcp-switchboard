import { ServiceProvider } from '../common/service-provider';
import { McpsbConfig } from '../common/config';
import { McpSwitchboard } from './mcp-switchboard';
import { McpSwitchboardServer } from './mcp-switchboard-server';

const services = new ServiceProvider();

services.registerSingleton(McpsbConfig);
services.registerSingleton(McpSwitchboard);
services.registerSingleton(McpSwitchboardServer);

export default services;
