import {
  isMeaningfulDisplayName,
  pickMeaningfulDisplayName,
} from '../../features/users/services/user-profiles';

describe('User profile display name heuristics', () => {
  it('keeps normal names even when they contain a numeric suffix', () => {
    expect(isMeaningfulDisplayName('Test User 123')).toBe(true);
    expect(pickMeaningfulDisplayName('NearHub User', 'Test User 123')).toBe('Test User 123');
  });

  it('rejects obvious placeholder identifiers', () => {
    expect(isMeaningfulDisplayName('NearHub User')).toBe(false);
    expect(isMeaningfulDisplayName('User 2381')).toBe(false);
    expect(isMeaningfulDisplayName('8867653172')).toBe(false);
    expect(isMeaningfulDisplayName('b179187a-1a8e-40c3-b996-7b6de22bd548')).toBe(false);
  });

  it('skips placeholder values until it finds a real display name', () => {
    expect(
      pickMeaningfulDisplayName('NearHub User', 'User 2381', 'Real Customer', '8867653172')
    ).toBe('Real Customer');
  });
});
