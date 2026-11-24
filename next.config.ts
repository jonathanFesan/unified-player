import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Gera .next/standalone (servidor Node autocontido) usado pelo executável em desktop/.
  output: "standalone",
  // O Spotify exige loopback (127.0.0.1) em vez de "localhost" nas Redirect URIs.
  // Isso libera o dev server para ser acessado por http://127.0.0.1:3000.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
