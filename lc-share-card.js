/* ============================================================
 * #14 生成分享图（含二维码）— 正式版（v1.9.0，自 tools/demo-share-card.js 2026-10-06.12 迁移）
 *
 * 形态：常驻 content script（manifest 注册，页面加载即生效），无需粘贴任何代码。
 *   1. 打开任意一篇文章详情页（模板按组件锚点识别：T1 旧版 / T2 新版 / T3 长文章 /
 *      T4 旧版主题变体 m-postdtl / 全未知 → 内容图域兜底）
 *   2. 入口按「实测矩阵」三形态择一：
 *      ① 官方右上按钮条（`#control.boprt ul`；T1/T2/T4、博主页；跟随滚动由 LOFTER 自管）
 *         → 注入 <li><a><em>分享图</em></a></li>
 *      ② 专栏文章右侧竖条（按钮条在跨域 iframe `#control_frame` 内）
 *         → 父页读 iframe 的 fixed 定位，在竖条末端叠一枚同款竖钮（零跨帧通信）
 *      ③ 都没有 → 右下角悬浮球（FAB）兜底
 *   3. 点入口 → 预览面板（可切 流式/A/B 版式、换强调色、下载 / 复制）
 *
 * 设置（lc_settings_v1.shareCard）：
 *   enabled: 默认 true —— 关掉后不注入任何入口（并撤掉已注入的）
 *   （入口形态恒 auto：官方按钮条 → 帧内 li / 横条并排钮 → 竖列侧钮 → 右下角悬浮球兜底。
 *     「入口并进官方按钮条」开关 2026-10-07 已退休，历史存的 entry 值一律忽略。）
 *
 * 调试命令（保留，出问题时在控制台用）：
 *   __lcShareCard()            重新打开预览面板
 *   __lcShareCardSet('auto')   切版式：'auto' | 'A'（封面海报）| 'B'（纸感文字卡）
 *   __lcShareCardColor('#c8452f')  设强调色
 *   __lcShareCardFields()      打印字段核对表（值 + 来源），排查提取错误用
 *   __lcShareCardDownload() / __lcShareCardCopy()  下载 / 复制 PNG
 *   __lcShareCardYear()        单独跑一次「归档补年份」（看请求次数 / 失败原因）
 *   __lcShareCardVer()         打印版本戳
 *
 * 日期与年份：
 *   T1 默认模板 DOM 只有「月/日」→ 卡片上先显示「9月30日」，随后异步向
 *   官方归档接口核对年份并**自动重绘**为「2026-09-30」。面板提示会写
 *   「正在核对年份…」→「年份已补齐 → YYYY-MM-DD（N 次请求）」。
 *   T2/T4 模板 DOM 自带年份 → 不请求接口（页面就是权威来源）。
 *   接口与三条硬约束见 §3.5 注释（含 v6 探针「重放失败」的真凶）。
 *
 * 验收点（对应 todo #14 专节）：
 *   1. 三种模板都能提取到 标题 / 作者 / 头像 / 日期 / 封面 / 摘要 / 标签 / permalink
 *   2. 类型自动判定 = **内容事实**（首块是图 / 图文配比，与主题类名无关；见 §2 注释）；
 *      视频帖 = 封面走 video[poster] + 居中播放角标 + 右下时长 pill，自动版式 A；
 *      判定依据（x 字 / y 图 / 首块是图是文）在字段核对表里逐项可见
 *   3. 版式：**自动 = 流式**（官方式长图：内容流按原文顺序 → 图在顶/图文夹排自然呈现；
 *      高度预算 4000px，超出出「打开 LOFTER 浏览更多精彩」截断条；单图显示高上限 1600px
 *      超出居中裁剪；多图官方式顺排）——A 封面海报 / B 纸感文字卡保留为手动选项；
 *      二维码不压内容图，固定底部，与官方 app 一致
 *   4. 二维码可扫（指向原文，库为本文件内联 vendored qrcode-generator 1.4.4）；
 *      强调色可跟主题色
 *   5. 任何一张图加载失败都不能让整张卡失败（降级为主题色块 / 首字头像 / 占位块）；
 *      avaimg 头像域不回 ACAO → 直连失败自动走 background 中继（fetch→dataURL）
 *
 * 依赖：内联 qrcode-generator 1.4.4（MIT, Kazuhiko Arase）—— 见下方紧跟的库代码。
 *   与 hyalite.js 同为 vendored 第三方代码，第三方组件说明见 README「License」一节。
 * ============================================================ */

/* ---------- 内联依赖：qrcode-generator 1.4.4（Kazuhiko Arase, MIT）----------
 * https://github.com/kazuhikoarase/qrcode-generator
 * 本文件内联压缩版（约 20KB，与 hyalite.js 同为 vendored 第三方代码，LICENSE 已登记）。
 * ------------------------------------------------------------------------ */
