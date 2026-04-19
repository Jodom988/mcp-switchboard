import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { ServiceProvider, SingletonBase } from './service-provider';

const savedConfigSchema = z.object({
	daemonPort: z.number().default(9595),
	mcpPort: z.number().default(9596),
});
type SavedConfig = z.infer<typeof savedConfigSchema>;

export class McpsbConfig extends SingletonBase {
	public get daemonPort(): number {
		return this.savedConfig.daemonPort;
	}

	public readonly isPackaged: boolean;
	public readonly savedConfig: SavedConfig;

	public constructor(serviceProvider: ServiceProvider) {
		super(serviceProvider);

		this.isPackaged = this.readBoolEnvVar('MCPSB_IS_PACKAGED', true);

		const configFilePath = (() => {
			if (this.isPackaged) {
				return `${process.env.HOME}/.mcpsb/config.json`;
			}
			return path.resolve(import.meta.dirname, '../../dev-config/config.json');
		})();

		try {
			const raw = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
			this.savedConfig = savedConfigSchema.parse(raw);
		} catch (error) {
			this.savedConfig = savedConfigSchema.parse({});
			console.log(`Failed to read config file at ${configFilePath}, overwriting with defaults`);
			try {
				fs.renameSync(configFilePath, `${configFilePath}-${Date.now()}.old`);
			} catch {
				console.log('Failed to create backup of old config file');
			}
			fs.writeFileSync(configFilePath, JSON.stringify(this.savedConfig, null, 2), 'utf-8');
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
