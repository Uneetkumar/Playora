import { NextResponse } from "next/server";
import os from "node:os";

export async function GET(req: Request) {
  try {
    const interfaces = os.networkInterfaces();
    let bestIp = "127.0.0.1";

    // Find the first external IPv4 address (Wi-Fi / Ethernet e.g. 192.168.x.x, 10.x.x.x)
    for (const name of Object.keys(interfaces)) {
      const ifaceList = interfaces[name];
      if (!ifaceList) continue;
      for (const iface of ifaceList) {
        if (iface.family === "IPv4" && !iface.internal) {
          bestIp = iface.address;
          break;
        }
      }
      if (bestIp !== "127.0.0.1") break;
    }

    const hostHeader = req.headers.get("host") || "localhost:8000";
    const port = hostHeader.split(":")[1] || "8000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";

    const lanOrigin = `${protocol}://${bestIp}:${port}`;

    return NextResponse.json({
      ip: bestIp,
      port,
      lanOrigin,
      isLocal: bestIp !== "127.0.0.1",
    });
  } catch (error) {
    return NextResponse.json(
      { ip: "127.0.0.1", port: "8000", lanOrigin: "http://localhost:8000", isLocal: false },
      { status: 200 }
    );
  }
}
