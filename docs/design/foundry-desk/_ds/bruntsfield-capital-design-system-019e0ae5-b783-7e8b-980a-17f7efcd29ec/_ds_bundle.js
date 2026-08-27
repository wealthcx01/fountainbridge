/* @ds-bundle: {"format":4,"namespace":"BruntsfieldCapitalDesignSystem_019e0a","components":[],"sourceHashes":{"ui_kits/website/app.jsx":"dca929b0a4f0","ui_kits/website/article.jsx":"99d95258d137","ui_kits/website/boot.jsx":"83a0108e5a54","ui_kits/website/home.jsx":"ca53ff1a5c02","ui_kits/website/print-boot.jsx":"6696cb60e496","ui_kits/website/sections.jsx":"8e91082f299c"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.BruntsfieldCapitalDesignSystem_019e0a = window.BruntsfieldCapitalDesignSystem_019e0a || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/website/app.jsx
try { (() => {
/* global React */
// Bruntsfield — App shell, routing, header, footer, and shared primitives.

const {
  useState,
  useEffect,
  createContext,
  useContext
} = React;

// ---------- Routing (in-memory) ----------------------------------------
const RouteCtx = createContext({
  route: {
    name: 'home'
  },
  go: () => {}
});
const useRoute = () => useContext(RouteCtx);
function RouteProvider({
  children
}) {
  const [route, setRoute] = useState({
    name: 'home'
  });
  const go = (name, params = {}) => {
    setRoute({
      name,
      ...params
    });
    if (typeof window !== 'undefined') window.scrollTo({
      top: 0,
      behavior: 'auto'
    });
  };
  return /*#__PURE__*/React.createElement(RouteCtx.Provider, {
    value: {
      route,
      go
    }
  }, children);
}

// ---------- Primitives -------------------------------------------------
function Container({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: style
  }, children);
}
function Eyebrow({
  children,
  color,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "eyebrow",
    style: {
      color,
      ...style
    }
  }, children);
}
function PageOpener({
  eyebrow,
  title,
  lede
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "page-opener"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, eyebrow), /*#__PURE__*/React.createElement("h1", null, title), lede && /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, lede));
}
function SectionRule() {
  return /*#__PURE__*/React.createElement("div", {
    className: "section-rule"
  });
}
function Tag({
  children,
  accent,
  dot
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: `tag ${accent ? 'accent' : ''}`
  }, dot && /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), children);
}

// ---------- Header / Nav ----------------------------------------------
const NAV = [{
  num: '01',
  name: 'briefing',
  label: 'Briefing'
}, {
  num: '02',
  name: 'advisory',
  label: 'Advisory'
}, {
  num: '03',
  name: 'foundry',
  label: 'Foundry'
}, {
  num: '04',
  name: 'equity',
  label: 'Equity'
}, {
  num: '§',
  name: 'firm',
  label: 'Firm'
}];
function SiteHeader() {
  const {
    route,
    go
  } = useRoute();
  return /*#__PURE__*/React.createElement("header", {
    className: "site-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "site-header-inner"
  }, /*#__PURE__*/React.createElement("a", {
    className: "site-mark",
    onClick: () => go('home')
  }, /*#__PURE__*/React.createElement("img", {
    className: "site-mark-img",
    src: "../../assets/mark-dragon.png",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", {
    className: "site-mark-text"
  }, "BRUNTSFIELD", /*#__PURE__*/React.createElement("small", null, "CAPITAL"))), /*#__PURE__*/React.createElement("nav", {
    className: "site-nav"
  }, NAV.map(item => /*#__PURE__*/React.createElement("a", {
    key: item.name,
    className: `nav-link ${route.name === item.name ? 'is-active' : ''}`,
    onClick: () => go(item.name)
  }, /*#__PURE__*/React.createElement("span", {
    className: "nav-num"
  }, item.num), item.label))), /*#__PURE__*/React.createElement("button", {
    className: "site-search",
    onClick: () => alert('Search is not wired up in this prototype.')
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/icons/search.svg",
    alt: ""
  }), " Search")));
}

// ---------- Footer ----------------------------------------------------
function SiteFooter() {
  const {
    go
  } = useRoute();
  const link = (name, label) => /*#__PURE__*/React.createElement("a", {
    onClick: () => go(name)
  }, label);
  return /*#__PURE__*/React.createElement("footer", {
    className: "site-footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "site-footer-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("h4", null, "Bruntsfield Capital"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 16,
      lineHeight: 1.6,
      margin: '0 0 14px',
      color: 'var(--ink)',
      maxWidth: '32ch'
    }
  }, "We acquire and operate the financial systems other groups consider too dull to own."), /*#__PURE__*/React.createElement("p", {
    className: "meta",
    style: {
      margin: 0
    }
  }, "34 Bruntsfield Place", /*#__PURE__*/React.createElement("br", null), "Edinburgh EH10 4HJ", /*#__PURE__*/React.createElement("br", null), "United Kingdom")), /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("h4", null, "Sections"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, link('briefing', 'Briefing')), /*#__PURE__*/React.createElement("li", null, link('advisory', 'Advisory')), /*#__PURE__*/React.createElement("li", null, link('foundry', 'Foundry')), /*#__PURE__*/React.createElement("li", null, link('equity', 'Equity')))), /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("h4", null, "Firm"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, link('firm', 'About')), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", null, "Partners")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", null, "Careers")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", null, "Press")))), /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("h4", null, "Contact"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", null, "advisory@bruntsfield.capital")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", null, "briefing@bruntsfield.capital")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", null, "operators@bruntsfield.capital")))), /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("h4", null, "Disclosures"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", null, "Regulatory")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", null, "Privacy")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", null, "Cookies"))))), /*#__PURE__*/React.createElement("div", {
    className: "footer-meta"
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Bruntsfield Capital LLP. Authorised and regulated by the FCA, ref 947213."), /*#__PURE__*/React.createElement("span", null, "Established 2019 \xB7 Edinburgh")));
}

