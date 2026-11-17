// AES-256-GCM for provider tokens at rest. Never store raw passwords.
const crypto = require('crypto');
function key() {
  const k = process.env.ENC_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(k)) throw new Error('ENC_KEY must be 64 hex characters');
  return Buffer.from(k, 'hex');
}
exports.encrypt = (obj) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
};
exports.decrypt = (b64) => {
  const buf = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'));
};
