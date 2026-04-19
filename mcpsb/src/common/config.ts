import { readFileSync } from 'node:fs';

import { ServiceProvider, SingletonBase } from './service-provider';

export class McpsbConfig extends SingletonBase {
	public readonly daemonPort: number;
	public readonly isPackaged: boolean;
	public readonly savedConfig: any;

	public constructor(serviceProvider: ServiceProvider) {
		super(serviceProvider);

		this.daemonPort = this.readIntEnvVar('MCPSB_DAEMON_PORT', 9595);
		this.isPackaged = this.readBoolEnvVar('MCPSB_IS_PACKAGED', true);

		const configFilePath = (() => {
			if (this.isPackaged) {
				return `${process.env.HOME}/.mcpsb/config.json`;
			}
			return '../../config/config.json';
		})();

		try {
			this.savedConfig = JSON.parse(readFileSync(configFilePath, 'utf-8'));
		} catch {
			this.savedConfig = {};
		}
	}

	private readBoolEnvVar(key: string, defaultValue: boolean): boolean;
	private readBoolEnvVar(key: string, defaultValue?: undefined): boolean | undefined;
	private readBoolEnvVar(key: string, defaultValue?: boolean): boolean | undefined {
		const value = this.readStrEnvVar(key);
		if (value === undefined) {
			return defaultValue;
		}
		if (value.toLowerCase() === 'true' || value === '1') {
			return true;
		}
		return false;
	}

	private readIntEnvVar(key: string, defaultValue: number): number;
	private readIntEnvVar(key: string, defaultValue?: undefined): number | undefined;
	private readIntEnvVar(key: string, defaultValue?: number): number | undefined {
		const value = this.readStrEnvVar(key);
		if (value === undefined) {
			return defaultValue;
		}
		const intValue = parseInt(value, 10);
		if (isNaN(intValue)) {
			throw new Error(`Environment variable ${key} must be a valid integer`);
		}
		return intValue;
	}

	private readStrEnvVar(key: string, defaultValue?: string): string | undefined {
		try {
			return this.readRequiredStrEnvVar(key);
		} catch (error) {
			return defaultValue;
		}
	}

	private readRequiredStrEnvVar(key: string): string {
		const value = process.env[key];
		if (!value || value.trim() === '') {
			throw new Error(`Environment variable ${key} is required but not set or empty`);
		}
		return value;
	}
}
