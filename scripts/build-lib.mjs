// build-lib.mjs — emit host-loadable lib/ artifacts from readable src/.
//
// Mirrors how @deepseek-ai/dsh-client-ui-* packages ship:
//   lib/index.js   — node half, plain ESM (empty apply for a pure-UI plugin)
//   lib/client.js  — browser half, registered via window.__ModuleLoader__.load
//                     with factory(require); id = package name; exports
//                     inject/apply. This exact shape is what the vendored
//                     cordis Loader / dsh-client-modules consume in the web
//                     roster (window.__DSH_BOOT__).
//
// The browser-half template below is hand-maintained from the observed host
// artifact format. Run `npm run build` after editing src/, then commit lib/.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const NAME = pkg.name

// ---- node half: copy src/index.js as-is --------------------------------
writeFileSync(join(root, 'lib/index.js'), readFileSync(join(root, 'src/index.js'), 'utf8'))

// ---- browser half: wrap src/client.js into ModuleLoader form ------------
let src = readFileSync(join(root, 'src/client.js'), 'utf8')

// Drop the ESM import (the factory gets React via require below).
src = src.replace(/^import \* as React from 'react'\s*$/m, '')

// exports -> plain declarations; they are re-exported at the tail.
src = src.replace(/^export const inject\b/m, 'const inject')
src = src.replace(/^export function apply\b/m, 'function apply')

const head = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(NAME)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
`
const tail = `		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
`

const body = head + src + tail
mkdirSync(join(root, 'lib'), { recursive: true })
writeFileSync(join(root, 'lib/client.js'), body)
console.log(`built lib/index.js + lib/client.js for ${NAME}`)
