#!/usr/bin/env node
/**
 * فاز ۱ نسخه ۲: تحلیل ایستا — فقط توابع سراسری واقعاً ناشناس
 */
const fs = require('fs');
const path = require('path');

const CRM_DIR = path.resolve(__dirname, '../../crm');
const files = fs.readdirSync(CRM_DIR).filter(f => f.endsWith('.js'));

// بارگذاری تمام فایل‌ها
const code = {};
files.forEach(f => {
  code[f] = fs.readFileSync(path.join(CRM_DIR, f), 'utf-8');
});

// کلمات کلیدی و Built-inها
const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return',
  'try', 'catch', 'finally', 'throw', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of',
  'var', 'let', 'const', 'function', 'class', 'extends', 'super', 'this', 'null', 'undefined',
  'true', 'false', 'async', 'await', 'yield', 'import', 'export', 'from', 'as',
  'function', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'return', 'try', 'catch', 'finally', 'throw', 'new', 'delete', 'typeof', 'instanceof',
  'in', 'of', 'var', 'let', 'const', 'class', 'extends', 'super', 'this', 'async', 'await',
  'yield', 'import', 'export', 'from', 'as', 'void', 'with', 'debugger', 'enum',
  // Common method names that get parsed as calls
  'log', 'info', 'warn', 'error', 'debug', 'trace', 'assert', 'dir', 'table', 'group',
  'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'timeLog', 'count', 'countReset',
  'clear', 'profile', 'profileEnd', 'timeStamp',
  // String methods
  'split', 'slice', 'splice', 'substr', 'substring', 'concat', 'trim', 'toLowerCase',
  'toUpperCase', 'replace', 'replaceAll', 'match', 'matchAll', 'search', 'includes',
  'indexOf', 'lastIndexOf', 'startsWith', 'endsWith', 'charAt', 'charCodeAt',
  'padStart', 'padEnd', 'repeat', 'normalize',
  // Array methods
  'push', 'pop', 'shift', 'unshift', 'sort', 'reverse', 'fill', 'copyWithin', 'flat',
  'flatMap', 'concat', 'join', 'slice', 'splice', 'indexOf', 'lastIndexOf', 'includes',
  'find', 'findIndex', 'findLast', 'findLastIndex', 'filter', 'map', 'reduce', 'reduceRight',
  'forEach', 'every', 'some', 'entries', 'keys', 'values', 'from', 'of', 'isArray',
  // Object methods
  'assign', 'create', 'defineProperty', 'defineProperties', 'freeze', 'seal', 'isFrozen',
  'isSealed', 'getPrototypeOf', 'setPrototypeOf', 'getOwnPropertyDescriptor',
  'getOwnPropertyDescriptors', 'getOwnPropertyNames', 'getOwnPropertySymbols',
  'is', 'isExtensible', 'preventExtensions', 'keys', 'values', 'entries', 'fromEntries',
  // Number methods
  'parseInt', 'parseFloat', 'isFinite', 'isInteger', 'isNaN', 'isSafeInteger',
  'toFixed', 'toPrecision', 'toExponential', 'toString', 'valueOf',
  // Math methods
  'abs', 'ceil', 'floor', 'round', 'trunc', 'sign', 'sqrt', 'cbrt', 'pow', 'exp', 'log',
  'log2', 'log10', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh',
  'tanh', 'min', 'max', 'random', 'hypot', 'imul', 'clz32',
  // JSON methods
  'parse', 'stringify',
  // Date methods
  'now', 'parse', 'UTC', 'getTime', 'getDate', 'getDay', 'getFullYear', 'getHours',
  'getMilliseconds', 'getMinutes', 'getMonth', 'getSeconds', 'getTimezoneOffset',
  'getYear', 'getUTCDate', 'getUTCDay', 'getUTCFullYear', 'getUTCHours',
  'getUTCMilliseconds', 'getUTCMinutes', 'getUTCMonth', 'getUTCSeconds',
  'setDate', 'setFullYear', 'setHours', 'setMilliseconds', 'setMinutes', 'setMonth',
  'setSeconds', 'setTime', 'setUTCDate', 'setUTCFullYear', 'setUTCHours',
  'setUTCMilliseconds', 'setUTCMinutes', 'setUTCMonth', 'setUTCSeconds', 'toDateString',
  'toISOString', 'toJSON', 'toLocaleDateString', 'toLocaleString', 'toLocaleTimeString',
  'toTimeString', 'toUTCString',
  // Promise methods
  'resolve', 'reject', 'all', 'race', 'allSettled', 'any', 'then', 'catch', 'finally',
  // RegExp methods
  'exec', 'test', 'compile', 'toString',
  // Error methods
  // Map/Set
  'has', 'get', 'set', 'delete', 'clear', 'add', 'size',
  // DOM methods that are universally used
  'getElementById', 'querySelector', 'querySelectorAll', 'getElementsByTagName',
  'getElementsByClassName', 'getElementsByName', 'createElement', 'createTextNode',
  'createDocumentFragment', 'createComment', 'createAttribute', 'importNode',
  'adoptNode', 'appendChild', 'insertBefore', 'replaceChild', 'removeChild',
  'cloneNode', 'normalize', 'hasChildNodes', 'isEqualNode', 'isSameNode',
  'compareDocumentPosition', 'contains', 'lookupPrefix', 'lookupNamespaceURI',
  'getAttribute', 'setAttribute', 'removeAttribute', 'hasAttribute', 'hasAttributes',
  'getAttributeNS', 'setAttributeNS', 'removeAttributeNS', 'hasAttributeNS',
  'getNamedItem', 'setNamedItem', 'removeNamedItem', 'item',
  'getRootNode', 'getBoundingClientRect', 'getClientRects', 'scrollIntoView',
  'focus', 'blur', 'click', 'submit', 'reset', 'select', 'check', 'uncheck',
  'addEventListener', 'removeEventListener', 'dispatchEvent', 'attachEvent',
  'detachEvent', 'fireEvent', 'insertAdjacentHTML', 'insertAdjacentElement',
  'insertAdjacentText', 'requestFullscreen', 'exitFullscreen',
  'getComputedStyle', 'getPropertyValue', 'setProperty', 'removeProperty',
  'animate', 'getAnimations', 'getAttribute', 'setAttribute',
  'toggleAttribute', 'matches', 'closest', 'scrollTo', 'scrollBy', 'scroll',
  'getAnimations', 'animate', 'getSelection', 'setSelectionRange',
  // CSS methods
  'getPropertyPriority', 'getPropertyCSSValue',
  // LocalStorage
  'removeItem', 'getItem', 'setItem', 'clear', 'key',
  // Window methods
  'open', 'close', 'focus', 'blur', 'print', 'stop', 'postMessage',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
  'cancelIdleCallback', 'matchMedia', 'getSelection', 'find', 'scroll',
  'scrollBy', 'scrollTo', 'getComputedStyle', 'fetch', 'alert', 'confirm', 'prompt',
  'atob', 'btoa', 'getComputedStyle', 'scrollX', 'scrollY', 'innerWidth',
  'innerHeight', 'outerWidth', 'outerHeight', 'screenX', 'screenY', 'pageXOffset',
  'pageYOffset', 'scrollMaxX', 'scrollMaxY', 'isSecureContext', 'origin', 'top',
  'parent', 'frames', 'length', 'closed', 'opener', 'self', 'window',
  'getSelection', 'print', 'moveTo', 'moveBy', 'resizeTo', 'resizeBy',
  'captureEvents', 'releaseEvents', 'routeEvent', 'enableExternalCapture',
  'disableExternalCapture',
  // MutationObserver
  'observe', 'disconnect', 'takeRecords',
  // EventTarget
  'addEventListener', 'removeEventListener', 'dispatchEvent',
  // Custom
  'keys', 'values', 'entries', 'fromEntries',
  // Number/Intl
  'format', 'formatToParts', 'resolvedOptions', 'supportedLocalesOf',
  // متدهای DOM Node
  'append', 'prepend', 'before', 'after', 'replaceWith', 'remove',
  'animate', 'getAnimations', 'replaceChildren',
  // متدهای Element
  'requestPointerLock', 'exitPointerLock', 'setPointerCapture', 'releasePointerCapture',
  'hasPointerCapture', 'checkVisibility', 'attachInternals', 'attachShadow', 'getInnerHTML',
  // متدهای FormData
  'get', 'getAll', 'has', 'forEach', 'keys', 'values', 'entries', 'append',
  // متدهای Event
  'preventDefault', 'stopPropagation', 'stopImmediatePropagation', 'initEvent',
  'composedPath', 'preventDefault', 'stopPropagation',
]);

