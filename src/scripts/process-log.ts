import { ClaudiaCodeParser } from '../parsers/claudia-code-parser.js'
import fs from 'node:fs'
const log = fs.readFileSync(
  '/Users/michael/.local/state/claudia-code/logs/Users-michael-Projects-beehiiv-swarm/ses_01kc4s17kkfvkavs4k0zrnpk0d.jsonl',
  'utf-8',
)
const parser = new ClaudiaCodeParser()
parser.parse(log).then((messages) => console.log(messages.length))
