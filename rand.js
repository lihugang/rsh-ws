const crypto = require('crypto');
module.exports = {
    generateRandomPort() {
        const array = crypto.randomBytes(2);
        return array[0] * 256 + array[1];
    },
};