import { parse } from '../markup';
import { Parser, defaultSyntax } from '../index';

// Test raw parser first
const syntax = defaultSyntax();
const parser = new Parser(syntax);
const raw = parser.parse('<<if $x > 5>>\nContent\n<</if>>');
console.log('Raw parse:', JSON.stringify(raw, null, 2));

// Quick test to see what's being generated
const result = parse('<<set $x = 5>>');
console.log('\n=== Result 1: ===\n', JSON.stringify(result, null, 2));

const result2 = parse('<<if $x gt 5>>\nContent\n<</if>>');
console.log('\n=== Result 2: ===\n', JSON.stringify(result2, null, 2));
