const bcrypt = require('bcrypt')

const password =  'admin123'
const rounds = 12

async function main() {
  try {
    const hash = await bcrypt.hash(password, rounds)
    console.log(hash)
  } catch (err) {
    console.error('Hashing failed', err)
    process.exit(1)
  }
}

main()
