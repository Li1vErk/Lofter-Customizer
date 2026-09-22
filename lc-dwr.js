/* ============================================================
 * lc-dwr.js — LOFTER DWR 接口客户端（popup 与 content 共用）
 * ============================================================
 * LOFTER 老页面用 DWR（Direct Web Remoting）做远程调用：
 *   POST text/plain 到 /dwr/call/plaincall/UserBean.<方法>.dwr，
 *   body 是 callCount/scriptSessionId/c0-* 行；回复是一段 JS：
 *     //#DWR-INSERT
 *     //#DWR-REPLY
 *     var s0 = {};
 *     var s2 = {};            // 数据对象，可交叉引用
 *     s0.blogInfo = s2;       // 属性赋值
 *     dwr.engine._remoteHandleCallback('batchId', '0', [s0]);
 * 官方设置页直接 eval 这段回复；但扩展 popup 页面的 CSP 是
 * script-src 'self'（禁 eval/new Function），content script 里
 * 也不该 eval 远端字符串。这里手写一个极小的递归下降解析器，
 * 只认 DWR 回复实际用到的语法子集，零 eval。
 *
 * 接口规格（2026-09-19 抓包确认，鉴权全靠 Cookie）：
 *   addBlacklist         param0=string:blogName, param1=number:0 → 新条目
 *   removeBlacklist      param0=number:条目id（非 blogId！）      → 1
 *   getBlacklistUserList param0=number:页大小, param1=number:偏移 → 条目数组
 */

function LC_dwrParse(text) {
  let i = 0;
  const n = text.length;
  const vars = Object.create(null);

  function fail(msg) {
    throw new Error("DWR 回复解析失败: " + msg + " (@" + i + ")");
  }
  function ws() {
    while (i < n && /\s/.test(text[i])) i++;
  }
  /* 读字符串，quote 为引号字符；支持 \uXXXX 与常见转义 */
  function readString(quote) {
    i++; /* 跳过开头引号 */
    let out = "";
    while (i < n) {
      const c = text[i];
      if (c === quote) {
        i++;
        return out;
      }
      if (c === "\\") {
        const e = text[i + 1];
        if (e === "u") {
          const hex = text.substr(i + 2, 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("非法 \\u 转义");
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
        } else {
          out += { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" }[e] || e;
          i += 2;
        }
      } else {
        out += c;
        i++;
      }
    }
    fail("字符串未闭合");
  }
  function ident() {
    const m = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
    if (!m) fail("期望标识符");
    i += m[0].length;
    return m[0];
  }
  function number() {
    const m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
    if (!m) fail("期望数字");
    i += m[0].length;
    return Number(m[0]);
  }
  function value() {
    ws();
    const c = text[i];
    if (c === '"' || c === "'") return readString(c);
    if (c === "{") return object();
    if (c === "[") return array();
    if (c === "-" || (c >= "0" && c <= "9")) return number();
    const id = ident();
    if (id === "true") return true;
    if (id === "false") return false;
    if (id === "null" || id === "undefined") return null;
    if (id in vars) return vars[id];
    fail("未知标识符 " + id);
  }
  function object() {
    const o = {};
    i++; /* { */
    ws();
    if (text[i] === "}") {
      i++;
      return o;
    }
    for (;;) {
      ws();
      const k = ident();
      ws();
      if (text[i] !== ":") fail("期望 :");
      i++;
      o[k] = value();
      ws();
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === "}") {
        i++;
        return o;
      }
      fail("期望 , 或 }");
    }
  }
  function array() {
    const a = [];
    i++; /* [ */
    ws();
    if (text[i] === "]") {
      i++;
      return a;
    }
    for (;;) {
      a.push(value());
      ws();
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === "]") {
        i++;
        return a;
      }
      fail("期望 , 或 ]");
    }
  }
  function skipLine() {
    while (i < n && text[i] !== "\n") i++;
  }

  /* ---------- 主循环：逐条语句 ---------- */
  let result; /* _remoteHandleCallback 的第三个参数 */
  while (i < n) {
    ws();
    if (i >= n) break;
    const c = text[i];
    if (c === "/") {
      skipLine(); /* //#DWR-INSERT 等注释行 */
      continue;
    }
    if (!/[A-Za-z_$]/.test(c)) fail("意外字符 " + JSON.stringify(c));
    const first = ident();
    ws();
    if (first === "var") {
      /* var s0 = <value>; */
      const name = ident();
      ws();
      if (text[i] !== "=") fail("var 后期望 =");
      i++;
      vars[name] = value();
      ws();
      if (text[i] === ";") i++;
    } else if (first === "throw") {
      /* DWR 出错时的回复：throw ...；原样报错（含服务端消息） */
      const lineEnd = text.indexOf("\n", i);
      throw new Error(
        "DWR 异常: " +
          text.slice(i, lineEnd === -1 ? n : lineEnd).trim().slice(0, 200),
      );
    } else if (first === "dwr") {
      /* dwr.engine._remoteHandleCallback('b','0',RESULT);
       * 或 _remoteHandleException(...)。方法名在 first 与 '(' 之间 */
      const open = text.indexOf("(", i);
      if (open === -1) fail("callback 缺 (");
      const head = text.slice(i, open);
      i = open + 1; /* 跳过 ( */
      ws();
      if (head.includes("_remoteHandleException")) {
        const close = text.indexOf(")", i);
        throw new Error(
          "DWR 异常: " + text.slice(i, close === -1 ? n : close).slice(0, 200),
        );
      }
      /* 通用参数解析：value[, value]*)，取最后一个作为结果
       * （正常是 'batchId','0',RESULT，但参数类型不必假定） */
      for (;;) {
        result = value();
        ws();
        if (text[i] === ",") {
          i++;
          ws();
          continue;
        }
        if (text[i] === ")") {
          i++;
          break;
        }
        fail("callback 参数后期望 , 或 )");
      }
      return result; /* callback 是最后一条语句 */
    } else {
      /* 赋值语句：s0.prop = value; / s0[0] = value; / s0.a.b = value;
       * DWR 回复常见链式写法（如 s1.blogInfo.blogName='x'），逐段下钻 */
      if (!(first in vars)) fail("未知变量 " + first);
      let target = vars[first];
      let key;
      for (;;) {
        ws();
        if (text[i] === ".") {
          i++;
          key = ident();
        } else if (text[i] === "[") {
          i++;
          key = number();
          ws();
          if (text[i] !== "]") fail("期望 ]");
          i++;
        } else {
          fail("期望 . 或 [");
        }
        ws();
        if (text[i] === "=") {
          i++;
          break;
        }
        if (text[i] === "." || text[i] === "[") {
          target = target[key]; /* 中间段：继续下钻 */
          continue;
        }
        fail("赋值后期望 =");
      }
      target[key] = value();
      ws();
      if (text[i] === ";") i++;
    }
  }
  return result;
}

