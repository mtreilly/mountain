var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-Hy8065/functionsWorker-0.9544714362816049.mjs
var __defProp2 = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var __esm = /* @__PURE__ */ __name((fn, res) => /* @__PURE__ */ __name(function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
}, "__init"), "__esm");
var __export = /* @__PURE__ */ __name((target, all) => {
  for (var name in all)
    __defProp2(target, name, { get: all[name], enumerable: true });
}, "__export");
var onRequestGet;
var init_indicator = __esm({
  "api/data/[indicator].ts"() {
    init_functionsRoutes_0_8646059331410194();
    onRequestGet = /* @__PURE__ */ __name2(async (context) => {
      const { DB } = context.env;
      const indicatorCode = context.params.indicator;
      const url = new URL(context.request.url);
      const countries = url.searchParams.get("countries")?.split(",") || [];
      const startYear = parseInt(url.searchParams.get("start_year") || "1960");
      const endYear = parseInt(
        url.searchParams.get("end_year") || (/* @__PURE__ */ new Date()).getFullYear().toString()
      );
      if (countries.length === 0) {
        return Response.json(
          { error: { code: "MISSING_COUNTRIES", message: "countries parameter is required" } },
          { status: 400 }
        );
      }
      const indicator = await DB.prepare(
        `SELECT code, name, unit FROM indicators WHERE code = ?`
      ).bind(indicatorCode).first();
      if (!indicator) {
        return Response.json(
          { error: { code: "INDICATOR_NOT_FOUND", message: `Indicator ${indicatorCode} not found` } },
          { status: 404 }
        );
      }
      const placeholders = countries.map(() => "?").join(",");
      const result = await DB.prepare(
        `SELECT c.iso_alpha3, d.year, d.value
     FROM data_points d
     JOIN countries c ON d.country_id = c.id
     JOIN indicators i ON d.indicator_id = i.id
     WHERE i.code = ?
       AND c.iso_alpha3 IN (${placeholders})
       AND d.year BETWEEN ? AND ?
     ORDER BY c.iso_alpha3, d.year`
      ).bind(indicatorCode, ...countries, startYear, endYear).all();
      const data = {};
      for (const row of result.results) {
        if (!data[row.iso_alpha3]) {
          data[row.iso_alpha3] = [];
        }
        data[row.iso_alpha3].push({ year: row.year, value: row.value });
      }
      return Response.json({ indicator, data });
    }, "onRequestGet");
  }
});
function uniqueClean(list) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const raw of list) {
    const v = raw.trim().toUpperCase();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
__name(uniqueClean, "uniqueClean");
var onRequestGet2;
var init_batch_data = __esm({
  "api/batch-data.ts"() {
    init_functionsRoutes_0_8646059331410194();
    __name2(uniqueClean, "uniqueClean");
    onRequestGet2 = /* @__PURE__ */ __name2(async (context) => {
      const { DB } = context.env;
      const url = new URL(context.request.url);
      const countries = uniqueClean(url.searchParams.get("countries")?.split(",") || []);
      const indicators = uniqueClean(url.searchParams.get("indicators")?.split(",") || []);
      const startYear = parseInt(url.searchParams.get("start_year") || "1990");
      const endYear = parseInt(url.searchParams.get("end_year") || (/* @__PURE__ */ new Date()).getFullYear().toString());
      if (countries.length === 0) {
        return Response.json(
          { error: { code: "MISSING_COUNTRIES", message: "countries parameter is required" } },
          { status: 400 }
        );
      }
      if (indicators.length === 0) {
        return Response.json(
          { error: { code: "MISSING_INDICATORS", message: "indicators parameter is required" } },
          { status: 400 }
        );
      }
      const countryPlaceholders = countries.map(() => "?").join(",");
      const indicatorPlaceholders = indicators.map(() => "?").join(",");
      const indicatorRows = await DB.prepare(
        `SELECT code, name, description, unit, source, category
     FROM indicators
     WHERE code IN (${indicatorPlaceholders})`
      ).bind(...indicators).all();
      const indicatorByCode = {};
      for (const row of indicatorRows.results || []) indicatorByCode[row.code] = row;
      const points = await DB.prepare(
        `SELECT i.code AS indicator, c.iso_alpha3 AS iso, d.year AS year, d.value AS value
     FROM data_points d
     JOIN countries c ON d.country_id = c.id
     JOIN indicators i ON d.indicator_id = i.id
     WHERE i.code IN (${indicatorPlaceholders})
       AND c.iso_alpha3 IN (${countryPlaceholders})
       AND d.year BETWEEN ? AND ?
     ORDER BY i.code, c.iso_alpha3, d.year`
      ).bind(...indicators, ...countries, startYear, endYear).all();
      const data = {};
      for (const row of points.results || []) {
        if (!data[row.indicator]) data[row.indicator] = {};
        if (!data[row.indicator][row.iso]) data[row.indicator][row.iso] = [];
        data[row.indicator][row.iso].push({ year: row.year, value: row.value });
      }
      return Response.json({ indicators: indicatorByCode, data });
    }, "onRequestGet");
  }
});
var onRequestGet3;
var init_convergence = __esm({
  "api/convergence.ts"() {
    init_functionsRoutes_0_8646059331410194();
    onRequestGet3 = /* @__PURE__ */ __name2(async (context) => {
      const { DB } = context.env;
      const url = new URL(context.request.url);
      const chaser = url.searchParams.get("chaser");
      const target = url.searchParams.get("target");
      const indicator = url.searchParams.get("indicator");
      const customGrowthRate = url.searchParams.get("growth_rate");
      if (!chaser || !target || !indicator) {
        return Response.json(
          {
            error: {
              code: "MISSING_PARAMS",
              message: "chaser, target, and indicator parameters are required"
            }
          },
          { status: 400 }
        );
      }
      const getLatestValue = /* @__PURE__ */ __name2(async (countryCode) => {
        const result = await DB.prepare(
          `SELECT c.name, d.value, d.year
       FROM data_points d
       JOIN countries c ON d.country_id = c.id
       JOIN indicators i ON d.indicator_id = i.id
       WHERE c.iso_alpha3 = ? AND i.code = ? AND d.is_projection = 0
       ORDER BY d.year DESC
       LIMIT 1`
        ).bind(countryCode, indicator).first();
        return result;
      }, "getLatestValue");
      const [chaserData, targetData] = await Promise.all([
        getLatestValue(chaser),
        getLatestValue(target)
      ]);
      if (!chaserData || !targetData) {
        return Response.json(
          {
            error: {
              code: "DATA_NOT_FOUND",
              message: "Could not find data for one or both countries"
            }
          },
          { status: 404 }
        );
      }
      let growthRate = customGrowthRate ? parseFloat(customGrowthRate) : null;
      if (!growthRate) {
        const historicalData = await DB.prepare(
          `SELECT d.year, d.value
       FROM data_points d
       JOIN countries c ON d.country_id = c.id
       JOIN indicators i ON d.indicator_id = i.id
       WHERE c.iso_alpha3 = ? AND i.code = ? AND d.is_projection = 0
       ORDER BY d.year ASC`
        ).bind(chaser, indicator).all();
        const rows = historicalData.results;
        if (rows.length >= 2) {
          const first = rows[0];
          const last = rows[rows.length - 1];
          const years = last.year - first.year;
          growthRate = Math.pow(last.value / first.value, 1 / years) - 1;
        } else {
          growthRate = 0.02;
        }
      }
      const ratio = targetData.value / chaserData.value;
      const yearsToConvergence = growthRate > 0 ? Math.log(ratio) / Math.log(1 + growthRate) : Infinity;
      const convergenceYear = yearsToConvergence !== Infinity ? Math.round(chaserData.year + yearsToConvergence) : null;
      const projection = [];
      const baseYear = chaserData.year;
      const maxYears = Math.min(Math.ceil(yearsToConvergence) + 10, 150);
      for (let i = 0; i <= maxYears; i += 5) {
        const year = baseYear + i;
        const projectedChaser = chaserData.value * Math.pow(1 + growthRate, i);
        projection.push({
          year,
          chaser: Math.round(projectedChaser),
          target: Math.round(targetData.value)
          // Assuming target stays constant
        });
        if (projectedChaser >= targetData.value) break;
      }
      return Response.json({
        chaser: {
          country: chaserData.name,
          iso: chaser,
          current_value: chaserData.value,
          current_year: chaserData.year
        },
        target: {
          country: targetData.name,
          iso: target,
          current_value: targetData.value,
          current_year: targetData.year
        },
        indicator,
        growth_rate: growthRate,
        years_to_convergence: Math.round(yearsToConvergence * 10) / 10,
        convergence_year: convergenceYear,
        projection
      });
    }, "onRequestGet");
  }
});
var onRequestGet4;
var init_countries = __esm({
  "api/countries.ts"() {
    init_functionsRoutes_0_8646059331410194();
    onRequestGet4 = /* @__PURE__ */ __name2(async (context) => {
      const { DB } = context.env;
      const result = await DB.prepare(
        `SELECT iso_alpha3, iso_alpha2, name, region, income_group
     FROM countries
     ORDER BY name`
      ).all();
      return Response.json({ data: result.results });
    }, "onRequestGet");
  }
});
var onRequestGet5;
var init_indicators = __esm({
  "api/indicators.ts"() {
    init_functionsRoutes_0_8646059331410194();
    onRequestGet5 = /* @__PURE__ */ __name2(async (context) => {
      const { DB } = context.env;
      const result = await DB.prepare(
        `SELECT code, name, description, unit, source, category
     FROM indicators
     ORDER BY category, name`
      ).all();
      return Response.json({ data: result.results });
    }, "onRequestGet");
  }
});
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
__name(clamp, "clamp");
function round(value, step) {
  return Math.round(value / step) * step;
}
__name(round, "round");
function parseIso3(value) {
  if (!value) return null;
  const iso = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(iso) ? iso : null;
}
__name(parseIso3, "parseIso3");
function parseIndicator(value) {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9_]{2,64}$/.test(code) ? code : null;
}
__name(parseIndicator, "parseIndicator");
function parseRate(value) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
__name(parseRate, "parseRate");
function parseIntSafe(value) {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}
__name(parseIntSafe, "parseIntSafe");
function parseTemplate(value) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "china" || v === "us" || v === "eu") return v;
  return null;
}
__name(parseTemplate, "parseTemplate");
function parseShareStateFromSearch(search, defaults = DEFAULT_SHARE_STATE) {
  const params = new URLSearchParams(
    search.startsWith("?") ? search : `?${search}`
  );
  const tmodeRaw = params.get("tmode")?.toLowerCase();
  const tmode = tmodeRaw === "static" ? "static" : "growing";
  const chaser = parseIso3(params.get("chaser")) ?? defaults.chaser;
  const target = parseIso3(params.get("target")) ?? defaults.target;
  const indicator = parseIndicator(params.get("indicator")) ?? defaults.indicator;
  const cgRaw = parseRate(params.get("cg"));
  const tgRaw = parseRate(params.get("tg"));
  const baseYearRaw = parseIntSafe(params.get("baseYear"));
  const goalRaw = parseIntSafe(params.get("goal"));
  const ihRaw = parseIntSafe(params.get("ih"));
  const cg = round(clamp(cgRaw ?? defaults.cg, -0.1, 0.15), 1e-3);
  const baseYear = clamp(baseYearRaw ?? defaults.baseYear, 1950, 2100);
  const goal = clamp(goalRaw ?? defaults.goal ?? 25, 1, 150);
  const ih = clamp(ihRaw ?? defaults.ih ?? 25, 1, 150);
  const adjCRaw = params.get("adjC");
  const adjTRaw = params.get("adjT");
  const adjC = adjCRaw === "0" ? false : defaults.adjC ?? true;
  const adjT = adjTRaw === "0" ? false : defaults.adjT ?? true;
  const msRaw = params.get("ms");
  const ms = msRaw === "0" ? false : defaults.ms ?? true;
  const tpl = parseTemplate(params.get("tpl")) ?? (defaults.tpl ?? "china");
  if (tmode === "static") {
    return {
      ...defaults,
      chaser,
      target,
      indicator,
      cg,
      tg: 0,
      tmode,
      baseYear,
      view: params.get("view") === "table" ? "table" : "chart",
      adjC,
      adjT,
      goal,
      ms,
      tpl,
      ih
    };
  }
  const tg = round(clamp(tgRaw ?? defaults.tg, -0.1, 0.15), 1e-3);
  return {
    ...defaults,
    chaser,
    target,
    indicator,
    cg,
    tg,
    tmode,
    baseYear,
    view: params.get("view") === "table" ? "table" : "chart",
    adjC,
    adjT,
    goal,
    ms,
    tpl,
    ih
  };
}
__name(parseShareStateFromSearch, "parseShareStateFromSearch");
function toSearchParams(state) {
  const params = new URLSearchParams();
  params.set("chaser", state.chaser);
  params.set("target", state.target);
  params.set("indicator", state.indicator);
  params.set("cg", round(state.cg, 1e-3).toFixed(3));
  params.set("tmode", state.tmode);
  params.set(
    "tg",
    state.tmode === "static" ? "0" : round(state.tg, 1e-3).toFixed(3)
  );
  params.set("baseYear", String(state.baseYear));
  if (state.view && state.view !== "chart") params.set("view", state.view);
  if (state.adjC === false) params.set("adjC", "0");
  if (state.adjT === false) params.set("adjT", "0");
  if ((state.goal ?? 25) !== 25) params.set("goal", String(clamp(state.goal ?? 25, 1, 150)));
  if (state.ms === false) params.set("ms", "0");
  if ((state.tpl ?? "china") !== "china") params.set("tpl", state.tpl ?? "china");
  if ((state.ih ?? 25) !== 25) params.set("ih", String(clamp(state.ih ?? 25, 1, 150)));
  return params;
}
__name(toSearchParams, "toSearchParams");
var DEFAULT_SHARE_STATE;
var init_shareState = __esm({
  "../src/lib/shareState.ts"() {
    init_functionsRoutes_0_8646059331410194();
    DEFAULT_SHARE_STATE = {
      chaser: "NGA",
      target: "IRL",
      indicator: "GDP_PCAP_PPP",
      cg: 0.035,
      tg: 0.015,
      tmode: "growing",
      baseYear: 2023,
      view: "chart",
      adjC: true,
      adjT: true,
      goal: 25,
      ms: true,
      tpl: "china",
      ih: 25
    };
    __name2(clamp, "clamp");
    __name2(round, "round");
    __name2(parseIso3, "parseIso3");
    __name2(parseIndicator, "parseIndicator");
    __name2(parseRate, "parseRate");
    __name2(parseIntSafe, "parseIntSafe");
    __name2(parseTemplate, "parseTemplate");
    __name2(parseShareStateFromSearch, "parseShareStateFromSearch");
    __name2(toSearchParams, "toSearchParams");
  }
});
function formatNumber(value) {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return value.toLocaleString();
}
__name(formatNumber, "formatNumber");
function formatPercent(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}
__name(formatPercent, "formatPercent");
function formatYears(years) {
  if (!isFinite(years)) return "Never";
  if (years < 1) return "< 1 year";
  if (years === 1) return "1 year";
  return `${Math.round(years)} years`;
}
__name(formatYears, "formatYears");
function formatMetricValue(value, unit, options) {
  if (!isFinite(value)) return "\u2014";
  const includeUnit = options?.includeUnit ?? false;
  const normalizedUnit = (unit || "").toLowerCase();
  if (normalizedUnit.includes("percent")) return `${value.toFixed(1)}%`;
  if (normalizedUnit.includes("index")) return value.toFixed(3).replace(/\.?0+$/, "");
  if (normalizedUnit.includes("int$") || normalizedUnit.includes("usd") || normalizedUnit.includes("$")) {
    return `$${formatNumber(value)}`;
  }
  if (normalizedUnit.includes("persons") || normalizedUnit.includes("people")) return formatNumber(value);
  if (normalizedUnit.includes("years")) return value.toFixed(1).replace(/\.0$/, "");
  const base = formatNumber(value);
  if (includeUnit && unit) return `${base} ${unit}`;
  return base;
}
__name(formatMetricValue, "formatMetricValue");
var init_convergence2 = __esm({
  "../src/lib/convergence.ts"() {
    init_functionsRoutes_0_8646059331410194();
    __name2(formatNumber, "formatNumber");
    __name2(formatPercent, "formatPercent");
    __name2(formatYears, "formatYears");
    __name2(formatMetricValue, "formatMetricValue");
  }
});
var resvg_wasm_exports = {};
__export(resvg_wasm_exports, {
  Resvg: /* @__PURE__ */ __name(() => Resvg2, "Resvg"),
  initWasm: /* @__PURE__ */ __name(() => initWasm, "initWasm")
});
function addHeapObject(obj) {
  if (heap_next === heap.length)
    heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj;
  return idx;
}
__name(addHeapObject, "addHeapObject");
function getObject(idx) {
  return heap[idx];
}
__name(getObject, "getObject");
function dropObject(idx) {
  if (idx < 132)
    return;
  heap[idx] = heap_next;
  heap_next = idx;
}
__name(dropObject, "dropObject");
function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}
__name(takeObject, "takeObject");
function getUint8Memory0() {
  if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}
