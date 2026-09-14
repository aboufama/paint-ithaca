import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir(resolve(root, 'dist'), { recursive: true });
for (const file of ['index.html','styles.css','app.js','tidal-bloom.js','capture-session.js']) await cp(resolve(root,file), resolve(root,'dist',file));
await mkdir(resolve(root,'dist/effects'),{recursive:true});
await cp(resolve(root,'effects/index.html'),resolve(root,'dist/effects/index.html'));
console.log('Built the tap-to-photo Paint Ithaca demo.');
