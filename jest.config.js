module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^react-markdown$': '<rootDir>/src/test/__mocks__/react-markdown.tsx',
    '^remark-gfm$': '<rootDir>/src/test/__mocks__/remark-gfm.ts',
    '^remark-math$': '<rootDir>/src/test/__mocks__/remark-math.ts',
    '^remark-emoji$': '<rootDir>/src/test/__mocks__/remark-emoji.ts',
    '^rehype-raw$': '<rootDir>/src/test/__mocks__/rehype-raw.ts',
    '^rehype-katex$': '<rootDir>/src/test/__mocks__/rehype-katex.ts',
    '^mermaid$': '<rootDir>/src/test/__mocks__/mermaid.ts',
    '^../plugins/remarkAdmonitions$':
      '<rootDir>/src/test/__mocks__/remarkAdmonitions.ts',
    '^react-syntax-highlighter$':
      '<rootDir>/src/test/__mocks__/react-syntax-highlighter.tsx',
    '^react-syntax-highlighter/dist/esm/styles/prism$':
      '<rootDir>/src/test/__mocks__/react-syntax-highlighter/dist/esm/styles/prism.ts',
    '^json-stringify-pretty-compact$':
      '<rootDir>/src/test/__mocks__/json-stringify-pretty-compact.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main/**/*',
    '!src/test/**/*',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
