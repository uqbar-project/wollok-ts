import { join } from 'path'
import { runAllTestsIn } from './runner'

runAllTestsIn(join('language', 'test', 'examples'))