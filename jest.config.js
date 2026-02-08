/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/__tests__"],
    testMatch: ["**/*.test.ts"],
    collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/cli/index.ts"],
    coverageDirectory: "coverage",
    coverageReporters: ["text", "lcov", "html"],
    testTimeout: 10000,
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "tsconfig.jest.json",
                useESM: false,
                isolatedModules: true,
            },
        ],
    },
    moduleFileExtensions: ["ts", "js", "json"],
    testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
};
