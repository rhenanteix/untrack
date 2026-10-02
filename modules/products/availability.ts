export function isProductPublic(
  product: {
    status: "draft" | "active" | "archived";
    visible: boolean;
    startAt: Date | null;
    endAt: Date | null;
  },
  now = new Date(),
) {
  return (
    product.status === "active" &&
    product.visible &&
    (!product.startAt || product.startAt <= now) &&
    (!product.endAt || product.endAt > now)
  );
}