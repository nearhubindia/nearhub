/**
 * Mock for AI validation services to prevent external calls during testing
 */

export const validateImageWithPhi2 = async (params: any) => {
  return {
    isValid: true,
    isAppropriate: true,
    matchesCategory: true,
    confidence: 0.95,
    detectedItems: [],
    suggestion: '',
  };
};

export const validateVideoWithPhi2 = async (params: any) => {
  return {
    isValid: true,
    isAppropriate: true,
    matchesCategory: true,
    confidence: 0.95,
    detectedItems: [],
    suggestion: '',
  };
};
