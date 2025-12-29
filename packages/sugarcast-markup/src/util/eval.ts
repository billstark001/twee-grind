

export const compileEvalFunction = <T extends object, R = unknown>(
  code: string,
  defaultScope: T | (keyof T & string)[],
  expression?: boolean,
): (scope: T) => R => {
  const keyArray = Array.isArray(defaultScope) ?
    [...defaultScope] :
    Object.keys(defaultScope) as unknown as (keyof T & string)[];
  const defParams: Partial<T> = Array.isArray(defaultScope) ? {} : { ...defaultScope };
  const funcObj = new Function(...keyArray, expression ? 'return (' + code + ');' : code);
  const funcEval = (scope: T) => {
    const valueArray = new Array(keyArray.length);
    keyArray.forEach((k, i) => {
      if (k in scope) {
        valueArray[i] = scope[k];
      } else {
        valueArray[i] = defParams[k];
      }
    });
    return funcObj(...valueArray);
  };
  return funcEval;
};