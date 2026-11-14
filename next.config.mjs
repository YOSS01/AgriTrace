/** @type {import('next').NextConfig} */
const nextConfig = {
  // /rpc is forwarded to the local blockchain node, so the browser (and a phone on the
  // same Wi-Fi) talks to the blockchain through the same address as the web page.
  async rewrites() {
    return [{ source: "/rpc", destination: "http://127.0.0.1:8545" }];
  },
};

export default nextConfig;
