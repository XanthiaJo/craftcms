import { describe, it, expect } from 'vitest';
import { FinishedSizeCalculator } from '../../../web/knitstitch/src/services/finishedSizeCalculator.js';
import { GaugeSettings } from '../../../web/knitstitch/src/models/gaugeSettings.js';
import { PatternDimensions } from '../../../web/knitstitch/src/models/patternDimensions.js';

describe('FinishedSizeCalculator', () => {
    it('should calculate correct size for 20 st/28 rows per 4in', () => {
        const gauge = new GaugeSettings(20, 28);
        const dims = new PatternDimensions(40, 56);
        const calc = new FinishedSizeCalculator();
        const result = calc.calculate(gauge, dims);
        expect(result.widthInches).toBeCloseTo(8, 1);
        expect(result.heightInches).toBeCloseTo(8, 1);
    });

    it('should return 0 when gauge is zero or negative', () => {
        const gauge = new GaugeSettings(0, 0);
        const dims = new PatternDimensions(40, 56);
        const calc = new FinishedSizeCalculator();
        const result = calc.calculate(gauge, dims);
        expect(result.widthInches).toBe(0);
        expect(result.heightInches).toBe(0);
    });
});
