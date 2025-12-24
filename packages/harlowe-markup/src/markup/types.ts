import {Token} from './lexer.js'
import {ArrayValues} from 'type-fest'

/*
	Every token created by Harlowe markup. These provide more effective type-narrowing than just Token.
*/
export type ErrorToken = Token & {
	type: `error`
	message: string
	explanation: string
}
export type TagToken = Token & {
	type: `tag`
	tag: string
	name: string
}
export type BulletedToken = Token & {
	type: `numbered` | `bulleted`
	depth: number
}
export type NumberedToken = Token & {
	type: `numbered`
	depth: number
}
export type HeadingToken = Token & {
	type: `heading`
	depth: number
}
export type AlignToken = Token & {
	type: `align`
	align: number | string
}
export type ColumnToken = Token & {
	type: `column`
	column: string
	width: number
	marginLeft: number
	marginRight: number
}
export type TwineLinkToken = Token & {
	type: `twineLink`
	innerText?:string
	passage:string
}
export type HookToken = Token & {
	type: `hook` | `unclosedHook`
	name: string
	hidden: boolean
	tagPosition: `appended` | `prepended`
}
export type VerbatimToken = Token & {
	type: `verbatim`
	innerText: string
}
export type MacroToken = Token & {
	type: `macro`
	name: string
	/*
		These are only used for blocker macro tokens, by Renderer.
	*/
	blockerTree?: number
	blockedValue?: boolean
}
export type VariableToken = Token & {
	type: `variable`
	name: string
}
export type TempVariableToken = Token & {
	type: `tempVariable`
	name: string
}
export type HookSetToken = Token & {
	type: `hookName`
	name: string
}
export type NumberToken = Token & {
	type: `number`
	value: number
}
export type CSSMeasureToken = Token & {
	type: `cssMeasure`
	value: number
	unit: string
}
export type DatatypeToken = Token & {
	type: `datatype`
	name: string
}
export type ColourToken = Token & {
	type: `colour`
	colour: string
}
export type InequalityToken = Token & {
	type: `inequality`
	operator: string
	negate: boolean
}
export type IdentifierToken = Token & {
	type: `identifier`
	name: string
}
export type PropertyToken = Token & {
	type: `belongingProperty` | `belongingItProperty` | `property` | `itsProperty`
	name: string
}
/*
	This is a special token type synthesised by Engine, used for holding header, startup, and other passages.
*/
export type IncludeToken = Token & {
	type: `include`
	tag: string
	name: string
}
export const plainKeywords = Object.freeze([`boolean`, `is`, `to`, `into`, `where`, `when`, `via`, `making`, `each`, `and`, `or`, `not`,
`isNot`, `contains`, `doesNotContain`, `isIn`, `isA`, `isNotA`, `isNotIn`, `matches`, `doesNotMatch`, `typifies`, `untypifies`, `bind`] as const)
export const plainOperators = Object.freeze([`comma`, `spread`, `typeSignature`, `addition`, `subtraction`, `multiplication`, `division`] as const)

export type OtherToken = Token & {
	type: `root` | `text` | `whitespace` | `hr` | `br` | `sub` | `sup` | `strong` | `em` | `bold` | `italic` | `strike` | `twine1Macro` | `scriptStyleTag` | `url` | `verbatim${number}` | `collapsed` | `unclosedCollapsed` | `escapedLine` | `legacyLink`
		| `inlineUrl` | `macroName` | `possessiveOperator` | `itsOperator` | `belongingItOperator` | `belongingOperator` | `htmlComment` | `string` | `positive` | `negative` | `grouping` | `comment`
		| ArrayValues<typeof plainKeywords> | ArrayValues<typeof plainOperators>
}

/*
	This should be used in place of Token anytime narrowing based on the type is required.
*/
export type AnyToken = (ErrorToken | TagToken | BulletedToken | NumberedToken | HeadingToken | AlignToken | ColumnToken | TwineLinkToken | HookToken | VerbatimToken | MacroToken | VariableToken | TempVariableToken | NumberToken | CSSMeasureToken
	| HookSetToken | ColourToken | DatatypeToken | InequalityToken | IdentifierToken | PropertyToken | IncludeToken
	| OtherToken)
	/*
		This makes type-checks for AnyToken.children easier, by allowing the children to propagate this type.
	*/
	& { children: AnyToken[] }

export type TokenType = AnyToken[`type`]
export type IncompleteTokenType = TokenType | `emBack` | `emFront` | `strongBack` | `strongFront` | `hookBack` | `hookFront` | `htmlCommentBack` | `htmlCommentFront` | `groupingBack` | `groupingFront` | `boldOpener` | `italicOpener` | `strikeOpener`
	| `supOpener` | `hookPrependedFront` | `hookAppendedBack` | `unclosedHookPrepended` | `verbatimOpener` | `collapsedFront` | `collapsedBack` | `macroFront` | `passageLink` | `simpleLink` | `singleStringOpener` | `doubleStringOpener`
	| `singleStringCloser` | `doubleStringCloser` | `escapedStringChar` | `incorrectOperator`
export type IncompleteToken = Partial<AnyToken | (Token & {
	type: IncompleteTokenType
})>