// Browser globals (defined by browser)
const BROWSER_GLOBALS = new Set([
  'window', 'document', 'self', 'navigator', 'location', 'history', 'screen', 'frames',
  'parent', 'top', 'opener', 'length', 'name', 'status', 'closed', 'event', 'external',
  'crypto', 'performance', 'localStorage', 'sessionStorage', 'indexedDB', 'caches',
  'console', 'fetch', 'alert', 'confirm', 'prompt', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'cancelIdleCallback', 'matchMedia', 'getComputedStyle',
  'getSelection', 'print', 'stop', 'focus', 'blur', 'close', 'open', 'find', 'scroll',
  'scrollBy', 'scrollTo', 'origin', 'isSecureContext', 'crossOriginIsolated',
  'speechSynthesis', 'webkitRequestFullscreen', 'webkitCancelFullScreen',
  'queueMicrotask', 'reportError', 'structuredClone', 'fetchLater',
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math', 'JSON',
  'RegExp', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
  'Promise', 'Map', 'Set', 'Symbol', 'WeakMap', 'WeakSet', 'Reflect', 'Proxy',
  'Intl', 'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder',
  'Headers', 'Request', 'Response', 'AbortController', 'AbortSignal', 'FormData',
  'File', 'FileList', 'FileReader', 'Blob', 'Image', 'Audio', 'HTMLVideoElement',
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'PerformanceObserver',
  'Event', 'CustomEvent', 'EventTarget', 'MessageChannel', 'MessagePort',
  'Node', 'Element', 'HTMLElement', 'HTMLDivElement', 'HTMLInputElement',
  'HTMLFormElement', 'HTMLAnchorElement', 'HTMLImageElement', 'HTMLScriptElement',
  'HTMLStyleElement', 'HTMLLinkElement', 'HTMLMetaElement', 'HTMLTitleElement',
  'HTMLButtonElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLOptionElement',
  'HTMLTableElement', 'HTMLTableRowElement', 'HTMLTableCellElement', 'HTMLHeadElement',
  'HTMLBodyElement', 'HTMLUListElement', 'HTMLOListElement', 'HTMLLIElement',
  'HTMLLabelElement', 'HTMLFieldSetElement', 'HTMLLegendElement', 'HTMLCanvasElement',
  'HTMLSpanElement', 'HTMLParagraphElement', 'HTMLBRElement', 'HTMLHRElement',
  'HTMLIFrameElement', 'HTMLAudioElement', 'HTMLVideoElement', 'HTMLSourceElement',
  'HTMLTrackElement', 'HTMLDataListElement', 'HTMLOutputElement', 'HTMLProgressElement',
  'HTMLMeterElement', 'HTMLDetailsElement', 'HTMLSummaryElement', 'HTMLDialogElement',
  'HTMLMenuElement', 'HTMLMenuItemElement', 'HTMLPictureElement', 'HTMLTemplateElement',
  'HTMLSlotElement', 'HTMLDirectoryElement', 'HTMLFrameElement', 'HTMLFrameSetElement',
  'HTMLMarqueeElement', 'HTMLObjectElement', 'HTMLParamElement', 'HTMLAppletElement',
  'HTMLBaseFontElement', 'HTMLFontElement', 'HTMLFrameElement', 'HTMLFrameSetElement',
  'HTMLDirectoryElement', 'HTMLModElement', 'HTMLQuoteElement', 'HTMLPreElement',
  'HTMLHeadingElement', 'HTMLEmbedElement', 'HTMLAreaElement', 'HTMLMapElement',
  'Document', 'DocumentFragment', 'NodeList', 'HTMLCollection', 'Text', 'Comment',
  'Attr', 'NamedNodeMap', 'DOMTokenList', 'DOMRect', 'DOMRectReadOnly', 'DOMPoint',
  'DOMPointReadOnly', 'DOMMatrix', 'DOMMatrixReadOnly', 'DOMException', 'DOMImplementation',
  'XMLHttpRequest', 'XSLTProcessor', 'XPathEvaluator', 'XPathResult', 'XPathExpression',
  'Storage', 'StorageManager', 'BroadcastChannel', 'Notification', 'PushManager',
  'ServiceWorkerRegistration', 'ServiceWorkerContainer', 'ServiceWorker',
  'Cache', 'CacheStorage', 'PaymentRequest', 'PaymentResponse', 'PaymentMethodChangeEvent',
  'Clipboard', 'ClipboardEvent', 'ClipboardItem', 'Permission', 'Permissions',
  'Geolocation', 'Position', 'Coordinates', 'GeolocationPositionError', 'GeolocationCoordinates',
  'MediaDevices', 'MediaStream', 'MediaStreamTrack', 'MediaRecorder', 'MediaSource',
  'SourceBuffer', 'TextTrack', 'TextTrackCue', 'TextTrackCueList', 'TextTrackList',
  'VideoTrackList', 'AudioTrackList', 'HTMLTrackElement', 'TimeRanges', 'VideoPlaybackQuality',
  'WebSocket', 'WebGLRenderingContext', 'WebGL2RenderingContext', 'WebGLProgram',
  'WebGLShader', 'WebGLBuffer', 'WebGLFramebuffer', 'WebGLRenderbuffer', 'WebGLTexture',
  'WebGLUniformLocation', 'WebGLActiveInfo', 'WebGLContextEvent', 'WebGLVertexArrayObject',
  'WebGLQuery', 'WebGLSampler', 'WebGLSync', 'WebGLTransformFeedback', 'WebGL2RenderingContextBase',
  'WebGL2RenderingContextOverloads', 'WebGL2RenderingContextBase',
  'WebGLRenderingContextBase', 'WebGLRenderingContextOverloads', 'WebGLRenderingContextBase',
  'WebGLRenderingContextOverloads', 'WebGL2RenderingContextBase',
  'PointerEvent', 'MouseEvent', 'KeyboardEvent', 'TouchEvent', 'FocusEvent', 'InputEvent',
  'WheelEvent', 'UIEvent', 'CompositionEvent', 'DragEvent', 'ClipboardEvent',
  'AnimationEvent', 'TransitionEvent', 'StorageEvent', 'MessageEvent', 'PopStateEvent',
  'HashChangeEvent', 'PageTransitionEvent', 'ProgressEvent', 'SubmitEvent', 'BeforeUnloadEvent',
  'ErrorEvent', 'PromiseRejectionEvent', 'SecurityPolicyViolationEvent', 'VisibilityStateEvent',
  'IDBVersionChangeEvent', 'Animation', 'AnimationEffect', 'AnimationEvent', 'AnimationTimeline',
  'AnimationPlaybackEvent', 'KeyframeEffect', 'KeyframeAnimationOptions', 'DocumentTimeline',
  'ShadowRoot', 'HTMLSlotElement', 'ElementInternals', 'CustomStateSet',
  'ResizeObserverEntry', 'IntersectionObserverEntry', 'MutationRecord',
  'VTTCue', 'VTTRegion', 'DataTransfer', 'DataTransferItem', 'DataTransferItemList',
  'Range', 'Selection', 'StaticRange', 'AbstractRange', 'BreakableString',
  'NodeIterator', 'TreeWalker', 'ProcessingInstruction', 'CDATASection', 'Entity',
  'EntityReference', 'Notation', 'XMLDocument', 'XMLHttpRequestEventTarget', 'XMLHttpRequestUpload',
  'XPathException', 'XSLTProcessor', 'TrustedHTML', 'TrustedScript', 'TrustedScriptURL',
  'TrustedTypePolicy', 'TrustedTypePolicyFactory',
  // Persian/Jalali libs that may be loaded
  'moment', 'dayjs', 'jalaali', 'jalaaliJs', 'JalaliDate', 'persianDate',
  'XLSX', 'jspdf', 'html2canvas', 'Swal', 'sweetalert', 'toastr',
  'XLS', 'XLSX.utils', 'XLSX.read', 'XLSX.writeFile', 'XLSX.readFile',
]);

