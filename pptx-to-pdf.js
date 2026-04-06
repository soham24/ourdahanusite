/**
 * Generates OurDahanu-Sales-Pitch.pdf directly as HTML slides rendered by Puppeteer.
 * Each slide is 960x540px (16:9).
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const TERRA   = '#B85042';
const TERRA_LT= '#D4735E';
const TERRA_DK= '#8B3A2F';
const DARK_BG = '#1E0E09';
const WHITE   = '#FFFFFF';
const CREAM   = '#FDF8F3';
const SAND    = '#F0E6DC';
const GRAY    = '#6B5B4E';
const GREEN   = '#25D366';

const W = 960, H = 540;

const slides = [
  // Slide 1 — Title
  `<div class="slide" style="background:${DARK_BG};">
    <div style="position:absolute;left:0;top:0;width:52px;height:100%;background:${TERRA};"></div>
    <div style="position:absolute;right:0;top:0;width:34px;height:100%;background:${TERRA_DK};"></div>
    <div style="position:absolute;left:52px;top:0;width:874px;height:8px;background:${TERRA};"></div>
    <div style="position:absolute;right:-40px;top:10px;width:380px;height:380px;border-radius:50%;background:${TERRA};opacity:0.1;"></div>
    <div style="position:absolute;right:40px;top:90px;width:240px;height:240px;border-radius:50%;background:${TERRA};opacity:0.18;"></div>
    <div style="position:absolute;left:86px;top:43px;color:${TERRA_LT};font-size:14px;font-weight:700;font-family:'Calibri',sans-serif;">ourdahanu.in</div>
    <div style="position:absolute;left:86px;top:90px;color:${WHITE};font-size:44px;font-weight:700;font-family:'Georgia',serif;line-height:1.15;">&#x906;&#x92A;&#x932;&#x93E; &#x935;&#x94D;&#x92F;&#x935;&#x938;&#x93E;&#x92F;<br>Online &#x906;&#x923;&#x93E;</div>
    <div style="position:absolute;left:86px;top:292px;color:${SAND};font-size:17px;font-family:'Calibri',sans-serif;">Grow Your Business with OurDahanu</div>
    <div style="position:absolute;left:86px;top:356px;width:365px;height:6px;background:${TERRA_LT};"></div>
    <div style="position:absolute;left:86px;top:374px;color:#A89890;font-size:12px;font-family:'Calibri',sans-serif;">Dahanu &middot; Bordi &middot; Gholvad &middot; Palghar &mdash; 30,000+ &#x932;&#x94B;&#x915;&#x93E;&#x902;&#x92A;&#x930;&#x94D;&#x92F;&#x902;&#x924; &#x92A;&#x94B;&#x939;&#x94B;&#x91A;&#x93E;</div>
    <div style="position:absolute;left:86px;top:450px;width:268px;height:57px;background:${TERRA};border-radius:8px;display:flex;align-items:center;justify-content:center;">
      <span style="color:${WHITE};font-size:14px;font-weight:700;font-family:'Calibri',sans-serif;">&#x1F310; ourdahanu.in</span>
    </div>
  </div>`,

  // Slide 2 — The Problem
  `<div class="slide" style="background:${CREAM};">
    <div style="position:absolute;left:0;top:0;width:11px;height:100%;background:${TERRA};"></div>
    <div style="position:absolute;left:11px;top:0;width:949px;height:100px;background:${TERRA};"></div>
    <div style="position:absolute;left:38px;top:16px;color:${WHITE};font-size:22px;font-weight:700;font-family:'Georgia',serif;">&#x2753; The Problem &mdash; &#x917;&#x94D;&#x930;&#x93E;&#x939;&#x915; online &#x936;&#x94B;&#x927;&#x924;&#x94B;, &#x92A;&#x923; &#x924;&#x941;&#x92E;&#x94D;&#x939;&#x940; &#x92E;&#x93F;&#x933;&#x924; &#x928;&#x93E;&#x939;&#x940;!</div>
    <div style="position:absolute;left:38px;top:115px;color:${TERRA};font-size:24px;font-weight:700;font-family:'Georgia',serif;line-height:1.3;">&#x906;&#x91C; &#x917;&#x94D;&#x930;&#x93E;&#x939;&#x915;<br>online &#x936;&#x94B;&#x927;&#x924;&#x94B;... &#x1F4F1;</div>
    ${['"photographer Dahanu"','"plumber near me"','"cake Bordi"','"salon near Dahanu"'].map((q,i)=>`
      <div style="position:absolute;left:38px;top:${222+i*66}px;width:460px;height:55px;background:${SAND};border:1px solid #E0D0C0;border-radius:4px;display:flex;align-items:center;padding-left:15px;">
        <span style="font-size:13px;font-style:italic;color:#3D2B1F;font-family:'Calibri',sans-serif;">&#x1F50D; ${q}</span>
      </div>`).join('')}
    <div style="position:absolute;right:50px;top:105px;width:286px;height:400px;background:#2A2A2A;border-radius:18px;"></div>
    <div style="position:absolute;right:69px;top:138px;width:249px;height:315px;background:${WHITE};border:1px solid #EEE;"></div>
    <div style="position:absolute;right:79px;top:148px;width:229px;height:37px;background:#F1F3F4;border-radius:5px;display:flex;align-items:center;padding-left:10px;">
      <span style="font-size:8px;color:#555;font-family:'Calibri',sans-serif;">&#x1F50D; plumber Dahanu</span>
    </div>
    <div style="position:absolute;right:79px;top:225px;width:229px;text-align:center;color:#888;font-size:11px;font-style:italic;font-family:'Calibri',sans-serif;">No results found &#x1F615;</div>
    <div style="position:absolute;right:79px;top:285px;width:229px;text-align:center;font-size:38px;">&#x1F614;</div>
    <div style="position:absolute;right:79px;top:382px;width:229px;text-align:center;color:${TERRA};font-size:10px;font-weight:700;font-family:'Calibri',sans-serif;">&#x917;&#x94D;&#x930;&#x93E;&#x939;&#x915;&#x93E;&#x932;&#x93E; &#x924;&#x941;&#x92E;&#x94D;&#x939;&#x940; &#x938;&#x93E;&#x92A;&#x921;&#x924; &#x928;&#x93E;&#x939;&#x940;!</div>
    <div style="position:absolute;left:11px;bottom:0;width:949px;height:42px;background:${TERRA};display:flex;align-items:center;justify-content:center;">
      <span style="color:${WHITE};font-size:11px;font-family:'Calibri',sans-serif;">&#x1F4CA; Dahanu &#x92E;&#x927;&#x94D;&#x92F;&#x947; 30,000+ &#x932;&#x94B;&#x915; smartphone &#x935;&#x93E;&#x92A;&#x930;&#x924;&#x93E;&#x924; &mdash; &#x924;&#x947; &#x930;&#x94B;&#x91C; local businesses search &#x915;&#x930;&#x924;&#x93E;&#x924;!</span>
    </div>
  </div>`,

  // Slide 3 — What is OurDahanu?
  `<div class="slide" style="background:${CREAM};">
    <div style="position:absolute;left:0;top:0;width:11px;height:100%;background:${TERRA};"></div>
    <div style="position:absolute;left:11px;top:0;width:949px;height:100px;background:${TERRA};"></div>
    <div style="position:absolute;left:38px;top:16px;color:${WHITE};font-size:24px;font-weight:700;font-family:'Georgia',serif;">&#x1F31F; OurDahanu &#x92E;&#x94D;&#x939;&#x923;&#x91C;&#x947; &#x915;&#x93E;&#x92F;?</div>
    <div style="position:absolute;left:38px;top:110px;color:${TERRA};font-size:18px;font-weight:700;font-family:'Georgia',serif;">Dahanu &#x91A;&#x93E; &#x938;&#x94D;&#x935;&#x924;&#x903;&#x91A;&#x93E; Online Business Directory</div>
    ${[
      {e:'&#x1F50D;',t:'Google &#x935;&#x930;<br>&#x926;&#x93F;&#x938;&#x93E;&#x932;',d:'Customers search your business on Google &mdash; you appear on top!'},
      {e:'&#x1F4F1;',t:'WhatsApp<br>Direct Contact',d:'One tap &mdash; customer messages or calls you directly, instantly'},
      {e:'&#x2B50;',t:'Reviews &<br>Ratings',d:'Build credibility with real customer reviews and star ratings'},
      {e:'&#x1F4F8;',t:'Photos &<br>Portfolio',d:'Showcase your work, food, products & services beautifully'},
    ].map((c,i)=>`
      <div style="position:absolute;left:${33+i*226}px;top:183px;width:210px;height:320px;background:${WHITE};border:1px solid #EDE5DC;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <div style="height:10px;background:${i%2===0?TERRA:TERRA_DK};"></div>
        <div style="text-align:center;font-size:28px;margin-top:14px;">${c.e}</div>
        <div style="text-align:center;color:${TERRA};font-size:13px;font-weight:700;font-family:'Georgia',serif;margin-top:8px;padding:0 8px;line-height:1.4;">${c.t}</div>
        <div style="text-align:center;color:${GRAY};font-size:10px;font-family:'Calibri',sans-serif;margin-top:6px;padding:0 10px;">${c.d}</div>
      </div>`).join('')}
    <div style="position:absolute;left:11px;bottom:0;width:949px;height:42px;background:${SAND};border-top:1px solid #EDE5DC;display:flex;align-items:center;justify-content:center;">
      <span style="color:${GRAY};font-size:11px;font-family:'Calibri',sans-serif;">&#x1F3D8; Dahanu &middot; Bordi &middot; Gholvad &middot; Palghar &mdash; &#x938;&#x917;&#x33C;&#x93E;&#x902;&#x938;&#x93E;&#x920;&#x940;, &#x910;&#x915;&#x93E;&#x91A; platform &#x935;&#x930;</span>
    </div>
  </div>`,

  // Slide 4 — What You Get
  `<div class="slide" style="background:${CREAM};">
    <div style="position:absolute;left:0;top:0;width:11px;height:100%;background:${TERRA};"></div>
    <div style="position:absolute;left:11px;top:0;width:949px;height:100px;background:${TERRA};"></div>
    <div style="position:absolute;left:38px;top:16px;color:${WHITE};font-size:24px;font-weight:700;font-family:'Georgia',serif;">&#x1F381; &#x924;&#x941;&#x92E;&#x94D;&#x939;&#x93E;&#x932;&#x93E; &#x915;&#x93E;&#x92F; &#x92E;&#x93F;&#x933;&#x947;&#x932;?</div>
    ${[
      {e:'&#x1F310;',t:'&#x938;&#x94D;&#x935;&#x924;&#x903;&#x91A;&#x93E; page: yourname.ourdahanu.in'},
      {e:'&#x1F4F8;',t:'Photos, portfolio, business info'},
      {e:'&#x1F4AC;',t:'WhatsApp button &mdash; direct customer contact'},
      {e:'&#x2B50;',t:'Customer reviews & star ratings'},
      {e:'&#x1F4CD;',t:'Google Maps location link'},
      {e:'&#x1F50D;',t:'Google search &#x92E;&#x927;&#x94D;&#x92F;&#x947; rank &#x939;&#x94B;&#x924;&#x93E;'},
    ].map((f,i)=>`
      <div style="position:absolute;left:33px;top:${115+i*65}px;display:flex;align-items:center;gap:12px;">
        <div style="min-width:42px;width:42px;height:42px;border-radius:50%;background:${SAND};border:1px solid #D4B8A8;display:flex;align-items:center;justify-content:center;font-size:15px;">${f.e}</div>
        <div style="font-size:13px;font-family:'Calibri',sans-serif;color:#3D2B1F;">${f.t}</div>
      </div>`).join('')}
    <div style="position:absolute;right:30px;top:105px;width:400px;height:408px;background:${WHITE};border:1px solid #EDE5DC;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
      <div style="height:40px;background:#F5F5F5;border-bottom:1px solid #E0E0E0;display:flex;align-items:center;padding:0 10px;gap:6px;">
        <div style="width:14px;height:14px;border-radius:50%;background:#FF5F57;"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:#FEBC2E;"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:#28C840;"></div>
        <div style="flex:1;margin-left:8px;background:${WHITE};border:1px solid #DDD;border-radius:4px;height:26px;display:flex;align-items:center;padding:0 8px;font-size:8px;color:#444;font-family:'Calibri',sans-serif;">&#x1F512; yourname.ourdahanu.in</div>
      </div>
      <div style="height:105px;background:${TERRA};display:flex;flex-direction:column;justify-content:center;padding-left:15px;">
        <div style="color:${WHITE};font-size:15px;font-weight:700;font-family:'Georgia',serif;">&#x1F4F8; Your Business Name</div>
        <div style="color:#FDD;font-size:10px;font-family:'Calibri',sans-serif;margin-top:5px;">&#x1F4CD; Dahanu, Maharashtra</div>
      </div>
      <div style="padding:10px 15px;color:${GRAY};font-size:11px;font-family:'Calibri',sans-serif;">&#x2B50;&#x2B50;&#x2B50;&#x2B50;&#x2B50; 4.9 (24 reviews)</div>
      <div style="padding:0 15px;display:flex;gap:10px;">
        <div style="flex:1;height:42px;background:${GREEN};display:flex;align-items:center;justify-content:center;color:${WHITE};font-size:10px;font-weight:700;font-family:'Calibri',sans-serif;">&#x1F4AC; WhatsApp</div>
        <div style="flex:1;height:42px;background:${TERRA};display:flex;align-items:center;justify-content:center;color:${WHITE};font-size:10px;font-weight:700;font-family:'Calibri',sans-serif;">&#x1F4DE; Call Now</div>
      </div>
      <div style="padding:10px 15px;color:${TERRA};font-size:10px;text-align:center;font-family:'Calibri',sans-serif;">Services &middot; Gallery &middot; Reviews &middot; Location</div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:48px;background:${SAND};display:flex;align-items:center;justify-content:center;">
        <span style="color:${TERRA};font-size:11px;font-weight:700;font-style:italic;font-family:'Georgia',serif;">"&#x924;&#x941;&#x92E;&#x91A;&#x902; &#x938;&#x94D;&#x935;&#x924;&#x903;&#x91A;&#x902; website &mdash; FREE &#x92E;&#x93F;&#x933;&#x924;&#x902;! &#x1F389;"</span>
      </div>
    </div>
  </div>`,

  // Slide 5 — Who's Already On It
  `<div class="slide" style="background:${CREAM};">
    <div style="position:absolute;left:0;top:0;width:11px;height:100%;background:${TERRA};"></div>
    <div style="position:absolute;left:11px;top:0;width:949px;height:100px;background:${TERRA};"></div>
    <div style="position:absolute;left:38px;top:16px;color:${WHITE};font-size:24px;font-weight:700;font-family:'Georgia',serif;">&#x1F3EA; &#x906;&#x927;&#x940;&#x91A; &#x915;&#x94B;&#x923; join &#x91D3;&#x93E;&#x932;&#x947; &#x906;&#x939;&#x947;&#x924;?</div>
    ${[
      {e:'&#x1F4F8;',n:'Photographers',     u:'arth.ourdahanu.in'},
      {e:'&#x1F371;',n:'Food & Homefood',    u:'cuppyncakes.ourdahanu.in'},
      {e:'&#x1F485;',n:'Salons & Beauty',    u:'nailsbymishka.ourdahanu.in'},
      {e:'&#x1F331;',n:'Farms & Organic',    u:'nisargfarm.ourdahanu.in'},
      {e:'&#x1F3AA;',n:'Event Services',     u:'knowiaevents.ourdahanu.in'},
      {e:'&#x1F3E5;',n:'Doctors & Clinics',  u:'drmansioza.ourdahanu.in'},
      {e:'&#x1F4BB;',n:'Digital & Marketing',u:'socialbranding.ourdahanu.in'},
      {e:'&#x1F3E0;',n:'Interiors & Design', u:'pranaliinteriors.ourdahanu.in'},
    ].map((b,i)=>{
      const col=i%4, row=Math.floor(i/4);
      const x=33+col*228, y=110+row*194;
      return `<div style="position:absolute;left:${x}px;top:${y}px;width:210px;height:167px;background:${WHITE};border:1px solid #EDE5DC;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <div style="height:10px;background:${col%2===0?TERRA:TERRA_DK};"></div>
        <div style="text-align:center;font-size:26px;margin-top:10px;">${b.e}</div>
        <div style="text-align:center;color:#3D2B1F;font-size:11px;font-weight:700;font-family:'Georgia',serif;margin-top:4px;">${b.n}</div>
        <div style="text-align:center;color:${TERRA};font-size:9px;font-style:italic;font-family:'Calibri',sans-serif;margin-top:3px;">${b.u}</div>
      </div>`;
    }).join('')}
  </div>`,

  // Slide 6 — How Customers Find You
  `<div class="slide" style="background:${CREAM};">
    <div style="position:absolute;left:0;top:0;width:11px;height:100%;background:${TERRA};"></div>
    <div style="position:absolute;left:11px;top:0;width:949px;height:100px;background:${TERRA};"></div>
    <div style="position:absolute;left:38px;top:16px;color:${WHITE};font-size:24px;font-weight:700;font-family:'Georgia',serif;">&#x1F504; &#x917;&#x94D;&#x930;&#x93E;&#x939;&#x915; &#x924;&#x941;&#x92E;&#x94D;&#x939;&#x93E;&#x932;&#x93E; &#x915;&#x938;&#x93E; &#x936;&#x94B;&#x927;&#x924;&#x94B;?</div>
    ${[
      {n:'1',e:'&#x1F50D;',t:'Google Search',   d:'"photographer<br>Dahanu"',        s:'Customer types on phone'},
      {n:'2',e:'&#x1F4C4;',t:'Your Page',        d:'yourname.<br>ourdahanu.in',       s:'Your listing shows up'},
      {n:'3',e:'&#x1F4AC;',t:'Contacts You',     d:'WhatsApp /<br>Call directly',     s:'One tap &mdash; instant contact'},
      {n:'4',e:'&#x1F91D;',t:'New Customer!',    d:'Order placed.<br>Business grows!',s:'Money in your pocket'},
    ].map((st,i)=>{
      const x=33+i*226;
      return `
        ${i<3?`<div style="position:absolute;left:${x+215}px;top:178px;font-size:20px;color:${TERRA};font-weight:700;">&rarr;</div>`:''}
        <div style="position:absolute;left:${x+43}px;top:124px;width:130px;height:130px;border-radius:50%;background:${i===3?TERRA:SAND};border:2px solid ${TERRA};display:flex;align-items:center;justify-content:center;font-size:28px;">${st.e}</div>
        <div style="position:absolute;left:${x+148}px;top:118px;width:30px;height:30px;border-radius:50%;background:${TERRA_DK};display:flex;align-items:center;justify-content:center;color:${WHITE};font-size:9px;font-weight:700;font-family:'Calibri',sans-serif;">${st.n}</div>
        <div style="position:absolute;left:${x+14}px;top:263px;width:192px;text-align:center;color:${TERRA};font-size:14px;font-weight:700;font-family:'Georgia',serif;">${st.t}</div>
        <div style="position:absolute;left:${x+14}px;top:312px;width:192px;text-align:center;color:${GRAY};font-size:11px;font-style:italic;font-family:'Calibri',sans-serif;">${st.d}</div>
        <div style="position:absolute;left:${x+14}px;top:382px;width:192px;text-align:center;color:${GRAY};font-size:9px;font-family:'Calibri',sans-serif;">${st.s}</div>`;
    }).join('')}
    <div style="position:absolute;left:33px;bottom:8px;width:894px;height:86px;background:${TERRA};display:flex;align-items:center;justify-content:center;border-radius:4px;">
      <span style="color:${WHITE};font-size:14px;font-style:italic;font-family:'Georgia',serif;">"&#x910;&#x915;&#x926;&#x93E; OurDahanu &#x935;&#x930; listing &#x915;&#x947;&#x932;&#x940; &#x915;&#x940; &#x917;&#x94D;&#x930;&#x93E;&#x939;&#x915; 24/7 &#x92F;&#x947;&#x924;&#x93E;&#x924; &mdash; &#x91D3;&#x94B;&#x92A;&#x947;&#x924;&#x939;&#x940; business &#x91A;&#x93E;&#x932;&#x924;&#x902;! &#x1F319;"</span>
    </div>
  </div>`,

  // Slide 7 — Plans & Pricing
  `<div class="slide" style="background:${CREAM};">
    <div style="position:absolute;left:0;top:0;width:11px;height:100%;background:${TERRA};"></div>
    <div style="position:absolute;left:11px;top:0;width:949px;height:100px;background:${TERRA};"></div>
    <div style="position:absolute;left:38px;top:16px;color:${WHITE};font-size:22px;font-weight:700;font-family:'Georgia',serif;">&#x1F4B0; Plans & Pricing &mdash; &#x938;&#x917;&#x33C;&#x93E;&#x902;&#x938;&#x93E;&#x920;&#x940; &#x915;&#x93E;&#x939;&#x940;&#x924;&#x930;&#x940; &#x906;&#x939;&#x947;</div>
    ${[
      {name:'Basic',   e:'&#x1F331;',price:'&#x20B9;999',  mo:'&#x20B9;83/month', badge:null,             hl:false,
       feats:['Business listing','Photos (up to 5)','WhatsApp button','Google Maps link','Customer reviews']},
      {name:'Premium', e:'&#x2B50;',  price:'&#x20B9;1,999',mo:'&#x20B9;167/month',badge:'MOST POPULAR',   hl:true,
       feats:['Everything in Basic','More photos (10+)','Services section','Priority placement','Featured badge']},
      {name:'Featured',e:'&#x1F3C6;',price:'&#x20B9;3,499',mo:'&#x20B9;292/month',badge:'BEST VISIBILITY', hl:false,
       feats:['Everything in Premium','Top of category','Homepage featured','Bold highlighted card','Dedicated support']},
    ].map((p,i)=>{
      const x=33+i*299;
      const tc=p.hl?WHITE:'#3D2B1F', sc=p.hl?WHITE:GRAY;
      return `
        ${p.badge?`<div style="position:absolute;left:${x+48}px;top:100px;width:202px;height:29px;background:${TERRA_DK};display:flex;align-items:center;justify-content:center;">
          <span style="color:${WHITE};font-size:8px;font-weight:700;font-family:'Calibri',sans-serif;">${p.badge}</span></div>`:''}
        <div style="position:absolute;left:${x}px;top:129px;width:283px;height:384px;background:${p.hl?TERRA:WHITE};border:${p.hl?'none':'1px solid #EDE5DC'};box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <div style="text-align:center;font-size:26px;margin-top:10px;">${p.e}</div>
          <div style="text-align:center;color:${tc};font-size:17px;font-weight:700;font-family:'Georgia',serif;margin-top:6px;">${p.name}</div>
          <div style="text-align:center;color:${p.hl?WHITE:TERRA};font-size:26px;font-weight:700;font-family:'Georgia',serif;margin-top:4px;">${p.price}</div>
          <div style="text-align:center;color:${sc};font-size:9px;font-family:'Calibri',sans-serif;">per year (${p.mo})</div>
          <div style="margin:12px 29px 8px;height:5px;background:${p.hl?'#D4836E':'#EDE5DC'};"></div>
          ${p.feats.map(f=>`<div style="padding:2px 18px;font-size:9px;font-family:'Calibri',sans-serif;color:${tc};">&#x2713; ${f}</div>`).join('')}
        </div>`;
    }).join('')}
  </div>`,

  // Slide 8 — Getting Started
  `<div class="slide" style="background:${CREAM};">
    <div style="position:absolute;left:0;top:0;width:11px;height:100%;background:${TERRA};"></div>
    <div style="position:absolute;left:11px;top:0;width:949px;height:100px;background:${TERRA};"></div>
    <div style="position:absolute;left:38px;top:16px;color:${WHITE};font-size:24px;font-weight:700;font-family:'Georgia',serif;">&#x1F680; &#x938;&#x941;&#x930;&#x942; &#x915;&#x938;&#x902; &#x915;&#x930;&#x93E;&#x92F;&#x91A;&#x902;? &#x92B;&#x915;&#x94D;&#x924; 3 Steps!</div>
    ${[
      {n:'1',e:'&#x1F4DD;',t:'Submit &#x915;&#x930;&#x93E;',
       d:'ourdahanu.in &#x935;&#x930; &#x91C;&#x93E;<br>&#x2018;List Your Business&#x2019; click &#x915;&#x930;&#x93E;<br>&#x92B;&#x949;&#x930;&#x94D;&#x92E; &#x92D;&#x930;&#x93E; &mdash; &#x92B;&#x915;&#x94D;&#x924; 5 minutes!',
       note:'Name, phone, photos, address'},
      {n:'2',e:'&#x2705;',t:'Verify &#x939;&#x94B;&#x908;&#x932;',
       d:'&#x906;&#x92E;&#x91A;&#x940; team &#x924;&#x941;&#x92E;&#x91A;&#x940;<br>listing verify &#x915;&#x930;&#x947;&#x932;<br>48 &#x924;&#x93E;&#x938;&#x93E;&#x902;&#x924; activate &#x939;&#x94B;&#x908;&#x932;',
       note:'WhatsApp &#x935;&#x930; confirmation &#x92F;&#x947;&#x908;&#x932;'},
      {n:'3',e:'&#x1F389;',t:'Go Live!',
       d:'yourname.ourdahanu.in<br>page live &#x939;&#x94B;&#x908;&#x932;!<br>&#x917;&#x94D;&#x930;&#x93E;&#x939;&#x915; &#x936;&#x94B;&#x927;&#x942; &#x932;&#x93E;&#x917;&#x924;&#x940;&#x932;',
       note:'Google indexing automatically starts'},
    ].map((st,i)=>{
      const x=33+i*302;
      return `
        ${i<2?`<div style="position:absolute;left:${x+293}px;top:207px;font-size:20px;color:${TERRA};font-weight:700;">&rarr;</div>`:''}
        <div style="position:absolute;left:${x}px;top:115px;width:283px;height:374px;background:${WHITE};border:1px solid #EDE5DC;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <div style="position:absolute;top:-45px;left:50%;transform:translateX(-50%);width:86px;height:86px;border-radius:50%;background:${TERRA};display:flex;align-items:center;justify-content:center;color:${WHITE};font-size:24px;font-weight:700;font-family:'Georgia',serif;">${st.n}</div>
          <div style="text-align:center;font-size:28px;margin-top:55px;">${st.e}</div>
          <div style="text-align:center;color:${TERRA};font-size:17px;font-weight:700;font-family:'Georgia',serif;margin-top:4px;">${st.t}</div>
          <div style="text-align:center;color:#3D2B1F;font-size:11px;font-family:'Calibri',sans-serif;margin-top:8px;padding:0 14px;">${st.d}</div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:67px;background:${SAND};border-top:1px solid #D4B8A8;display:flex;align-items:center;justify-content:center;padding:0 12px;">
            <span style="color:${GRAY};font-size:9px;font-family:'Calibri',sans-serif;text-align:center;">&#x1F4A1; ${st.note}</span>
          </div>
        </div>`;
    }).join('')}
  </div>`,

  // Slide 9 — CTA
  `<div class="slide" style="background:${DARK_BG};">
    <div style="position:absolute;left:0;top:0;width:52px;height:100%;background:${TERRA};"></div>
    <div style="position:absolute;left:52px;top:0;width:908px;height:8px;background:${TERRA};"></div>
    <div style="position:absolute;right:-40px;top:-48px;width:432px;height:432px;border-radius:50%;background:${TERRA};opacity:0.1;"></div>
    <div style="position:absolute;left:86px;top:48px;color:${TERRA_LT};font-size:17px;font-family:'Calibri',sans-serif;">&#x906;&#x924;&#x93E; &#x935;&#x947;&#x933; &#x906;&#x932;&#x940; &#x906;&#x939;&#x947;! &#x1F3AF;</div>
    <div style="position:absolute;left:86px;top:96px;color:${WHITE};font-size:36px;font-weight:700;font-family:'Georgia',serif;line-height:1.25;">&#x906;&#x92A;&#x932;&#x93E; &#x935;&#x94D;&#x92F;&#x935;&#x938;&#x93E;&#x92F;<br>OurDahanu &#x935;&#x930; List &#x915;&#x930;&#x93E;<br>&#x906;&#x91C;!</div>
    <div style="position:absolute;left:86px;top:318px;width:365px;height:6px;background:${TERRA};"></div>
    <div style="position:absolute;left:86px;top:336px;width:384px;height:60px;background:${GREEN};display:flex;align-items:center;justify-content:center;border-radius:4px;">
      <span style="color:${WHITE};font-size:15px;font-weight:700;font-family:'Calibri',sans-serif;">&#x1F4AC; WhatsApp to Join Now</span>
    </div>
    <div style="position:absolute;left:86px;top:408px;width:384px;height:60px;background:${TERRA};display:flex;align-items:center;justify-content:center;border-radius:4px;">
      <span style="color:${WHITE};font-size:15px;font-weight:700;font-family:'Calibri',sans-serif;">&#x1F310; ourdahanu.in</span>
    </div>
    <div style="position:absolute;right:40px;top:110px;width:398px;height:403px;background:rgba(184,80,66,0.15);border:1px solid rgba(184,80,66,0.4);border-radius:6px;padding:20px 24px;">
      ${['&#x2713; 30,000+ potential customers','&#x2713; Google &#x935;&#x930; rank &mdash; FREE','&#x2713; &#x938;&#x94D;&#x935;&#x924;&#x903;&#x91A;&#x93E; website page','&#x2713; WhatsApp direct contact','&#x2713; Starting &#x20B9;999/year only','&#x2713; 48-hour setup','&#x2713; Dahanu &#x91A;&#x94D;&#x92F;&#x93E; &#x932;&#x94B;&#x915;&#x93E;&#x902;&#x938;&#x93E;&#x920;&#x940;&#x91A;']
        .map(b=>`<div style="color:${WHITE};font-size:13px;font-family:'Calibri',sans-serif;padding:5px 0;">${b}</div>`).join('')}
    </div>
  </div>`,
];

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Calibri, Georgia, sans-serif; }
  .slide {
    width:${W}px; height:${H}px;
    position:relative; overflow:hidden;
  }
  @page { size: ${W}px ${H}px; margin: 0; }
</style>
</head>
<body>
${slides.join('\n')}
</body>
</html>`;

const htmlPath = path.resolve('D:/myfiles/mygptprojects/ourdahanusite/OurDahanu-Sales-Pitch.html');
const pdfPath  = path.resolve('D:/myfiles/mygptprojects/ourdahanusite/OurDahanu-Sales-Pitch.pdf');

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('HTML written:', htmlPath);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  await page.goto(`file:///${htmlPath.replace(/\\/g,'/')}`, { waitUntil: 'networkidle0' });

  // Print each slide as a separate page
  await page.pdf({
    path: pdfPath,
    width: `${W}px`,
    height: `${H}px`,
    printBackground: true,
    pageRanges: '',
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  await browser.close();
  console.log('PDF saved:', pdfPath);
})().catch(err => { console.error(err); process.exit(1); });
