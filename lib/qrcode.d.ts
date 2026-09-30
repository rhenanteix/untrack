declare module "qrcode" {
  export interface QRCodeToDataURLOptions {
    type?: "image/png";
    width?: number;
    margin?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }
  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions,
  ): Promise<string>;
  export function toBuffer(
    text: string,
    options?: Omit<QRCodeToDataURLOptions, "type"> & { type?: "png" },
  ): Promise<Buffer>;
}