__name(getUint8Memory0, "getUint8Memory0");
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8Memory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8Memory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127)
      break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
__name(passStringToWasm0, "passStringToWasm0");
function isLikeNone(x) {
  return x === void 0 || x === null;
}
__name(isLikeNone, "isLikeNone");
function getInt32Memory0() {
  if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
    cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory0;
}
__name(getInt32Memory0, "getInt32Memory0");
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
__name(getStringFromWasm0, "getStringFromWasm0");
function _assertClass(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
  return instance.ptr;
}
__name(_assertClass, "_assertClass");
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_exn_store(addHeapObject(e));
  }
}
__name(handleError, "handleError");
async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        if (module.headers.get("Content-Type") != "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}
__name(__wbg_load, "__wbg_load");
function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbg_new_28c511d9baebfa89 = function(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_memory = function() {
    const ret = wasm.memory;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_buffer_12d079cc21e14bdb = function(arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_newwithbyteoffsetandlength_aa4a17c33a06e5cb = function(arg0, arg1, arg2) {
    const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
    takeObject(arg0);
  };
  imports.wbg.__wbg_new_63b92bc8671ed464 = function(arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_values_839f3396d5aac002 = function(arg0) {
    const ret = getObject(arg0).values();
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_next_196c84450b364254 = function() {
    return handleError(function(arg0) {
      const ret = getObject(arg0).next();
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_done_298b57d23c0fc80c = function(arg0) {
    const ret = getObject(arg0).done;
    return ret;
  };
  imports.wbg.__wbg_value_d93c65011f51a456 = function(arg0) {
    const ret = getObject(arg0).value;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_instanceof_Uint8Array_2b3bbecd033d19f6 = function(arg0) {
    let result;
    try {
      result = getObject(arg0) instanceof Uint8Array;
    } catch (_) {
      result = false;
    }
    const ret = result;
    return ret;
  };
  imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof obj === "string" ? obj : void 0;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
  };
  imports.wbg.__wbg_new_16b304a2cfa7ff4a = function() {
    const ret = new Array();
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_push_a5b05aedc7234f9f = function(arg0, arg1) {
    const ret = getObject(arg0).push(getObject(arg1));
    return ret;
  };
  imports.wbg.__wbg_length_c20a40f15020d68a = function(arg0) {
    const ret = getObject(arg0).length;
    return ret;
  };
  imports.wbg.__wbg_set_a47bac70306a19a7 = function(arg0, arg1, arg2) {
    getObject(arg0).set(getObject(arg1), arg2 >>> 0);
  };
  imports.wbg.__wbindgen_throw = function(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };
  return imports;
}
__name(__wbg_get_imports, "__wbg_get_imports");
function __wbg_init_memory(imports, maybe_memory) {
}
__name(__wbg_init_memory, "__wbg_init_memory");
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  cachedInt32Memory0 = null;
  cachedUint8Memory0 = null;
  return wasm;
}
__name(__wbg_finalize_init, "__wbg_finalize_init");
async function __wbg_init(input) {
  if (wasm !== void 0)
    return wasm;
  if (typeof input === "undefined") {
    input = new URL("index_bg.wasm", void 0);
  }
  const imports = __wbg_get_imports();
  if (typeof input === "string" || typeof Request === "function" && input instanceof Request || typeof URL === "function" && input instanceof URL) {
    input = fetch(input);
  }
  __wbg_init_memory(imports);
  const { instance, module } = await __wbg_load(await input, imports);
  return __wbg_finalize_init(instance, module);
}
__name(__wbg_init, "__wbg_init");
function isCustomFontsOptions(value) {
  return Object.prototype.hasOwnProperty.call(value, "fontBuffers");
}
__name(isCustomFontsOptions, "isCustomFontsOptions");
var wasm;
var heap;
var heap_next;
var WASM_VECTOR_LEN;
var cachedUint8Memory0;
var cachedTextEncoder;
var encodeString;
var cachedInt32Memory0;
var cachedTextDecoder;
var BBoxFinalization;
var BBox;
var RenderedImageFinalization;
var RenderedImage;
var ResvgFinalization;
var Resvg;
var dist_default;
var initialized;
var initWasm;
var Resvg2;
var init_resvg_wasm = __esm({
  "../node_modules/.pnpm/@resvg+resvg-wasm@2.6.2/node_modules/@resvg/resvg-wasm/index.mjs"() {
    init_functionsRoutes_0_8646059331410194();
    heap = new Array(128).fill(void 0);
    heap.push(void 0, null, true, false);
    heap_next = heap.length;
    __name2(addHeapObject, "addHeapObject");
    __name2(getObject, "getObject");
    __name2(dropObject, "dropObject");
    __name2(takeObject, "takeObject");
    WASM_VECTOR_LEN = 0;
    cachedUint8Memory0 = null;
    __name2(getUint8Memory0, "getUint8Memory0");
    cachedTextEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder("utf-8") : { encode: /* @__PURE__ */ __name2(() => {
      throw Error("TextEncoder not available");
    }, "encode") };
    encodeString = typeof cachedTextEncoder.encodeInto === "function" ? function(arg, view) {
      return cachedTextEncoder.encodeInto(arg, view);
    } : function(arg, view) {
      const buf = cachedTextEncoder.encode(arg);
      view.set(buf);
      return {
        read: arg.length,
        written: buf.length
      };
    };
    __name2(passStringToWasm0, "passStringToWasm0");
    __name2(isLikeNone, "isLikeNone");
    cachedInt32Memory0 = null;
    __name2(getInt32Memory0, "getInt32Memory0");
    cachedTextDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }) : { decode: /* @__PURE__ */ __name2(() => {
      throw Error("TextDecoder not available");
    }, "decode") };
    if (typeof TextDecoder !== "undefined") {
      cachedTextDecoder.decode();
    }
    __name2(getStringFromWasm0, "getStringFromWasm0");
    __name2(_assertClass, "_assertClass");
    __name2(handleError, "handleError");
    BBoxFinalization = typeof FinalizationRegistry === "undefined" ? { register: /* @__PURE__ */ __name2(() => {
    }, "register"), unregister: /* @__PURE__ */ __name2(() => {
    }, "unregister") } : new FinalizationRegistry((ptr) => wasm.__wbg_bbox_free(ptr >>> 0));
    BBox = class _BBox {
      static {
        __name(this, "_BBox");
      }
      static {
        __name2(this, "_BBox");
      }
      static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(_BBox.prototype);
        obj.__wbg_ptr = ptr;
        BBoxFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
      }
      __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BBoxFinalization.unregister(this);
        return ptr;
      }
      free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_bbox_free(ptr);
      }
      /**
      * @returns {number}
      */
      get x() {
        const ret = wasm.__wbg_get_bbox_x(this.__wbg_ptr);
        return ret;
      }
      /**
      * @param {number} arg0
      */
      set x(arg0) {
        wasm.__wbg_set_bbox_x(this.__wbg_ptr, arg0);
      }
      /**
      * @returns {number}
      */
      get y() {
        const ret = wasm.__wbg_get_bbox_y(this.__wbg_ptr);
        return ret;
      }
      /**
      * @param {number} arg0
      */
      set y(arg0) {
        wasm.__wbg_set_bbox_y(this.__wbg_ptr, arg0);
      }
      /**
      * @returns {number}
      */
      get width() {
        const ret = wasm.__wbg_get_bbox_width(this.__wbg_ptr);
        return ret;
      }
      /**
      * @param {number} arg0
      */
      set width(arg0) {
        wasm.__wbg_set_bbox_width(this.__wbg_ptr, arg0);
      }
      /**
      * @returns {number}
      */
      get height() {
        const ret = wasm.__wbg_get_bbox_height(this.__wbg_ptr);
        return ret;
      }
      /**
      * @param {number} arg0
      */
      set height(arg0) {
        wasm.__wbg_set_bbox_height(this.__wbg_ptr, arg0);
      }
    };
    RenderedImageFinalization = typeof FinalizationRegistry === "undefined" ? { register: /* @__PURE__ */ __name2(() => {
    }, "register"), unregister: /* @__PURE__ */ __name2(() => {
    }, "unregister") } : new FinalizationRegistry((ptr) => wasm.__wbg_renderedimage_free(ptr >>> 0));
    RenderedImage = class _RenderedImage {
      static {
        __name(this, "_RenderedImage");
      }
      static {
        __name2(this, "_RenderedImage");
      }
      static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(_RenderedImage.prototype);
        obj.__wbg_ptr = ptr;
        RenderedImageFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
      }
      __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RenderedImageFinalization.unregister(this);
        return ptr;
      }
      free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_renderedimage_free(ptr);
      }
      /**
      * Get the PNG width
      * @returns {number}
      */
      get width() {
        const ret = wasm.renderedimage_width(this.__wbg_ptr);
        return ret >>> 0;
      }
      /**
      * Get the PNG height
      * @returns {number}
      */
      get height() {
        const ret = wasm.renderedimage_height(this.__wbg_ptr);
        return ret >>> 0;
      }
      /**
      * Write the image data to Uint8Array
      * @returns {Uint8Array}
      */
      asPng() {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          wasm.renderedimage_asPng(retptr, this.__wbg_ptr);
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          var r2 = getInt32Memory0()[retptr / 4 + 2];
          if (r2) {
            throw takeObject(r1);
          }
          return takeObject(r0);
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
        }
      }
      /**
      * Get the RGBA pixels of the image
      * @returns {Uint8Array}
      */
      get pixels() {
        const ret = wasm.renderedimage_pixels(this.__wbg_ptr);
        return takeObject(ret);
      }
    };
    ResvgFinalization = typeof FinalizationRegistry === "undefined" ? { register: /* @__PURE__ */ __name2(() => {
    }, "register"), unregister: /* @__PURE__ */ __name2(() => {
    }, "unregister") } : new FinalizationRegistry((ptr) => wasm.__wbg_resvg_free(ptr >>> 0));
    Resvg = class {
      static {
        __name(this, "Resvg");
      }
      static {
        __name2(this, "Resvg");
      }
      __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResvgFinalization.unregister(this);
        return ptr;
      }
      free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resvg_free(ptr);
      }
      /**
      * @param {Uint8Array | string} svg
      * @param {string | undefined} [options]
      * @param {Array<any> | undefined} [custom_font_buffers]
      */
      constructor(svg, options, custom_font_buffers) {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          var ptr0 = isLikeNone(options) ? 0 : passStringToWasm0(options, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
          var len0 = WASM_VECTOR_LEN;
          wasm.resvg_new(retptr, addHeapObject(svg), ptr0, len0, isLikeNone(custom_font_buffers) ? 0 : addHeapObject(custom_font_buffers));
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          var r2 = getInt32Memory0()[retptr / 4 + 2];
          if (r2) {
            throw takeObject(r1);
          }
          this.__wbg_ptr = r0 >>> 0;
          return this;
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
        }
      }
      /**
      * Get the SVG width
      * @returns {number}
      */
      get width() {
        const ret = wasm.resvg_width(this.__wbg_ptr);
        return ret;
      }
      /**
      * Get the SVG height
      * @returns {number}
      */
      get height() {
        const ret = wasm.resvg_height(this.__wbg_ptr);
        return ret;
      }
      /**
      * Renders an SVG in Wasm
      * @returns {RenderedImage}
      */
      render() {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          wasm.resvg_render(retptr, this.__wbg_ptr);
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          var r2 = getInt32Memory0()[retptr / 4 + 2];
          if (r2) {
            throw takeObject(r1);
          }
          return RenderedImage.__wrap(r0);
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
        }
      }
      /**
      * Output usvg-simplified SVG string
      * @returns {string}
      */
      toString() {
        let deferred1_0;
        let deferred1_1;
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          wasm.resvg_toString(retptr, this.__wbg_ptr);
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          deferred1_0 = r0;
          deferred1_1 = r1;
          return getStringFromWasm0(r0, r1);
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
          wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
      }
      /**
      * Calculate a maximum bounding box of all visible elements in this SVG.
      *
      * Note: path bounding box are approx values.
      * @returns {BBox | undefined}
      */
      innerBBox() {
        const ret = wasm.resvg_innerBBox(this.__wbg_ptr);
        return ret === 0 ? void 0 : BBox.__wrap(ret);
      }
      /**
      * Calculate a maximum bounding box of all visible elements in this SVG.
      * This will first apply transform.
      * Similar to `SVGGraphicsElement.getBBox()` DOM API.
      * @returns {BBox | undefined}
      */
      getBBox() {
        const ret = wasm.resvg_getBBox(this.__wbg_ptr);
        return ret === 0 ? void 0 : BBox.__wrap(ret);
      }
      /**
      * Use a given `BBox` to crop the svg. Currently this method simply changes
      * the viewbox/size of the svg and do not move the elements for simplicity
      * @param {BBox} bbox
      */
      cropByBBox(bbox) {
        _assertClass(bbox, BBox);
        wasm.resvg_cropByBBox(this.__wbg_ptr, bbox.__wbg_ptr);
      }
      /**
      * @returns {Array<any>}
      */
      imagesToResolve() {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          wasm.resvg_imagesToResolve(retptr, this.__wbg_ptr);
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          var r2 = getInt32Memory0()[retptr / 4 + 2];
          if (r2) {
            throw takeObject(r1);
          }
          return takeObject(r0);
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
        }
      }
      /**
      * @param {string} href
      * @param {Uint8Array} buffer
      */
      resolveImage(href, buffer) {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          const ptr0 = passStringToWasm0(href, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
          const len0 = WASM_VECTOR_LEN;
          wasm.resvg_resolveImage(retptr, this.__wbg_ptr, ptr0, len0, addHeapObject(buffer));
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          if (r1) {
            throw takeObject(r0);
          }
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
        }
      }
    };
    __name2(__wbg_load, "__wbg_load");
    __name2(__wbg_get_imports, "__wbg_get_imports");
    __name2(__wbg_init_memory, "__wbg_init_memory");
    __name2(__wbg_finalize_init, "__wbg_finalize_init");
    __name2(__wbg_init, "__wbg_init");
    dist_default = __wbg_init;
    initialized = false;
    initWasm = /* @__PURE__ */ __name2(async (module_or_path) => {
      if (initialized) {
        throw new Error("Already initialized. The `initWasm()` function can be used only once.");
      }
      await dist_default(await module_or_path);
      initialized = true;
    }, "initWasm");
    Resvg2 = class extends Resvg {
      static {
        __name(this, "Resvg2");
      }
      static {
        __name2(this, "Resvg2");
      }
      /**
       * @param {Uint8Array | string} svg
       * @param {ResvgRenderOptions | undefined} options
       */
      constructor(svg, options) {
        if (!initialized)
          throw new Error("Wasm has not been initialized. Call `initWasm()` function.");
        const font = options?.font;
        if (!!font && isCustomFontsOptions(font)) {
          const serializableOptions = {
            ...options,
            font: {
              ...font,
              fontBuffers: void 0
            }
          };
          super(svg, JSON.stringify(serializableOptions), font.fontBuffers);
        } else {
          super(svg, JSON.stringify(options));
        }
      }
    };
    __name2(isCustomFontsOptions, "isCustomFontsOptions");
  }
});
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
__name(escapeXml, "escapeXml");
function formatShortNumber(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
__name(formatShortNumber, "formatShortNumber");
function buildProjection(params) {
  const { baseYear, chaserValue, targetValue, chaserRate, targetRate, maxYears } = params;
  const points = [];
  for (let i = 0; i <= maxYears; i++) {
    const year = baseYear + i;
    const chaser = chaserValue * Math.pow(1 + chaserRate, i);
    const target = targetValue * Math.pow(1 + targetRate, i);
    points.push({ year, chaser, target });
    if (chaser >= target) break;
  }
  return points;
}
__name(buildProjection, "buildProjection");
function makeSparkPath(points) {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}
__name(makeSparkPath, "makeSparkPath");
var onRequestGet6;
var init_og_png = __esm({
  "api/og.png.ts"() {
    init_functionsRoutes_0_8646059331410194();
    init_shareState();
    init_convergence2();
    __name2(escapeXml, "escapeXml");
    __name2(formatShortNumber, "formatShortNumber");
    __name2(buildProjection, "buildProjection");
    __name2(makeSparkPath, "makeSparkPath");
    onRequestGet6 = /* @__PURE__ */ __name2(async (context) => {
      const url = new URL(context.request.url);
      const state = parseShareStateFromSearch(url.search);
      const params = toSearchParams(state);
      const canonical = `${url.origin}/share?${params.toString()}`;
      const { DB } = context.env;
      const indicator = await DB.prepare(
        `SELECT code, name, unit, source
     FROM indicators
     WHERE code = ?`
      ).bind(state.indicator).first();
      const countries = await DB.prepare(
        `SELECT iso_alpha3, name
     FROM countries
     WHERE iso_alpha3 IN (?, ?)`
      ).bind(state.chaser, state.target).all();
      const countryName = /* @__PURE__ */ __name2((iso3) => (countries.results || []).find((c) => c.iso_alpha3 === iso3)?.name || iso3, "countryName");
      const chaserName = countryName(state.chaser);
      const targetName = countryName(state.target);
      const latest = await DB.prepare(
        `SELECT c.iso_alpha3 AS iso, d.year AS year, d.value AS value
     FROM data_points d
     JOIN countries c ON d.country_id = c.id
     JOIN indicators i ON d.indicator_id = i.id
     WHERE i.code = ?
       AND c.iso_alpha3 IN (?, ?)
       AND d.year = (
         SELECT MAX(year)
         FROM data_points
         WHERE country_id = d.country_id
           AND indicator_id = d.indicator_id
       )`
      ).bind(state.indicator, state.chaser, state.target).all();
      const byIso = {};
      for (const row of latest.results || []) byIso[row.iso] = { year: row.year, value: row.value };
      const chaserValue = byIso[state.chaser]?.value ?? null;
      const targetValue = byIso[state.target]?.value ?? null;
      const metricName = indicator?.name || state.indicator;
      const metricUnit = indicator?.unit || null;
      const source = indicator?.source || "World Bank";
      const title = `${chaserName} \u2192 ${targetName}`;
      const subtitle = `${metricName}${metricUnit ? ` \xB7 ${metricUnit}` : ""}`;
      const outcome = (() => {
        if (chaserValue == null || targetValue == null) return { headline: "Data unavailable", detail: "" };
        if (chaserValue >= targetValue) return { headline: "Already ahead", detail: "" };
        const tg = state.tmode === "static" ? 0 : state.tg;
        if (state.cg <= tg) return { headline: "No convergence", detail: "" };
        const ratio = targetValue / chaserValue;
        const growthRatio = (1 + state.cg) / (1 + tg);
        const years = Math.log(ratio) / Math.log(growthRatio);
        const year = Math.round(state.baseYear + years);
        return { headline: formatYears(years), detail: `by ${year}` };
      })();
      const assumptions = `Chaser ${formatPercent(state.cg)} \xB7 Target ${state.tmode === "static" ? "Static" : formatPercent(state.tg)} \xB7 Base year ${state.baseYear}`;
      const current = (() => {
        if (chaserValue == null || targetValue == null) return null;
        const gap = targetValue / chaserValue;
        return {
          chaser: formatMetricValue(chaserValue, metricUnit),
          target: formatMetricValue(targetValue, metricUnit),
          gap: `${gap.toFixed(1)}\xD7 gap`
        };
      })();
      const theme = {
        bgTop: "#faf8f5",
        bgBottom: "#f3f0eb",
        card: "#fffffe",
        border: "#e5e0d8",
        ink: "#1a1815",
        muted: "#5c574f",
        faint: "#8a847a",
        chaser: "#ea580c",
        target: "#059669",
        convergence: "#8b5cf6"
      };
      const projection = chaserValue != null && targetValue != null ? buildProjection({
        baseYear: state.baseYear,
        chaserValue,
        targetValue,
        chaserRate: state.cg,
        targetRate: state.tmode === "static" ? 0 : state.tg,
        maxYears: 60
      }) : [];
      const spark = (() => {
        if (projection.length < 2) return null;
        const W = 520;
        const H = 140;
        const pad = { x: 16, y: 14 };
        const x0 = 64 + 28;
        const y0 = 630 - 56 - H - 18;
        const years = projection.map((p) => p.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const xRange = Math.max(1, maxYear - minYear);
        const maxVal = Math.max(...projection.flatMap((p) => [p.chaser, p.target])) * 1.05;
        const minVal = 0;
        const yRange = Math.max(1, maxVal - minVal);
        const toX = /* @__PURE__ */ __name2((year) => x0 + pad.x + (year - minYear) / xRange * (W - pad.x * 2), "toX");
        const toY = /* @__PURE__ */ __name2((value) => y0 + pad.y + (1 - (value - minVal) / yRange) * (H - pad.y * 2), "toY");
        const chaserPts = projection.map((p) => ({ x: toX(p.year), y: toY(p.chaser) }));
        const targetPts = projection.map((p) => ({ x: toX(p.year), y: toY(p.target) }));
        const chaserPath = makeSparkPath(chaserPts);
        const targetPath = makeSparkPath(targetPts);
        const last = projection[projection.length - 1];
        const lastX = toX(last.year);
        const lastYChaser = toY(last.chaser);
        const lastYTarget = toY(last.target);
        return {
          x0,
          y0,
          W,
          H,
          minYear,
          maxYear,
          maxVal,
          chaserPath,
          targetPath,
          lastX,
          lastYChaser,
          lastYTarget
        };
      })();
      const font = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
      const currentBlock = current ? `<text x="712" y="276" font-family="${font}" font-size="16" fill="${theme.muted}">
      <tspan fill="${theme.chaser}" font-weight="700">${escapeXml(chaserName)}:</tspan> ${escapeXml(
        current.chaser
      )}
    </text>
    <text x="712" y="304" font-family="${font}" font-size="16" fill="${theme.muted}">
      <tspan fill="${theme.target}" font-weight="700">${escapeXml(targetName)}:</tspan> ${escapeXml(
        current.target
      )}
    </text>
    <text x="712" y="328" font-family="${font}" font-size="13" fill="${theme.faint}">${escapeXml(
        current.gap
      )}</text>` : "";
      const sparkBlock = spark ? `<g>
      <rect x="${spark.x0}" y="${spark.y0}" width="${spark.W}" height="${spark.H}" rx="16" fill="${theme.card}" stroke="${theme.border}"/>
      <text x="${spark.x0 + 18}" y="${spark.y0 + 28}" font-family="${font}" font-size="12" font-weight="700" fill="${theme.faint}" letter-spacing="1.2">PROJECTION</text>
      <path d="${spark.targetPath}" fill="none" stroke="${theme.target}" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 6" opacity="0.95"/>
      <path d="${spark.chaserPath}" fill="none" stroke="${theme.chaser}" stroke-width="3" stroke-linecap="round" opacity="0.98"/>
      <circle cx="${spark.lastX}" cy="${spark.lastYChaser}" r="4.5" fill="${theme.chaser}"/>
      <circle cx="${spark.lastX}" cy="${spark.lastYTarget}" r="4.5" fill="${theme.target}"/>
      <text x="${spark.x0 + 18}" y="${spark.y0 + spark.H - 16}" font-family="${font}" font-size="12" fill="${theme.faint}">${escapeXml(
        `${spark.minYear} \u2192 ${spark.maxYear} \xB7 max ${formatShortNumber(spark.maxVal)}`
      )}</text>
    </g>` : "";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${theme.bgTop}"/>
      <stop offset="100%" stop-color="${theme.bgBottom}"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Title -->
  <text x="64" y="112" font-family="${font}" font-size="52" font-weight="900" fill="${theme.ink}">${escapeXml(
        title
      )}</text>
  <text x="64" y="148" font-family="${font}" font-size="20" font-weight="600" fill="${theme.muted}">${escapeXml(
        subtitle
      )}</text>

  <!-- Source pill -->
  <g>
    <rect x="900" y="72" width="236" height="34" rx="12" fill="${theme.card}" stroke="${theme.border}"/>
    <text x="1018" y="94" text-anchor="middle" font-family="${font}" font-size="14" font-weight="700" fill="${theme.muted}">${escapeXml(
        source
      )}</text>
  </g>

  <!-- Main cards -->
  <rect x="64" y="190" width="620" height="220" rx="20" fill="${theme.card}" stroke="${theme.border}"/>
  <rect x="712" y="190" width="424" height="220" rx="20" fill="${theme.card}" stroke="${theme.border}"/>

  <text x="92" y="232" font-family="${font}" font-size="12" font-weight="800" fill="${theme.faint}" letter-spacing="1.4">OUTCOME</text>
  <text x="92" y="312" font-family="${font}" font-size="64" font-weight="900" fill="${theme.ink}">${escapeXml(
        outcome.headline
      )}</text>
  <text x="92" y="346" font-family="${font}" font-size="22" font-weight="700" fill="${theme.muted}">${escapeXml(
        outcome.detail || ""
      )}</text>

  <text x="740" y="232" font-family="${font}" font-size="12" font-weight="800" fill="${theme.faint}" letter-spacing="1.4">ASSUMPTIONS</text>
  <text x="740" y="262" font-family="${font}" font-size="16" font-weight="600" fill="${theme.ink}">${escapeXml(
        assumptions
      )}</text>
  ${currentBlock}

  ${sparkBlock}

  <!-- Footer -->
  <text x="64" y="588" font-family="${font}" font-size="13" fill="${theme.faint}">${escapeXml(
        canonical
      )}</text>
</svg>`;
      try {
        const { Resvg: Resvg3 } = await Promise.resolve().then(() => (init_resvg_wasm(), resvg_wasm_exports));
        const resvg = new Resvg3(svg, {
          fitTo: { mode: "width", value: 1200 },
          background: "white"
        });
        const png = resvg.render().asPng();
        return new Response(png, {
          headers: {
            "content-type": "image/png",
            "cache-control": "public, max-age=86400"
          }
        });
      } catch {
        return new Response(svg, {
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=300",
            "x-og-fallback": "svg"
          }
        });
      }
    }, "onRequestGet");
  }
});
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
__name(escapeHtml, "escapeHtml");
var onRequestGet7;
var init_share = __esm({
  "share.ts"() {
    init_functionsRoutes_0_8646059331410194();
    init_shareState();
    __name2(escapeHtml, "escapeHtml");
    onRequestGet7 = /* @__PURE__ */ __name2(async (context) => {
      const url = new URL(context.request.url);
      const state = parseShareStateFromSearch(url.search);
      const params = toSearchParams(state);
      const canonicalPath = `/share?${params.toString()}`;
      const appPath = `/?${params.toString()}`;
      const { DB } = context.env;
      const indicator = await DB.prepare(
        `SELECT code, name, unit, source
     FROM indicators
     WHERE code = ?`
      ).bind(state.indicator).first();
      const countries = await DB.prepare(
        `SELECT iso_alpha3, name
     FROM countries
     WHERE iso_alpha3 IN (?, ?)`
      ).bind(state.chaser, state.target).all();
      const countryName = /* @__PURE__ */ __name2((iso3) => (countries.results || []).find((c) => c.iso_alpha3 === iso3)?.name || iso3, "countryName");
      const chaserName = countryName(state.chaser);
      const targetName = countryName(state.target);
      const metricName = indicator?.name || state.indicator;
      const title = `${chaserName} \u2192 ${targetName} \xB7 ${metricName}`;
      const latest = await DB.prepare(
        `SELECT c.iso_alpha3 AS iso, d.year AS year, d.value AS value
     FROM data_points d
     JOIN countries c ON d.country_id = c.id
     JOIN indicators i ON d.indicator_id = i.id
     WHERE i.code = ?
       AND c.iso_alpha3 IN (?, ?)
       AND d.year = (
         SELECT MAX(year)
         FROM data_points
         WHERE country_id = d.country_id
           AND indicator_id = d.indicator_id
       )`
      ).bind(state.indicator, state.chaser, state.target).all();
      const byIso = {};
      for (const row of latest.results || []) byIso[row.iso] = { year: row.year, value: row.value };
      const chaserValue = byIso[state.chaser]?.value ?? null;
      const targetValue = byIso[state.target]?.value ?? null;
      const outcome = (() => {
        if (chaserValue == null || targetValue == null) return "Data unavailable for one or both countries.";
        if (chaserValue >= targetValue) return "Already ahead at the latest observed values.";
        const tg = state.tmode === "static" ? 0 : state.tg;
        if (state.cg <= tg) return "No convergence at these growth rates.";
        const ratio = targetValue / chaserValue;
        const growthRatio = (1 + state.cg) / (1 + tg);
        const years = Math.log(ratio) / Math.log(growthRatio);
        const year = Math.round(state.baseYear + years);
        return `Could converge in ~${Math.round(years)} years (by ${year}).`;
      })();
      const description = `${outcome} Chaser ${Math.round(state.cg * 1e3) / 10}% \xB7 Target ${state.tmode === "static" ? "Static" : `${Math.round(state.tg * 1e3) / 10}%`} \xB7 Base year ${state.baseYear}.`;
      const origin = url.origin;
      const ogImageUrl = `${origin}/api/og.png?${params.toString()}`;
      const ogAlt = `${title} chart`;
      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${escapeHtml(origin + canonicalPath)}" />

    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(origin + canonicalPath)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(ogAlt)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(ogAlt)}" />

    <meta http-equiv="refresh" content="0;url=${escapeHtml(appPath)}" />
    <script>
      try { window.location.replace(${JSON.stringify(appPath)}); } catch {}
    <\/script>
  </head>
  <body>
    <p>Redirecting\u2026 <a href="${escapeHtml(appPath)}">Open interactive view</a></p>
  </body>
</html>`;
      return new Response(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300"
        }
      });
    }, "onRequestGet");
  }
});
var routes;
var init_functionsRoutes_0_8646059331410194 = __esm({
  "../.wrangler/tmp/pages-Hy8065/functionsRoutes-0.8646059331410194.mjs"() {
    init_indicator();
    init_batch_data();
    init_convergence();
    init_countries();
    init_indicators();
    init_og_png();
    init_share();
    routes = [
      {
        routePath: "/api/data/:indicator",
        mountPath: "/api/data",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet]
      },
      {
        routePath: "/api/batch-data",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet2]
      },
      {
        routePath: "/api/convergence",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet3]
      },
      {
        routePath: "/api/countries",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet4]
      },
      {
        routePath: "/api/indicators",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet5]
      },
      {
        routePath: "/api/og.png",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet6]
      },
      {
        routePath: "/share",
        mountPath: "/",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet7]
      }
    ];
  }
});
init_functionsRoutes_0_8646059331410194();
init_functionsRoutes_0_8646059331410194();
init_functionsRoutes_0_8646059331410194();
init_functionsRoutes_0_8646059331410194();
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
init_functionsRoutes_0_8646059331410194();
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
init_functionsRoutes_0_8646059331410194();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
init_functionsRoutes_0_8646059331410194();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// node_modules/.pnpm/wrangler@4.59.2/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// node_modules/.pnpm/wrangler@4.59.2/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-LcnIGN/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// node_modules/.pnpm/wrangler@4.59.2/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-LcnIGN/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.9544714362816049.js.map
