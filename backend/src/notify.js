// Server-sent events: pushes new-job alerts to open browser tabs.
const clients = new Map(); // uid -> Set<res>
exports.subscribe = (uid, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('event: ready\ndata: {}\n\n');
  if (!clients.has(uid)) clients.set(uid, new Set());
  clients.get(uid).add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  res.on('close', () => { clearInterval(ping); clients.get(uid)?.delete(res); });
};
exports.push = (uid, event, data) => {
  for (const res of clients.get(uid) || []) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};
