/**
 * The desktop sidebar's collapsed state, as it exists before React does.
 *
 * The choice lives in localStorage and is mirrored as `data-sidebar` on
 * <html>. Widths and label visibility are CSS keyed off that attribute, not
 * React state, so the inline script below can put it in place before the
 * first paint: a collapsed rail that rendered expanded on the server and
 * snapped shut on hydration would shove the whole page sideways on every
 * load.
 *
 * Plain constants with no React import, because the root layout (a server
 * component) inlines the script. `use-sidebar.ts` is the client side.
 */

export const SIDEBAR_STORAGE_KEY = "playora:sidebar";
export const SIDEBAR_ATTRIBUTE = "data-sidebar";
export const SIDEBAR_COLLAPSED = "collapsed";

/**
 * Inlined into <head> beside the theme bootstrap. Terse and dependency-free
 * for the same reason: it blocks rendering.
 */
export const SIDEBAR_BOOTSTRAP = `(function(){try{if(localStorage.getItem(${JSON.stringify(
  SIDEBAR_STORAGE_KEY,
)})===${JSON.stringify(SIDEBAR_COLLAPSED)})document.documentElement.setAttribute(${JSON.stringify(
  SIDEBAR_ATTRIBUTE,
)},${JSON.stringify(SIDEBAR_COLLAPSED)});}catch(e){}})();`;
