import { cp, mkdir, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir(resolve(root, 'dist'), { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'watercolor.js', 'camera.js', 'assets', 'data']) await cp(resolve(root,file), resolve(root,'dist',file), { recursive: true });
const edition=JSON.parse(await readFile(resolve(root,'data/edition.json'),'utf8'));
for(const photo of edition.photos) await readFile(resolve(root,photo.image));
console.log(`Built Paint Ithaca with ${edition.photos.length} verified local photos.`);
