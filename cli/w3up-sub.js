import { spawn } from 'child_process'

const w3cli = 'node_modules/w3up-cli/src/cli.js'

const run = (...args) => spawn(w3cli, args, { stdio: 'inherit' })

export default run
