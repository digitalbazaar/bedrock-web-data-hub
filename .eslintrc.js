module.exports = {
  globals: {
    crypto: true,
    CryptoKey: true,
    TextDecoder: true,
    TextEncoder: true,
    Uint8Array: true
  },
  extends: [
    'digitalbazaar',
    'digitalbazaar/jsdoc'
  ]
}
