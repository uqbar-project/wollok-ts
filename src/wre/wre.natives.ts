import game from './game'
import lang from './lang'
import lib from './lib'
import vm from './vm'
import mirror from './mirror'
import db from './db'
import { Natives } from '../interpreter/runtimeModel'


const WRENatives: Natives = {
  wollok: {
    lang,
    game,
    lib,
    vm,
    mirror,
    db,
  },
}


export default WRENatives