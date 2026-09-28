import type { StaticDataEnv } from "./_lib/staticData";
import { onRequest as canonicalHost } from "./_middleware";
import { onRequestGet as batchData } from "./api/batch-data";
import { onRequestGet as chartSvg } from "./api/chart.svg";
import { onRequestGet as compareApi } from "./api/compare";
import { onRequestGet as convergence } from "./api/convergence";
import { onRequestGet as countries } from "./api/countries";
import { onRequestGet as indicatorData } from "./api/data/[indicator]";
import { onRequestGet as indicators } from "./api/indicators";
import { onRequestGet as ogImage } from "./api/og.png";
import { onRequestGet as requiredGrowth } from "./api/required-growth";
import { onRequestGet as comparePage } from "./compare";
import { onRequestGet as methodology } from "./methodology";
import { onRequestGet as share } from "./share";
import { onRequestGet as sitemap } from "./sitemap";

type Handler = (context: {
  request: Request;
  env: StaticDataEnv;
  params: Record<string, string>;
}) => Response | Promise<Response>;

const routes: Record<string, Handler> = {
  "/share": share,
  "/sitemap.xml": sitemap,
  "/methodology": methodology,
  "/api/batch-data": batchData,
  "/api/chart.svg": chartSvg,
  "/api/compare": compareApi,
  "/api/convergence": convergence,
  "/api/countries": countries,
  "/api/indicators": indicators,
  "/api/og.png": ogImage,
  "/api/required-growth": requiredGrowth,
};

const INDICATOR_PATH = /^\/api\/data\/([^/]+)$/;
const COMPARE_PATH = /^\/compare\/[^/]+\/[^/]+$/;

function resolve(pathname: string): { handler: Handler; params: Record<string, string> } | null {
  const indicator = INDICATOR_PATH.exec(pathname)?.[1];
  if (indicator) {
    return { handler: indicatorData, params: { indicator: decodeURIComponent(indicator) } };
  }
  if (COMPARE_PATH.test(pathname)) return { handler: comparePage, params: {} };
  const handler = routes[pathname];
  return handler ? { handler, params: {} } : null;
}

// Routes mirror the former Pages Functions file layout. Everything else, including
// the SPA fallback, is served by the assets binding.
export default {
  async fetch(request: Request, env: StaticDataEnv): Promise<Response> {
    const next = async () => {
      const route = resolve(new URL(request.url).pathname);
      if (!route || (request.method !== "GET" && request.method !== "HEAD")) {
        return env.ASSETS.fetch(request);
      }
      return route.handler({ request, env, params: route.params });
    };
    return canonicalHost({ request, env, next } as never);
  },
};
