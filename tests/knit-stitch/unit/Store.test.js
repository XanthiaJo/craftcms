import { describe, it, expect, vi } from 'vitest';
import { Store } from '../src/state/Store.js';

describe('Store', () => {
  it('should get top-level and nested values', () => {
    const store = new Store();
    expect(store.get('gridColumns')).toBe(30);
    expect(store.get('sketch.activeTool')).toBe('Select');
    expect(store.get('sketch.nonexistent')).toBeUndefined();
  });

  it('should set values and notify subscribers', () => {
    const store = new Store();
    const fn = vi.fn();
    store.subscribe(fn);
    store.set('gridColumns', 40);
    expect(store.get('gridColumns')).toBe(40);
    expect(fn).toHaveBeenCalledWith('gridColumns', 40, store.state);
  });

  it('should not notify when value unchanged', () => {
    const store = new Store();
    const fn = vi.fn();
    store.subscribe(fn);
    store.set('gridColumns', 30); // same as default
    expect(fn).not.toHaveBeenCalled();
  });

  it('should support unsubscribe', () => {
    const store = new Store();
    const fn = vi.fn();
    const unsub = store.subscribe(fn);
    unsub();
    store.set('gridColumns', 99);
    expect(fn).not.toHaveBeenCalled();
  });
});
