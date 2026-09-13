import { cp, mkdir, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir(resolve(root, 'dist/assets'), { recursive: true });
for (const file of ['index.html','styles.css','app.js','watercolor.js','watercolor-shaders.js','pigment-model.js','brush.js','hold-session.js']) await cp(resolve(root,file), resolve(root,'dist',file));
await cp(resolve(root,'assets/cayuga-lake.jpg'),resolve(root,'dist/assets/cayuga-lake.jpg'));
await readFile(resolve(root,'dist/assets/cayuga-lake.jpg'));
console.log('Built the camera-only Paint Ithaca demo.');
