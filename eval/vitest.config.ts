import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'eval', include: ['test/**/*.test.ts'] },
});
