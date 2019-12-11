import { readFileSync, writeFileSync } from 'fs'
import { Package } from '../src/builders'
import fill from '../src/filler'
import link from '../src/linker'
import { file } from '../src/parser'

const { log } = console

const WRE_PATH = 'src/wre'

log('Building WRE...')

log('\tParsing...')
const rawWRE = Package('wollok')(
  file('lang').tryParse(readFileSync(`${WRE_PATH}/lang.wlk`, 'utf8')),
  file('io').tryParse(readFileSync(`${WRE_PATH}/io.wlk`, 'utf8')),
  file('game').tryParse(readFileSync(`${WRE_PATH}/game.wlk`, 'utf8')),
)

log('\tFilling...')
const filledWRE = fill(rawWRE)

log('\tLinking...')
const wre = link([filledWRE])

log('\tSaving...')
writeFileSync(`${WRE_PATH}/wre.json`, JSON.stringify(wre))

log('Done.')