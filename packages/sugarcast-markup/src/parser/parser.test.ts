const sum = (a: number, b: number) => a + b;


const passage1 = `The rain in Spain falls \\
mainly on the plain.

The rain in Spain falls \\    
mainly on the plain.

The rain in Spain falls
\\ mainly on the plain.

The rain in Spain falls
    \\ mainly on the plain.`;

const passage2 = `

! Variables

a = $a
b = _b
$variable
$variable.property
$variable[1]
$variable["property"]
$variable['property']
$variable[$indexOrPropertyVariable]
$v.w[1]["2"]['3'][$x]

! Links

Category 1:
[[Grocery]]
[[$go]]

Category 2:
[[Go buy milk|Grocery]]
[[$show|$go]]

Category 3:
[[Grocery][$bought to "milk"]]
[[$go][$bought to "milk"]]

Category 4:
[[Go buy milk|Grocery][$bought to "milk"]]
[[$show|$go][$bought to "milk"]]


! Images

[img[home.png]]
[img[$src]]

[img[home.png][Home]]
[img[$src][$go]]

[img[home.png][Home][$done to true]]
[img[$src][$go][$done to true]]

[img[Go home|home.png]]
[img[$show|$src]]

[img[Go home|home.png][Home]]
[img[$show|$src][$go]]

[img[Go home|home.png][Home][$done to true]]
[img[$show|$src][$go][$done to true]]
`;

const passage3 = `
! Emphasis
//Emphasis//
<em>Emphasis</em>

! Strong
''Strong''
<strong>Strong</strong>

! Underline
__Underline__
<u>Underline</u>

! Strikethrough
==Strikethrough==
<s>Strikethrough</s>

! Superscript
Super^^script^^
Super<sup>script</sup>

! Subscript
Sub~~script~~
Sub<sub>script</sub>

! Lists

!! Unordered  

* A list item
* Another list item
** A list item
** Another list item

<ul>
<li>A list item</li>
<li>Another list item</li>
</ul>

!! Ordered  

# A list item
# Another list item
## A list item
## Another list item

<ol>
<li>A list item</li>
<li>Another list item</li>
</ol>

! Quotes by Line

>Line 1
>Line 2
>>Nested 1
>>Nested 2

! Quotes by Block

<<<
 Line 1
 Line 2
 <span>Line 3</span>
<<<

{{{$code}}}
{{{ 
  $multiline + $code
}}} 

----
--------
------------

"""No //format//"""
<nowiki>No //format//</nowiki>

! Styles

  
@@#alfa;.bravo;Text@@
@@color:red;Text@@
@@#alfa;.bravo;
Text
@@
@@color:red;
Text
@@

! Comments

/* This is a comment. */
/% This is a comment. %/
<!-- This is a comment. -->

// This is not a comment.
# This is not a comment.
// This is a formatted string.
# This is an ordered list.


`;

const passageWithMacro = `
<<widget "importDetailsDisplay">>
  <<if _args[0]>>
    <div class="presetConfirm settingsGrid">
      <<if _args[0].starting isnot undefined>>
        <div class="settingsHeader">
          test1
        </div>
        <div class="settingsToggleItem">
          <span class="gold">test2</span>
          <<set _validatorObject to settingsObjects("starting")>>
          <<presetConfirm _args[0].starting>>
        </div>
        <<if _args[0].starting.player isnot undefined>>
        <div class="settingsToggleItem">
          <span class="gold">test3</span>
          <<set _validatorObject to settingsObjects("starting")>>
          <<presetConfirm _args[0].starting.player>>
        <<if _args[0].starting.skinColor isnot undefined>>
        <hr style="border-top:1px solid var(--700)">
          <span class="gold">test4</span>
          <<set _validatorObject to settingsObjects("starting")>>
          <<presetConfirm _args[0].starting.skinColor>>
        <</if>>
        </div>
        <</if>>
      <</if>>

      <<if _args[0].general isnot undefined>>
        <div class="settingsToggleItem">
        <span class="gold">test5</span>
        <<set _validatorObject to settingsObjects("general")>>
        <<presetConfirm _args[0].general>>
        <<silently>>
        <<if _args[0].general.skinColor isnot undefined>>
          <span class="gold">test6</span>
          <<set _validatorObject to settingsObjects("general")>>
          <<presetConfirm _args[0].general.skinColor>>
        <</if>>
        <<if _args[0].general.map isnot undefined>>
          <span class="gold">test7</span>
          <<set _validatorObject to settingsObjects("general")>>
          <<presetConfirm _args[0].general.map>>
        <</if>>
        <<if _args[0].general.shopDefaults isnot undefined>>
          <span class="gold">test8</span>
          <<set _validatorObject to settingsObjects("general")>>
          <<presetConfirm _args[0].general.shopDefaults>>
        <</if>>
        <</silently>>
        </div>
        <div class="settingsToggleItem">
        <<if _args[0].general.options isnot undefined>>
          <span class="gold">test9</span>
          <<set _validatorObject to settingsObjects("general")>>
          <<presetConfirm _args[0].general.options>>
        <</if>>
        </div>
      <</if>>

      <<if _args[0].npc isnot undefined>>
        <div class="settingsHeader">
        test10
        <<set _validatorObject to settingsObjects("npc")>>
        </div>
        <<for $_label, $_value range _args[0].npc>>
          <div class="settingsToggleItem">
          <span class="gold"><<print $_label>>:</span>
          <<presetConfirm $_value $_label>>
          </div>
        <</for>>
      <</if>>
    </div>
  <</if>>
<</widget>>
`;

describe('sum module', () => {
  test('adds 1 + 2 to equal 3', () => {
    expect(sum(1, 2)).toBe(3);
  });
});