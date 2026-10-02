import PublicSmartPage, {
  generateMetadata as getMetadata,
} from "../page/[slug]/page";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: Parameters<typeof getMetadata>[0],
) {
  return getMetadata(props);
}

export default PublicSmartPage;
