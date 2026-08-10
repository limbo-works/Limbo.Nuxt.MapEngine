import config from '@limbo-works/lint-configs/eslint.config.simple.mjs';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

export default [
	...config,
	...tseslint.configs.recommended,
	{
		files: ['**/*.vue'],
		languageOptions: {
			parser: vueParser,
			parserOptions: {
				parser: tseslint.parser,
			},
		},
	},
	{
		rules: {
			'@typescript-eslint/no-empty-object-type': [
				'error',
				{ allowInterfaces: 'always' },
			],
		},
	},
	{
		files: ['**/*.cjs'],
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
		},
	},
	{
		ignores: ['dist/**'],
	},
];
