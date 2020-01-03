import { join } from 'path'
import { runAllTestsIn } from './runner'

runAllTestsIn(join('test', 'game'))