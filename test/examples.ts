import { join } from 'path'
import { runAllTests } from './runner'

runAllTests(join('language', 'test', 'examples'))