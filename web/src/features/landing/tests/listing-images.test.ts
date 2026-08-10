import { describe, expect, it } from 'vitest';
import {
  FALLBACK_LISTING_IMAGE,
  getListingImages,
  getPrimaryListingImage,
} from '../lib/listing-images';

describe('landing listing images', () => {
  it('normalizes arrays, JSON, object URLs, and relative media paths', () => {
    expect(
      getListingImages({
        images: [
          'uploads/one.jpg',
          { publicUrl: 'https://cdn.example/two.jpg' },
          '/nearhub.png',
          '',
        ],
        imageUrl: 'images/three.jpg',
      })
    ).toEqual([' /uploads/one.jpg'.trim(), 'https://cdn.example/two.jpg', '/images/three.jpg']);
    expect(getListingImages({ images: '["one.jpg", "two.jpg"]' })).toEqual(['one.jpg', 'two.jpg']);
    expect(getListingImages({ images: '{"url":"media/four.jpg"}' })).toEqual(['/media/four.jpg']);
  });

  it('handles legacy comma-like objects, deduplicates, and uses a fallback', () => {
    expect(getListingImages({ images: '{"one.jpg","two.jpg"}' })).toEqual(['one.jpg', 'two.jpg']);
    expect(getListingImages({ image: 'nearhub.png', thumbnail: '/nearhub-logo.png' })).toEqual([]);
    expect(getListingImages({ image: 'one.jpg', thumbnail: 'one.jpg' })).toEqual(['one.jpg']);
    expect(getPrimaryListingImage({ image: 'nearhub.png' })).toBe(FALLBACK_LISTING_IMAGE);
    expect(getPrimaryListingImage({ productImage: 'uploads/product.jpg' })).toBe(
      '/uploads/product.jpg'
    );
  });
});
