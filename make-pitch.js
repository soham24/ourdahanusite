const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title = 'OurDahanu Sales Pitch';

// ── Colors ────────────────────────────────────────────────
const TERRA      = "B85042";
const TERRA_LT   = "D4735E";
const TERRA_DK   = "8B3A2F";
const DARK_BG    = "1E0E09";
const WHITE      = "FFFFFF";
const CREAM      = "FDF8F3";
const SAND       = "F0E6DC";
const GRAY       = "6B5B4E";
const LGRAY      = "C4B8B0";
const GREEN      = "25D366";
const GOLD       = "D4A853";

const makeShadow = () => ({ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 });

// ─────────────────────────────────────────────────────────
// HELPER: standard header bar for content slides
// ─────────────────────────────────────────────────────────
function addHeader(slide, title) {
  slide.background = { color: CREAM };
  slide.addShape(pres.shapes.RECTANGLE, { x:0,    y:0, w:0.12, h:5.625, fill:{color:TERRA}, line:{color:TERRA} });
  slide.addShape(pres.shapes.RECTANGLE, { x:0.12, y:0, w:9.88, h:1.05,  fill:{color:TERRA}, line:{color:TERRA} });
  slide.addText(title, {
    x:0.4, y:0.17, w:9.3, h:0.72,
    fontSize:28, fontFace:"Georgia", color:WHITE, bold:true, align:"left", margin:0
  });
}

// ─────────────────────────────────────────────────────────
// SLIDE 1 — Title
// ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: DARK_BG };

  // Left bold bar
  s.addShape(pres.shapes.RECTANGLE, { x:0,    y:0, w:0.55, h:5.625, fill:{color:TERRA},    line:{color:TERRA} });
  s.addShape(pres.shapes.RECTANGLE, { x:9.65, y:0, w:0.35, h:5.625, fill:{color:TERRA_DK}, line:{color:TERRA_DK} });
  s.addShape(pres.shapes.RECTANGLE, { x:0.55, y:0, w:9.1,  h:0.08,  fill:{color:TERRA},    line:{color:TERRA} });

  // Decorative faint circles — right side
  s.addShape(pres.shapes.OVAL, { x:6.0, y:0.2, w:4.0, h:4.0, fill:{color:TERRA, transparency:88}, line:{color:TERRA, transparency:65, width:2} });
  s.addShape(pres.shapes.OVAL, { x:6.8, y:1.0, w:2.5, h:2.5, fill:{color:TERRA, transparency:80}, line:{color:TERRA, transparency:50, width:1} });

  // Tag
  s.addText("ourdahanu.in", {
    x:0.9, y:0.45, w:5, h:0.5,
    fontSize:15, fontFace:"Calibri", color:TERRA_LT, bold:true, align:"left", margin:0
  });

  // Main heading
  s.addText("आपला व्यवसाय\nOnline आणा", {
    x:0.9, y:0.95, w:7.5, h:2.0,
    fontSize:46, fontFace:"Georgia", color:WHITE, bold:true, align:"left", margin:0
  });

  // Tagline
  s.addText("Grow Your Business with OurDahanu", {
    x:0.9, y:3.05, w:7, h:0.55,
    fontSize:18, fontFace:"Calibri", color:SAND, align:"left", margin:0
  });

  // Divider
  s.addShape(pres.shapes.RECTANGLE, { x:0.9, y:3.72, w:3.8, h:0.06, fill:{color:TERRA_LT}, line:{color:TERRA_LT} });

  // Stat line
  s.addText("Dahanu · Bordi · Gholvad · Palghar — 30,000+ लोकांपर्यंत पोहोचा", {
    x:0.9, y:3.9, w:8.0, h:0.5,
    fontSize:13, fontFace:"Calibri", color:LGRAY, align:"left", margin:0
  });

  // Bottom website pill
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x:0.9, y:4.7, w:2.8, h:0.6,
    fill:{color:TERRA}, line:{color:TERRA}, rectRadius:0.1
  });
  s.addText("🌐  ourdahanu.in", {
    x:0.9, y:4.7, w:2.8, h:0.6,
    fontSize:15, fontFace:"Calibri", color:WHITE, bold:true, align:"center", valign:"middle", margin:0
  });
}

