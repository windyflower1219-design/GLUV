import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

// 워크트리(.claude/worktrees/*)에서 실행될 수도, 메인 디렉토리에서 실행될 수도 있음.
// node_modules/next가 직접 존재하는 디렉토리를 찾아 워크스페이스 루트로 지정.
function findWorkspaceRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'node_modules', 'next', 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

const workspaceRoot = findWorkspaceRoot(__dirname);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['220.94.245.74'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' }
    ],
  },
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
};

export default withPWA(nextConfig);
