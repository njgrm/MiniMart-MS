import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Keep track of the last notification ID we've sent to avoid duplicates
// This is per-connection, stored in the stream itself

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = parseInt(session.user.id);
  const userType = session.user.userType || "staff";
  
  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let lastCheckTime = new Date();
  let intervalId: NodeJS.Timeout | null = null;
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));
      
      // Check for new notifications every 10 seconds (much better than constant polling)
      intervalId = setInterval(async () => {
        try {
          // Query for new notifications since last check
          const newNotifications = await prisma.notification.findMany({
            where: {
              user_id: userId,
              user_type: userType,
              created_at: { gt: lastCheckTime },
            },
            orderBy: { created_at: "desc" },
            take: 10,
          });
          
          if (newNotifications.length > 0) {
            lastCheckTime = new Date();
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: "notifications", 
                data: newNotifications 
              })}\n\n`)
            );
          }
          
          // Send a heartbeat every check to keep connection alive
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (error) {
          console.error("SSE notification check error:", error);
        }
      }, 10000); // Check every 10 seconds
    },
    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
