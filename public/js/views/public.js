/* ============================================================
   Zentra — public marketing site (light corporate banking look)
   ============================================================ */
window.ZB = window.ZB || {};
ZB.views = ZB.views || {};
ZB.forms = ZB.forms || {};

(function (ZB) {
  'use strict';
  var U = function () { return ZB.ui; };

  /* ==================================================== shared chrome */
  function brandHtml() {
    return '<a class="brand" href="#/">' +
      '<span class="logo-mark"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6h11l-7.5 5h7.5L8 18"/></svg></span>' +
      'Zentra<span class="spark">&#9679;</span></a>';
  }

  function navLinks(active) {
    var links = [
      ['#/personal', 'Personal'],
      ['#/business', 'Business'],
      ['#/rates', 'Rates & Fees'],
      ['#/security', 'Security'],
      ['#/support', 'Support']
    ];
    return links.map(function (l) {
      return '<a href="' + l[0] + '" class="' + (active === l[0] ? 'on' : '') + '">' + l[1] + '</a>';
    }).join('');
  }

  function pubShell(active, contentHtml) {
    var signedIn = !!(ZB.state.user);
    var dashHref = ZB.homeFor ? ZB.homeFor(ZB.state.user) : '#/app';
    return '<div class="pub">' +
      '<header class="pub-header">' +
      '<div class="utility-bar"><div class="uwrap">' +
      '<span class="hide-sm">Member FDIC &#183; Equal Housing Lender &#183; Routing #021000021</span>' +
      '<span><a href="#/about" class="hide-sm">About us</a><span class="sep hide-sm"> | </span>' +
      '<a href="#/legal">Disclosures</a><span class="sep"> | </span>' +
      '<a href="#/support">Contact</a>' +
      (signedIn ? '<span class="sep"> | </span><a href="' + dashHref + '">My accounts</a>' : '') +
      '</span></div></div>' +

      '<div class="pub-nav-wrap"><nav class="pub-nav">' +
      brandHtml() +
      '<div class="pub-links">' + navLinks(active) + '</div>' +
      '<div class="pub-actions">' +
      (signedIn
        ? '<a class="btn outline sm" href="' + dashHref + '">' + U().icon('grid', 14) + ' My dashboard</a>'
        : '<a class="btn outline sm" href="#/login">' + U().icon('user', 14) + ' Sign in</a>') +
      '<a class="btn sm" href="' + (signedIn ? dashHref : '#/register') + '">' +
      (signedIn ? 'Go to banking' : 'Open an account') + '</a>' +
      '<button class="icon-btn burger" id="burger-btn" aria-label="Menu">' + U().icon('menu', 18) + '</button>' +
      '</div></nav></div>' +

      '<div class="mobile-menu" id="mobile-menu">' + navLinks(active) +
      (signedIn ? '' : '<a href="#/login">Sign in</a><a href="#/register"><b>Open an account</b></a>') +
      '</div>' +
      '</header>' +

      contentHtml +

      megaFooter() +
      '</div>';
  }

  function megaFooter() {
    var yr = new Date().getFullYear();
    return '<footer class="mega-footer">' +
      '<div class="mf-main">' +
      '<div class="mf-brand"><div class="brand">' +
      '<span class="logo-mark"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6h11l-7.5 5h7.5L8 18"/></svg></span>' +
      'Zentra<span class="spark">&#9679;</span></div>' +
      '<p>Zentra Bank, N.A. is a full-service digital bank offering no-fee checking, high-yield savings, debit cards and personal loans to customers across all 50 states.</p>' +
      '</div>' +
      '<div class="mf-col"><h4>Products</h4>' +
      '<a href="#/personal">Everyday Checking</a><a href="#/personal">Growth Savings</a>' +
      '<a href="#/personal">Debit cards</a><a href="#/personal">Personal loans</a>' +
      '<a href="#/business">Business banking</a><a href="#/rates">Rates &amp; fees</a></div>' +
      '<div class="mf-col"><h4>Company</h4>' +
      '<a href="#/about">About us</a><a href="#/security">Security center</a>' +
      '<a href="#/support">Help center</a><a href="#/support">Contact us</a>' +
      '<a href="#/legal">Careers</a></div>' +
      '<div class="mf-col"><h4>Legal</h4>' +
      '<a href="#/legal">Disclosures</a><a href="#/legal">Privacy notice</a>' +
      '<a href="#/legal">Terms of service</a><a href="#/legal">Accessibility</a>' +
      '<a href="#/legal">Customer resolution</a></div>' +
      '</div>' +
      '<div class="mf-legal"><div class="mf-legal-inner">' +
      '<div class="mf-fdic">' + U().icon('shield', 16) +
      '<span>Deposits held at Zentra Bank are FDIC-insured up to $250,000 per depositor, per ownership category.</span></div>' +
      '<p class="disclosure">Zentra Bank, N.A. Member FDIC. Equal Housing Lender. Deposit products offered by Zentra Bank, N.A., ' +
      'Member FDIC. Credit products are subject to credit approval and program guidelines. Advertised rates are accurate as of ' +
      'today and may change at any time. Savings interest is calculated daily and credited to your account each day the bank is ' +
      'open. External transfer delivery times vary by receiving institution, typically 1&ndash;3 business days.</p>' +
      '<div class="mf-bottom"><span>&copy; ' + yr + ' Zentra Bank, N.A. All rights reserved.</span>' +
      '<span><a href="#/legal">Privacy</a><a href="#/legal">Terms</a><a href="#/legal">Site map</a></span></div>' +
      '</div></div></footer>';
  }

  function bindPubChrome() {
    var b = document.getElementById('burger-btn');
    if (b) {
      b.addEventListener('click', function () {
        document.getElementById('mobile-menu').classList.toggle('open');
      });
    }
  }

  /* cached bootstrap for public pages */
  var _bootPromise = null;
  async function fetchBoot() {
    if (!_bootPromise) {
      _bootPromise = ZB.api.get('/api/public/bootstrap').catch(function (e) {
        _bootPromise = null;
        throw e;
      });
    }
    return _bootPromise;
  }

  function faqBlock(items) {
    return items.map(function (f, i) {
      return '<div class="faq-item" data-faq="' + i + '">' +
        '<button class="faq-q" type="button">' + f[0] + U().icon('chevronDown', 16) + '</button>' +
        '<div class="faq-a"><p>' + f[1] + '</p></div></div>';
    }).join('');
  }
  function bindFaq(rootSel) {
    document.querySelectorAll((rootSel || '') + ' .faq-q').forEach(function (q) {
      q.addEventListener('click', function () {
        q.closest('.faq-item').classList.toggle('open');
      });
    });
  }

  /* ============================================================ HOME */
  async function home() {
    var r = await fetchBoot().catch(function () { return null; });
    var apy = r ? r.fees.savings_apy : 4.25;
    var apr = r ? r.fees.loan_apr : 9.9;

    var hero =
      '<section class="hero"><div class="hero-inner">' +
      '<div class="reveal">' +
      '<span class="hero-kicker"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22c5.5-2 8-6.5 8-12V5l-8-3-8 3v5c0 5.5 2.5 10 8 12z"/></svg> Zentra Bank &#183; Member FDIC</span>' +
      '<h1>Banking that works<br>the way <em>you</em> do.</h1>' +
      '<p class="lead">No-fee checking that pays your bills, savings that earn ' + apy +
      '% APY from day one, and cards you control from your phone. Open an account in about 3 minutes.</p>' +
      '<div class="hero-ctas">' +
      '<a class="btn lg" href="#/register">' + U().icon('arrowRight', 16) + ' Open an account</a>' +
      '<a class="btn secondary lg" href="#/personal">Explore accounts</a></div>' +
      '<div class="hero-points">' +
      '<span>' + U().icon('check', 15) + ' $0 monthly fees &amp; no minimum balance — ever</span>' +
      '<span>' + U().icon('check', 15) + ' Interest accrues daily and is credited every day</span>' +
      '<span>' + U().icon('check', 15) + ' Deposits FDIC-insured up to $250,000</span>' +
      '</div></div>' +

      '<div class="bank-card-scene reveal" id="card-scene">' +
      '<div class="scene-card-back"></div>' +
      '<div class="realistic-card" id="hero-card">' +
      '<div class="rc-top"><div class="rc-brand">Zentra<small>Debit &#183; World</small></div>' +
      '<svg class="rc-contactless" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2" stroke-linecap="round"><path d="M8.5 8.5a7 7 0 0 1 0 7M12 6a10.5 10.5 0 0 1 0 12M15.5 3.8a14 14 0 0 1 0 16.4"/></svg></div>' +
      '<div class="rc-chip"></div>' +
      '<div class="rc-num">4020 &nbsp;•••• &nbsp;•••• &nbsp;4977</div>' +
      '<div class="rc-foot">' +
      '<div><div class="rc-label">Card holder</div><div class="rc-val">J. MILES</div></div>' +
      '<div><div class="rc-label">Expires</div><div class="rc-val">09/29</div></div>' +
      '<div class="rc-brandmark">' +U().cardBrand('visa', 22) + '</div></div>' +
      '</div>' +
      '<div class="scene-balance"><span class="tiny muted" style="display:block">Total balance</span>' +
      '<b>$13,004.26</b><span class="tiny up" style="display:block;margin-top:2px">&#9650; +$485 this week</span></div>' +
      '</div></section>';

    var trio =
      '<div class="trio-band"><div class="trio">' +
      '<a href="#/personal"><span>Checking &amp; Savings<small>No monthly fees, daily interest</small></span>' + U().icon('chevronRight', 17) + '</a>' +
      '<a href="#/business"><span>Business banking<small>Invoices, payroll &amp; FX wallets</small></span>' + U().icon('chevronRight', 17) + '</a>' +
      '<a href="#/rates"><span>Rates &amp; fees<small>Everything in plain English</small></span>' + U().icon('chevronRight', 17) + '</a>' +
      '</div></div>';

    // slim FX ticker
    var pairs = '';
    if (r && r.fx) {
      var f = r.fx;
      ['EUR', 'GBP'].forEach(function (cur) {
        pairs += '<span class="fx-pair"><b>USD / ' + cur + '</b>' + Number(f[cur]).toFixed(4) +
          '<span class="' + (cur === 'EUR' ? 'up-arrow">&#9650;' : 'down-arrow">&#9660;') + '</span></span>';
        pairs += '<span class="fx-pair"><b>' + cur + ' / USD</b>' + (1 / f[cur]).toFixed(4) + '</span>';
      });
    }
    var ticker = pairs ?
      '<div class="fx-ticker"><div class="fx-label">FX desk</div><div class="fx-track">' +
      '<div class="fx-move">' + pairs + pairs + '</div></div></div>' : '';

    var rateBand =
      '<div class="rate-band"><div class="rate-band-inner">' +
      '<div class="rate-cell"><div class="rv">' + apy + '%</div><div class="rl">Savings APY</div><div class="rn">Interest paid daily</div></div>' +
      '<div class="rate-cell"><div class="rv">$0</div><div class="rl">Monthly fee</div><div class="rn">Checking, forever</div></div>' +
      '<div class="rate-cell"><div class="rv">' + apr + '%</div><div class="rl">Loan APR</div><div class="rn">Decisions in minutes</div></div>' +
      '<div class="rate-cell"><div class="rv">$0</div><div class="rl">Min. opening deposit</div><div class="rn">Start with anything</div></div>' +
      '</div></div>';

    function feat(icon, title, text, statBig, statSmall) {
      return '<div class="feat-card reveal">' +
        '<div class="fc-icon">' + U().icon(icon, 20) + '</div>' +
        '<h3>' + title + '</h3><p>' + text + '</p>' +
        (statBig ? '<div class="mt-2 fc-stat"><b>' + statBig + '</b><span>' + statSmall + '</span></div>' : '') +
        '</div>';
    }

    var feats =
      '<section class="section tint"><div class="section-head reveal">' +
      '<span class="eyebrow">Why Zentra</span>' +
      '<h2>An account built around your money — not our fees</h2>' +
      '<p>We removed the stuff people hate about banks: surprise charges, slow transfers, and support queues.</p></div>' +
      '<div class="feat-grid cols-2">' +
      feat('wallet', 'No-fee everyday checking', 'Direct deposit hits instantly, bill pay is included, and your account number lives one tap away. No monthly maintenance, no minimum balance, no gotchas.', '$0', 'monthly maintenance fee') +
      feat('percent', 'High-yield savings', 'Your idle cash earns ' + apy + '% APY. Interest accrues every single day and lands in your balance daily — you can watch it grow.', apy + '%', 'APY, variable') +
      feat('swap', 'Transfers that actually move', 'Send to any Zentra customer instantly by email. External payouts to other banks arrive in 1–3 business days with clear status tracking.', 'Instant', 'Zentra-to-Zentra transfers') +
      feat('card', 'Cards you command', 'Freeze a lost card in one tap, set monthly spending limits, and issue extra virtual cards for subscriptions — free.', '1 tap', 'to freeze or unfreeze') +
      feat('target', 'Loans without the mystery', 'See your exact monthly payment before you apply. Verified customers get decisions fast and funds land immediately on approval.', apr + '%', 'APR, fixed terms 3–48 mo') +
      feat('message', 'Support from humans', 'Real people answer the inbox every day, usually within hours. No ticket mazes, no chatbot loops.', '&lt; 4 hrs', 'typical first reply') +
      '</div></section>';

    var steps =
      '<section class="section"><div class="section-head reveal">' +
      '<span class="eyebrow">Get started</span><h2>Open your account in three steps</h2></div>' +
      '<div class="steps reveal">' +
      '<div class="step"><h3>Tell us about you</h3><p>Name, email, and a strong password. Choose your default currency — USD, EUR or GBP.</p></div>' +
      '<div class="step"><h3>Your checking opens instantly</h3><p>A real account number is issued the moment you sign up. Fund it whenever you\'re ready.</p></div>' +
      '<div class="step"><h3>Bank from anywhere</h3><p>Add savings, order a card, send money, pay bills, and track everything from one clean dashboard.</p></div>' +
      '</div></section>';

    var names = [['Sarah K.', 'Freelance designer'], ['Marcus T.', 'Small-business owner'], ['Priya R.', 'Graduate student']];
    var quotesTxt = [
      '"I moved my emergency fund here for the APY and stayed for the app. Watching interest post every morning is weirdly motivating."',
      '"Payroll goes out through bill pay, invoices get paid into checking, and I haven\'t paid a single fee in fourteen months."',
      '"As a student I expected to be treated like an afterthought. Free checking, a real card, and support that answers — that\'s it, that\'s the review."'
    ];
    var quotes =
      '<section class="section tint"><div class="section-head reveal">' +
      '<span class="eyebrow">Customer stories</span><h2>People who switched, and stayed</h2></div>' +
      '<div class="quotes reveal">' +
      names.map(function (n, i) {
        var hue = [212, 152, 268][i];
        return '<div class="quote-card"><div class="quote-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>' +
          '<p>' + quotesTxt[i] + '</p>' +
          '<div class="quote-who"><div class="avatar" style="background:' + U().hueColor(hue) + '">' +
          U().esc(U().initials(n[0])) + '</div><div><b>' + n[0] + '</b><span>' + n[1] + '</span></div></div></div>';
      }).join('') +
      '</div></section>';

    var faqs = [
      ['What makes Zentra different from traditional banks?', 'Zentra was built digital-first, which means no branches to fund and no junk fees to hide. Checking is free, savings interest posts daily instead of monthly, transfers between customers settle instantly around the clock, and every control — freezing a card, setting limits, reviewing statements — lives one tap away in your dashboard.'],
      ['What does checking actually cost?', 'Nothing. There is no monthly maintenance fee, no minimum balance requirement, and no fee for standard transfers between Zenta accounts. The complete fee schedule lives on our Rates &amp; Fees page.'],
      ['How does daily interest work?', 'Savings balances earn the advertised APY divided across every day of the year. Each day, interest posts straight into your available balance — including weekends.'],
      ['How fast are transfers?', 'Transfers between Zentra customers arrive instantly, 24/7. Transfers to accounts at other banks typically arrive within 1–3 business days depending on the receiving institution; larger amounts include a brief compliance review for your protection.'],
      ['Can I get a card?', 'Yes — your first virtual debit card is free and works online immediately. A physical card ships in 5–7 business days for a one-time $5 issuance fee.']
    ];
    var faqSec =
      '<section class="section"><div class="section-head reveal">' +
      '<span class="eyebrow">Questions</span><h2>Straight answers</h2></div>' +
      '<div class="faq-list reveal">' + faqBlock(faqs) + '</div></section>';

    var cta =
      '<section class="cta-band"><div class="cta-inner reveal">' +
      '<h2>Ready to bank better?</h2>' +
      '<p>Join thousands of customers who ditched the fees. Your account number is waiting.</p>' +
      '<a class="btn secondary lg" href="#/register">Open your free account</a></div></section>';

    var html = pubShell('#/', hero + trio + ticker + rateBand + feats + steps + quotes + faqSec + cta);

    return {
      html: html,
      mount: function () {
        bindPubChrome();
        bindFaq();
        // gentle card tilt
        var scene = document.getElementById('card-scene');
        var card = document.getElementById('hero-card');
        if (scene && card) {
          scene.addEventListener('mousemove', function (e) {
            var rect = scene.getBoundingClientRect();
            var x = (e.clientX - rect.left) / rect.width - 0.5;
            var y = (e.clientY - rect.top) / rect.height - 0.5;
            card.style.transform = 'rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 6) + 'deg)';
          });
          scene.addEventListener('mouseleave', function () {
            card.style.transform = '';
          });
        }
      }
    };
  }

  /* ========================================================= PERSONAL */
  async function personal() {
    var r = await fetchBoot().catch(function () { return null; });
    var apy = r ? r.fees.savings_apy : 4.25;
    var apr = r ? r.fees.loan_apr : 9.9;

    function prod(icon, name, tag, bullets, cta) {
      return '<div class="feat-card reveal">' +
        '<div class="fc-icon">' + U().icon(icon, 20) + '</div>' +
        '<h3>' + name + '</h3><span class="pill blue plain mb-1" style="display:inline-flex">' + tag + '</span>' +
        '<ul class="mt-1" style="padding-left:18px;color:var(--muted);font-size:13.5px;line-height:1.8">' +
        bullets.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul>' +
        '<a class="btn outline sm mt-2" href="' + cta[1] + '">' + cta[0] + '</a></div>';
    }

    var heroLite =
      '<section class="hero"><div class="hero-inner" style="padding-top:46px;padding-bottom:52px">' +
      '<div class="reveal"><span class="hero-kicker">Personal banking</span>' +
      '<h1>Accounts that pull their weight.</h1>' +
      '<p class="lead">Everything a modern household needs: free checking, savings that earn daily, cards with real controls, and honest loans.</p>' +
      '<div class="hero-ctas"><a class="btn lg" href="#/register">Open an account</a>' +
      '<a class="btn secondary lg" href="#/rates">Compare rates</a></div></div>' +
      '<div class="bank-card-scene reveal"><div class="scene-card-back"></div>' +
      '<div class="realistic-card"><div class="rc-top"><div class="rc-brand">Zentra<small>Platinum Debit</small></div></div>' +
      '<div class="rc-chip"></div><div class="rc-num">4773 &nbsp;•••• &nbsp;•••• &nbsp;1120</div>' +
      '<div class="rc-foot"><div><div class="rc-label">Card holder</div><div class="rc-val">A. STERLING</div></div>' +
      '<div><div class="rc-label">Expires</div><div class="rc-val">04/29</div></div><div class="rc-brandmark">' +U().cardBrand('visa', 22) + '</div></div></div></div>' +
      '</div></section>';

    var products =
      '<section class="section"><div class="section-head reveal"><span class="eyebrow">The lineup</span>' +
      '<h2>Pick your starting point</h2><p>All accounts open instantly. Mix and match freely.</p></div>' +
      '<div class="feat-grid cols-2">' +
      prod('wallet', 'Everyday Checking', 'MOST POPULAR',
        ['$0 monthly fee, $0 minimum balance', 'Instant transfers to any Zentra customer',
          'Bill pay with 8 categories and saved payees', 'Free virtual debit card on signup'],
        ['Open checking', '#/register']) +
      prod('percent', 'Growth Savings', apy + '% APY',
        ['Interest accrues daily, credited daily', 'No withdrawal penalties or lock-ups',
          'Round-up friendly — move spare cash anytime', 'Watch projections in your dashboard'],
        ['Start saving', '#/register']) +
      prod('card', 'Debit cards', 'CONTROL',
        ['Freeze/unfreeze instantly from the app', 'Set your own monthly spending limit',
          'Extra virtual cards for subscriptions — free', 'Physical card ships in 5–7 days ($5)'],
        ['Issue a card', '#/login']) +
      prod('target', 'Personal loans', apr + '% APR',
        ['Fixed rates, terms from 3 to 48 months', 'See your exact payment before applying',
          'Funds deposited the moment you\'re approved', 'Repay early anytime, no penalty'],
        ['Check eligibility', '#/login']) +
      '</div></section>';

    var compare =
      '<section class="section tint"><div class="section-head reveal"><span class="eyebrow">Side by side</span>' +
      '<h2>Checking vs Savings</h2></div>' +
      '<div class="reveal" style="max-width:760px;margin:0 auto"><div class="table-wrap"><table class="table">' +
      '<thead><tr><th>Feature</th><th>Everyday Checking</th><th>Growth Savings</th></tr></thead><tbody>' +
      '<tr><td><b>APY</b></td><td>—</td><td class="up"><b>' + apy + '%</b></td></tr>' +
      '<tr><td><b>Monthly fee</b></td><td>$0</td><td>$0</td></tr>' +
      '<tr><td><b>Minimum to open</b></td><td>Any amount</td><td>Any amount</td></tr>' +
      '<tr><td><b>Debit card</b></td><td>Yes</td><td>No</td></tr>' +
      '<tr><td><b>Bill pay</b></td><td>Yes</td><td>—</td></tr>' +
      '<tr><td><b>Best for</b></td><td>Spending &amp; bills</td><td>Growing your buffer</td></tr>' +
      '</tbody></table></div>' +
      '<div class="center mt-2" style="text-align:center"><a class="btn lg" href="#/register">Open both — takes minutes</a></div></div></section>';

    var faqSec =
      '<section class="section"><div class="section-head reveal"><span class="eyebrow">Details</span>' +
      '<h2>Fine print, translated</h2></div><div class="faq-list reveal">' +
      faqBlock([
        ['Are there overdraft fees?', 'No. We simply decline transactions that exceed your available balance rather than charging $35 for the privilege.'],
        ['Can I have multiple accounts?', 'Up to six, across any mix of currencies (USD, EUR, GBP) — useful for travelers and freelancers billing abroad.'],
        ['What happens if I lose my card?', 'Tap freeze immediately; the card stops working everywhere while you decide. Unfreeze it if it turns up in the couch, or order a replacement from the same screen.']
      ]) + '</div></section>';

    var html = pubShell('#/personal', heroLite + products + compare + faqSec);
    return { html: html, mount: function () { bindPubChrome(); bindFaq(); } };
  }

  /* ======================================================== BUSINESS */
  async function business() {
    var r = await fetchBoot().catch(function () { return null; });
    var exFee = r ? r.fees.exchange_fee_pct : 0.35;

    var heroLite =
      '<section class="hero"><div class="hero-inner" style="padding-top:46px;padding-bottom:52px">' +
      '<div class="reveal"><span class="hero-kicker">Business banking</span>' +
      '<h1>Cash flow, minus the friction.</h1>' +
      '<p class="lead">Multi-currency wallets, cheap FX, payroll-ready payments and a ledger your accountant will actually enjoy reading.</p>' +
      '<div class="hero-ctas"><a class="btn lg" href="#/register">Open a business account</a>' +
      '<a class="btn secondary lg" href="#/support">Talk to us</a></div>' +
      '<div class="mini-stats">' +
      '<div class="mini-stat"><b>' + exFee + '%</b><span>FX conversion fee</span></div>' +
      '<div class="mini-stat"><b>3</b><span>currencies, one login</span></div>' +
      '<div class="mini-stat"><b>$0</b><span>internal transfer cost</span></div></div></div>' +
      '<div class="bank-card-scene reveal"><div class="scene-card-back"></div>' +
      '<div class="realistic-card"><div class="rc-top"><div class="rc-brand">Zentra<small>Business</small></div></div>' +
      '<div class="rc-chip"></div><div class="rc-num">8810 &nbsp;•••• &nbsp;•••• &nbsp;3301</div>' +
      '<div class="rc-foot"><div><div class="rc-label">Company</div><div class="rc-val">NORTHWIND LLC</div></div>' +
      '<div><div class="rc-label">Card holder</div><div class="rc-val">CFO</div></div><div class="rc-brandmark">' +U().cardBrand('visa', 22) + '</div></div></div></div>' +
      '</div></section>';

    function bizFeat(icon, title, text) {
      return '<div class="feat-card reveal"><div class="fc-icon">' + U().icon(icon, 20) + '</div>' +
        '<h3>' + title + '</h3><p>' + text + '</p></div>';
    }
    var feats =
      '<section class="section"><div class="section-head reveal"><span class="eyebrow">Built for operators</span>' +
      '<h2>Everything the money side needs</h2></div>' +
      '<div class="feat-grid cols-2 reveal">' +
      bizFeat('layers', 'A ledger worth reading', 'Every transaction carries category, counterparty, note and running balance. Export CSV statements for any month, any account, instantly.') +
      bizFeat('swap', 'Pay anyone, anywhere', 'Instant vendor payouts to other Zentra businesses, or scheduled external transfers with beneficiary book and compliance review above your configured threshold.') +
      bizFeat('globe', 'Hold and convert FX', 'Keep EUR and GBP wallets alongside dollars and convert at ' + exFee + '% with live mid-market rates shown before you commit.') +
      bizFeat('receipt', 'Payables without spreadsheets', 'Categorize utilities, rent, suppliers and software. Saved payees autocomplete from history so recurring runs take seconds.') +
      '</div></section>';

    var cta =
      '<section class="cta-band"><div class="cta-inner reveal">' +
      '<h2>Move your business banking forward</h2>' +
      '<p>Open an account today and see your first month\'s cash flow mapped by tomorrow.</p>' +
      '<a class="btn secondary lg" href="#/register">Get started free</a></div></section>';

    var html = pubShell('#/business', heroLite + feats + cta);
    return { html: html, mount: function () { bindPubChrome(); } };
  }

  /* ====================================================== RATES PAGE */
  async function rates() {
    var r = await fetchBoot().catch(function () { return null; });
    var f = r ? r.fees : { savings_apy: 4.25, loan_apr: 9.9, external_fee_pct: 1, external_fee_min: 1, exchange_fee_pct: 0.35, card_issue_fee: 5, transfer_fee_pct: 0 };
    var terms = (r && r.loan_terms) || [3, 6, 12, 24, 36, 48];

    var today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    var head =
      '<div class="info-page" style="max-width:1000px">' +
      '<span class="hero-kicker">Rates &amp; fees</span>' +
      '<h1>The whole price list.<br>Nothing hidden.</h1>' +
      '<p class="updated">Rates effective as of ' + today + '. All rates are variable unless marked fixed and may change with market conditions.</p>' +
      '</div>';

    function tbl(title, rows, note) {
      return '<section class="section" style="padding-top:0"><div class="card pad-lg reveal">' +
        '<div class="card-title"><h3>' + title + '</h3></div>' +
        '<div class="table-wrap" style="border:none"><table class="fee-table"><tbody>' +
        rows.map(function (rw) {
          return '<tr><td style="width:60%">' + rw[0] + (rw[2] ? ' <span class="tiny faint">(' + rw[2] + ')</span>' : '') +
            '</td><td class="num"><b>' + rw[1] + '</b></td></tr>';
        }).join('') +
        '</tbody></table></div>' +
        (note ? '<p class="hint mt-1">' + note + '</p>' : '') + '</div></section>';
    }

    var depositTbl = tbl('Deposit accounts', [
      ['Growth Savings APY', '<span class="up"><b>' + f.savings_apy + '%</b></span>', 'interest calculated daily, credited daily'],
      ['Everyday Checking APY', '0.00%', 'spending account'],
      ['Minimum opening deposit', 'Any amount'],
      ['Monthly maintenance fee — Checking', '$0'],
      ['Monthly maintenance fee — Savings', '$0'],
      ['Excess withdrawal fee (Savings)', '$0', 'we don\'t do those'],
      ['Paper statements', '$0', 'always free, always PDF']
    ]);

    var lendingTbl = tbl('Lending', [
      ['Personal loan APR (fixed)', '<b>' + f.loan_apr + '%</b>', 'subject to credit approval'],
      ['Available terms', terms.join(', ') + ' months'],
      ['Origination fee', '$0'],
      ['Prepayment penalty', '$0', 'repay early anytime'],
      ['Late fee grace period', '5 days']
    ], 'Representative example: a $5,000 loan at ' + f.loan_apr + '% APR over 12 months = roughly ' +
      U().money(amortize(5000, f.loan_apr, 12)) + '/month.');

    var transferTbl = tbl('Transfers & FX', [
      ['Zentra-to-Zentra transfer fee', '$0', 'instant, 24/7'],
      ['Transfer between own accounts', '$0'],
      ['External bank transfer fee', f.external_fee_pct + '% (min $' + Number(f.external_fee_min).toFixed(2) + ')', 'arrives 1–3 business days'],
      ['Currency exchange fee', f.exchange_fee_pct + '%', 'mid-market rate shown upfront'],
      ['Debit card foreign transaction', '$0']
    ]);

    var cardsTbl = tbl('Cards', [
      ['Virtual debit card', '$0', 'first card free, extras too'],
      ['Physical debit card', '$' + Number(f.card_issue_fee).toFixed(2) + ' one-time', 'ships in 5–7 business days'],
      ['Card replacement', '$0', 'once per year'],
      ['ATM withdrawals (in-network)', '$0'],
      ['Lost card reissue', '$' + Number(f.card_issue_fee).toFixed(2)]
    ]);

    /* --- calculators --- */
    var calcSec =
      '<section class="section tint"><div class="section-head reveal">' +
      '<span class="eyebrow">Plan ahead</span><h2>Do the math yourself</h2>' +
      '<p>Live tools wired to today\'s actual rates.</p></div>' +
      '<div class="calc-grid reveal">' +

      '<div class="calc-card"><h3 class="mb-2">' + U().icon('percent', 17) + ' Savings growth projector</h3>' +
      '<div class="field"><label>Starting deposit — <b id="sv-p-val">' + U().money(5000) + '</b></label>' +
      '<input type="range" class="slider" id="sv-p" min="0" max="100000" step="500" value="5000" style="--fill:' + (5000 / 100000 * 100) + '%"></div>' +
      '<div class="field"><label>Monthly contribution — <b id="sv-m-val">$200</b></label>' +
      '<input type="range" class="slider" id="sv-m" min="0" max="3000" step="25" value="200" style="--fill:' + (200 / 3000 * 100) + '%"></div>' +
      '<div class="field"><label>Time horizon — <b id="sv-y-val">5 years</b></label>' +
      '<input type="range" class="slider" id="sv-y" min="1" max="30" step="1" value="5" style="--fill:' + (4 / 29 * 100) + '%"></div>' +
      '<div class="calc-out"><div class="big" id="sv-out">—</div>' +
      '<div class="sub" id="sv-sub">at ' + f.savings_apy + '% APY compounded daily</div></div></div>' +

      '<div class="calc-card"><h3 class="mb-2">' + U().icon('target', 17) + ' Loan payment estimator</h3>' +
      '<div class="field"><label>Loan amount — <b id="ln-a-val">' + U().money(8000) + '</b></label>' +
      '<input type="range" class="slider" id="ln-a" min="500" max="40000" step="500" value="8000" style="--fill:' + ((8000 - 500) / 39500 * 100) + '%"></div>' +
      '<div class="field"><label>Term</label><select class="input" id="ln-t">' +
      terms.map(function (t) { return '<option value="' + t + '"' + (t === 24 ? ' selected' : '') + '>' + t + ' months</option>'; }).join('') +
      '</select><span class="hint">Fixed ' + f.loan_apr + '% APR</span></div>' +
      '<div class="calc-out"><div class="big" id="ln-out">—</div>' +
      '<div class="sub" id="ln-sub">per month · estimated</div></div></div>' +

      '</div></section>';

    var disc =
      '<div class="info-page" style="padding-top:0"><p class="tiny faint" style="line-height:1.8">' +
      'Disclosure: Annual Percentage Yield (APY) is accurate as of ' + today + ' and may change after account opening. ' +
      'No minimum deposit required to open or earn the advertised APY on Growth Savings. Loan APR shown assumes verified identity, ' +
      'on-time repayment history and is subject to credit review; your rate may differ. Fees may reduce earnings on deposit accounts. ' +
      'Calculator results are estimates for illustration only and do not constitute an offer of credit.</p></div>';

    var html = pubShell('#/rates', head + depositTbl + lendingTbl + transferTbl + cardsTbl + calcSec + disc);

    return {
      html: html,
      mount: function () {
        bindPubChrome();

        function fill(el) {
          var pct = (el.value - el.min) / (el.max - el.min) * 100;
          el.style.setProperty('--fill', pct + '%');
        }
        function compound(P, pmt, years, apyPct) {
          var r = apyPct / 100 / 365, n = Math.round(years * 365);
          var bal = P * Math.pow(1 + r, n);
          var contributed = P;
          for (var m = 1; m <= years * 12; m++) {
            bal += pmt * Math.pow(1 + r, n - m * 30.42 > 0 ? Math.round(n - m * 30.42) : 0);
          }
          contributed += pmt * years * 12;
          return { fv: bal, earned: bal - contributed, put: contributed };
        }
        function svUpdate() {
          var P = +document.getElementById('sv-p').value;
          var M = +document.getElementById('sv-m').value;
          var Y = +document.getElementById('sv-y').value;
          ['#sv-p', '#sv-m', '#sv-y'].forEach(function (s) { fill(document.querySelector(s)); });
          document.getElementById('sv-p-val').textContent = U().money(P);
          document.getElementById('sv-m-val').textContent = U().money(M) + '/mo';
          document.getElementById('sv-y-val').textContent = Y + (Y === 1 ? ' year' : ' years');
          var res = compound(P, M, Y, f.savings_apy);
          document.getElementById('sv-out').textContent = U().money(res.fv);
          document.getElementById('sv-sub').innerHTML = 'You contribute ' + U().money(res.put) +
            ' · <b class="up">' + U().money(res.earned) + ' interest earned</b> at ' + f.savings_apy + '% APY';
        }
        ['sv-p', 'sv-m', 'sv-y'].forEach(function (id) {
          document.getElementById(id).addEventListener('input', svUpdate);
        });
        svUpdate();

        function lnUpdate() {
          var A = +document.getElementById('ln-a').value;
          var T = +document.getElementById('ln-t').value;
          fill(document.getElementById('ln-a'));
          document.getElementById('ln-a-val').textContent = U().money(A);
          var mp = amortize(A, f.loan_apr, T);
          document.getElementById('ln-out').textContent = U().money(mp) + '/mo';
          document.getElementById('ln-sub').textContent = U().money(mp * T) + ' total over ' + T +
            ' months (' + U().money(mp * T - A) + ' interest) · estimated';
        }
        document.getElementById('ln-a').addEventListener('input', lnUpdate);
        document.getElementById('ln-t').addEventListener('change', lnUpdate);
        lnUpdate();
      }
    };
  }

  function amortize(principal, apr, months) {
    var mr = apr / 100 / 12;
    if (!mr) return principal / months;
    return principal * mr * Math.pow(1 + mr, months) / (Math.pow(1 + mr, months) - 1);
  }

  /* ======================================================== SECURITY */
  async function security() {
    var heroLite =
      '<section class="hero"><div class="hero-inner" style="grid-template-columns:1fr;text-align:center;max-width:860px;margin:0 auto;padding-top:50px;padding-bottom:54px;display:block">' +
      '<span class="hero-kicker" style="justify-content:center;display:inline-flex">Security center</span>' +
      '<h1>Your money, locked down properly.</h1>' +
      '<p class="lead" style="margin-left:auto;margin-right:auto">Security isn\'t a feature we bolt on — it\'s how every layer of the bank is built, checked and audited.</p>' +
      '</div></section>';

    var secBand =
      '<section class="sec-band"><div class="sec-band-inner">' +
      '<div class="section-head reveal" style="text-align:left;margin-bottom:8px">' +
      '<span class="eyebrow" style="color:#7fb3dd">Defense in depth</span>' +
      '<h2 style="color:#fff">Five layers between a stranger and your balance</h2></div>' +
      '<div class="sec-cols reveal">' +
      '<div class="sec-col">' + U().icon('key', 24) + '<h3>Passwords we can\'t leak</h3>' +
      '<p>Credentials are hashed with PBKDF2-HMAC-SHA256 across 120,000 rounds with per-user salts. Even we can\'t read them — verification is one-way.</p></div>' +
      '<div class="sec-col">' + U().icon('shield', 24) + '<h3>Sessions you control</h3>' +
      '<p>Every device gets its own revocable session showing device and IP. Suspicious activity? Kill every session except yours in one click.</p></div>' +
      '<div class="sec-col">' + U().icon('eyeOff', 24) + '<h3>Frozen means frozen</h3>' +
      '<p>Suspending an account revokes access instantly platform-wide. Card freeze applies everywhere the moment you tap.</p></div>' +
      '<div class="sec-col">' + U().icon('layers', 24) + '<h3>A tamper-evident ledger</h3>' +
      '<p>Money movements append signed entries with running balances. Corrections happen as mirrored reversals — history is never silently edited.</p></div>' +
      '<div class="sec-col">' + U().icon('users', 24) + '<h3>Humans reviewing risk</h3>' +
      '<p>Large external payouts pause for staff approval. Identity documents are reviewed before limits lift. Every staff action is audit-logged forever.</p></div>' +
      '<div class="sec-col">' + U().icon('server', 24) + '<h3>Atomic everything</h3>' +
      '<p>Balances persist through atomic file writes — a crash mid-transfer cannot leave half a transaction behind.</p></div>' +
      '</div>' +
      '<div class="sec-badge-row reveal">' +
      '<span class="sec-badge">' + U().icon('lock', 13) + ' TLS everywhere</span>' +
      '<span class="sec-badge">' + U().icon('database', 13) + ' Encrypted backups</span>' +
      '<span class="sec-badge">' + U().icon('clock', 13) + ' Full audit trail</span>' +
      '<span class="sec-badge">' + U().icon('check', 13) + ' KYC on every customer</span>' +
      '</div></div></section>';

    var tips =
      '<section class="section"><div class="section-head reveal"><span class="eyebrow">Your part</span>' +
      '<h2>Habits that keep you safe</h2></div>' +
      '<div class="steps reveal">' +
      '<div class="step"><h3>Use a unique passphrase</h3><p>Never reuse your email password here. Length beats complexity — four random words win.</p></div>' +
      '<div class="step"><h3>Check your sessions</h3><p>Settings → Active sessions shows every signed-in device. See something odd? Revoke it.</p></div>' +
      '<div class="step"><h3>Verify beneficiaries twice</h3><p>Email addresses are easy to spoof. Confirm large external payout details over a second channel.</p></div>' +
      '</div></section>';

    var html = pubShell('#/security', heroLite + secBand + tips);
    return { html: html, mount: function () { bindPubChrome(); } };
  }

  /* ========================================================= SUPPORT */
  async function support() {
    var r = await fetchBoot().catch(function () { return null; });
    var email = r ? r.support_email : 'help@zentra.bank';

    var heroLite =
      '<section class="hero"><div class="hero-inner" style="grid-template-columns:1fr;display:block;text-align:center;padding-top:46px;padding-bottom:48px">' +
      '<span class="hero-kicker" style="justify-content:center;display:inline-flex">Support</span>' +
      '<h1>How can we help?</h1>' +
      '<p class="lead" style="margin-left:auto;margin-right:auto">Real humans, real answers — usually within four hours during business days.</p>' +
      '</div></section>';

    var channels =
      '<section class="section" style="padding-bottom:34px"><div class="feat-grid cols-2 reveal">' +
      '<div class="feat-card"><div class="fc-icon">' + U().icon('message', 20) + '</div>' +
      '<h3>Message us</h3><p>Use the form below — it lands directly in our team inbox and you\'ll hear back by email.</p></div>' +
      '<div class="feat-card"><div class="fc-icon">' + U().icon('mail', 20) + '</div>' +
      '<h3>Email</h3><p><a href="mailto:' + email + '">' + email + '</a><br><span class="tiny faint">Mon–Fri, 8am–8pm ET</span></p></div>' +
      '</div></section>';

    var formSec =
      '<section class="section" style="padding-top:10px"><div class="split"><div class="card pad-lg reveal">' +
      '<div class="card-title"><h3>Send a message</h3></div>' +
      '<form data-form="support">' +
      '<div class="grid cols-2" style="gap:12px">' +
      '<div class="field"><label>Your name</label><input class="input" name="name" required placeholder="Alex Rivera"></div>' +
      '<div class="field"><label>Email</label><input class="input" type="email" name="email" required placeholder="you@example.com"></div></div>' +
      '<div class="field"><label>Subject</label><input class="input" name="subject" required maxlength="120" placeholder="Question about my transfer"></div>' +
      '<div class="field"><label>Message</label><textarea class="input" name="body" required maxlength="1500" placeholder="Tell us what happened — include dates and amounts if relevant."></textarea></div>' +
      '<button class="btn block" type="submit">' + U().icon('send', 15) + ' Send message</button>' +
      '</form></div>' +
      '<div class="card reveal"><div class="card-title"><h3>Quick answers</h3></div>' +
      faqBlock([
        ['When will my external transfer arrive?', 'Typically 1–3 business days. Large amounts may pause briefly for a compliance review — you\'ll get a notification either way.'],
        ['How do I reset my password?', 'Use “Forgot?” on the sign-in screen, or sign in and change it under Settings → Password.'],
        ['My card was declined', 'First, check your monthly limit under Cards and confirm the card isn\'t frozen. Still stuck? Message us with the merchant name.'],
        ['How do interest payments appear?', 'As “Savings interest” entries in your transaction history, posted once a day.'],
        ['Can I download statements?', 'Yes — Statements tab lets you pick any account and month, then export CSV or print a PDF-ready view.']
      ]) + '</div></div></section>';

    var html = pubShell('#/support', heroLite + channels + formSec);
    return {
      html: html,
      mount: function () {
        bindPubChrome(); bindFaq('.split');
        ZB.forms.support = async function (data, formEl) {
          try {
            await ZB.api.post('/api/public/support', data);
            U().toast('Message sent — we\'ll reply to ' + data.email + ' shortly.');
            formEl.reset();
          } catch (e) { U().toast(e.message, 'err'); }
        };
      }
    };
  }

  /* =========================================================== ABOUT */
  async function about() {
    var r = await fetchBoot().catch(function () { return null; });
    var stats = r ? r.stats : { customers: 10, volume_usd: 0 };

    var heroLite =
      '<section class="hero"><div class="hero-inner" style="display:block;text-align:center;padding-top:48px;padding-bottom:50px">' +
      '<span class="hero-kicker" style="justify-content:center;display:inline-flex">About Zentra</span>' +
      '<h1>The bank that behaves like software.</h1>' +
      '<p class="lead" style="margin-left:auto;margin-right:auto">We started Zentra because banking felt like it was designed for the bank\'s convenience, not yours. So we rebuilt it: no junk fees, daily interest, instant controls, and support that replies like a colleague, not a call center.</p>' +
      '</div></section>';

    var band =
      '<div class="rate-band"><div class="rate-band-inner">' +
      '<div class="rate-cell"><div class="rv">' + (stats.customers || 10).toLocaleString() + '+</div><div class="rl">Customers</div><div class="rn">and growing weekly</div></div>' +
      '<div class="rate-cell"><div class="rv">' + U().compact(stats.volume_usd || 0) + '</div><div class="rl">Processed volume</div><div class="rn">across all currencies</div></div>' +
      '<div class="rate-cell"><div class="rv">99.99%</div><div class="rl">Platform uptime</div><div class="rn">last 12 months</div></div>' +
      '<div class="rate-cell"><div class="rv">&lt; 4 hrs</div><div class="rl">Median support reply</div><div class="rn">during business hours</div></div>' +
      '</div></div>';

    var body =
      '<section class="info-page">' +
      '<h3>What we believe</h3>' +
      '<p>Fees should be visible before you\'re charged. Interest should start working on day one, not after a minimum-balance dance. Losing your card should cost one tap, not a phone tree and a week. And when something goes wrong, a person should tell you what happened and what happens next.</p>' +
      '<h3>How we operate</h3>' +
      '<p>Zentra runs on a simple principle: the ledger is the truth. Every deposit, transfer, fee and interest posting is an immutable entry with a running balance — so when you ask \"where did my money go\", the answer is exact, timestamped and exportable. Our operations team reviews every large outbound transfer, every identity document, and every loan application personally.</p>' +
      '<h3>Where we\'re going</h3>' +
      '<p>Next up: joint accounts, scheduled recurring transfers, and richer spending analytics. Have a feature request? The Support page goes straight to the people building this thing.</p>' +
      '<div class="cta-band mt-3" style="border-radius:var(--r-md)"><div class="cta-inner" style="padding:38px 26px">' +
      '<h2 style="font-size:1.4rem">Come bank with us</h2>' +
      '<a class="btn secondary mt-2" href="#/register">Open your account</a></div></div>' +
      '</section>';

    var html = pubShell('#/about', heroLite + band + body);
    return { html: html, mount: function () { bindPubChrome(); } };
  }

  /* ========================================================== LEGAL */
  async function legal() {
    var today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    var page =
      '<div class="info-page">' +
      '<h1>Legal center</h1>' +
      '<p class="updated">Last updated ' + today + ' &#183; Zentra Bank, N.A. &#183; Member FDIC</p>' +

      '<h3>Deposit account agreement (summary)</h3>' +
      '<p>Deposits are held at Zentra Bank, N.A., Member FDIC, insured to the maximum allowed by law ($250,000 per depositor per ownership category). You are responsible for transactions initiated with your credentials; report unauthorized activity promptly.</p>' +

      '<h3>Truth in Savings disclosure</h3>' +
      '<p>The Annual Percentage Yield (APY) on Growth Savings is variable and may change after account opening. Interest is calculated using the daily balance method: the applicable daily rate is APY ÷ 366 applied to the collected balance each calendar day, credited to the account daily. Fees may reduce earnings. No minimum balance is required to open or obtain the advertised APY.</p>' +

      '<h3>Privacy notice</h3>' +
      '<p>We collect the information necessary to provide banking services: identity data, contact details, transaction records and device metadata for security. We do not sell personal information. Data is stored encrypted-at-rest in our primary datastore and replicated to encrypted backups. You may request export or deletion of your data via Support, subject to record-retention obligations that apply to financial institutions.</p>' +

      '<h3>Electronic communications consent</h3>' +
      '<p>By opening an account you consent to receive statements, disclosures and legally required notices electronically. Paper copies are available on request at no charge.</p>' +

      '<h3>Error resolution</h3>' +
      '<p>If you believe a transaction is wrong, contact Support immediately. We will investigate within two business days of hearing from you and correct any proven error, including crediting applicable interest. During investigation, provisional credit may be applied for eligible claims.</p>' +

      '<h3>Lending disclosures</h3>' +
      '<p>All credit products are subject to application, verification and credit approval. The advertised APR assumes excellent credit and automatic repayment. Representative example: $8,000 loan at 9.90% APR repaid over 24 months = approximately $369/month; total cost approximately $8,861. Late payments may incur fees after the 5-day grace period and affect future borrowing terms.</p>' +

      '<h3>Trademarks & accessibility</h3>' +
      '<p>Zentra and the Z-mark are trademarks of Zentra Bank, N.A. This site aims to conform to WCAG 2.1 AA; if you encounter an accessibility barrier, tell us at Support and we will fix it.</p>' +

      '<h3>Regulatory information</h3>' +
      '<p>Zentra Bank, N.A. is a national bank, Member FDIC and Equal Housing Lender. Deposits are insured to the maximum allowed by law.</p>' +
      '</div>';

    var html = pubShell('#/legal', page);
    return { html: html, mount: function () { bindPubChrome(); } };
  }

  /* ========================================================== LOGIN */
  async function login() {
    var html =
      '<div class="auth-page">' +
      '<div class="auth-card">' +
      '<div class="auth-logo">' + brandHtml() + '</div>' +
      '<h1>Welcome back</h1>' +
      '<p class="auth-sub">Sign in to your Zentra accounts</p>' +
      '<div class="err-line hidden" id="lg-err"></div>' +
      '<form data-form="login" novalidate>' +
      '<div class="field"><label>Email address</label>' +
      '<input class="input" type="email" name="email" required autocomplete="username" placeholder="you@example.com"></div>' +
      '<div class="field"><label>Password</label>' +
      '<input class="input" type="password" name="password" required autocomplete="current-password" placeholder="Your password"></div>' +
      '<button class="btn lg block" type="submit">Sign in securely ' + U().icon('lock', 14) + '</button></form>' +
      '<p class="auth-note">New to Zentra? <a href="#/register">Open an account</a> &#183; ' +
      '<a href="#/support">Forgot password?</a></p>' +
      '</div></div>';

    return {
      html: html,
      mount: function () {
        var err = document.getElementById('lg-err');
        function showErr(m) { err.textContent = m; err.classList.remove('hidden'); }
        ZB.forms.login = function (data) {
          err.classList.add('hidden');
          if (!data.email.trim() || !data.password) return showErr('Enter your email and password.');
          return ZB.api.post('/api/auth/login', {
            email: data.email.trim(), password: data.password
          }).then(function (r) {
            ZB.api.setToken(r.token);
            ZB.state.user = r.user;
            ZB.state.boot = null;
            U().toast('Welcome back, ' + r.user.name.split(' ')[0] + '!');
            location.hash = ZB.homeFor(r.user);
          }).catch(function (ex) { showErr(ex.message || 'Sign-in failed.'); });
        };
      }
    };
  }

  /* ======================================================= REGISTER */
  async function register() {
    var boot = await fetchBoot().catch(function () { return null; });
    var curs = (boot && boot.currencies) || ['USD', 'EUR', 'GBP'];

    var html =
      '<div class="auth-page">' +
      '<div class="auth-card wide">' +
      '<div class="auth-logo">' + brandHtml() + '</div>' +
      '<h1>Open your account</h1>' +
      '<p class="auth-sub">About 3 minutes. No credit check for deposit accounts.</p>' +
      '<div class="err-line hidden" id="rg-err"></div>' +
      '<form data-form="register" novalidate>' +
      '<div class="field"><label>Full legal name</label>' +
      '<input class="input" name="name" required minlength="3" placeholder="Jordan Miles"></div>' +
      '<div class="field"><label>Email address</label>' +
      '<input class="input" type="email" name="email" required autocomplete="email" placeholder="you@example.com"></div>' +
      '<div class="field"><label>Create password</label>' +
      '<input class="input" type="password" name="password" required id="rg-pw" autocomplete="new-password" placeholder="At least 8 characters">' +
      '<div class="pw-meter"><i id="pw-bar"></i></div><div class="pw-hint" id="pw-hint">Use 8+ characters mixing letters, numbers &amp; symbols.</div></div>' +
      '<div class="field"><label>Default currency</label><select class="input" name="currency">' +
      curs.map(function (c) { return '<option value="' + c + '"' + (c === 'USD' ? ' selected' : '') + '>' +
        c + ' — ' + ({ USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound' }[c] || c) + '</option>'; }).join('') +
      '</select><span class="hint">You can hold EUR and GBP wallets later too.</span></div>' +
      '<div class="field"><label>4-digit transaction PIN</label>' +
      '<input class="input pin-input" type="password" name="pin" required inputmode="numeric" ' +
      'pattern="[0-9]{4}" maxlength="4" autocomplete="off" placeholder="••••" style="text-align:center;letter-spacing:10px">' +
      '<span class="hint">You\'ll enter this to authorize transfers and payments — like your card PIN at an ATM.</span></div>' +
      '<button class="btn lg block" type="submit">' + U().icon('check', 15) + ' Create my account</button></form>' +
      '<p class="auth-note">By continuing you agree to our <a href="#/legal">Terms</a> and ' +
      '<a href="#/legal">Privacy Notice</a>.<br>Already a customer? <a href="#/login">Sign in</a></p>' +
      '</div></div>';

    return {
      html: html,
      mount: function () {
        var err = document.getElementById('rg-err');
        var pw = document.getElementById('rg-pw');
        var bar = document.getElementById('pw-bar');
        var hint = document.getElementById('pw-hint');
        pw.addEventListener('input', function () {
          var v = pw.value, score = 0;
          if (v.length >= 8) score++;
          if (v.length >= 12) score++;
          if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
          if (/\d/.test(v)) score++;
          if (/[^A-Za-z0-9]/.test(v)) score++;
          var conf = [[12, '#c22f2f', 'Too weak'], [34, '#d97706', 'Weak'], [58, '#e8a33d', 'Fair'], [82, '#2fa860', 'Good'], [100, '#137333', 'Strong']][Math.max(0, score - 1)] || [0, '#c22f2f', ''];
          bar.style.width = conf[0] + '%';
          bar.style.background = conf[1];
          hint.textContent = v ? 'Strength: ' + conf[2] + (score < 3 ? ' — add length or variety.' : ' — nice.') :
            'Use 8+ characters mixing letters, numbers & symbols.';
        });
        ZB.forms.register = function (data) {
          err.classList.add('hidden');
          if (!/^\d{4}$/.test(data.pin || '')) {
            err.textContent = 'Your transaction PIN must be exactly 4 digits.';
            err.classList.remove('hidden');
            return;
          }
          return ZB.api.post('/api/auth/register', {
            name: data.name.trim(),
            email: data.email.trim(),
            password: data.password,
            currency: data.currency,
            pin: data.pin
          }).then(function (r) {
            ZB.api.setToken(r.token);
            ZB.state.user = r.user;
            ZB.state.boot = null;
            U().toast('Account opened — welcome to Zentra, ' + r.user.name.split(' ')[0] + '! 🎉');
            location.hash = '#/app';
          }).catch(function (ex) {
            err.textContent = ex.message || 'Could not create account.';
            err.classList.remove('hidden');
          });
        };
      }
    };
  }

  /* pricing alias kept for old links */
  function pricing(q) { location.hash = '#/rates'; return { html: '<div class="boot"><div class="boot-ring"></div></div>' }; }

  ZB.views.public = {
    home: home, personal: personal, business: business,
    pricing: pricing, rates: rates, security: security, support: support,
    about: about, legal: legal, login: login, register: register
  };
})(window.ZB);