/**
 * Minified by jsDelivr using Terser v5.37.0.
 * Original file: /npm/qrcode-generator@1.4.4/qrcode.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
var qrcode=function(){var t=function(t,r){var e=t,n=g[r],o=null,i=0,a=null,u=[],f={},c=function(t,r){o=function(t){for(var r=new Array(t),e=0;e<t;e+=1){r[e]=new Array(t);for(var n=0;n<t;n+=1)r[e][n]=null}return r}(i=4*e+17),l(0,0),l(i-7,0),l(0,i-7),s(),h(),d(t,r),e>=7&&v(t),null==a&&(a=p(e,n,u)),w(a,r)},l=function(t,r){for(var e=-1;e<=7;e+=1)if(!(t+e<=-1||i<=t+e))for(var n=-1;n<=7;n+=1)r+n<=-1||i<=r+n||(o[t+e][r+n]=0<=e&&e<=6&&(0==n||6==n)||0<=n&&n<=6&&(0==e||6==e)||2<=e&&e<=4&&2<=n&&n<=4)},h=function(){for(var t=8;t<i-8;t+=1)null==o[t][6]&&(o[t][6]=t%2==0);for(var r=8;r<i-8;r+=1)null==o[6][r]&&(o[6][r]=r%2==0)},s=function(){for(var t=B.getPatternPosition(e),r=0;r<t.length;r+=1)for(var n=0;n<t.length;n+=1){var i=t[r],a=t[n];if(null==o[i][a])for(var u=-2;u<=2;u+=1)for(var f=-2;f<=2;f+=1)o[i+u][a+f]=-2==u||2==u||-2==f||2==f||0==u&&0==f}},v=function(t){for(var r=B.getBCHTypeNumber(e),n=0;n<18;n+=1){var a=!t&&1==(r>>n&1);o[Math.floor(n/3)][n%3+i-8-3]=a}for(n=0;n<18;n+=1){a=!t&&1==(r>>n&1);o[n%3+i-8-3][Math.floor(n/3)]=a}},d=function(t,r){for(var e=n<<3|r,a=B.getBCHTypeInfo(e),u=0;u<15;u+=1){var f=!t&&1==(a>>u&1);u<6?o[u][8]=f:u<8?o[u+1][8]=f:o[i-15+u][8]=f}for(u=0;u<15;u+=1){f=!t&&1==(a>>u&1);u<8?o[8][i-u-1]=f:u<9?o[8][15-u-1+1]=f:o[8][15-u-1]=f}o[i-8][8]=!t},w=function(t,r){for(var e=-1,n=i-1,a=7,u=0,f=B.getMaskFunction(r),c=i-1;c>0;c-=2)for(6==c&&(c-=1);;){for(var g=0;g<2;g+=1)if(null==o[n][c-g]){var l=!1;u<t.length&&(l=1==(t[u]>>>a&1)),f(n,c-g)&&(l=!l),o[n][c-g]=l,-1==(a-=1)&&(u+=1,a=7)}if((n+=e)<0||i<=n){n-=e,e=-e;break}}},p=function(t,r,e){for(var n=A.getRSBlocks(t,r),o=b(),i=0;i<e.length;i+=1){var a=e[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var u=0;for(i=0;i<n.length;i+=1)u+=n[i].dataCount;if(o.getLengthInBits()>8*u)throw"code length overflow. ("+o.getLengthInBits()+">"+8*u+")";for(o.getLengthInBits()+4<=8*u&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=8*u||(o.put(236,8),o.getLengthInBits()>=8*u));)o.put(17,8);return function(t,r){for(var e=0,n=0,o=0,i=new Array(r.length),a=new Array(r.length),u=0;u<r.length;u+=1){var f=r[u].dataCount,c=r[u].totalCount-f;n=Math.max(n,f),o=Math.max(o,c),i[u]=new Array(f);for(var g=0;g<i[u].length;g+=1)i[u][g]=255&t.getBuffer()[g+e];e+=f;var l=B.getErrorCorrectPolynomial(c),h=k(i[u],l.getLength()-1).mod(l);for(a[u]=new Array(l.getLength()-1),g=0;g<a[u].length;g+=1){var s=g+h.getLength()-a[u].length;a[u][g]=s>=0?h.getAt(s):0}}var v=0;for(g=0;g<r.length;g+=1)v+=r[g].totalCount;var d=new Array(v),w=0;for(g=0;g<n;g+=1)for(u=0;u<r.length;u+=1)g<i[u].length&&(d[w]=i[u][g],w+=1);for(g=0;g<o;g+=1)for(u=0;u<r.length;u+=1)g<a[u].length&&(d[w]=a[u][g],w+=1);return d}(o,n)};f.addData=function(t,r){var e=null;switch(r=r||"Byte"){case"Numeric":e=M(t);break;case"Alphanumeric":e=x(t);break;case"Byte":e=m(t);break;case"Kanji":e=L(t);break;default:throw"mode:"+r}u.push(e),a=null},f.isDark=function(t,r){if(t<0||i<=t||r<0||i<=r)throw t+","+r;return o[t][r]},f.getModuleCount=function(){return i},f.make=function(){if(e<1){for(var t=1;t<40;t++){for(var r=A.getRSBlocks(t,n),o=b(),i=0;i<u.length;i++){var a=u[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var g=0;for(i=0;i<r.length;i++)g+=r[i].dataCount;if(o.getLengthInBits()<=8*g)break}e=t}c(!1,function(){for(var t=0,r=0,e=0;e<8;e+=1){c(!0,e);var n=B.getLostPoint(f);(0==e||t>n)&&(t=n,r=e)}return r}())},f.createTableTag=function(t,r){t=t||2;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+(r=void 0===r?4*t:r)+"px;",e+='">',e+="<tbody>";for(var n=0;n<f.getModuleCount();n+=1){e+="<tr>";for(var o=0;o<f.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+t+"px;",e+=" height: "+t+"px;",e+=" background-color: ",e+=f.isDark(n,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>"},f.createSvgTag=function(t,r,e,n){var o={};"object"==typeof arguments[0]&&(t=(o=arguments[0]).cellSize,r=o.margin,e=o.alt,n=o.title),t=t||2,r=void 0===r?4*t:r,(e="string"==typeof e?{text:e}:e||{}).text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,(n="string"==typeof n?{text:n}:n||{}).text=n.text||null,n.id=n.text?n.id||"qrcode-title":null;var i,a,u,c,g=f.getModuleCount()*t+2*r,l="";for(c="l"+t+",0 0,"+t+" -"+t+",0 0,-"+t+"z ",l+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',l+=o.scalable?"":' width="'+g+'px" height="'+g+'px"',l+=' viewBox="0 0 '+g+" "+g+'" ',l+=' preserveAspectRatio="xMinYMin meet"',l+=n.text||e.text?' role="img" aria-labelledby="'+y([n.id,e.id].join(" ").trim())+'"':"",l+=">",l+=n.text?'<title id="'+y(n.id)+'">'+y(n.text)+"</title>":"",l+=e.text?'<description id="'+y(e.id)+'">'+y(e.text)+"</description>":"",l+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',l+='<path d="',a=0;a<f.getModuleCount();a+=1)for(u=a*t+r,i=0;i<f.getModuleCount();i+=1)f.isDark(a,i)&&(l+="M"+(i*t+r)+","+u+c);return l+='" stroke="transparent" fill="black"/>',l+="</svg>"},f.createDataURL=function(t,r){t=t||2,r=void 0===r?4*t:r;var e=f.getModuleCount()*t+2*r,n=r,o=e-r;return I(e,e,(function(r,e){if(n<=r&&r<o&&n<=e&&e<o){var i=Math.floor((r-n)/t),a=Math.floor((e-n)/t);return f.isDark(a,i)?0:1}return 1}))},f.createImgTag=function(t,r,e){t=t||2,r=void 0===r?4*t:r;var n=f.getModuleCount()*t+2*r,o="";return o+="<img",o+=' src="',o+=f.createDataURL(t,r),o+='"',o+=' width="',o+=n,o+='"',o+=' height="',o+=n,o+='"',e&&(o+=' alt="',o+=y(e),o+='"'),o+="/>"};var y=function(t){for(var r="",e=0;e<t.length;e+=1){var n=t.charAt(e);switch(n){case"<":r+="&lt;";break;case">":r+="&gt;";break;case"&":r+="&amp;";break;case'"':r+="&quot;";break;default:r+=n}}return r};return f.createASCII=function(t,r){if((t=t||1)<2)return function(t){t=void 0===t?2:t;var r,e,n,o,i,a=1*f.getModuleCount()+2*t,u=t,c=a-t,g={"██":"█","█ ":"▀"," █":"▄","  ":" "},l={"██":"▀","█ ":"▀"," █":" ","  ":" "},h="";for(r=0;r<a;r+=2){for(n=Math.floor((r-u)/1),o=Math.floor((r+1-u)/1),e=0;e<a;e+=1)i="█",u<=e&&e<c&&u<=r&&r<c&&f.isDark(n,Math.floor((e-u)/1))&&(i=" "),u<=e&&e<c&&u<=r+1&&r+1<c&&f.isDark(o,Math.floor((e-u)/1))?i+=" ":i+="█",h+=t<1&&r+1>=c?l[i]:g[i];h+="\n"}return a%2&&t>0?h.substring(0,h.length-a-1)+Array(a+1).join("▀"):h.substring(0,h.length-1)}(r);t-=1,r=void 0===r?2*t:r;var e,n,o,i,a=f.getModuleCount()*t+2*r,u=r,c=a-r,g=Array(t+1).join("██"),l=Array(t+1).join("  "),h="",s="";for(e=0;e<a;e+=1){for(o=Math.floor((e-u)/t),s="",n=0;n<a;n+=1)i=1,u<=n&&n<c&&u<=e&&e<c&&f.isDark(o,Math.floor((n-u)/t))&&(i=0),s+=i?g:l;for(o=0;o<t;o+=1)h+=s+"\n"}return h.substring(0,h.length-1)},f.renderTo2dContext=function(t,r){r=r||2;for(var e=f.getModuleCount(),n=0;n<e;n++)for(var o=0;o<e;o++)t.fillStyle=f.isDark(n,o)?"black":"white",t.fillRect(n*r,o*r,r,r)},f};t.stringToBytes=(t.stringToBytesFuncs={default:function(t){for(var r=[],e=0;e<t.length;e+=1){var n=t.charCodeAt(e);r.push(255&n)}return r}}).default,t.createStringToBytes=function(t,r){var e=function(){for(var e=S(t),n=function(){var t=e.read();if(-1==t)throw"eof";return t},o=0,i={};;){var a=e.read();if(-1==a)break;var u=n(),f=n()<<8|n();i[String.fromCharCode(a<<8|u)]=f,o+=1}if(o!=r)throw o+" != "+r;return i}(),n="?".charCodeAt(0);return function(t){for(var r=[],o=0;o<t.length;o+=1){var i=t.charCodeAt(o);if(i<128)r.push(i);else{var a=e[t.charAt(o)];"number"==typeof a?(255&a)==a?r.push(a):(r.push(a>>>8),r.push(255&a)):r.push(n)}}return r}};var r,e,n,o,i,a=1,u=2,f=4,c=8,g={L:1,M:0,Q:3,H:2},l=0,h=1,s=2,v=3,d=4,w=5,p=6,y=7,B=(r=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],e=1335,n=7973,i=function(t){for(var r=0;0!=t;)r+=1,t>>>=1;return r},(o={}).getBCHTypeInfo=function(t){for(var r=t<<10;i(r)-i(e)>=0;)r^=e<<i(r)-i(e);return 21522^(t<<10|r)},o.getBCHTypeNumber=function(t){for(var r=t<<12;i(r)-i(n)>=0;)r^=n<<i(r)-i(n);return t<<12|r},o.getPatternPosition=function(t){return r[t-1]},o.getMaskFunction=function(t){switch(t){case l:return function(t,r){return(t+r)%2==0};case h:return function(t,r){return t%2==0};case s:return function(t,r){return r%3==0};case v:return function(t,r){return(t+r)%3==0};case d:return function(t,r){return(Math.floor(t/2)+Math.floor(r/3))%2==0};case w:return function(t,r){return t*r%2+t*r%3==0};case p:return function(t,r){return(t*r%2+t*r%3)%2==0};case y:return function(t,r){return(t*r%3+(t+r)%2)%2==0};default:throw"bad maskPattern:"+t}},o.getErrorCorrectPolynomial=function(t){for(var r=k([1],0),e=0;e<t;e+=1)r=r.multiply(k([1,C.gexp(e)],0));return r},o.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case a:return 10;case u:return 9;case f:case c:return 8;default:throw"mode:"+t}else if(r<27)switch(t){case a:return 12;case u:return 11;case f:return 16;case c:return 10;default:throw"mode:"+t}else{if(!(r<41))throw"type:"+r;switch(t){case a:return 14;case u:return 13;case f:return 16;case c:return 12;default:throw"mode:"+t}}},o.getLostPoint=function(t){for(var r=t.getModuleCount(),e=0,n=0;n<r;n+=1)for(var o=0;o<r;o+=1){for(var i=0,a=t.isDark(n,o),u=-1;u<=1;u+=1)if(!(n+u<0||r<=n+u))for(var f=-1;f<=1;f+=1)o+f<0||r<=o+f||0==u&&0==f||a==t.isDark(n+u,o+f)&&(i+=1);i>5&&(e+=3+i-5)}for(n=0;n<r-1;n+=1)for(o=0;o<r-1;o+=1){var c=0;t.isDark(n,o)&&(c+=1),t.isDark(n+1,o)&&(c+=1),t.isDark(n,o+1)&&(c+=1),t.isDark(n+1,o+1)&&(c+=1),0!=c&&4!=c||(e+=3)}for(n=0;n<r;n+=1)for(o=0;o<r-6;o+=1)t.isDark(n,o)&&!t.isDark(n,o+1)&&t.isDark(n,o+2)&&t.isDark(n,o+3)&&t.isDark(n,o+4)&&!t.isDark(n,o+5)&&t.isDark(n,o+6)&&(e+=40);for(o=0;o<r;o+=1)for(n=0;n<r-6;n+=1)t.isDark(n,o)&&!t.isDark(n+1,o)&&t.isDark(n+2,o)&&t.isDark(n+3,o)&&t.isDark(n+4,o)&&!t.isDark(n+5,o)&&t.isDark(n+6,o)&&(e+=40);var g=0;for(o=0;o<r;o+=1)for(n=0;n<r;n+=1)t.isDark(n,o)&&(g+=1);return e+=Math.abs(100*g/r/r-50)/5*10},o),C=function(){for(var t=new Array(256),r=new Array(256),e=0;e<8;e+=1)t[e]=1<<e;for(e=8;e<256;e+=1)t[e]=t[e-4]^t[e-5]^t[e-6]^t[e-8];for(e=0;e<255;e+=1)r[t[e]]=e;var n={glog:function(t){if(t<1)throw"glog("+t+")";return r[t]},gexp:function(r){for(;r<0;)r+=255;for(;r>=256;)r-=255;return t[r]}};return n}();function k(t,r){if(void 0===t.length)throw t.length+"/"+r;var e=function(){for(var e=0;e<t.length&&0==t[e];)e+=1;for(var n=new Array(t.length-e+r),o=0;o<t.length-e;o+=1)n[o]=t[o+e];return n}(),n={getAt:function(t){return e[t]},getLength:function(){return e.length},multiply:function(t){for(var r=new Array(n.getLength()+t.getLength()-1),e=0;e<n.getLength();e+=1)for(var o=0;o<t.getLength();o+=1)r[e+o]^=C.gexp(C.glog(n.getAt(e))+C.glog(t.getAt(o)));return k(r,0)},mod:function(t){if(n.getLength()-t.getLength()<0)return n;for(var r=C.glog(n.getAt(0))-C.glog(t.getAt(0)),e=new Array(n.getLength()),o=0;o<n.getLength();o+=1)e[o]=n.getAt(o);for(o=0;o<t.getLength();o+=1)e[o]^=C.gexp(C.glog(t.getAt(o))+r);return k(e,0).mod(t)}};return n}var A=function(){var t=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],r=function(t,r){var e={};return e.totalCount=t,e.dataCount=r,e},e={};return e.getRSBlocks=function(e,n){var o=function(r,e){switch(e){case g.L:return t[4*(r-1)+0];case g.M:return t[4*(r-1)+1];case g.Q:return t[4*(r-1)+2];case g.H:return t[4*(r-1)+3];default:return}}(e,n);if(void 0===o)throw"bad rs block @ typeNumber:"+e+"/errorCorrectionLevel:"+n;for(var i=o.length/3,a=[],u=0;u<i;u+=1)for(var f=o[3*u+0],c=o[3*u+1],l=o[3*u+2],h=0;h<f;h+=1)a.push(r(c,l));return a},e}(),b=function(){var t=[],r=0,e={getBuffer:function(){return t},getAt:function(r){var e=Math.floor(r/8);return 1==(t[e]>>>7-r%8&1)},put:function(t,r){for(var n=0;n<r;n+=1)e.putBit(1==(t>>>r-n-1&1))},getLengthInBits:function(){return r},putBit:function(e){var n=Math.floor(r/8);t.length<=n&&t.push(0),e&&(t[n]|=128>>>r%8),r+=1}};return e},M=function(t){var r=a,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+2<r.length;)t.put(o(r.substring(n,n+3)),10),n+=3;n<r.length&&(r.length-n==1?t.put(o(r.substring(n,n+1)),4):r.length-n==2&&t.put(o(r.substring(n,n+2)),7))}},o=function(t){for(var r=0,e=0;e<t.length;e+=1)r=10*r+i(t.charAt(e));return r},i=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);throw"illegal char :"+t};return n},x=function(t){var r=u,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+1<r.length;)t.put(45*o(r.charAt(n))+o(r.charAt(n+1)),11),n+=2;n<r.length&&t.put(o(r.charAt(n)),6)}},o=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);if("A"<=t&&t<="Z")return t.charCodeAt(0)-"A".charCodeAt(0)+10;switch(t){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+t}};return n},m=function(r){var e=f,n=t.stringToBytes(r),o={getMode:function(){return e},getLength:function(t){return n.length},write:function(t){for(var r=0;r<n.length;r+=1)t.put(n[r],8)}};return o},L=function(r){var e=c,n=t.stringToBytesFuncs.SJIS;if(!n)throw"sjis not supported.";!function(){var t=n("友");if(2!=t.length||38726!=(t[0]<<8|t[1]))throw"sjis not supported."}();var o=n(r),i={getMode:function(){return e},getLength:function(t){return~~(o.length/2)},write:function(t){for(var r=o,e=0;e+1<r.length;){var n=(255&r[e])<<8|255&r[e+1];if(33088<=n&&n<=40956)n-=33088;else{if(!(57408<=n&&n<=60351))throw"illegal char at "+(e+1)+"/"+n;n-=49472}n=192*(n>>>8&255)+(255&n),t.put(n,13),e+=2}if(e<r.length)throw"illegal char at "+(e+1)}};return i},D=function(){var t=[],r={writeByte:function(r){t.push(255&r)},writeShort:function(t){r.writeByte(t),r.writeByte(t>>>8)},writeBytes:function(t,e,n){e=e||0,n=n||t.length;for(var o=0;o<n;o+=1)r.writeByte(t[o+e])},writeString:function(t){for(var e=0;e<t.length;e+=1)r.writeByte(t.charCodeAt(e))},toByteArray:function(){return t},toString:function(){var r="";r+="[";for(var e=0;e<t.length;e+=1)e>0&&(r+=","),r+=t[e];return r+="]"}};return r},S=function(t){var r=t,e=0,n=0,o=0,i={read:function(){for(;o<8;){if(e>=r.length){if(0==o)return-1;throw"unexpected end of file./"+o}var t=r.charAt(e);if(e+=1,"="==t)return o=0,-1;t.match(/^\s$/)||(n=n<<6|a(t.charCodeAt(0)),o+=6)}var i=n>>>o-8&255;return o-=8,i}},a=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(43==t)return 62;if(47==t)return 63;throw"c:"+t};return i},I=function(t,r,e){for(var n=function(t,r){var e=t,n=r,o=new Array(t*r),i={setPixel:function(t,r,n){o[r*e+t]=n},write:function(t){t.writeString("GIF87a"),t.writeShort(e),t.writeShort(n),t.writeByte(128),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(255),t.writeByte(255),t.writeByte(255),t.writeString(","),t.writeShort(0),t.writeShort(0),t.writeShort(e),t.writeShort(n),t.writeByte(0);var r=a(2);t.writeByte(2);for(var o=0;r.length-o>255;)t.writeByte(255),t.writeBytes(r,o,255),o+=255;t.writeByte(r.length-o),t.writeBytes(r,o,r.length-o),t.writeByte(0),t.writeString(";")}},a=function(t){for(var r=1<<t,e=1+(1<<t),n=t+1,i=u(),a=0;a<r;a+=1)i.add(String.fromCharCode(a));i.add(String.fromCharCode(r)),i.add(String.fromCharCode(e));var f,c,g,l=D(),h=(f=l,c=0,g=0,{write:function(t,r){if(t>>>r!=0)throw"length over";for(;c+r>=8;)f.writeByte(255&(t<<c|g)),r-=8-c,t>>>=8-c,g=0,c=0;g|=t<<c,c+=r},flush:function(){c>0&&f.writeByte(g)}});h.write(r,n);var s=0,v=String.fromCharCode(o[s]);for(s+=1;s<o.length;){var d=String.fromCharCode(o[s]);s+=1,i.contains(v+d)?v+=d:(h.write(i.indexOf(v),n),i.size()<4095&&(i.size()==1<<n&&(n+=1),i.add(v+d)),v=d)}return h.write(i.indexOf(v),n),h.write(e,n),h.flush(),l.toByteArray()},u=function(){var t={},r=0,e={add:function(n){if(e.contains(n))throw"dup key:"+n;t[n]=r,r+=1},size:function(){return r},indexOf:function(r){return t[r]},contains:function(r){return void 0!==t[r]}};return e};return i}(t,r),o=0;o<r;o+=1)for(var i=0;i<t;i+=1)n.setPixel(i,o,e(i,o));var a=D();n.write(a);for(var u=function(){var t=0,r=0,e=0,n="",o={},i=function(t){n+=String.fromCharCode(a(63&t))},a=function(t){if(t<0);else{if(t<26)return 65+t;if(t<52)return t-26+97;if(t<62)return t-52+48;if(62==t)return 43;if(63==t)return 47}throw"n:"+t};return o.writeByte=function(n){for(t=t<<8|255&n,r+=8,e+=1;r>=6;)i(t>>>r-6),r-=6},o.flush=function(){if(r>0&&(i(t<<6-r),t=0,r=0),e%3!=0)for(var o=3-e%3,a=0;a<o;a+=1)n+="="},o.toString=function(){return n},o}(),f=a.toByteArray(),c=0;c<f.length;c+=1)u.writeByte(f[c]);return u.flush(),"data:image/gif;base64,"+u};return t}();qrcode.stringToBytesFuncs["UTF-8"]=function(t){return function(t){for(var r=[],e=0;e<t.length;e++){var n=t.charCodeAt(e);n<128?r.push(n):n<2048?r.push(192|n>>6,128|63&n):n<55296||n>=57344?r.push(224|n>>12,128|n>>6&63,128|63&n):(e++,n=65536+((1023&n)<<10|1023&t.charCodeAt(e)),r.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n))}return r}(t)},function(t){"function"==typeof define&&define.amd?define([],t):"object"==typeof exports&&(module.exports=t())}((function(){return qrcode}));


(function () {
  'use strict';
  var TAG = '[lc-share]';
  var VER = '1.10.0';
  /* 兜底宽限期（2026-10-07 真机：长文页开场闪一下 FAB + lc-export 老入口）：
   * 官方 control 帧/条是后置渲染的，就绪前锚定形态都认不出来——若无脑落 FAB，
   * 等帧就绪再拆，右下角就闪一下。auto 模式下先等 FAB_GRACE 再落兜底。 */
  var bootTs = Date.now(), FAB_GRACE = 3000;
  /* 幂等守卫：content script 三处 dom match 都可能命中同一文档（含 all_frames），
   * 重复注入只留第一份（正式版不提供「卸载命令」，重复执行直接退出）。 */
  if (window.__lcShareCardLoaded) return;
  window.__lcShareCardLoaded = true;
  /* 早期「lc-export 老入口」护盾（2026-10-07 真机：长文页右下角 #lc-export-fab 仍闪）。
   * lc-export 的兜底丸（fixed right:16 bottom:16）是它**自己**注入的，我们的 JS 遮蔽
   * 总有观察器去抖空窗 → 改为从**首帧**就用 CSS 按住：html.lcsd-pending 期间隐藏。
   * 类在 document_start 就挂（早于 lc-export waitFor 命中锚点），入口定形后由
   * maskOldExport(false) 摘除；正式去留仍归 suppressOldExport()（我们的 md 钮在位 → 真删）。 */
  try {
    if (window.top === window && document.documentElement) {
      var shield = document.createElement('style');
      shield.id = 'lcsd-export-shield';
      shield.textContent = 'html.lcsd-pending .lc-export-link,html.lcsd-pending #lc-export-fab' +
        '{display:none !important;}';
      (document.head || document.documentElement).appendChild(shield);
      document.documentElement.classList.add('lcsd-pending');
    }
  } catch (e0) { /* 拿不到 documentElement（罕见）→ 退回纯 JS 遮蔽 */ }

  /* ================= 0. 常量与状态 ================= */

  var W = 1080, H = 1440;
  var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';
  var QR = (typeof qrcode === 'function') ? qrcode : window.qrcode;

  var PAL = {
    paper: '#fdfaf6', ink: '#221f1b', sub: '#6e6657',
    faint: '#a39885', line: '#e8dfcf', accent: '#c8452f'
  };

  var state = { mode: 'auto', fields: null, canvas: null, coverImg: null, avatarImg: null,
    avatarFailed: false, note: '' };

  /* ================= 1. DOM 小工具 ================= */

  function txt(el) {
    return el ? String(el.textContent || '').replace(/[\t\n\r ]+/g, ' ').trim() : '';
  }
  /* 剪掉被截断在中间的 HTML 实体尾巴（如 LOFTER 页面标题把 `&nbsp;` 砍成
   * `&n`）。只在「尾巴确实是已知实体名的前缀」或「数字实体断尾」时才剪，
   * 避免误伤真实标题（`A&W`、`R&D` 原样保留）。放在文档字符串解析层，
   * 改动要同步 tools/test-demo-share-card.js 的 [T1c]/[T1d]。 */
  var ENT_NAMES = ['nbsp', 'amp', 'lt', 'gt', 'quot', 'apos', 'hellip',
    'mdash', 'ndash', 'middot', 'ensp', 'emsp', 'thinsp', 'copy', 'reg',
    'trade', 'bull', 'deg', 'times', 'laquo', 'raquo', 'sect', 'para'];
  function trimBrokenEntity(s) {
    var str = String(s || '');
    var m = /&(#[xX]?[0-9a-fA-F]{1,6}|[a-zA-Z]{1,6})$/.exec(str);
    if (!m) return str;
    var t = m[1];
    if (t.charAt(0) === '#') return str.slice(0, m.index).replace(/\s+$/, '');
    for (var i = 0; i < ENT_NAMES.length; i++) {
      if (ENT_NAMES[i].indexOf(t) === 0 && t.length < ENT_NAMES[i].length) {
        return str.slice(0, m.index).replace(/\s+$/, '');
      }
    }
    return str;
  }
  function one(sel, root) {
    if (!sel) return null;
    try { return (root || document).querySelector(sel); } catch (e) { return null; }
  }
  /* 候选选择器表：按顺序试，返回首个命中元素 */
  function pickOne(sels, root) {
    for (var i = 0; i < (sels || []).length; i++) {
      var el = one(sels[i], root);
      if (el) return { el: el, sel: sels[i] };
    }
    return null;
  }
  function pickText(sels, root) {
    var h = pickOne(sels, root);
    return { text: h ? txt(h.el) : '', sel: h ? h.sel : '' };
  }
  function pickList(sels) {
    for (var i = 0; i < (sels || []).length; i++) {
      var els = document.querySelectorAll(sels[i]);
      if (els.length) {
        var out = [];
        for (var j = 0; j < els.length; j++) { var t = txt(els[j]); if (t) out.push(t); }
        if (out.length) return { list: out, sel: sels[i] };
      }
    }
    return { list: [], sel: '' };
  }
  function absUrl(u) {
    if (!u) return '';
    u = String(u).trim();
    if (!u || u.indexOf('data:') === 0) return '';
    if (u.indexOf('//') === 0) return 'https:' + u;
    try { return new URL(u, location.href).href; } catch (e) { return u; }
  }
  /* 懒加载：src 常常是空或占位，真身在 data-src / data-original */
  function imgSrc(im) {
    if (!im) return '';
    return absUrl(im.getAttribute('src') || im.getAttribute('data-src') ||
      im.getAttribute('data-original') || im.getAttribute('data-lazy-src') || '');
  }
  function pickImg(sels, root) {
    var h = pickOne(sels, root);
    return { url: h ? imgSrc(h.el) : '', sel: h ? h.sel : '' };
  }
  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  /* ================= 2. 模板识别 / 文章类型（依据 todo #14 第九节实证） ================= */

  function pageTemplate() {
    if (one('.long-text')) return 'T3';
    if (one('.postwrapper .block')) return 'T1';
    if (one('.m-post')) return 'T2';
    if (one('.m-postdtl')) return 'T4';
    return 'unknown';
  }
  function articleRoot() {
    return one('.m-cnt') || one('#m-cnt') || one('.postwrapper') ||
      one('.m-post') || one('.m-postdtl');
  }
  /* 内容图专域判定：正文/封面图恒在 imglfN.lf127.net；头像在 avaimg、图标在 l.bst.126.net
     （四轮真机探针一致）。点赞/推荐列表里的 imglf 小图用 notes 容器排除。 */
  function contentImg() {
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (!/imglf\d+\.lf127\.net/.test(im.getAttribute('src') || '')) continue;
      if (im.closest && im.closest('ol.notes, li.note')) continue;
      return im;
    }
    return null;
  }
  function isVideo() {
    var root = articleRoot() || document;
    return !!one('video', root) || !!one('.m-video', root) ||
      !!one('.m-post-video', root) || !!one('.block.video', root);
  }
  /* 视频帖封面（2026-10-06 真机探针 1f5e843d_2bdb98a1d）：
   *   .block.video > video[poster] → poster 在 imglf5.lf127.net（内容图同族域，可跨域取像素）
   *   正文 textContent 里的「您的浏览器不支持video标签。」是 <video> 兜底文案，非正文
   *   （contentFlow 只取 p/img，天然不收；此处也不把它算进字数） */
  function videoInfo() {
    var root = contentRoot();
    var v = root.querySelector('video') || one('video');
    if (!v && !one('.block.video') && !one('.m-video') && !one('.m-post-video')) return null;
    var poster = v ? absUrl(v.getAttribute('poster')) : '';
    if (!poster && v && v.parentNode) {
      var im = v.parentNode.querySelector('img');
      poster = im ? absUrl(imgSrc(im)) : '';
    }
    return {
      poster: poster,
      dur: (v && isFinite(v.duration)) ? v.duration : 0,
      w: (v && v.videoWidth) || 0, h: (v && v.videoHeight) || 0
    };
  }

  /* ===== 内容事实：与主题无关的类型判据 ==========================================
   * 主题能自定义类名（.block.photo / .pic 只是**某些**主题的习惯，两百余套不可枚举），
   * 却改不了「这帖图多还是字多、图在不在文前」这个事实。真机四样本（2026-10-05 实测）：
   *   awake999   图片帖  0 字 / 2 图（文前即图）
   *   199518wqx  图片帖  25 字 / 1 图（文前即图）
   *   lofguancha 文字帖  1526 字 / 2 图（**文先图后**：正文夹插图，仍必须是文字帖）
   *   观察局挑战帖 图片帖  海报图在顶 + 结构化长文 ← 字数判据的盲区，**首块是图**才能接住
   * 两条信号（互相独立，命中任一即图片帖）：
   *   ① 首块内容是图（图在文前 = 作者当封面用）——接住「海报 + 长文」
   *   ② 图多文少（textLen < imgCount × 100）——接住「图集 / 配图短文」
   * 教训：两轮误判（awake999 / 199518wqx）都发生在「用主题修饰类判类型」这一跳。
   * ============================================================================ */
  var PHOTO_TEXT_PER_IMG = 100;  /* 阈值：平均每张内容图配的文字上限；超出 → 文字帖 */

  /* 内容根：优先官方内容容器组件，逐级降级（顺序来自探针实测 rootSel） */
  function contentRoot() {
    return one('.m-postdtl') || one('.m-post') || one('.postwrapper') ||
      one('.long-text') || one('.m-cnt') || one('#m-cnt') || one('.post') || document.body;
  }
  function isContentImgSrc(u) { return /imglf\d+\.lf127\.net/.test(u || ''); }

  function contentFacts() {
    var root = contentRoot();
    var i, textLen = 0, imgCount = 0, firstImg = null, firstText = null;
    var ps = root.querySelectorAll('p');
    for (i = 0; i < ps.length; i++) {
      var t = txt(ps[i]);
      if (t) { textLen += t.length; if (!firstText) firstText = ps[i]; }
    }
    /* querySelectorAll 恒按文档序返回 → 首个命中即首图 */
    var imgs = root.querySelectorAll('img');
    for (i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (!isContentImgSrc(im.getAttribute('src'))) continue;        /* 头像 avaimg / 图标 l.bst 排除 */
      if (im.closest && im.closest('ol.notes, li.note')) continue;   /* 点赞列表里的小图排除 */
      imgCount++;
      if (!firstImg) firstImg = im;
    }
    /* 首块内容是不是图：firstImg 在 firstText 之前（或根本没有正文文字） */
    var firstIsImg = !!firstImg && (!firstText ||
      !!(firstImg.compareDocumentPosition(firstText) & 4 /* FOLLOWING */));
    var cls = String(root.className || '');
    return {
      rootSel: root === document.body ? 'body(兜底)' : (root.id ? '#' + root.id : '.' + cls.split(/\s+/)[0]),
      textLen: textLen, imgCount: imgCount, firstIsImg: firstIsImg
    };
  }
  function kindNote(cf) {
    return cf.textLen + ' 字 / ' + cf.imgCount + ' 图 / 首块' + (cf.firstIsImg ? '是图' : '是文字') +
      '（图前于文 或 每图 <' + PHOTO_TEXT_PER_IMG + ' 字 → 图片帖）';
  }

  /* 'text' 文字帖 / 'photo' 图片帖 / 'video' 视频帖
     判据 = 内容事实，**不认 .block.photo / .pic 这类主题自定义修饰类**。 */
  function postKind(tpl, cf) {
    if (isVideo()) return 'video';                 /* v1 不出入口（2026-10-05 作者拍板） */
    if (tpl === 'T3') return 'text';               /* 长文章 / 专栏：文字优先（作者拍板） */
    cf = cf || contentFacts();
    if (!cf.imgCount) return 'text';               /* 无内容图 → 文字帖 */
    if (cf.firstIsImg) return 'photo';             /* 图在文前 = 封面位（海报 + 长文也归图片帖） */
    return cf.textLen < cf.imgCount * PHOTO_TEXT_PER_IMG ? 'photo' : 'text';
  }
  var KIND_LABEL = { text: '文字帖', photo: '图片帖', video: '视频帖' };
  var MODE_LABEL = { F: '流式', A: 'A 海报', B: 'B 文字卡' };

  /* ===== 内容流：段落 + 内容图按 DOM 原文顺序（流式版式的原料，同数据层探针 ⑥） =====
   * 「图片帖图在顶 / 文章帖图文夹排」不需要按类型特判——图片帖的图本来就在前面，
   * 文章帖的图文本来就是夹排的，按原文顺序排即可自然呈现（2026-10-05 与作者讨论定案）。 */
  function contentFlow() {
    var root = contentRoot();
    var nodes = [], i, el;
    var all = root.querySelectorAll('p, img, video');
    for (i = 0; i < all.length; i++) {
      el = all[i];
      if (el.closest && el.closest('ol.notes, li.note')) continue;   /* 点赞列表 */
      if (el.tagName === 'IMG' || el.tagName === 'VIDEO') {
        var src;
        if (el.tagName === 'VIDEO') {
          src = absUrl(el.getAttribute('poster'));                    /* 视频帖：poster 当封面帧入流 */
          if (!src) continue;                                         /* 浏览器不支持时无 poster → 该块略过 */
        } else {
          if (!isContentImgSrc(el.getAttribute('src'))) continue;      /* 头像/图标/外链 */
          src = absUrl(imgSrc(el));
        }
        nodes.push({ t: 'img', src: src, video: el.tagName === 'VIDEO', el: el });
      } else {
        var t = txt(el);
        if (t) nodes.push({ t: 'p', text: t, el: el });
      }
    }
    /* 两个 querySelectorAll 各自保序，按文档位置归并（插入排序，量小） */
    var out = [];
    for (i = 0; i < nodes.length; i++) {
      var k = out.length;
      while (k > 0 && (out[k - 1].el.compareDocumentPosition(nodes[i].el) & 2 /* PRECEDING */)) k--;
      out.splice(k, 0, nodes[i]);
    }
    for (i = 0; i < out.length; i++) delete out[i].el;
    return out.slice(0, 60);   /* 兜底防极端长文卡顿；预算截断在更早处生效 */
  }

  /* 每模板的候选选择器表 —— 全部来自真机实证，不做猜测 */
  var SPEC = {
    T1: {  /* 旧版博客：postwrapper.box.wid700 + block.[type] + selfinfo */
      cover: ['.postwrapper .block.photo .content img', '.postwrapper .block .content img'],
      avatar: ['.selfinfo .logo img', '.selfinfo img'],
      name: ['.selfinfo h1'],
      /* 2026-10-06 真机探针（两轮实证）：.tags 容器在该主题**不存在**（tagsBox 空），
         a[href*="/tag/"] 才是真实命中路径——视频帖 10 tag 全中，.content 内 3 个 a 是
         @提及用户链接（不含 /tag/ 不误收）、评论区「查看更多」在 notes 容器内不混入。
         故把语义候选提到首位；.tags 容器留作其他主题兜底；裸选择器兜旧版页。 */
      tags: ['.postwrapper a[href*="/tag/"]', '.postwrapper .tags a', 'a[href*="/tag/"]'],
      body: ['.postwrapper .block .content'],
      dateText: ['.postwrapper .date', '.postwrapper .meta .date'],
      day: ['.postwrapper .side .day'], month: ['.postwrapper .side .month']
    },
    T2: {  /* 新版博客：g-doc/g-bd 三栏 + m-post + m-hdimg */
      cover: ['.m-post .ctc img', '.m-post .postinner img'],
      avatar: ['.m-hdimg img'],
      name: ['h1.m-ttl', '.g-sd h1'],
      tags: ['.m-post .tags a', '.tags.box a', '.tags a'],
      body: ['.m-post .ctc'],
      dateText: ['.meta.box a.date', '.info-2 .meta a.date', 'a.date']
    },
    T3: {  /* 长文章 / 专栏：g-bd > img.banner + m-cnt + long-text */
      cover: ['img#banner', 'img.banner'],
      avatar: ['.m-cnt .info img.ava', '.post .author img.avatar'],
      name: ['.m-cnt .info a.name', '.post .author a.name'],
      subtitle: ['.nav-desc'],
      tags: ['.tag-wrapper a'],
      body: ['.long-text'],
      dateText: ['.m-cnt .info span.time', '.info.f-cb span.time']
    },
    T4: {  /* 官方内容容器组件 m-postdtl（awake999 / 199518wqx / lofguancha 三页实测均存在）：
              g-doc > g-sd(m-hdimg + h1.m-ttl，侧栏与 T2 同构) + g-mn > m-postdtl。
              注意 .pic 只用来**取封面**，不再当类型判据——类型一律走内容事实（见 §2 注释）。 */
      cover: ['.m-postdtl .pic img', '.m-postdtl .ctc img'],
      avatar: ['.m-hdimg img'],                    /* 侧栏组件与 T2 共享（真机互证） */
      name: ['h1.m-ttl'],
      tags: ['.m-postdtl .tags a', '.m-postdtl a[href*="/tag/"]'],   /* 第二候选为通用语义，本页样本无标签未实证 */
      body: ['.m-postdtl .ctc'],
      dateText: ['.m-postdtl a.date', '.m-postdtl .dtinner a.date', 'a.date']
    }
  };

  /* ================= 3. 字段提取 ================= */

  function normDate(raw, dayTxt, monthTxt) {
    /* 旧版博客：只有月/日，DOM 无年份 */
    if (dayTxt && monthTxt) {
      var mm0 = pad2(String(monthTxt).replace(/\D+/g, '').replace(/^0+/, ''));
      var dd0 = pad2(String(dayTxt).replace(/\D+/g, '').replace(/^0+/, ''));
      return { text: mm0 + '-' + dd0, hasYear: false };
    }
    var s = String(raw || '').replace(/^时间\s*[:：]\s*/, '').trim();
    var m = s.match(/(\d{4})\s*[-年/.]\s*(\d{1,2})\s*[-月/.]\s*(\d{1,2})/);
    if (m) return { text: m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]), hasYear: true };
    var m2 = s.match(/(\d{1,2})\s*[-月/.]\s*(\d{1,2})/);
    if (m2) return { text: pad2(m2[1]) + '-' + pad2(m2[2]), hasYear: false };
    return { text: s, hasYear: false };
  }

  /* 卡片上的日期显示（与字段提取分离）：
     有年份 → ISO「2026-09-29」；无年份 → 自然读法「3月10日」。
     无年份不是缺陷标注场景——T1 旧版默认模板 DOM 里就只有月/日（两轮探针实证：
     无 meta / 无 alternate / 全文无带年份日期），官方 app 有 API 才有全日期，
     网页端读不到就按人类写法显示；「(缺年份)」括号仍保留在字段核对表 warnings 里。 */
  function dateLabel(f) {
    if (!f.date) return '';
    if (f.dateHasYear) return f.date;
    var m = f.date.match(/^(\d{1,2})-(\d{1,2})$/);
    return m ? (parseInt(m[1], 10) + '月' + parseInt(m[2], 10) + '日') : f.date;
  }

  /* ================= 3.5 归档补年份（T1 默认模板缺年份专用） =================
   * 背景：T1 默认模板 DOM 只有「月/日」（两轮探针实证：无 meta / 无 alternate /
   *   全文无带年份日期），而卡片上「9月30日」缺年份读起来是残缺的。
   *
   * 2026-10-06 命令行实证出的官方接口（**无需登录、无需滚动归档页、无需 iframe**）：
   *   POST {origin}/dwr/call/plaincall/ArchiveBean.getArchivePostByTime.dwr
   *   body（★ 必须换行分隔）：
   *     c0-scriptName=ArchiveBean / c0-methodName=getArchivePostByTime / c0-id=0
   *     c0-param0=boolean:false      （无影响）
   *     c0-param1=number:<blogId>
   *     c0-param2=number:<cursor>    （毫秒时间戳：只回 **早于** 它的帖子，按时间倒序）
   *     c0-param3=number:<count>     （实测可传 500：一次回整站归档）
   *     c0-param4=boolean:false      （无影响）
   *   返回每条含：id / year / month(**0 基**，3 月是 2) / dayOfMonth / time /
   *   values.permalink（slug，可二次校验）。
   *
   * 三条硬约束（curl 多组对照实测，全部会踩）：
   *   ① 请求体必须**换行分隔**；压成单行 → HTTP 200 但
   *      "The specified call count is not a number"（这正是 v6 探针「重放失败」的真凶：
   *      cut() 把 body 压成单行后回发，接口其实是好的）
   *   ② 必须带 **User-Agent**：不带 → 200 但 0 字节
   *   ③ 必须带 **Referer**：只要"存在"即可（连 example.com 都放行），空 → 200 但 0 字节
   *   → 浏览器**同源 fetch 天然满足 ②③**（UA/Referer 自动带），所以扩展里直接
   *     fetch(location.origin + …) 即可，无需 background 中继、无需 iframe。
   *     ⚠ 跨域不行：该接口**不回 Access-Control-Allow-Origin**，且 MV3 content
   *     script 无 CORS 豁免 → 必须用**当前页自身 origin**（帖子页在哪个域就用哪个域，
   *     每个 lofter 域下都有这个端点，接口本身按 blogId 参数化）。
   *
   * slug 编码（已验证 0x1F5E843D = 526287933 = blogId）：URL 的
   *   /post/<blogId 十六进制>_<postId 十六进制>
   * → 用 postId 与返回记录的 id 精确匹配，零歧义（permalink 再做一次校验）。
   *
   * 策略：拿 DOM 的「月/日」当锚做**年份二分**（每年 1 次请求、count=50、载荷小，
   *   ~5 次封顶）；锚不可靠时退回 count=500 线性翻页兜底。
   * 缓存：内存（本次会话）+ sessionStorage（跨刷新），key 按 blogId 分桶。
   * ========================================================================= */
  var ARCH_PATH = '/dwr/call/plaincall/ArchiveBean.getArchivePostByTime.dwr';
  var ARCH = { origin: '', pages: {}, memo: {}, calls: 0, lastErr: '' };

  function archOrigin() {
    if (ARCH.origin) return ARCH.origin;
    var o = (typeof location !== 'undefined' && location.origin) || '';
    return /^https?:/.test(o) ? o : 'https://www.lofter.com';
  }

  /* /post/1f5e843d_2b4f907a3 → { blogId, postId, slug }（十六进制 → 十进制） */
  function slugOf(permalink) {
    var m = String(permalink || '').match(/\/post\/([0-9a-f]+)_([0-9a-f]+)/i);
    if (!m) return null;
    var b = parseInt(m[1], 16), p = parseInt(m[2], 16);
    if (!b || !p) return null;
    return { blogId: b, postId: p, slug: m[1] + '_' + m[2] };
  }

  /* DWR 回复 → 记录数组。
     引号感知的分号分词：DWR 把**首条记录**和一长串 `var sN={};` 声明挤在同一行
     （`var s0={};var s50={};…;s0.blogId=…`），若按行 + /^s\d+\./ 匹配会静默
     丢掉每页最新一条（实测每页 50 → 49，目标帖刚好落在被丢的那条上，白排查半天）。 */
  function archParse(text) {
    var objs = Object.create(null);
    var buf = '', inStr = false, i;
    function flush() {
      var st = buf; buf = '';
      var m = /^\s*s(\d+)\.([\w$]+)=([\s\S]*)$/.exec(st);
      if (!m) return;
      var v = m[3];
      if (v.charAt(0) === '"') { try { v = JSON.parse(v); } catch (e) { v = v.slice(1, -1); } }
      var o = objs[m[1]] || (objs[m[1]] = {});
      o[m[2]] = v;
    }
    for (i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (inStr) {
        buf += c;
        if (c === '\\') { buf += text.charAt(++i); continue; }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; buf += c; continue; }
      if (c === ';') { flush(); continue; }
      buf += c;
    }
    flush();
    /* 二遍：把 `s0.values=s2` 这类**标识符交叉引用**换成对象本身。
       DWR 用变量名做引用（不是 JSON 内联），不解析引用的话 values 会是一串
       字符串「s2」，permalink 就永远拿不到。真实回复里只有对象引用会长成
       /^s\d+$/，permalink 等业务字符串不会（故可安全按此模式解析）。 */
    Object.keys(objs).forEach(function (k) {
      var o = objs[k];
      Object.keys(o).forEach(function (p) {
        if (typeof o[p] === 'string' && /^s\d+$/.test(o[p])) {
          var ref = objs[o[p].slice(1)];   /* objs 的键是纯数字（s2 → '2'） */
          if (ref) o[p] = ref;
        }
      });
    });
    var out = [];
    Object.keys(objs).forEach(function (k) {   /* 整数键升序 = 接口原序（新→旧） */
      var o = objs[k];
      /* 记录 = 同时有 id/year/time 的实体；嵌套对象（values）只有
         imgurl/permalink/noticeLinkTitle，不会误收 */
      if (o.id !== undefined && o.year !== undefined && o.time !== undefined) out.push(o);
    });
    return out;
  }

  function archPick(recs, postId) {
    for (var i = 0; i < recs.length; i++) {
      if (Number(recs[i].id) === postId && Number(recs[i].year)) {
        var r = recs[i];
        return {
          y: Number(r.year), m: Number(r.month) + 1, d: Number(r.dayOfMonth),
          time: Number(r.time),
          permalink: (r.values && r.values.permalink) || ''
        };
      }
    }
    return null;
  }

  function archFetch(blogId, cursor, count) {
    var key = blogId + '@' + cursor + '@' + count;
    if (ARCH.pages[key]) return Promise.resolve(ARCH.pages[key]);
    var lines = [
      'callCount=1',
      'scriptSessionId=' + Date.now() + '187',
      'httpSessionId=',
      'c0-scriptName=ArchiveBean',
      'c0-methodName=getArchivePostByTime',
      'c0-id=0',
      'c0-param0=boolean:false',
      'c0-param1=number:' + blogId,
      'c0-param2=number:' + cursor,
      'c0-param3=number:' + count,
      'c0-param4=boolean:false',
      'batchId=' + (Date.now() % 100000000)
    ];
    ARCH.calls++;
    return Promise.resolve()
      .then(function () {
        return fetch(archOrigin() + ARCH_PATH, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'text/plain' },
          body: lines.join('\n')   /* ★ 必须换行分隔，见上方 ① */
        });
      })
      .then(function (r) {
        if (!r.ok) throw new Error('归档接口 HTTP ' + r.status);
        return r.text();
      })
      .then(function (t) {
        var be = /_remoteHandleBatchException\(\{\s*name:'[^']*',\s*message:'([^']*)'/.exec(t);
        if (be) throw new Error('归档接口拒绝：' + be[1]);
        if (!t) throw new Error('归档接口回空（缺 UA/Referer 的反爬门槛）');
        var recs = archParse(t);
        ARCH.pages[key] = recs;
        return recs;
      });
  }

  /* 年份二分：以 DOM 的 (月,日) 为锚。cutoff = 该年当日 23:59:59.999。
   *   帖就在该年 → 它是「cutoff 之前最新的一条」→ 必在页内 → 命中
   *   页内 id 全 > 目标 → 目标更老 → 往小年
   *   页内 id 全 < 目标 → 目标更新 → 往大年
   * 判据单调，二分成立。返回命中或 null（不中则交兜底）。 */
  function archBinSearch(blogId, postId, M, D) {
    var lo = 2005, hi = new Date().getFullYear(), guard = 0;
    function probe(y) {
      var cutoff = Date.UTC(y, M - 1, D) + 86400000 - 1;
      return archFetch(blogId, cutoff, 50).then(function (recs) {
        if (!recs.length) return { dir: 1 };        /* 该时刻前无内容 → 更老 */
        var hit = archPick(recs, postId);
        if (hit) return { hit: hit };
        var ids = recs.map(function (r) { return Number(r.id); });
        var min = Math.min.apply(null, ids), max = Math.max.apply(null, ids);
        if (min > postId) return { dir: -1 };
        if (max < postId) return { dir: 1 };
        return { dir: 0 };                          /* id 夹住却没命中：锚不可靠 */
      });
    }
    function step() {
      if (lo > hi || guard++ > 12) return Promise.resolve(null);
      var mid = (lo + hi) >> 1;
      return probe(mid).then(function (r) {
        if (r.hit) return r.hit;
        if (r.dir === 0) return null;
        if (r.dir < 0) hi = mid - 1; else lo = mid + 1;
        return step();
      });
    }
    return step();
  }

  /* 兜底：从「现在」按 count=500 线性翻页（大博客也能覆盖，最多 24 页 = 1.2 万篇） */
  function archPageWalk(blogId, postId) {
    var cursor = Date.now(), guard = 0;
    function step() {
      if (guard++ > 24) return Promise.resolve(null);
      return archFetch(blogId, cursor, 500).then(function (recs) {
        if (!recs.length) return null;
        var hit = archPick(recs, postId);
        if (hit) return hit;
        var oldest = Math.min.apply(null, recs.map(function (r) { return Number(r.time); }));
        if (!(oldest < cursor)) return null;
        cursor = oldest;
        return step();
      });
    }
    return step();
  }

  function archMemoLoad(blogId) {
    if (ARCH.memo[blogId]) return ARCH.memo[blogId];
    var m = {};
    try { m = JSON.parse(sessionStorage.getItem('lc-share-year-' + blogId) || '{}') || {}; }
    catch (e) { m = {}; }
    return (ARCH.memo[blogId] = m);
  }
  function archMemoSave(blogId, memo) {
    try { sessionStorage.setItem('lc-share-year-' + blogId, JSON.stringify(memo)); } catch (e) {}
  }

  /* 对外主入口：permalink + DOM 的「M-D」→ { y,m,d,time,permalink } */
  function archLookup(permalink, mmdd) {
    var sl = slugOf(permalink);
    if (!sl) return Promise.reject(new Error('URL 里没有 /post/<blogId>_<postId>'));
    var memo = archMemoLoad(sl.blogId);
    if (memo[sl.postId]) return Promise.resolve(memo[sl.postId]);
    var md = /^(\d{1,2})-(\d{1,2})$/.exec(String(mmdd || ''));
    var head = md
      ? archBinSearch(sl.blogId, sl.postId, parseInt(md[1], 10), parseInt(md[2], 10))
      : Promise.resolve(null);
    return head
      .then(function (hit) { return hit || archPageWalk(sl.blogId, sl.postId); })
      .then(function (hit) {
        if (!hit) throw new Error('归档里没有该帖（可能已删/私密/不在归档）');
        memo[sl.postId] = hit;
        archMemoSave(sl.blogId, memo);
        return hit;
      });
  }

  /* 同步预填：本次会话（或上次刷新）已经查过该帖 → 立刻补上，不闪一下「无年份」，
   * 也让「字段核对表」这类同步出口读到补好的日期。 */
  function yearFromMemo(f) {
    var sl = slugOf(f && f.permalink);
    if (!sl) return false;
    var hit = archMemoLoad(sl.blogId)[sl.postId];
    if (!hit || !hit.y) return false;
    f.date = hit.y + '-' + pad2(hit.m) + '-' + pad2(hit.d);
    f.dateHasYear = true;
    f.yearFrom = 'archive';
    f.src.date = '归档接口（会话缓存）← slug ' + sl.slug;
    f.warnings = f.warnings.filter(function (w) { return !/日期无年份/.test(w); });
    return true;
  }

  /* 把年份写回字段（只在缺年份时调用） */
  function fillYear(f) {
    if (!f || f.dateHasYear) return Promise.resolve(false);
    if (!/^\d{1,2}-\d{1,2}$/.test(String(f.date || ''))) return Promise.resolve(false);
    f.yearState = 'loading';
    return archLookup(f.permalink, f.date)
      .then(function (hit) {
        f.date = hit.y + '-' + pad2(hit.m) + '-' + pad2(hit.d);
        f.dateHasYear = true;
        f.yearFrom = 'archive';
        f.src.date = '归档接口 ArchiveBean.getArchivePostByTime（' + ARCH.calls +
          ' 次请求）← slug ' + slugOf(f.permalink).slug;
        if (hit.permalink && hit.permalink !== slugOf(f.permalink).slug) {
          f.warnings.push('归档 permalink 与当前页不一致（' + hit.permalink + '）');
        }
        f.warnings = f.warnings.filter(function (w) { return !/日期无年份/.test(w); });
        f.yearState = 'ok';
        return true;
      })
      .catch(function (e) {
        f.yearState = 'fail';
        ARCH.lastErr = (e && e.message) || String(e);
        f.warnings.push('补年份失败：' + ARCH.lastErr);
        return false;
      });
  }

  function excerptOf(root) {
    if (!root) return '';
    var ps = root.querySelectorAll('p');
    for (var i = 0; i < ps.length; i++) {
      var t = txt(ps[i]);
      if (t && t.length >= 8 && !ps[i].querySelector('img')) return t.slice(0, 240);
    }
    var t2 = txt(root);
    return t2 && t2.length >= 8 ? t2.slice(0, 240) : '';
  }

  function extract() {
    var tpl = pageTemplate();
    var facts = contentFacts();
    var kind = postKind(tpl, facts);
    var sp = SPEC[tpl] || SPEC.T2;
    var f = { tpl: tpl, kind: kind, facts: facts, src: {}, warnings: [] };
    f.src.kind = '内容事实：' + kindNote(facts) + ' ← ' + facts.rootSel;

    /* --- 内容流概要（流式版式原料；明细见 state.flow） --- */
    var flow = contentFlow(), fp = 0, fi = 0;
    for (var fi2 = 0; fi2 < flow.length; fi2++) flow[fi2].t === 'p' ? fp++ : fi++;
    f.flow = { p: fp, img: fi };
    f.flowFirst = flow.length ? flow[0].t : '';
    f.src.flow = flow.length + ' 块（段 ' + fp + ' / 图 ' + fi + '，首块 ' + (f.flowFirst || '空') + '）← ' + facts.rootSel;

    /* --- permalink：canonical 三模板全无（真机实证）→ 用 location 本身。
           官方自己的分享二维码也是这么生成的（img#qrcode 的 url 参数逐字相同）。 --- */
    f.permalink = location.origin + location.pathname;
    f.src.permalink = 'location.origin + pathname';

    /* --- docTitle = "{文章标题}-{博客名}"（T1/T2 双样本实证）--- */
    var dt = String(document.title || '');
    /* ① 解码：LOFTER 的 <title> 里可能带实体（textarea 内容属 RCDATA：塞
     * innerHTML 不解析标签、只解码实体，取 value 即纯文本）。
     * ② 折叠空白：docTitle 里可能夹生 \\n（站点从正文拼接时带进来的）
     * 与 U+00A0（\\s 覆盖），统一成普通空格。
     * ③ 剪断尾实体——**LOFTER 的页面标题是从正文切出来的**（真机+digest
     * 复现 2026-10-06）：帖无标题时取「正文去标签、不解码实体」的前 15 个
     * 字符，正好把 `&nbsp;` 拦腰砍成 `&n`（<title> 里就是字面 &amp;n）。
     * 这不是解码漏了，是上游截断；只剪「确实是已知实体名的前缀」的尾巴，
     * 真实标题里的 `&W`（如 A&W）不动。 */
    var _tt = document.createElement('textarea');
    _tt.innerHTML = dt;
    dt = _tt.value.replace(/\s+/g, ' ').trim();
    var docTitle = '', blogName = '';
    var k = dt.lastIndexOf('-');
    if (k > 0) { docTitle = dt.slice(0, k).trim(); blogName = dt.slice(k + 1).trim(); }
    /* 断尾实体剪在拆分之后：截断发生在标题段内，「&n」后面还跟着「-博客名」，
     * 对整个 dt 做尾部匹配会漏。 */
    docTitle = trimBrokenEntity(docTitle);

    /* --- 标题 --- */
    if (tpl === 'T3') {
      var t3 = pickText(['#title', '.m-cnt .title']);
      f.title = t3.text; f.src.title = t3.sel || '(未命中)';
    } else if (docTitle) {
      f.title = docTitle; f.src.title = 'docTitle 去"-博客名"后缀';
    } else {
      var th = pickText(['.postwrapper .block .main a', '.m-post h2', 'h2 a']);
      f.title = th.text; f.src.title = th.sel || '(未命中)';
    }

    /* --- 作者名：h1 = 博客显示名（T1/T2 双重实证）--- */
    var nm = pickText(sp.name);
    f.authorName = nm.text || blogName;
    f.src.authorName = nm.sel ? nm.sel + (blogName ? '（与 docTitle 后缀互证）' : '') :
      (blogName ? 'docTitle 后缀' : '(未命中)');

    /* --- 头像 --- */
    var av = pickImg(sp.avatar);
    f.avatar = av.url; f.src.avatar = av.sel || '(未命中)';

    /* --- 日期 --- */
    var dTxt = pickText(sp.dateText);
    var dayT = sp.day ? pickText(sp.day).text : '';
    var monT = sp.month ? pickText(sp.month).text : '';
    var d = normDate(dTxt.text, dayT, monT);
    f.date = d.text; f.dateHasYear = d.hasYear;
    f.yearFrom = d.hasYear ? 'dom' : '';   /* 'dom' | 'archive'（见 §3.5） */
    f.src.date = dayT && monT ? (sp.day[0] + ' + ' + sp.month[0] + '（无年份）') : (dTxt.sel || '(未命中)');
    if (!d.hasYear && d.text) {
      /* 会话里已查过就同步补上；否则标警告，等 openPanel 的异步补齐（§3.5）覆盖 */
      if (!yearFromMemo(f)) f.warnings.push('日期无年份（源页面 DOM 就没有）');
    }

    /* --- 封面：模板候选 → og:image → 正文首图 --- */
    var cv = pickImg(sp.cover);
    f.cover = cv.url; f.src.cover = cv.sel || '';
    if (!f.cover) {
      var og = one('meta[property="og:image"]');
      if (og) { f.cover = absUrl(og.getAttribute('content')); f.src.cover = 'og:image'; }
    }
    var root = articleRoot();
    if (!f.cover && root) {
      var im = root.querySelector('img');
      var u = imgSrc(im);
      if (u) { f.cover = u; f.src.cover = '正文首图（兜底）'; }
    }
    /* 全未知主题的最后一道安全网：内容图专域扫描（imglfN），保证 A 版式永远有图可画 */
    if (!f.cover) {
      var ci = contentImg();
      if (ci) { f.cover = absUrl(ci.getAttribute('src')); f.src.cover = '内容图域兜底（imglfN.lf127.net）'; }
    }
    /* --- 视频帖：封面优先级最高取 video[poster]（真机实证）--- */
    if (f.kind === 'video') {
      f.video = videoInfo();
      if (f.video && f.video.poster) {
        f.cover = f.video.poster;
        f.src.cover = '视频封面 video[poster]';
      }
      f.src.kind += ' ｜ 视频帖：封面走 poster + 播放角标';
    }
    if (!f.cover) f.src.cover = '(无封面 → 降级主题色块)';

    /* --- 摘要 / 副标题 --- */
    var sub = sp.subtitle ? pickText(sp.subtitle) : { text: '', sel: '' };
    f.subtitle = sub.text;
    /* 摘要必须只扫正文容器，不能扫整个文章（否则会吃到评论/推荐位——第一轮踩过 .desc） */
    var bodyPick = pickOne(sp.body);
    f.excerpt = excerptOf(bodyPick ? bodyPick.el : root);
    f.src.excerpt = f.excerpt ? ('正文首段 ← ' + (bodyPick ? bodyPick.sel : '(整页兜底)')) : '(无)';
    if (!f.excerpt && f.subtitle) { f.excerpt = f.subtitle.slice(0, 240); f.src.excerpt = '副标题兜底'; }

    /* --- 无标题帖（2026-10-06 真机实锤）：帖没填标题时 LOFTER 用
     *     「正文去标签前 15 字」生成页面标题 → docTitle 派生的 f.title
     *     必是正文的截断前缀。判定：f.title 是正文段落串的前缀。
     *     处理（作者拍板）：首行 ≤24 字 → 升为大标题，正文区放余段
     *     （流式版式同步跳过首段）；首行过长 → 不显示大标题，正文区放全文。
     *     有标题帖 docTitle 是真标题，不是正文前缀 → 不受影响。 --- */
    var paras = [];
    for (var pi3 = 0; pi3 < flow.length; pi3++) if (flow[pi3].t === 'p') paras.push(flow[pi3].text);
    var joinedP = paras.join(' ');
    if (f.title && joinedP && joinedP.indexOf(f.title) === 0 && paras.length) {
      var p0 = paras[0];
      if (p0.length <= 24) {
        f.title = p0;
        f.src.title = '正文首行升大标题（无标题帖：docTitle 是正文截断）';
        f.excerpt = paras.slice(1).join(' ').slice(0, 240);
        f.src.excerpt = paras.length > 1 ? '正文余段（首行已升标题）' : '(首行即全部正文，正文区留空)';
        f.flowSkipFirst = true;
        f.warnings.push('无标题帖：正文首行已升为大标题');
      } else {
        f.title = '';
        f.src.title = '无标题帖：首行超 24 字不上标题（正文区放全文）';
      }
    }

    /* --- 标签 --- */
    var tg = pickList(sp.tags);
    /* tag 全显示（chips 折行）；20 只作极端长标签的兜底上限。
     * 文本清洗：真机 tag <a> 里混着图标字符「●」（LOFTER 模板内置 bullet），
     * textContent 会带上 → chips 显示成「#● tag名」；剥掉首部图标/空白 */
    f.tags = tg.list.map(function (t) {
      return String(t).replace(/^[\s●•·◦○▪◦*＊]+/, '');
    }).filter(function (t) { return t; }).slice(0, 20);
    f.src.tags = tg.sel || '(无)';

    if (!f.title) f.warnings.push('标题为空');
    if (f.kind === 'video') f.warnings.push('视频帖：封面取 poster + 播放角标（静态图，不播视频）');
    /* 安全网：正文一个字都没有、但我们确实拿得到封面 → 图片帖。
       防「图片挂在 CSS 背景上、DOM 里没有 imglfN <img>」的主题被判成文字帖而丢掉 A 版式。 */
    if (f.kind === 'text' && facts.textLen === 0 && f.cover) {
      f.kind = 'photo';
      f.src.kind += ' ｜ 安全网：无正文文字 + 有封面 → 图片帖';
      f.warnings.push('类型经安全网改判为图片帖（无正文文字 + 有封面）');
    }

    state.fields = f;
    return f;
  }

  /* ================= 4. 绘图工具 ================= */

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function setFont(ctx, weight, size, family) {
    ctx.font = weight + ' ' + size + 'px ' + (family || FONT);
  }

  /* 折行：先全量折，再按行数截断并加省略号 */
  function wrapAll(ctx, text, maxW) {
    text = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!text) return [];
    var lines = [], cur = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i), test = cur + ch;
      if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = ch; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function wrapText(ctx, text, maxW, maxLines) {
    var lines = wrapAll(ctx, text, maxW);
    if (lines.length <= maxLines) return lines;
    lines = lines.slice(0, maxLines);
    var last = lines[maxLines - 1];
    while (last.length > 0 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
    return lines;
  }
  function drawLines(ctx, lines, x, y, lh) {
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + i * lh);
    return y + lines.length * lh;
  }

  /* cover 语义：铺满 + 居中裁切 */
  function coverDraw(ctx, img, x, y, w, h) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return false;
    var s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
    return true;
  }

  function circleDraw(ctx, img, cx, cy, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    coverDraw(ctx, img, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  function letterAvatar(ctx, cx, cy, r, name, color) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    var ch = String(name || '').replace(/^\s+/, '').charAt(0) || '?';
    ctx.fillStyle = '#fff';
    setFont(ctx, '700', Math.round(r * 1.02));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, cx, cy + Math.round(r * 0.04));
    ctx.restore();
  }

  /* 二维码：整数模块边长，避免抗锯齿出现灰缝；白底即静默区。
     opts: { right, bottom, size, fg, bg, radius } —— 以右下角为锚点 */
  function drawQR(ctx, url, opts) {
    opts = opts || {};
    var size = opts.size || 200;
    var qr = QR(0, 'M');
    qr.addData(url);
    qr.make();
    var n = qr.getModuleCount();
    var px = Math.max(2, Math.floor(size / n));
    var real = px * n;
    var quiet = Math.max(4 * px, Math.round(real * 0.14));
    var box = real + quiet * 2;
    var x = opts.right - box, y = opts.bottom - box;

    ctx.save();
    if (opts.radius !== 0) {
      roundRect(ctx, x, y, box, box, opts.radius || 20);
      ctx.fillStyle = opts.bg || '#ffffff'; ctx.fill();
    } else {
      ctx.fillStyle = opts.bg || '#ffffff'; ctx.fillRect(x, y, box, box);
    }
    ctx.fillStyle = opts.fg || '#191919';
    var ox = x + quiet, oy = y + quiet;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(ox + c * px, oy + r * px, px, px);
      }
    }
    ctx.restore();
    return { x: x, y: y, box: box };
  }

  /* 图片中继：background 代抓并回 base64 dataURL。
   * 为什么需要：**avaimg 头像域不回 ACAO**（命令行实证），content script 直连取不到
   * 像素（canvas 污染 → toBlob 抛 SecurityError）。SW 里 fetch→FileReader→dataURL，
   * content 侧把 dataURL 当同源图用即可。SW 无 DOM，拿不到 blob URL，只能回字符串。 */
  function relayImg(url) {
    return new Promise(function (resolve) {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return resolve(null);
      try {
        chrome.runtime.sendMessage({ action: 'lcFetchImage', url: url }, function (res) {
          if (chrome.runtime.lastError || !res || !res.ok || !res.dataUrl) return resolve(null);
          var im = new Image();
          im.onload = function () { resolve(im); };
          im.onerror = function () { resolve(null); };
          im.src = res.dataUrl;
        });
      } catch (e) { resolve(null); }
    });
  }

  function loadImg(url) {
    return new Promise(function (resolve) {
      if (!url) return resolve(null);
      var im = new Image();
      im.crossOrigin = 'anonymous';   /* 必须：否则污染 canvas，toBlob 会抛 SecurityError */
      var done = false;
      var fin = function (v) { if (!done) { done = true; resolve(v); } };
      var t = setTimeout(function () { fin(null); }, 9000);
      im.onload = function () { clearTimeout(t); fin(im); };
      /* 直连失败（CORS / 网络）→ 走 background 中继再试一次；中继也失败才降级 */
      im.onerror = function () { clearTimeout(t); relayImg(url).then(fin); };
      im.src = url;
    });
  }

  /* ================= 5. 两套版式 ================= */

  /* A —— 封面海报：封面满幅 + 下方纸色信息区（作者块 + 二维码）。
     二维码不压封面：官方 app 三种形态的分享图都把二维码固定在底部品牌栏（长按扫码），从不叠在内容图上 */
  /* tag chips（2026-10-06 作者拍板：对齐官方分享图——tag 以灰底圆角
   * pill 排在作者昵称下方，不再挤 meta 行）。**tag 全显示**：单行装不下就折行，
   * 不再折成「+N」（2026-10-06 二轮对齐：官方图 5 个 tag 一排排开；
   * 三轮撤掉 A 版 3 行兜底——A 已自适应高度，LOFTER 单篇上限 20 tag，
   * 全部折行显示 + 高度自适应兜住，+N 分支保留为 maxLines 防御路径但三版式都不再传）。
   * 在 footer 的 textBaseline='middle' 语境里调用（pill 内文字垂直居中）。 */
  var CHIP_H = 44, CHIP_PITCH = 54, CHIP_GAP = 14;

  function chipFont(ctx) { setFont(ctx, '500', 26); }

  /* 纯布局（可测量）：返回 { lines:[[item,…],…], overflow, h } */
  function chipLayout(ctx, tags, availW, maxLines) {
    chipFont(ctx);
    var items = tags.map(function (t) {
      var s = (String(t).charAt(0) === '#') ? String(t) : '#' + t;
      return { s: s, w: ctx.measureText(s).width + 44 };
    });
    var lines = [], cur = [], w = 0, i, need, lineW, last;
    for (i = 0; i < items.length; i++) {
      need = items[i].w + (cur.length ? CHIP_GAP : 0);
      if (cur.length && w + need > availW) { lines.push(cur); cur = []; w = 0; need = items[i].w; }
      cur.push(items[i]); w += need;
    }
    if (cur.length) lines.push(cur);

    var overflow = 0;
    if (maxLines && lines.length > maxLines) {
      for (i = maxLines - 1; i < lines.length; i++) overflow += lines[i].length;
      lines = lines.slice(0, maxLines);
      /* +N chip 自己也要放得下：放不下就回收末位 chip 腾位（旧走查实锤：
       * 5 个 tag 溢出时 +1 连同自己一起消失） */
      last = lines[maxLines - 1];
      var mw = ctx.measureText('+' + overflow).width + 44;
      lineW = 0;
      for (i = 0; i < last.length; i++) lineW += last[i].w + (i ? CHIP_GAP : 0);
      while (last.length && lineW + CHIP_GAP + mw > availW) {
        var cut = last.pop();
        overflow++;
        lineW -= cut.w + (last.length ? CHIP_GAP : 0);
        mw = ctx.measureText('+' + overflow).width + 44;
      }
    }
    return { lines: lines, overflow: overflow, h: lines.length ? (lines.length - 1) * CHIP_PITCH + CHIP_H : 0 };
  }

  function drawChips(ctx, tags, leftX, topY, availW, maxLines) {
    var lay = chipLayout(ctx, tags, availW, maxLines);
    var r, i, cx, line, ty;
    for (r = 0; r < lay.lines.length; r++) {
      cx = leftX; line = lay.lines[r]; ty = topY + r * CHIP_PITCH;
      for (i = 0; i < line.length; i++) {
        ctx.fillStyle = PAL.line; roundRect(ctx, cx, ty, line[i].w, CHIP_H, CHIP_H / 2); ctx.fill();
        ctx.fillStyle = PAL.sub; ctx.fillText(line[i].s, cx + 22, ty + CHIP_H / 2);
        cx += line[i].w + CHIP_GAP;
      }
      if (lay.overflow && r === lay.lines.length - 1) {
        var more = '+' + lay.overflow;
        var mw = ctx.measureText(more).width + 44;
        ctx.fillStyle = PAL.line; roundRect(ctx, cx, ty, mw, CHIP_H, CHIP_H / 2); ctx.fill();
        ctx.fillStyle = PAL.faint; ctx.fillText(more, cx + 22, ty + CHIP_H / 2);
      }
    }
    return lay;
  }

  /* A —— 封面海报：封面满幅 + 纸色信息区（日期 / 标题 / 正文片段 / 作者+二维码+tag）。
     2026-10-06 二轮对齐（作者要求）：① A 也要放一点正文 ② tag 全显示（折行）
     → 画布高度由固定 1440 改为自适应（下限仍是 1440，短内容保住海报体量）。
     measureOnly=true 只算高不落笔（ctx 仅用 measureText / 不画）。 */
  /* 视频帖角标（2026-10-06 真机探针后加）：封面正中播放圆标 + 右下角时长 pill，
     对齐官方分享图语言（不播视频，只作「这是视频作品」的视觉标记）。 */
  function durationLabel(sec) {
    if (!sec || !isFinite(sec)) return '';
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    if (s === 60) { m++; s = 0; }
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function drawPlayBadge(ctx, cx, cy, r) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    var t = r * 0.46;
    ctx.beginPath();
    ctx.moveTo(cx - t * 0.55, cy - t);
    ctx.lineTo(cx + t * 0.88, cy);
    ctx.lineTo(cx - t * 0.55, cy + t);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawDurPill(ctx, text, right, bottom) {
    if (!text) return;
    ctx.save();
    setFont(ctx, '600', 26);
    var w = ctx.measureText(text).width + 32, h = 40;
    var px = right - w, py = bottom - h;
    ctx.fillStyle = 'rgba(0,0,0,.52)';
    roundRect(ctx, px, py, w, h, h / 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, px + w / 2, py + h / 2 + 1);
    ctx.restore();
  }

  function drawA(ctx, f, imgs, measureOnly) {
    var coverH = 820;
    var x = 72, maxW = W - x * 2;

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    /* --- 先量后画：标题 / 正文片段 / chips 的占位（measure 趟只走这里） --- */
    var titleLines = [];
    if (f.title) { setFont(ctx, '700', 64); titleLines = wrapText(ctx, f.title, maxW, 2); }
    var bodyLines = [];
    if (f.excerpt) { setFont(ctx, '400', 30); bodyLines = wrapText(ctx, f.excerpt, maxW, 3); }

    var TITLE_TOP = 190;                       /* 标题首行基线（相对 coverH） */
    var afterTitle = titleLines.length ? (coverH + TITLE_TOP + (titleLines.length - 1) * 82)
      : (coverH + 92);
    var bodyTop = afterTitle + (titleLines.length ? 66 : 58);
    var bodyBottom = bodyLines.length ? (bodyTop + (bodyLines.length - 1) * 52) : bodyTop;

    var qX = W - x - 176;                      /* 二维码左缘（footer 右对齐同 A/B/F） */
    var chipLay = f.tags.length ? chipLayout(ctx, f.tags, qX - 24 - (x + 84), 0) : null;
    /* chips 锚在二维码中心下方 48px，二维码又锚在下边距 96——chips 行高超过 112
     * （= 半个二维码 88 + 间隙 48 - 24 边距）就会画进下边距、多行整行出画布
     * （真机 B 版 4 行 tag 只见 3 行，本地 12tag 夹具与 10tag 输出逐像素相同实锤）。
     * 修法：超出部分把 footer 整体（连同下边距）抬高。 */
    var chipsExtra = chipLay ? Math.max(0, chipLay.h - 112) : 0;

    /* 纸色区高度：正文底 + 空隙 + 二维码 block（176 + 底边距 96）+ chips 超行抬升 */
    var needWhite = (bodyBottom - coverH) + 60 + 176 + 96 + chipsExtra;
    var H2 = coverH + Math.max(620 + chipsExtra, needWhite);

    if (measureOnly) return { h: H2 };

    /* --- 封面上半部 --- */
    if (imgs.cover && coverDraw(ctx, imgs.cover, 0, 0, W, coverH)) {
      var g = ctx.createLinearGradient(0, coverH - 260, 0, coverH);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,.45)');
      ctx.fillStyle = g; ctx.fillRect(0, coverH - 260, W, 260);
    } else {
      /* 无封面 → 主题色渐变块（绝不让整张卡失败） */
      var g2 = ctx.createLinearGradient(0, 0, W, coverH);
      g2.addColorStop(0, PAL.accent);
      g2.addColorStop(1, '#2b2320');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, coverH);
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      setFont(ctx, '700', 120);
      ctx.fillText(KIND_LABEL[f.kind], 72, coverH - 96);
      state.note = '无封面 → 主题色块';
    }

    /* 视频帖：封面正中播放角标 + 右下角时长（官方分享图同语言） */
    if (f.kind === 'video') {
      drawPlayBadge(ctx, W / 2, coverH / 2, 78);
      drawDurPill(ctx, durationLabel(f.video && f.video.dur), W - 40, coverH - 36);
    }

    /* 纸色信息区 */
    ctx.fillStyle = PAL.paper; ctx.fillRect(0, coverH, W, H2 - coverH);

    /* 顶部强调色短横（2026-10-06 对齐：与 B/流式头部同语言） */
    ctx.fillStyle = PAL.accent;
    roundRect(ctx, x, coverH + 48, 88, 8, 4); ctx.fill();

    /* 日期（tag 改排 footer chips 后 meta 只剩日期） */
    var meta = [];
    if (f.date) meta.push(dateLabel(f));
    ctx.fillStyle = PAL.sub;
    setFont(ctx, '500', 30);
    ctx.fillText(meta.join('   ·   '), x, coverH + 92);

    /* 标题（海报式最多 2 行；无标题帖首行超阈值时 f.title 为空 → 整块跳过，不画占位） */
    if (titleLines.length) {
      ctx.fillStyle = PAL.ink;
      setFont(ctx, '700', 64);
      drawLines(ctx, titleLines, x, coverH + TITLE_TOP, 82);
    }

    /* 正文片段（2026-10-06 作者要求：A 也放一点正文；最多 3 行，长文不抢版面） */
    if (bodyLines.length) {
      ctx.fillStyle = PAL.sub;
      setFont(ctx, '400', 30);
      for (var bl = 0; bl < bodyLines.length; bl++) ctx.fillText(bodyLines[bl], x, bodyTop + bl * 52);
    }

    /* 底部：作者块（左，两行堆叠——首版昵称与链接同基线左右分布，任一过长即重叠，真机走查抓到）+ 二维码（右），与 B 版式同构 */
    var q = drawQR(ctx, f.permalink, { right: W - x, bottom: H2 - 96 - chipsExtra, size: 176, radius: 16 });
    var ay = q.y + q.box / 2;
    ctx.textBaseline = 'middle';
    if (imgs.avatar) circleDraw(ctx, imgs.avatar, x + 32, ay, 32);
    else letterAvatar(ctx, x + 32, ay, 32, f.authorName, PAL.accent);
    ctx.fillStyle = PAL.ink;
    setFont(ctx, '600', 34);
    ctx.fillText(f.authorName || '(未署名)', x + 84, ay - 16);

    ctx.fillStyle = PAL.faint;
    setFont(ctx, '400', 24);
    ctx.fillText(f.permalink.replace(/^https?:\/\//, '').slice(0, 42), x + 84, ay + 22);

    /* tag chips：作者块正下方（官方分享图同位），折行显示全部（A 已自适应高度，
     * 不再限 3 行——真机视频帖 10 tag 实测 3 行后折成 +5，作者要求显示全） */
    if (chipLay) drawChips(ctx, f.tags, x + 84, ay + 48, qX - 24 - (x + 84), 0);
    ctx.textBaseline = 'alphabetic';
    return { h: H2 };
  }

  /* B —— 纸感文字卡：无图依赖，任何文章都不会翻车。
     2026-10-06 对齐：固定 1440px 高 → 测量趟自适应（下限 B_MIN_H，与流式 FLOW_MIN_H 同值）——
     短文时中段大片死留白是真机走查点名的「旧感」主因；头部结构本就与流式同构，不动。 */
  var B_MIN_H = 1200;

  function bPaint(ctx, f, imgs, measureOnly) {
    var x = 96, maxW = W - x * 2;
    var y, meta = [], li, lines;

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    /* 顶部强调色短横 */
    y = 96;
    if (!measureOnly) { ctx.fillStyle = PAL.accent; roundRect(ctx, x, y, 88, 8, 4); ctx.fill(); }
    y += 64;

    /* 日期（tag 改排 footer chips） */
    if (f.date) meta.push(dateLabel(f));
    if (!measureOnly) { ctx.fillStyle = PAL.sub; setFont(ctx, '500', 30); ctx.fillText(meta.join('   ·   '), x, y); }
    y += 98;   /* 2026-10-06 二轮：80 → 98，标题与年月日再空开一点（仍明显近于分隔线侧） */

    /* 标题（无标题帖首行超阈值 → f.title 空串 → 整块跳过，不画占位） */
    if (!measureOnly) ctx.fillStyle = PAL.ink;
    setFont(ctx, '700', 68);
    lines = f.title ? wrapText(ctx, f.title, maxW, 4) : [];
    for (li = 0; li < lines.length; li++) {
      if (!measureOnly) ctx.fillText(lines[li], x, y);
      y += 94;
    }

    /* 细分隔线 */
    y += 46;
    if (!measureOnly) { ctx.fillStyle = PAL.line; ctx.fillRect(x, y, maxW, 2); }
    y += 62;

    /* 正文片段（2026-10-06 二轮：7 → 10 行，正文长的帖子多放一点；B 画布自适应不怕长） */
    if (f.excerpt) {
      setFont(ctx, '400', 34);
      lines = wrapText(ctx, f.excerpt, maxW, 10);
      if (!measureOnly) ctx.fillStyle = PAL.sub;
      for (li = 0; li < lines.length; li++) {
        if (!measureOnly) ctx.fillText(lines[li], x, y);
        y += 56;
      }
    }
    /* 副标题画在摘要块下方（首版与摘要同 y 会叠字，真机走查抓到） */
    if (f.subtitle && f.subtitle !== f.excerpt) {
      setFont(ctx, '400', 28);
      lines = wrapText(ctx, '—— ' + f.subtitle, maxW, 1);
      if (!measureOnly) { ctx.fillStyle = PAL.faint; ctx.fillText(lines[0] || '', x, y + 44); }
      y += 84;
    }

    /* footer：作者行（左） + 二维码（右，同基线），与 A/流式同构。
       chips 折行占高要算进画布（tag 显示全 → 可能一至多行） */
    y += 56;
    var qX = W - x - 176;
    var chipLay = f.tags.length ? chipLayout(ctx, f.tags, qX - 24 - (x + 84), 0) : null;
    /* 同 A：chips 挂在二维码中心下方，行高超出 112 的部分整段抬高 footer（含下边距），
     * 否则第 3 行起裁底、第 4 行起整行出画布（真机 10 tag 只见 8 实锤） */
    var chipsExtra = chipLay ? Math.max(0, chipLay.h - 112) : 0;
    var total = Math.max(B_MIN_H + chipsExtra, Math.ceil(y + 176 + 96 + chipsExtra));
    if (!measureOnly) {
      var q = drawQR(ctx, f.permalink, { right: W - x, bottom: total - 96 - chipsExtra, size: 176, radius: 16 });

      var ay = q.y + q.box / 2;
      ctx.textBaseline = 'middle';
      if (imgs.avatar) circleDraw(ctx, imgs.avatar, x + 32, ay, 32);
      else letterAvatar(ctx, x + 32, ay, 32, f.authorName, PAL.accent);
      ctx.fillStyle = PAL.ink;
      setFont(ctx, '600', 34);
      ctx.fillText(f.authorName || '(未署名)', x + 84, ay - 16);

      ctx.fillStyle = PAL.faint;
      setFont(ctx, '400', 24);
      ctx.fillText(f.permalink.replace(/^https?:\/\//, '').slice(0, 42), x + 84, ay + 22);
      if (chipLay) drawChips(ctx, f.tags, x + 84, ay + 48, qX - 24 - (x + 84), 0);

      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    return { h: total };
  }

  /* ================= 5b. 流式版式（自动判定默认；2026-10-05 与作者拍板） =================
   * 官方式长图：内容流按原文顺序（图在顶 / 图文夹排由内容自然决定），高度预算 4000px，
   * 超出 → 「打开 LOFTER 浏览更多精彩」截断条（上缘渐隐，文案同官方 app）。
   * 多图 = 官方式顺排（作者拍板，不做「共X张」角标）；单图显示高上限 1600px，超出居中裁剪。 */
  var FLOW_BUDGET = 4000;    /* 内容区高度预算（标题之后） */
  var FLOW_IMG_MAX_H = 1600; /* 单图显示高度上限，超出居中裁剪 */
  var FLOW_MIN_H = 1200;     /* 画布最小高（内容少时保卡面体面） */
  var FLOW_MAX_IMGS = 6;     /* 预载图上限（预算 4000 内通常用不满 6 张全宽图） */

  /* 一体化 measure/draw：measureOnly=true 只算高度不落笔（ctx 只用 measureText）。
     返回 { h: 画布总高, truncated: 是否截断 }。绘制时假定画布已按该高度建好、纸色已铺。 */
  function flowPaint(ctx, f, imgs, flowImgs, measureOnly) {
    var flow = state.flow || (state.flow = contentFlow());
    var x = 96, maxW = W - x * 2;
    var y, meta = [], titleLines, li, lines, n;

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    /* --- 头部：短横 + 日期·标签 + 标题 + 分隔线（与 B 版式同构） --- */
    y = 96;
    if (!measureOnly) { ctx.fillStyle = PAL.accent; roundRect(ctx, x, y, 88, 8, 4); ctx.fill(); }
    y += 64;
    if (f.date) meta.push(dateLabel(f));
    if (!measureOnly) { ctx.fillStyle = PAL.sub; setFont(ctx, '500', 30); ctx.fillText(meta.join('   ·   '), x, y); }
    y += 98;   /* 2026-10-06 二轮：80 → 98（与 B 同构，标题与年月日再空开一点） */
    if (!measureOnly) ctx.fillStyle = PAL.ink;
    setFont(ctx, '700', 68);
    titleLines = f.title ? wrapText(ctx, f.title, maxW, 4) : [];
    for (li = 0; li < titleLines.length; li++) {
      if (!measureOnly) ctx.fillText(titleLines[li], x, y);
      y += 94;
    }
    y += 46;
    if (!measureOnly) { ctx.fillStyle = PAL.line; ctx.fillRect(x, y, maxW, 2); }
    y += 56;

    /* --- 内容流 --- */
    var budget = y + FLOW_BUDGET;
    var truncated = false, imgIdx = 0, bi, b;
    /* 无标题帖首行已升大标题 → 正文流跳过首个文本段（f.flowSkipFirst） */
    var skipFirstP = f.flowSkipFirst ? 1 : 0;

    for (bi = 0; bi < flow.length; bi++) {
      b = flow[bi];
      if (b.t === 'img') {
        if (imgIdx >= FLOW_MAX_IMGS) { truncated = true; break; }   /* 预载额度用完 → 截断 */
        var im = flowImgs[imgIdx] || null;
        imgIdx++;
        var dh = 0, cropped = false;
        if (im && im.naturalWidth && im.naturalHeight) {
          dh = Math.round(maxW * im.naturalHeight / im.naturalWidth);
          if (dh > FLOW_IMG_MAX_H) { dh = FLOW_IMG_MAX_H; cropped = true; }  /* 居中裁剪 */
        } else if (imgIdx <= FLOW_MAX_IMGS) {
          dh = 300;   /* 加载失败占位（保卡面不塌） */
        }
        if (!dh) continue;
        if (y + dh > budget) { truncated = true; break; }
        if (!measureOnly) {
          if (im) {
            coverDraw(ctx, im, x, y, maxW, dh);
            if (cropped) {                        /* 裁剪底缘渐隐，示意「下面还有」 */
              var gf = ctx.createLinearGradient(0, y + dh - 120, 0, y + dh);
              gf.addColorStop(0, 'rgba(253,250,246,0)');
              gf.addColorStop(1, 'rgba(253,250,246,.85)');
              ctx.fillStyle = gf; ctx.fillRect(x, y + dh - 120, maxW, 120);
            }
            if (b.video) {                        /* 视频帖：封面帧叠播放角标 + 时长 */
              drawPlayBadge(ctx, x + maxW / 2, y + dh / 2, 72);
              drawDurPill(ctx, durationLabel(f.video && f.video.dur), x + maxW - 28, y + dh - 28);
            }
          } else {
            ctx.fillStyle = PAL.line; roundRect(ctx, x, y, maxW, dh, 12); ctx.fill();
            ctx.fillStyle = PAL.faint; setFont(ctx, '500', 28); ctx.textAlign = 'center';
            ctx.fillText('图片未能加载（demo 无后台中继）', W / 2, y + dh / 2);
            ctx.textAlign = 'left';
          }
        }
        y += dh + 64;   /* 2026-10-06 二轮：40 → 64，图与后文再空开一点 */
      } else {
        if (skipFirstP) { skipFirstP--; continue; }
        setFont(ctx, '400', 34);
        lines = wrapAll(ctx, b.text, maxW);
        n = 0;
        while (n < lines.length && y + (n + 1) * 56 <= budget) n++;
        if (n < lines.length) {                   /* 按行截断，末行加省略号 */
          if (n > 0) lines[n - 1] = lines[n - 1].replace(/…$/, '') + '…';
          truncated = true;
        }
        if (!measureOnly) {
          ctx.fillStyle = PAL.sub;
          for (li = 0; li < n; li++) ctx.fillText(lines[li], x, y + li * 56);
        }
        y += n * 56;
        if (truncated) break;
        y += 28;                                  /* 段间距（截断时不需要） */
      }
    }

    /* --- 截断条（上缘渐隐 + 官方文案） --- */
    if (truncated) {
      if (!measureOnly) {
        var g = ctx.createLinearGradient(0, y - 150, 0, y);
        g.addColorStop(0, 'rgba(253,250,246,0)');
        g.addColorStop(1, 'rgba(253,250,246,1)');
        ctx.fillStyle = g; ctx.fillRect(0, y - 150, W, 150);
        ctx.fillStyle = PAL.faint; setFont(ctx, '600', 36); ctx.textAlign = 'center';
        ctx.fillText('打开 LOFTER 浏览更多精彩', W / 2, y + 42);
        ctx.textAlign = 'left';
        state.note = '内容超出高度预算（' + FLOW_BUDGET + 'px）→ 已截断';
      }
      y += 110;
    }

    /* --- footer：作者块（左） + 二维码（右），与 A/B 同构；chips 折行占高计入画布 --- */
    y += 56;
    var qX = W - x - 176;
    var chipLay = f.tags.length ? chipLayout(ctx, f.tags, qX - 24 - (x + 84), 0) : null;
    /* 同 A/B：chips 超行部分整段抬高 footer（含下边距），防裁底/整行出画布 */
    var chipsExtra = chipLay ? Math.max(0, chipLay.h - 112) : 0;
    var total = Math.max(FLOW_MIN_H + chipsExtra, Math.ceil(y + 176 + 96 + chipsExtra));
    if (!measureOnly) {
      var q = drawQR(ctx, f.permalink, { right: W - x, bottom: total - 96 - chipsExtra, size: 176, radius: 16 });
      var ay = q.y + q.box / 2;
      ctx.textBaseline = 'middle';
      if (imgs.avatar) circleDraw(ctx, imgs.avatar, x + 32, ay, 32);
      else letterAvatar(ctx, x + 32, ay, 32, f.authorName, PAL.accent);
      ctx.fillStyle = PAL.ink; setFont(ctx, '600', 34);
      ctx.fillText(f.authorName || '(未署名)', x + 84, ay - 16);
      ctx.fillStyle = PAL.faint; setFont(ctx, '400', 24);
      ctx.fillText(f.permalink.replace(/^https?:\/\//, '').slice(0, 42), x + 84, ay + 22);
      if (chipLay) drawChips(ctx, f.tags, x + 84, ay + 48, qX - 24 - (x + 84), 0);
      ctx.textBaseline = 'alphabetic';
    }
    return { h: total, truncated: truncated };
  }

  function resolveMode(f) {
    if (state.mode !== 'auto') return state.mode;
    /* 视频帖 → A 海报（封面帧 + 播放角标，官方分享图形态）；其余自动 = 流式 */
    if (f && f.kind === 'video') return 'A';
    return 'F';   /* 自动 = 流式（2026-10-05 拍板）；A/B 保留为手动选项 */
  }

  /* ================= 6. 渲染（异步：等字体 + 等图） ================= */

  function render() {
    var f = state.fields || extract();
    state.note = '';
    var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();

    /* 流式：预载内容流前 N 张图（预算 4000px 通常用不满） */
    var flowSrcs = [];
    if (resolveMode(f) === 'F') {
      var fl = state.flow || (state.flow = contentFlow());
      for (var i = 0; i < fl.length && flowSrcs.length < FLOW_MAX_IMGS; i++) {
        if (fl[i].t === 'img') flowSrcs.push(fl[i].src);
      }
    }

    return Promise.all([fonts, loadImg(f.cover), loadImg(f.avatar)].concat(flowSrcs.map(loadImg))).then(function (r) {
      state.coverImg = r[1];
      state.avatarImg = r[2];
      state.avatarFailed = !!(f.avatar && !r[2]);
      var flowImgs = r.slice(3);

      var cv = state.canvas;
      var ctx = cv.getContext('2d');
      if (!ctx) { console.warn(TAG + ' 当前环境无 canvas 2d（jsdom 自检时属正常）'); return cv; }

      var mode = resolveMode(f);
      var H2 = H;
      if (mode === 'F') {
        /* 测量趟：先算总高 → 建画布 → 铺纸色 → 绘制趟 */
        var m = flowPaint(ctx, f, { avatar: r[2] }, flowImgs, true);
        H2 = m.h;
        state.truncated = m.truncated;
      } else if (mode === 'B') {
        /* B 同款两趟：自适应高度（固定高 → 短文死留白，2026-10-06 对齐改掉） */
        H2 = bPaint(ctx, f, { avatar: r[2] }, true).h;
        state.truncated = false;
      } else {
        /* A 同款两趟：加入正文片段 + tag 折行后高度也自适应（下限 1440 保海报体量） */
        H2 = drawA(ctx, f, { cover: r[1], avatar: r[2] }, true).h;
        state.truncated = false;
      }
      cv.width = W; cv.height = H2;
      ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, W, H2);

      if (mode === 'F') {
        ctx.fillStyle = PAL.paper; ctx.fillRect(0, 0, W, H2);
        flowPaint(ctx, f, { avatar: r[2] }, flowImgs, false);
      } else if (mode === 'B') {
        ctx.fillStyle = PAL.paper; ctx.fillRect(0, 0, W, H2);
        bPaint(ctx, f, { avatar: r[2] }, false);
      } else if (mode === 'A') drawA(ctx, f, { cover: r[1], avatar: r[2] }, false);

      if (state.avatarFailed) {
        console.warn(TAG + ' 头像 CORS 失败（avaimg.lf127.net 不回 ACAO）→ 已降级首字头像；' +
          '正式版走 background 中继可拿到真头像');
      }
      syncPanel();
      return cv;
    });
  }

  /* ================= 7. 预览面板 ================= */

  var CSS = [
    '#lcsd-fab{position:fixed;right:20px;bottom:96px;z-index:2147483000;',
      'background:#2b2b31;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:999px;',
      'padding:10px 16px;font:600 13px/1 -apple-system,"Microsoft YaHei",sans-serif;cursor:pointer;',
      'box-shadow:0 6px 20px rgba(0,0,0,.28);user-select:none;}',
    '#lcsd-fab:hover{background:#3a3a42;}',
    /* 形态②：专栏文章右侧竖条（官方按钮条在跨域 iframe 里）——父页在竖条末端叠的同款竖钮。
       25×60 / 半透明深底，与 iframe 内官方钮（boprtXX）视觉同族；hover 加亮。 */
    /* 形态②：专栏竖条侧钮（同源时钮体照抄最后一枚官方 li 的 rect：宽 25、左对齐）。
     * 文案「分享图」用 writing-mode 竖排（一列一字，与官方「分享」竖排同语言）；
     * 高度不钉死——3 字竖排比官方 2 字 li（25×60）长，height:auto + padding 自撑；
     * 圆角 3px 对齐官方扁平滑面（真机反馈 6px 太圆润）。
     * 底色透明度 .62（2026-10-07 真机：长文页侧钮 .78 仍偏实，作者要求再压一档——
     * 长文页右侧是正文，钮要尽量退到背景里；hover .74 / 暗色 .62·.82 同步跟上）。 */
    '#lcsd-side,#lcsd-side-md{position:fixed;z-index:2147482998;background:rgba(43,43,49,.62);',
      'color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:3px;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;text-align:center;',
      'writing-mode:vertical-rl;text-orientation:upright;letter-spacing:2px;',
      'font:600 12px/1 -apple-system,"Microsoft YaHei",sans-serif;user-select:none;',
      'padding:9px 0;min-height:60px;box-shadow:0 4px 14px rgba(0,0,0,.24);}',
    '#lcsd-side:hover,#lcsd-side-md:hover{background:rgba(58,58,66,.74);}',
    /* 形态④b：跨域时的并排钮（分享图 + 导出.md 两枚**独立**钮，各自成丸、中间留缝——
       作者 2026-10-07 反馈「双格挤成一丸」）。尺寸对齐官方项（帧内样式表 .boprt 项高
       23px——2026-10-07 作者 DevTools 实证），扁平无描边（官方钮的圆角底是雪碧图，
       复刻不了就别加戏）；底透明度 .78 对齐官方（真机：.9 比官方钮实，官方更透）。 */
    '#lcsd-bar-frame,#lcsd-bar-frame-md{position:fixed;z-index:2147482997;padding:0 9px;',
      'background:rgba(43,43,49,.78);color:#fff;border-radius:3px;cursor:pointer;',
      'font:500 12px/23px -apple-system,"Microsoft YaHei",sans-serif;user-select:none;white-space:nowrap;}',
    '#lcsd-bar-frame:hover,#lcsd-bar-frame-md:hover{background:rgba(58,58,66,.85);}',
    /* 暗色皮肤（applyDarkSkin 挂 lcsc-dark 类）：官方条的反白是 control 帧自己的暗色管线
       body{filter:invert} 干的（父页没被反色）→ 帧内官方钮暗色下变白底黑字，
       挨着它的钮必须跟随，否则两个模式里总有一个突兀（2026-10-07 真机反馈）。
       ⚠ 四枚钮一个不能漏：曾漏 lcsd-side-md（真机「长文页导出.md 没跟白底黑字」实锤）。 */
    '#lcsd-bar-frame.lcsc-dark,#lcsd-bar-frame-md.lcsc-dark{background:rgba(255,255,255,.78);color:#000;}',
    '#lcsd-side.lcsc-dark,#lcsd-side-md.lcsc-dark{background:rgba(255,255,255,.62);color:#000;}',
    '#lcsd-bar-frame.lcsc-dark:hover,#lcsd-bar-frame-md.lcsc-dark:hover{background:rgba(255,255,255,.92);}',
    '#lcsd-side.lcsc-dark:hover,#lcsd-side-md.lcsc-dark:hover{background:rgba(255,255,255,.82);}',
    /* 轻提示（导出完成/失败；比 toast 简版，只为入口点击反馈） */
    '#lcsd-toast{position:fixed;z-index:2147483003;left:50%;bottom:70px;transform:translateX(-50%);',
      'padding:8px 16px;border-radius:8px;font-size:13px;background:rgba(43,43,49,.95);color:#fff;',
      'box-shadow:0 4px 14px rgba(0,0,0,.3);pointer-events:none;white-space:nowrap;}',
    /* 形态①：注入官方右上按钮条（#control.boprt ul）的 li——复刻官方 <a><em> 结构，
       只在官方那条 12px 无底色风格上做最小适配（hover 微亮，不抢官方按钮视觉）。 */
    '#control .lcsd-bar-btn,#control.boprt .lcsd-bar-btn{display:block;padding:0 10px;height:23px;',
      'line-height:23px;color:inherit;font-size:12px;white-space:nowrap;text-decoration:none;',
      'opacity:.85;cursor:pointer;}',
    '#control .lcsd-bar-btn em,#control.boprt .lcsd-bar-btn em{font-style:normal;}',
    '#control .lcsd-bar-btn:hover{opacity:1;text-decoration:underline;}',
    '#lcsd-mask{position:fixed;inset:0;z-index:2147483001;background:rgba(12,12,14,.62);backdrop-filter:blur(3px);}',
    '#lcsd-panel{position:fixed;z-index:2147483002;left:50%;top:50%;transform:translate(-50%,-50%);',
      'width:min(92vw,560px);max-height:92vh;overflow:auto;background:#1b1c20;color:#e9e9ee;',
      'border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.55);',
      'padding:16px;font-family:-apple-system,"Microsoft YaHei",sans-serif;}',
    '#lcsd-panel,#lcsd-panel *{box-sizing:border-box;margin:0;padding:0;line-height:1.5;}',
    '#lcsd-panel .lcsd-hd{display:flex;align-items:center;gap:10px;margin-bottom:12px;}',
    '#lcsd-panel .lcsd-ttl{font-weight:700;font-size:15px;}',
    '#lcsd-panel .lcsd-kind{font-size:12px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.1);}',
    /* 叉号三重加固（2026-10-07 真机：暗色下变暗看不清——疑被暗色管线的元素级
       filter/按钮规则命中，浅色 ✕ 被反成暗色）：白字 !important + 禁元素级滤镜。 */
    '#lcsd-panel .lcsd-x{margin-left:auto;cursor:pointer;width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#fff !important;-webkit-text-fill-color:#fff !important;filter:none !important;font-size:13px;}',
    '#lcsd-panel .lcsd-tabs{display:flex;gap:6px;margin-bottom:12px;}',
    '#lcsd-panel .lcsd-tabs button{flex:1;cursor:pointer;padding:8px 6px;font-size:12px;border-radius:10px;',
      'border:1px solid rgba(255,255,255,.14);background:transparent;color:#c9c9d2;}',
    '#lcsd-panel .lcsd-tabs button.on{background:#e9e9ee;color:#1b1c20;border-color:#e9e9ee;font-weight:700;}',
    '#lcsd-panel .lcsd-stage{background:#3a3a42;border-radius:12px;padding:10px;margin-bottom:12px;',
      'max-height:64vh;overflow:auto;}',
    /* 画布默认「整图适应」：不出现滚动条，长图一眼看全貌（max-width/max-height 同时约束时
       浏览器按替换元素规则等比缩放）；切「实际大小」加 .act → 100% 宽 + 容器内滚动看细节 */
    '#lcsd-panel .lcsd-stage canvas{max-width:100%;max-height:calc(64vh - 20px);width:auto;height:auto;display:block;margin:0 auto;border-radius:8px;}',
    '#lcsd-panel .lcsd-stage.act canvas{width:100%;height:auto;max-height:none;}',
    /* 细滚动条（仅在需要滚动时出现；WebKit + Firefox 双写） */
    '#lcsd-panel,#lcsd-panel .lcsd-stage{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent;}',
    '#lcsd-panel::-webkit-scrollbar,#lcsd-panel .lcsd-stage::-webkit-scrollbar{width:10px;height:10px;}',
    '#lcsd-panel::-webkit-scrollbar-track,#lcsd-panel .lcsd-stage::-webkit-scrollbar-track{background:transparent;}',
    '#lcsd-panel::-webkit-scrollbar-thumb,#lcsd-panel .lcsd-stage::-webkit-scrollbar-thumb{',
      'background:rgba(255,255,255,.18);border-radius:999px;border:2px solid transparent;background-clip:content-box;}',
    '#lcsd-panel::-webkit-scrollbar-thumb:hover,#lcsd-panel .lcsd-stage::-webkit-scrollbar-thumb:hover{',
      'background:rgba(255,255,255,.34);background-clip:content-box;}',
    '#lcsd-panel .lcsd-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}',
    '#lcsd-panel .lcsd-tools button{cursor:pointer;padding:8px 14px;font-size:12px;font-weight:600;border-radius:10px;',
      'border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e9e9ee;}',
    '#lcsd-panel .lcsd-tools button:hover{background:rgba(255,255,255,.14);}',
    '#lcsd-panel .lcsd-tools label{font-size:12px;color:#c9c9d2;display:flex;align-items:center;gap:6px;}',
    '#lcsd-panel input[type=color]{width:34px;height:26px;border:1px solid rgba(255,255,255,.2);border-radius:6px;background:transparent;cursor:pointer;}',
    '#lcsd-panel .lcsd-note{font-size:11px;color:#f0c674;margin-top:10px;}',
    '#lcsd-panel pre{display:none;margin-top:12px;max-height:32vh;overflow:auto;font:11px/1.6 ui-monospace,Consolas,monospace;',
      'background:#101114;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;white-space:pre-wrap;word-break:break-all;color:#b9c7d6;}',
    '#lcsd-panel pre.on{display:block;}'
  ].join('');

  /* 样式表必须**入口挂载时**就位（2026-10-07 真机实锤）：原先只在 buildPanel() 里注入，
   * 于是首次打开面板前 FAB 是无样式裸 div —— 以文档流形态躺在页面左下角，点一下（开面板）
   * 才突然变成右下角黑色药丸。demo 手贴时同样存在，只是没暴露。 */
  function ensureStyle() {
    if (document.getElementById('lcsd-style')) return;
    var style = document.createElement('style');
    style.id = 'lcsd-style';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function buildPanel() {
    ensureStyle();
    var mask = document.createElement('div');
    mask.id = 'lcsd-mask';
    mask.addEventListener('click', closePanel);

    var panel = document.createElement('div');
    panel.id = 'lcsd-panel';
    panel.innerHTML = [
      '<div class="lcsd-hd"><span class="lcsd-ttl">生成分享图</span>',
        '<span class="lcsd-kind" id="lcsd-kind"></span>',
        '<button class="lcsd-x" id="lcsd-x" title="关闭">✕</button></div>',
      '<div class="lcsd-tabs">',
        '<button data-m="auto">自动判定</button>',
        '<button data-m="A">A 封面海报</button>',
        '<button data-m="B">B 纸感文字卡</button></div>',
      '<div class="lcsd-stage"><canvas id="lcsd-canvas"></canvas></div>',
      '<div class="lcsd-tools">',
        '<label>强调色 <input type="color" id="lcsd-color" value="' + PAL.accent + '"></label>',
        '<button id="lcsd-zoom">实际大小</button>',
        '<button id="lcsd-dl">下载 PNG</button>',
        '<button id="lcsd-copy">复制到剪贴板</button>',
        '<button id="lcsd-fields-btn">字段核对</button></div>',
      '<div class="lcsd-note" id="lcsd-note"></div>',
      '<pre id="lcsd-fields-pre"></pre>'
    ].join('');
    document.body.appendChild(mask);
    document.body.appendChild(panel);

    state.canvas = panel.querySelector('#lcsd-canvas');
    var xbtn = panel.querySelector('#lcsd-x');
    /* 内联 !important 级禁滤镜：防暗色管线事后给按钮叠元素级 invert（样式表的
       !important 可能被管线的内联 !important 压过，内联对内联我们后写者胜） */
    xbtn.style.setProperty('filter', 'none', 'important');
    xbtn.addEventListener('click', closePanel);
    panel.querySelectorAll('.lcsd-tabs button').forEach(function (b) {
      b.addEventListener('click', function () { state.mode = b.getAttribute('data-m'); render(); });
    });
    panel.querySelector('#lcsd-color').addEventListener('input', function (e) {
      PAL.accent = e.target.value; render();
    });
    panel.querySelector('#lcsd-dl').addEventListener('click', download);
    panel.querySelector('#lcsd-copy').addEventListener('click', copyPng);
    /* 预览缩放切换：适应窗口（默认，整图无滚动条） ↔ 实际大小（100% 宽，容器内滚动看细节） */
    panel.querySelector('#lcsd-zoom').addEventListener('click', function () {
      var stage = panel.querySelector('.lcsd-stage');
      var act = stage.classList.toggle('act');
      this.textContent = act ? '适应窗口' : '实际大小';
      state.zoomActual = act;
      stage.scrollTop = 0;
    });
    panel.querySelector('#lcsd-fields-btn').addEventListener('click', function () {
      var pre = panel.querySelector('#lcsd-fields-pre');
      pre.classList.toggle('on');
      pre.textContent = fieldsReport();
      console.log(TAG + ' 字段核对\n' + fieldsReport());
    });
  }

  function syncPanel() {
    var panel = document.getElementById('lcsd-panel');
    if (!panel || !state.fields) return;
    var f = state.fields;
    panel.querySelector('#lcsd-kind').textContent =
      f.tpl + ' · ' + (KIND_LABEL[f.kind] || f.kind) + ' · 版式 ' + (MODE_LABEL[resolveMode(f)] || resolveMode(f));
    panel.querySelectorAll('.lcsd-tabs button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-m') === state.mode);
    });
    var note = panel.querySelector('#lcsd-note');
    var notes = [];
    if (state.note) notes.push(state.note);
    if (state.avatarFailed) notes.push('头像 CORS 失败（avaimg 域不回 ACAO）→ 已用首字头像；正式版中继后为真头像');
    if (f.warnings.length) notes.push(f.warnings.join('；'));
    note.textContent = notes.join(' ｜ ');
    note.style.display = notes.length ? 'block' : 'none';
  }

  function fieldsReport() {
    var f = state.fields;
    if (!f) return '(尚未提取)';
    var rows = [
      ['模板', f.tpl], ['类型', KIND_LABEL[f.kind] || f.kind], ['版式(自动)', resolveMode(f)],
      ['内容事实', f.facts ? kindNote(f.facts) + ' ← ' + f.facts.rootSel : '(无)'],
      ['标题', f.title], ['作者', f.authorName], ['头像', f.avatar || '(无)'],
      ['日期', (f.date || '(无)') + (f.dateHasYear ? '' : '  [无年份]') +
        (f.yearFrom === 'archive' ? '  (归档接口补全)' : f.yearFrom === 'dom' ? '  (页面 DOM)' : '')],
      ['封面', f.cover || '(无)'], ['摘要', f.excerpt], ['标签', f.tags.join(' / ') || '(无)'],
      ['文章 URL', f.permalink]
    ];
    var out = rows.map(function (r) { return r[0] + '：' + (r[1] || '(空)'); }).join('\n');
    out += '\n\n— 来源 —\n' + Object.keys(f.src).map(function (k) {
      return k + ' ← ' + (f.src[k] || '(未命中)');
    }).join('\n');
    return out;
  }

  function openPanel() {
    if (!document.getElementById('lcsd-panel')) buildPanel();
    /* i18n（#16）：面板是插件自有容器，构建完接管翻译（后续 render() 改字段
     * 文案由 watcher 跟上）。绝不翻译画布里的分享图内容 —— 那是文章数据。 */
    var pnl = document.getElementById('lcsd-panel');
    if (pnl && typeof LC_I18N !== "undefined") LC_I18N.watch(pnl);
    xprobe();
    state.fields = extract();
    render();
    console.log(TAG + ' 已提取字段\n' + fieldsReport());
    maybeFillYear();
  }

  /* 缺年份（T1）时才打归档接口；成功→重绘卡片并刷新面板提示 */
  function maybeFillYear() {
    var f = state.fields;
    if (!f || f.dateHasYear) return;
    if (f.yearState === 'loading') return;
    state.note = '正在向归档接口核对年份…';
    syncPanel();
    fillYear(f).then(function (ok) {
      if (state.fields !== f) return;
      if (ok) {
        state.note = '年份已补齐 → ' + f.date + '（' + ARCH.calls + ' 次请求）';
        console.log(TAG + ' 年份补齐 → ' + f.date + '（' + ARCH.calls + ' 次请求）');
        render();
      } else {
        state.note = '补年份未成功：' + (ARCH.lastErr || '未知原因');
        console.warn(TAG + ' ' + state.note);
      }
      syncPanel();
    });
  }
  function closePanel() {
    ['lcsd-panel', 'lcsd-mask'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.remove();
    });
    state.canvas = null;
  }

  /* 叉号暗色发黑 · 二轮未断案（2026-10-07：DevTools 显示我们的 #fff !important 在赢、
   * 主文档无 body 级反色、buildCSS/content.js 也无命中面板的规则——证据互相矛盾，
   * 停止盲修第三层保险，按铁律上探针）。每次开面板把叉号的 computed 色彩与**祖先滤镜链**
   * 写进 <html data-lcsd-xprobe>，页面控制台一句 getAttribute 即回传，一次断案。 */
  function xprobe() {
    try {
      var x = document.getElementById('lcsd-x');
      if (!x) return;
      var cs = getComputedStyle(x);
      var chain = [], n = x;
      while (n && n.nodeType === 1 && chain.length < 14) {
        var f = getComputedStyle(n).filter;
        if (f && f !== 'none') {
          var tag = n.id ? '#' + n.id
            : (n.className ? '.' + String(n.className).split(' ')[0] : n.tagName.toLowerCase());
          chain.push(tag + '{' + f + '}');
        }
        n = n.parentElement;
      }
      document.documentElement.setAttribute('data-lcsd-xprobe', JSON.stringify({
        color: cs.color,
        fill: cs.getPropertyValue('-webkit-text-fill-color') || '',
        opacity: cs.opacity, visibility: cs.visibility,
        filters: chain, at: Math.round(performance.now()) + 'ms',
      }));
    } catch (e) { /* 探针绝不影响功能 */ }
  }

  /* ---------- 「导出 .md」并入官方按钮行（作者 2026-10-07 拍板） ----------
   * 提取/拼装实现全部在 lc-export.js（同一隔离世界共享 window.LC_Export API），
   * 这里只负责触发与落盘——不复制导出逻辑，两处行为永远一致。 */
  function lcsdToast(msg) {
    var d = document.createElement('div');
    d.id = 'lcsd-toast';
    d.textContent = (typeof LC_I18N !== "undefined") ? LC_I18N.t(msg) : msg;
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3200);
  }
  function exportMdClick() {
    var api = window.LC_Export;
    if (!api || typeof api.buildMarkdown !== 'function') { lcsdToast('导出模块未就绪，请刷新重试'); return; }
    var out = api.buildMarkdown(document, { dateISO: 'auto' });
    if (!out || !out.markdown) { lcsdToast('本页不是已支持的导出形态'); return; }
    var fname = (typeof api.filenameOf === 'function' && api.filenameOf(out.meta)) || 'lofter-export.md';
    var blob = new Blob([out.markdown], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    lcsdToast('已导出：' + fname);
  }

  /* ================= 8. 输出 ================= */
  function fileName() {
    var t = (state.fields && state.fields.title ? state.fields.title : 'lofter').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
    return 'lofter-share-' + t + '.png';
  }
  function download() {
    if (!state.canvas) return;
    state.canvas.toBlob(function (b) {
      if (!b) { console.error(TAG + ' 导出失败（canvas 可能被污染）'); return; }
      var url = URL.createObjectURL(b);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      console.log(TAG + ' 已导出 ' + fileName());
    }, 'image/png');
  }
  function copyPng() {
    if (!state.canvas) return;
    if (!navigator.clipboard || !window.ClipboardItem) {
      console.warn(TAG + ' 当前环境不支持图片剪贴板，请用「下载 PNG」');
      return;
    }
    state.canvas.toBlob(function (b) {
      if (!b) return;
      navigator.clipboard.write([new ClipboardItem({ 'image/png': b })])
        .then(function () { console.log(TAG + ' 已复制到剪贴板'); })
        .catch(function (e) { console.warn(TAG + ' 复制失败（需要页面处于聚焦状态）', e); });
    }, 'image/png');
  }

  /* ================= 9. 入口（四形态，按真机实证矩阵） =================
   * ① 官方右上按钮条：#control.boprt > ul（T1/T2/T4、博主页；博主自看变体同容器）。
   *    跟随滚动由 LOFTER 自己的 JS 钉（inline top:0），注入 li 白嫖，不自己写 fixed。
   * ④ 文章详情页（2026-10-07 真机 diag 实证）：父文档里**既无 #control 也无 .boprt**，
   *    官方条整体在 iframe #control_frame 内，且该帧是**横向条**
   *    （425×32 @317,0 / block/visible/z1337 / src //www.lofter.com/control?blogId=…&postId=…）。
   *    ④a 帧**同源**（lpost 等页本身在 www.lofter.com）→ 直接往帧内的官方 ul 注 li，
   *       吃 LOFTER 自己的 .boprt 样式（hover/暗色反转自动跟随），观感全原生；
   *    ④b 帧**跨域**（博客子域 /post/… 页）→ 帧真进不去：父页读帧 rect 叠 fixed 并排钮，
   *       条右缘外有空位就叠外侧；条贴视口右缘（真机形态）就 translateX 让官方条
   *       左移让出缝位、钮嵌进缝里。「导出 .md」是**第二枚独立钮**（作者 2026-10-07），
   *       两钮各留 6px 隙、让位平移量按两钮总宽算。
   * ② 专栏文章右侧竖条：同一个 #control_frame，但几何是**窄高的竖条**
   *    （src …&ldetails=1，fixed 30×320 z1337）→ 父页读 rect 在竖条末端叠钮。
   *    ⇒ ② 与 ④ 共用一个宿主，靠**几何分流**：窄高=竖条 / 宽扁贴顶=横条。
   * ③ 都没有 → FAB 兜底。
   * 开关：lc_settings_v1.shareCard.{enabled,entry}；改设置即时生效（storage.onChanged）。 */

  var CFG = { enabled: true, entry: 'auto', dark: 'off', darkSchedule: null, exportMd: false };

  /* 撤销对官方条帧的「让位平移」（入口撤下/开关关闭/卸载/④a 升级时必须还原，否则条停在左移位）。
   * ⚠ 必须全扫：真机一页有两个同 id 帧（空壳在前），getElementById 只认第一个的话，
   * 真条的平移永远没人还原——长文章页④b→④a 升级后整条卡在左移位、被文章卡片盖住
   * 只剩尾巴（真机 2026-10-07「按钮条只剩一点点」实锤）。 */
  function resetFrameShift() {
    var frs = document.querySelectorAll('iframe#control_frame, iframe.control-frame');
    for (var i = 0; i < frs.length; i++) {
      if (frs[i].style.transform) frs[i].style.transform = '';
    }
  }
  /* ④a 的帧内 li / 剥雪碧图样式也要随入口拆掉（li 在 iframe 文档里） */
  function clearFrameLi() {
    if (!frameLiDoc) return;
    try {
      ['lcsd-frame-li', 'lcsd-frame-li-md'].forEach(function (id) {
        var l = frameLiDoc.getElementById(id);
        if (l && l.parentNode) l.parentNode.removeChild(l);
      });
      var s = frameLiDoc.getElementById('lcsd-frame-style');
      if (s && s.parentNode) s.parentNode.removeChild(s);
    } catch (e) { /* 帧已销毁等边界，忽略 */ }
    frameLiDoc = null;
  }
  function clearEntries() {
    resetFrameShift();
    clearFrameLi();
    maskOldExport(false);   /* 本页不归我们管（关开关/非文章页）→ 老入口护盾一并摘掉 */
    ['lcsd-fab', 'lcsd-side', 'lcsd-side-md', 'lcsd-bar-frame', 'lcsd-bar-frame-md',
      'lcsd-bar-li', 'lcsd-bar-li-md'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  /* 只有「文章详情页」才出入口（博主页/首页也带 #control 条，但那不是一篇文章） */
  function articlePage() {
    if (/\/(post|lpost)\//.test(location.pathname)) return true;
    /* 博客主页/主站首页（真机 2026-10-07：自己主页顶条也被挂了分享图——
     * 下面的兜底选择器里有 img#banner，那是**博客横幅**，主页就有） */
    if (location.pathname === '/' || location.pathname === '') return false;
    if (document.querySelector('meta[property="og:type"][content="article"]')) return true;
    return !!one('.postwrapper .block, .m-postdtl, .long-text');
  }

  /* 形态①：注入官方右上按钮条。
   * 候选按优先级扫，**优先取可见的那个**（真机可能有隐藏的同名/旧版条：
   * 页面里同时存在 id="control" 的隐形残留时，querySelector 会命中错的那个）。 */
  function barUl() {
    var sels = ['#control.boprt ul', '#control ul', '.boprt.a-control ul', '.a-control ul', '.boprt ul'];
    var first = null;
    for (var i = 0; i < sels.length; i++) {
      var list = document.querySelectorAll(sels[i]);
      for (var j = 0; j < list.length; j++) {
        if (!first) first = list[j];
        var r = list[j].getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return list[j];
      }
    }
    return first;   /* 无布局信息（jsdom / 条还没渲染尺寸）时退回首个命中 */
  }
  function makeBarBtn(label, title, onClick) {
    var a = document.createElement('a');
    a.href = 'javascript:;';
    a.className = 'lcsd-bar-btn';
    a.title = title;
    var em = document.createElement('em');
    em.textContent = label;
    a.appendChild(em);
    a.addEventListener('click', function (e) { e.preventDefault(); onClick(); });
    return a;
  }
  /* ---------- 「只在**自己**文章详情页出导出 .md」判据（作者 2026-10-07 要求） ----------
   * 三层信号，从严到宽：
   * ① 身份缓存（lc_self_v1）：官方没有可靠的客户端身份全局，DWR 接口名不猜（铁律）——
   *    改用**确定性 DOM 信号**在自然浏览中捕获并缓存自己的 blogName（= 子域前缀）：
   *    · 批量管理页 URL 本身就带 /postmanage/<blogId>（lc-export 真机实证，即子域前缀）
   *    · 自己主页的官方条含「主页设置」（博主专属钮，别人的主页没有）
   *    缓存命中后，任何 *.lofter.com 子域页：hostname 前缀 ≠ 自己 → **确证别人的**。
   *    这补上了跨域 control 帧读不到官方条时的判定空洞（他人文章页 md 误出的根因）。
   * ② 官方按钮条文字：博主自看给「编辑/删除」，看别人的给「举报/投诉」。条可能在
   *    父文档（形态①），也可能在同源可读的 #control_frame 里（形态④a）——两处都扫。
   * ③ 主文档里的作者专属链接兜底（跨域帧页也可能留了「编辑此文」之类）。
   * 全部读不到 → null(未知)，此时**照常显示**（宁可在别人页上多出一枚，也不能在自己的
   * 页上误撤——一旦作者浏览过管理页/自己主页，①就永远兜住了）。 */
  var SELF = { name: '' };                       /* 自己的 blogName（子域前缀，小写） */
  var SELF_KEY = 'lc_self_v1';
  var OWN_RE = /编辑|删除|管理|草稿|修改|主页设置/;   /* 博主自看专属操作 */
  var OTHER_RE = /举报|投诉/;                    /* 只在别人的内容上出现 */
  function officialLabels() {
    var out = null;
    function collect(doc) {
      var uls = doc.querySelectorAll('#control ul, .boprt ul, .a-control ul');
      var got = [];
      for (var i = 0; i < uls.length; i++) {
        var items = uls[i].querySelectorAll('li');
        for (var j = 0; j < items.length; j++) {
          var li = items[j];
          /* 排除我们自己注入的钮，避免自我参照 */
          if (li.id === 'lcsd-bar-li' || li.id === 'lcsd-bar-li-md' ||
              li.id === 'lcsd-frame-li' || li.id === 'lcsd-frame-li-md') continue;
          var em = li.querySelector('em'), a = li.querySelector('a');
          var t = (em && em.textContent) ||
            (a && (a.getAttribute('title') || a.textContent)) || li.textContent || '';
          t = String(t).replace(/\s+/g, '');
          if (t) got.push(t);
        }
      }
      if (got.length) out = (out || []).concat(got);
    }
    try { collect(document); } catch (e) { /* 忽略 */ }
    /* 同名帧可能不止一个（真机实证：空壳 + 真条）——逐个读，读到内容为止 */
    var frs = controlFrames();
    for (var f = 0; f < frs.length; f++) {
      try { var fdoc = frs[f].contentDocument; if (fdoc && fdoc.querySelectorAll) collect(fdoc); }
      catch (e) { /* 跨域 → 读不到 */ }
    }
    return out;
  }
  function selfArticle() {
    /* ① 身份缓存命中 → 子域前缀对比，一步出确定结论（不依赖任何条可读性） */
    if (SELF.name && /^[A-Za-z0-9_-]+\.lofter\.com$/i.test(location.hostname)) {
      return location.hostname.split('.')[0].toLowerCase() === SELF.name;
    }
    var labels = officialLabels();
    if (labels && labels.length) {
      var txt = labels.join('|');
      if (OWN_RE.test(txt)) return true;         /* 有「编辑/删除」→ 必是自己的 */
      if (OTHER_RE.test(txt)) return false;      /* 有「举报/投诉」且无自看钮 → 别人的 */
    }
    /* ③ 主文档里的作者专属链接兜底（跨域帧页也可能留了「编辑此文」之类） */
    try {
      var links = document.querySelectorAll('a[href*="/postmanage/"], a[href*="/edit"], a[href*="/manage/"]');
      for (var i = 0; i < links.length; i++) {
        if (OWN_RE.test(String(links[i].textContent || ''))) return true;
      }
    } catch (e) { /* 忽略 */ }
    /* ④ 跨域帧身份探针结论（probeIdentity 已回传时一步出死判——跨域子域页的
     * 「举报/编辑」DOM 读不到，只能靠帧 URL 同源重取） */
    if (PROBE.verdict !== null) return PROBE.verdict;
    return null;                                  /* 未知 → 不撤（安全侧） */
  }
  /* 导出 .md 是否该出：跟总开关 + 只在确证是别人页面时才撤 */
  function mdAllowed() { return CFG.exportMd && selfArticle() !== false; }
  /* 捕获并缓存自己的 blogName（见上：管理页 URL / 自己主页的「主页设置」钮）。
   * 已缓存即短路——每页只做一次确定性的 DOM 查询，绝不高频跑。 */
  function captureSelf() {
    if (SELF.name) return;
    var name = '';
    var m = /^\/postmanage\/([A-Za-z0-9_-]+)/.exec(location.pathname);
    if (m) name = m[1].toLowerCase();
    if (!name && /^[A-Za-z0-9_-]+\.lofter\.com$/i.test(location.hostname)) {
      var labels = officialLabels();
      if (labels && labels.join('|').indexOf('主页设置') > -1) {
        name = location.hostname.split('.')[0].toLowerCase();
      }
    }
    if (!name) return;
    SELF.name = name;
    console.log(TAG + ' 已识别自己的博客：' + name + '（缓存后导出 .md 只在自己的子域页出现）');
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        var o = {}; o[SELF_KEY] = { blogName: name };
        chrome.storage.local.set(o);
      }
    } catch (e) { /* 存不上就本次会话内存用着 */ }
  }
  /* ---------- 跨域帧身份探针（2026-10-07 真机空洞补底）----------
   * 博客子域文章页（xxx.lofter.com/post/…）的官方条帧在 www.lofter.com——**跨域**，
   * officialLabels() 永远读不到「举报/编辑」，身份恒 null（未知照常出）→ 他人页
   * 导出.md 撤不下。身份缓存能兜，但冷启动（本会话没进过管理页/自己主页）时是空的。
   * 修法：把**帧自己的 URL**（//www.lofter.com/control?blogId=…&postId=…）经现成的
   * lcExportFetch 中继（SW 带 host_permissions + 登录态 cookie）抓回来——那正是帧里
   * 渲染的同一份 HTML，按钮文案就在 <a><em>文案</em></a> 里。一页一探，结果记忆。 */
  var PROBE = { url: '', state: 0, verdict: null };   /* state 0 未探 / 1 进行中 / 2 完成 */
  function probeIdentity() {
    if (PROBE.state === 2 || !CFG.exportMd || !CFG.enabled) return;
    if (selfArticle() !== null) return;               /* DOM 信号已判死，不用探 */
    var frs = controlFrames(), src = '';
    for (var i = 0; i < frs.length; i++) {
      var s = frs[i].getAttribute('src') || '';
      if (/\/control\?/.test(s)) { src = s; break; }
    }
    if (!src) return;                                 /* 没有可控帧（形态①等）→ 无从探 */
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;
    if (PROBE.state === 1 && PROBE.url === src) return;   /* 同一地址已在探 */
    PROBE.url = src; PROBE.state = 1;
    var url = src.indexOf('//') === 0 ? 'https:' + src : src;
    function done(v) {
      PROBE.state = 2; PROBE.verdict = v;
      console.log(TAG + ' 身份探针（control 帧 HTML）：' +
        (v === null ? '读不到，维持现状' : v ? '自己的文章' : '别人的文章'));
      if (v === false) ensureEntry();                 /* 确证别人的 → 立即重评撤 md */
      else diagAttr();
    }
    try {
      chrome.runtime.sendMessage({ action: 'lcExportFetch', url: url }, function (res) {
        if (chrome.runtime.lastError || !res || !res.ok || typeof res.text !== 'string') { done(null); return; }
        /* 只收按钮文案（帧文档里按钮是 <a…><em>文案</em></a>，作者 DevTools 实证），
         * 不整页 grep——避免脚本/属性里无关的「编辑/删除」字样误判。 */
        var words = [], re = /<(?:em|a)\b[^>]*>([^<]{1,24})<\/(?:em|a)>/g, m;
        while ((m = re.exec(res.text)) !== null) {
          var t = m[1].replace(/\s+/g, '');
          if (t && words.indexOf(t) === -1) words.push(t);
          if (words.length > 40) break;
        }
        var txt = words.join('|');
        if (OWN_RE.test(txt)) done(true);
        else if (OTHER_RE.test(txt)) done(false);
        else done(null);
      });
    } catch (e) { PROBE.state = 0; }
  }
  /* ---------- 旧「导出 .md」单篇入口让位（作者 2026-10-07）----------
   * lc-export 的老入口（文末 .lc-export-link / 兜底 #lc-export-fab）不分对象谁都能点；
   * 官方按钮条已有我们的导出钮后，旧的留着只会让人误以为别人的文章也能导。
   * 撤销条件（shareCard 开着才管）：**我们任何一枚 md 钮在位**。
   * 管理页的批量工具栏不在此列（另一套 UI）。lc-export 注入一次后不重挂
   * （内部 detailLinks 守卫），我们这边 MutationObserver 会在它迟到注入时再扫一次；
   * 已撤的在「导出」开关整个关掉后不会自动回来——重载页面即可，边缘场景可接受。 */
  function suppressOldExport() {
    if (!CFG.enabled) return;
    var ours = document.querySelector('#lcsd-bar-li-md,#lcsd-side-md,#lcsd-bar-frame-md');
    if (!ours) {
      try { if (frameLiDoc && frameLiDoc.getElementById('lcsd-frame-li-md')) ours = frameLiDoc; } catch (e) { /* 忽略 */ }
    }
    if (!ours) return;
    var olds = document.querySelectorAll('.lc-export-link, #lc-export-fab');
    for (var i = 0; i < olds.length; i++) {
      if (olds[i].parentNode) olds[i].parentNode.removeChild(olds[i]);
    }
  }
  /* 兜底闪现期的「老入口临时遮蔽」（2026-10-07 真机：长文页开场 FAB 与 lc-export
   * 老钮双闪）。两层：① `<html>.lcsd-pending` 由 document_start 就注入的样式按住
   * （首帧即隐藏，补掉 JS 观察器去抖的空窗）② 同时给已存在的元素打内联 display:none
   * 兜底。都**只藏不删**：入口定形后由 suppressOldExport 正式裁决——我们的 md 钮在位
   * → 真删；落 FAB 兜底（我们不出 md 钮）→ 移除类/还原 display，交回 lc-export 自己。 */
  function maskOldExport(hide) {
    try {
      var h = document.documentElement;
      if (h && h.classList) {
        if (hide) h.classList.add('lcsd-pending'); else h.classList.remove('lcsd-pending');
      }
    } catch (e0) { /* 忽略 */ }
    var olds = document.querySelectorAll('.lc-export-link, #lc-export-fab');
    for (var i = 0; i < olds.length; i++) {
      var el = olds[i];
      if (hide) {
        if (el.style.display !== 'none') { el.setAttribute('data-lcsd-masked', '1'); el.style.display = 'none'; }
      } else if (el.getAttribute && el.getAttribute('data-lcsd-masked')) {
        el.style.display = ''; el.removeAttribute('data-lcsd-masked');
      }
    }
  }

  function injectBar() {
    var ul = barUl();
    if (!ul) return false;
    if (!document.getElementById('lcsd-bar-li')) {
      var li = document.createElement('li');
      li.id = 'lcsd-bar-li';
      li.appendChild(makeBarBtn('分享图', '生成分享图', openPanel));
      ul.appendChild(li);
      console.log(TAG + ' 入口 → 官方按钮条');
    }
    /* 第二枚：导出 .md（跟 export 总开关；开关切换经 storage.onChanged → ensureEntry 重评增删） */
    if (mdAllowed()) {
      if (!document.getElementById('lcsd-bar-li-md')) {
        var li2 = document.createElement('li');
        li2.id = 'lcsd-bar-li-md';
        li2.appendChild(makeBarBtn('导出.md', '导出文章 Markdown', exportMdClick));
        ul.appendChild(li2);
      }
    } else removeEntry('lcsd-bar-li-md');
    return true;
  }

  /* 宿主帧 = 官方条所在的跨域 iframe（专栏页与文章详情页是**同一个** #control_frame）。
   * 可见性闸三道（display / visibility / opacity）——真机上存在同名的隐藏残留帧，
   * 拿它当宿主会在看不见的地方画钮。 */
  function controlFrameShown(fr) {
    try {
      var cs = getComputedStyle(fr);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (cs.opacity !== '' && parseFloat(cs.opacity) === 0) return false;
    } catch (e) { /* 老引擎边界，忽略 */ }
    return true;
  }
  /* 页面上**所有**可见的 control 条帧。2026-10-07 真机实证：同一页可以有**两个同 id 帧**
   * （iframe#control_frame ×2：425×14 空壳 + 425×32 真条）——getElementById 只认第一个，
   * 读到的可能是空壳，身份判定/④a 挂载全跟着错。必须全扫、按几何/内容各自挑。 */
  function controlFrames() {
    var out = [], frs = document.querySelectorAll('iframe#control_frame, iframe.control-frame');
    for (var i = 0; i < frs.length; i++) if (controlFrameShown(frs[i])) out.push(frs[i]);
    return out;
  }

  /* 帧内官方条的**布局形态**实测：可见 li 的纵向跨度。
   * 2026-10-07 长文页 diag 实锤（frBox）：同款 control 帧存在**竖列形态**——ul 仅 85px 宽
   * （float:right 收缩）、li 逐项下堆（每项步进 26px，跨度 ~190px，还有 25×60 的竖条图标项），
   * 与 ④a 调优时的 425×32 单行横条完全不同。往竖列里注 li 只会跟着往下堆 = 「半截按钮条」。
   * 判别：可见 li（含 ul 自身）top/bottom 的总跨度 ≤34px（23px 项 + margin 容差）= 单行横条。 */
  function frameUlSpan(doc) {
    var ul;
    try { ul = doc.querySelector('#control ul, .boprt ul, .a-control ul'); } catch (e) { return null; }
    if (!ul || !ul.getBoundingClientRect) return null;
    var ur = ul.getBoundingClientRect(), top = ur.top, bottom = ur.bottom, n = 0;
    var lis = ul.children;
    for (var i = 0; i < lis.length; i++) {
      var lr;
      try { lr = lis[i].getBoundingClientRect(); } catch (e2) { continue; }
      if (!(lr.width > 2 && lr.height > 2)) continue;
      var cs = null;
      try { cs = doc.defaultView.getComputedStyle(lis[i]); } catch (e3) {}
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) continue;
      n++;
      if (lr.top < top) top = lr.top;
      if (lr.bottom > bottom) bottom = lr.bottom;
    }
    return n ? { span: bottom - top, n: n } : null;
  }
  function frameUlIsRow(doc) {
    var s = frameUlSpan(doc);
    return !s || s.span <= 34;   /* 量不到（jsdom/未布局/隐藏帧）→ 按横条算，不挡注入 */
  }

  /* 形态②：专栏文章右侧竖条末端叠钮（父页定位，零跨帧通信）
   * 宿主认定必须严格（2026-10-06 真机走查实锤）：T1 等页也带同名 control_frame
   * iframe（官方条下方的隐藏/宽幅帧，rect 宽 ~330px），绝不能当宿主——
   * 专栏竖条的真身是 fixed 30×320 的窄帧。判定：可见 + 宽 20–90 + 高 ≥100。
   * 2026-10-07 补第二路：**竖列形态帧**——帧可以很宽（真机 425×425），但帧内官方条
   * 是竖着排的按钮列（同源读得到 li rect）→ 同样照②的锚定法贴到列尾正下方。 */
  function sideFrame() {
    var a = controlFrames();
    for (var i = 0; i < a.length; i++) {
      var r = a[i].getBoundingClientRect();
      if (r.width >= 20 && r.width <= 90 && r.height >= 100) return a[i];
      try {
        var fd = a[i].contentDocument;
        if (fd && fd.querySelector) {
          var s = frameUlSpan(fd);
          if (s && s.span > 34) return a[i];   /* 竖列（非单行横条）→ ②路锚定 */
        }
      } catch (e) { /* 跨域 → 交给 ④b */ }
    }
    return null;
  }

  /* 形态④：文章详情页的**横向官方条**（同一个宿主帧，几何不同）。
   * 2026-10-07 真机 diag 实证：post 页里父文档既无 #control 也无 .boprt，
   * probeVisibleBar() 返回空 ⇒ 条整体在帧内、父页进不去。该帧 rect = 425×32 @317,0
   * （block/visible/z1337）——宽扁且**贴着视口顶边**（官方条由页面 JS 钉 top:0）。
   * 判定三闸：宽 ≥120（排除竖条）+ 高 16–90（排除整页壳）+ 顶边 ≤12（排除条下方的其它宽帧，
   * 走查里那个 330×50 @top40 的帧就是靠这条挡下来的）。 */
  function barFrame() {
    var a = controlFrames();
    for (var i = 0; i < a.length; i++) {
      var r = a[i].getBoundingClientRect();
      if (r.width >= 120 && r.height >= 16 && r.height <= 90 && r.top <= 12) return a[i];
    }
    return null;
  }

  function positionSide() {
    var fr = sideFrame(), el = document.getElementById('lcsd-side');
    if (!fr || !el) return false;
    var r = fr.getBoundingClientRect();
    if (!r.width) return false;
    /* 官方内容底 ≠ 帧底：竖条帧高 320 但官方图标列更短（真机 2026-10-07：内容只占
     * 上半，按帧底定位会悬空一大截）。同源时直接扫帧内官方 li/a、取**可见者里最靠下
     * 的一枚**——不依赖容器高度（竖条模板里 #control 不包整列 / 子项绝对定位不撑高，
     * 首版按容器 rect 量出来偏短，钮盖到了「分享」上）。宽/左也照抄该枚官方钮
     * （官方 li 内联 25×60、margin 0 5px 3px 0 ⇒ 竖向间距 3px），跨域拿不到 → 退回
     * 帧底 + 帧宽（旧行为）。 */
    var bottom = r.bottom, last = null;
    try {
      var fdoc = fr.contentDocument;
      var els = fdoc.querySelectorAll(
        '#control li, #control a, .boprt li, .boprt a, .a-control li, .a-control a');
      var dv = fdoc.defaultView;
      for (var i = 0; i < els.length; i++) {
        var er = els[i].getBoundingClientRect();
        if (!(er.width > 2 && er.height > 2) || (last && er.bottom <= last.bottom)) continue;
        if (dv) {
          try {
            var cs2 = dv.getComputedStyle(els[i]);
            if (cs2.display === 'none' || cs2.visibility === 'hidden' || parseFloat(cs2.opacity) === 0) continue;
          } catch (e2) { /* 逐项防御：单个量不了就按可见算 */ }
        }
        last = er;
      }
    } catch (e) { /* 跨域 → 帧底 */ }
    if (last) {
      el.style.left = Math.round(r.left + last.left) + 'px';
      el.style.width = Math.max(22, Math.round(last.width)) + 'px';
      el.style.top = Math.round(r.top + last.bottom + 3) + 'px';   /* 官方 li 竖向 margin 3px */
    } else {
      el.style.left = Math.round(r.left) + 'px';
      el.style.top = Math.round(bottom + 6) + 'px';
      el.style.width = Math.max(22, Math.round(r.width)) + 'px';
    }
    /* 第二枚侧钮（导出 .md）贴在分享图之下，同宽同列 */
    var md = document.getElementById('lcsd-side-md');
    if (md) {
      md.style.display = '';
      md.style.left = el.style.left;
      md.style.width = el.style.width;
      md.style.top = Math.round(parseFloat(el.style.top) + (el.offsetHeight || 60) + 3) + 'px';
    }
    return true;
  }
  /* 形态④ 定位（2026-10-07 真机截图返工）：官方条右端**贴着视口右缘**时右侧没有空位，
   * 硬叠在右端外侧会被夹取逻辑压到「返回首页」上（首版真机实锤）。
   * ⇒ 分两路：
   *   A. 条右缘之外还有空位 → 照旧叠在条右端外侧；
   *   B. 条贴右缘 → 给帧加 `translateX(-缝宽)`，**整条往左平移出一条缝**，本钮嵌进缝里
   *      —— 视觉上就是官方条尾部的又一格。transform 只挪视觉、不改布局不裁内容
   *      （比缩窄 iframe 安全：内容左对齐时缩宽会把官方钮裁没）。
   * 平移量必须从「未平移的右缘」推算：帧一旦带 transform，getBoundingClientRect 返回的
   * 已是平移后的 rect——直接用会每拍累移。这里读回自身写的 translateX 还原 baseRight。
   * 「导出 .md」为**第二枚独立钮**（作者 2026-10-07：不要挤成一丸）——缝宽按两钮总宽算，
   * 两钮并排各留 6px 间隙。 */
  function positionBarFrame() {
    var fr = barFrame(), el = document.getElementById('lcsd-bar-frame');
    if (!fr || !el) return false;
    /* 其它 control 帧上若有残留平移（上几拍选中过别的帧 / ④a 升级前的旧账）→ 就地还原。
     * fr 自己的不动——baseRight 要靠它还原「未平移右缘」。 */
    var others = document.querySelectorAll('iframe#control_frame, iframe.control-frame');
    for (var oi = 0; oi < others.length; oi++) {
      if (others[oi] !== fr && others[oi].style.transform) others[oi].style.transform = '';
    }
    var r = fr.getBoundingClientRect();
    if (!r.width) return false;
    var md = document.getElementById('lcsd-bar-frame-md');
    var w = el.offsetWidth || 90;
    var wMd = md ? (md.offsetWidth || 74) : 0;
    var gap = md ? 6 : 0;
    var total = w + gap + wMd;
    var m = /translateX\(-([\d.]+)px\)/.exec(fr.style.transform || '');
    var cur = m ? parseFloat(m[1]) : 0;            /* 已平移量（上一次本函数写的） */
    var baseRight = r.right + cur;                 /* 未平移时的右缘 */
    var h = Math.min(23, Math.max(18, Math.round(r.height)));   /* 官方项内容高 23px（DevTools 实证） */
    /* 垂直**底边对齐**：帧内 body{top:7px} + 项高 23px + 帧高 32px（作者 DevTools 实证）
     * ⇒ 官方钮距帧底 2px；原垂直居中比官方钮高 ~2.5px（真机「偏上一点点」实锤）。 */
    var top = Math.round(r.bottom - h - 2);
    [el, md].forEach(function (b) {
      if (!b) return;
      b.style.height = h + 'px';
      b.style.lineHeight = h + 'px';
      b.style.top = top + 'px';
    });
    /* 缝宽 = 两钮总宽（不另加间距）：帧内官方条自带右侧留白，真机总间距 = 留白 + 6px 明显
     * 大于官方钮间距 → 留白本身已 ≈ 官方间距（真机「间距偏大」实锤），我们贴零即可。 */
    var shift = total;
    if (window.innerWidth - 8 - baseRight >= shift) {
      /* A：右侧有空位 → 不动官方条，贴在条右端外侧起排 */
      if (cur) fr.style.transform = '';
      el.style.left = Math.round(baseRight) + 'px';
      if (md) md.style.left = Math.round(baseRight + w + gap) + 'px';
    } else {
      /* B：条贴右缘 → 平移官方条让出总宽，两钮补在原右端处（末枚右缘恰好抵视口缘） */
      fr.style.transform = 'translateX(' + (-shift) + 'px)';
      var left0 = baseRight - total;
      el.style.left = Math.round(left0) + 'px';
      if (md) md.style.left = Math.round(left0 + w + gap) + 'px';
    }
    return true;
  }
  /* 两个「跟帧定位」的形态共用一套重定位入口（fixed 帧随滚动/布局变化） */
  function positionAnchored() { positionSide(); positionBarFrame(); }

  function injectSide() {
    var fr = sideFrame();
    if (!fr) { removeEntry('lcsd-side'); removeEntry('lcsd-side-md'); return false; }   /* 宿主失效 → 撤旧钮，交回兜底 */
    var btn = document.getElementById('lcsd-side');
    if (!btn) {
      btn = document.createElement('div');
      btn.id = 'lcsd-side';
      btn.textContent = '分享图';       /* 官方竖排钮同款文案（宽 25px 自动竖排 分享/图） */
      btn.title = '生成分享图';
      btn.addEventListener('click', openPanel);
      document.body.appendChild(btn);
      window.addEventListener('resize', positionAnchored);
      /* 竖条是 fixed 的，滚动/布局变化后 rect 会变 → 捕获阶段监听滚动重定位 */
      window.addEventListener('scroll', positionAnchored, true);
    }
    /* 第二枚侧钮（导出 .md）：贴在分享图之下，同宽同皮肤；只在**自己文章**时出 */
    var md = document.getElementById('lcsd-side-md');
    if (mdAllowed() && !md) {
      md = document.createElement('div');
      md.id = 'lcsd-side-md';
      md.textContent = '导出.md';
      md.title = '导出文章 Markdown';
      md.addEventListener('click', exportMdClick);
      document.body.appendChild(md);
    } else if (!mdAllowed() && md) {
      md.parentNode.removeChild(md);
      md = null;
    }
    /* 定位失败（帧还没摆好）→ 藏起来并报告失败，让 ensureEntry 落到 FAB；
       等帧就位后 watchEntry 的重评会再切回侧钮 */
    if (!positionSide()) {
      btn.style.display = 'none';
      if (md) md.style.display = 'none';
      return false;
    }
    btn.style.display = '';
    if (md) md.style.display = '';
    applyDarkSkin();   /* 同 ④b：挂载后立即对齐暗色皮肤 */
    console.log(TAG + ' 入口 → 专栏竖条侧钮');
    return true;
  }

  /* 形态④a：帧**同源**时直接把 li 注进帧内的官方 #control ul——吃 LOFTER 自己的
   * .boprt 样式（hover/暗色反转全部自动跟随），观感 100% 原生。
   * 何时同源：lpost 等页本身在 www.lofter.com，control 帧也是 www.lofter.com（源相同）；
   * 博客子域（xxx.lofter.com/post/…）则跨域 → contentDocument 拿不到 → 退回 ④b 并排钮。
   * 帧内官方 a/em 带雪碧图底（作者 DevTools 实证 .boprt a/em background:url(...)），
   * 我们的 li 没有 boprtXX 类、落不到具体图标位 → 剥掉底图，字号行高照吃官方的（23px）。 */
  function injectFrameLi(fr) {
    var doc;
    try { doc = fr.contentDocument; } catch (e) { return false; }   /* 跨域 → 直接抛异常 */
    if (!doc || !doc.querySelector || !doc.createElement) return false;   /* 未就绪/不可用 */
    if (doc.getElementById('lcsd-frame-li')) {
      /* 已挂过 → 但布局可能中途翻转（横条 ⇄ 竖列，2026-10-07 长文页实证有竖列形态）：
       * 竖列里我们的 li 会跟着下堆成「半截条」→ 自拆并转投②路侧钮。 */
      if (!frameUlIsRow(doc)) {
        teardownFrameLi(doc);
        return false;
      }
      frameLiDoc = doc; syncFrameMd(doc); return true;   /* 已挂 */
    }
    var ul = doc.querySelector('#control ul, .boprt ul, .a-control ul');
    if (!ul) return false;
    if (!frameUlIsRow(doc)) return false;   /* 竖列/未知布局 → 不注（sideFrame 会接手） */
    var li = doc.createElement('li');
    li.id = 'lcsd-frame-li';
    var a = doc.createElement('a');
    a.href = 'javascript:;';
    a.className = 'lcsd-bar-btn';
    a.title = '生成分享图';
    var em = doc.createElement('em');
    em.textContent = '分享图';
    a.appendChild(em);
    a.addEventListener('click', function (e) { e.preventDefault(); openPanel(); });
    li.appendChild(a);
    ul.appendChild(li);
    var st = doc.createElement('style');
    st.id = 'lcsd-frame-style';
    /* 底色取官方钮同族深灰（雪碧图读不到精确色，取近似）：浅色模式下白字有底可落，
     * 暗色下 control 帧自 body{filter:invert} 整帧反转 → 正好变白底黑字，与官方钮同步。 */
    st.textContent = '.boprt a.lcsd-bar-btn,.a-control a.lcsd-bar-btn,#control a.lcsd-bar-btn,' +
      '.boprt a.lcsd-bar-btn em,.a-control a.lcsd-bar-btn em,#control a.lcsd-bar-btn em' +
      '{background:#3f3f46;float:none;display:inline-block;height:23px;line-height:23px;padding:0 9px;border-radius:3px;}' +
      '.boprt a.lcsd-bar-btn:hover,.a-control a.lcsd-bar-btn:hover,#control a.lcsd-bar-btn:hover' +
      '{background:#4a4a52;text-decoration:none;}';
    (doc.head || doc.documentElement).appendChild(st);
    syncFrameMd(doc);
    frameLiDoc = doc;
    console.log(TAG + ' 入口 → 官方条（帧内原生 li）');
    return true;
  }
  /* ④a 的第二枚帧内 li（导出 .md）：复用 .lcsd-bar-btn 类 → 剥雪碧图/配色自动跟随 */
  function syncFrameMd(doc) {
    var md = null;
    try { md = doc.getElementById('lcsd-frame-li-md'); } catch (e) { return; }
    if (!mdAllowed()) {
      if (md && md.parentNode) md.parentNode.removeChild(md);
      return;
    }
    if (md) return;
    var ul = doc.querySelector('#control ul, .boprt ul, .a-control ul');
    if (!ul) return;
    var li = doc.createElement('li');
    li.id = 'lcsd-frame-li-md';
    var a = doc.createElement('a');
    a.href = 'javascript:;';
    a.className = 'lcsd-bar-btn';
    a.title = '导出文章 Markdown';
    var em = doc.createElement('em');
    em.textContent = '导出.md';
    a.appendChild(em);
    a.addEventListener('click', function (e) { e.preventDefault(); exportMdClick(); });
    li.appendChild(a);
    ul.appendChild(li);
  }
  /* ④a 自拆：布局翻转（横条 → 竖列）时把帧内我们的两枚 li 与样式整个撤下，
   * frameLiDoc 复位 → ensureEntry 下一拍落到②路侧钮。 */
  function teardownFrameLi(doc) {
    try {
      ['lcsd-frame-li', 'lcsd-frame-li-md', 'lcsd-frame-style'].forEach(function (id) {
        var el = doc.getElementById(id);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    } catch (e) { /* 帧已不可读 → 无从拆 */ }
    frameLiDoc = null;
  }

  function injectBarFrame() {
    /* ④a：逐帧尝试（同名帧可能空壳在前）——任何一个帧里挂上官方 li 即命中 */
    var frs = controlFrames(), mounted = false;
    for (var i = 0; i < frs.length; i++) {
      if (injectFrameLi(frs[i])) { mounted = true; break; }
    }
    if (mounted) {   /* ④a 命中 → 并排钮撤下、让位平移还原 */
      resetFrameShift();
      removeEntry('lcsd-bar-frame'); removeEntry('lcsd-bar-frame-md');
      return true;
    }
    var fr = barFrame();
    if (!fr) {
      resetFrameShift();
      removeEntry('lcsd-bar-frame'); removeEntry('lcsd-bar-frame-md');
      return false;
    }
    /* ④b 跨域并排钮：两枚**独立**丸（分享图 / 导出.md），各自绑点击（不再挤成一丸）
     * 导出格跟 export 总开关 + 「仅自己文章」判据。 */
    var btn = document.getElementById('lcsd-bar-frame');
    if (!btn) {
      btn = document.createElement('div');
      btn.id = 'lcsd-bar-frame';
      btn.textContent = '分享图';       /* 与形态① 的 li 同文案：官方条里要短，平移量小 */
      btn.title = '生成分享图';
      btn.addEventListener('click', openPanel);
      document.body.appendChild(btn);
      window.addEventListener('resize', positionAnchored);
      window.addEventListener('scroll', positionAnchored, true);
    }
    if (mdAllowed()) {
      if (!document.getElementById('lcsd-bar-frame-md')) {
        var md2 = document.createElement('div');
        md2.id = 'lcsd-bar-frame-md';
        md2.textContent = '导出.md';
        md2.title = '导出文章 Markdown';
        md2.addEventListener('click', exportMdClick);
        document.body.appendChild(md2);
      }
    } else removeEntry('lcsd-bar-frame-md');
    var mdEl = document.getElementById('lcsd-bar-frame-md');
    if (!positionBarFrame()) {
      btn.style.display = 'none';
      if (mdEl) mdEl.style.display = 'none';
      return false;
    }
    btn.style.display = '';
    if (mdEl) mdEl.style.display = '';
    applyDarkSkin();   /* 挂载后立即对齐暗色皮肤（ensureEntry 顶部的调用赶在注入之前，够不着） */
    console.log(TAG + ' 入口 → 官方条（跨域帧横条）并排钮');
    return true;
  }

  /* 形态③：FAB 兜底（与 #10 导出同套做法） */
  function buildFab() {
    var fab = document.createElement('div');
    fab.id = 'lcsd-fab';
    fab.textContent = '生成分享图';
    fab.addEventListener('click', openPanel);
    document.body.appendChild(fab);
  }

  /* 幂等：各 inject 自查「已挂」即短路，ensureEntry 可在每次 DOM 变化后安全重跑。
   * 形态升级（FAB → 官方条/侧钮就位）由重评自动完成——2026-10-06 真机走查实锤：
   * #control 由 LOFTER JS 后置渲染，首挂时往往还不存在，不能 has=true 就不再升级。 */
  function removeEntry(id) {
    var el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  /* 自助诊断：入口纠错时把「官方条候选」的实况打到控制台（2026-10-07 真机排查用）。
   * 控制台里搜 lc-share-card 即可看到；把整段回传就能定位为什么没并进官方条。 */
  function entryDiag(why) {
    var sel = '[id="control"],.boprt,.a-control,#control_frame,.control-frame';
    var cands = document.querySelectorAll(sel);
    var lines = [];
    for (var i = 0; i < cands.length && i < 8; i++) {
      var e = cands[i], r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      lines.push('    <' + e.tagName.toLowerCase() + (e.id ? ' id="' + e.id + '"' : '') +
        ' class="' + String(e.className).slice(0, 44) + '">' +
        ' ul=' + e.querySelectorAll('ul').length + ' li=' + e.querySelectorAll('li').length +
        ' ' + cs.display + '/' + cs.visibility + ' ' +
        Math.round(r.width) + 'x' + Math.round(r.height) + '@' + Math.round(r.left) + ',' + Math.round(r.top));
    }
    console.warn(TAG + ' ' + why + '（候选 ' + cands.length + ' 个）\n' + (lines.join('\n') || '    (无)') +
      '\n    —— 整段回传这条日志即可定位');
    diagAttr({ why: why, probe: true });
  }

  /* 当前生效形态（自检 / 变更日志共用）。
   * frameLiDoc：④a 帧内原生 li 所在的文档——li 在 iframe 文档里，父页 getElementById 看不见，
   * 必须记下文档引用才能查「还挂着吗」与卸载时拆掉。 */
  var frameLiDoc = null;
  function frameLiMounted() {
    if (!frameLiDoc) return false;
    try { return !!frameLiDoc.getElementById('lcsd-frame-li'); } catch (e) { frameLiDoc = null; return false; }
  }
  /* ④a 帧内布局全量取证（2026-10-07 长文页「按钮条只剩半截」）：diag 回传只有计数不够——
   * 真机 diag 显示帧内 ul 仅 85px 宽、我们的两枚 li 同 x 竖着堆叠（y 差 26px），而官方
   * 5 项恰好在流内把我们顶到 y≈130 → 说明这个帧的条布局与我们注入时假设的完全不同
   * （官方项可能靠 per-class 定位 / flex-wrap / 超窄容器）。把**每个 ul / 每个 li 的
   * 定位模式**（display/position/float/left/right/top）与 rect 全 dump 出来，一次断案：
   * 官方项怎么定位，我们的 li 就照抄，而不是靠猜。 */
  function frameBoxDump() {
    if (!frameLiDoc) return '';
    try {
      var d = frameLiDoc, w = d.defaultView, parts = [];
      var uls = d.querySelectorAll('#control ul, .boprt ul, .a-control ul');
      parts.push('uls=' + uls.length);
      for (var u = 0; u < uls.length && u < 3; u++) {
        var ur = uls[u].getBoundingClientRect(), ucs = w.getComputedStyle(uls[u]);
        parts.push('ul' + u + '@' + Math.round(ur.left) + ',' + Math.round(ur.top) +
          '|' + Math.round(ur.width) + 'x' + Math.round(ur.height) +
          '|' + ucs.display + '/' + ucs.position + '/' + ucs.float +
          '/L' + ucs.left + '/R' + ucs.right + '/T' + ucs.top +
          '/wrap' + ucs.flexWrap + '|li' + uls[u].children.length);
        var lis = uls[u].querySelectorAll('li');
        for (var i = 0; i < lis.length && i < 8; i++) {
          var l = lis[i], lr = l.getBoundingClientRect(), lcs = w.getComputedStyle(l);
          parts.push(' li' + i + (l.id ? '#' + l.id : '') + '.' + String(l.className).slice(0, 18) +
            '|' + Math.round(lr.width) + 'x' + Math.round(lr.height) +
            '@' + Math.round(lr.left) + ',' + Math.round(lr.top) +
            '|' + lcs.display + '/' + lcs.position + '/f' + lcs.float +
            '/L' + lcs.left + '/R' + lcs.right + '/T' + lcs.top + '/W' + lcs.width);
        }
      }
      var de = d.documentElement, bd = d.body;
      parts.push('scroll|doc' + (de ? de.scrollTop + '/' + de.scrollHeight + 'x' + de.clientHeight : '-') +
        '|body@' + (bd ? Math.round(bd.getBoundingClientRect().top) + 'h' + Math.round(bd.getBoundingClientRect().height) +
        '/' + w.getComputedStyle(bd).position + '/T' + w.getComputedStyle(bd).top : '-'));
      return parts.join(';');
    } catch (e) { return 'ERR:' + (e && e.message); }
  }
  function currentForm() {
    return document.getElementById('lcsd-bar-li') ? '官方按钮条'
      : frameLiMounted() ? '官方条帧内li'
      : document.getElementById('lcsd-bar-frame') ? '官方条并排钮'
      : document.getElementById('lcsd-side') ? '专栏竖条侧钮'
      : document.getElementById('lcsd-fab') ? '悬浮球'
      : '(无)';
  }
  /* 入口是否已「并进/挨着官方条」（悬浮球是兜底态，不算）——轮询据此决定停与不停 */
  function entryResolved() {
    return !!(document.getElementById('lcsd-bar-li') ||
      frameLiMounted() ||
      document.getElementById('lcsd-bar-frame') || document.getElementById('lcsd-side'));
  }
  /* 隔离世界：脚本设的 window.__lcShareCard* 在**页面控制台**看不见（demo 手贴可见）。
   * 把体检结果同步写进 <html data-lcsd-diag>（DOM 两个世界共享）→ 页面控制台里
   * 一句 document.documentElement.getAttribute('data-lcsd-diag') 就能取到。
   * **把候选与 iframe 的实况也塞进去**（2026-10-07 真机：cands=1 + barUl 未命中 =
   * 父文档根本没有 #control 条，官方条在 iframe 里——光看计数不够，必须知道那个候选是谁、
   * 多大、在哪，才能定入口几何。所以这里连 src 和 rect 一起带上，一次回传即断案）。 */
  var diagKeep = {};   /* 跨次保留 why / err / barProbe：廉价的每拍刷新不该把它们抹掉 */
  function diagAttr(extra) {
    try {
      var nodes = document.querySelectorAll('[id="control"],.boprt,.a-control,#control_frame,.control-frame');
      var detail = [], i, e, r, cs;
      for (i = 0; i < nodes.length && i < 6; i++) {
        e = nodes[i]; r = e.getBoundingClientRect(); cs = getComputedStyle(e);
        var s = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
          '.' + String(e.className).slice(0, 36).replace(/\s+/g, '.') +
          '|ul' + e.querySelectorAll('ul').length +
          '|' + Math.round(r.width) + 'x' + Math.round(r.height) +
          '@' + Math.round(r.left) + ',' + Math.round(r.top) +
          '|' + cs.display + '/' + cs.visibility + '/z' + cs.zIndex +
          '/op' + cs.opacity + '/' + cs.position;
        if (e.tagName === 'IFRAME') s += '|src=' + String(e.getAttribute('src') || '').slice(0, 70);
        detail.push(s);
      }
      var frs = document.querySelectorAll('iframe'), fd = [];
      for (i = 0; i < frs.length && i < 6; i++) {
        var r2 = frs[i].getBoundingClientRect();
        fd.push(frs[i].id + '.' + String(frs[i].className).slice(0, 24) + '|' +
          Math.round(r2.width) + 'x' + Math.round(r2.height) + '@' + Math.round(r2.left) + ',' + Math.round(r2.top) +
          (frs[i].style.transform ? '|T=' + frs[i].style.transform : ''));
      }
      /* ④a 帧内官方 ul 的布局实况（2026-10-07 长文页「按钮条只剩一点点」取证）：
       * scrollWidth > 宽 = 溢出被裁；高 >~30px（单行 23）= li 换行成两行——
       * 「导出.md 并入后条被挤爆」假说一拍断案。 */
      var frUl = '';
      if (frameLiDoc) {
        try {
          var ful = frameLiDoc.querySelector('#control ul, .boprt ul, .a-control ul');
          if (ful) {
            var fur = ful.getBoundingClientRect();
            frUl = 'sw' + ful.scrollWidth + '/cw' + ful.clientWidth +
              '|' + Math.round(fur.width) + 'x' + Math.round(fur.height) +
              '@' + Math.round(fur.left) + ',' + Math.round(fur.top) + '|li' + ful.children.length;
          }
        } catch (e) { /* 忽略 */ }
      }
      var o = {
        ver: VER, entry: CFG.entry, enabled: CFG.enabled,        article: articlePage(), form: currentForm(),
        barUl: barUl() ? '命中' : '未命中',
        /* 身份判据实况：self=true/false/null(未知)；selfLabels 是官方条读到的原文钮名
         * （一眼看出是「编辑/删除」还是「举报」——判据错了一次回传就能改） */
        self: selfArticle(), selfLabels: officialLabels(),
        selfBlog: SELF.name || '',
        probeSt: PROBE.state + '/' + String(PROBE.verdict),
        exportMd: CFG.exportMd, mdAllowed: mdAllowed(),
        cands: nodes.length, candsDetail: detail, iframes: fd,
        frUl: frUl, frBox: frameBoxDump(),
        /* 我们自己每枚钮的实况（2026-10-07 长文页「按钮条只剩一点点」取证用）：
         * rect + display/z 一眼看出钮在哪、多大、藏没藏。④a 的 li 在帧内文档里
         * （父页 getElementById 看不见），坐标是**帧内相对**——标 F: 前缀防误读。 */
        btns: (function () {
          var out = [];
          function push(id, doc, tag) {
            try {
              var el = (doc || document).getElementById(id);
              if (!el) return;
              var br = el.getBoundingClientRect(), bcs = getComputedStyle(el);
              out.push((tag || '') + id + '|' + Math.round(br.width) + 'x' + Math.round(br.height) +
                '@' + Math.round(br.left) + ',' + Math.round(br.top) +
                '|' + bcs.display + '/z' + bcs.zIndex + '/' + bcs.position);
            } catch (e) { /* 忽略 */ }
          }
          ['lcsd-bar-li', 'lcsd-bar-li-md', 'lcsd-bar-frame', 'lcsd-bar-frame-md',
            'lcsd-side', 'lcsd-side-md', 'lcsd-fab'].forEach(function (id) { push(id); });
          if (frameLiDoc) {
            push('lcsd-frame-li', frameLiDoc, 'F:');
            push('lcsd-frame-li-md', frameLiDoc, 'F:');
          }
          return out;
        })(),
        /* 几何分流的裁决（形态②/④ 共宿主）：哪个闸认了它——没认时一眼知道卡在哪条上 */
        pick: (sideFrame() ? 'side' : '') + (barFrame() ? '+bar' : '') || '未认帧',
        at: Math.round(performance.now()) + 'ms',
      };
      /* 可见按钮条定位（贵，只在显式体检时跑）：不靠 id/class 猜——直接找「同时含
       * 返回首页 + 举报」的最小容器。若它压根不匹配候选选择器，这里立刻现形。 */
      if (extra && extra.probe) diagKeep.barProbe = probeVisibleBar();
      if (extra) for (var k in extra) {
        o[k] = extra[k];
        if (k === 'why' || k === 'err' || k === 'barProbe') diagKeep[k] = extra[k];
      }
      for (var k2 in diagKeep) if (o[k2] === undefined) o[k2] = diagKeep[k2];
      document.documentElement.setAttribute('data-lcsd-diag', JSON.stringify(o));
    } catch (e) { /* 诊断本身绝不能影响功能 */ }
  }
  function probeVisibleBar() {
    var out = [], all = document.querySelectorAll('div,ul,section,aside');
    for (var i = 0; i < all.length && out.length < 3; i++) {
      var e = all[i];
      if (e === document.body || e === document.documentElement) continue;   /* 整页不算条 */
      var t = e.textContent || '';
      if (t.length > 300 || t.indexOf('返回首页') === -1 || t.indexOf('举报') === -1) continue;
      var r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      out.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
        '.' + String(e.className).slice(0, 40).replace(/\s+/g, '.') +
        '|li' + e.querySelectorAll('li').length + '|' + cs.position +
        '|' + Math.round(r.width) + 'x' + Math.round(r.height) +
        '@' + Math.round(r.left) + ',' + Math.round(r.top));
    }
    return out;
  }
  /* 形态变更只在真变时打一行（升级链路留时间线，不刷屏）。
   * diagAttr 只在「变了」和显式调用时写——它带全文档选择器查询，不能跟着每次 DOM 变化跑。 */
  var lastForm = '';
  function noteForm() {
    var f = currentForm();
    if (f === lastForm) return;
    lastForm = f;
    console.log(TAG + ' 入口形态 = ' + f + '（entry=' + CFG.entry + '）');
    diagAttr();
  }

  function ensureEntry() {
    /* 观察器 / 轮询里跑 → 任何异常都会静默掐断「形态升级」链路，必须显形 */
    try {
      captureSelf();   /* 未缓存时借每次重评补捕（官方条/管理页信号可能迟到）；已缓存即短路 */
      probeIdentity(); /* 跨域帧身份探针（一页一探；DOM 判据已死或导出没开即短路） */
      if (!CFG.enabled || !articlePage()) { clearEntries(); noteForm(); return; }
      ensureStyle();
      if (CFG.entry === 'auto') {
        if (injectBar()) { removeEntry('lcsd-fab'); removeEntry('lcsd-side'); removeEntry('lcsd-bar-frame'); suppressOldExport(); noteForm(); return; }
        if (injectBarFrame()) { removeEntry('lcsd-fab'); removeEntry('lcsd-side'); suppressOldExport(); noteForm(); return; }
        if (injectSide()) { removeEntry('lcsd-fab'); removeEntry('lcsd-bar-frame'); suppressOldExport(); noteForm(); return; }
        /* 兜底宽限（2026-10-07 真机：长文页开场闪一下「生成分享图」+「导出 .md」）：
         * 官方帧/条迟到就绪期间先等，不立刻落 FAB；同时把 lc-export 老入口临时遮住。
         * 宽限只影响「最终确实要落 FAB」的页面观感（延迟 3s 出现），锚定页面无感。 */
        if (Date.now() - bootTs < FAB_GRACE) {
          maskOldExport(true);
          noteForm(); return;
        }
        if (!fallbackLogged) { fallbackLogged = true; entryDiag('未找到官方按钮条 / 官方条跨域帧 / 专栏竖条 → 落 FAB 兜底'); }
      }
      maskOldExport(false);   /* 定形（含落 FAB）→ 还原临时遮蔽，交回 suppressOldExport 裁决 */
      if (!document.getElementById('lcsd-fab')) buildFab();
      suppressOldExport();   /* 注入之后跑：判断「我们的 md 钮在位」必须先让注入走完 */
      noteForm();
    } catch (e) {
      var msg = (e && e.message) ? e.message : String(e);
      console.warn(TAG + ' 入口挂载异常：' + msg);
      diagAttr({ err: msg });
    }
  }
  var fallbackLogged = false;

  function loadCfg(done) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return done();
    chrome.storage.local.get(['lc_settings_v1', SELF_KEY], function (res) {
      var s = (res && res.lc_settings_v1) || {};
      var sc = s.shareCard || {};
      CFG.enabled = sc.enabled !== false;                      /* 默认开 */
      /* 「入口并进官方按钮条」开关已退休（作者 2026-10-07：默认并进官方条即可，不必让用户选）
       * —— 恒 auto：官方条 → 帧内 li / 横条并排 → 竖列侧钮 → 悬浮球兜底；历史存的
       * entry:'fab' 一律忽略。 */
      CFG.entry = 'auto';
      CFG.dark = (s.darkMode && s.darkMode.mode) || 'off';     /* 与暗色管线同源（content.js isDarkMode） */
      CFG.darkSchedule = (s.darkMode && s.darkMode.schedule) || null; /* schedule 档的时段 */
      /* 「导出 .md」并入官方按钮行（作者 2026-10-07 拍板）：跟 lc-export 的总开关
       * export.enabled（默认关，popup 开「导出」才出现第二枚钮）；scope.manage/detail
       * 只闸 lc-export 自己的老入口，这里不重复闸——入口只该有一个判定口径。 */
      CFG.exportMd = !!(s.export && s.export.enabled === true);
      /* 自己的 blogName 缓存（captureSelf 写入）：命中后子域页身份判定零成本 */
      var sf = res && res[SELF_KEY];
      if (sf && sf.blogName && !SELF.name) SELF.name = String(sf.blogName).toLowerCase();
      done();
    });
  }

  /* 暗色判定（与官方钮反转同源）：control 帧的暗色管线按 lc_settings_v1.darkMode 干活
   * （manual 直开 / auto 跟系统），父页没被反色 → 我们的挨排钮自己跟皮肤。 */
  function darkOn() {
    /* 四档统一判定（defaults.js）；schedule = 按时段（2026-10-08 新增）。
       本文件在父页与跨域帧里都可能跑，读不到 helper 时退回旧两档。 */
    if (typeof LC_darkActive === 'function') {
      return LC_darkActive({ mode: CFG.dark, schedule: CFG.darkSchedule });
    }
    if (CFG.dark === 'manual') return true;
    if (CFG.dark === 'auto') {
      try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
    }
    return false;
  }
  function applyDarkSkin() {
    var on = darkOn();
    /* 四枚钮一个都不能漏（真机 2026-10-07：漏了 lcsd-side-md → 长文页导出.md 没跟白底黑字） */
    ['lcsd-bar-frame', 'lcsd-bar-frame-md', 'lcsd-side', 'lcsd-side-md'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !el.classList) return;
      if (on) el.classList.add('lcsc-dark'); else el.classList.remove('lcsc-dark');
    });
  }

  /* 入口就绪前的 DOM 变化（#control 由 LOFTER JS 后置渲染 / iframe 迟到）→ 重评补挂。
   * debounce 300ms；ensureEntry 幂等（形态不变 = 零 DOM 写），可放心每次重跑。 */
  var entryTimer = 0, entryObs = null;
  function watchEntry() {
    if (entryObs || !window.MutationObserver) return;
    entryObs = new MutationObserver(function () {
      if (entryTimer) return;
      entryTimer = setTimeout(function () {
        entryTimer = 0;
        ensureEntry();
        positionAnchored();           /* 跟帧定位的形态已挂时跟一下布局变化 */
      }, 300);
    });
    entryObs.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* 第二道保险：观察器之外的定时重评（部分页面的官方条由异步脚本注入，
   * 事件链可能错过）。每 500ms 一次、最多 15s，挂上官方条或已是 FAB 形态即停。 */
  var pollT = 0, pollN = 0, lateDiag = false;
  function startPoll() {
    if (pollT || !window.setInterval) return;
    pollT = window.setInterval(function () {
      pollN++;
      ensureEntry();
      positionAnchored();
      /* 还没「并进/挨着官方条」，或身份还没判死（md 闸待定）→ 体检属性跟着刷新 */
      if (!entryResolved() || (CFG.exportMd && selfArticle() === null)) diagAttr();
      /* 6 秒仍未并进官方条 → 补一次候选清单（区分「条从未出现」与「条在但选择器没命中」，
       * 首挂时那一次 dump 常常拍在条渲染出来之前，信息不足） */
      if (!lateDiag && pollN === 12 && CFG.entry === 'auto' && !entryResolved()) {
        lateDiag = true;
        entryDiag('6 秒后仍未并进官方按钮条');
      }
      /* 收工条件：形态已定**且**身份已定（导出开着 + 判定仍未知 → 继续重评）。
       * 官方条的「举报/删除」钮常逐个迟到，④a 先挂上就收工的话，之后没人再评
       * md 闸——真机 2026-10-07：他人页导出.md 撤不下来。上限 60 拍 = 30s。 */
      var mdPending = CFG.exportMd && selfArticle() === null;
      if ((entryResolved() && (!mdPending || pollN > 60)) || pollN > 30) {
        window.clearInterval(pollT); pollT = 0;
        diagAttr({ probe: true, at: Math.round(performance.now()) + 'ms(轮询结束)' });
      }
    }, 500);
  }

  /* ================= 10. 命令 ================= */

  window.__lcShareCard = function () { openPanel(); return state.fields; };
  window.__lcShareCardSet = function (m) {
    if (['auto', 'A', 'B'].indexOf(m) === -1) { console.warn(TAG + ' 版式只能是 auto / A / B'); return; }
    state.mode = m;
    if (!document.getElementById('lcsd-panel')) openPanel(); else render();
    console.log(TAG + ' 版式 = ' + m);
  };
  window.__lcShareCardColor = function (hex) {
    if (!/^#[0-9a-f]{6}$/i.test(String(hex || ''))) { console.warn(TAG + ' 需要 #RRGGBB'); return; }
    PAL.accent = hex;
    var inp = document.getElementById('lcsd-color'); if (inp) inp.value = hex;
    if (state.canvas) render();
    console.log(TAG + ' 强调色 = ' + hex);
  };
  window.__lcShareCardFields = function () {
    state.fields = extract();
    maybeFillYear();   /* 缺年份时顺带把归档查询跑起来，核对表随后再打印一次即可 */
    var r = fieldsReport();
    console.log(TAG + ' 字段核对\n' + r);
    return state.fields;
  };
  window.__lcShareCardDownload = download;
  window.__lcShareCardCopy = copyPng;
  /* 手动触发一次入口重评（幂等）：测试/排查「迟到信号」（举报钮后渲染、帧重挂）用 */
  window.__lcShareCardSync = function () { ensureEntry(); return currentForm(); };
  /* 版本戳：贴完先跑一次，确认控制台首行与源文件 VER 同版（防「贴了旧副本」） */
  window.__lcShareCardVer = function () { console.log(TAG + ' v' + VER); return VER; };
  /* 归档补年份：诊断命令（不传参则用当前页）+ 暴露内部件供离线单测 */
  window.__lcShareCardYear = function (url, mmdd) {
    ARCH.pages = {}; ARCH.memo = {}; ARCH.calls = 0; ARCH.lastErr = '';
    var f = {
      permalink: url || (state.fields && state.fields.permalink),
      date: mmdd || (state.fields && state.fields.date),
      dateHasYear: false, warnings: [], src: {}
    };
    return fillYear(f).then(function (ok) {
      console.log(TAG + ' 补年份 ' + (ok ? '命中 ' + f.date : '未命中：' + ARCH.lastErr) +
        '（' + ARCH.calls + ' 次请求）');
      return f;
    });
  };
  window.__lcShareArch = {
    parse: archParse, lookup: archLookup, slugOf: slugOf, fillYear: fillYear,
    state: ARCH,
    reset: function (origin) {
      ARCH.pages = {}; ARCH.memo = {}; ARCH.calls = 0; ARCH.lastErr = ''; ARCH.origin = origin || '';
    }
  };
  window.__lcShareCardOff = function () {
    closePanel();
    clearEntries();
    var st = document.getElementById('lcsd-style'); if (st) st.remove();
    if (entryObs) { entryObs.disconnect(); entryObs = null; }
    if (pollT) { window.clearInterval(pollT); pollT = 0; }
    if (entryTimer) { clearTimeout(entryTimer); entryTimer = 0; }
    ['__lcShareCard', '__lcShareCardSet', '__lcShareCardColor', '__lcShareCardFields',
      '__lcShareCardDownload', '__lcShareCardCopy', '__lcShareCardVer', '__lcShareCardEntry',
      '__lcShareCardDiag', '__lcShareCardYear', '__lcShareArch',
      '__lcShareCardOff'].forEach(function (k) {
      try { delete window[k]; } catch (e) { window[k] = undefined; }
    });
    window.__lcShareCardLoaded = false;
    console.log(TAG + ' 已卸载');
  };
  /* 入口自检：打印当前生效形态与配置（出问题时第一条命令） */
  window.__lcShareCardEntry = function () {
    var form = currentForm();
    console.log(TAG + ' 入口=' + form + ' / enabled=' + CFG.enabled + ' / entry=' + CFG.entry +
      ' / 文章页=' + articlePage());
    diagAttr();
    return form;
  };
  /* 入口候选体检：为什么没并进官方条——直接看候选清单 */
  window.__lcShareCardDiag = function () {
    console.log(TAG + ' 样式表=' + (document.getElementById('lcsd-style') ? '已注入' : '缺失') +
      ' / barUl=' + (barUl() ? '命中' : '未命中') +
      ' / 官方条帧=' + (sideFrame() ? '竖条' : barFrame() ? '横条' : '无'));
    var li = document.getElementById('lcsd-bar-li');
    if (li) {   /* 已注入却看不见时，这一行直接给出结论（被官方 CSS 藏了 / 被挤出条外） */
      var lr = li.getBoundingClientRect(), lcs = getComputedStyle(li), a = li.firstChild;
      var acs = a ? getComputedStyle(a) : null;
      console.log(TAG + ' 注入项 ' + Math.round(lr.width) + 'x' + Math.round(lr.height) +
        '@' + Math.round(lr.left) + ',' + Math.round(lr.top) +
        ' display=' + lcs.display + ' ' + lcs.visibility + ' opacity=' + lcs.opacity +
        (acs ? ' color=' + acs.color + ' font=' + acs.fontSize + ' overflow=' + getComputedStyle(li.parentNode).overflow : ''));
    }
    entryDiag('入口候选体检');
    return __lcShareCardEntry();
  };

  /* ================= 11. 启动 =================
   * 本脚本按 manifest 在 document_start + all_frames 注入——
   * ① <body> 与文章 DOM 在 document_start 都不存在（demo 手贴无此问题）→ 等 DOMContentLoaded；
   * ② 子帧（评论 iframe、control iframe…）里也会跑：在子帧挂 fixed 入口会按**子帧视口**
   *    定位，映射到父页就是「页角一个被裁的小按钮」（2026-10-06 真机走查实锤）
   *    → 只在顶层帧运行。 */

  function boot() {
    if (window.top !== window) return;   /* 子帧：不出入口不开面板 */
    state.fields = extract();
    console.log(TAG + ' v' + VER + ' 已启动 → ' + state.fields.tpl + ' / ' +
      (KIND_LABEL[state.fields.kind] || state.fields.kind) + '（自动版式 ' + resolveMode(state.fields) + '）');
    console.log(TAG + ' 命令：__lcShareCardEntry() 看入口 / __lcShareCardFields() 看字段 / __lcShareCard() 开面板');

    /* 读设置 → 挂入口；改设置即时生效（popup 写 lc_settings_v1 → onChanged 回本帧）。
     * chrome 缺失（纯 jsdom 单测环境）时用默认配置继续，行为与 demo 时代一致。 */
    loadCfg(function () {
      ensureEntry();
      watchEntry();
      startPoll();
      /* darkMode=auto 时跟随系统明暗（MQL 新旧两套 API 都接，老引擎降级为不跟） */
      if (window.matchMedia) {
        try {
          var mq = window.matchMedia('(prefers-color-scheme: dark)');
          var onMq = function () { applyDarkSkin(); };
          if (mq.addEventListener) mq.addEventListener('change', onMq);
          else if (mq.addListener) mq.addListener(onMq);
        } catch (e) { /* 老引擎边界，忽略 */ }
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area !== 'local' || !changes.lc_settings_v1) return;
          fallbackLogged = false;
          loadCfg(function () { ensureEntry(); });
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
