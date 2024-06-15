import { exit } from 'process'
import { wollokVersion } from '../package.json'

if (wollokVersion.includes(':')) {
  console.error('ERROR: wollokVersion in package.json must be a fixed version')
  exit(-1)
}