// ---------- App root --------------------------------------------------
function App() {
  return /*#__PURE__*/React.createElement(RouteProvider, null, /*#__PURE__*/React.createElement("div", {
    className: "site"
  }, /*#__PURE__*/React.createElement(SiteHeader, null), /*#__PURE__*/React.createElement("main", {
    className: "site-main"
  }, /*#__PURE__*/React.createElement(PageRouter, null)), /*#__PURE__*/React.createElement(SiteFooter, null)));
}
function PageRouter() {
  const {
    route
  } = useRoute();
  switch (route.name) {
    case 'home':
      return /*#__PURE__*/React.createElement(HomePage, null);
    case 'briefing':
      return /*#__PURE__*/React.createElement(BriefingPage, null);
    case 'advisory':
      return /*#__PURE__*/React.createElement(AdvisoryPage, null);
    case 'foundry':
      return /*#__PURE__*/React.createElement(FoundryPage, null);
    case 'equity':
      return /*#__PURE__*/React.createElement(EquityPage, null);
    case 'firm':
      return /*#__PURE__*/React.createElement(FirmPage, null);
    case 'article':
      return /*#__PURE__*/React.createElement(ArticlePage, {
        slug: route.slug
      });
    default:
      return /*#__PURE__*/React.createElement(HomePage, null);
  }
}

