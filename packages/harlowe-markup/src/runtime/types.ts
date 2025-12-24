type StyleAttributes = Record<string, any>; // TODO
type RenderNode = undefined; // TODO

export interface StateManager {
  getGlobal(name: string): any;
  setGlobal(name: string, value: any): void;
  getTemp(name: string): any;
  setTemp(name: string, value: any): void;
  randInt(min: number, max: number): number;
  randFloat(): number; // 0-1
}

export interface ChangerStack {
  getChangers(): StyleAttributes;
  appendChanger(changer: StyleAttributes): void;
  clear(): void;
}

export interface HooksManager {
  register(name: string, renderNode: RenderNode): void;
  get(name: string): RenderNode | undefined;
}

export interface NavigationManager {
  goto(passageName: string): Promise<void>;
  renderPassage(passageName: string): Promise<void>; // render in current passage
  sleep(ms: number): Promise<void>;

  getHistory(): string[];
}

export interface MacroRegistry {
  call(macroName: string, args: any[]): any;
  has(macroName: string): boolean;
}
