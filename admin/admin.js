/* DFK Caffetteria – administration tweaks for Decap CMS:
   1) the left bar shows one section of the form at a time,
   2) the preview pane runs the real website and shows unsaved edits live. */

const store = {
  get(k, d){ try { return localStorage.getItem(k) || d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
};

/* ---------- left bar ---------- */
(() => {
  const nav = document.getElementById('dfk-nav'), rule = document.getElementById('dfk-sec-style');
  const buttons = [...nav.querySelectorAll('[data-sec]')];
  const PANE = '[class*="-ControlPaneContainer"] > [class*="-ControlContainer"]';
  let current = store.get('dfk-sec', 'hero');

  function show(sec, fromClick){
    current = sec; store.set('dfk-sec', sec);
    buttons.forEach(b => b.classList.toggle('on', b.dataset.sec === sec));
    // top-level fields carry ids like "menu-field-12"; hide every section but the chosen one
    rule.textContent = `${PANE}:not(:has(> [class*="-ControlTopbar"] > label[for^="${sec}-field-"])){display:none}`;
    if(fromClick){
      const pane = document.querySelector('[class*="-ControlPaneContainer"]');  // the scrolling one
      if(pane) pane.scrollTop = 0;
      if(window.dfkPreviewGoto) window.dfkPreviewGoto(sec);
    }
  }
  buttons.forEach(b => b.addEventListener('click', () => show(b.dataset.sec, true)));
  show(current);

  // the bar belongs to the entry editor only (not the login or collection screens)
  const sync = () => document.body.classList.toggle('dfk-editing', !!document.querySelector('[class*="-EditorContainer"]'));
  new MutationObserver(sync).observe(document.body, {childList: true, subtree: true});
  sync();
  window.dfkCurrentSection = () => current;
})();

/* ---------- live preview ---------- */
const SITE = new URL('../?cms-preview', location.href).href;
const DEVICES = {desktop: {w: 1280, h: 800, label: 'Počítač'}, mobile: {w: 390, h: 844, label: 'Mobil'}};

// first changed section between two versions of the data (beats and photos one level deeper)
function changedSection(a, b){
  for(const k of Object.keys(b)){
    if(JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
    if((k === 'beats' || k === 'gallery') && b[k] && a[k]){
      for(const s of Object.keys(b[k])) if(JSON.stringify(a[k][s]) !== JSON.stringify(b[k][s])) return k + '.' + s;
    }
    return k;
  }
  return null;
}

const Preview = createClass({
  getInitialState(){ return {device: store.get('dfk-device', 'desktop'), w: 0, h: 0}; },
  componentDidMount(){
    this.win = this.stage.ownerDocument.defaultView;
    this.onResize = () => this.measure();
    this.win.addEventListener('resize', this.onResize);
    this.measure();
    this.last = window.dfkCurrentSection ? window.dfkCurrentSection() : null;
    window.dfkPreviewGoto = key => { this.last = key; const s = this.site(); if(s) s.goto(key); };
  },
  componentWillUnmount(){
    this.win.removeEventListener('resize', this.onResize);
    window.dfkPreviewGoto = null;
  },
  componentDidUpdate(){ this.push(); },
  measure(){
    if(!this.stage) return;
    const r = this.stage.getBoundingClientRect();
    if(Math.round(r.width) !== this.state.w || Math.round(r.height) !== this.state.h) this.setState({w: Math.round(r.width), h: Math.round(r.height)});
  },
  site(){ const f = this.frame; try { return f && f.contentWindow && f.contentWindow.dfkPreview; } catch(e){ return null; } },
  data(){
    const d = this.props.entry.getIn(['data']).toJS();
    // photos uploaded but not yet published exist only in the browser
    if(d.gallery) for(const g of Object.values(d.gallery)){
      if(g && g.image && /^\/?images\/uploads\//.test(g.image)){
        const a = this.props.getAsset(g.image), url = a && String(a);
        if(url) g.image = url;
      }
    }
    return d;
  },
  push(){
    const s = this.site(); if(!s) return;
    const d = this.data(), json = JSON.stringify(d);
    if(json === this.sent) return;
    const prev = this.prev; this.sent = json; this.prev = d;
    s.apply(JSON.parse(json));
    // follow the edit: scroll the website to the part being changed
    const k = prev && changedSection(prev, d);
    if(k && k !== this.last){ this.last = k; s.goto(k); }
  },
  onLoad(){
    this.sent = null; this.push();
    const s = this.site(); if(s && this.last) s.goto(this.last);
  },
  setDevice(device){ store.set('dfk-device', device); this.setState({device}); },
  render(){
    const {device, w, h: ht} = this.state, dev = DEVICES[device];
    let frame = null;
    if(w && ht){
      let style;
      if(device === 'desktop'){
        const s = w / dev.w;
        style = {width: dev.w + 'px', height: (ht / s) + 'px', transform: `scale(${s})`, left: 0, top: 0};
      } else {
        const s = Math.min(1, (ht - 40) / dev.h, (w - 40) / dev.w);
        style = {width: dev.w + 'px', height: dev.h + 'px', transform: `scale(${s})`, left: ((w - dev.w * s) / 2) + 'px', top: '20px'};
      }
      frame = h('div', {className: 'pv-device pv-' + device, style},
        h('iframe', {key: device, src: SITE, title: 'Náhled webu', ref: el => { this.frame = el; }, onLoad: () => this.onLoad()}));
    }
    return h('div', {className: 'pv'},
      h('div', {className: 'pv-bar'},
        h('span', {className: 'pv-live'}, h('i'), 'Živý náhled'),
        h('div', {className: 'pv-seg'}, Object.keys(DEVICES).map(k =>
          h('button', {key: k, type: 'button', className: k === device ? 'on' : '', onClick: () => this.setDevice(k)}, DEVICES[k].label)))),
      h('div', {className: 'pv-stage', ref: el => { this.stage = el; }}, frame));
  }
});

CMS.registerPreviewTemplate('site', Preview);
CMS.registerPreviewStyle(`
  html,body{margin:0;height:100%;overflow:hidden}
  .pv{position:fixed;inset:0;display:flex;flex-direction:column;background:#E9E4DA;font-family:Jost,"Segoe UI",system-ui,sans-serif}
  .pv-bar{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:10px 72px 10px 16px;background:#F6F2EA;border-bottom:1px solid #DDD5C6;font-size:13px;color:#2B1D14}
  .pv-live{display:inline-flex;align-items:center;gap:8px;font-weight:500;letter-spacing:.02em}
  .pv-live i{width:8px;height:8px;border-radius:50%;background:#3E9B57;box-shadow:0 0 0 3px rgba(62,155,87,.2)}
  .pv-seg{display:inline-flex;background:#E4DDCF;border-radius:999px;padding:3px}
  .pv-seg button{font:inherit;font-size:13px;border:0;background:transparent;color:#5A4A3C;padding:5px 14px;border-radius:999px;cursor:pointer}
  .pv-seg button.on{background:#0F1C11;color:#F1E7D6}
  .pv-stage{position:relative;flex:1;overflow:hidden}
  .pv-device{position:absolute;transform-origin:0 0;background:#0F1C11}
  .pv-mobile{border-radius:36px;overflow:hidden;box-shadow:0 0 0 10px #1A1A1A,0 20px 50px rgba(0,0,0,.35)}
  .pv-device iframe{display:block;width:100%;height:100%;border:0}
`, {raw: true});
