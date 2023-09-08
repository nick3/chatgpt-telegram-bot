import { createRequire } from 'module';
const require = createRequire(import.meta.url);

process.env.NODE_PATH = new URL('./dist', import.meta.url).pathname;
require('module').Module._initPaths();
