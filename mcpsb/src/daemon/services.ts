import { ServiceProvider } from '../common/service-provider';
import { McpSwitchboard } from './mcp-switchboard';
import { McpSwitchboardServer } from './mcp-switchboard-server';

const services = new ServiceProvider();

services.registerSingleton(McpSwitchboard);
services.registerSingleton(McpSwitchboardServer);

export default services;
