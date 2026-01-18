const bcrypt = require('bcrypt');

async function generateHashes() {
    const passwords = {
        'admin123': await bcrypt.hash('admin123', 10),
        'instructor123': await bcrypt.hash('instructor123', 10)
    };

    console.log('Password Hashes:');
    console.log('admin123:', passwords['admin123']);
    console.log('instructor123:', passwords['instructor123']);
}

generateHashes();
