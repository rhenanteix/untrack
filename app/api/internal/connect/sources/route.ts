import { z } from "zod";
import { readJson } from "@/lib/api-response";
import { operationalAuth, connectError } from "@/modules/connect/http";
import {
  provisionSource,
  rotateSourceCredential,
} from "@/modules/connect/sources";

/** Machine-to-machine provisioning: session cookies and browser origins are not accepted. */
export async function POST(request: Request) {
  try {
    operationalAuth(request, "admin");
    const input = z
      .discriminatedUnion("operation", [
        z
          .object({
            operation: z.literal("provision"),
            workspace_id: z.string().min(1).max(128),
            source: z.unknown(),
          })
          .strict(),
        z
          .object({
            operation: z.literal("rotate"),
            workspace_id: z.string().min(1).max(128),
            source_connection_id: z.string().min(1).max(128),
          })
          .strict(),
      ])
      .parse(await readJson(request, 16_384));
    const result =
      input.operation === "provision"
        ? await provisionSource(input.workspace_id, input.source)
        : await rotateSourceCredential(
            input.workspace_id,
            input.source_connection_id,
          );
    return Response.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch (error) {
    return connectError(error);
  }
}
