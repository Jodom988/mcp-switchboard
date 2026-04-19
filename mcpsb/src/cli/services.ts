import { McpsbConfig } from '../common/config';
import { ServiceProvider } from '../common/service-provider';

const services = new ServiceProvider();

services.registerSingleton(McpsbConfig);

export default services;
