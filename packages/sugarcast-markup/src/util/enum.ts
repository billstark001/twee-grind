/***********************************************************************************************************************

  util/enumfrom.js

  Copyright © 2013–2023 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
  Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

export type EnumType<T> = T & {
  nameFrom: (needle: keyof T) => T[keyof T];
};

type NumberRecord<T> = { [name in (keyof T & string)]: number };
type ValueRecord<T, U> = { [idx in (keyof T & string)]: U | null | undefined | object };
type _U = string | bigint | number | boolean | symbol;
/*
  Returns a pseudo-enumeration object created from the given Array, Map, Set,
  or generic object.
*/

export function enumFrom<T>(O: (keyof T & string)[]): Readonly<EnumType<NumberRecord<T>>>;
export function enumFrom<T>(O: Set<keyof T & string>): Readonly<EnumType<NumberRecord<T>>>;
export function enumFrom<T, U extends _U>(O: Map<keyof T & string, U | null | undefined | object>): Readonly<EnumType<ValueRecord<T, U>>>;
export function enumFrom<T extends ValueRecord<T, U>, U extends _U>(O: T): Readonly<EnumType<T>>;

export function enumFrom<T = number>(O: (keyof T & string)[] | Set<(keyof T & string)> | Map<string, T> | T) { // eslint-disable-line no-unused-vars
  const pEnum = Object.create(null);

  if (O instanceof Array) {
    O.forEach((val, i) => pEnum[String(val)] = i as T);
  }
  else if (O instanceof Set) {
    // NOTE: Use `<Array>.forEach()` here rather than `<Set>.forEach()`
    // as the latter does not provide the indices we require.
    Array.from(O).forEach((val, i) => pEnum[String(val)] = i as T);
  }
  else if (O instanceof Map) {
    O.forEach((val, key) => pEnum[String(key)] = val);
  }
  else if (
    O !== null
    && typeof O === 'object'
    && Object.getPrototypeOf(O) === Object.prototype
  ) {
    Object.assign(pEnum, O);
  }
  else {
    throw new TypeError('enumFrom object parameter must be an Array, Map, Set, or generic object');
  }

  return Object.freeze(Object.defineProperties(pEnum, {
    nameFrom: {
      value(needle: T) {
        const entry = Object.entries(this).find(entry => entry[1] === needle);
        return entry ? entry[0] : undefined;
      }
    }
  }));
}


export function enumFromNames<T>(names: (keyof T)[]): Readonly<{ [name in (keyof T)]: number }> {
  const obj = names.reduce<T>((obj, name, i) => {
    obj[name] = i as T[keyof T];
    return obj;
  }, {} as T);
  return Object.freeze(Object.assign(Object.create(null), obj));
}

export function enumFromNamesStr<T>(names: (keyof T & string)[]): Readonly<{ [name in (keyof T & string)]: name }> {
  const obj = names.reduce<T>((obj, name) => {
    obj[name] = name as unknown as T[keyof T & string];
    return obj;
  }, {} as T);
  return Object.freeze(Object.assign(Object.create(null), obj));
}