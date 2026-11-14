import os from "os";

export const dynamic = "force-dynamic";

// Address of this laptop on the local network: QR codes point to it so a phone can open the page.
export function GET() {
  let host = "localhost";
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === "IPv4" && !i.internal && host === "localhost") host = i.address;
    }
  }
  return Response.json({ lanUrl: `http://${host}:${process.env.PORT || 3000}` });
}