// ─────────────────────────────────────────────────────────
// SLIDE 2 — The Problem
// ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  addHeader(s, "❓ The Problem — ग्राहक online शोधतो, पण तुम्ही मिळत नाही!");

  // Left column — text
  s.addText("आज ग्राहक\nonline शोधतो... 📱", {
    x:0.4, y:1.2, w:5.0, h:1.0,
    fontSize:28, fontFace:"Georgia", color:TERRA, bold:true, align:"left", margin:0
  });

  const searches = [
    '"photographer Dahanu"',
    '"plumber near me"',
    '"cake Bordi"',
    '"salon near Dahanu"',
  ];
  searches.forEach((q, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x:0.4, y:2.3 + i*0.72, w:4.8, h:0.6,
      fill:{color:SAND}, line:{color:"E0D0C0"}, shadow:makeShadow()
    });
    s.addText("🔍  " + q, {
      x:0.55, y:2.32 + i*0.72, w:4.5, h:0.56,
      fontSize:14, fontFace:"Calibri", color:"3D2B1F", italic:true, valign:"middle", margin:0
    });
  });

  // Right column — phone mock
  // Phone body
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x:6.0, y:1.1, w:3.0, h:4.2, fill:{color:"2A2A2A"}, rectRadius:0.18, shadow:makeShadow()
  });
  // Screen
  s.addShape(pres.shapes.RECTANGLE, {
    x:6.2, y:1.45, w:2.6, h:3.3, fill:{color:WHITE}, line:{color:"EEEEEE"}
  });
  // Search bar
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x:6.3, y:1.55, w:2.4, h:0.38, fill:{color:"F1F3F4"}, rectRadius:0.05
  });
  s.addText("🔍 plumber Dahanu", {
    x:6.33, y:1.58, w:2.3, h:0.3,
    fontSize:9, fontFace:"Calibri", color:"555555", margin:0
  });
  // No results
  s.addText("No results found 😕", {
    x:6.25, y:2.35, w:2.5, h:0.45,
    fontSize:12, fontFace:"Calibri", color:"AAAAAA", align:"center", italic:true, margin:0
  });
  s.addText("😔", {
    x:6.6, y:3.0, w:1.8, h:0.9, fontSize:40, align:"center", margin:0
  });
  s.addText("ग्राहकाला तुम्ही\nसापडत नाही!", {
    x:6.2, y:4.0, w:2.6, h:0.65,
    fontSize:11, fontFace:"Calibri", color:TERRA, bold:true, align:"center", margin:0
  });

  // Bottom banner
  s.addShape(pres.shapes.RECTANGLE, {
    x:0.12, y:5.18, w:9.88, h:0.44,
    fill:{color:TERRA}, line:{color:TERRA}
  });
  s.addText("📊  Dahanu मध्ये 30,000+ लोक smartphone वापरतात — ते रोज local businesses search करतात!", {
    x:0.3, y:5.22, w:9.5, h:0.36,
    fontSize:12, fontFace:"Calibri", color:WHITE, align:"center", margin:0
  });
}

// ─────────────────────────────────────────────────────────
// SLIDE 3 — What is OurDahanu?
// ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  addHeader(s, "🌟 OurDahanu म्हणजे काय?");

  s.addText("Dahanu चा स्वतःचा Online Business Directory", {
    x:0.4, y:1.15, w:9.2, h:0.6,
    fontSize:20, fontFace:"Georgia", color:TERRA, bold:true, align:"left", margin:0
  });

  const cards = [
    { emoji:"🔍", title:"Google वर\nदिसाल",         desc:"Customers search your\nbusiness on Google —\nyou appear on top!" },
    { emoji:"📱", title:"WhatsApp\nDirect Contact", desc:"One tap — customer\nmessages or calls you\ndirectly, instantly" },
    { emoji:"⭐", title:"Reviews &\nRatings",        desc:"Build credibility with\nreal customer reviews\nand star ratings" },
    { emoji:"📸", title:"Photos &\nPortfolio",       desc:"Showcase your work,\nfood, products &\nservices beautifully" },
  ];

  cards.forEach((c, i) => {
    const x = 0.35 + i * 2.35;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y:1.9, w:2.2, h:3.35,
      fill:{color:WHITE}, line:{color:"EDE5DC", width:1}, shadow:makeShadow()
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y:1.9, w:2.2, h:0.1,
      fill:{color: i%2===0 ? TERRA : TERRA_DK}, line:{color: i%2===0 ? TERRA : TERRA_DK}
    });
    s.addText(c.emoji, {
      x:x+0.1, y:2.05, w:2.0, h:0.7, fontSize:30, align:"center", margin:0
    });
    s.addText(c.title, {
      x:x+0.08, y:2.8, w:2.05, h:0.7,
      fontSize:15, fontFace:"Georgia", color:TERRA, bold:true, align:"center", margin:0
    });
    s.addText(c.desc, {
      x:x+0.08, y:3.55, w:2.05, h:1.3,
      fontSize:11, fontFace:"Calibri", color:GRAY, align:"center", margin:0
    });
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x:0.12, y:5.18, w:9.88, h:0.44,
    fill:{color:SAND}, line:{color:"EDE5DC"}
  });
  s.addText("🏘️  Dahanu · Bordi · Gholvad · Palghar — सगळ्यांसाठी, एकाच platform वर", {
    x:0.3, y:5.22, w:9.5, h:0.36,
    fontSize:12, fontFace:"Calibri", color:GRAY, align:"center", margin:0
  });
}

