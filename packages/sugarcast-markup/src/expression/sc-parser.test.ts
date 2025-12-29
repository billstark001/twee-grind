import { DesugarParser, InlineExpressionParser, MacroParameterParser } from './sc-parser';
import { Options } from 'acorn';
import { generate } from 'escodegen';

const options: Options = {
  ecmaVersion: 11
};

const desugar = new DesugarParser(options, '');
const macro = new MacroParameterParser(options, '');
const inline = new InlineExpressionParser(options, '');

describe('extended script desugar parser', () => {

  test('parses code with desugar tokens', () => {
    expect(generate(desugar.parseSingle('1 + 2 * 4 band (555555 ursh 32) gte 114514')))
      .toBe('1 + 2 * 4 & 555555 >>> 32 >= 114514');
  });
  test('parses code with def/ndef', () => {
    expect(generate(desugar.parseSingle('def $var1 and ndef _var1')))
      .toBe('typeof State.variables.var1 !== undefined && typeof State.temporary.var1 === undefined');
  });

  test('escapes only the first layer of identifier', () => {
    expect(generate(desugar.parseSingle('$v.$v._v._v')))
      .toBe('State.variables.v.$v._v._v');
    expect(generate(desugar.parseSingle('$v[$v]')))
      .toBe('State.variables.v[State.variables.v]');
  });

});

describe('macro parameter parser', () => {

  test('parses code inside macro', () => {
    const res = macro.parseAll('<<someMacro $var1.var2[var3][\'var4\'] _var5 (no, func, params) $var6(func, params)>> outside macro', 11)
      .map(x => generate(x));
    expect(res.length).toBe(4);
    expect(res[0]).toBe('State.variables.var1.var2[var3][\'var4\']');
    expect(res[1]).toBe('State.temporary.var5');
    expect(res[2]).toBe('no, func, params');
    expect(res[3]).toBe('State.variables.var6(func, params)');
  });
  test('parses real macro', () => {
    const res = macro.parseAll('<<set $var1 to \'var2\' >>', 5)
      .map(x => generate(x));
    expect(res.length).toBe(1);
    expect(res[0]).toBe('State.variables.var1 = \'var2\'');
  });
  test('parses right bit shift inside parens in a macro', () => {
    const res = macro.parseAll('<<set $var1 to ( 114514 >> 19 >>> 19 << 8 >> 10 ) >>', 5)
      .map(x => generate(x));
    expect(res.length).toBe(1);
    expect(res[0]).toBe('State.variables.var1 = 114514 >> 19 >>> 19 << 8 >> 10');
  });

});

describe('inline expression parser', () => {
  test('halts in top-level space', () => {
    expect(generate(inline.parseSingle('a + b'))).toBe('a');
    expect(generate(inline.parseSingle('a+b'))).toBe('a + b');
    expect(generate(inline.parseSingle('(a + b)'))).toBe('a + b');
  });
});