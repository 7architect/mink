import { createServer } from 'node:http';
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.end(request.url === '/health' ? 'ready' : 'Hello from Mink!');
});
server.listen(4317, '127.0.0.1', () => {
  console.log('Demo server: http://127.0.0.1:4317');
});