// ─────────────────────────────────────────────────────────
// SLIDE 4 — What You Get
// ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  addHeader(s, "🎁 तुम्हाला काय मिळेल?");

  // Left — feature list
  const features = [
    { emoji:"🌐", text:"स्वतःचा page: yourname.ourdahanu.in" },
    { emoji:"📸", text:"Photos, portfolio, business info" },
    { emoji:"💬", text:"WhatsApp button — direct customer contact" },
    { emoji:"⭐", text:"Customer reviews & star ratings" },
    { emoji:"📍", text:"Google Maps location link" },
    { emoji:"🔍", text:"Google search मध्ये rank होता" },
  ];

  features.forEach((f, i) => {
    const y = 1.2 + i * 0.68;
    s.addShape(pres.shapes.OVAL, {
      x:0.35, y:y+0.06, w:0.44, h:0.44,
      fill:{color:SAND}, line:{color:"D4B8A8"}
    });
    s.addText(f.emoji, {
      x:0.35, y:y+0.06, w:0.44, h:0.44,
      fontSize:16, align:"center", valign:"middle", margin:0
    });
    s.addText(f.text, {
      x:0.9, y:y, w:4.3, h:0.58,
      fontSize:14, fontFace:"Calibri", color:"3D2B1F", valign:"middle", margin:0
    });
  });

  // Right — browser mock card
  s.addShape(pres.shapes.RECTANGLE, {
    x:5.5, y:1.1, w:4.2, h:4.25,
    fill:{color:WHITE}, line:{color:"EDE5DC"}, shadow:makeShadow()
  });
  // Browser chrome
  s.addShape(pres.shapes.RECTANGLE, {
    x:5.5, y:1.1, w:4.2, h:0.42,
    fill:{color:"F5F5F5"}, line:{color:"E0E0E0"}
  });
  s.addShape(pres.shapes.OVAL, { x:5.6,  y:1.18, w:0.14, h:0.14, fill:{color:"FF5F57"}, line:{color:"FF5F57"} });
  s.addShape(pres.shapes.OVAL, { x:5.78, y:1.18, w:0.14, h:0.14, fill:{color:"FEBC2E"}, line:{color:"FEBC2E"} });
  s.addShape(pres.shapes.OVAL, { x:5.96, y:1.18, w:0.14, h:0.14, fill:{color:"28C840"}, line:{color:"28C840"} });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x:6.2, y:1.14, w:3.2, h:0.28,
    fill:{color:WHITE}, line:{color:"DDDDDD"}, rectRadius:0.04
  });
  s.addText("🔒  yourname.ourdahanu.in", {
    x:6.25, y:1.15, w:3.1, h:0.26,
    fontSize:9, fontFace:"Calibri", color:"444444", valign:"middle", margin:0
  });

  // Cover image area
  s.addShape(pres.shapes.RECTANGLE, {
    x:5.5, y:1.52, w:4.2, h:1.1,
    fill:{color:TERRA}, line:{color:TERRA}
  });
  s.addText("📸  Your Business Name", {
    x:5.65, y:1.62, w:3.9, h:0.5,
    fontSize:16, fontFace:"Georgia", color:WHITE, bold:true, margin:0
  });
  s.addText("📍 Dahanu, Maharashtra", {
    x:5.65, y:2.15, w:3.9, h:0.35,
    fontSize:11, fontFace:"Calibri", color:"F0D8D0", margin:0
  });

  // Rating
  s.addText("⭐⭐⭐⭐⭐  4.9  (24 reviews)", {
    x:5.6, y:2.72, w:4.0, h:0.38,
    fontSize:12, fontFace:"Calibri", color:GRAY, margin:0
  });

  // Action buttons
  s.addShape(pres.shapes.RECTANGLE, {
    x:5.6, y:3.18, w:1.85, h:0.44,
    fill:{color:GREEN}, line:{color:GREEN}
  });
  s.addText("💬 WhatsApp", {
    x:5.6, y:3.18, w:1.85, h:0.44,
    fontSize:11, fontFace:"Calibri", color:WHITE, bold:true, align:"center", valign:"middle", margin:0
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x:7.6, y:3.18, w:1.85, h:0.44,
    fill:{color:TERRA}, line:{color:TERRA}
  });
  s.addText("📞 Call Now", {
    x:7.6, y:3.18, w:1.85, h:0.44,
    fontSize:11, fontFace:"Calibri", color:WHITE, bold:true, align:"center", valign:"middle", margin:0
  });

  // Nav tabs
  s.addText("Services  ·  Gallery  ·  Reviews  ·  Location", {
    x:5.6, y:3.78, w:4.0, h:0.32,
    fontSize:11, fontFace:"Calibri", color:TERRA, align:"center", margin:0
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x:5.5, y:4.62, w:4.2, h:0.5,
    fill:{color:SAND}, line:{color:"EDE5DC"}
  });
  s.addText("\"तुमचं स्वतःचं website — FREE मिळतं!\" 🎉", {
    x:5.55, y:4.65, w:4.1, h:0.44,
    fontSize:13, fontFace:"Georgia", color:TERRA, bold:true, italic:true, align:"center", valign:"middle", margin:0
  });
}

