import * as esbuild from 'esbuild';

await esbuild.build({
	entryPoints: ['src/daemon/index.ts'],
	bundle: true,
	platform: 'node',
	format: 'esm',
	outfile: 'dist/daemon/index.js',
});
