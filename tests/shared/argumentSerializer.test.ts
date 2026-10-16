import { describe, it, expect } from 'vitest';
import { serializeArg, formatConsoleArgs } from '../../src/shared/argumentSerializer';

describe('Safe Argument Serializer', () => {
  it('serializes primitives correctly', () => {
    expect(serializeArg('hello world')).toBe('hello world');
    expect(serializeArg(42)).toBe('42');
    expect(serializeArg(true)).toBe('true');
    expect(serializeArg(null)).toBe('null');
    expect(serializeArg(undefined)).toBe('undefined');
    expect(serializeArg(1234567890123456789n)).toBe('1234567890123456789n');
    expect(serializeArg(Symbol('testSymbol'))).toBe('Symbol(testSymbol)');
  });

  it('serializes Error instances with message and stack', () => {
    const err = new Error('Test error message');
    const result = serializeArg(err);
    expect(result).toContain('Test error message');
    expect(result).toContain('Error:');
  });

  it('serializes functions cleanly', () => {
    function myCustomFunc() {}
    expect(serializeArg(myCustomFunc)).toBe('[Function: myCustomFunc]');
    expect(serializeArg(() => {})).toBe('[Function: anonymous]');
  });

  it('serializes DOM nodes without walking children', () => {
    const div = document.createElement('div');
    div.id = 'app';
    div.className = 'container main-panel';
    const child = document.createElement('span');
    child.textContent = 'Secret text inside';
    div.appendChild(child);

    const result = serializeArg(div);
    expect(result).toBe('<div#app.container.main-panel>');
    expect(result).not.toContain('Secret text inside');
  });

  it('serializes nested objects up to depth limit', () => {
    const nested = {
      level1: {
        level2: {
          level3: {
            level4: 'deep value',
          },
        },
      },
    };
    const result = serializeArg(nested);
    expect(result).toContain('level1');
    expect(result).toContain('level2');
    expect(result).toContain('level3');
    expect(result).toContain('[Object]');
    expect(result).not.toContain('deep value');
  });

  it('safely handles circular references', () => {
    const circular: Record<string, unknown> = { name: 'cycle' };
    circular.self = circular;

    const result = serializeArg(circular);
    expect(result).toContain('name: cycle');
    expect(result).toContain('self: [Circular]');
  });

  it('safely handles objects with throwing getters', () => {
    const objWithThrowingGetter = {
      safeProp: 'ok',
      get dangerousProp() {
        throw new Error('Access denied by getter');
      },
    };

    const result = serializeArg(objWithThrowingGetter);
    expect(result).toContain('safeProp: ok');
    expect(result).toContain('dangerousProp: [Error accessing property: Access denied by getter]');
  });

  it('safely handles large arrays with truncation', () => {
    const largeArray = Array.from({ length: 50 }, (_, i) => `item-${i}`);
    const result = serializeArg(largeArray);
    expect(result).toContain('item-0');
    expect(result).toContain('item-9');
    expect(result).toContain('... 40 more');
  });

  it('formats printf placeholders correctly', () => {
    expect(formatConsoleArgs(['Hello %s!', 'World'])).toBe('Hello World!');
    expect(formatConsoleArgs(['Status: %d, Rate: %f', 404, 3.1415])).toBe('Status: 404, Rate: 3.1415');
    expect(formatConsoleArgs(['User: %o', { id: 1, name: 'Alice' }])).toBe('User: { id: 1, name: Alice }');
    expect(formatConsoleArgs(['%cStyled text', 'color: red'])).toBe('Styled text');
    expect(formatConsoleArgs(['Progress 100%% complete'])).toBe('Progress 100% complete');
    expect(formatConsoleArgs(['No placeholders', 1, 2, 3])).toBe('No placeholders 1 2 3');
  });
});