// ─────────────────────────────────────────────
// ۱. استخراج تمام تعاریف (هم window.X و هم var/function)
// ─────────────────────────────────────────────
const defined = new Map(); // name -> [{file, line, kind}]
files.forEach(f => {
  const c = code[f];
  // ۱) window.X = function
  const winRe = /window\.(\w+)\s*=\s*function/g;
  let m;
  while ((m = winRe.exec(c)) !== null) {
    addDef(defined, m[1], f, c, m.index, 'window');
  }
  // ۲) function NAME
  const funcRe = /^function\s+(\w+)\s*\(/gm;
  while ((m = funcRe.exec(c)) !== null) {
    addDef(defined, m[1], f, c, m.index, 'function');
  }
  // ۳) var/let/const NAME = function
  const varFnRe = /(?:^|\n)\s*(?:var|let|const)\s+(\w+)\s*=\s*function/g;
  while ((m = varFnRe.exec(c)) !== null) {
    addDef(defined, m[1], f, c, m.index, 'var-fn');
  }
  // ۴) var/let/const NAME (آرایه/شیء ثابت)
  const varRe = /(?:^|\n)\s*(?:var|let|const)\s+(\w+)\s*=\s*[\[\{]/g;
  while ((m = varRe.exec(c)) !== null) {
    addDef(defined, m[1], f, c, m.index, 'var-data');
  }
  // ۵) window.X = (arrow)
  const winArr = /window\.(\w+)\s*=\s*\(/g;
  while ((m = winArr.exec(c)) !== null) {
    addDef(defined, m[1], f, c, m.index, 'window-arrow');
  }
  // ۶) const NAME = (arrow)
  const constArr = /(?:^|\n)\s*const\s+(\w+)\s*=\s*\(/g;
  while ((m = constArr.exec(c)) !== null) {
    addDef(defined, m[1], f, c, m.index, 'const-arrow');
  }
});

function addDef(map, name, file, content, pos, kind) {
  if (!map.has(name)) map.set(name, []);
  map.get(name).push({
    file, line: content.substring(0, pos).split('\n').length, kind
  });
}

console.log(`✓ ${defined.size} نام تعریف‌شده یافت شد`);

// ─────────────────────────────────────────────
// ۲. یافتن فراخوانی‌ها
// ─────────────────────────────────────────────
const refs = new Map(); // name -> [{file, line, context}]
files.forEach(f => {
  const c = code[f];
  // فراخوانی: NAME( که در آن NAME از قبل در خط نباشد (تعریف نیست)
  const re = /(?<![.\w$])([a-zA-Z_$][\w$]{2,})\s*\(/g;
  let m;
  while ((m = re.exec(c)) !== null) {
    const name = m[1];
    // فیلتر
    if (KEYWORDS.has(name)) continue;
    if (BROWSER_GLOBALS.has(name)) continue;
    if (defined.has(name)) continue;
    // بررسی خط: اگر تعریف است skip
    const lineStart = c.lastIndexOf('\n', m.index) + 1;
    const lineEnd = c.indexOf('\n', m.index);
    const line = c.substring(lineStart, lineEnd === -1 ? c.length : lineEnd);
    if (line.trim().startsWith('//')) continue;
    if (line.trim().startsWith('/*')) continue;
    if (line.trim().startsWith('*')) continue;
    // اگر در comment چندخطی است
    // بررسی ساده: تعداد /* قبل از index - تعداد */ قبل از index
    const before = c.substring(0, m.index);
    const openComments = (before.match(/\/\*/g) || []).length;
    const closeComments = (before.match(/\*\//g) || []).length;
    if (openComments > closeComments) continue;
    // اگر در string است (ساده: تعداد quoteهای جفت‌نشده در خط)
    const quotes = (line.match(/['"`]/g) || []).length;
    if (quotes % 2 !== 0) {
      // احتمالا در string — skip
      continue;
    }
    // اگر new است
    if (c.substring(m.index - 4, m.index) === 'new ') continue;
    if (/\bnew\s+$/.test(c.substring(Math.max(0, m.index - 10), m.index))) continue;
    // اگر متد شیء است (بعد از dot)
    if (m.index > 0 && c[m.index - 1] === '.') continue;
    if (m.index > 0 && c[m.index - 1] === '[') continue;
    if (m.index > 0 && c[m.index - 1] === '"') continue;
    if (m.index > 0 && c[m.index - 1] === "'") continue;
    if (m.index > 0 && c[m.index - 1] === '`') continue;
    // ثبت
    if (!refs.has(name)) refs.set(name, []);
    refs.get(name).push({
      file: f,
      line: c.substring(0, m.index).split('\n').length,
      code: line.trim().substring(0, 120)
    });
  }
});

console.log(`\n=== فراخوانی‌های ناشناس ===`);
const unique = Array.from(refs.entries())
  .map(([name, list]) => ({ name, count: list.length, list }))
  .filter(x => x.count >= 2)
  .sort((a, b) => b.count - a.count);

console.log(`⚠️  ${unique.length} نام تعریف‌نشده با ≥۲ استفاده:\n`);
unique.slice(0, 50).forEach(({ name, count, list }) => {
  console.log(`  🔴 ${name} (${count}×) → ${list[0].file}:${list[0].line}`);
  console.log(`     ${list[0].code}`);
});

fs.writeFileSync(
  path.join(__dirname, 'phase1-broken-refs.json'),
  JSON.stringify({
    defined: Array.from(defined.keys()),
    broken: unique,
    summary: { defined: defined.size, broken: unique.length }
  }, null, 2)
);
console.log(`\n💾 ذخیره شد: phase1-broken-refs.json`);
