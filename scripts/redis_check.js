const IORedis = require('ioredis');
const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const r = new IORedis(url);
(async () => {
  try {
    const keys = await r.keys('otp_send*');
    console.log('KEYS', keys);
    for (const k of keys) {
      const v = await r.get(k);
      const ttl = await r.ttl(k);
      console.log('KEY', k, 'VAL', v, 'TTL', ttl);
    }
    await r.quit();
  } catch (e) {
    console.error('ERR', e && e.message ? e.message : e);
    try { await r.quit(); } catch(_){}
    process.exit(1);
  }
})();
