import hashService from '../../src/services/hash/hash.service.js';

describe('Hash Service', () => {
  describe('computeSHA256', () => {
    it('should compute SHA256 hash of a string', () => {
      const input = 'test string';
      const hash = hashService.computeSHA256(input);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent hashes for same input', () => {
      const input = 'test string';
      const hash1 = hashService.computeSHA256(input);
      const hash2 = hashService.computeSHA256(input);
      expect(hash1).toBe(hash2);
    });
  });
});
