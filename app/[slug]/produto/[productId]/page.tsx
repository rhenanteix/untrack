import PublicProductPage, {
  generateMetadata as getMetadata,
} from "../../../page/[slug]/produto/[productId]/page";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: Parameters<typeof getMetadata>[0],
) {
  return getMetadata(props);
}

export default PublicProductPage;
