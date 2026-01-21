import { onRequestGet as __api_data__indicator__ts_onRequestGet } from "/Users/micheal/Development/mountain/app/functions/api/data/[indicator].ts"
import { onRequestGet as __api_batch_data_ts_onRequestGet } from "/Users/micheal/Development/mountain/app/functions/api/batch-data.ts"
import { onRequestGet as __api_convergence_ts_onRequestGet } from "/Users/micheal/Development/mountain/app/functions/api/convergence.ts"
import { onRequestGet as __api_countries_ts_onRequestGet } from "/Users/micheal/Development/mountain/app/functions/api/countries.ts"
import { onRequestGet as __api_indicators_ts_onRequestGet } from "/Users/micheal/Development/mountain/app/functions/api/indicators.ts"
import { onRequestGet as __api_og_png_ts_onRequestGet } from "/Users/micheal/Development/mountain/app/functions/api/og.png.ts"
import { onRequestGet as __share_ts_onRequestGet } from "/Users/micheal/Development/mountain/app/functions/share.ts"

export const routes = [
    {
      routePath: "/api/data/:indicator",
      mountPath: "/api/data",
      method: "GET",
      middlewares: [],
      modules: [__api_data__indicator__ts_onRequestGet],
    },
  {
      routePath: "/api/batch-data",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_batch_data_ts_onRequestGet],
    },
  {
      routePath: "/api/convergence",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_convergence_ts_onRequestGet],
    },
  {
      routePath: "/api/countries",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_countries_ts_onRequestGet],
    },
  {
      routePath: "/api/indicators",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_indicators_ts_onRequestGet],
    },
  {
      routePath: "/api/og.png",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_og_png_ts_onRequestGet],
    },
  {
      routePath: "/share",
      mountPath: "/",
      method: "GET",
      middlewares: [],
      modules: [__share_ts_onRequestGet],
    },
  ]