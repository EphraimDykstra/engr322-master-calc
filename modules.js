// ENGR 322 Master Calculator — modules.js
// Compute logic ported from ENGR 322 - Master Calculator.xlsx
// Convention: US customary unless noted. Units shown in input labels.
// Each module's compute(state, settings) returns:
//   { outputs: {key:value}, math: {symbolic[], substituted[], intermediate[]}, verdict: {kind,label,value} | null }
// FoS verdicts use settings.FoS_Safe (default 2.0) and settings.FoS_Marginal (default 1.0).

(function () {
  'use strict';

  // ----- helpers -----
  const PI = Math.PI;
  const rad = d => d * PI / 180;
  const deg = r => r * 180 / PI;
  const num = (v, d) => { const x = parseFloat(v); return isFinite(x) ? x : (d === undefined ? 0 : d); };
  const safe = (n, dflt) => isFinite(n) ? n : (dflt === undefined ? null : dflt);
  const FoSverdict = (n, settings) => {
    if (n == null || !isFinite(n)) return null;
    const safeT = (settings && settings.FoS_Safe) || 2.0;
    const margT = (settings && settings.FoS_Marginal) || 1.0;
    if (n >= safeT) return { kind: 'safe',     label: 'SAFE',     value: n };
    if (n >= margT) return { kind: 'marginal', label: 'MARGINAL', value: n };
    return { kind: 'fail', label: 'FAILS', value: n };
  };

  // ============================================================
  // M30 — Eccentric Bolt Patterns
  // ============================================================
  const m30 = {
    id: 'm30',
    title: 'M30 Eccentric Bolts',
    heading: 'Eccentric Bolt Patterns',
    subtitle: 'Symmetric groups, non-symmetric grids, proof loading, rivets',
    covers: [
      'Symmetric bolt groups (direct shear + torsion)',
      'Non-symmetric grid (centroid + radial force)',
      'Proof load tension/shear checks',
      'Riveted joints'
    ],
    sections: [
      // ---- §1 Symmetric pattern ----
      {
        id: 'sym',
        title: '§1 Symmetric pattern',
        blurb: 'Single-bolt resultant from direct shear plus torsional shear about the centroid.',
        inputs: [
          { key: 'F',  label: 'Applied load F',          unit: 'lb',  default: 5000 },
          { key: 'e',  label: 'Eccentricity e',          unit: 'in',  default: 6 },
          { key: 'n',  label: 'Number of bolts n',       unit: '',    default: 4, type: 'int' },
          { key: 'r',  label: 'Bolt radius from CG, r',  unit: 'in',  default: 3 },
          { key: 'th', label: 'Angle θ (load to radial)',unit: 'deg', default: 0 }
        ],
        outputs: [
          { key: 'M',  label: 'Moment M = F·e',          unit: 'lb·in', fmt: 'fixed1' },
          { key: 'Fd', label: 'Direct shear F/n',        unit: 'lb',    fmt: 'fixed1' },
          { key: 'Ft', label: 'Torsional shear M/(n·r)', unit: 'lb',    fmt: 'fixed1' },
          { key: 'FR', label: 'Resultant per bolt',      unit: 'lb',    fmt: 'fixed1' }
        ],
        compute(s) {
          const F=num(s.F),e=num(s.e),n=Math.max(1,num(s.n,1)),r=num(s.r),th=rad(num(s.th));
          const M=F*e, Fd=F/n, Ft=M/(n*r);
          const FR=Math.hypot(Fd+Ft*Math.sin(th), Ft*Math.cos(th));
          return {
            outputs: { M, Fd, Ft, FR },
            math: {
              symbolic:    ['M = F·e', 'F_d = F/n', 'F_t = M/(n·r)', 'F_R = √[(F_d + F_t sinθ)² + (F_t cosθ)²]'],
              substituted: [`M = ${F}·${e}`, `F_d = ${F}/${n}`, `F_t = ${M.toFixed(1)}/(${n}·${r})`, `F_R from components`]
            }
          };
        }
      },

      // ---- §2 Non-symmetric grid (repeating) ----
      {
        id: 'grid',
        title: '§2 Non-symmetric grid',
        blurb: 'Locate centroid by Σ(x)/N, Σ(y)/N. Per-bolt torsion is M·rᵢ/Σrᵢ². Add direct shear vector.',
        inputs: [
          { key: 'F',  label: 'Applied load F',  unit: 'lb',  default: 8000 },
          { key: 'e',  label: 'Eccentricity e',  unit: 'in',  default: 10 }
        ],
        repeating: {
          key: 'bolts',
          label: 'Bolt grid',
          columns: [
            { key: 'x', label: 'x (in)' },
            { key: 'y', label: 'y (in)' }
          ],
          minRows: 2,
          defaultRows: [{x:0,y:0},{x:4,y:0},{x:0,y:6},{x:4,y:6}]
        },
        outputs: [
          { key:'xc',  label:'Centroid x̄', unit:'in', fmt:'fixed3' },
          { key:'yc',  label:'Centroid ȳ', unit:'in', fmt:'fixed3' },
          { key:'M',   label:'Moment M=F·e', unit:'lb·in', fmt:'fixed1' },
          { key:'sumr2', label:'Σrᵢ²', unit:'in²', fmt:'fixed3' },
          { key:'FRmax', label:'Max resultant on any bolt', unit:'lb', fmt:'fixed1' }
        ],
        compute(s) {
          const F=num(s.F),e=num(s.e);
          const rows=(s.bolts||[]).filter(r=>r&&(r.x!==''||r.y!=='')).map(r=>({x:num(r.x),y:num(r.y)}));
          if(!rows.length) return {outputs:{xc:null,yc:null,M:F*e,sumr2:0,FRmax:null}, math:{symbolic:['Add bolts to compute']}};
          const xc=rows.reduce((a,p)=>a+p.x,0)/rows.length;
          const yc=rows.reduce((a,p)=>a+p.y,0)/rows.length;
          const r2=rows.map(p=>(p.x-xc)**2+(p.y-yc)**2);
          const sumr2=r2.reduce((a,b)=>a+b,0);
          const M=F*e;
          // Direct shear F/n acts as ‑F/n in y per convention; torsion M·r/Σr² perpendicular to radius.
          let FRmax=0;
          rows.forEach((p,i)=>{
            const dx=p.x-xc, dy=p.y-yc;
            const Ftmag = sumr2>0 ? M*Math.sqrt(r2[i])/sumr2 : 0;
            // perpendicular direction unit vector: (-dy, dx)/|r|
            const rmag=Math.sqrt(r2[i])||1;
            const tx = -dy/rmag * Ftmag;
            const ty =  dx/rmag * Ftmag;
            // direct shear assumed in -y
            const Fdy = -F/rows.length;
            const FRx=tx, FRy=ty+Fdy;
            const FR=Math.hypot(FRx,FRy);
            if(FR>FRmax) FRmax=FR;
          });
          return {
            outputs: { xc, yc, M, sumr2, FRmax },
            math: {
              symbolic: ['x̄ = Σx/N, ȳ = Σy/N','rᵢ² = (xᵢ-x̄)² + (yᵢ-ȳ)²','F_t,i = M·rᵢ/Σrᵢ²','F_R,i = vec(F_d) + vec(F_t,i)']
            }
          };
        }
      },

      // ---- §3 Proof loading ----
      {
        id: 'proof',
        title: '§3 Proof loading',
        blurb: 'Bolt allowables from proof strength.',
        inputs: [
          { key: 'Sp', label: 'Proof strength Sp', unit: 'ksi', default: 85 },
          { key: 'At', label: 'Tensile area At',   unit: 'in²', default: 0.1419 }
        ],
        outputs: [
          { key: 'Fp',  label: 'Proof load Fp = Sp·At',  unit: 'lb', fmt:'fixed1' },
          { key: 'Fpt', label: 'Allowable tension 0.75·Fp', unit: 'lb', fmt:'fixed1' },
          { key: 'Fps', label: 'Allowable shear 0.577·Sp·At', unit: 'lb', fmt:'fixed1' }
        ],
        compute(s) {
          const Sp=num(s.Sp), At=num(s.At);
          const Sp_psi=Sp*1000;
          const Fp=Sp_psi*At, Fpt=0.75*Fp, Fps=0.577*Sp_psi*At;
          return {
            outputs:{Fp,Fpt,Fps},
            math:{symbolic:['Fp = Sp·At','F_allow,t = 0.75·Fp','F_allow,s = 0.577·Sp·At']}
          };
        }
      },

      // ---- §4 Rivets ----
      {
        id: 'rivets',
        title: '§4 Riveted joints',
        blurb: 'Single-shear rivet capacity.',
        inputs: [
          { key:'d',  label:'Rivet diameter d',  unit:'in',  default:0.5 },
          { key:'tau',label:'Shear stress allow', unit:'ksi', default:18 },
          { key:'n',  label:'Number of rivets',  unit:'', default:4, type:'int' },
          { key:'F',  label:'Applied load F',    unit:'lb', default:5000 }
        ],
        outputs:[
          { key:'A', label:'Single rivet area πd²/4', unit:'in²', fmt:'fixed4' },
          { key:'Pcap', label:'Total capacity n·A·τ', unit:'lb', fmt:'fixed1' },
          { key:'fos', label:'FoS = Pcap/F', unit:'', fmt:'fixed2' }
        ],
        verdict: 'fos',
        compute(s, settings) {
          const d=num(s.d),tau=num(s.tau)*1000,n=Math.max(1,num(s.n,1)),F=num(s.F);
          const A=PI*d*d/4, Pcap=n*A*tau, fos=F>0?Pcap/F:null;
          return {
            outputs:{A,Pcap,fos},
            math:{symbolic:['A = πd²/4','P_cap = n·A·τ','FoS = P_cap/F']},
            verdict: FoSverdict(fos, settings)
          };
        }
      }
    ],
    reference: {
      notes: ['M = F·e; combine direct shear F/n with torsion M·r/J vectorially.', 'FoS thresholds set in Settings (default 2.0 / 1.0).']
    }
  };

  // ============================================================
  // M40 — Power Screws / Screw Jacks
  // ============================================================
  const m40 = {
    id: 'm40',
    title: 'M40 Screw Jacks',
    heading: 'Power Screws & Screw Jacks',
    subtitle: 'Lead, lead angle, friction torque, self-locking, efficiency',
    covers: ['Lead/pitch geometry','Raise/lower torque','Self-locking check','Power & efficiency'],
    sections: [
      {
        id: 'geom',
        title: '§1 Geometry & friction',
        inputs: [
          { key:'TPI', label:'Threads per inch (TPI)', unit:'', default:5 },
          { key:'starts', label:'Starts (multi-start)', unit:'', default:1, type:'int' },
          { key:'thread', label:'Thread form', unit:'', default:'ACME', type:'select', options:['Square','ACME','UN/Stub'] },
          { key:'dm', label:'Mean diameter dm', unit:'in', default:1.0 },
          { key:'mu', label:'Friction coefficient μ', unit:'', default:0.15 }
        ],
        outputs:[
          { key:'p',  label:'Pitch p = 1/TPI',  unit:'in', fmt:'fixed4' },
          { key:'l',  label:'Lead l = starts·p', unit:'in', fmt:'fixed4' },
          { key:'alpha', label:'Thread half-angle α', unit:'deg', fmt:'fixed1' },
          { key:'lambda', label:'Lead angle λ', unit:'deg', fmt:'fixed2' },
          { key:'muf', label:'Effective friction μ_f = μ/cosα', unit:'', fmt:'fixed4' }
        ],
        compute(s){
          const tpi=num(s.TPI),st=Math.max(1,num(s.starts,1)),dm=num(s.dm),mu=num(s.mu);
          const p=1/tpi, l=st*p;
          const alpha = s.thread==='Square'?0 : s.thread==='ACME'?14.5 : 30;
          const lambda = deg(Math.atan(l/(PI*dm)));
          const muf = alpha===0 ? mu : mu/Math.cos(rad(alpha));
          return {outputs:{p,l,alpha,lambda,muf},
            math:{symbolic:['p = 1/TPI','l = starts·p','λ = atan(l/(π·dm))','μ_f = μ/cos(α)']}};
        }
      },
      {
        id: 'torque',
        title: '§2 Raise/Lower torque & efficiency',
        inputs: [
          { key:'W',  label:'Load W', unit:'lb', default:1000 },
          { key:'p',  label:'Pitch p',unit:'in', default:0.2 },
          { key:'l',  label:'Lead l', unit:'in', default:0.2 },
          { key:'dm', label:'Mean diameter dm', unit:'in', default:1.0 },
          { key:'muf',label:'μ_f',     unit:'', default:0.155 },
          { key:'alpha', label:'α',  unit:'deg', default:14.5 },
          { key:'muc', label:'Collar μ_c (0 if no collar)', unit:'', default:0 },
          { key:'rc',  label:'Collar mean radius r_c', unit:'in', default:0 },
          { key:'rpm', label:'Rotation speed', unit:'rpm', default:30 }
        ],
        outputs:[
          { key:'Tthr_R', label:'Thread torque (raise)', unit:'lb·in', fmt:'fixed2' },
          { key:'Tthr_L', label:'Thread torque (lower)', unit:'lb·in', fmt:'fixed2' },
          { key:'Tcol',   label:'Collar torque T_c = μ_c·W·r_c', unit:'lb·in', fmt:'fixed2' },
          { key:'Tr',     label:'TOTAL raise torque', unit:'lb·in', fmt:'fixed2' },
          { key:'Tl',     label:'TOTAL lower torque', unit:'lb·in', fmt:'fixed2' },
          { key:'eta',    label:'Efficiency η (raise, with collar)', unit:'', fmt:'fixed3' },
          { key:'omega',  label:'Angular velocity ω = 2π·n/60', unit:'rad/s', fmt:'fixed3' },
          { key:'vlift',  label:'Linear lift speed v = l·n/12', unit:'ft/min', fmt:'fixed3' },
          { key:'HP_R',   label:'Power to raise', unit:'HP', fmt:'fixed3' },
          { key:'HP_L',   label:'Power to lower', unit:'HP', fmt:'fixed3' },
          { key:'lock',   label:'Self-locking?', unit:'', fmt:'text' }
        ],
        verdict: null,
        compute(s){
          const W=num(s.W),l=num(s.l),dm=num(s.dm),muf=num(s.muf),alpha=num(s.alpha),rpm=num(s.rpm);
          const muc=num(s.muc,0), rc=num(s.rc,0);
          const lambda=deg(Math.atan(l/(PI*dm)));
          // Thread-only torques
          const Tthr_R=(W*dm/2)*((l+PI*muf*dm)/(PI*dm-muf*l));
          const Tthr_L=(W*dm/2)*((PI*muf*dm-l)/(PI*dm+muf*l));
          // Collar adds drag in BOTH directions
          const Tcol = muc*W*rc;
          const Tr = Tthr_R + Tcol;
          const Tl = Tthr_L + Tcol;
          // Overall efficiency uses raise torque
          const eta=(W*l)/(2*PI*Tr);
          // Power: use ω·T conversion. 6600 in·lb/s = 1 HP, ω in rad/s
          const omega = 2*PI*rpm/60;
          const HP_R = Tr*omega/6600;
          const HP_L = Tl*omega/6600;
          // Lift speed
          const vlift = l*rpm/12;
          const phi=deg(Math.atan(muf));
          const lock = phi>lambda ? 'YES — Self-Locking' : 'NO — Will Backdrive';
          return {outputs:{Tthr_R,Tthr_L,Tcol,Tr,Tl,eta,omega,vlift,HP_R,HP_L,lock},
            math:{symbolic:[
              'T_thread_R = (W·dm/2)·(l + π·μ_f·dm)/(π·dm − μ_f·l)',
              'T_thread_L = (W·dm/2)·(π·μ_f·dm − l)/(π·dm + μ_f·l)',
              'T_collar   = μ_c · W · r_c',
              'T_total_R  = T_thread_R + T_collar',
              'η = W·l/(2π·T_total_R)',
              'ω = 2π·n/60     v = l·n/12 ft/min',
              'P[HP] = T·ω / 6600     (6600 in·lb/s = 1 HP)',
              'self-locking when φ = atan(μ_f) > λ'
            ]}};
        }
      }
    ]
  };

  // ============================================================
  // M50 — Welding & Adhesives
  // ============================================================
  const m50 = {
    id: 'm50',
    title: 'M50 Welding & Adhesives',
    heading: 'Welds & Adhesives',
    subtitle: 'Fillet welds, throat method, weld groups (J_u), electrode lookup, adhesive (metric)',
    covers: ['Fillet weld throat & sizing','Treat-as-line weld groups','Electrode strengths','Adhesive bond stress (metric)'],
    sections: [
      {
        id: 'fillet',
        title: '§1 Fillet weld basics',
        inputs: [
          { key:'h', label:'Leg size h', unit:'in', default:0.25 },
          { key:'L', label:'Total weld length L', unit:'in', default:8 },
          { key:'F', label:'Applied load F', unit:'lb', default:10000 }
        ],
        outputs:[
          { key:'t', label:'Throat t = 0.707·h', unit:'in', fmt:'fixed4' },
          { key:'A', label:'Weld area A = t·L', unit:'in²', fmt:'fixed4' },
          { key:'tau', label:'Average shear F/A', unit:'psi', fmt:'fixed1' }
        ],
        compute(s){
          const h=num(s.h),L=num(s.L),F=num(s.F);
          const t=0.707*h, A=t*L, tau=A>0?F/A:null;
          return {outputs:{t,A,tau}, math:{symbolic:['t = 0.707·h','A = t·L','τ = F/A']}};
        }
      },
      {
        id: 'group',
        title: '§2 Weld group as a line (J_u lookup)',
        blurb: 'Polar moment per inch of weld for common patterns; multiply by throat to get J.',
        inputs: [
          { key:'pattern', label:'Pattern', unit:'', default:'Rectangle', type:'select',
            options:['Straight Line','Two Parallel','Rectangle','C-shape','Circle'] },
          { key:'b', label:'Width b',  unit:'in', default:6 },
          { key:'d', label:'Depth d',  unit:'in', default:8 },
          { key:'V', label:'Direct shear V', unit:'lb', default:8000 },
          { key:'M', label:'Moment M', unit:'lb·in', default:30000 },
          { key:'h', label:'Leg size h', unit:'in', default:0.3125 }
        ],
        outputs:[
          { key:'Lw', label:'Weld length L', unit:'in', fmt:'fixed3' },
          { key:'Ju', label:'J_u (per inch)', unit:'in³', fmt:'fixed3' },
          { key:'J',  label:'J = 0.707·h·J_u', unit:'in⁴', fmt:'fixed3' },
          { key:'fv', label:'Shear flow τ_v = V/(0.707·h·L)', unit:'psi', fmt:'fixed1' },
          { key:'fm', label:'Bending τ_M = M·c/J (max)', unit:'psi', fmt:'fixed1' },
          { key:'fr', label:'Resultant', unit:'psi', fmt:'fixed1' }
        ],
        compute(s){
          const b=num(s.b), d=num(s.d), V=num(s.V), M=num(s.M), h=num(s.h);
          let Lw=0, Ju=0, c=0;
          switch(s.pattern){
            case 'Straight Line':
              Lw=d; Ju=d**3/12; c=d/2; break;
            case 'Two Parallel':
              Lw=2*b; Ju=b*d*d/2; c=d/2; break;
            case 'Rectangle':
              Lw=2*(b+d); Ju=(b+d)**3/6 - 6*b*b*d*d/(b+d) /* approx */ ; if(!isFinite(Ju)||Ju<=0) Ju=(2*b+2*d)*((b*b)+d*d)/12;
              Ju=(b+d)**3/6; // common simplified J_u for rectangle treated-as-line
              c=Math.hypot(b,d)/2; break;
            case 'C-shape':
              Lw=2*b+d; Ju=(2*b+d)**3/12 - b*b*(b+d)**2/(2*b+d); c=Math.hypot(b,d/2); break;
            case 'Circle':
              Lw=PI*num(s.b||1); Ju=PI*Math.pow(num(s.b||1),3)/4; c=num(s.b||1)/2; break;
          }
          const t=0.707*h;
          const J=t*Ju;
          const A=t*Lw;
          const fv = A>0? V/A : null;
          const fm = J>0? M*c/J : null;
          const fr = (fv!=null && fm!=null) ? Math.hypot(fv,fm) : null;
          return {outputs:{Lw,Ju,J,fv,fm,fr},
            math:{symbolic:['L = pattern','J_u = treat-as-line table','J = t·J_u','τ_v = V/(t·L)','τ_M = M·c/J','τ_R = √(τ_v²+τ_M²)']}};
        }
      },
      {
        id: 'electrode',
        title: '§3 Electrode allowables',
        blurb: 'AWS E-series tensile/shear allowables (ksi).',
        inputs:[ { key:'series', label:'Electrode', unit:'', default:'E70', type:'select', options:['E60','E70','E80','E90','E100','E120'] }],
        outputs:[
          { key:'Fu',  label:'Tensile Fu', unit:'ksi', fmt:'fixed0' },
          { key:'Sus', label:'Shear allow', unit:'ksi', fmt:'fixed0' }
        ],
        compute(s){
          const t={E60:[62,50],E70:[70,57],E80:[80,67],E90:[90,77],E100:[100,87],E120:[120,107]};
          const v=t[s.series]||t.E70;
          return {outputs:{Fu:v[0],Sus:v[1]}, math:{symbolic:['Lookup AWS standard']}};
        }
      },
      {
        id: 'direct',
        title: '§4 Direct loading on welds',
        blurb: 'Average shear or normal stress from a direct force on the throat area.',
        inputs: [
          { key:'F',  label:'Applied force F', unit:'lb', default:5000 },
          { key:'Aw', label:'Total throat area A_w (from §1 or §2)', unit:'in²', default:3.18 },
          { key:'kind', label:'Loading type', unit:'', default:'Shear', type:'select', options:['Shear','Normal'] }
        ],
        outputs:[
          { key:'sigma_psi', label:'Direct stress (psi)', unit:'psi', fmt:'fixed1' },
          { key:'sigma_ksi', label:'Direct stress (ksi)', unit:'ksi', fmt:'fixed4' },
          { key:'kindOut',   label:'Stress kind',         unit:'',    fmt:'text' }
        ],
        compute(s){
          const F=num(s.F), Aw=num(s.Aw);
          const sigma_psi = Aw>0 ? F/Aw : null;
          const sigma_ksi = sigma_psi==null ? null : sigma_psi/1000;
          const kindOut = s.kind==='Normal' ? 'σ (normal)' : 'τ (shear)';
          return {outputs:{sigma_psi,sigma_ksi,kindOut},
            math:{symbolic:['τ = F / A_w  (shear loading)','σ = F / A_w  (normal loading)','A_w = throat·length·n_lines']}};
        }
      },
      {
        id: 'bend_tor',
        title: '§5 Bending & torsion on weld group',
        blurb: 'Bending stress σ_b = M·c/I and torsional shear τ_t = T·r/J at the worst point of a weld group.',
        inputs:[
          { key:'M',  label:'Bending moment M', unit:'lb·in', default:15000 },
          { key:'T',  label:'Torque T',         unit:'lb·in', default:10000 },
          { key:'I',  label:'I (from §2)',      unit:'in⁴',   default:28.6335 },
          { key:'J',  label:'J (from §2)',      unit:'in⁴',   default:44.1875 },
          { key:'c',  label:'c (max distance, bending)', unit:'in', default:3 },
          { key:'rmax', label:'r_max (torsion)', unit:'in', default:3.6056 },
          { key:'b',  label:'b (rectangle width — for τ_y component)', unit:'in', default:4 },
          { key:'d',  label:'d (rectangle depth — for τ_x component)', unit:'in', default:6 }
        ],
        outputs:[
          { key:'sigma_b', label:'Bending stress σ_b = M·c/I', unit:'psi', fmt:'fixed1' },
          { key:'tau_t',   label:'Torsional shear at r_max τ_t = T·r/J', unit:'psi', fmt:'fixed1' },
          { key:'tau_tx',  label:'Torsion x-component τ_x = T·(d/2)/J',  unit:'psi', fmt:'fixed1' },
          { key:'tau_ty',  label:'Torsion y-component τ_y = T·(b/2)/J',  unit:'psi', fmt:'fixed1' }
        ],
        compute(s){
          const M=num(s.M),T=num(s.T),I=num(s.I),J=num(s.J),c=num(s.c),rmax=num(s.rmax),b=num(s.b),d=num(s.d);
          const sigma_b = I>0 ? M*c/I : null;
          const tau_t   = J>0 ? T*rmax/J : null;
          const tau_tx  = J>0 ? T*(d/2)/J : null;
          const tau_ty  = J>0 ? T*(b/2)/J : null;
          return {outputs:{sigma_b,tau_t,tau_tx,tau_ty},
            math:{symbolic:['σ_b = M·c / I','τ_t = T·r_max / J','τ_x = T·(d/2)/J','τ_y = T·(b/2)/J']}};
        }
      },
      {
        id: 'combined',
        title: '§6 Combined loading — resultant at critical point',
        blurb: 'Vector sum of direct shear + moment-induced stresses at the worst point of the weld.',
        inputs:[
          { key:'tau_direct', label:'τ_direct (from §4)',  unit:'psi', default:1571.6 },
          { key:'sigma_b',    label:'σ_b      (from §5)',  unit:'psi', default:1571.6 },
          { key:'tau_tx',     label:'τ_x      (from §5)',  unit:'psi', default:678.9 },
          { key:'tau_ty',     label:'τ_y      (from §5)',  unit:'psi', default:452.6 }
        ],
        outputs:[
          { key:'tau_R_psi', label:'Resultant τ_R', unit:'psi', fmt:'fixed1' },
          { key:'tau_R_ksi', label:'Resultant τ_R', unit:'ksi', fmt:'fixed4' }
        ],
        compute(s){
          const td=num(s.tau_direct), sb=num(s.sigma_b), tx=num(s.tau_tx), ty=num(s.tau_ty);
          const tau_R_psi = Math.hypot(td + tx, sb + ty);
          return {outputs:{tau_R_psi, tau_R_ksi: tau_R_psi/1000},
            math:{symbolic:['τ_R = √[(τ_direct + τ_x)² + (σ_b + τ_y)²]','Adjust signs based on direction at the critical point']}};
        }
      },
      {
        id: 'gear_weld_metric',
        title: '§9 Circumferential weld gear-to-shaft (metric)',
        blurb: 'Solve for required fillet leg h on a gear-to-shaft circumferential weld carrying a torque T.',
        inputs:[
          { key:'d',     label:'Shaft diameter d', unit:'mm',  default:35 },
          { key:'T',     label:'Torque to transmit T', unit:'N·m', default:200 },
          { key:'tau_a', label:'Allowable shear τ_allow', unit:'MPa', default:125 },
          { key:'n',     label:'Factor of safety n', unit:'', default:1 },
          { key:'h_chosen', label:'Chosen leg h (verify)', unit:'mm', default:1.5 }
        ],
        outputs:[
          { key:'tau_d',   label:'Design shear τ_d = τ_allow / n', unit:'MPa',  fmt:'fixed3' },
          { key:'t_req',   label:'Required throat t_req = 2T·1000 / (π·d²·τ_d)', unit:'mm', fmt:'fixed4' },
          { key:'h_req',   label:'Required leg h_req = t_req / 0.707', unit:'mm', fmt:'fixed4' },
          { key:'h_practical', label:'Practical leg (round up to next 0.5 mm)', unit:'mm', fmt:'fixed1' },
          { key:'t_actual', label:'At chosen h: actual throat 0.707·h', unit:'mm', fmt:'fixed4' },
          { key:'J_actual', label:'Polar moment J = π·d³·t/4', unit:'mm⁴', fmt:'fixed1' },
          { key:'tau_actual', label:'Actual shear τ = T·1000·(d/2)/J', unit:'MPa', fmt:'fixed3' },
          { key:'verdict_text', label:'Verdict (τ ≤ τ_allow ?)', unit:'', fmt:'text' }
        ],
        compute(s){
          const d=num(s.d), T_Nm=num(s.T), ta=num(s.tau_a), n=Math.max(1e-9,num(s.n,1));
          const h_chosen=num(s.h_chosen);
          const T = T_Nm*1000;          // N·mm
          const tau_d = ta/n;
          const t_req = 2*T/(PI*d*d*tau_d);
          const h_req = t_req/0.707;
          const h_practical = Math.ceil(h_req/0.5)*0.5;
          const t_actual = 0.707*h_chosen;
          const J_actual = PI*Math.pow(d,3)*t_actual/4;
          const tau_actual = J_actual>0 ? T*(d/2)/J_actual : null;
          const verdict_text = (tau_actual!=null && tau_actual<=ta) ? 'SAFE — τ ≤ τ_allow' : 'FAILS — τ > τ_allow';
          return {outputs:{tau_d,t_req,h_req,h_practical,t_actual,J_actual,tau_actual,verdict_text},
            math:{symbolic:[
              'Solve τ = T·r / J  with thin-ring J = π·d³·t/4',
              't_req = 2T / (π·d²·τ_d)',
              'h_req = t_req / 0.707  (fillet throat geometry)',
              'Round h up to next standard 0.5 mm increment'
            ]}};
        }
      },
      {
        id: 'adhesive',
        title: '§7 Adhesive bond (metric)',
        blurb: 'Cylindrical lap-shear style bond — solve for required overlap length.',
        inputs:[
          { key:'F', label:'Axial load F', unit:'N', default:2000 },
          { key:'D', label:'Diameter D', unit:'mm', default:25 },
          { key:'tau_a', label:'Shear allow τ_a', unit:'MPa', default:10 }
        ],
        outputs:[
          { key:'tau_req', label:'τ required (axial method)', unit:'MPa', fmt:'fixed3' },
          { key:'L_min',   label:'Minimum overlap L', unit:'mm', fmt:'fixed2' }
        ],
        compute(s){
          const F=num(s.F),D=num(s.D),ta=num(s.tau_a);
          // From Excel: τ_req = 2F/(π·D²·τ_a)  is shape-factor; L_min = τ_req/0.707 ceiling 0.5mm
          const tau_req = 2*F/(PI*D*D*ta);
          const L_min = Math.ceil((tau_req/0.707)/0.5)*0.5;
          return {outputs:{tau_req,L_min}, math:{symbolic:['τ_req from axial-bond geometry','L = ceil(τ_req/0.707, 0.5 mm)']}};
        }
      }
    ]
  };

  // ============================================================
  // M60 — Fatigue (mean/alternating, Marin, Soderberg)
  // ============================================================
  const m60 = {
    id: 'm60',
    title: 'M60 Fatigue',
    heading: 'Fatigue Loading',
    subtitle: 'Mean/alt stresses, Marin endurance limit, Soderberg criterion',
    covers: ['Stress amplitude/mean','Marin factors','Soderberg n_f'],
    sections: [
      {
        id: 'stress',
        title: '§1 Mean & alternating stress',
        inputs:[
          { key:'smax', label:'σ_max', unit:'ksi', default:40 },
          { key:'smin', label:'σ_min', unit:'ksi', default:-10 }
        ],
        outputs:[
          { key:'sm', label:'σ_m = (σ_max+σ_min)/2', unit:'ksi', fmt:'fixed2' },
          { key:'sa', label:'σ_a = (σ_max−σ_min)/2', unit:'ksi', fmt:'fixed2' },
          { key:'R',  label:'Stress ratio R',         unit:'', fmt:'fixed3' }
        ],
        compute(s){
          const a=num(s.smax),b=num(s.smin);
          const sm=(a+b)/2, sa=(a-b)/2, R=a!==0?b/a:null;
          return {outputs:{sm,sa,R}, math:{symbolic:['σ_m = (σ_max+σ_min)/2','σ_a = (σ_max−σ_min)/2']}};
        }
      },
      {
        id: 'marin',
        title: '§2 Marin endurance limit',
        inputs:[
          { key:'Sut', label:"S_ut (tensile)", unit:'ksi', default:80 },
          { key:'ka', label:'Surface k_a',  unit:'', default:0.78 },
          { key:'kb', label:'Size k_b',     unit:'', default:0.85 },
          { key:'kc', label:'Loading k_c',  unit:'', default:1.0 },
          { key:'kd', label:'Temp k_d',     unit:'', default:1.0 },
          { key:'ke', label:'Reliability k_e', unit:'', default:0.897 },
          { key:'Kf', label:'Fatigue conc K_f', unit:'', default:1.6 }
        ],
        outputs:[
          { key:'Seprime', label:"S'_e (uncorrected)", unit:'ksi', fmt:'fixed2' },
          { key:'Se', label:'S_e (Marin-corrected)',   unit:'ksi', fmt:'fixed2' },
          { key:'Senet', label:'S_e/K_f (effective)',  unit:'ksi', fmt:'fixed2' }
        ],
        compute(s){
          const Sut=num(s.Sut);
          const Seprime = Sut<=200 ? 0.5*Sut : 100;
          const Se = Seprime * num(s.ka)*num(s.kb)*num(s.kc)*num(s.kd)*num(s.ke);
          const Senet = num(s.Kf)>0 ? Se/num(s.Kf) : Se;
          return {outputs:{Seprime,Se,Senet}, math:{symbolic:["S'_e = 0.5·S_ut (≤200ksi)","S_e = k_a·k_b·k_c·k_d·k_e·S'_e","S_e,eff = S_e/K_f"]}};
        }
      },
      {
        id: 'soderberg',
        title: '§3 Soderberg n_f',
        inputs:[
          { key:'sa', label:'σ_a', unit:'ksi', default:12 },
          { key:'sm', label:'σ_m', unit:'ksi', default:18 },
          { key:'Sy', label:'S_y', unit:'ksi', default:60 },
          { key:'Se', label:'S_e (eff)', unit:'ksi', default:25 }
        ],
        outputs:[ { key:'fos', label:'n_f (Soderberg)', unit:'', fmt:'fixed2' }],
        verdict:'fos',
        compute(s, settings){
          const sa=num(s.sa),sm=num(s.sm),Sy=num(s.Sy),Se=num(s.Se);
          const fos = (sa/Se+sm/Sy)>0 ? 1/(sa/Se+sm/Sy) : null;
          return {outputs:{fos}, math:{symbolic:['1/n_f = σ_a/S_e + σ_m/S_y']}, verdict: FoSverdict(fos,settings)};
        }
      }
    ]
  };

  // ============================================================
  // M70 — Shafts (static, DE-Soderberg, press-fit, set screws, critical speed)
  // ============================================================
  const m70 = {
    id: 'm70',
    title: 'M70 Shafts',
    heading: 'Shafts — static, fatigue, press fits, critical speed',
    subtitle: 'Combined stresses, DE-Soderberg, Lamé interference, set-screw torque, Rayleigh ω_n',
    covers: ['Static + von-Mises','DE-Soderberg n_f','Press fits (US & metric)','Set screws','Critical speed'],
    sections: [
      {
        id: 'static',
        title: '§1 Static combined stress',
        inputs:[
          { key:'d', label:'Shaft diameter d', unit:'in', default:1.0 },
          { key:'M', label:'Bending M',       unit:'lb·in', default:2000 },
          { key:'T', label:'Torsion T',       unit:'lb·in', default:1500 }
        ],
        outputs:[
          { key:'I', label:'I = πd⁴/64', unit:'in⁴', fmt:'fixed5' },
          { key:'J', label:'J = πd⁴/32', unit:'in⁴', fmt:'fixed5' },
          { key:'sb', label:'σ_b = M·c/I', unit:'ksi', fmt:'fixed3' },
          { key:'tt', label:'τ = T·c/J',   unit:'ksi', fmt:'fixed3' },
          { key:'svm', label:'σ_vM = √(σ²+3τ²)', unit:'ksi', fmt:'fixed3' }
        ],
        compute(s){
          const d=num(s.d),M=num(s.M),T=num(s.T);
          const c=d/2, I=PI*d**4/64, J=PI*d**4/32;
          const sb=M*c/I/1000, tt=T*c/J/1000;
          const svm=Math.sqrt(sb*sb + 3*tt*tt);
          return {outputs:{I,J,sb,tt,svm}, math:{symbolic:['σ_b = M·c/I','τ = T·c/J','σ_vM = √(σ_b²+3τ²)']}};
        }
      },
      {
        id: 'de_sod',
        title: '§2 DE-Soderberg n_f',
        inputs:[
          { key:'d',  label:'Shaft d', unit:'in', default:1.0 },
          { key:'Ma', label:'M_a (alt)', unit:'lb·in', default:1500 },
          { key:'Mm', label:'M_m (mean)', unit:'lb·in', default:500 },
          { key:'Ta', label:'T_a (alt)', unit:'lb·in', default:0 },
          { key:'Tm', label:'T_m (mean)', unit:'lb·in', default:1500 },
          { key:'Kf', label:'K_f bending', unit:'', default:1.6 },
          { key:'Kfs',label:'K_fs torsion', unit:'', default:1.4 },
          { key:'Sy', label:'S_y', unit:'ksi', default:60 },
          { key:'Se', label:'S_e (Marin)', unit:'ksi', default:25 }
        ],
        outputs:[
          { key:'Aterm', label:"A = √[ (32K_f M_a/πd³)² + 3(16K_fs T_a/πd³)² ]", unit:'ksi', fmt:'fixed3' },
          { key:'Bterm', label:"B = √[ (32K_f M_m/πd³)² + 3(16K_fs T_m/πd³)² ]", unit:'ksi', fmt:'fixed3' },
          { key:'fos',   label:'n_f (DE-Soderberg)', unit:'', fmt:'fixed2' }
        ],
        verdict:'fos',
        compute(s, settings){
          const d=num(s.d),Ma=num(s.Ma),Mm=num(s.Mm),Ta=num(s.Ta),Tm=num(s.Tm),Kf=num(s.Kf),Kfs=num(s.Kfs),Sy=num(s.Sy),Se=num(s.Se);
          const A=Math.sqrt( (32*Kf*Ma/(PI*d**3))**2 + 3*(16*Kfs*Ta/(PI*d**3))**2 )/1000;
          const B=Math.sqrt( (32*Kf*Mm/(PI*d**3))**2 + 3*(16*Kfs*Tm/(PI*d**3))**2 )/1000;
          const fos = (A/Se + B/Sy)>0 ? 1/(A/Se + B/Sy) : null;
          return {outputs:{Aterm:A,Bterm:B,fos}, math:{symbolic:['1/n_f = A/S_e + B/S_y']}, verdict:FoSverdict(fos,settings)};
        }
      },
      {
        id: 'pressfit',
        title: '§5 Press fit (US)',
        inputs:[
          { key:'delta', label:'Total interference δ', unit:'in', default:0.001 },
          { key:'D', label:'Interface diameter D', unit:'in', default:1.0 },
          { key:'Eo', label:'E outer (Mpsi)', unit:'Mpsi', default:30 },
          { key:'Ei', label:'E inner (Mpsi)', unit:'Mpsi', default:30 },
          { key:'co', label:'Outer radius ratio R_o/R', unit:'', default:2.0 },
          { key:'nu', label:"Poisson's ν", unit:'', default:0.292 }
        ],
        outputs:[ { key:'p', label:'Interface pressure p', unit:'psi', fmt:'fixed1' }],
        compute(s){
          const delta=num(s.delta),D=num(s.D),Eo=num(s.Eo)*1e6,Ei=num(s.Ei)*1e6,co=num(s.co),nu=num(s.nu);
          const p = delta / ( D * ( (1/Eo)*((co*co+1)/(co*co-1) + nu) + (1/Ei)*(1-nu) ) );
          return {outputs:{p}, math:{symbolic:['p = δ / [D·((1/E_o)((c²+1)/(c²-1)+ν) + (1/E_i)(1-ν))]']}};
        }
      },
      {
        id: 'pressfit_metric',
        title: '§5b Press / shrink fit (metric)',
        blurb: 'Metric press-fit: gives interface pressure p, then torque capacity T = μ·p·π·d·L · (d/2).',
        inputs:[
          { key:'ds_max', label:'Shaft OD max d_s,max', unit:'mm', default:35.076 },
          { key:'ds_min', label:'Shaft OD min d_s,min', unit:'mm', default:35.060 },
          { key:'dh_max', label:'Hole ID max d_h,max',  unit:'mm', default:35.025 },
          { key:'dh_min', label:'Hole ID min d_h,min',  unit:'mm', default:35.000 },
          { key:'Dh',     label:'Hub OD D_h',          unit:'mm', default:75 },
          { key:'L',      label:'Contact length L (for pressure calc)',     unit:'mm', default:15 },
          { key:'L_t',    label:'Contact length for torque L_t', unit:'mm', default:50 },
          { key:'Es',     label:'E shaft',              unit:'MPa', default:200000 },
          { key:'Eh',     label:'E hub',                unit:'MPa', default:200000 },
          { key:'nu',     label:"Poisson's ν (both)",   unit:'',    default:0.29 },
          { key:'mu',     label:'Friction μ',           unit:'',    default:0.20 },
          { key:'p_design', label:'Design pressure for torque p_d (0 = use p_min)', unit:'MPa', default:35 }
        ],
        outputs:[
          { key:'delta_max', label:'Max diametral interference δ_max', unit:'mm', fmt:'fixed4' },
          { key:'delta_min', label:'Min diametral interference δ_min', unit:'mm', fmt:'fixed4' },
          { key:'delta_avg', label:'Expected interference δ (avg)',    unit:'mm', fmt:'fixed4' },
          { key:'d_avg',     label:'Nominal interface diameter d',     unit:'mm', fmt:'fixed4' },
          { key:'C',         label:'Diameter ratio C = D_h / d',       unit:'',   fmt:'fixed3' },
          { key:'p',         label:'Interface pressure p (avg δ)',     unit:'MPa', fmt:'fixed2' },
          { key:'p_min',     label:'Pressure at min interference',     unit:'MPa', fmt:'fixed2' },
          { key:'p_max',     label:'Pressure at max interference',     unit:'MPa', fmt:'fixed2' },
          { key:'Fn',        label:'Normal force on interface F_n',    unit:'N',   fmt:'fixed1' },
          { key:'Ff',        label:'Friction force F_f = μ·F_n',       unit:'N',   fmt:'fixed1' },
          { key:'T_Nmm',     label:'Max transmissible torque T',       unit:'N·mm', fmt:'fixed1' },
          { key:'T_Nm',      label:'Max transmissible torque T',       unit:'N·m',  fmt:'fixed3' }
        ],
        compute(s){
          const ds_max=num(s.ds_max), ds_min=num(s.ds_min);
          const dh_max=num(s.dh_max), dh_min=num(s.dh_min);
          const Dh=num(s.Dh), L=num(s.L), L_t=num(s.L_t,L);
          const Es=num(s.Es), Eh=num(s.Eh), nu=num(s.nu), mu=num(s.mu);
          const p_design_in = num(s.p_design,0);
          const delta_max = ds_max - dh_min;
          const delta_min = ds_min - dh_max;
          const delta_avg = (delta_max + delta_min) / 2;
          const d_avg = (ds_max + ds_min + dh_max + dh_min) / 4;
          const C = Dh / d_avg;
          // Press-fit pressure (same form as US, with ν shared between hub and shaft per Excel)
          function pressure(delta){
            return delta / ( d_avg * ( (1/Eh)*((C*C+1)/(C*C-1) + nu) + (1/Es)*(1 - nu) ) );
          }
          const p     = pressure(delta_avg);
          const p_min = pressure(delta_min);
          const p_max = pressure(delta_max);
          // For torque: use override if provided, else conservative p_min
          const p_torque = p_design_in > 0 ? p_design_in : p_min;
          const Fn = p_torque * PI * d_avg * L_t;   // N
          const Ff = mu * Fn;                       // N
          const T_Nmm = Ff * d_avg / 2;             // N·mm
          const T_Nm  = T_Nmm / 1000;
          return {outputs:{delta_max,delta_min,delta_avg,d_avg,C,p,p_min,p_max,Fn,Ff,T_Nmm,T_Nm},
            math:{symbolic:[
              'δ = d_s − d_h     d = average of all four diameters',
              'C = D_h / d',
              'p = δ / { d · [ (1/E_h)·((C²+1)/(C²−1) + ν) + (1/E_s)·(1 − ν) ] }',
              'F_n = p · π · d · L      F_f = μ · F_n',
              'T_max = F_f · d/2'
            ]}};
        }
      },
      {
        id: 'setscrew',
        title: '§4 Set-screw holding torque',
        inputs:[
          { key:'F', label:'Axial set-screw force F', unit:'lb', default:300 },
          { key:'d', label:'Major thread d', unit:'in', default:0.25 },
          { key:'TPI', label:'TPI', unit:'', default:20 },
          { key:'mu', label:'Friction μ', unit:'', default:0.15 },
          { key:'Dsh', label:'Shaft diameter Dsh', unit:'in', default:1.0 }
        ],
        outputs:[
          { key:'dm', label:'Mean dia dm = d − 0.6495/TPI', unit:'in', fmt:'fixed4' },
          { key:'lambda', label:'Lead angle λ', unit:'deg', fmt:'fixed2' },
          { key:'T', label:'Holding torque on shaft', unit:'lb·in', fmt:'fixed2' }
        ],
        compute(s){
          const F=num(s.F),d=num(s.d),tpi=num(s.TPI),mu=num(s.mu),Dsh=num(s.Dsh);
          const dm=d-0.6495/tpi;
          const lambda=deg(Math.atan((1/tpi)/(PI*dm)));
          // T_shaft ≈ μ·F·Dsh/2
          const T=mu*F*Dsh/2;
          return {outputs:{dm,lambda,T}, math:{symbolic:['dm = d − 0.6495/TPI','T_shaft ≈ μ·F·Dsh/2']}};
        }
      },
      {
        id: 'critspeed',
        title: '§6 Critical speed (Rayleigh, simply supported)',
        inputs:[
          { key:'L', label:'Span L', unit:'in', default:24 },
          { key:'a', label:'Load position a', unit:'in', default:12 },
          { key:'W', label:'Concentrated weight W', unit:'lb', default:50 },
          { key:'E', label:'E', unit:'Mpsi', default:30 },
          { key:'I', label:'I', unit:'in⁴', default:0.049 }
        ],
        outputs:[
          { key:'delta', label:'Static deflection δ', unit:'in', fmt:'fixed5' },
          { key:'wn',    label:'ω_n', unit:'rad/s', fmt:'fixed2' },
          { key:'rpm',   label:'Critical speed', unit:'rpm', fmt:'fixed1' }
        ],
        compute(s){
          const L=num(s.L),a=num(s.a),W=num(s.W),E=num(s.E)*1e6,I=num(s.I);
          // Mid-span concentrated load deflection (simply supported, point load at a):
          // δ = W·a²·(L−a)² / (3·E·I·L)
          const delta = W*a*a*(L-a)*(L-a)/(3*E*I*L);
          const wn = delta>0 ? Math.sqrt(386.4/delta) : null;
          const rpm = wn ? wn*60/(2*PI) : null;
          return {outputs:{delta,wn,rpm}, math:{symbolic:['δ = W·a²·(L−a)²/(3·E·I·L)','ω_n = √(g/δ), g = 386.4 in/s²','RPM_cr = ω_n·60/(2π)']}};
        }
      }
    ]
  };

  // ============================================================
  // M90 — Bearings (rolling element)
  // ============================================================
  const m90 = {
    id: 'm90',
    title: 'M90 Bearings',
    heading: 'Rolling-Element Bearings',
    subtitle: 'L₁₀ life, reliability adjustment, equivalent load',
    covers: ['Basic L₁₀ life','Reliability adjustment','Catalog rating from life','Equivalent radial load'],
    sections: [
      {
        id: 'l10',
        title: '§1 Basic L₁₀ life',
        inputs:[
          { key:'C', label:'Dynamic rating C', unit:'lb', default:7500 },
          { key:'P', label:'Equivalent load P', unit:'lb', default:1500 },
          { key:'a', label:'Load-life exponent a (3 ball, 10/3 roller)', unit:'', default:3 },
          { key:'rpm', label:'Speed n', unit:'rpm', default:1750 }
        ],
        outputs:[
          { key:'L10rev', label:'L₁₀ (million rev)', unit:'Mrev', fmt:'fixed2' },
          { key:'L10hr',  label:'L₁₀ life', unit:'hours', fmt:'fixed1' }
        ],
        compute(s){
          const C=num(s.C),P=num(s.P),a=num(s.a),n=num(s.rpm);
          const L10=Math.pow(C/P,a);
          const L10hr = n>0 ? L10*1e6/(60*n) : null;
          return {outputs:{L10rev:L10, L10hr}, math:{symbolic:['L₁₀ = (C/P)^a','L₁₀,hr = L₁₀·10⁶/(60·n)']}};
        }
      },
      {
        id: 'rel',
        title: '§2 Reliability-adjusted life',
        blurb: 'Lₙ = a₁·L₁₀, where a₁ depends on target reliability.',
        inputs:[
          { key:'L10', label:'L₁₀ (Mrev)', unit:'Mrev', default:125 },
          { key:'rel', label:'Reliability', unit:'', default:'95%', type:'select',
            options:['90%','95%','96%','97%','98%','99%'] }
        ],
        outputs:[
          { key:'a1', label:'a₁ factor', unit:'', fmt:'fixed3' },
          { key:'Ln', label:'Lₙ adjusted life', unit:'Mrev', fmt:'fixed2' }
        ],
        compute(s){
          const t={'90%':1.0,'95%':0.62,'96%':0.53,'97%':0.44,'98%':0.33,'99%':0.21};
          const a1=t[s.rel] || 1.0;
          const Ln=num(s.L10)*a1;
          return {outputs:{a1,Ln}, math:{symbolic:['Lₙ = a₁·L₁₀']}};
        }
      },
      {
        id: 'cfromL',
        title: '§3 Catalog rating from required life',
        inputs:[
          { key:'L', label:'Required life L (Mrev)', unit:'Mrev', default:300 },
          { key:'P', label:'Load P', unit:'lb', default:1500 },
          { key:'a', label:'Exponent a', unit:'', default:3 }
        ],
        outputs:[ { key:'Creq', label:'Required C = P·L^(1/a)', unit:'lb', fmt:'fixed1' }],
        compute(s){
          const L=num(s.L),P=num(s.P),a=num(s.a);
          const Creq=P*Math.pow(L,1/a);
          return {outputs:{Creq}, math:{symbolic:['C_req = P·L^(1/a)']}};
        }
      },
      {
        id: 'peq',
        title: '§4 Equivalent radial load',
        inputs:[
          { key:'Fr', label:'Radial Fᵣ', unit:'lb', default:1200 },
          { key:'Fa', label:'Thrust Fₐ', unit:'lb', default:300 },
          { key:'X',  label:'X factor', unit:'', default:0.56 },
          { key:'Y',  label:'Y factor', unit:'', default:1.31 }
        ],
        outputs:[
          { key:'Peq', label:'P = X·Fr + Y·Fa', unit:'lb', fmt:'fixed1' },
          { key:'use', label:'Use P or Fr?', unit:'', fmt:'text' }
        ],
        compute(s){
          const Fr=num(s.Fr),Fa=num(s.Fa),X=num(s.X),Y=num(s.Y);
          const Peq=X*Fr+Y*Fa;
          const use = Peq>=Fr ? 'Yes — use P' : 'No — use Fᵣ instead';
          return {outputs:{Peq,use}, math:{symbolic:['P = X·Fᵣ + Y·Fₐ']}};
        }
      }
    ]
  };

  // ============================================================
  // M110 — Drive Trains (gears, belts, chains, helical/bevel/worm)
  // ============================================================
  // Lewis form factor table (20°, full-depth)
  const LewisY20 = [
    [12,0.245],[14,0.276],[16,0.296],[18,0.309],[20,0.320],[25,0.339],[30,0.349],
    [40,0.389],[50,0.408],[75,0.435],[100,0.447],[150,0.460],[300,0.471]
  ];
  const lookupY = N => {
    if (!isFinite(N) || N<=0) return 0.32;
    if (N>=300) return 0.485;
    let lo=LewisY20[0],hi=LewisY20[LewisY20.length-1];
    for (let i=0;i<LewisY20.length-1;i++){
      if (N>=LewisY20[i][0] && N<=LewisY20[i+1][0]){ lo=LewisY20[i]; hi=LewisY20[i+1]; break; }
    }
    if (lo[0]===hi[0]) return lo[1];
    return lo[1] + (hi[1]-lo[1]) * (N-lo[0])/(hi[0]-lo[0]);
  };

  const m110 = {
    id: 'm110',
    title: 'M110 Drive Trains',
    heading: 'Drive Trains',
    subtitle: 'Power-speed-torque, spur/helical/bevel/worm gears, belts, chains',
    covers: ['HP↔Torque↔RPM','Spur gear geometry & Lewis bending','Belt & V-belt with capstan','Chain length','Helical, bevel, worm'],
    sections: [
      {
        id: 'pst',
        title: '§1 Power · Speed · Torque',
        inputs:[
          { key:'HP', label:'Power', unit:'HP', default:5 },
          { key:'rpm', label:'Speed', unit:'rpm', default:1750 }
        ],
        outputs:[
          { key:'Tin', label:'T = HP·63025/n', unit:'lb·in', fmt:'fixed2' },
          { key:'Tft', label:'T = HP·5252/n',  unit:'lb·ft', fmt:'fixed2' }
        ],
        compute(s){
          const HP=num(s.HP),n=num(s.rpm);
          const Tin = n>0?HP*63025/n:null, Tft = n>0?HP*5252/n:null;
          return {outputs:{Tin,Tft}, math:{symbolic:['T(lb·in)=HP·63025/n','T(lb·ft)=HP·5252/n']}};
        }
      },
      {
        id: 'spur',
        title: '§2 Spur gear geometry',
        inputs:[
          { key:'Pd', label:'Diametral pitch P_d', unit:'1/in', default:8 },
          { key:'Np', label:'N pinion', unit:'', default:18 },
          { key:'Ng', label:'N gear', unit:'', default:54 }
        ],
        outputs:[
          { key:'p',   label:'Circular pitch p = π/P_d', unit:'in', fmt:'fixed4' },
          { key:'dp',  label:'Pinion d = N/P_d',         unit:'in', fmt:'fixed4' },
          { key:'dg',  label:'Gear d = N/P_d',           unit:'in', fmt:'fixed4' },
          { key:'a',   label:'Addendum 1/P_d',           unit:'in', fmt:'fixed4' },
          { key:'b',   label:'Dedendum 1.25/P_d',        unit:'in', fmt:'fixed4' },
          { key:'h',   label:'Whole depth 2.25/P_d',     unit:'in', fmt:'fixed4' },
          { key:'C',   label:'Center distance',           unit:'in', fmt:'fixed4' },
          { key:'mG',  label:'Ratio m_G = Ng/Np',        unit:'', fmt:'fixed3' }
        ],
        compute(s){
          const Pd=num(s.Pd),Np=num(s.Np),Ng=num(s.Ng);
          const p=PI/Pd, dp=Np/Pd, dg=Ng/Pd, a=1/Pd, b=1.25/Pd, h=2.25/Pd, C=(dp+dg)/2, mG=Np>0?Ng/Np:null;
          return {outputs:{p,dp,dg,a,b,h,C,mG}, math:{symbolic:['p = π/P_d','d = N/P_d','C = (d_p+d_g)/2']}};
        }
      },
      {
        id: 'lewis',
        title: '§3 Lewis bending stress',
        inputs:[
          { key:'HP', label:'Power', unit:'HP', default:5 },
          { key:'rpm', label:'Pinion speed', unit:'rpm', default:1750 },
          { key:'Pd',  label:'P_d', unit:'1/in', default:8 },
          { key:'Np',  label:'N teeth (pinion)', unit:'', default:18 },
          { key:'F',   label:'Face width F', unit:'in', default:1.0 },
          { key:'Y',   label:'Lewis Y (override 0=auto)', unit:'', default:0 },
          { key:'Kv',  label:'Kv (override 0=auto)', unit:'', default:0 }
        ],
        outputs:[
          { key:'V',   label:'V = π·d·n/12', unit:'fpm', fmt:'fixed1' },
          { key:'Wt',  label:'W_t = HP·33000/V', unit:'lb', fmt:'fixed2' },
          { key:'Yu',  label:'Y used', unit:'', fmt:'fixed3' },
          { key:'Kvu', label:'K_v used', unit:'', fmt:'fixed3' },
          { key:'sig', label:'σ = W_t·P_d/(K_v·F·Y)', unit:'ksi', fmt:'fixed3' }
        ],
        compute(s){
          const HP=num(s.HP),n=num(s.rpm),Pd=num(s.Pd),Np=num(s.Np),F=num(s.F);
          const d=Np/Pd, V=PI*d*n/12, Wt = V>0 ? HP*33000/V : 0;
          const Yu = num(s.Y)>0 ? num(s.Y) : lookupY(Np);
          const Kvu = num(s.Kv)>0 ? num(s.Kv) : 600/(600+V);
          const sig = (Kvu>0 && F>0 && Yu>0) ? Wt*Pd/(Kvu*F*Yu)/1000 : null;
          return {outputs:{V,Wt,Yu,Kvu,sig}, math:{symbolic:['V = π·d·n/12','W_t = HP·33000/V','σ = W_t·P_d/(K_v·F·Y)']}};
        }
      },
      {
        id: 'belt',
        title: '§4 Belt drive (flat / V-belt)',
        inputs:[
          { key:'D', label:'Driver D', unit:'in', default:6 },
          { key:'d', label:'Driven d', unit:'in', default:3 },
          { key:'C', label:'Center C', unit:'in', default:18 },
          { key:'mu', label:'Friction μ', unit:'', default:0.3 },
          { key:'beta', label:'V-belt groove angle 2β', unit:'deg', default:38 }
        ],
        outputs:[
          { key:'mG', label:'Speed ratio D/d', unit:'', fmt:'fixed3' },
          { key:'L',  label:'Belt length', unit:'in', fmt:'fixed3' },
          { key:'th_s', label:'θ_small (rad)', unit:'rad', fmt:'fixed3' },
          { key:'eflat', label:'e^(μθ) flat', unit:'', fmt:'fixed3' },
          { key:'evbe',  label:'e^(μθ/sinβ) V-belt', unit:'', fmt:'fixed3' }
        ],
        compute(s){
          const D=num(s.D),d=num(s.d),C=num(s.C),mu=num(s.mu),beta=num(s.beta);
          const mG = d>0?D/d:null;
          const L = 2*C + PI*(D+d)/2 + (D-d)**2/(4*C);
          const th_s = PI - 2*Math.asin((D-d)/(2*C));
          const eflat = Math.exp(mu*th_s);
          const evbe  = Math.exp(mu*th_s/Math.sin(rad(beta/2)));
          return {outputs:{mG,L,th_s,eflat,evbe}, math:{symbolic:[
            'L = 2C + π(D+d)/2 + (D−d)²/(4C)',
            'θ_s = π − 2·asin((D−d)/(2C))',
            'T₁/T₂ = e^(μθ) (flat)',
            'T₁/T₂ = e^(μθ/sinβ) (V-belt)'
          ]}};
        }
      },
      {
        id: 'chain',
        title: '§5 Roller chain length',
        inputs:[
          { key:'N1', label:'Sprocket teeth N₁', unit:'', default:18 },
          { key:'N2', label:'Sprocket teeth N₂', unit:'', default:54 },
          { key:'p',  label:'Pitch p', unit:'in', default:0.5 },
          { key:'C',  label:'Center C (pitches)', unit:'pitches', default:40 }
        ],
        outputs:[
          { key:'Lp', label:'Length (pitches)', unit:'', fmt:'fixed2' },
          { key:'Lp_round', label:'Rounded up to even', unit:'', fmt:'fixed0' }
        ],
        compute(s){
          const N1=num(s.N1),N2=num(s.N2),C=num(s.C);
          const Lp = 2*C + (N1+N2)/2 + (N2-N1)**2 * C / (4*PI*PI);
          const r = Math.ceil(Lp/2)*2;
          return {outputs:{Lp,Lp_round:r}, math:{symbolic:['L = 2C + (N₁+N₂)/2 + (N₂−N₁)²·C/(4π²)']}};
        }
      },
      {
        id: 'helical',
        title: '§6 Helical gear',
        inputs:[
          { key:'Pt', label:'P_t (transverse)', unit:'1/in', default:8 },
          { key:'psi', label:'Helix ψ', unit:'deg', default:20 },
          { key:'phi_n', label:'Normal pressure φ_n', unit:'deg', default:20 },
          { key:'N', label:'N teeth', unit:'', default:24 },
          { key:'Wt', label:'Tangential W_t', unit:'lb', default:300 }
        ],
        outputs:[
          { key:'Pn', label:'P_n = P_t/cosψ', unit:'1/in', fmt:'fixed3' },
          { key:'phi_t', label:'φ_t', unit:'deg', fmt:'fixed3' },
          { key:'Nv',  label:'Virtual N_v = N/cos³ψ', unit:'', fmt:'fixed2' },
          { key:'Wr',  label:'W_r = W_t·tanφ_t', unit:'lb', fmt:'fixed2' },
          { key:'Wa',  label:'W_a = W_t·tanψ', unit:'lb', fmt:'fixed2' }
        ],
        compute(s){
          const Pt=num(s.Pt),psi=rad(num(s.psi)),phin=rad(num(s.phi_n)),N=num(s.N),Wt=num(s.Wt);
          const Pn=Pt/Math.cos(psi);
          const phi_t = deg(Math.atan(Math.tan(phin)/Math.cos(psi)));
          const Nv=N/Math.pow(Math.cos(psi),3);
          const Wr=Wt*Math.tan(rad(phi_t));
          const Wa=Wt*Math.tan(psi);
          return {outputs:{Pn,phi_t,Nv,Wr,Wa}, math:{symbolic:['P_n=P_t/cosψ','φ_t=atan(tanφ_n/cosψ)','N_v=N/cos³ψ','W_r=W_t·tanφ_t','W_a=W_t·tanψ']}};
        }
      },
      {
        id: 'bevel',
        title: '§7 Bevel gear pitch cone',
        inputs:[
          { key:'Np', label:'N pinion', unit:'', default:18 },
          { key:'Ng', label:'N gear',   unit:'', default:36 },
          { key:'dp', label:'Pinion d', unit:'in', default:2.25 }
        ],
        outputs:[
          { key:'delta_p', label:'δ_p = atan(N_p/N_g)', unit:'deg', fmt:'fixed3' },
          { key:'delta_g', label:'δ_g = 90° − δ_p',     unit:'deg', fmt:'fixed3' },
          { key:'Ao',      label:'A_o = d_p/(2·sinδ_p)', unit:'in',  fmt:'fixed3' }
        ],
        compute(s){
          const Np=num(s.Np),Ng=num(s.Ng),dp=num(s.dp);
          const delta_p = deg(Math.atan(Np/Ng));
          const delta_g = 90-delta_p;
          const Ao = dp/(2*Math.sin(rad(delta_p)));
          return {outputs:{delta_p,delta_g,Ao}, math:{symbolic:['δ_p=atan(N_p/N_g)','A_o=d_p/(2sinδ_p)']}};
        }
      },
      {
        id: 'worm',
        title: '§8 Worm gear',
        inputs:[
          { key:'L', label:'Lead L', unit:'in', default:0.5 },
          { key:'dw', label:'Worm dia d_w', unit:'in', default:1.25 },
          { key:'phi_n', label:'Normal pressure φ_n', unit:'deg', default:20 },
          { key:'mu', label:'Friction μ', unit:'', default:0.05 }
        ],
        outputs:[
          { key:'lambda', label:'Lead angle λ', unit:'deg', fmt:'fixed3' },
          { key:'eta',    label:'Efficiency η', unit:'', fmt:'fixed3' }
        ],
        compute(s){
          const L=num(s.L),dw=num(s.dw),phin=rad(num(s.phi_n)),mu=num(s.mu);
          const lambda = deg(Math.atan(L/(PI*dw)));
          const cosphin = Math.cos(phin);
          const tanlam = Math.tan(rad(lambda));
          const eta = (cosphin - mu*tanlam) / (cosphin + mu/Math.tan(rad(lambda)));
          return {outputs:{lambda,eta}, math:{symbolic:['λ = atan(L/(π·d_w))','η = (cosφ_n − μ tanλ)/(cosφ_n + μ/tanλ)']}};
        }
      }
    ]
  };

  // ============================================================
  // M130 — Hydraulics & Pneumatics
  // ============================================================
  const m130 = {
    id: 'm130',
    title: 'M130 Hydraulics',
    heading: 'Hydraulics & Pneumatics',
    subtitle: 'Pascal, flow, power, Darcy-Weisbach, hoop stress, buckling',
    covers: ["Pascal's law cylinder","Flow & cycle time","Hydraulic power","Pipe pressure drop","Hoop stress (auto thin/thick)","Column buckling (Euler/Johnson)"],
    sections: [
      {
        id: 'cyl',
        title: '§1 Cylinder forces',
        inputs:[
          { key:'P', label:'System pressure', unit:'psi', default:1500 },
          { key:'Db', label:'Bore diameter', unit:'in', default:3 },
          { key:'Dr', label:'Rod diameter',  unit:'in', default:1 }
        ],
        outputs:[
          { key:'Ab', label:'Cap area πD_b²/4', unit:'in²', fmt:'fixed3' },
          { key:'Ar', label:'Annulus area',     unit:'in²', fmt:'fixed3' },
          { key:'Fext', label:'Extension force F_ext', unit:'lb', fmt:'fixed1' },
          { key:'Fret', label:'Retract force F_ret',  unit:'lb', fmt:'fixed1' }
        ],
        compute(s){
          const P=num(s.P),Db=num(s.Db),Dr=num(s.Dr);
          const Ab=PI*Db*Db/4, Ar=Ab-PI*Dr*Dr/4;
          return {outputs:{Ab,Ar,Fext:P*Ab,Fret:P*Ar},
            math:{symbolic:['A_b=πD_b²/4','A_r=A_b−πD_r²/4','F=P·A']}};
        }
      },
      {
        id: 'flow',
        title: '§2 Flow & cycle time',
        inputs:[
          { key:'Q', label:'Flow rate Q', unit:'gpm', default:8 },
          { key:'A', label:'Effective area A', unit:'in²', default:7.07 },
          { key:'L', label:'Stroke L', unit:'in', default:12 }
        ],
        outputs:[
          { key:'Qin3s', label:'Q (in³/s)', unit:'in³/s', fmt:'fixed2' },
          { key:'v',     label:'Piston velocity v=Q/A', unit:'in/s', fmt:'fixed3' },
          { key:'t',     label:'Stroke time t=L/v',     unit:'s', fmt:'fixed3' }
        ],
        compute(s){
          const Q=num(s.Q),A=num(s.A),L=num(s.L);
          const Qin3s=Q*231/60, v=A>0?Qin3s/A:null, t=v?L/v:null;
          return {outputs:{Qin3s,v,t}, math:{symbolic:['Q(in³/s)=Q·231/60','v=Q/A','t=L/v']}};
        }
      },
      {
        id: 'power',
        title: '§3 Hydraulic power',
        inputs:[
          { key:'P', label:'Pressure', unit:'psi', default:1500 },
          { key:'Q', label:'Flow', unit:'gpm', default:8 }
        ],
        outputs:[
          { key:'HP', label:'HP = P·Q/1714', unit:'HP', fmt:'fixed3' },
          { key:'kW', label:'kW',           unit:'kW', fmt:'fixed3' }
        ],
        compute(s){
          const P=num(s.P),Q=num(s.Q);
          const HP=P*Q/1714, kW=HP*0.7457;
          return {outputs:{HP,kW}, math:{symbolic:['HP = P·Q/1714']}};
        }
      },
      {
        id: 'darcy',
        title: '§4 Darcy-Weisbach pressure drop',
        inputs:[
          { key:'rho', label:'Density ρ', unit:'lb/in³', default:0.0307 },
          { key:'mu', label:'Viscosity μ', unit:'lb·s/in²', default:6e-7 },
          { key:'D', label:'Pipe ID D', unit:'in', default:0.5 },
          { key:'L', label:'Length L', unit:'in', default:120 },
          { key:'v', label:'Velocity v', unit:'in/s', default:120 },
          { key:'fovr', label:'Friction factor (override 0=auto laminar)', unit:'', default:0 }
        ],
        outputs:[
          { key:'Re', label:'Reynolds Re', unit:'', fmt:'fixed1' },
          { key:'regime', label:'Regime', unit:'', fmt:'text' },
          { key:'f',  label:'f used',    unit:'', fmt:'fixed4' },
          { key:'dP', label:'ΔP', unit:'psi', fmt:'fixed2' }
        ],
        compute(s){
          const rho=num(s.rho),mu=num(s.mu),D=num(s.D),L=num(s.L),v=num(s.v),fov=num(s.fovr);
          const Re = mu>0 ? (rho/386.4) * v * D / mu : null;  // density slug-equivalent
          const regime = Re==null ? '—' : (Re<2300?'Laminar':Re<4000?'Transition':'Turbulent');
          let f;
          if (fov>0) f=fov;
          else if (Re && Re<2300) f=64/Re;
          else f=0.04;
          const dP = f*(L/D)*((rho/386.4)*v*v/2);
          return {outputs:{Re,regime,f,dP}, math:{symbolic:['Re=ρvD/μ','f=64/Re (lam.)','ΔP = f·(L/D)·ρv²/2']}};
        }
      },
      {
        id: 'hoop',
        title: '§5 Hoop stress (auto thin/thick)',
        inputs:[
          { key:'P', label:'Internal pressure P', unit:'psi', default:3000 },
          { key:'ri', label:'Inner radius rᵢ', unit:'in', default:1.0 },
          { key:'ro', label:'Outer radius rₒ', unit:'in', default:1.15 }
        ],
        outputs:[
          { key:'rt', label:'r/t', unit:'', fmt:'fixed2' },
          { key:'thin', label:'Thin-wall σ = P·r/t', unit:'ksi', fmt:'fixed3' },
          { key:'thick', label:'Thick-wall σ = P(rᵢ²+rₒ²)/(rₒ²−rᵢ²)', unit:'ksi', fmt:'fixed3' },
          { key:'use',   label:'Controlling', unit:'', fmt:'text' },
          { key:'sigma', label:'σ used', unit:'ksi', fmt:'fixed3' }
        ],
        compute(s){
          const P=num(s.P),ri=num(s.ri),ro=num(s.ro);
          const t=ro-ri, r=(ri+ro)/2, rt=t>0?r/t:null;
          const thin = t>0 ? P*r/t/1000 : null;
          const thick= (ro*ro-ri*ri)>0 ? P*(ri*ri+ro*ro)/(ro*ro-ri*ri)/1000 : null;
          const useThin = rt!=null && rt>10;
          return {outputs:{rt,thin,thick, use: useThin?'Thin-wall':'Thick-wall', sigma: useThin?thin:thick},
            math:{symbolic:['Thin if r/t > 10: σ=Pr/t','Thick: σ=P(rᵢ²+rₒ²)/(rₒ²−rᵢ²)']}};
        }
      },
      {
        id: 'buckle',
        title: '§6 Column buckling (Euler / Johnson auto)',
        inputs:[
          { key:'Sy', label:'S_y', unit:'ksi', default:50 },
          { key:'E',  label:'E', unit:'Mpsi', default:30 },
          { key:'A',  label:'Cross-section area A', unit:'in²', default:0.785 },
          { key:'I',  label:'Min I', unit:'in⁴', default:0.049 },
          { key:'L',  label:'Unsupported length L', unit:'in', default:30 },
          { key:'K',  label:'Effective length K', unit:'', default:1.0 }
        ],
        outputs:[
          { key:'k',     label:'Radius of gyration k=√(I/A)', unit:'in', fmt:'fixed4' },
          { key:'slr',   label:'Slenderness KL/k', unit:'', fmt:'fixed1' },
          { key:'trans', label:'Transition √(2π²E/S_y)', unit:'', fmt:'fixed2' },
          { key:'mode',  label:'Mode', unit:'', fmt:'text' },
          { key:'Pcr',   label:'P_cr', unit:'lb', fmt:'fixed1' }
        ],
        compute(s){
          const Sy=num(s.Sy)*1000, E=num(s.E)*1e6, A=num(s.A), I=num(s.I), L=num(s.L), K=num(s.K);
          const k=Math.sqrt(I/A);
          const slr = k>0 ? K*L/k : null;
          const trans = Math.sqrt(2*PI*PI*E/Sy);
          const useEuler = slr!=null && slr > trans;
          const Euler = PI*PI*E*I/(K*L*K*L);
          const John  = A*Sy*(1 - Sy*slr*slr/(4*PI*PI*E));
          const Pcr = useEuler ? Euler : John;
          return {outputs:{k,slr,trans,mode:useEuler?'Euler':'Johnson',Pcr},
            math:{symbolic:['k=√(I/A)','transition=√(2π²E/S_y)','Euler P_cr=π²EI/(KL)²','Johnson P_cr=A·S_y[1−S_y(KL/k)²/(4π²E)]']}};
        }
      },
      {
        id: 'pneu',
        title: '§7 Pneumatics PV=nRT',
        inputs:[
          { key:'Pg', label:'Gauge pressure', unit:'psi', default:100 },
          { key:'Patm', label:'Atmospheric',  unit:'psi', default:14.7 },
          { key:'V', label:'Volume V', unit:'in³', default:60 },
          { key:'T', label:'Temperature', unit:'°F', default:70 }
        ],
        outputs:[
          { key:'Pabs', label:'P_abs', unit:'psi', fmt:'fixed2' },
          { key:'Tabs', label:'T_abs', unit:'°R', fmt:'fixed2' },
          { key:'Vatm', label:'V at atm (PV/Patm)', unit:'in³', fmt:'fixed1' }
        ],
        compute(s){
          const Pabs=num(s.Pg)+num(s.Patm), Tabs=num(s.T)+459.67;
          const Vatm = num(s.V) * Pabs/num(s.Patm);
          return {outputs:{Pabs,Tabs,Vatm}, math:{symbolic:['P_abs=P_g+P_atm','T_abs=°F+459.67','PV=const ⇒ V_atm=V·P/P_atm']}};
        }
      }
    ]
  };

  // ============================================================
  // M150 — Springs (compression/tension/torsion + Goodman)
  // ============================================================
  const m150 = {
    id: 'm150',
    title: 'M150 Springs',
    heading: 'Helical Springs',
    subtitle: 'Compression Wahl, tension hook, torsion springs, fatigue',
    covers: ['Geometry & spring rate','Compression stress (Wahl)','Tension hook stress','Torsion springs','Energy storage','Goodman fatigue'],
    sections: [
      {
        id: 'geom',
        title: '§1 Geometry & rate',
        inputs:[
          { key:'d', label:'Wire d', unit:'in', default:0.075 },
          { key:'D', label:'Mean coil D', unit:'in', default:0.65 },
          { key:'G', label:'Shear modulus G', unit:'Mpsi', default:11.5 },
          { key:'Na', label:'Active coils N_a', unit:'', default:8 },
          { key:'ends', label:'End condition', unit:'', default:'Squared & Ground', type:'select',
            options:['Plain','Plain & Ground','Squared (closed)','Squared & Ground'] }
        ],
        outputs:[
          { key:'C', label:'Spring index C = D/d', unit:'', fmt:'fixed2' },
          { key:'Kw',label:'Wahl K_w', unit:'', fmt:'fixed4' },
          { key:'k', label:'k = G·d⁴/(8·D³·Na)', unit:'lb/in', fmt:'fixed3' },
          { key:'Nt',label:'Total coils N_t', unit:'', fmt:'fixed2' },
          { key:'Ls',label:'Solid length L_s', unit:'in', fmt:'fixed3' }
        ],
        compute(s){
          const d=num(s.d),D=num(s.D),G=num(s.G)*1e6,Na=num(s.Na);
          const C=D/d, Kw=(4*C-1)/(4*C-4)+0.615/C, k=G*Math.pow(d,4)/(8*Math.pow(D,3)*Na);
          let Nt,Ls;
          switch(s.ends){
            case 'Plain':            Nt=Na;   Ls=d*(Nt+1); break;
            case 'Plain & Ground':   Nt=Na+1; Ls=d*Nt;     break;
            case 'Squared (closed)': Nt=Na+2; Ls=d*(Nt+1); break;
            case 'Squared & Ground': Nt=Na+2; Ls=d*Nt;     break;
            default:                 Nt=Na+2; Ls=d*Nt;
          }
          return {outputs:{C,Kw,k,Nt,Ls}, math:{symbolic:['C=D/d','K_w=(4C−1)/(4C−4)+0.615/C','k=G·d⁴/(8·D³·N_a)']}};
        }
      },
      {
        id: 'compstress',
        title: '§2 Compression stress at load',
        inputs:[
          { key:'F', label:'Load F', unit:'lb', default:25 },
          { key:'D', label:'D', unit:'in', default:0.65 },
          { key:'d', label:'d', unit:'in', default:0.075 },
          { key:'k', label:'k (lb/in)', unit:'', default:18 },
          { key:'Kw',label:'K_w', unit:'', default:1.21 },
          { key:'Sus', label:'S_us (shear ult)', unit:'ksi', default:115 }
        ],
        outputs:[
          { key:'tau', label:'τ = K_w·8FD/(πd³)', unit:'ksi', fmt:'fixed3' },
          { key:'delta', label:'δ = F/k', unit:'in', fmt:'fixed4' },
          { key:'fos', label:'n_static = 0.6·S_us/τ', unit:'', fmt:'fixed2' }
        ],
        verdict:'fos',
        compute(s, settings){
          const F=num(s.F),D=num(s.D),d=num(s.d),k=num(s.k),Kw=num(s.Kw),Sus=num(s.Sus);
          const tau = Kw*8*F*D/(PI*Math.pow(d,3))/1000;
          const delta = k>0 ? F/k : null;
          const fos = tau>0 ? 0.6*Sus/tau : null;
          return {outputs:{tau,delta,fos}, math:{symbolic:['τ = K_w·8FD/(πd³)','δ = F/k','n = 0.6·S_us/τ']}, verdict: FoSverdict(fos,settings)};
        }
      },
      {
        id: 'hook',
        title: '§3 Tension spring hook',
        inputs:[
          { key:'F', label:'Load F', unit:'lb', default:30 },
          { key:'d', label:'Wire d', unit:'in', default:0.08 },
          { key:'D', label:'Mean D', unit:'in', default:0.6 },
          { key:'r1', label:'Hook radius r₁', unit:'in', default:0.4 },
          { key:'r2', label:'Bend radius r₂', unit:'in', default:0.10 }
        ],
        outputs:[
          { key:'C1', label:'C₁ = 2r₁/d', unit:'', fmt:'fixed3' },
          { key:'C2', label:'C₂ = 2r₂/d', unit:'', fmt:'fixed3' },
          { key:'K1', label:'K₁ = (4C₁²−4C₁+1)/(4C₁(C₁−1))', unit:'', fmt:'fixed4' },
          { key:'K2', label:'K₂ = (4C₂−1)/(4C₂−4)', unit:'', fmt:'fixed4' },
          { key:'sig_hook', label:'σ_hook = K₁·16FD/(πd³)+4F/(πd²)', unit:'ksi', fmt:'fixed3' }
        ],
        compute(s){
          const F=num(s.F),d=num(s.d),D=num(s.D),r1=num(s.r1),r2=num(s.r2);
          const C1=2*r1/d, C2=2*r2/d;
          const K1=(4*C1*C1-4*C1+1)/(4*C1*(C1-1));
          const K2=(4*C2-1)/(4*C2-4);
          const sig = (K1*16*F*D/(PI*Math.pow(d,3)) + 4*F/(PI*d*d))/1000;
          return {outputs:{C1,C2,K1,K2,sig_hook:sig}, math:{symbolic:['σ_hook = K₁·16FD/(πd³) + 4F/(πd²)']}};
        }
      },
      {
        id: 'torsion',
        title: '§4 Torsion spring',
        inputs:[
          { key:'M', label:'Moment M', unit:'lb·in', default:8 },
          { key:'d', label:'Wire d', unit:'in', default:0.062 },
          { key:'D', label:'Mean D', unit:'in', default:0.5 },
          { key:'Na',label:'Active coils', unit:'', default:8 },
          { key:'E', label:'E', unit:'Mpsi', default:30 }
        ],
        outputs:[
          { key:'C', label:'C = D/d', unit:'', fmt:'fixed2' },
          { key:'Ko',label:'K_o = (4C²−4C+1)/(4C(C−1))', unit:'', fmt:'fixed4' },
          { key:'sig', label:'σ = K_o·32M/(πd³)', unit:'ksi', fmt:'fixed3' },
          { key:'kt',  label:'k_t = E·d⁴/(10.8·D·Na)', unit:'lb·in/turn', fmt:'fixed3' }
        ],
        compute(s){
          const M=num(s.M),d=num(s.d),D=num(s.D),Na=num(s.Na),E=num(s.E)*1e6;
          const C=D/d, Ko=(4*C*C-4*C+1)/(4*C*(C-1));
          const sig = Ko*32*M/(PI*Math.pow(d,3))/1000;
          const kt = E*Math.pow(d,4)/(10.8*D*Na);
          return {outputs:{C,Ko,sig,kt}, math:{symbolic:['σ = K_o·32M/(πd³)','k_t = E·d⁴/(10.8·D·N_a)']}};
        }
      },
      {
        id: 'energy',
        title: '§5 Energy storage',
        inputs:[
          { key:'k', label:'Spring rate k', unit:'lb/in', default:18 },
          { key:'delta', label:'Deflection δ', unit:'in', default:1.5 },
          { key:'W', label:'Mass weight W', unit:'lb', default:0.2 }
        ],
        outputs:[
          { key:'F', label:'F = k·δ', unit:'lb', fmt:'fixed2' },
          { key:'U', label:'U = ½·k·δ²', unit:'lb·in', fmt:'fixed3' },
          { key:'v', label:'v = √(2U/m), m=W/g', unit:'in/s', fmt:'fixed2' }
        ],
        compute(s){
          const k=num(s.k),delta=num(s.delta),W=num(s.W);
          const F=k*delta, U=0.5*k*delta*delta;
          const m=W/386.4, v = m>0 ? Math.sqrt(2*U/m) : null;
          return {outputs:{F,U,v}, math:{symbolic:['U=½kδ²','v=√(2U/m), g=386.4 in/s²']}};
        }
      },
      {
        id: 'goodman',
        title: '§6 Goodman fatigue',
        inputs:[
          { key:'Fmax', label:'F_max', unit:'lb', default:40 },
          { key:'Fmin', label:'F_min', unit:'lb', default:10 },
          { key:'D', label:'D', unit:'in', default:0.65 },
          { key:'d', label:'d', unit:'in', default:0.075 },
          { key:'Kw', label:'K_w', unit:'', default:1.21 },
          { key:'Se', label:'S_e shear (eff)', unit:'ksi', default:35 },
          { key:'Sus', label:'S_us', unit:'ksi', default:115 }
        ],
        outputs:[
          { key:'taua', label:'τ_a', unit:'ksi', fmt:'fixed3' },
          { key:'taum', label:'τ_m', unit:'ksi', fmt:'fixed3' },
          { key:'fos',  label:'n_e (Goodman)', unit:'', fmt:'fixed2' }
        ],
        verdict:'fos',
        compute(s, settings){
          const a=num(s.Fmax),b=num(s.Fmin),D=num(s.D),d=num(s.d),Kw=num(s.Kw),Se=num(s.Se),Sus=num(s.Sus);
          const Fa=(a-b)/2, Fm=(a+b)/2;
          const taua = Kw*8*Fa*D/(PI*Math.pow(d,3))/1000;
          const taum = Kw*8*Fm*D/(PI*Math.pow(d,3))/1000;
          const fos = (taua/Se + taum/Sus)>0 ? 1/(taua/Se + taum/Sus) : null;
          return {outputs:{taua,taum,fos}, math:{symbolic:['1/n_e = τ_a/S_e + τ_m/S_us']}, verdict:FoSverdict(fos,settings)};
        }
      }
    ]
  };

  // ============================================================
  // Public registry
  // ============================================================
  window.MODULES = { m30, m40, m50, m60, m70, m90, m110, m130, m150 };
  window.MODULES_ARRAY = [m30, m40, m50, m60, m70, m90, m110, m130, m150];
})();