// Expose to other Babel scripts
Object.assign(window, {
  App,
  RouteProvider,
  useRoute,
  Container,
  Eyebrow,
  PageOpener,
  SectionRule,
  Tag,
  SiteHeader,
  SiteFooter
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/article.jsx
try { (() => {
/* global React, useRoute, Container, Eyebrow, ISSUES */

function ArticlePage({
  slug
}) {
  const {
    go
  } = useRoute();
  const issue = ISSUES.find(i => i.slug === slug) || ISSUES[0];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("article", {
    style: {
      paddingTop: 64,
      paddingBottom: 64
    }
  }, /*#__PURE__*/React.createElement(Container, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 32
    }
  }, /*#__PURE__*/React.createElement("a", {
    className: "btn btn-link",
    onClick: () => go('briefing')
  }, "\u2190 Back to Briefing")), /*#__PURE__*/React.createElement("header", {
    style: {
      borderBottom: '1px solid var(--rule)',
      paddingBottom: 32,
      marginBottom: 48,
      maxWidth: '60ch'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      color: 'var(--accent)'
    }
  }, "Issue ", issue.num, " \xA0\xB7\xA0 ", issue.tag), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 400,
      fontSize: 'clamp(36px, 4.5vw, 60px)',
      lineHeight: 1.06,
      letterSpacing: '-0.018em',
      margin: '20px 0'
    }
  }, issue.title), /*#__PURE__*/React.createElement("p", {
    className: "lede",
    style: {
      marginTop: 18
    }
  }, issue.dek), /*#__PURE__*/React.createElement("div", {
    className: "meta",
    style: {
      marginTop: 24,
      display: 'flex',
      gap: 18,
      fontFeatureSettings: '"tnum"'
    }
  }, /*#__PURE__*/React.createElement("span", null, issue.date), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, issue.minutes, " min read"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "By M. R. Harrington & J. Black"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '180px 1fr',
      gap: 56
    }
  }, /*#__PURE__*/React.createElement("aside", null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      top: 96,
      fontFamily: 'var(--mono)',
      fontSize: 11,
      lineHeight: 1.85,
      color: 'var(--ink-mute)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--rule-strong)',
      paddingTop: 10,
      color: 'var(--ink)',
      fontWeight: 500
    }
  }, "I \xA0The set-up"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--rule)',
      paddingTop: 10
    }
  }, "II \xA0What it costs to keep alive"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--rule)',
      paddingTop: 10
    }
  }, "III \xA0Three replacement archetypes"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--rule)',
      paddingTop: 10
    }
  }, "IV \xA0What the firm thinks"))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '62ch'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 500,
      fontSize: 28,
      margin: '0 0 18px'
    }
  }, "I \u2014 The set-up"), /*#__PURE__*/React.createElement("p", null, "The clearing infrastructure that sits behind a meaningful slice of the British financial system was built, in its essentials, in the late 1970s. The hardware has been replaced; the architecture has not. Operators have known this for years and have, in their letters to shareholders, been honest about it."), /*#__PURE__*/React.createElement("p", null, "What has changed in the last eighteen months is the cost of pretending otherwise. ", /*#__PURE__*/React.createElement("strong", null, "Three large incidents"), " \u2014 at Allardyce in February, at a counter-party we will not name in May, and across two settlement windows in October \u2014 were each blamed publicly on operator error. In each case the underlying cause was the same: a system that had not been re-platformed when it should have been, two decades back, plus the staff turnover required to operate it competently in 2026."), /*#__PURE__*/React.createElement("blockquote", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 24,
      lineHeight: 1.45,
      margin: '32px 0',
      paddingLeft: 22,
      borderLeft: '2px solid var(--accent)',
      maxWidth: '52ch'
    }
  }, "The system has not failed. It is the staff trained to operate the system who are retiring, faster than they can be replaced."), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 500,
      fontSize: 28,
      margin: '40px 0 18px'
    }
  }, "II \u2014 What it costs to keep alive"), /*#__PURE__*/React.createElement("p", null, "We have spent the better part of three years inside operators of this kind, and what follows is what we have seen, plainly stated."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 13,
      lineHeight: 1.7,
      color: 'var(--ink-soft)',
      borderLeft: '2px solid var(--accent)',
      padding: '14px 18px',
      margin: '28px 0',
      background: 'var(--paper-deep)'
    }
  }, "Average maintenance cost, large UK clearing operator, FY24 disclosures:", /*#__PURE__*/React.createElement("br", null), "\xA0\xA0Hardware \u2026\u2026\u2026\u2026 \xA3 4.8m", /*#__PURE__*/React.createElement("br", null), "\xA0\xA0Software \u2026\u2026\u2026\u2026\u2026 \xA3 9.6m", /*#__PURE__*/React.createElement("br", null), "\xA0\xA0", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "Specialist staff \u2026 \xA3 38.2m"), /*#__PURE__*/React.createElement("br", null), "\xA0\xA0Vendor support \u2026 \xA3 6.1m"), /*#__PURE__*/React.createElement("p", null, "The cost is in ", /*#__PURE__*/React.createElement("em", null, "people"), ", not technology. Replacement is not, properly understood, an IT project; it is a workforce-transition project with an IT system attached."), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 500,
      fontSize: 28,
      margin: '40px 0 18px'
    }
  }, "III \u2014 Three replacement archetypes"), /*#__PURE__*/React.createElement("p", null, "Three archetypes show up repeatedly. We name them only for ease of reference."), /*#__PURE__*/React.createElement("ol", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 16,
      lineHeight: 1.8,
      paddingLeft: 24
    }
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "The strangler fig."), " Build a parallel system; route traffic across slowly; retire the old one only when it is empty."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "The cut-over."), " Build the parallel; choose a weekend; commit. Used twice in the last decade in the UK; both succeeded."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "The vendor purchase."), " Buy the replacement off-the-shelf and re-skin. Never the right answer for the systems we are talking about, but always considered first by boards.")), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 500,
      fontSize: 28,
      margin: '40px 0 18px'
    }
  }, "IV \u2014 What the firm thinks"), /*#__PURE__*/React.createElement("p", null, "We will, in the next eighteen months, see at least two of the operators in this market change hands. Our position is that the right buyer is one that intends to operate the system for at least a decade, has the patience to fund the workforce transition, and treats the underlying replacement as a project to be done ", /*#__PURE__*/React.createElement("em", null, "once"), ", properly, rather than several times poorly."), /*#__PURE__*/React.createElement("p", null, "If you are a board considering this, you can write to us at advisory@bruntsfield.capital."))))));
}
window.ArticlePage = ArticlePage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/article.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/boot.jsx
try { (() => {
/* global React, ReactDOM, App */
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/boot.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/home.jsx
try { (() => {
/* global React, useRoute, Container, Eyebrow, ISSUES, FOUNDRY_PROJECTS */

function HomePage() {
  const {
    go
  } = useRoute();
  const featured = ISSUES.slice(0, 3);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '96px 0 64px',
      borderBottom: '1px solid var(--rule)'
    }
  }, /*#__PURE__*/React.createElement(Container, null, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      color: 'var(--accent)'
    }
  }, "Bruntsfield Capital \xB7 Established 2019 \xB7 Edinburgh"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 400,
      fontSize: 'clamp(48px, 6vw, 88px)',
      lineHeight: 1.04,
      letterSpacing: '-0.02em',
      margin: '36px 0 0',
      maxWidth: '20ch'
    }
  }, "Capital, patiently applied to the financial systems other groups consider too dull to own."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 64,
      marginTop: 56,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "lede",
    style: {
      margin: 0
    }
  }, "We acquire and operate legacy financial infrastructure. We publish what we learn. We back operators who want to do the same."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 13,
      lineHeight: 1.9,
      color: 'var(--ink-soft)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--rule-strong)',
      paddingTop: 12
    }
  }, "\xA3 412m under management"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--rule)',
      paddingTop: 12
    }
  }, "4 operating positions"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--rule)',
      paddingTop: 12
    }
  }, "14 issues of Briefing published"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--rule)',
      paddingTop: 12
    }
  }, "Single office, Edinburgh"))))), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '80px 0'
    }
  }, /*#__PURE__*/React.createElement(Container, null, /*#__PURE__*/React.createElement(Eyebrow, null, "The four arms"), /*#__PURE__*/React.createElement("div", {
    className: "grid-4",
    style: {
      marginTop: 28
    }
  }, [{
    num: '01',
    name: 'briefing',
    title: 'Briefing',
    copy: 'A monthly publication on the structure of legacy financial infrastructure. Read by limited partners, regulators, and operators.'
  }, {
    num: '02',
    name: 'advisory',
    title: 'Advisory',
    copy: 'Engagements with boards and operators of legacy systems. Six to ten weeks. Fixed price. A written brief at the end.'
  }, {
    num: '03',
    name: 'foundry',
    title: 'Foundry',
    copy: 'A venture studio that builds the systems we cannot acquire. In-house teams, paired with operators who have done the work before.'
  }, {
    num: '04',
    name: 'equity',
    title: 'Equity',
    copy: 'A book of operating positions in regulated, ageing financial businesses. Long holds. Patient capital, plainly applied.'
  }].map(arm => /*#__PURE__*/React.createElement("a", {
    key: arm.name,
    onClick: () => go(arm.name),
    style: {
      display: 'block',
      textDecoration: 'none',
      color: 'inherit',
      borderTop: '1px solid var(--rule-strong)',
      paddingTop: 18,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 12,
      color: 'var(--accent)',
      letterSpacing: '0.06em'
    }
  }, arm.num), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 500,
      fontSize: 28,
      margin: '12px 0',
      letterSpacing: '-0.005em'
    }
  }, arm.title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 14,
      lineHeight: 1.65,
      color: 'var(--ink-soft)',
      margin: 0
    }
  }, arm.copy), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--accent)',
      marginTop: 18
    }
  }, "Read more \u2192")))))), /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--accent)',
      color: 'var(--paper)',
      padding: '64px 0'
    }
  }, /*#__PURE__*/React.createElement(Container, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: 40,
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      color: 'rgba(247,246,242,0.7)'
    }
  }, "From the firm prospectus"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 'clamp(26px, 3vw, 38px)',
      lineHeight: 1.3,
      color: 'var(--paper)',
      margin: 0,
      maxWidth: '34ch',
      letterSpacing: '-0.01em'
    }
  }, "We are not in the business of disruption. We are in the business of careful, profitable replacement of systems that the rest of the market would prefer not to think about.")))), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '80px 0'
    }
  }, /*#__PURE__*/React.createElement(Container, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "From Briefing \u2014 May 2026"), /*#__PURE__*/React.createElement("a", {
    onClick: () => go('briefing'),
    className: "btn btn-link"
  }, "All issues \u2192")), /*#__PURE__*/React.createElement("div", {
    className: "grid-3"
  }, featured.map(i => /*#__PURE__*/React.createElement("a", {
    key: i.slug,
    className: "article-card",
    onClick: () => go('article', {
      slug: i.slug
    })
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "Issue ", i.num, " \xA0\xB7\xA0 ", i.tag), /*#__PURE__*/React.createElement("h3", null, i.title), /*#__PURE__*/React.createElement("p", null, i.dek), /*#__PURE__*/React.createElement("div", {
    className: "article-meta"
  }, i.date, " \xB7 ", i.minutes, " min read")))))), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '64px 0',
      borderTop: '1px solid var(--rule)'
    }
  }, /*#__PURE__*/React.createElement(Container, null, /*#__PURE__*/React.createElement("div", {
    className: "grid-2",
    style: {
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Currently in production at Foundry"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 400,
      fontSize: 36,
      lineHeight: 1.15,
      marginTop: 20,
      letterSpacing: '-0.012em',
      maxWidth: '24ch'
    }
  }, "Four projects, three of them already operating inside our portfolio.")), /*#__PURE__*/React.createElement("div", {
    className: "stack-3"
  }, FOUNDRY_PROJECTS.slice(0, 3).map(p => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    style: {
      borderTop: '1px solid var(--rule)',
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 500,
      fontSize: 22,
      margin: 0
    }
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "meta",
    style: {
      color: 'var(--accent)'
    }
  }, p.status)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 14,
      color: 'var(--ink-soft)',
      lineHeight: 1.6,
      margin: '10px 0 0',
      maxWidth: '52ch'
    }
  }, p.desc))), /*#__PURE__*/React.createElement("a", {
    onClick: () => go('foundry'),
    className: "btn btn-link",
    style: {
      marginTop: 16,
      display: 'inline-block'
    }
  }, "View all of Foundry \u2192"))))));
}
window.HomePage = HomePage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/home.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/print-boot.jsx
try { (() => {
/* global React, ReactDOM,
          RouteProvider, SiteHeader, SiteFooter,
          HomePage, BriefingPage, AdvisoryPage, FoundryPage, EquityPage, FirmPage,
          ArticlePage, ISSUES */

// Print boot — render every section stacked, with page breaks between them.
// We mount each page inside its own RouteProvider so internal "go" calls
// remain inert (they just update local state; we never read the route).

function PrintSection({
  children
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "print-section"
  }, children);
}
function PrintApp() {
  const Section = ({
    children
  }) => /*#__PURE__*/React.createElement("div", {
    className: "print-section"
  }, /*#__PURE__*/React.createElement(RouteProvider, null, /*#__PURE__*/React.createElement("div", {
    className: "site"
  }, /*#__PURE__*/React.createElement(SiteHeader, null), /*#__PURE__*/React.createElement("main", {
    className: "site-main"
  }, children), /*#__PURE__*/React.createElement(SiteFooter, null))));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(HomePage, null)), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(BriefingPage, null)), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(ArticlePage, {
    slug: ISSUES[0].slug
  })), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(AdvisoryPage, null)), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(FoundryPage, null)), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(EquityPage, null)), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(FirmPage, null)));
}