// ─────────────────────────────────────────────────────────
// SLIDE 5 — Who's Already On It
// ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  addHeader(s, "🏪 आधीच कोण join झाले आहेत?");

  const biz = [
    { emoji:"📸", name:"Photographers",      ex:"arth.ourdahanu.in" },
    { emoji:"🍱", name:"Food & Homefood",     ex:"cuppyncakes.ourdahanu.in" },
    { emoji:"💅", name:"Salons & Beauty",     ex:"nailsbymishka.ourdahanu.in" },
    { emoji:"🌱", name:"Farms & Organic",     ex:"nisargfarm.ourdahanu.in" },
    { emoji:"🎪", name:"Event Services",      ex:"knowiaevents.ourdahanu.in" },
    { emoji:"🏥", name:"Doctors & Clinics",   ex:"drmansioza.ourdahanu.in" },
    { emoji:"💻", name:"Digital & Marketing", ex:"socialbranding.ourdahanu.in" },
    { emoji:"🏠", name:"Interiors & Design",  ex:"pranaliinteriors.ourdahanu.in" },
  ];

  biz.forEach((b, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.35 + col * 2.37;
    const y = 1.2  + row * 2.03;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w:2.2, h:1.75,
      fill:{color:WHITE}, line:{color:"EDE5DC"}, shadow:makeShadow()
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w:2.2, h:0.1,
      fill:{color: col%2===0 ? TERRA : TERRA_DK}, line:{color: col%2===0 ? TERRA : TERRA_DK}
    });
    s.addText(b.emoji, {
      x:x+0.1, y:y+0.15, w:2.0, h:0.55, fontSize:28, align:"center", margin:0
    });
    s.addText(b.name, {
      x:x+0.06, y:y+0.73, w:2.08, h:0.48,
      fontSize:12, fontFace:"Georgia", color:"3D2B1F", bold:true, align:"center", margin:0
    });
    s.addText(b.ex, {
      x:x+0.06, y:y+1.24, w:2.08, h:0.35,
      fontSize:8, fontFace:"Calibri", color:TERRA, italic:true, align:"center", margin:0
    });
  });
}