/* 直连调用（content script 在 lofter.com 页面里用：同源、带 Referer）。
 * params: ["string:xxx", "number:0", ...]（DWR 参数带类型前缀）。
 * 返回 Promise<结果>；网络/HTTP/解析/业务异常统一走 reject。
 * fetch 包在 Promise.resolve().then 里：没有 fetch 的环境下同步
 * 抛错也会变成 rejected promise，不炸调用现场（如扫描循环）。 */
function LC_dwrDirect(method, params) {
  const lines = [
    "callCount=1",
    "scriptSessionId=${scriptSessionId}187", /* 官方原样发占位符，服务端不校验 */
    "httpSessionId=", /* 空：鉴权全靠 Cookie */
    "c0-scriptName=UserBean",
    "c0-methodName=" + method,
    "c0-id=0",
  ];
  (params || []).forEach((p, idx) => lines.push("c0-param" + idx + "=" + p));
  lines.push("batchId=" + ((Date.now() % 100000000) | 0));
  return Promise.resolve()
    .then(() =>
      fetch(
        "https://www.lofter.com/dwr/call/plaincall/UserBean." +
          method +
          ".dwr",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "text/plain" },
          body: lines.join("\n"),
        },
      ),
    )
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then((text) => {
      if (/java\.lang\.\w+Exception/.test(text)) {
        throw new Error("接口异常（未登录或会话过期）");
      }
      /* 留存原始回复，供调用方做诊断（如解析成功但结果形态不符预期） */
      LC_dwrCall.lastRaw = text;
      return LC_dwrParse(text);
    });
}

/* popup 中继：popup 直连 DWR 会被服务端回空 body（Origin 是
 * chrome-extension:// 且无 Referer，实测 200 + 空响应）。改为把请求
 * 转发给已打开的 LOFTER 标签页里的 content script，由它同源执行——
 * 与用户在页面控制台探测完全同环境，Cookie/Referer 都正确。 */
function LC_dwrRelay(method, params) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.tabs) {
      return reject(new Error("NO_TABS_API"));
    }
    chrome.tabs.query({ url: "*://*.lofter.com/*" }, (tabs) => {
      const list = (tabs || []).filter((t) => t.id != null);
      if (!list.length) {
        return reject(
          new Error("没有已打开的 LOFTER 标签页，请先打开任意 LOFTER 页面后重试"),
        );
      }
      let idx = 0;
      const tryNext = () => {
        if (idx >= list.length) {
          return reject(new Error("LOFTER 页面未响应中继请求（页面可能还在加载）"));
        }
        const tab = list[idx++];
        let settled = false;
        chrome.tabs.sendMessage(
          tab.id,
          { type: "lc-dwr", method: method, params: params },
          (resp) => {
            if (settled) return;
            settled = true;
            if (chrome.runtime.lastError || !resp) {
              tryNext(); /* 该标签页 content script 未就绪，换下一个 */
              return;
            }
            if (!resp.ok) return reject(new Error(resp.error || "DWR 调用失败"));
            LC_dwrCall.lastRaw = String(resp.raw || "");
            resolve(resp.data);
          },
        );
      };
      tryNext();
    });
  });
}

/* 统一入口：扩展页面（popup）走中继，lofter.com 页面内直连 */
function LC_dwrCall(method, params) {
  if (
    typeof location !== "undefined" &&
    location.protocol === "chrome-extension:"
  ) {
    return LC_dwrRelay(method, params);
  }
  return LC_dwrDirect(method, params);
}

if (typeof window !== "undefined") {
  window.LC_dwrParse = LC_dwrParse;
  window.LC_dwrCall = LC_dwrCall;
}
