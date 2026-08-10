import { calculateDistance } from '../services/distance';

describe('search distance service', () => {
  it('returns zero for the same coordinate', () => {
    expect(calculateDistance(16.5062, 80.648, 16.5062, 80.648)).toBe(0);
  });

  it('calculates a stable great-circle distance in kilometres', () => {
    const distance = calculateDistance(16.5062, 80.648, 17.385, 78.4867);

    expect(distance).toBeGreaterThan(240);
    expect(distance).toBeLessThan(260);
  });
});