// Auto-print is enabled after verifying — set ENABLE_AUTOPRINT = true.
const ENABLE_AUTOPRINT = true;
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(PrintApp, null));
(async () => {
  if (!ENABLE_AUTOPRINT) return;
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch (e) {}
  await new Promise(r => setTimeout(r, 800));
  window.print();
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/print-boot.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/sections.jsx
try { (() => {
/* global React, useRoute, Container, Eyebrow, PageOpener, Tag */

// ---------- Sample data, shared across pages -----------------------------
const ISSUES = [{
  slug: 'legacy-clearing',
  num: '14',
  date: 'May 2026',
  title: 'On the slow death of legacy clearing.',
  dek: 'Why settlement infrastructure built for the 1970s is finally retiring — and what it costs to keep it alive in the meantime.',
  minutes: 18,
  section: 'Briefing',
  tag: 'Market structure'
}, {
  slug: 'custody-dual-rail',
  num: '13',
  date: 'April 2026',
  title: 'A dual-rail thesis for institutional custody.',
  dek: 'Two rails — one regulated, one programmable — and the case for owning both.',
  minutes: 22,
  section: 'Briefing',
  tag: 'Custody'
}, {
  slug: 'ifrs-9',
  num: '12',
  date: 'March 2026',
  title: 'IFRS 9, eight years on.',
  dek: 'Reading bank disclosures with the standard\u2019s incentives held in mind.',
  minutes: 11,
  section: 'Briefing',
  tag: 'Accounting'
}, {
  slug: 'fca-prin-12',
  num: '11',
  date: 'February 2026',
  title: 'Consumer Duty was a corporate restructuring.',
  dek: 'How PRIN 2A reorganised retail incumbents from the inside, regardless of intent.',
  minutes: 16,
  section: 'Briefing',
  tag: 'Regulation'
}, {
  slug: 'edinburgh',
  num: '10',
  date: 'January 2026',
  title: 'Why Edinburgh.',
  dek: 'A note on the firm\u2019s home, and what it costs to run a capital group from outside London.',
  minutes: 6,
  section: 'Briefing',
  tag: 'Firm'
}, {
  slug: 'q4-letter',
  num: '09',
  date: 'December 2025',
  title: 'Letter to limited partners — Q4 2025.',
  dek: 'Four positions added, one exited, one essay we got wrong.',
  minutes: 9,
  section: 'Briefing',
  tag: 'LP letter'
}];
const HOLDINGS = [{
  name: 'Allardyce & Co.',
  vintage: 2022,
  sector: 'Clearing',
  position: '£ 84.0m',
  note: 'Operating'
}, {
  name: 'Murchison Trust',
  vintage: 2023,
  sector: 'Custody',
  position: '£ 142.0m',
  note: 'Operating'
}, {
  name: 'Hexham & Bell',
  vintage: 2024,
  sector: 'Settlement',
  position: '£ 58.0m',
  note: 'Operating'
}, {
  name: 'Bilge',
  vintage: 2025,
  sector: 'Banking rails',
  position: '£ 128.0m',
  note: 'Operating · ex-Foundry'
}, {
  name: 'Two Rivers',
  vintage: 2026,
  sector: 'Custody',
  position: '—',
  note: 'In diligence'
}];
const FOUNDRY_PROJECTS = [{
  name: 'Bilge',
  status: 'In production',
  desc: 'A successor to corporate banking rails. Replaces an in-house ledger that ran on a Sun box for fifteen years. Now operating for two of our portfolio companies and one outside operator.',
  discipline: 'Banking · ledger',
  team: '11 engineers, 2 lawyers'
}, {
  name: 'Hexham OS',
  status: 'In production',
  desc: 'Settlement operations dashboard. Built originally for Hexham & Bell after acquisition; now the operating layer across three of our holdings.',
  discipline: 'Operations',
  team: '6 engineers, 1 designer'
}, {
  name: 'Allardyce M',
  status: 'Beta',
  desc: 'A recut of the FIX-message tooling that sits behind Allardyce. Modernising the slowest, oldest cost line on its books.',
  discipline: 'Clearing',
  team: '4 engineers'
}, {
  name: 'Two Rivers',
  status: 'Studio phase',
  desc: 'Custody for institutions that hold both regulated and programmable assets. In discussion with three potential first customers.',
  discipline: 'Custody',
  team: '3 engineers, 1 lawyer'
}];
const ENGAGEMENTS = [{
  kind: 'Operator review',
  desc: 'A 6\u201310 week diligence on a single legacy system, ending in a written brief: keep, replace, or sell.',
  audience: 'Boards, audit committees, holding companies.'
}, {
  kind: 'Replacement scoping',
  desc: 'Working with operators who have decided to replace, scoped end-to-end: vendors, build vs. buy, sequencing, regulatory path.',
  audience: 'CEOs, CFOs, COOs, programme owners.'
}, {
  kind: 'Transaction support',
  desc: 'Pre- and post-close work on acquisitions or carve-outs of legacy operators. Almost always alongside Equity.',
  audience: 'PE sponsors, internal corp-dev, trustees.'
}];

// ============== BRIEFING ===============================================
function BriefingPage() {
  const {
    go
  } = useRoute();
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageOpener, {
    eyebrow: "01 \u2014 Briefing",
    title: "An institutional record of how legacy financial infrastructure changes hands.",
    lede: "Briefing is the firm\\u2019s publication. We use it to put down what we have learned, in plain language. Issued monthly. Read by limited partners, regulators, and the operators we work with."
  }), /*#__PURE__*/React.createElement(Container, {
    style: {
      marginTop: 56
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Current issue"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 36,
      fontWeight: 400,
      lineHeight: 1.15,
      letterSpacing: '-0.012em',
      margin: '12px 0 16px',
      maxWidth: '24ch'
    }
  }, ISSUES[0].title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 16,
      lineHeight: 1.7,
      color: 'var(--ink-soft)',
      maxWidth: '52ch'
    }
  }, ISSUES[0].dek), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: 'flex',
      gap: 14,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => go('article', {
      slug: ISSUES[0].slug
    })
  }, "Read the brief \u2192"), /*#__PURE__*/React.createElement("span", {
    className: "meta"
  }, "Issue ", ISSUES[0].num, " \xB7 ", ISSUES[0].date, " \xB7 ", ISSUES[0].minutes, " min"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Subscribe"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 15,
      lineHeight: 1.7,
      color: 'var(--ink-soft)',
      marginTop: 12,
      maxWidth: '40ch'
    }
  }, "One email when an issue is published. Nothing else. We do not share the list."), /*#__PURE__*/React.createElement("form", {
    style: {
      marginTop: 20
    },
    onSubmit: e => {
      e.preventDefault();
      alert('Subscribed (prototype).');
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "email",
    required: true,
    placeholder: "you@firm.com",
    style: {
      width: '100%',
      fontFamily: 'var(--sans)',
      fontSize: 16,
      border: 0,
      borderBottom: '1px solid var(--rule-strong)',
      padding: '10px 0',
      background: 'transparent',
      outline: 'none',
      color: 'var(--ink)'
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    type: "submit",
    style: {
      marginTop: 16
    }
  }, "Subscribe")))), /*#__PURE__*/React.createElement("div", {
    className: "section-rule"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 40
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "All issues"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, ISSUES.map(i => /*#__PURE__*/React.createElement("a", {
    key: i.slug,
    className: "article-card",
    onClick: () => go('article', {
      slug: i.slug
    })
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "Issue ", i.num, " \xA0\xB7\xA0 ", i.tag), /*#__PURE__*/React.createElement("h3", null, i.title), /*#__PURE__*/React.createElement("p", null, i.dek), /*#__PURE__*/React.createElement("div", {
    className: "article-meta"
  }, i.date, " \xB7 ", i.minutes, " min read")))))));
}

