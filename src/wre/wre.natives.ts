import game from './game'
import lang from './lang'
import lib from './lib'
import vm from './vm'
import mirror from './mirror'
import { Natives } from '../interpreter'

const WRENatives: Natives = {
  wollok: {
    lang,
    game,
    lib,
    vm,
    mirror,
  },
}

export default WRENatives