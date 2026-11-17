const test = require('node:test');
const assert = require('node:assert');
process.env.ENC_KEY = 'a'.repeat(64);
const { score } = require('../src/ats');
const { has, technicalList } = require('../src/resume');
const crypto = require('../src/crypto');

const profile = { resume_text: 'Python Django PostgreSQL Docker AWS Git', skills: JSON.stringify(['python', 'django', 'postgresql', 'docker', 'aws', 'git']), titles: JSON.stringify(['backend developer']) };

test('strong match scores high', () => {
  assert.ok(score(profile, { title: 'Backend Developer', description: 'Python, Django, PostgreSQL and Docker required' }) >= 90);
});
test('weak match scores low', () => {
  assert.ok(score(profile, { title: 'Android Engineer', description: 'Kotlin, Swift and Figma' }) < 30);
});
test('skill matching respects word boundaries', () => {
  assert.strictEqual(has('javascript developer', 'java'), false);
  assert.strictEqual(has('java developer', 'java'), true);
});
test('technicalList drops certifications and soft skills', () => {
  assert.deepStrictEqual(technicalList({ Languages: ['Python'], 'Soft skills': ['Teamwork'], Certifications: ['AWS CCP'] }), ['Python']);
});
test('encryption round trip', () => {
  assert.deepStrictEqual(crypto.decrypt(crypto.encrypt({ token: 'abc' })), { token: 'abc' });
});