// ============== ADVISORY ==============================================
function AdvisoryPage() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageOpener, {
    eyebrow: "02 \u2014 Advisory",
    title: "We are paid to help operators decide whether to keep the system, replace it, or sell it.",
    lede: "Advisory is how the firm earns its keep. The work is narrow on purpose: legacy infrastructure, in financial services, where there is a real decision to be made."
  }), /*#__PURE__*/React.createElement(Container, {
    style: {
      marginTop: 56
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Engagement types"), /*#__PURE__*/React.createElement("div", {
    className: "grid-3",
    style: {
      marginTop: 20
    }
  }, ENGAGEMENTS.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.kind,
    style: {
      borderTop: '1px solid var(--rule)',
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 500,
      fontSize: 22,
      margin: '0 0 12px',
      letterSpacing: '-0.005em'
    }
  }, e.kind), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 15,
      lineHeight: 1.65,
      color: 'var(--ink-soft)',
      margin: '0 0 16px'
    }
  }, e.desc), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 12,
      color: 'var(--ink-mute)',
      margin: 0
    }
  }, e.audience)))), /*#__PURE__*/React.createElement("div", {
    className: "section-rule"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "How it works"), /*#__PURE__*/React.createElement("ol", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 16,
      lineHeight: 1.8,
      color: 'var(--ink)',
      marginTop: 16,
      paddingLeft: 0,
      listStyle: 'none',
      counterReset: 'step',
      maxWidth: '52ch'
    }
  }, ['A 90-minute conversation, no fee, to establish whether the engagement is one we can take.', 'A written scope and a fixed price. We do not bill by the hour for first engagements.', 'Six to ten weeks of work, against a written brief, ending in a document the board can act on.', 'A follow-up at month six, included in the price, to mark progress against the brief.'].map((t, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      counterIncrement: 'step',
      position: 'relative',
      paddingLeft: 36,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 0,
      top: 4,
      fontFamily: 'var(--mono)',
      fontSize: 13,
      color: 'var(--accent)'
    }
  }, String(i + 1).padStart(2, '0')), t)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Speak with Advisory"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      lineHeight: 1.5,
      color: 'var(--ink)',
      marginTop: 16,
      maxWidth: '36ch'
    }
  }, "If you operate one of these systems, write to us."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 15,
      lineHeight: 1.7,
      color: 'var(--ink-soft)',
      maxWidth: '40ch'
    }
  }, "A short note about the system in question and the decision in front of you is enough to begin. We respond within five working days."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: 'flex',
      gap: 14,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("a", {
    className: "btn btn-primary"
  }, "advisory@bruntsfield.capital"), /*#__PURE__*/React.createElement("span", {
    className: "meta"
  }, "+44 131 558 0014")))))));
}

