import { authenticateSource } from "@/modules/connect/sources";
import { connectError, receiveEvent } from "@/modules/connect/http";

export async function POST(request: Request) {
  try {
    return await receiveEvent(request, await authenticateSource(request));
  } catch (error) {
    return connectError(error);
  }
}