// ─────────────────────────────────────────────────────────
// SLIDE 6 — How Customers Find You
// ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  addHeader(s, "🔄 ग्राहक तुम्हाला कसा शोधतो?");

  const steps = [
    { n:"1", emoji:"🔍", title:"Google Search",   desc:'"photographer\nDahanu"',           sub:"Customer types on phone" },
    { n:"2", emoji:"📄", title:"Your Page",        desc:"yourname.\nourdahanu.in appears",  sub:"Your listing shows up" },
    { n:"3", emoji:"💬", title:"Contacts You",     desc:"WhatsApp /\nCall directly",        sub:"One tap — instant contact" },
    { n:"4", emoji:"🤝", title:"New Customer!",    desc:"Order placed.\nBusiness grows! 🎉",sub:"Money in your pocket" },
  ];

  steps.forEach((st, i) => {
    const x = 0.35 + i * 2.35;

    // Arrow between steps
    if (i < 3) {
      s.addText("→", {
        x: x + 2.2, y: 1.85, w: 0.5, h: 0.5,
        fontSize:22, color:TERRA, align:"center", bold:true, margin:0
      });
    }

    // Circle
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.45, y: 1.3, w: 1.35, h: 1.35,
      fill:{color: i===3 ? TERRA : SAND}, line:{color:TERRA, width:2}
    });
    s.addText(st.emoji, {
      x: x + 0.45, y: 1.35, w: 1.35, h: 1.2,
      fontSize:30, align:"center", valign:"middle", margin:0
    });

    // Step badge
    s.addShape(pres.shapes.OVAL, {
      x: x + 1.62, y: 1.24, w: 0.32, h: 0.32,
      fill:{color:TERRA_DK}, line:{color:TERRA_DK}
    });
    s.addText(st.n, {
      x: x + 1.62, y: 1.24, w: 0.32, h: 0.32,
      fontSize:10, fontFace:"Calibri", color:WHITE, bold:true,
      align:"center", valign:"middle", margin:0
    });

    s.addText(st.title, {
      x: x + 0.15, y: 2.75, w: 2.0, h: 0.45,
      fontSize:15, fontFace:"Georgia", color:TERRA, bold:true, align:"center", margin:0
    });
    s.addText(st.desc, {
      x: x + 0.15, y: 3.25, w: 2.0, h: 0.7,
      fontSize:12, fontFace:"Calibri", color:GRAY, align:"center", italic:true, margin:0
    });
    s.addText(st.sub, {
      x: x + 0.15, y: 3.98, w: 2.0, h: 0.38,
      fontSize:10, fontFace:"Calibri", color:GRAY, align:"center", margin:0
    });
  });

  // Bottom quote banner
  s.addShape(pres.shapes.RECTANGLE, {
    x:0.35, y:4.5, w:9.3, h:0.9,
    fill:{color:TERRA}, line:{color:TERRA}
  });
  s.addText("\"एकदा OurDahanu वर listing केली की ग्राहक 24/7 येतात — झोपेतही business चालतं! 🌙\"", {
    x:0.5, y:4.55, w:9.0, h:0.75,
    fontSize:15, fontFace:"Georgia", color:WHITE, italic:true, align:"center", valign:"middle", margin:0
  });
}