// ============== FOUNDRY ===============================================
function FoundryPage() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageOpener, {
    eyebrow: "03 \u2014 Foundry",
    title: "We build the systems we cannot acquire.",
    lede: "Foundry is the venture studio. It exists for the cases where the right answer is not to acquire an operator and modernise it, but to build the replacement ourselves."
  }), /*#__PURE__*/React.createElement(Container, {
    style: {
      marginTop: 56
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Projects"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, FOUNDRY_PROJECTS.map((p, idx) => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    style: {
      borderTop: '1px solid var(--rule)',
      borderBottom: idx === FOUNDRY_PROJECTS.length - 1 ? '1px solid var(--rule)' : 'none',
      padding: '24px 0',
      display: 'grid',
      gridTemplateColumns: '160px 1fr 200px',
      gap: 32,
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 500,
      fontSize: 26,
      margin: 0,
      letterSpacing: '-0.005em'
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    accent: true,
    dot: true
  }, p.status))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 15,
      lineHeight: 1.7,
      color: 'var(--ink-soft)',
      margin: 0,
      maxWidth: '60ch'
    }
  }, p.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 12,
      color: 'var(--ink-mute)',
      lineHeight: 1.7
    }
  }, /*#__PURE__*/React.createElement("div", null, p.discipline), /*#__PURE__*/React.createElement("div", null, p.team))))), /*#__PURE__*/React.createElement("div", {
    className: "section-rule"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 40
    },
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "For founders"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      lineHeight: 1.5,
      color: 'var(--ink)',
      marginTop: 16,
      maxWidth: '36ch'
    }
  }, "We build with people who have done the work before, in this part of the industry, and want to do it again with capital and patience."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 15,
      lineHeight: 1.7,
      color: 'var(--ink-soft)',
      maxWidth: '52ch'
    }
  }, "If that is you \u2014 particularly if you have come out of a regulated operator and have an idea for the boring part \u2014 write to us."), /*#__PURE__*/React.createElement("a", {
    className: "btn btn-primary",
    style: {
      marginTop: 14
    }
  }, "foundry@bruntsfield.capital")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "What we do not do"), /*#__PURE__*/React.createElement("ul", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 15,
      lineHeight: 1.85,
      color: 'var(--ink-soft)',
      marginTop: 16,
      paddingLeft: 0,
      listStyle: 'none',
      maxWidth: '50ch'
    }
  }, ['Consumer products.', 'Anything that depends on a token launch to make sense.', 'Engagements without operators co-founding alongside us.', 'Cosmetic re-skins of vendor products.'].map((t, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      borderTop: '1px solid var(--rule)',
      padding: '10px 0'
    }
  }, t)))))));
}

