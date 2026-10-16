/**
 * Safe argument serializer for console and error messages.
 * Prevents throwing errors into page scripts, handles circular structures,
 * handles DOM nodes, Symbols, BigInts, functions, and printf format placeholders.
 */

export function serializeArg(arg: unknown, depth = 0, seen = new WeakSet<object>()): string {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';

  const type = typeof arg;

  if (type === 'string') return arg as string;
  if (type === 'number' || type === 'boolean') return String(arg);
  if (type === 'bigint') return `${arg}n`;
  if (type === 'symbol') return (arg as symbol).toString();
  if (type === 'function') {
    const fn = arg as (...args: unknown[]) => unknown;
    return `[Function: ${fn.name || 'anonymous'}]`;
  }

  // Handle Error instances
  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`;
  }

  // Handle DOM Nodes without walking child trees
  if (typeof Node !== 'undefined' && arg instanceof Node) {
    if (arg instanceof Element) {
      const id = arg.id ? `#${arg.id}` : '';
      const className = typeof arg.className === 'string' && arg.className.trim()
        ? `.${arg.className.trim().split(/\s+/).slice(0, 3).join('.')}`
        : '';
      return `<${arg.tagName.toLowerCase()}${id}${className}>`;
    }
    return `[${arg.nodeName}]`;
  }

  if (type === 'object') {
    const obj = arg as Record<string, unknown>;

    if (seen.has(obj)) {
      return '[Circular]';
    }

    if (depth >= 3) {
      return Array.isArray(obj) ? '[Array]' : '[Object]';
    }

    seen.add(obj);

    try {
      if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        const items = obj.slice(0, 10).map((item) => serializeArg(item, depth + 1, seen));
        if (obj.length > 10) {
          items.push(`... ${obj.length - 10} more`);
        }
        return `[${items.join(', ')}]`;
      }

      // Check for custom toJSON or objects with getters that might throw
      const keys = Object.keys(obj).slice(0, 15);
      const parts: string[] = [];
      for (const key of keys) {
        try {
          const val = obj[key];
          parts.push(`${key}: ${serializeArg(val, depth + 1, seen)}`);
        } catch (err) {
          parts.push(`${key}: [Error accessing property: ${err instanceof Error ? err.message : String(err)}]`);
        }
      }
      if (Object.keys(obj).length > 15) {
        parts.push(`... ${Object.keys(obj).length - 15} more`);
      }
      return `{ ${parts.join(', ')} }`;
    } catch {
      return '[Unserializable Object]';
    }
  }

  return String(arg);
}

/**
 * Formats console.* arguments supporting printf-style %s, %d, %i, %f, %o, %O, %c placeholders.
 */
export function formatConsoleArgs(args: unknown[]): string {
  if (!args || args.length === 0) return '';

  const first = args[0];
  if (typeof first === 'string' && /%[sdifjocO%]/.test(first)) {
    let argIndex = 1;
    const formatted = first.replace(/%([sdifjocO%])/g, (match, specifier) => {
      if (match === '%%') return '%';
      if (argIndex >= args.length) return match;
      const currentArg = args[argIndex++];
      switch (specifier) {
        case 's':
          return typeof currentArg === 'string' ? currentArg : serializeArg(currentArg);
        case 'd':
        case 'i':
          return String(parseInt(String(currentArg), 10));
        case 'f':
          return String(parseFloat(String(currentArg)));
        case 'j':
        case 'o':
        case 'O':
          return serializeArg(currentArg);
        case 'c':
          // CSS styling specifier in browser console - discard styling argument
          return '';
        default:
          return match;
      }
    });

    const remaining = args.slice(argIndex).map((a) => serializeArg(a));
    return remaining.length > 0 ? `${formatted} ${remaining.join(' ')}` : formatted;
  }

  if (args.length === 1) return serializeArg(args[0]);

  return args.map((a) => serializeArg(a)).join(' ');
}
