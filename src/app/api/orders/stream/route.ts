"use server";

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id || session.user.userType !== "vendor") {
    return new Response("Unauthorized", { status: 401 });
  }

  const customerId = parseInt(session.user.id);
  
  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let lastStatusHash = "";
  let intervalId: NodeJS.Timeout | null = null;
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));
      
      // Check for order status changes every 5 seconds
      intervalId = setInterval(async () => {
        try {
          const orders = await prisma.order.findMany({
            where: {
              customer_id: customerId,
              status: { in: ["PENDING", "PREPARING", "READY"] },
            },
            orderBy: { order_date: "desc" },
            select: {
              order_id: true,
              status: true,
              order_date: true,
              total_amount: true,
              items: {
                select: {
                  quantity: true,
                  price: true,
                  product: {
                    select: { product_name: true },
                  },
                },
              },
            },
          });
          
          // Create a hash of the current state to detect changes
          const currentHash = JSON.stringify(orders.map(o => ({ id: o.order_id, status: o.status })));
          
          // Only send update if there's a change
          if (currentHash !== lastStatusHash) {
            lastStatusHash = currentHash;
            
            const formattedOrders = orders.map(order => ({
              order_id: order.order_id,
              status: order.status,
              order_date: order.order_date,
              total_amount: Number(order.total_amount),
              items_count: order.items.length,
              items: order.items.map(item => ({
                product_name: item.product.product_name,
                quantity: item.quantity,
                price: Number(item.price),
              })),
            }));
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: "orders_update", 
                data: formattedOrders 
              })}\n\n`)
            );
          } else {
            // Send heartbeat to keep connection alive
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          }
        } catch (error) {
          console.error("SSE order status error:", error);
        }
      }, 5000); // Check every 5 seconds for orders (more critical than notifications)
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
