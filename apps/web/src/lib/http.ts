import { NextResponse, type NextRequest } from "next/server";
import { ApiRouteError, generateCorrelationId, logRouteEvent } from "@tastetrail/server";

export function jsonOk<T>(request: NextRequest, routeName: string, data: T, status = 200) {
  const correlationId = request.headers.get("x-correlation-id") || generateCorrelationId();
  return NextResponse.json(data, {
    status,
    headers: {
      "x-correlation-id": correlationId,
      "x-route-name": routeName,
    },
  });
}

export async function withApiRoute(
  request: NextRequest,
  routeName: string,
  handler: (correlationId: string) => Promise<NextResponse>,
) {
  const correlationId = request.headers.get("x-correlation-id") || generateCorrelationId();
  try {
    return await handler(correlationId);
  } catch (error) {
    const routeError = error instanceof ApiRouteError ? error : new ApiRouteError(500, error instanceof Error ? error.message : "Unexpected error");
    await logRouteEvent(request, {
      routeName,
      severity: "error",
      message: routeError.message,
      correlationId,
      details: routeError.details ?? null,
    });
    return NextResponse.json(
      {
        error: true,
        message: routeError.message,
        correlationId,
        details: routeError.details,
      },
      {
        status: routeError.status,
        headers: {
          "x-correlation-id": correlationId,
          "x-route-name": routeName,
        },
      },
    );
  }
}
