import { describe, expect, it } from 'vitest';
import {
  parseAttributeMap,
  parseEmiPlanList,
  parseMediaList,
  parseTextList,
} from '../lib/listing-parsers';

describe('landing listing parsers', () => {
  it('parses media from arrays, JSON, and plain values', () => {
    expect(parseMediaList([' image.jpg ', '', 42])).toEqual(['image.jpg']);
    expect(parseMediaList('["one.jpg", "two.jpg"]')).toEqual(['one.jpg', 'two.jpg']);
    expect(parseMediaList('single.jpg')).toEqual(['single.jpg']);
  });

  it('parses text lists from JSON and delimiter-separated input', () => {
    expect(parseTextList('["Cars", " Bikes "]')).toEqual(['Cars', 'Bikes']);
    expect(parseTextList('Cars,\nBikes')).toEqual(['Cars', 'Bikes']);
  });

  it('keeps only supported attribute values', () => {
    expect(parseAttributeMap({ color: 'blue', seats: 5, automatic: true, ignored: null })).toEqual({
      color: 'blue',
      seats: 5,
      automatic: true,
    });
  });

  it('handles empty, malformed, and non-array parser inputs', () => {
    expect(parseMediaList(undefined)).toEqual([]);
    expect(parseMediaList([' ', 1, null])).toEqual([]);
    expect(parseMediaList('')).toEqual([]);
    expect(parseMediaList('{bad json}')).toEqual(['{bad json}']);
    expect(parseMediaList('{"not":"an array"}')).toEqual(['{"not":"an array"}']);
    expect(parseTextList(undefined)).toEqual([]);
    expect(parseTextList([0, null, ' Cars '])).toEqual(['Cars']);
    expect(parseTextList('')).toEqual([]);
    expect(parseTextList('{bad json}')).toEqual(['{bad json}']);
    expect(parseTextList('{"not":"an array"}')).toEqual(['{"not":"an array"}']);
    expect(parseAttributeMap(null)).toEqual({});
    expect(parseAttributeMap(42)).toEqual({});
    expect(parseAttributeMap('')).toEqual({});
    expect(parseAttributeMap('{bad json}')).toEqual({});
    expect(parseAttributeMap({ nested: { value: 1 }, empty: null })).toEqual({
      nested: '[object Object]',
    });
  });

  it('parses valid EMI plans and filters invalid plans', () => {
    expect(
      parseEmiPlanList([
        { durationMonths: 6, monthlyAmount: 1000 },
        { durationMonths: 0, monthlyAmount: 1 },
      ])
    ).toEqual([{ durationMonths: 6, monthlyAmount: 1000 }]);
    expect(parseEmiPlanList('[{"durationMonths":"3","monthlyAmount":"500"}]')).toEqual([
      { durationMonths: 3, monthlyAmount: 500 },
    ]);
    expect(parseEmiPlanList('not-json')).toEqual([]);
    expect(parseEmiPlanList('{"durationMonths":3}')).toEqual([]);
  });
});
