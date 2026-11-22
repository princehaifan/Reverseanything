import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 8787;

createApp({ staticDir: path.join(root, 'dist') }).listen(port, () => {
  console.log(`Tidemark listening on http://localhost:${port}`);
});
