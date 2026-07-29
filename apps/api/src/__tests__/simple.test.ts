import { describe, it, expect } from 'vitest';

describe('Simple Test', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should test environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBeDefined();
  });

  it('should test async functionality', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});
