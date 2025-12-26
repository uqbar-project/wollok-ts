import game from './game'
import lang from './lang'
import lib from './lib'
import mirror from './mirror'
import { Natives } from '../interpreter/runtimeModel'


const WRENatives: Natives = {
  wollok: {
    lang,
    game,
    lib,
    mirror,
  },
}


export default WRENatives