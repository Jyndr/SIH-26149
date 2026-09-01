import caseService from '../../src/services/case.service.js';

describe('Case Service', () => {
  describe('generateCaseId', () => {
    it('should generate a case ID with correct format', () => {
      const caseId = caseService.generateCaseId();
      expect(caseId).toMatch(/^CASE-\d{4}-\d{5}$/);
    });

    it('should generate unique case IDs', () => {
      const id1 = caseService.generateCaseId();
      const id2 = caseService.generateCaseId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('create', () => {
    it('should create a new case', async () => {
      const mockData = {
        title: 'Test Case',
        description: 'Test Description'
      };
      const mockUserId = '507f1f77bcf86cd799439011';

      // This is a basic test structure - would need mocking for full implementation
      const result = await caseService.create(mockData, mockUserId);
      expect(result).toBeDefined();
    });
  });
});