// ─────────────────────────────────────────────────────────
// SLIDE 7 — Plans & Pricing
// ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  addHeader(s, "💰 Plans & Pricing — सगळ्यांसाठी काहीतरी आहे");

  const plans = [
    {
      name:"Basic", emoji:"🌱", price:"₹999",   mo:"₹83/month",
      badge:null,          highlight:false,
      feats:["Business listing","Photos (up to 5)","WhatsApp button","Google Maps link","Customer reviews"],
    },
    {
      name:"Premium", emoji:"⭐", price:"₹1,999", mo:"₹167/month",
      badge:"MOST POPULAR", highlight:true,
      feats:["Everything in Basic","More photos (10+)","Services section","Priority placement","Featured badge"],
    },
    {
      name:"Featured", emoji:"🏆", price:"₹3,499", mo:"₹292/month",
      badge:"BEST VISIBILITY", highlight:false,
      feats:["Everything in Premium","Top of category","Homepage featured","Bold highlighted card","Dedicated support"],
    },
  ];

  plans.forEach((p, i) => {
    const x = 0.35 + i * 3.12;
    const hl = p.highlight;

    if (p.badge) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 0.5, y: 1.05, w: 2.1, h: 0.3,
        fill:{color: hl ? TERRA_DK : TERRA_DK}, line:{color: hl ? TERRA_DK : TERRA_DK}
      });
      s.addText(p.badge, {
        x: x + 0.5, y: 1.05, w: 2.1, h: 0.3,
        fontSize:9, fontFace:"Calibri", color:WHITE, bold:true,
        align:"center", valign:"middle", margin:0
      });
    }

    s.addShape(pres.shapes.RECTANGLE, {
      x, y:1.35, w:2.95, h:4.0,
      fill:{color: hl ? TERRA : WHITE},
      line:{color: hl ? TERRA : "EDE5DC", width: hl ? 0 : 1},
      shadow:makeShadow()
    });

    const tc = hl ? WHITE : "3D2B1F";
    const sc = hl ? WHITE : GRAY;

    s.addText(p.emoji, {
      x:x+0.1, y:1.45, w:2.75, h:0.6, fontSize:28, align:"center", margin:0
    });
    s.addText(p.name, {
      x:x+0.1, y:2.1, w:2.75, h:0.45,
      fontSize:18, fontFace:"Georgia", color:tc, bold:true, align:"center", margin:0
    });
    s.addText(p.price, {
      x:x+0.1, y:2.6, w:2.75, h:0.58,
      fontSize:28, fontFace:"Georgia", color: hl ? WHITE : TERRA, bold:true, align:"center", margin:0
    });
    s.addText("per year  (" + p.mo + ")", {
      x:x+0.1, y:3.2, w:2.75, h:0.3,
      fontSize:10, fontFace:"Calibri", color:sc, align:"center", margin:0
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x:x+0.3, y:3.55, w:2.35, h:0.05,
      fill:{color: hl ? "D4836E" : "EDE5DC"}, line:{color: hl ? "D4836E" : "EDE5DC"}
    });

    p.feats.forEach((f, fi) => {
      s.addText("✓  " + f, {
        x:x+0.18, y:3.66 + fi*0.3, w:2.6, h:0.27,
        fontSize:10, fontFace:"Calibri", color:tc, align:"left", margin:0
      });
    });
  });
}

// ─────────────────────────────────────────────────────────
// SLIDE 8 — Getting Started
// ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  addHeader(s, "🚀 सुरू कसं करायचं? फक्त 3 Steps!");

  const steps = [
    {
      n:"1", emoji:"📝",
      title:"Submit करा",
      desc:"ourdahanu.in वर जा\n'List Your Business' click करा\nफॉर्म भरा — फक्त 5 minutes!",
      note:"Name, phone, photos, address"
    },
    {
      n:"2", emoji:"✅",
      title:"Verify होईल",
      desc:"आमची team तुमची\nlisting verify करेल\n48 तासांत activate होईल",
      note:"WhatsApp वर confirmation येईल"
    },
    {
      n:"3", emoji:"🎉",
      title:"Go Live!",
      desc:"yourname.ourdahanu.in\npage live होईल!\nग्राहक शोधू लागतील",
      note:"Google indexing automatically starts"
    },
  ];

  steps.forEach((st, i) => {
    const x = 0.35 + i * 3.15;

    if (i < 2) {
      s.addText("→", {
        x: x + 3.0, y: 2.15, w: 0.45, h: 0.45,
        fontSize:22, color:TERRA, bold:true, align:"center", margin:0
      });
    }

    s.addShape(pres.shapes.RECTANGLE, {
      x, y:1.2, w:2.95, h:3.9,
      fill:{color:WHITE}, line:{color:"EDE5DC"}, shadow:makeShadow()
    });

    // Number circle
    s.addShape(pres.shapes.OVAL, {
      x: x + 1.03, y: 1.05, w: 0.9, h: 0.9,
      fill:{color:TERRA}, line:{color:TERRA}
    });
    s.addText(st.n, {
      x: x + 1.03, y: 1.05, w: 0.9, h: 0.9,
      fontSize:26, fontFace:"Georgia", color:WHITE, bold:true,
      align:"center", valign:"middle", margin:0
    });

    s.addText(st.emoji, {
      x:x+0.1, y:1.3, w:2.75, h:0.65, fontSize:30, align:"center", margin:0
    });
    s.addText(st.title, {
      x:x+0.1, y:2.02, w:2.75, h:0.48,
      fontSize:18, fontFace:"Georgia", color:TERRA, bold:true, align:"center", margin:0
    });
    s.addText(st.desc, {
      x:x+0.15, y:2.6, w:2.65, h:1.35,
      fontSize:12, fontFace:"Calibri", color:"3D2B1F", align:"center", margin:0
    });

    // Note box
    s.addShape(pres.shapes.RECTANGLE, {
      x:x+0.12, y:4.0, w:2.72, h:0.7,
      fill:{color:SAND}, line:{color:"D4B8A8"}
    });
    s.addText("💡  " + st.note, {
      x:x+0.17, y:4.05, w:2.62, h:0.6,
      fontSize:10, fontFace:"Calibri", color:GRAY,
      align:"center", valign:"middle", margin:0
    });
  });
}

