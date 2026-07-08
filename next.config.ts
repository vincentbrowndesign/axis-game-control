import type { NextConfig } from "next";

// Legacy Axis routes parked during the clarity pass. The page files remain in
// the repo (preserved infrastructure); they are just not reachable while the
// suite is the product truth. Parallel work-in-progress routes (athletes,
// calibrate, exports, measurements, vision) and lab-linked pages stay live.
const parkedAxisRoutes = [
  "/axis/mission",
  "/axis/napoleon",
  "/axis/midheaven",
  "/axis/space",
  "/axis/routine",
  "/axis/jump-rope",
  "/axis/basketball",
  "/axis/measures-home",
  "/axis/build-map",
  "/axis/vision-probe",
];

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "512mb",
  },
  async redirects() {
    return parkedAxisRoutes.map((source) => ({
      destination: "/axis",
      permanent: false,
      source,
    }));
  },
};

export default nextConfig;
