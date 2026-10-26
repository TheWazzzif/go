/*
 * go.themintclinics.com
 *
 * GitHub Pages serves 404.html (a copy of index.html) for every path, so this
 * one script handles every link the clinic sends:
 *   /reception        the dashboard
 *   /CODE (8 chars)   an invoice, redirected to its Drive file
 *   /CODE (10 chars)  a consent form, drawn here
 *   /CODE (14 chars)  a signed copy, drawn here
 * The form and the signed copy match consent-app/Form.html and View.html;
 * change both together. The consent app (Apps Script) holds the data and
 * makes every decision: validity, expiry, single use and input checks.
 */
(function () {
  var EXEC = 'https://script.google.com/macros/s/AKfycbzMyd9A0Gm9EroJuxMIfS8XxinVmAJZZ38x8BSxksS50_IG4LG9FZNoqwDAvhg7-CXszw/exec';
  // A bookmarkable pointer to the dashboard. It carries no data; sign-in,
  // Sheet access and the PIN still apply there.
  var DASHBOARD = 'https://script.google.com/macros/s/AKfycbz_q2lC4ACH3hs6R1840x-pissDNG6TSwTXmafLnCnWoK8OfqZ3RI9PFSVMFwbzBrDJRQ/exec';
  var TAGLINE = 'Minting smiles, brightening lives';
  var app = document.getElementById('app');

  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function brand(tag) {
    return '<div class="brand"><div class="logo"></div><div><div class="bname">Mint Clinics</div><div class="btag">' + esc(tag) + '</div></div></div>';
  }
  function page(inner, tag) {
    app.innerHTML = '<div class="wrap">' + brand(tag || TAGLINE) + inner + '</div>';
  }
  function message(title, text, tick) {
    page('<div class="msg">' + (tick ? '<div class="tick">&#10003;</div>' : '') + '<h1>' + esc(title) + '</h1><p>' + esc(text) + '</p></div>');
  }
  function hasAge(snap) { return snap.age !== '' && snap.age !== null && snap.age !== undefined; }
  function procRows(snap) {
    return (snap.procedures || []).map(function (p) {
      return '<div class="proc"><span>' + esc(p.name) + '</span><span class="t">' + (p.tooth ? 'Tooth ' + esc(p.tooth) : '') + '</span></div>';
    }).join('');
  }

  var parts = location.pathname.split('/').filter(Boolean);
  var code = parts.length ? decodeURIComponent(parts[parts.length - 1]).toLowerCase() : '';

  if (code === 'reception') {
    page('<div class="msg"><p>Opening the dashboard...</p><div class="spin"></div></div>');
    location.replace(DASHBOARD);
    return;
  }
  if (!code) {
    page('<div class="msg"><h1>Mint Clinics</h1><p>' + esc(TAGLINE) + '.</p></div>');
    return;
  }
  if (!/^[a-z0-9]{6,20}$/.test(code)) {
    message('Link not found', 'This link is not valid. Please ask the clinic to send it again.');
    return;
  }

  page('<div class="msg"><p>Opening your document...</p><div class="spin"></div></div>');
  fetch(EXEC + '?open=' + encodeURIComponent(code))
    .then(function (r) { return r.json(); })
    .then(show)
    // If this page cannot reach the service, the consent app's own page
    // shows the same thing.
    .catch(function () { location.replace(EXEC + '?k=' + encodeURIComponent(code)); });

  function show(d) {
    if (!d || !d.kind) throw new Error('bad response');
    if (d.kind === 'link') return openLink(d.url);
    if (d.kind === 'form') return renderForm(d.code, d.type, d.snap || {});
    if (d.kind === 'view') return renderView(d.type, d.snap || {}, d.rec || {});
    if (d.state === 'signed') return message('Already signed', 'Thank you, this form was signed on ' + (d.signedAt || '') + '. You can close this page.', true);
    if (d.state === 'expired') return message('This link has expired', 'For your privacy, consent links work for 24 hours. Please ask the clinic for a new one.');
    if (d.state === 'nocopy') return message('Not found', 'This copy is not available.');
    return message('Link not found', 'This link is not valid. Please ask the clinic to send it again.');
  }

  function openLink(url) {
    if (!/^https:\/\/(drive|docs)\.google\.com\//.test(String(url || ''))) return message('Link not found', 'This link is not valid. Please ask the clinic to send it again.');
    page('<div class="msg"><h1>Opening your document</h1><p>If nothing happens, tap the button below.</p>' +
      '<a class="btn" href="' + esc(url) + '">Open</a></div>');
    location.replace(url);
  }

  /* ---------- consent form (same as consent-app/Form.html) ---------- */
  function renderForm(formCode, type, snap) {
    document.title = 'Mint Clinics consent';
    var t = type === 'treatment';
    var h = '<div class="wrap" id="formWrap">' + brand(TAGLINE);
    h += t
      ? '<h1>Consent for treatment</h1><p class="lead">Before we begin, please take a moment to read this. It simply confirms that your treatment has been explained to you and that you are comfortable going ahead.</p>'
      : '<h1>Photos and records</h1><p class="lead">To plan and track your care, we may take clinical photographs, X-rays and scans. This form asks how we may use them. You only need to fill it in once.</p>';

    h += '<div class="card"><div class="kv">' +
      '<span>Patient</span><span><b>' + esc(snap.patientName) + '</b></span>' +
      (hasAge(snap) ? '<span>Age</span><span>' + esc(snap.age) + ' yrs</span>' : '') +
      '<span>Date</span><span>' + esc(snap.date) + '</span>' +
      (t && snap.doctors && snap.doctors.length ? '<span>Doctor</span><span>' + esc(snap.doctors.join(', ')) + '</span>' : '') +
      '</div></div>';

    if (t) {
      h += '<div class="card"><h2>Your treatment</h2>' +
        (snap.procedures && snap.procedures.length ? procRows(snap) : '<div class="small">The treatment your doctor has discussed with you.</div>') +
        '</div>';
      h += '<div class="card"><h2>What we have discussed with you</h2><ul>' +
        '<li>What the treatment involves and why it is recommended for you.</li>' +
        '<li>Other options, including choosing not to have treatment.</li>' +
        '<li>What to expect afterwards. Like any dental or medical care, there may be some temporary discomfort, swelling or sensitivity, and occasionally a follow-up visit or small adjustment is needed.</li>' +
        '<li>Results vary from person to person and depend on aftercare and regular check-ups.</li>' +
        '<li>You can ask questions at any time, and you are free to pause or stop treatment whenever you wish.</li>' +
        '</ul></div>';
      h += '<div class="card"><h2>Your health</h2>';
      if (snap.allergies || (snap.conditions && snap.conditions.length)) {
        h += '<div class="health"><div><b>On file with us:</b></div>' +
          (snap.allergies ? '<div>Allergies / notes: ' + esc(snap.allergies) + '</div>' : '') +
          (snap.conditions && snap.conditions.length ? '<div>' + esc(snap.conditions.join(', ')) + '</div>' : '') +
          '</div>';
      } else {
        h += '<div class="small" style="margin-bottom:10px">We have no allergies or medical conditions on file for you.</div>';
      }
      h += '<label class="opt" id="medOk"><input type="radio" name="med" value="accurate"><span>This is still accurate.</span></label>' +
        '<label class="opt" id="medChanged"><input type="radio" name="med" value="changed"><span>Something has changed (for example a new medicine, an allergy, pregnancy or a recent illness).</span></label>' +
        '<div id="changesWrap" style="display:none"><label class="f" for="changes">What has changed?</label><textarea id="changes" maxlength="1000"></textarea></div>' +
        '</div>';
    } else {
      h += '<div class="card"><h2>Your choices</h2><div class="small" style="margin-bottom:4px">Your smile is yours. We always keep your name and personal details private, and you can say no to either of these without any effect on your care.</div>' +
        '<label class="opt"><input type="checkbox" id="share"><span>Yes, my photos can help teach other dentists, and Mint Clinics can proudly show my results on its website and social media. <span class="small">Optional</span></span></label>' +
        '</div>';
    }

    if (snap.isMinor) {
      h += '<div class="card"><h2>Parent or guardian</h2>' +
        '<div class="small">As ' + esc(snap.patientName) + ' is under 18, a parent or guardian signs on their behalf.</div>' +
        '<label class="f" for="gName">Your full name</label><input type="text" id="gName" maxlength="80" autocomplete="name">' +
        '<label class="f" for="gRel">Relationship to the patient</label><input type="text" id="gRel" maxlength="40" placeholder="e.g. Mother">' +
        '</div>';
    }

    h += '<div class="card"><label class="opt" id="agreeOpt"><input type="checkbox" id="agree"><span>' +
      (t ? 'I have read and understood this form, my questions have been answered, and I agree to go ahead with the treatment.'
         : 'I agree to clinical photographs, X-rays and scans being taken and kept privately in my patient record.') +
      '</span></label>' +
      '<label class="f" for="signerName">Type your full name</label><input type="text" id="signerName" maxlength="80" autocomplete="name">' +
      '<label class="f">Sign with your finger</label>' +
      '<div class="sigbox" id="sigbox"><canvas id="sig"></canvas><div class="sigline"></div><div class="sighint" id="sighint">Sign here</div></div>' +
      '<div class="row"><span class="small">Your signature is stored securely with your patient record.</span><button class="link" id="clearSig" type="button">Clear</button></div>' +
      '<div class="err" id="err"></div>' +
      '<button class="btn" id="submitBtn" type="button">Sign and submit</button></div>' +
      '<p class="small" style="text-align:center">Mint Clinics, Sector 45, Noida &middot; Questions? Just ask at the front desk.</p></div>';

    h += '<div class="wrap" id="doneWrap" style="display:none">' + brand(TAGLINE) +
      '<div class="msg"><div class="tick">&#10003;</div><h1>Thank you</h1><p>Your form has been signed and sent to the clinic. You can close this page.</p></div></div>';

    app.innerHTML = h;
    wireForm(formCode, type, !!snap.isMinor);
  }

  function wireForm(CODE, TYPE, MINOR) {
    // Highlight the chosen option cards.
    document.querySelectorAll('.opt input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        document.querySelectorAll('.opt').forEach(function (o) { o.classList.toggle('on', o.querySelector('input').checked); });
        if (inp.name === 'med') document.getElementById('changesWrap').style.display = inp.value === 'changed' && inp.checked ? 'block' : 'none';
      });
    });

    // Signature pad
    var canvas = document.getElementById('sig');
    var ctx = canvas.getContext('2d');
    var drawing = false, inked = false, last = null;
    function size() {
      var r = canvas.getBoundingClientRect();
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * ratio);
      canvas.height = Math.round(r.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.4; ctx.strokeStyle = '#1B2433';
    }
    size();
    window.addEventListener('resize', function () { if (!inked) size(); });
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    canvas.addEventListener('pointerdown', function (e) { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p;
      if (!inked) { inked = true; document.getElementById('sighint').style.display = 'none'; }
      e.preventDefault();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { canvas.addEventListener(ev, function () { drawing = false; }); });
    document.getElementById('clearSig').addEventListener('click', function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height); inked = false; document.getElementById('sighint').style.display = 'flex';
    });

    // Smallest image that still looks right: it must fit in one Sheets cell
    // (the server rejects anything over ~48k characters).
    function signatureData() {
      var widths = [480, 400, 320];
      for (var i = 0; i < widths.length; i++) {
        var png = scaled(widths[i], false).toDataURL('image/png');
        if (png.length <= 45000) return png;
      }
      var q = [0.75, 0.6, 0.45];
      for (var j = 0; j < q.length; j++) {
        var jpg = scaled(400, true).toDataURL('image/jpeg', q[j]);
        if (jpg.length <= 45000) return jpg;
      }
      return scaled(280, true).toDataURL('image/jpeg', 0.4);
    }
    function scaled(w, whiteBg) {
      var out = document.createElement('canvas');
      out.width = w;
      out.height = Math.round(w * canvas.height / canvas.width);
      var g = out.getContext('2d');
      if (whiteBg) { g.fillStyle = '#fff'; g.fillRect(0, 0, out.width, out.height); }
      g.drawImage(canvas, 0, 0, out.width, out.height);
      return out;
    }

    function fail(msg) {
      var el = document.getElementById('err');
      el.textContent = msg; el.style.display = 'block';
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    document.getElementById('submitBtn').addEventListener('click', function () {
      var btn = this;
      document.getElementById('err').style.display = 'none';
      var form = {
        agree: document.getElementById('agree').checked,
        signerName: document.getElementById('signerName').value.trim(),
        userAgent: navigator.userAgent
      };
      if (TYPE === 'treatment') {
        var med = document.querySelector('input[name=med]:checked');
        if (!med) return fail('Please confirm whether your health details are still accurate.');
        form.medicalStatus = med.value;
        form.medicalChanges = document.getElementById('changes').value.trim();
        if (med.value === 'changed' && !form.medicalChanges) return fail('Please tell us what has changed with your health.');
      } else {
        form.teaching = form.marketing = document.getElementById('share').checked;
      }
      if (MINOR) {
        form.guardianName = document.getElementById('gName').value.trim();
        form.guardianRelation = document.getElementById('gRel').value.trim();
        if (!form.guardianName || !form.guardianRelation) return fail('Please fill in the parent or guardian details.');
      }
      if (!form.agree) return fail('Please tick the box to confirm you agree.');
      if (form.signerName.length < 2) return fail('Please type your full name.');
      if (!inked) return fail('Please sign in the box with your finger.');
      form.signature = signatureData();
      btn.disabled = true; btn.textContent = 'Submitting...';
      // text/plain keeps this a simple request (no CORS preflight).
      fetch(EXEC, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'submit', code: CODE, form: form }) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Something went wrong. Please try again.');
          document.getElementById('formWrap').style.display = 'none';
          document.getElementById('doneWrap').style.display = 'block';
          window.scrollTo(0, 0);
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = 'Sign and submit';
          var msg = e && e.message ? e.message : String(e);
          if (e instanceof TypeError) msg = 'Could not reach the clinic. Please check your internet connection and try again.';
          fail(msg.replace(/^(Error|Exception):\s*/, ''));
        });
    });
  }

  /* ---------- signed copy (same as consent-app/View.html) ---------- */
  function renderView(type, snap, rec) {
    document.title = 'Signed consent - Mint Clinics';
    var t = type === 'treatment';
    var h = '<div class="wrap">' + brand('Signed consent') +
      '<h1>' + (t ? 'Consent for treatment' : 'Photos and records') + '</h1>' +
      '<p class="lead">Signed on ' + esc(rec.signedAt) + '</p>';

    h += '<div class="card"><div class="kv">' +
      '<span>Patient</span><span><b>' + esc(snap.patientName) + '</b></span>' +
      '<span>Patient ID</span><span>' + esc(snap.patientId) + '</span>' +
      (hasAge(snap) ? '<span>Age</span><span>' + esc(snap.age) + ' yrs</span>' : '') +
      (t && snap.doctors && snap.doctors.length ? '<span>Doctor</span><span>' + esc(snap.doctors.join(', ')) + '</span>' : '') +
      '</div></div>';

    if (t) {
      h += '<div class="card"><h2>Treatment</h2>' + procRows(snap) +
        (!snap.procedures || !snap.procedures.length ? '<div class="small">No treatments were listed on the case when this was signed.</div>' : '') +
        '</div>';
      h += '<div class="card"><h2>Health details</h2>' +
        '<div>' + (rec.medicalStatus === 'changed' ? 'Patient reported a change:' : 'Patient confirmed the details on file are accurate.') + '</div>' +
        (rec.medicalChanges ? '<div class="health" style="margin-top:8px">' + esc(rec.medicalChanges) + '</div>' : '') +
        '</div>';
      h += '<div class="card"><h2>Agreed</h2><div>I have read and understood this form, my questions have been answered, and I agree to go ahead with the treatment.</div></div>';
    } else {
      h += '<div class="card"><h2>Agreed</h2><div>Clinical photographs, X-rays and scans may be taken and kept privately in the patient record.</div>' +
        '<div style="margin-top:10px">Photos may be used for teaching and shown on the website / social media: <b>' +
        (rec.records && (rec.records.teaching || rec.records.marketing) ? 'Yes' : 'No') + '</b></div></div>';
    }

    var sig = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(String(rec.signature || '')) ? rec.signature : '';
    h += '<div class="card"><h2>Signature</h2>' +
      (sig ? '<img class="sigimg" src="' + sig + '" alt="Signature">' : '') +
      '<div><b>' + esc(rec.signerName) + '</b></div>' +
      (rec.guardianName ? '<div class="small">Signed by ' + esc(rec.guardianName) + ' (' + esc(rec.guardianRelation) + ') on behalf of the patient</div>' : '') +
      '<div class="small">Form version ' + esc(rec.version) + ' &middot; Reference ' + esc(rec.code) + '</div></div>' +
      '<button class="btn noprint" id="printBtn">Print or save as PDF</button></div>';

    app.innerHTML = h;
    document.getElementById('printBtn').addEventListener('click', function () { window.print(); });
  }
})();
