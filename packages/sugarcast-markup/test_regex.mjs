import { Patterns } from './dist/index.js';

const macroRe = new RegExp(`<<(/?${Patterns.macroName})\\s*`, 'gm');
const test1 = '<<if 5 gt 3>>test<</if>>';
const test2 = '<<set $x = 5>>';

console.log('Macro pattern:', macroRe);
console.log('Test 1 match:', macroRe.exec(test1));
macroRe.lastIndex = 0;
console.log('Test 2 match:', macroRe.exec(test2));
