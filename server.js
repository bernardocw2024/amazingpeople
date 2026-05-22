import http from 'node:http';
import { handler } from './lib/app.js';

const PORT = Number(process.env.PORT) || 3000;
const server = http.createServer(handler);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Amazing People running at http://localhost:${PORT}`);
  });
}

export { server };
