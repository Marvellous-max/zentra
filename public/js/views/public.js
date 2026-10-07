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
      ZB.t("Zentra") + "<span class=\"spark\">&#9679;</span></a>";
  }

  function curList(boot, exclude) {
    var codes = U().currencyList(boot && boot.currencies).map(function (c) { return c.code; })
      .filter(function (c) { return c !== exclude; });
    if (codes.length < 2) return codes.join('');
    return codes.slice(0, -1).join(', ') + ' or ' + codes[codes.length - 1];
  }

  function navLinks(active) {
    var links = [
      ['#/personal', ZB.t("Personal")],
      ['#/business', ZB.t("Business")],
      ['#/rates', ZB.t("Rates & Fees")],
      ['#/security', ZB.t("Security")],
      ['#/support', ZB.t("Support")]
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
      "<span class=\"hide-sm\">" + ZB.t("Member FDIC &#183; Equal Housing Lender &#183; Routing #021000021") + "</span>" +
      "<span><a href=\"#/about\" class=\"hide-sm\">" + ZB.t("About us") + "</a><span class=\"sep hide-sm\"> | </span>" +
      "<a href=\"#/legal\">" + ZB.t("Disclosures") + "</a><span class=\"sep\"> | </span>" +
      "<a href=\"#/support\">" + ZB.t("Contact") + "</a>" +
      (signedIn ? '<span class="sep"> | </span><a href="' + dashHref + '">' + ZB.t("My accounts") + '</a>' : '') +
      '</span></div></div>' +

      '<div class="pub-nav-wrap"><nav class="pub-nav">' +
      brandHtml() +
      '<div class="pub-links">' + navLinks(active) + '</div>' +
      '<div class="pub-actions">' +
      (signedIn
        ? '<a class="btn outline sm" href="' + dashHref + '">' + U().icon('grid', 14) + " " + ZB.t("My dashboard") + "</a>"
        : '<a class="btn outline sm" href="#/login">' + U().icon('user', 14) + " " + ZB.t("Sign in") + "</a>") +
      '<a class="btn sm" href="' + (signedIn ? dashHref : '#/register') + '">' +
      (signedIn ? ZB.t("Go to banking") : ZB.t("Open an account")) + '</a>' +
      ZB.i18n.switcherHtml() +
      '<button class="icon-btn burger" id="burger-btn" aria-label="' + ZB.t("Menu") + '">' + U().icon('menu', 18) + '</button>' +
      '</div></nav></div>' +

      '<div class="mobile-menu" id="mobile-menu">' + navLinks(active) +
      (signedIn ? '' : "<a href=\"#/login\">" + ZB.t("Sign in") + "</a><a href=\"#/register\"><b>" + ZB.t("Open an account") + "</b></a>") +
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
      ZB.t("Zentra") + "<span class=\"spark\">&#9679;</span></div>" +
      "<p>" + ZB.t("Zentra Bank, N.A. is a full-service digital bank offering no-fee checking, high-yield savings, debit cards and personal loans to customers across all 50 states.") + "</p>" +
      '</div>' +
      "<div class=\"mf-col\"><h4>" + ZB.t("Products") + "</h4>" +
      "<a href=\"#/personal\">" + ZB.t("Everyday Checking") + "</a><a href=\"#/personal\">" + ZB.t("Growth Savings") + "</a>" +
      "<a href=\"#/personal\">" + ZB.t("Debit cards") + "</a><a href=\"#/personal\">" + ZB.t("Personal loans") + "</a>" +
      "<a href=\"#/business\">" + ZB.t("Business banking") + "</a><a href=\"#/rates\">" + ZB.t("Rates &amp; fees") + "</a></div>" +
      "<div class=\"mf-col\"><h4>" + ZB.t("Company") + "</h4>" +
      "<a href=\"#/about\">" + ZB.t("About us") + "</a><a href=\"#/security\">" + ZB.t("Security center") + "</a>" +
      "<a href=\"#/support\">" + ZB.t("Help center") + "</a><a href=\"#/support\">" + ZB.t("Contact us") + "</a>" +
      "<a href=\"#/legal\">" + ZB.t("Careers") + "</a></div>" +
      "<div class=\"mf-col\"><h4>" + ZB.t("Legal") + "</h4>" +
      "<a href=\"#/legal\">" + ZB.t("Disclosures") + "</a><a href=\"#/legal\">" + ZB.t("Privacy notice") + "</a>" +
      "<a href=\"#/legal\">" + ZB.t("Terms of service") + "</a><a href=\"#/legal\">" + ZB.t("Accessibility") + "</a>" +
      "<a href=\"#/legal\">" + ZB.t("Customer resolution") + "</a></div>" +
      '</div>' +
      '<div class="mf-legal"><div class="mf-legal-inner">' +
      '<div class="mf-fdic">' + U().icon('shield', 16) +
      "<span>" + ZB.t("Deposits held at Zentra Bank are FDIC-insured up to $250,000 per depositor, per ownership category.") + "</span></div>" +
      "<p class=\"disclosure\">" + ZB.t("Zentra Bank, N.A. Member FDIC. Equal Housing Lender. Deposit products offered by Zentra Bank, N.A., Member FDIC. Credit products are subject to credit approval and program guidelines. Advertised rates are accurate as of today and may change at any time. Savings interest is calculated daily and credited to your account each day the bank is open. External transfer delivery times vary by receiving institution, typically 1&ndash;3 business days.") + "</p>" +
      '<div class="mf-bottom"><span>&copy; ' + yr + " " + ZB.t("Zentra Bank, N.A. All rights reserved.") + "</span>" +
      "<span><a href=\"#/legal\">" + ZB.t("Privacy") + "</a><a href=\"#/legal\">" + ZB.t("Terms") + "</a><a href=\"#/legal\">" + ZB.t("Site map") + "</a></span></div>" +
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
      "<span class=\"hero-kicker\"><svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"><path d=\"M12 22c5.5-2 8-6.5 8-12V5l-8-3-8 3v5c0 5.5 2.5 10 8 12z\"/></svg> " + ZB.t("Zentra Bank &#183; Member FDIC") + "</span>" +
      "<h1>" + ZB.t("Banking that works") + "<br>" + ZB.t("the way") + " <em>" + ZB.t("you") + "</em> " + ZB.t("do.") + "</h1>" +
      "<p class=\"lead\">" + ZB.t("No-fee checking that pays your bills, savings that earn") + " " + apy +
      ZB.t("% APY from day one, and cards you control from your phone. Open an account in about 3 minutes.") + "</p>" +
      '<div class="hero-ctas">' +
      '<a class="btn lg" href="#/register">' + U().icon('arrowRight', 16) + " " + ZB.t("Open an account") + "</a>" +
      "<a class=\"btn secondary lg\" href=\"#/personal\">" + ZB.t("Explore accounts") + "</a></div>" +
      '<div class="hero-points">' +
      '<span>' + U().icon('check', 15) + " " + ZB.t("$0 monthly fees &amp; no minimum balance — ever") + "</span>" +
      '<span>' + U().icon('check', 15) + " " + ZB.t("Interest accrues daily and is credited every day") + "</span>" +
      '<span>' + U().icon('check', 15) + " " + ZB.t("Deposits FDIC-insured up to $250,000") + "</span>" +
      '</div></div>' +

      '<div class="bank-card-scene reveal" id="card-scene">' +
      '<div class="scene-card-back"></div>' +
      '<div class="realistic-card" id="hero-card">' +
      "<div class=\"rc-top\"><div class=\"rc-brand\">" + ZB.t("Zentra") + "<small>" + ZB.t("Debit &#183; World") + "</small></div>" +
      '<svg class="rc-contactless" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2" stroke-linecap="round"><path d="M8.5 8.5a7 7 0 0 1 0 7M12 6a10.5 10.5 0 0 1 0 12M15.5 3.8a14 14 0 0 1 0 16.4"/></svg></div>' +
      '<div class="rc-chip"></div>' +
      "<div class=\"rc-num\">" + ZB.t("4020 &nbsp;•••• &nbsp;•••• &nbsp;4977") + "</div>" +
      '<div class="rc-foot">' +
      "<div><div class=\"rc-label\">" + ZB.t("Card holder") + "</div><div class=\"rc-val\">" + ZB.t("J. MILES") + "</div></div>" +
      "<div><div class=\"rc-label\">" + ZB.t("Expires") + "</div><div class=\"rc-val\">09/29</div></div>" +
      '<div class="rc-brandmark">' +U().cardBrand('visa', 22) + '</div></div>' +
      '</div>' +
      "<div class=\"scene-balance\"><span class=\"tiny muted\" style=\"display:block\">" + ZB.t("Total balance") + "</span>" +
      "<b>$13,004.26</b><span class=\"tiny up\" style=\"display:block;margin-top:2px\">" + ZB.t("&#9650; +$485 this week") + "</span></div>" +
      '</div></section>';

    var trio =
      '<div class="trio-band"><div class="trio">' +
      "<a href=\"#/personal\"><span>" + ZB.t("Checking &amp; Savings") + "<small>" + ZB.t("No monthly fees, daily interest") + "</small></span>" + U().icon('chevronRight', 17) + '</a>' +
      "<a href=\"#/business\"><span>" + ZB.t("Business banking") + "<small>" + ZB.t("Invoices, payroll &amp; FX wallets") + "</small></span>" + U().icon('chevronRight', 17) + '</a>' +
      "<a href=\"#/rates\"><span>" + ZB.t("Rates &amp; fees") + "<small>" + ZB.t("Everything in plain English") + "</small></span>" + U().icon('chevronRight', 17) + '</a>' +
      '</div></div>';

    // slim FX ticker
    var pairs = '';
    if (r && r.fx) {
      var f = r.fx;
      Object.keys(f).filter(function (c) { return c !== 'USD'; }).forEach(function (cur, i) {
        pairs += "<span class=\"fx-pair\"><b>" + ZB.t("USD /") + " " + cur + '</b>' + Number(f[cur]).toFixed(4) +
          '<span class="' + (i % 2 ? 'down-arrow">&#9660;' : 'up-arrow">&#9650;') + '</span></span>';
        pairs += '<span class="fx-pair"><b>' + cur + " " + ZB.t("/ USD") + "</b>" + (1 / f[cur]).toFixed(4) + '</span>';
      });
    }
    var ticker = pairs ?
      "<div class=\"fx-ticker\"><div class=\"fx-label\">" + ZB.t("FX desk") + "</div><div class=\"fx-track\">" +
      '<div class="fx-move">' + pairs + pairs + '</div></div></div>' : '';

    var rateBand =
      '<div class="rate-band"><div class="rate-band-inner">' +
      '<div class="rate-cell"><div class="rv">' + apy + "%</div><div class=\"rl\">" + ZB.t("Savings APY") + "</div><div class=\"rn\">" + ZB.t("Interest paid daily") + "</div></div>" +
      "<div class=\"rate-cell\"><div class=\"rv\">$0</div><div class=\"rl\">" + ZB.t("Monthly fee") + "</div><div class=\"rn\">" + ZB.t("Checking, forever") + "</div></div>" +
      '<div class="rate-cell"><div class="rv">' + apr + "%</div><div class=\"rl\">" + ZB.t("Loan APR") + "</div><div class=\"rn\">" + ZB.t("Decisions in minutes") + "</div></div>" +
      "<div class=\"rate-cell\"><div class=\"rv\">$0</div><div class=\"rl\">" + ZB.t("Min. opening deposit") + "</div><div class=\"rn\">" + ZB.t("Start with anything") + "</div></div>" +
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
      "<span class=\"eyebrow\">" + ZB.t("Why Zentra") + "</span>" +
      "<h2>" + ZB.t("An account built around your money — not our fees") + "</h2>" +
      "<p>" + ZB.t("We removed the stuff people hate about banks: surprise charges, slow transfers, and support queues.") + "</p></div>" +
      '<div class="feat-grid cols-2">' +
      feat('wallet', ZB.t("No-fee everyday checking"), ZB.t('Direct deposit hits instantly, bill pay is included, and your account number lives one tap away. No monthly maintenance, no minimum balance, no gotchas.'), '$0', ZB.t("monthly maintenance fee")) +
      feat('percent', ZB.t("High-yield savings"), ZB.t("Your idle cash earns ") + apy + ZB.t("% APY. Interest accrues every single day and lands in your balance daily — you can watch it grow."), apy + '%', ZB.t("APY, variable")) +
      feat('swap', ZB.t("Transfers that actually move"), ZB.t('Send to any Zentra customer instantly by email. External payouts to other banks arrive in 1–3 business days with clear status tracking.'), ZB.t('Instant'), ZB.t("Zentra-to-Zentra transfers")) +
      feat('card', ZB.t("Cards you command"), ZB.t('Freeze a lost card in one tap, set monthly spending limits, and issue extra virtual cards for subscriptions — free.'), ZB.t("1 tap"), ZB.t("to freeze or unfreeze")) +
      feat('target', ZB.t("Loans without the mystery"), ZB.t('See your exact monthly payment before you apply. Verified customers get decisions fast and funds land immediately on approval.'), apr + '%', ZB.t("APR, fixed terms 3–48 mo")) +
      feat('message', ZB.t("Support from humans"), ZB.t("Real people answer the inbox every day, usually within hours. No ticket mazes, no chatbot loops."), ZB.t("&lt; 4 hrs"), ZB.t("typical first reply")) +
      '</div></section>';

    var steps =
      '<section class="section"><div class="section-head reveal">' +
      "<span class=\"eyebrow\">" + ZB.t("Get started") + "</span><h2>" + ZB.t("Open your account in three steps") + "</h2></div>" +
      '<div class="steps reveal">' +
      "<div class=\"step\"><h3>" + ZB.t("Tell us about you") + "</h3><p>" + ZB.t("Name, email, and a strong password. Choose your default currency —") + " " + curList(r) + '.</p></div>' +
      "<div class=\"step\"><h3>" + ZB.t("Your checking opens instantly") + "</h3><p>" + ZB.t("A real account number is issued the moment you sign up. Fund it whenever you're ready.") + "</p></div>" +
      "<div class=\"step\"><h3>" + ZB.t("Bank from anywhere") + "</h3><p>" + ZB.t("Add savings, order a card, send money, pay bills, and track everything from one clean dashboard.") + "</p></div>" +
      '</div></section>';

    var names = [[ZB.t("Sarah K."), ZB.t("Freelance designer")], [ZB.t("Marcus T."), ZB.t("Small-business owner")], [ZB.t("Priya R."), ZB.t("Graduate student")]];
    var quotesTxt = [
      '"' + ZB.t("I moved my emergency fund here for the APY and stayed for the app. Watching interest post every morning is weirdly motivating.") + '"',
      '"' + ZB.t("Payroll goes out through bill pay, invoices get paid into checking, and I haven't paid a single fee in fourteen months.") + '"',,
      '"' + ZB.t("As a student I expected to be treated like an afterthought. Free checking, a real card, and support that answers — that's it, that's the review.") + '"'
    ];
    var quotes =
      '<section class="section tint"><div class="section-head reveal">' +
      "<span class=\"eyebrow\">" + ZB.t("Customer stories") + "</span><h2>" + ZB.t("People who switched, and stayed") + "</h2></div>" +
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
      [ZB.t("What makes Zentra different from traditional banks?"), ZB.t("Zentra was built digital-first, which means no branches to fund and no junk fees to hide. Checking is free, savings interest posts daily instead of monthly, transfers between customers settle instantly around the clock, and every control — freezing a card, setting limits, reviewing statements — lives one tap away in your dashboard.")],
      [ZB.t("What does checking actually cost?"), ZB.t("Nothing. There is no monthly maintenance fee, no minimum balance requirement, and no fee for standard transfers between Zenta accounts. The complete fee schedule lives on our Rates &amp; Fees page.")],
      [ZB.t("How does daily interest work?"), ZB.t('Savings balances earn the advertised APY divided across every day of the year. Each day, interest posts straight into your available balance — including weekends.')],
      [ZB.t("How fast are transfers?"), ZB.t("Transfers between Zentra customers arrive instantly, 24/7. Transfers to accounts at other banks typically arrive within 1–3 business days depending on the receiving institution; larger amounts include a brief compliance review for your protection.")],
      [ZB.t("Can I get a card?"), ZB.t('Yes — your first virtual debit card is free and works online immediately. A physical card ships in 5–7 business days for a one-time $5 issuance fee.')]
    ];
    var faqSec =
      '<section class="section"><div class="section-head reveal">' +
      "<span class=\"eyebrow\">" + ZB.t("Questions") + "</span><h2>" + ZB.t("Straight answers") + "</h2></div>" +
      '<div class="faq-list reveal">' + faqBlock(faqs) + '</div></section>';

    var cta =
      '<section class="cta-band"><div class="cta-inner reveal">' +
      "<h2>" + ZB.t("Ready to bank better?") + "</h2>" +
      "<p>" + ZB.t("Join thousands of customers who ditched the fees. Your account number is waiting.") + "</p>" +
      "<a class=\"btn secondary lg\" href=\"#/register\">" + ZB.t("Open your free account") + "</a></div></section>";

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
            card.style.transform = 'rotateY(' + (x * 8) + ZB.t("deg) rotateX(") + (-y * 6) + 'deg)';
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
      "<div class=\"reveal\"><span class=\"hero-kicker\">" + ZB.t("Personal banking") + "</span>" +
      "<h1>" + ZB.t("Accounts that pull their weight.") + "</h1>" +
      "<p class=\"lead\">" + ZB.t("Everything a modern household needs: free checking, savings that earn daily, cards with real controls, and honest loans.") + "</p>" +
      "<div class=\"hero-ctas\"><a class=\"btn lg\" href=\"#/register\">" + ZB.t("Open an account") + "</a>" +
      "<a class=\"btn secondary lg\" href=\"#/rates\">" + ZB.t("Compare rates") + "</a></div></div>" +
      '<div class="bank-card-scene reveal"><div class="scene-card-back"></div>' +
      "<div class=\"realistic-card\"><div class=\"rc-top\"><div class=\"rc-brand\">" + ZB.t("Zentra") + "<small>" + ZB.t("Platinum Debit") + "</small></div></div>" +
      "<div class=\"rc-chip\"></div><div class=\"rc-num\">" + ZB.t("4773 &nbsp;•••• &nbsp;•••• &nbsp;1120") + "</div>" +
      "<div class=\"rc-foot\"><div><div class=\"rc-label\">" + ZB.t("Card holder") + "</div><div class=\"rc-val\">" + ZB.t("A. STERLING") + "</div></div>" +
      "<div><div class=\"rc-label\">" + ZB.t("Expires") + "</div><div class=\"rc-val\">04/29</div></div><div class=\"rc-brandmark\">" +U().cardBrand('visa', 22) + '</div></div></div></div>' +
      '</div></section>';

    var products =
      "<section class=\"section\"><div class=\"section-head reveal\"><span class=\"eyebrow\">" + ZB.t("The lineup") + "</span>" +
      "<h2>" + ZB.t("Pick your starting point") + "</h2><p>" + ZB.t("All accounts open instantly. Mix and match freely.") + "</p></div>" +
      '<div class="feat-grid cols-2">' +
      prod('wallet', ZB.t("Everyday Checking"), ZB.t("MOST POPULAR"),
        [ZB.t("$0 monthly fee, $0 minimum balance"), ZB.t("Instant transfers to any Zentra customer"),
          ZB.t("Bill pay with 8 categories and saved payees"), ZB.t("Free virtual debit card on signup")],
        [ZB.t("Open checking"), '#/register']) +
      prod('percent', ZB.t("Growth Savings"), apy + ZB.t("% APY"),
        [ZB.t("Interest accrues daily, credited daily"), ZB.t("No withdrawal penalties or lock-ups"),
          ZB.t("Round-up friendly — move spare cash anytime"), ZB.t("Watch projections in your dashboard")],
        [ZB.t("Start saving"), '#/register']) +
      prod('card', ZB.t("Debit cards"), 'CONTROL',
        [ZB.t("Freeze/unfreeze instantly from the app"), ZB.t("Set your own monthly spending limit"),
          ZB.t("Extra virtual cards for subscriptions — free"), ZB.t("Physical card ships in 5–7 days ($5)")],
        [ZB.t("Issue a card"), '#/login']) +
      prod('target', ZB.t("Personal loans"), apr + ZB.t("% APR"),
        [ZB.t("Fixed rates, terms from 3 to 48 months"), ZB.t("See your exact payment before applying"),
          ZB.t("Funds deposited the moment you're approved"), ZB.t("Repay early anytime, no penalty")],
        [ZB.t("Check eligibility"), '#/login']) +
      '</div></section>';

    var compare =
      "<section class=\"section tint\"><div class=\"section-head reveal\"><span class=\"eyebrow\">" + ZB.t("Side by side") + "</span>" +
      "<h2>" + ZB.t("Checking vs Savings") + "</h2></div>" +
      '<div class="reveal" style="max-width:760px;margin:0 auto"><div class="table-wrap"><table class="table">' +
      "<thead><tr><th>" + ZB.t("Feature") + "</th><th>" + ZB.t("Everyday Checking") + "</th><th>" + ZB.t("Growth Savings") + "</th></tr></thead><tbody>" +
      "<tr><td><b>" + ZB.t("APY") + "</b></td><td>—</td><td class=\"up\"><b>" + apy + '%</b></td></tr>' +
      "<tr><td><b>" + ZB.t("Monthly fee") + "</b></td><td>$0</td><td>$0</td></tr>" +
      "<tr><td><b>" + ZB.t("Minimum to open") + "</b></td><td>" + ZB.t("Any amount") + "</td><td>" + ZB.t("Any amount") + "</td></tr>" +
      "<tr><td><b>" + ZB.t("Debit card") + "</b></td><td>" + ZB.t("Yes") + "</td><td>" + ZB.t("No") + "</td></tr>" +
      "<tr><td><b>" + ZB.t("Bill pay") + "</b></td><td>" + ZB.t("Yes") + "</td><td>—</td></tr>" +
      "<tr><td><b>" + ZB.t("Best for") + "</b></td><td>" + ZB.t("Spending &amp; bills") + "</td><td>" + ZB.t("Growing your buffer") + "</td></tr>" +
      '</tbody></table></div>' +
      "<div class=\"center mt-2\" style=\"text-align:center\"><a class=\"btn lg\" href=\"#/register\">" + ZB.t("Open both — takes minutes") + "</a></div></div></section>";

    var faqSec =
      "<section class=\"section\"><div class=\"section-head reveal\"><span class=\"eyebrow\">" + ZB.t("Details") + "</span>" +
      "<h2>" + ZB.t("Fine print, translated") + "</h2></div><div class=\"faq-list reveal\">" +
      faqBlock([
        [ZB.t("Are there overdraft fees?"), ZB.t('No. We simply decline transactions that exceed your available balance rather than charging $35 for the privilege.')],
        [ZB.t("Can I have multiple accounts?"), ZB.t("Up to six, across any mix of currencies (") + curList(r) + ZB.t(") — useful for travelers and freelancers billing abroad.")],
        [ZB.t("What happens if I lose my card?"), ZB.t('Tap freeze immediately; the card stops working everywhere while you decide. Unfreeze it if it turns up in the couch, or order a replacement from the same screen.')]
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
      "<div class=\"reveal\"><span class=\"hero-kicker\">" + ZB.t("Business banking") + "</span>" +
      "<h1>" + ZB.t("Cash flow, minus the friction.") + "</h1>" +
      "<p class=\"lead\">" + ZB.t("Multi-currency wallets, cheap FX, payroll-ready payments and a ledger your accountant will actually enjoy reading.") + "</p>" +
      "<div class=\"hero-ctas\"><a class=\"btn lg\" href=\"#/register\">" + ZB.t("Open a business account") + "</a>" +
      "<a class=\"btn secondary lg\" href=\"#/support\">" + ZB.t("Talk to us") + "</a></div>" +
      '<div class="mini-stats">' +
      '<div class="mini-stat"><b>' + exFee + "%</b><span>" + ZB.t("FX conversion fee") + "</span></div>" +
      '<div class="mini-stat"><b>' + U().currencyList(r && r.currencies).length + "</b><span>" + ZB.t("currencies, one login") + "</span></div>" +
      "<div class=\"mini-stat\"><b>$0</b><span>" + ZB.t("internal transfer cost") + "</span></div></div></div>" +
      '<div class="bank-card-scene reveal"><div class="scene-card-back"></div>' +
      "<div class=\"realistic-card\"><div class=\"rc-top\"><div class=\"rc-brand\">" + ZB.t("Zentra") + "<small>" + ZB.t("Business") + "</small></div></div>" +
      "<div class=\"rc-chip\"></div><div class=\"rc-num\">" + ZB.t("8810 &nbsp;•••• &nbsp;•••• &nbsp;3301") + "</div>" +
      "<div class=\"rc-foot\"><div><div class=\"rc-label\">" + ZB.t("Company") + "</div><div class=\"rc-val\">" + ZB.t("NORTHWIND LLC") + "</div></div>" +
      "<div><div class=\"rc-label\">" + ZB.t("Card holder") + "</div><div class=\"rc-val\">" + ZB.t("CFO") + "</div></div><div class=\"rc-brandmark\">" +U().cardBrand('visa', 22) + '</div></div></div></div>' +
      '</div></section>';

    function bizFeat(icon, title, text) {
      return '<div class="feat-card reveal"><div class="fc-icon">' + U().icon(icon, 20) + '</div>' +
        '<h3>' + title + '</h3><p>' + text + '</p></div>';
    }
    var feats =
      "<section class=\"section\"><div class=\"section-head reveal\"><span class=\"eyebrow\">" + ZB.t("Built for operators") + "</span>" +
      "<h2>" + ZB.t("Everything the money side needs") + "</h2></div>" +
      '<div class="feat-grid cols-2 reveal">' +
      bizFeat('layers', ZB.t("A ledger worth reading"), ZB.t('Every transaction carries category, counterparty, note and running balance. Export CSV statements for any month, any account, instantly.')) +
      bizFeat('swap', ZB.t("Pay anyone, anywhere"), ZB.t('Instant vendor payouts to other Zentra businesses, or scheduled external transfers with beneficiary book and compliance review above your configured threshold.')) +
      bizFeat('globe', ZB.t("Hold and convert FX"), ZB.t('Keep') + ' ' + curList(r, 'USD') + ZB.t(" wallets alongside dollars and convert at ") + exFee + ZB.t("% with live mid-market rates shown before you commit.")) +
      bizFeat('receipt', ZB.t("Payables without spreadsheets"), ZB.t('Categorize utilities, rent, suppliers and software. Saved payees autocomplete from history so recurring runs take seconds.')) +
      '</div></section>';

    var cta =
      '<section class="cta-band"><div class="cta-inner reveal">' +
      "<h2>" + ZB.t("Move your business banking forward") + "</h2>" +
      "<p>" + ZB.t("Open an account today and see your first month's cash flow mapped by tomorrow.") + "</p>" +
      "<a class=\"btn secondary lg\" href=\"#/register\">" + ZB.t("Get started free") + "</a></div></section>";

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
      "<span class=\"hero-kicker\">" + ZB.t("Rates &amp; fees") + "</span>" +
      "<h1>" + ZB.t("The whole price list.") + "<br>" + ZB.t("Nothing hidden.") + "</h1>" +
      "<p class=\"updated\">" + ZB.t("Rates effective as of") + " " + today + ZB.t(". All rates are variable unless marked fixed and may change with market conditions.") + "</p>" +
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

    var depositTbl = tbl(ZB.t("Deposit accounts"), [
      [ZB.t("Growth Savings APY"), '<span class="up"><b>' + f.savings_apy + '%</b></span>', ZB.t("interest calculated daily, credited daily")],
      [ZB.t("Everyday Checking APY"), '0.00%', ZB.t("spending account")],
      [ZB.t("Minimum opening deposit"), ZB.t("Any amount")],
      [ZB.t("Monthly maintenance fee — Checking"), '$0'],
      [ZB.t("Monthly maintenance fee — Savings"), '$0'],
      [ZB.t("Excess withdrawal fee (Savings)"), '$0', ZB.t("we don't do those")],
      [ZB.t("Paper statements"), '$0', ZB.t("always free, always PDF")]
    ]);

    var lendingTbl = tbl(ZB.t('Lending'), [
      [ZB.t("Personal loan APR (fixed)"), '<b>' + f.loan_apr + '%</b>', ZB.t("subject to credit approval")],
      [ZB.t("Available terms"), terms.join(', ') + ' months'],
      [ZB.t("Origination fee"), '$0'],
      [ZB.t("Prepayment penalty"), '$0', ZB.t("repay early anytime")],
      [ZB.t("Late fee grace period"), ZB.t("5 days")]
    ], ZB.t("Representative example: a $5,000 loan at ") + f.loan_apr + '% APR over 12 months = roughly ' +
      U().money(amortize(5000, f.loan_apr, 12)) + '/month.');

    var transferTbl = tbl(ZB.t("Transfers & FX"), [
      [ZB.t("Zentra-to-Zentra transfer fee"), '$0', ZB.t("instant, 24/7")],
      [ZB.t("Transfer between own accounts"), '$0'],
      [ZB.t("External bank transfer fee"), f.external_fee_pct + ZB.t("% (min $") + Number(f.external_fee_min).toFixed(2) + ')', ZB.t("arrives 1–3 business days")],
      [ZB.t("Currency exchange fee"), f.exchange_fee_pct + '%', ZB.t("mid-market rate shown upfront")],
      [ZB.t("Debit card foreign transaction"), '$0']
    ]);

    var cardsTbl = tbl(ZB.t('Cards'), [
      [ZB.t("Virtual debit card"), '$0', ZB.t("first card free, extras too")],
      [ZB.t("Physical debit card"), '$' + Number(f.card_issue_fee).toFixed(2) + ' one-time', ZB.t("ships in 5–7 business days")],
      [ZB.t("Card replacement"), '$0', ZB.t("once per year")],
      [ZB.t("ATM withdrawals (in-network)"), '$0'],
      [ZB.t("Lost card reissue"), '$' + Number(f.card_issue_fee).toFixed(2)]
    ]);

    /* --- calculators --- */
    var calcSec =
      '<section class="section tint"><div class="section-head reveal">' +
      "<span class=\"eyebrow\">" + ZB.t("Plan ahead") + "</span><h2>" + ZB.t("Do the math yourself") + "</h2>" +
      "<p>" + ZB.t("Live tools wired to today's actual rates.") + "</p></div>" +
      '<div class="calc-grid reveal">' +

      '<div class="calc-card"><h3 class="mb-2">' + U().icon('percent', 17) + " " + ZB.t("Savings growth projector") + "</h3>" +
      "<div class=\"field\"><label>" + ZB.t("Starting deposit —") + " <b id=\"sv-p-val\">" + U().money(5000) + '</b></label>' +
      '<input type="range" class="slider" id="sv-p" min="0" max="100000" step="500" value="5000" style="--fill:' + (5000 / 100000 * 100) + '%"></div>' +
      "<div class=\"field\"><label>" + ZB.t("Monthly contribution —") + " <b id=\"sv-m-val\">$200</b></label>" +
      '<input type="range" class="slider" id="sv-m" min="0" max="3000" step="25" value="200" style="--fill:' + (200 / 3000 * 100) + '%"></div>' +
      "<div class=\"field\"><label>" + ZB.t("Time horizon —") + " <b id=\"sv-y-val\">" + ZB.t("5 years") + "</b></label>" +
      '<input type="range" class="slider" id="sv-y" min="1" max="30" step="1" value="5" style="--fill:' + (4 / 29 * 100) + '%"></div>' +
      '<div class="calc-out"><div class="big" id="sv-out">—</div>' +
      "<div class=\"sub\" id=\"sv-sub\">" + ZB.t("at") + " " + f.savings_apy + ZB.t("% APY compounded daily") + "</div></div></div>" +

      '<div class="calc-card"><h3 class="mb-2">' + U().icon('target', 17) + " " + ZB.t("Loan payment estimator") + "</h3>" +
      "<div class=\"field\"><label>" + ZB.t("Loan amount —") + " <b id=\"ln-a-val\">" + U().money(8000) + '</b></label>' +
      '<input type="range" class="slider" id="ln-a" min="500" max="40000" step="500" value="8000" style="--fill:' + ((8000 - 500) / 39500 * 100) + '%"></div>' +
      "<div class=\"field\"><label>" + ZB.t("Term") + "</label><select class=\"input\" id=\"ln-t\">" +
      terms.map(function (t) { return '<option value="' + t + '"' + (t === 24 ? ' selected' : '') + '>' + t + " " + ZB.t("months") + "</option>"; }).join('') +
      "</select><span class=\"hint\">" + ZB.t("Fixed") + " " + f.loan_apr + ZB.t("% APR") + "</span></div>" +
      '<div class="calc-out"><div class="big" id="ln-out">—</div>' +
      "<div class=\"sub\" id=\"ln-sub\">" + ZB.t("per month · estimated") + "</div></div></div>" +

      '</div></section>';

    var disc =
      '<div class="info-page" style="padding-top:0"><p class="tiny faint" style="line-height:1.8">' +
      ZB.t("Disclosure: Annual Percentage Yield (APY) is accurate as of ") + today + ZB.t(" and may change after account opening. ") +
      ZB.t('No minimum deposit required to open or earn the advertised APY on Growth Savings. Loan APR shown assumes verified identity, ') +
      'on-time repayment history and is subject to credit review; your rate may differ. Fees may reduce earnings on deposit accounts. ' +
      ZB.t("Calculator results are estimates for illustration only and do not constitute an offer of credit.") + "</p></div>";

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
          document.getElementById('sv-sub').innerHTML = ZB.t("You contribute ") + U().money(res.put) +
            ' · <b class="up">' + U().money(res.earned) + " " + ZB.t("interest earned") + "</b> " + ZB.t("at") + " " + f.savings_apy + ZB.t("% APY");
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
          document.getElementById('ln-sub').textContent = U().money(mp * T) + ZB.t(" total over ") + T +
            ZB.t(" months (") + U().money(mp * T - A) + ZB.t(" interest) · estimated");
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
      "<span class=\"hero-kicker\" style=\"justify-content:center;display:inline-flex\">" + ZB.t("Security center") + "</span>" +
      "<h1>" + ZB.t("Your money, locked down properly.") + "</h1>" +
      "<p class=\"lead\" style=\"margin-left:auto;margin-right:auto\">" + ZB.t("Security isn't a feature we bolt on — it's how every layer of the bank is built, checked and audited.") + "</p>" +
      '</div></section>';

    var secBand =
      '<section class="sec-band"><div class="sec-band-inner">' +
      '<div class="section-head reveal" style="text-align:left;margin-bottom:8px">' +
      "<span class=\"eyebrow\" style=\"color:#7fb3dd\">" + ZB.t("Defense in depth") + "</span>" +
      "<h2 style=\"color:#fff\">" + ZB.t("Five layers between a stranger and your balance") + "</h2></div>" +
      '<div class="sec-cols reveal">' +
      '<div class="sec-col">' + U().icon('key', 24) + "<h3>" + ZB.t("Passwords we can't leak") + "</h3>" +
      "<p>" + ZB.t("Credentials are hashed with PBKDF2-HMAC-SHA256 across 120,000 rounds with per-user salts. Even we can't read them — verification is one-way.") + "</p></div>" +
      '<div class="sec-col">' + U().icon('shield', 24) + "<h3>" + ZB.t("Sessions you control") + "</h3>" +
      "<p>" + ZB.t("Every device gets its own revocable session showing device and IP. Suspicious activity? Kill every session except yours in one click.") + "</p></div>" +
      '<div class="sec-col">' + U().icon('eyeOff', 24) + "<h3>" + ZB.t("Frozen means frozen") + "</h3>" +
      "<p>" + ZB.t("Suspending an account revokes access instantly platform-wide. Card freeze applies everywhere the moment you tap.") + "</p></div>" +
      '<div class="sec-col">' + U().icon('layers', 24) + "<h3>" + ZB.t("A tamper-evident ledger") + "</h3>" +
      "<p>" + ZB.t("Money movements append signed entries with running balances. Corrections happen as mirrored reversals — history is never silently edited.") + "</p></div>" +
      '<div class="sec-col">' + U().icon('users', 24) + "<h3>" + ZB.t("Humans reviewing risk") + "</h3>" +
      "<p>" + ZB.t("Large external payouts pause for staff approval. Identity documents are reviewed before limits lift. Every staff action is audit-logged forever.") + "</p></div>" +
      '<div class="sec-col">' + U().icon('server', 24) + "<h3>" + ZB.t("Atomic everything") + "</h3>" +
      "<p>" + ZB.t("Balances persist through atomic file writes — a crash mid-transfer cannot leave half a transaction behind.") + "</p></div>" +
      '</div>' +
      '<div class="sec-badge-row reveal">' +
      '<span class="sec-badge">' + U().icon('lock', 13) + " " + ZB.t("TLS everywhere") + "</span>" +
      '<span class="sec-badge">' + U().icon('database', 13) + " " + ZB.t("Encrypted backups") + "</span>" +
      '<span class="sec-badge">' + U().icon('clock', 13) + " " + ZB.t("Full audit trail") + "</span>" +
      '<span class="sec-badge">' + U().icon('check', 13) + " " + ZB.t("KYC on every customer") + "</span>" +
      '</div></div></section>';

    var tips =
      "<section class=\"section\"><div class=\"section-head reveal\"><span class=\"eyebrow\">" + ZB.t("Your part") + "</span>" +
      "<h2>" + ZB.t("Habits that keep you safe") + "</h2></div>" +
      '<div class="steps reveal">' +
      "<div class=\"step\"><h3>" + ZB.t("Use a unique passphrase") + "</h3><p>" + ZB.t("Never reuse your email password here. Length beats complexity — four random words win.") + "</p></div>" +
      "<div class=\"step\"><h3>" + ZB.t("Check your sessions") + "</h3><p>" + ZB.t("Settings → Active sessions shows every signed-in device. See something odd? Revoke it.") + "</p></div>" +
      "<div class=\"step\"><h3>" + ZB.t("Verify beneficiaries twice") + "</h3><p>" + ZB.t("Email addresses are easy to spoof. Confirm large external payout details over a second channel.") + "</p></div>" +
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
      "<span class=\"hero-kicker\" style=\"justify-content:center;display:inline-flex\">" + ZB.t("Support") + "</span>" +
      "<h1>" + ZB.t("How can we help?") + "</h1>" +
      "<p class=\"lead\" style=\"margin-left:auto;margin-right:auto\">" + ZB.t("Real humans, real answers — usually within four hours during business days.") + "</p>" +
      '</div></section>';

    var channels =
      '<section class="section" style="padding-bottom:34px"><div class="feat-grid cols-2 reveal">' +
      '<div class="feat-card"><div class="fc-icon">' + U().icon('message', 20) + '</div>' +
      "<h3>" + ZB.t("Message us") + "</h3><p>" + ZB.t("Use the form below — it lands directly in our team inbox and you'll hear back by email.") + "</p></div>" +
      '<div class="feat-card"><div class="fc-icon">' + U().icon('mail', 20) + '</div>' +
      "<h3>" + ZB.t("Email") + "</h3><p><a href=\"mailto:" + email + '">' + email + "</a><br><span class=\"tiny faint\">" + ZB.t("Mon–Fri, 8am–8pm ET") + "</span></p></div>" +
      '</div></section>';

    var formSec =
      '<section class="section" style="padding-top:10px"><div class="split"><div class="card pad-lg reveal">' +
      "<div class=\"card-title\"><h3>" + ZB.t("Send a message") + "</h3></div>" +
      '<form data-form="support">' +
      '<div class="grid cols-2" style="gap:12px">' +
      "<div class=\"field\"><label>" + ZB.t("Your name") + "</label><input class=\"input\" name=\"name\" required placeholder=\"Alex Rivera\"></div>" +
      "<div class=\"field\"><label>" + ZB.t("Email") + "</label><input class=\"input\" type=\"email\" name=\"email\" required placeholder=\"you@example.com\"></div></div>" +
      "<div class=\"field\"><label>" + ZB.t("Subject") + "</label><input class=\"input\" name=\"subject\" required maxlength=\"120\" placeholder=\"Question about my transfer\"></div>" +
      "<div class=\"field\"><label>" + ZB.t("Message") + "</label><textarea class=\"input\" name=\"body\" required maxlength=\"1500\" placeholder=\"Tell us what happened — include dates and amounts if relevant.\"></textarea></div>" +
      '<button class="btn block" type="submit">' + U().icon('send', 15) + " " + ZB.t("Send message") + "</button>" +
      '</form></div>' +
      "<div class=\"card reveal\"><div class=\"card-title\"><h3>" + ZB.t("Quick answers") + "</h3></div>" +
      faqBlock([
        [ZB.t("When will my external transfer arrive?"), ZB.t("Typically 1–3 business days. Large amounts may pause briefly for a compliance review — you'll get a notification either way.")],
        [ZB.t("How do I reset my password?"), ZB.t("Use “Forgot?” on the sign-in screen, or sign in and change it under Settings → Password.")],
        [ZB.t("My card was declined"), ZB.t("First, check your monthly limit under Cards and confirm the card isn't frozen. Still stuck? Message us with the merchant name.")],
        [ZB.t("How do interest payments appear?"), ZB.t("As “Savings interest” entries in your transaction history, posted once a day.")],
        [ZB.t("Can I download statements?"), ZB.t("Yes — Statements tab lets you pick any account and month, then export CSV or print a PDF-ready view.")]
      ]) + '</div></div></section>';

    var html = pubShell('#/support', heroLite + channels + formSec);
    return {
      html: html,
      mount: function () {
        bindPubChrome(); bindFaq('.split');
        ZB.forms.support = async function (data, formEl) {
          try {
            await ZB.api.post('/api/public/support', data);
            U().toast(ZB.t("Message sent — we'll reply to ") + data.email + ZB.t(" shortly."));
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
      "<span class=\"hero-kicker\" style=\"justify-content:center;display:inline-flex\">" + ZB.t("About Zentra") + "</span>" +
      "<h1>" + ZB.t("The bank that behaves like software.") + "</h1>" +
      "<p class=\"lead\" style=\"margin-left:auto;margin-right:auto\">" + ZB.t("We started Zentra because banking felt like it was designed for the bank's convenience, not yours. So we rebuilt it: no junk fees, daily interest, instant controls, and support that replies like a colleague, not a call center.") + "</p>" +
      '</div></section>';

    var band =
      '<div class="rate-band"><div class="rate-band-inner">' +
      '<div class="rate-cell"><div class="rv">' + (stats.customers || 10).toLocaleString() + "+</div><div class=\"rl\">" + ZB.t("Customers") + "</div><div class=\"rn\">" + ZB.t("and growing weekly") + "</div></div>" +
      '<div class="rate-cell"><div class="rv">' + U().compact(stats.volume_usd || 0) + "</div><div class=\"rl\">" + ZB.t("Processed volume") + "</div><div class=\"rn\">" + ZB.t("across all currencies") + "</div></div>" +
      "<div class=\"rate-cell\"><div class=\"rv\">99.99%</div><div class=\"rl\">" + ZB.t("Platform uptime") + "</div><div class=\"rn\">" + ZB.t("last 12 months") + "</div></div>" +
      "<div class=\"rate-cell\"><div class=\"rv\">" + ZB.t("&lt; 4 hrs") + "</div><div class=\"rl\">" + ZB.t("Median support reply") + "</div><div class=\"rn\">" + ZB.t("during business hours") + "</div></div>" +
      '</div></div>';

    var body =
      '<section class="info-page">' +
      "<h3>" + ZB.t("What we believe") + "</h3>" +
      "<p>" + ZB.t("Fees should be visible before you're charged. Interest should start working on day one, not after a minimum-balance dance. Losing your card should cost one tap, not a phone tree and a week. And when something goes wrong, a person should tell you what happened and what happens next.") + "</p>" +
      "<h3>" + ZB.t("How we operate") + "</h3>" +
      "<p>" + ZB.t("Zentra runs on a simple principle: the ledger is the truth. Every deposit, transfer, fee and interest posting is an immutable entry with a running balance — so when you ask \"where did my money go\", the answer is exact, timestamped and exportable. Our operations team reviews every large outbound transfer, every identity document, and every loan application personally.") + "</p>" +
      "<h3>" + ZB.t("Where we're going") + "</h3>" +
      "<p>" + ZB.t("Next up: joint accounts, scheduled recurring transfers, and richer spending analytics. Have a feature request? The Support page goes straight to the people building this thing.") + "</p>" +
      '<div class="cta-band mt-3" style="border-radius:var(--r-md)"><div class="cta-inner" style="padding:38px 26px">' +
      "<h2 style=\"font-size:1.4rem\">" + ZB.t("Come bank with us") + "</h2>" +
      "<a class=\"btn secondary mt-2\" href=\"#/register\">" + ZB.t("Open your account") + "</a></div></div>" +
      '</section>';

    var html = pubShell('#/about', heroLite + band + body);
    return { html: html, mount: function () { bindPubChrome(); } };
  }

  /* ========================================================== LEGAL */
  async function legal() {
    var today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    var page =
      '<div class="info-page">' +
      "<h1>" + ZB.t("Legal center") + "</h1>" +
      "<p class=\"updated\">" + ZB.t("Last updated") + " " + today + " " + ZB.t("&#183; Zentra Bank, N.A. &#183; Member FDIC") + "</p>" +

      "<h3>" + ZB.t("Deposit account agreement (summary)") + "</h3>" +
      "<p>" + ZB.t("Deposits are held at Zentra Bank, N.A., Member FDIC, insured to the maximum allowed by law ($250,000 per depositor per ownership category). You are responsible for transactions initiated with your credentials; report unauthorized activity promptly.") + "</p>" +

      "<h3>" + ZB.t("Truth in Savings disclosure") + "</h3>" +
      "<p>" + ZB.t("The Annual Percentage Yield (APY) on Growth Savings is variable and may change after account opening. Interest is calculated using the daily balance method: the applicable daily rate is APY ÷ 366 applied to the collected balance each calendar day, credited to the account daily. Fees may reduce earnings. No minimum balance is required to open or obtain the advertised APY.") + "</p>" +

      "<h3>" + ZB.t("Privacy notice") + "</h3>" +
      "<p>" + ZB.t("We collect the information necessary to provide banking services: identity data, contact details, transaction records and device metadata for security. We do not sell personal information. Data is stored encrypted-at-rest in our primary datastore and replicated to encrypted backups. You may request export or deletion of your data via Support, subject to record-retention obligations that apply to financial institutions.") + "</p>" +

      "<h3>" + ZB.t("Electronic communications consent") + "</h3>" +
      "<p>" + ZB.t("By opening an account you consent to receive statements, disclosures and legally required notices electronically. Paper copies are available on request at no charge.") + "</p>" +

      "<h3>" + ZB.t("Error resolution") + "</h3>" +
      "<p>" + ZB.t("If you believe a transaction is wrong, contact Support immediately. We will investigate within two business days of hearing from you and correct any proven error, including crediting applicable interest. During investigation, provisional credit may be applied for eligible claims.") + "</p>" +

      "<h3>" + ZB.t("Lending disclosures") + "</h3>" +
      "<p>" + ZB.t("All credit products are subject to application, verification and credit approval. The advertised APR assumes excellent credit and automatic repayment. Representative example: $8,000 loan at 9.90% APR repaid over 24 months = approximately $369/month; total cost approximately $8,861. Late payments may incur fees after the 5-day grace period and affect future borrowing terms.") + "</p>" +

      "<h3>" + ZB.t("Trademarks & accessibility") + "</h3>" +
      "<p>" + ZB.t("Zentra and the Z-mark are trademarks of Zentra Bank, N.A. This site aims to conform to WCAG 2.1 AA; if you encounter an accessibility barrier, tell us at Support and we will fix it.") + "</p>" +

      "<h3>" + ZB.t("Regulatory information") + "</h3>" +
      "<p>" + ZB.t("Zentra Bank, N.A. is a national bank, Member FDIC and Equal Housing Lender. Deposits are insured to the maximum allowed by law.") + "</p>" +
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
      "<h1>" + ZB.t("Welcome back") + "</h1>" +
      "<p class=\"auth-sub\">" + ZB.t("Sign in to your Zentra accounts") + "</p>" +
      '<div class="err-line hidden" id="lg-err"></div>' +
      '<form data-form="login" novalidate>' +
      "<div class=\"field\"><label>" + ZB.t("Email address") + "</label>" +
      '<input class="input" type="email" name="email" required autocomplete="username" placeholder="you@example.com"></div>' +
      "<div class=\"field\"><label>" + ZB.t("Password") + "</label>" +
      '<input class="input" type="password" name="password" required autocomplete="current-password" placeholder="' + ZB.t("Your password") + '"></div>' +
      "<button class=\"btn lg block\" type=\"submit\">" + ZB.t("Sign in securely") + " " + U().icon('lock', 14) + '</button></form>' +
      "<p class=\"auth-note\">" + ZB.t("New to Zentra?") + " <a href=\"#/register\">" + ZB.t("Open an account") + "</a> &#183; " +
      "<a href=\"#/support\">" + ZB.t("Forgot password?") + "</a></p>" +
      '</div></div>';

    return {
      html: html,
      mount: function () {
        var err = document.getElementById('lg-err');
        function showErr(m) { err.textContent = m; err.classList.remove('hidden'); }
        ZB.forms.login = function (data) {
          err.classList.add('hidden');
          if (!data.email.trim() || !data.password) return showErr(ZB.t("Enter your email and password."));
          return ZB.api.post('/api/auth/login', {
            email: data.email.trim(), password: data.password
          }).then(function (r) {
            ZB.api.setToken(r.token);
            ZB.state.user = r.user;
            ZB.state.boot = null;
            U().toast(ZB.t("Welcome back, ") + r.user.name.split(' ')[0] + '!');
            location.hash = ZB.homeFor(r.user);
          }).catch(function (ex) { showErr(ex.message || ZB.t("Sign-in failed.")); });
        };
      }
    };
  }

  /* ======================================================= REGISTER */
  async function register() {
    var boot = await fetchBoot().catch(function () { return null; });
    var curs = U().currencyList(boot && boot.currencies);

    var html =
      '<div class="auth-page">' +
      '<div class="auth-card wide">' +
      '<div class="auth-logo">' + brandHtml() + '</div>' +
      "<h1>" + ZB.t("Open your account") + "</h1>" +
      "<p class=\"auth-sub\">" + ZB.t("About 3 minutes. No credit check for deposit accounts.") + "</p>" +
      '<div class="err-line hidden" id="rg-err"></div>' +
      '<form data-form="register" novalidate>' +
      "<div class=\"field\"><label>" + ZB.t("Full legal name") + "</label>" +
      '<input class="input" name="name" required minlength="3" placeholder="Jordan Miles"></div>' +
      "<div class=\"field\"><label>" + ZB.t("Email address") + "</label>" +
      '<input class="input" type="email" name="email" required autocomplete="email" placeholder="you@example.com"></div>' +
      "<div class=\"field\"><label>" + ZB.t("Create password") + "</label>" +
      '<input class="input" type="password" name="password" required id="rg-pw" autocomplete="new-password" placeholder="' + ZB.t("At least 8 characters") + '">' +
      "<div class=\"pw-meter\"><i id=\"pw-bar\"></i></div><div class=\"pw-hint\" id=\"pw-hint\">" + ZB.t("Use 8+ characters mixing letters, numbers &amp; symbols.") + "</div></div>" +
      "<div class=\"field\"><label>" + ZB.t("Default currency") + "</label><select class=\"input\" name=\"currency\">" +
      curs.map(function (c) { return '<option value="' + c.code + '"' + (c.code === 'USD' ? ' selected' : '') + '>' +
        c.code + ' — ' + c.name + '</option>'; }).join('') +
      "</select><span class=\"hint\">" + ZB.t("You can open wallets in other currencies later too.") + "</span></div>" +
      "<div class=\"field\"><label>" + ZB.t("4-digit transaction PIN") + "</label>" +
      '<input class="input pin-input" type="password" name="pin" required inputmode="numeric" ' +
      'pattern="[0-9]{4}" maxlength="4" autocomplete="off" placeholder="••••" style="text-align:center;letter-spacing:10px">' +
      "<span class=\"hint\">" + ZB.t("You'll enter this to authorize transfers and payments — like your card PIN at an ATM.") + "</span></div>" +
      '<button class="btn lg block" type="submit">' + U().icon('check', 15) + " " + ZB.t("Create my account") + "</button></form>" +
      "<p class=\"auth-note\">" + ZB.t("By continuing you agree to our") + " <a href=\"#/legal\">" + ZB.t("Terms") + "</a> " + ZB.t("and") + " " +
      "<a href=\"#/legal\">" + ZB.t("Privacy Notice") + "</a>.<br>" + ZB.t("Already a customer?") + " <a href=\"#/login\">" + ZB.t("Sign in") + "</a></p>" +
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
          var conf = [[12, '#c22f2f', ZB.t("Too weak")], [34, '#d97706', ZB.t('Weak')], [58, '#e8a33d', ZB.t('Fair')], [82, '#2fa860', ZB.t('Good')], [100, '#137333', ZB.t('Strong')]][Math.max(0, score - 1)] || [0, '#c22f2f', ''];
          bar.style.width = conf[0] + '%';
          bar.style.background = conf[1];
          hint.textContent = v ? 'Strength: ' + conf[2] + (score < 3 ? ZB.t(" — add length or variety.") : ZB.t(" — nice.")) :
            ZB.t("Use 8+ characters mixing letters, numbers & symbols.");
        });
        ZB.forms.register = function (data) {
          err.classList.add('hidden');
          if (!/^\d{4}$/.test(data.pin || '')) {
            err.textContent = ZB.t("Your transaction PIN must be exactly 4 digits.");
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
            U().toast(ZB.t("Account opened — welcome to Zentra, ") + r.user.name.split(' ')[0] + '! 🎉');
            location.hash = '#/app';
          }).catch(function (ex) {
            err.textContent = ex.message || ZB.t("Could not create account.");
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
