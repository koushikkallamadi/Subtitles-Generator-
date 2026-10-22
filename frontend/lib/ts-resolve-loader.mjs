import { access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    try {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      await access(fileURLToPath(candidate));
      return { url: pathToFileURL(fileURLToPath(candidate)).href, shortCircuit: true };
    } catch { /* let Node report the standard resolution error */ }
  }
  return nextResolve(specifier, context);
}