// ─────────────────────────────────────────────────────────
// SLIDE 9 — Call to Action
// ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: DARK_BG };

  // Left bar
  s.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:0.55, h:5.625, fill:{color:TERRA}, line:{color:TERRA} });
  s.addShape(pres.shapes.RECTANGLE, { x:0.55, y:0, w:9.1, h:0.08, fill:{color:TERRA}, line:{color:TERRA} });

  // Bg circles
  s.addShape(pres.shapes.OVAL, { x:6.5, y:-0.5, w:4.5, h:4.5, fill:{color:TERRA, transparency:88}, line:{color:TERRA, transparency:65, width:2} });
  s.addShape(pres.shapes.OVAL, { x:-1,  y:3.5,  w:3.5, h:3.5, fill:{color:TERRA, transparency:90}, line:{color:TERRA, transparency:75, width:1} });

  s.addText("आता वेळ आली आहे! 🎯", {
    x:0.9, y:0.5, w:8, h:0.5,
    fontSize:18, fontFace:"Calibri", color:TERRA_LT, align:"left", margin:0
  });
  s.addText("आपला व्यवसाय\nOurDahanu वर List करा\nआज!", {
    x:0.9, y:1.0, w:7.5, h:2.2,
    fontSize:40, fontFace:"Georgia", color:WHITE, bold:true, align:"left", margin:0
  });

  s.addShape(pres.shapes.RECTANGLE, { x:0.9, y:3.32, w:3.8, h:0.06, fill:{color:TERRA}, line:{color:TERRA} });

  // WhatsApp button
  s.addShape(pres.shapes.RECTANGLE, {
    x:0.9, y:3.5, w:4.0, h:0.62,
    fill:{color:GREEN}, line:{color:GREEN}
  });
  s.addText("💬  WhatsApp to Join Now", {
    x:0.9, y:3.5, w:4.0, h:0.62,
    fontSize:16, fontFace:"Calibri", color:WHITE, bold:true, align:"center", valign:"middle", margin:0
  });

  // Website button
  s.addShape(pres.shapes.RECTANGLE, {
    x:0.9, y:4.25, w:4.0, h:0.62,
    fill:{color:TERRA}, line:{color:TERRA}
  });
  s.addText("🌐  ourdahanu.in", {
    x:0.9, y:4.25, w:4.0, h:0.62,
    fontSize:16, fontFace:"Calibri", color:WHITE, bold:true, align:"center", valign:"middle", margin:0
  });

  // Right — value bullets
  s.addShape(pres.shapes.RECTANGLE, {
    x:5.5, y:1.15, w:4.15, h:4.2,
    fill:{color:TERRA, transparency:85}, line:{color:TERRA, transparency:55, width:1}
  });

  const bullets = [
    "✓  30,000+ potential customers",
    "✓  Google वर rank — FREE",
    "✓  स्वतःचा website page",
    "✓  WhatsApp direct contact",
    "✓  Starting ₹999/year only",
    "✓  48-hour setup",
    "✓  Dahanu च्या लोकांसाठीच",
  ];
  bullets.forEach((b, i) => {
    s.addText(b, {
      x:5.7, y:1.3 + i*0.54, w:3.8, h:0.47,
      fontSize:14, fontFace:"Calibri", color:WHITE, valign:"middle", margin:0
    });
  });
}

pres.writeFile({ fileName: "D:/myfiles/mygptprojects/ourdahanusite/OurDahanu-Sales-Pitch.pptx" });
console.log("Done! Saved to OurDahanu-Sales-Pitch.pptx");
