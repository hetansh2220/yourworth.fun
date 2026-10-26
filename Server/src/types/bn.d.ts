declare module "bn.js" {
  export default class BN {
    constructor(value: string | number | Uint8Array);
    lten(value: number): boolean;
    bitLength(): number;
    isNeg(): boolean;
  }
}
