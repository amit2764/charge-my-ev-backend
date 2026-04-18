const sodium = require('libsodium-wrappers');

async function encrypt(key, secret) {
    await sodium.ready;
    let binKey = sodium.from_base64(key);
    let binSecret = sodium.from_string(secret);
    let encBytes = sodium.crypto_box_seal(binSecret, binKey);
    return sodium.to_base64(encBytes);
}

const key = process.argv[2];
const secret = process.argv[3];
encrypt(key, secret).then(console.log);