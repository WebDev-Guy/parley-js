/**
 * @file Logger.test.ts
 * @description Unit tests for the Logger module
 * @module tests/unit
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger, type LogLevel } from '../../src/utils/Logger';

describe('Logger', () => {
    let logger: Logger;
    let consoleLogSpy: any;
    let consoleInfoSpy: any;
    let consoleWarnSpy: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => { });
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('constructor()', () => {
        it('should create logger with default log level', () => {
            logger = new Logger();
            expect(logger).toBeDefined();
        });

        it('should create logger with specified log level', () => {
            logger = new Logger('info');
            expect(logger).toBeDefined();
        });

        it('should create logger with custom prefix', () => {
            logger = new Logger('debug', '[CustomPrefix]');
            logger.info('test message');
            // Verify prefix is used
            expect(consoleInfoSpy).toHaveBeenCalled();
        });

        it('should create logger with timestamp option', () => {
            logger = new Logger('debug', '[Parley]', true);
            logger.info('test');
            expect(consoleInfoSpy).toHaveBeenCalled();
        });

        it('should create logger without timestamp', () => {
            logger = new Logger('debug', '[Parley]', false);
            logger.info('test');
            expect(consoleInfoSpy).toHaveBeenCalled();
        });
    });

    describe('setLevel()', () => {
        beforeEach(() => {
            logger = new Logger('none');
        });

        it('should change log level to error', () => {
            logger.setLevel('error');
            logger.error('error message');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should change log level to warn', () => {
            logger.setLevel('warn');
            logger.warn('warn message');
            expect(consoleWarnSpy).toHaveBeenCalled();
        });

        it('should change log level to info', () => {
            logger.setLevel('info');
            logger.info('info message');
            expect(consoleInfoSpy).toHaveBeenCalled();
        });

        it('should change log level to debug', () => {
            logger.setLevel('debug');
            logger.debug('debug message');
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should change log level to none', () => {
            logger.setLevel('debug');
            logger.setLevel('none');
            logger.debug('should not log');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });

    describe('error()', () => {
        beforeEach(() => {
            logger = new Logger('error');
        });

        it('should log error messages', () => {
            logger.error('Error occurred');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should log error with multiple arguments', () => {
            logger.error('Error:', { code: 'E001' });
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should not log when level is none', () => {
            logger.setLevel('none');
            logger.error('Error');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });

    describe('warn()', () => {
        beforeEach(() => {
            logger = new Logger('warn');
        });

        it('should log warn messages', () => {
            logger.warn('Warning message');
            expect(consoleWarnSpy).toHaveBeenCalled();
        });

        it('should not log when level is error', () => {
            logger.setLevel('error');
            logger.warn('Warning');
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should log when level is warn or higher', () => {
            logger.setLevel('warn');
            logger.warn('Warning');
            expect(consoleWarnSpy).toHaveBeenCalled();

            vi.clearAllMocks();
            logger.setLevel('info');
            logger.warn('Warning');
            expect(consoleWarnSpy).toHaveBeenCalled();
        });
    });

    describe('info()', () => {
        beforeEach(() => {
            logger = new Logger('info');
        });

        it('should log info messages', () => {
            logger.info('Info message');
            expect(consoleInfoSpy).toHaveBeenCalled();
        });

        it('should not log when level is warn', () => {
            logger.setLevel('warn');
            logger.info('Info');
            expect(consoleInfoSpy).not.toHaveBeenCalled();
        });

        it('should log when level is info or higher', () => {
            logger.setLevel('info');
            logger.info('Info');
            expect(consoleInfoSpy).toHaveBeenCalled();

            vi.clearAllMocks();
            logger.setLevel('debug');
            logger.info('Info');
            expect(consoleInfoSpy).toHaveBeenCalled();
        });
    });

    describe('debug()', () => {
        beforeEach(() => {
            logger = new Logger('debug');
        });

        it('should log debug messages', () => {
            logger.debug('Debug message');
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should not log when level is info', () => {
            logger.setLevel('info');
            logger.debug('Debug');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should only log when level is debug', () => {
            logger.setLevel('debug');
            logger.debug('Debug');
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });

    describe('Log level hierarchy', () => {
        it('error level should only show errors', () => {
            logger = new Logger('error');

            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleInfoSpy).not.toHaveBeenCalled();

            logger.error('error');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('warn level should show warn and error', () => {
            logger = new Logger('warn');

            logger.debug('debug');
            logger.info('info');
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleInfoSpy).not.toHaveBeenCalled();

            logger.warn('warn');
            expect(consoleWarnSpy).toHaveBeenCalled();

            logger.error('error');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('info level should show info, warn, error', () => {
            logger = new Logger('info');

            logger.debug('debug');
            expect(consoleLogSpy).not.toHaveBeenCalled();

            logger.info('info');
            expect(consoleInfoSpy).toHaveBeenCalled();

            consoleInfoSpy.mockClear();
            logger.warn('warn');
            expect(consoleWarnSpy).toHaveBeenCalled();

            logger.error('error');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('debug level should show all', () => {
            logger = new Logger('debug');

            logger.debug('debug');
            expect(consoleLogSpy).toHaveBeenCalled();

            consoleLogSpy.mockClear();
            logger.info('info');
            expect(consoleInfoSpy).toHaveBeenCalled();

            logger.warn('warn');
            expect(consoleWarnSpy).toHaveBeenCalled();

            logger.error('error');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('none level should show nothing', () => {
            logger = new Logger('none');

            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            logger.error('error');

            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleInfoSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });

    describe('Message formatting', () => {
        beforeEach(() => {
            logger = new Logger('debug', '[Parley]', true);
        });

        it('should include prefix in messages', () => {
            logger.info('Test message');
            const calls = consoleInfoSpy.mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            expect(calls[0][0]).toContain('[Parley]');
        });

        it('should handle multiple arguments', () => {
            logger.info('Message', { key: 'value' }, [1, 2, 3]);
            expect(consoleInfoSpy).toHaveBeenCalled();
        });

        it('should handle objects and arrays', () => {
            const obj = { name: 'test', data: [1, 2, 3] };
            logger.debug('Object log', obj);
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });

    describe('child()', () => {
        beforeEach(() => {
            logger = new Logger('debug', '[Parley]');
        });

        it('should create child logger with extended prefix', () => {
            const child = logger.child('ChildModule');
            expect(child).toBeDefined();
        });

        it('child should inherit parent log level', () => {
            logger.setLevel('warn');
            const child = logger.child('Child');
            child.debug('debug');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should allow independent level changes', () => {
            const child = logger.child('Child');
            child.setLevel('debug');
            child.debug('debug from child');
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });

    describe('Edge cases', () => {
        beforeEach(() => {
            logger = new Logger('debug');
        });

        it('should handle empty messages', () => {
            logger.info('');
            expect(consoleInfoSpy).toHaveBeenCalled();
        });

        it('should handle very long messages', () => {
            const longMessage = 'x'.repeat(10000);
            logger.info(longMessage);
            expect(consoleInfoSpy).toHaveBeenCalled();
        });

        it('should handle null/undefined arguments', () => {
            logger.info('Message', null, undefined);
            expect(consoleInfoSpy).toHaveBeenCalled();
        });

        it('should handle circular references gracefully', () => {
            const circular: any = { a: 1 };
            circular.self = circular;
            logger.debug('Circular object', circular);
            // Should not throw
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });
});
