import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/api-response";
import { requireActor } from "@/modules/workspaces/context";
import { projectExport } from "@/modules/workspace-intelligence/dashboard";

type Context = { params: Promise<{ id: string }> };

function csvCell(value: string) {
  return `"${value.replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
}

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const format = new URL(request.url).searchParams.get("format") ?? "json";
    if (format !== "json" && format !== "csv")
      throw new ApiError(400, "INVALID_EXPORT_FORMAT", "Use JSON ou CSV.");
    const items = await projectExport(actor, id);
    if (format === "json") {
      return NextResponse.json({ items }, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename="project-${id}.json"`,
        },
      });
    }
    const csv = [
      ["Tipo", "Nome", "Descrição", "Endereço"],
      ...items.map((item) => [item.resourceType, item.name, item.description, item.href]),
    ]
      .map((row) => row.map((item) => csvCell(item)).join(","))
      .join("\r\n");
    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="project-${id}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}