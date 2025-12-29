export function buildReverseMap<T extends string, U extends string>(
  map: Readonly<Record<T, U>>
): Readonly<Record<U, readonly T[]>> {
  const reverseMap: Record<U, T[]> = {} as Record<U, T[]>
  for (const [key, value] of Object.entries(map) as [T, U][]) {
    if (!reverseMap[value]) {
      reverseMap[value] = []
    }
    reverseMap[value].push(key)
  }
  for (const key of Object.keys(reverseMap) as U[]) {
    Object.freeze(reverseMap[key])
  }
  Object.freeze(reverseMap)
  return reverseMap as Readonly<Record<U, readonly T[]>>
}


export type JsonSerializable =
  | null
  | boolean
  | number
  | string
  | JsonSerializable[]
  | { [key: string]: JsonSerializable }
