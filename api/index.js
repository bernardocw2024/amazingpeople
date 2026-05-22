// Vercel serverless entrypoint. All routes are rewritten here (see vercel.json).
import { handler } from '../lib/app.js';

export default function (req, res) {
  return handler(req, res);
}
