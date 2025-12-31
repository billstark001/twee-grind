import { defaultSyntax, Parser } from './dist/index.js';

const syntax = defaultSyntax();
const parser = new Parser(syntax);
const result = parser.parse('<<if 5 gt 3>>test<</if>>');
console.log(JSON.stringify(result, null, 2));
