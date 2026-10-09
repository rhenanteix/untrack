import { z } from "zod";
import { readJson } from "@/lib/api-response";
import { operationalAuth, connectError } from "@/modules/connect/http";
import { drainConnectQueue } from "@/modules/connect/queue";
import { purgeConnectData } from "@/modules/connect/operations";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    operationalAuth(request, "worker");
    const input = z
      .object({
        operation: z.enum(["drain", "retention"]),
        limit: z.number().int().min(1).max(20).default(10),
      })
      .strict()
      .parse(await readJson(request, 1024));
    return Response.json(
      input.operation === "retention"
        ? await purgeConnectData()
        : await drainConnectQueue(input.limit),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return connectError(error);
  }
}
