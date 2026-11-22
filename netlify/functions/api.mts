// Runs the Express API as a single Netlify Function. netlify.toml rewrites
// /api/* here; the original request path is preserved, so routes match as-is.
import serverless from 'serverless-http';
import { createApp } from '../../server/app';

export const handler = serverless(createApp());
