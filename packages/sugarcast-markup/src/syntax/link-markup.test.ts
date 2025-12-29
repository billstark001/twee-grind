import { parseLinkMarkup } from './link-markup';

const _l = (s: string, start = 0) => parseLinkMarkup({ source: s, matchStart: start });

describe('link markup module', () => {
  test('parses link markups', () => {
    expect(_l('[[Grocery]]'))
      .toEqual({ pos: 11, isLink: true, link: 'Grocery' });

    expect(_l('[[$go]]'))
      .toEqual({ pos: 7, isLink: true, link: '$go' });

    expect(_l('[[Go buy milk|Grocery]]'))
      .toEqual({ pos: 23, isLink: true, text: 'Go buy milk', link: 'Grocery' });

    expect(_l('[[$show|$go]]'))
      .toEqual({ pos: 13, isLink: true, text: '$show', link: '$go' });
  });

  test('parses link markups with setter', () => {
    expect(_l('[[Grocery][$bought to "milk"]]'))
      .toEqual({ pos: 30, isLink: true, link: 'Grocery', setter: '$bought to "milk"' });

    expect(_l('[[$go][$bought to "milk"]]'))
      .toEqual({ pos: 26, isLink: true, link: '$go', setter: '$bought to "milk"' });

    expect(_l('[[Go buy milk|Grocery][$bought to "milk"]]'))
      .toEqual({ pos: 42, isLink: true, text: 'Go buy milk', link: 'Grocery', setter: '$bought to "milk"' });

    expect(_l('[[$show|$go][$bought to "milk"]]'))
      .toEqual({ pos: 32, isLink: true, text: '$show', link: '$go', setter: '$bought to "milk"' });
  });

  test('parses image link markups', () => {
    expect(_l('[img[Go home|home.png]]'))
      .toEqual({ pos: 23, isImage: true, text: 'Go home', source: 'home.png' });

    expect(_l('[img[$show|$src]]'))
      .toEqual({ pos: 17, isImage: true, text: '$show', source: '$src' });

    expect(_l('[<img[Go home|home.png][Home]]'))
      .toEqual({ align: 'left', pos: 30, isImage: true, text: 'Go home', source: 'home.png', link: 'Home' });

    expect(_l('[>img[$show|$src][$go]]'))
      .toEqual({ align: 'right',  pos: 23, isImage: true, text: '$show', source: '$src', link: '$go' });

    expect(_l('[img[Go home|home.png][Home][$done to true]]'))
      .toEqual({ pos: 44, isImage: true, text: 'Go home', source: 'home.png', link: 'Home', setter: '$done to true' });

    expect(_l('[img[$show|$src][$go][$done to true]]'))
      .toEqual({ pos: 37, isImage: true, text: '$show', source: '$src', link: '$go', setter: '$done to true' });
  });
});