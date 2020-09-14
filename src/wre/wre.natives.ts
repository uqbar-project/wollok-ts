import game from './game'
import sounds from './game'
import lang from './lang'
import lib from './lib'
import vm from './vm'
import { Natives } from '../interpreter'

const WRENatives: Natives = {
  wollok: {
    lang,
    game,
    lib,
    vm,
    sounds,
  },
}

export default WRENatives