// ============== EQUITY ===============================================
function EquityPage() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageOpener, {
    eyebrow: "04 \u2014 Equity",
    title: "A book of operating positions in legacy financial infrastructure.",
    lede: "Equity is the acquisitions arm. We take significant minority or full positions in operators of legacy systems, and stay in for a long time."
  }), /*#__PURE__*/React.createElement(Container, {
    style: {
      marginTop: 56
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid-3",
    style: {
      marginBottom: 56
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "Assets under management",
    value: "\xA3 412m",
    note: "As of Q1 2026"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Operating positions",
    value: "4",
    note: "Plus one in diligence"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Average hold",
    value: "9 yrs",
    note: "Internal target: 8\\u201312"
  })), /*#__PURE__*/React.createElement(Eyebrow, null, "Holdings"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "editorial"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Holding"), /*#__PURE__*/React.createElement("th", {
    style: {
      width: 80
    }
  }, "Vintage"), /*#__PURE__*/React.createElement("th", null, "Sector"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Position"))), /*#__PURE__*/React.createElement("tbody", null, HOLDINGS.map(h => /*#__PURE__*/React.createElement("tr", {
    key: h.name
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 18
    }
  }, h.name), /*#__PURE__*/React.createElement("td", {
    className: "meta"
  }, h.vintage), /*#__PURE__*/React.createElement("td", {
    className: "meta"
  }, h.sector), /*#__PURE__*/React.createElement("td", {
    className: "meta"
  }, h.note), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, h.position)))))), /*#__PURE__*/React.createElement("div", {
    className: "section-rule"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 40
    },
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "What we look for"), /*#__PURE__*/React.createElement("ul", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 15,
      lineHeight: 1.85,
      color: 'var(--ink-soft)',
      marginTop: 16,
      paddingLeft: 0,
      listStyle: 'none',
      maxWidth: '50ch'
    }
  }, ['Operators of regulated, ageing financial systems with cash flow that has held up.', 'Owners who want a long-dated home for the asset, not a flip.', 'Boards that recognise the system needs work, and want a partner to do it.', 'Capital structures that allow for slow rebuilding.'].map((t, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      borderTop: '1px solid var(--rule)',
      padding: '10px 0'
    }
  }, t)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Approach a sale"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      lineHeight: 1.5,
      color: 'var(--ink)',
      marginTop: 16,
      maxWidth: '36ch'
    }
  }, "If you are considering a transaction, write to us before you appoint advisors."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 15,
      lineHeight: 1.7,
      color: 'var(--ink-soft)',
      maxWidth: '52ch'
    }
  }, "We have closed every transaction we have started since 2022. We do not run public processes."), /*#__PURE__*/React.createElement("a", {
    className: "btn btn-primary",
    style: {
      marginTop: 14
    }
  }, "operators@bruntsfield.capital")))));
}
function Stat({
  label,
  value,
  note
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--rule-strong)',
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--ink-soft)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 56,
      lineHeight: 1.05,
      marginTop: 12,
      letterSpacing: '-0.02em',
      fontFeatureSettings: '"tnum"'
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 12,
      color: 'var(--ink-mute)',
      marginTop: 8
    }
  }, note));
}

