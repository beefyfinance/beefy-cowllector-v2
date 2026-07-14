/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.ts$': [
            '@swc/jest',
            {
                jsc: {
                    parser: {
                        syntax: 'typescript',
                    },
                    target: 'es2022',
                },
                module: {
                    type: 'commonjs',
                },
            },
        ],
    },
    testPathIgnorePatterns: ['<rootDir>/data/', '<rootDir>/node_modules/', '<rootDir>/src/script/test.ts', '<rootDir>/dist/'],
    resetMocks: true,
    clearMocks: true,
};
