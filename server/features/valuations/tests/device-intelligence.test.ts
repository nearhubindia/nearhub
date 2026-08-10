import { describe, expect, it } from 'vitest';
import { normalizeDeviceIntelligence } from '../services/device-intelligence';

describe('device intelligence normalization', () => {
  it('trims identity fields and normalizes optional fields', () => {
    expect(
      normalizeDeviceIntelligence({
        brand: '  Samsung ',
        model: ' Galaxy S24 ',
        ram: 8,
        storage: 256,
        processor: 'flagship',
        androidVersion: ' 14 ',
        manufacturer: ' Samsung ',
        cpuArchitecture: ' arm64 ',
      })
    ).toMatchObject({
      brand: 'Samsung',
      model: 'Galaxy S24',
      androidVersion: '14',
      manufacturer: 'Samsung',
      cpuArchitecture: 'arm64',
    });
  });

  it('uses empty strings for missing optional metadata', () => {
    expect(
      normalizeDeviceIntelligence({
        brand: 'A',
        model: 'B',
        ram: 4,
        storage: 64,
        processor: 'entry',
      })
    ).toMatchObject({ androidVersion: '', manufacturer: '', cpuArchitecture: '' });
  });
});