// ============== FIRM =================================================
function FirmPage() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageOpener, {
    eyebrow: "\xA7 \u2014 Firm",
    title: "A small group of operators, lawyers, and engineers, working out of Edinburgh.",
    lede: "Bruntsfield Capital was established in 2019 to acquire, build, and modernise legacy financial infrastructure. The firm is partner-owned and partner-run."
  }), /*#__PURE__*/React.createElement(Container, {
    style: {
      marginTop: 56
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Partners"), /*#__PURE__*/React.createElement("div", {
    className: "grid-3",
    style: {
      marginTop: 20,
      marginBottom: 56
    }
  }, [{
    name: 'M. R. Harrington',
    title: 'Founding partner',
    note: 'Previously: Allardyce & Co. (head of clearing).'
  }, {
    name: 'A. Skene',
    title: 'Partner, Equity',
    note: 'Previously: Murchison Trust (chief operating officer).'
  }, {
    name: 'I. Vaughan',
    title: 'Partner, Foundry',
    note: 'Previously: Bilge (founder); HSBC (engineering).'
  }, {
    name: 'S. Llewelyn',
    title: 'Partner, Advisory',
    note: 'Previously: Linklaters; Bank of England.'
  }, {
    name: 'P. M. Cardross',
    title: 'General counsel',
    note: 'Previously: FCA (head of authorisations).'
  }, {
    name: 'J. Black',
    title: 'Editor, Briefing',
    note: 'Previously: Financial Times; Reuters Breakingviews.'
  }].map(p => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    style: {
      borderTop: '1px solid var(--rule)',
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: '-0.005em'
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginTop: 6
    }
  }, p.title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 14,
      lineHeight: 1.65,
      color: 'var(--ink-soft)',
      margin: '12px 0 0',
      maxWidth: '34ch'
    }
  }, p.note)))), /*#__PURE__*/React.createElement("div", {
    className: "section-rule"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 40
    },
    className: "grid-2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Address"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      lineHeight: 1.5,
      marginTop: 14,
      color: 'var(--ink)'
    }
  }, "34 Bruntsfield Place", /*#__PURE__*/React.createElement("br", null), "Edinburgh EH10 4HJ", /*#__PURE__*/React.createElement("br", null), "United Kingdom"), /*#__PURE__*/React.createElement("p", {
    className: "meta",
    style: {
      marginTop: 12
    }
  }, "By appointment only.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Registration"), /*#__PURE__*/React.createElement("table", {
    className: "editorial",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "meta",
    style: {
      width: 220
    }
  }, "Legal entity"), /*#__PURE__*/React.createElement("td", null, "Bruntsfield Capital LLP")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "meta"
  }, "Companies House"), /*#__PURE__*/React.createElement("td", null, "SO 308 412")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "meta"
  }, "FCA reference"), /*#__PURE__*/React.createElement("td", null, "947213")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "meta"
  }, "VAT"), /*#__PURE__*/React.createElement("td", null, "GB 412 9821 04"))))))));
}
Object.assign(window, {
  BriefingPage,
  AdvisoryPage,
  FoundryPage,
  EquityPage,
  FirmPage,
  ISSUES,
  HOLDINGS,
  FOUNDRY_PROJECTS,
  ENGAGEMENTS,
  Stat
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/sections.jsx", error: String((e && e.message) || e) }); }

})();
