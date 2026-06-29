import { SketchColorOption } from '../../models/sketch/sketchColorOption.js';

/**
 * Default and selectable appearance options for sketch strokes.
 *
 * Keeping colour and thickness defaults in one place means the store,
 * renderer, and UI can all read the same values instead of duplicating
 * hard-coded constants.
 */

export const DEFAULT_STROKE_COLOR = '#E63946';
export const DEFAULT_STROKE_THICKNESS = 2;

export const MIN_STROKE_THICKNESS = 1;
export const MAX_STROKE_THICKNESS = 10;
export const STROKE_THICKNESS_STEP = 1;

export const STROKE_COLOR_OPTIONS = [
  new SketchColorOption('Red', '#E63946'),
  new SketchColorOption('Orange', '#FF6B35'),
  new SketchColorOption('Yellow', '#F4C430'),
  new SketchColorOption('Green', '#2D9E4F'),
  new SketchColorOption('Teal', '#0A8A8A'),
  new SketchColorOption('Blue', '#1D70B8'),
  new SketchColorOption('Purple', '#6A3D9A'),
  new SketchColorOption('Pink', '#E75480'),
  new SketchColorOption('Black', '#1A1A1A'),
  new SketchColorOption('Dark grey', '#555555'),
  new SketchColorOption('Grey', '#999999'),
  new SketchColorOption('White', '#F5F5F5'),
];
