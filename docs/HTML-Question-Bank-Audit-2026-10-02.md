# HTML Question Bank Audit — 2026-10-02

**Status: draft for manual review — nothing seeded, no DB writes made.**

## Methodology

All 315 Active HTML questions (across 13 topics, both Trivia and General) were read in full by four parallel review passes, one per topic cluster, each given the exact Question Quality Policy text below and instructed to flag violations, find duplicates, identify genuine concept gaps, and draft new questions only where a concept is truly missing — never to pad a topic toward a round number. This mirrors the methodology used for the CSS Question Bank Audit (`docs/CSS-Question-Bank-Audit-2026-10-02.md`), whose findings and fixes are already live.

**CodeMerit Question Quality Policy** (applied verbatim):
- Trivia: no length-tell (correct option must not be conspicuously longer/more detailed than distractors); plausible distractors (real misconceptions, not absurd filler); the correct option's `comment` should teach the "why," not restate the option; natural (not forced) difficulty leveling; no duplicates.
- General: `answer` must be real HTML using only `p, strong, em, u, a, ul, ol, li, h3, h4, blockquote, pre, code, br, hr`; any literal `<`, `>`, `&` meant to be read as text must be entity-escaped; neutral/collective voice; full sentences; acronyms spelled out on first use; genuinely informative (2-4 sentences teaching the real mechanism), not a bare restatement of the question.

## Executive Summary

| Metric | Value |
|---|---|
| Questions audited | 315 (13 topics, 2 tracks) |
| Topics covered | 13 / 13 |
| Critical/systemic bug categories | 6 |
| Rows touched by the unescaped-tag rendering bug | **44** |
| Rows with the "NULL comment" systemic gap | **~230 of ~250 Trivia questions (effectively the entire Trivia bank)** |
| Mis-tagged / wrong-topic questions | 5 |
| Shuffled/mismatched hints | 10 |
| Near-duplicate pairs found | 9 |
| Length-tell violations found | ~30+ questions |
| Draft new questions proposed | 46 |

**Headline finding:** HTML's problems are structural and systemic, not conceptual. Content accuracy across the subject is strong (only one outright wrong-answer bug, Q455), and concept coverage is solid everywhere except one clear outlier — **web-components, at only 10 Active questions versus 24-28 for every other topic**. The real work here is: (1) a rendering bug where literal HTML tag names written in prose (e.g. "the `<img>` tag") are left unescaped and get swallowed as real markup — found in **44 rows**, several of which render *live* broken embeds (an actual cross-origin iframe, a live clickable link, a broken image) inside the quiz itself; (2) **every single Trivia question's correct-option `comment` is NULL** across all four clusters — the "teach the why" policy rule is unmet almost bank-wide; and (3) five questions are simply filed under the wrong topic.

## Critical Data Bugs

### 1. Unescaped HTML tag names in prose — 44 rows, rendering bug class

The exact same bug fixed on 2 CSS rows this week exists far more pervasively in HTML, where tag names are mentioned by name constantly. A visibly older authoring batch never adopted the `&lt;code&gt;&amp;lt;tag&amp;gt;&lt;/code&gt;` convention that a newer batch uses correctly — the older rows write bare `<div>`, `<a>`, `<img>` etc. directly in `question`/`answer` prose, which a renderer swallows as real markup instead of showing as visible text.

**Worst cases (render *live*, broken content, not just missing text):**
- **Q3204** (embedding-content…, General) — embeds a real `<iframe src="https://widget.example.com">` unescaped; a renderer would attempt to actually load that cross-origin iframe inline in the quiz.
- **Q3186, Q3188** (links-and-navigation, General) — contain real `<a href=...>Partner Resources</a>` / `<a href="javascript:void(0)" onclick=...>Delete</a>` unescaped; render as live clickable links inside the question text.
- **Q3193** (images-and-multimedia, General) — contains a real unescaped `<div class="hero"><img src=... alt=...></div>` code sample; renders as a live (broken) image embed.

**Full row list by topic:**
- embedding-content-iframes-external-me: Q417, Q420, Q423, Q3250, Q3204, Q3205, Q5982, Q5984 (8 rows)
- links-and-navigation: Q180, Q190, Q3186, Q3187, Q3188 (5 rows)
- lists-and-tables: Q191, Q193, Q194, Q196, Q3189, Q3190, Q3191, Q5967, Q5969 (9 rows)
- images-and-multimedia: Q336, Q338, Q341, Q343, Q3192, Q3193, Q3194, Q5966 (8 rows)
- forms-and-input-elements: Q161, Q164, Q169, Q170, Q3196, Q3197, Q5970, Q5971, Q6001, Q6002 (10 rows)
- semantic-html: Q5976, Q5978, Q6004 (3 rows)
- html-document-structure: Q3180 (1 row — confirmed live instance, `<title>`/`<head>`/`<body>` vanish on render)
- introduction-to-html: Q3178 (flat plain-text, same formatting-violation family, no tags to escape)

Fix pattern is mechanical (wrap in `&lt;p&gt;`, escape tag mentions as `&amp;lt;tag&amp;gt;` inside `&lt;code&gt;`), matching the already-correct sibling rows in the same topics — but needs a script pass given the volume, not manual spot-fixes.

### 2. Factually wrong / self-contradicting correct answer

- **Q455** (metadata-and-seo-basics): asks "which part of HTML metadata is most visible to users on search engines?" — correct option is marked `<meta name="description">`, but the stored **hint contradicts this**: *"It's the tag whose text shows as a clickable search result title"* — that's `<title>`, not the description snippet. This is a real mis-marked-correct-option bug, not a style issue.

### 3. Topic miscategorization — 5 questions filed under the wrong topic

- **Q216** (tagged `introduction-to-html`) — not an HTML question at all; it's a JavaScript `break`-statement question, inflating this topic's Active count artificially.
- **Q451** (tagged `forms-validation-and-attributes`) — entirely about `<title>` and SEO; belongs in `html-document-structure` or `introduction-to-html`.
- **Q422** (tagged `semantic-html`) — entirely about `<embed>`; belongs in `embedding-content-iframes-external-me` (its ID even sits inside that topic's own ID range, suggesting a `question_topic` mis-link). Also carries a questionable factual claim (calling `<embed>` "more flexible" than `<iframe>`/`<object>`/`<video>`, which is arguable at best — `<embed>` is the more limited legacy tag).
- **Q462, Q463** (tagged `metadata-and-seo-basics`) — both about form-input validation (`pattern`, `minlength`), zero connection to metadata/SEO.
- **Q362** (tagged `links-and-navigation`) — about semantic sectioning elements (`<section>`/`<article>`/`<aside>`), not links at all.

### 4. Shuffled / mismatched hints — 10 rows, two separate incidents

- **images-and-multimedia** (4-row rotation, same batch as a length-tell cluster below): Q340, Q345, Q347, Q349 each have another one of these four's hint, not their own. Correct remap: 340→347's hint, 345→349's hint, 347→345's hint, 349→340's hint.
- **accessibility-in-html** (6 rows, hints clearly belong elsewhere): Q426, Q429, Q432, Q440, Q442, Q443 — each hint describes a different concept than its own question (e.g. Q426 is about the `for` attribute but has the alt-text hint; Q429 is about alt text but has the `for`-attribute hint).
- **Q479** (forms-validation-and-attributes) — hint ("Every listed word is exactly five letters") is nonsensical for a regex-pattern question; looks like a copy-paste leftover from an unrelated question.

### 5. Mojibake — not found

A live scan (byte/`BINARY LIKE` based, to avoid the accent-insensitive-collation false positives that an earlier naive scan produced) found zero genuine mojibake across all 315 rows. Consistent with the CSS audit's finding that this bug class is largely resolved/was a false alarm.

### 6. Truncated comments — not applicable

No `question_option.comment` truncation found, because almost none of them are populated at all (see the systemic finding below) — there's nothing to truncate.

## Systemic Violation: Trivia option comments are NULL almost bank-wide

All four independent review passes confirmed the same thing on their own clusters: **the correct option's `comment` field is NULL on effectively every Trivia question in the HTML subject.** This is Quality Policy rule 3 ("the comment should teach the why") failing not on scattered rows but across the entire Trivia population — roughly 230+ of the subject's ~250 Trivia questions. This single finding is larger in impact than any individual content bug and should be the top priority once this document is reviewed — likely via the same kind of scripted backfill pass used for the CSS bank's missing-comment fixes, just at HTML's much larger scale.

## Per-Topic Findings

### introduction-to-html (25 Active, including the miscategorized Q216 — 24 legitimate)
- **Violations:** Q216 (wrong subject, see Critical Bugs #3), Q3178 (flat plain-text General answer, zero HTML), length-tell on Q5927/Q5928/Q5929/Q5931 (correct option 1.5-3x longer than distractors), mild mis-leveling on Q143/Q5952 (borderline, not clear-cut).
- **Near-duplicates:** Q141 ↔ Q3226 (both test "HTML provides structure," no differentiating angle — true duplicate). Soft overlap only: Q156 ↔ Q3177 (doctype/quirks-mode, different format).
- **Concept gaps:** the concept of an HTML *attribute* itself (tag vs. element vs. attribute vs. value) is never explicitly taught; attribute-value case-sensitivity (vs. tag/attribute-name case-insensitivity) is untested.

### html-document-structure (26 Active)
- **Violations:** Q3180 (confirmed unescaped-tag rendering bug, Critical Bugs #1), Q158 (mis-leveled Advanced for basic `<h1>` recall), Q6000 (unexpanded acronyms DNS/TCP/TLS).
- **Near-duplicates:** flagged for cross-check against metadata-and-seo-basics — Q154 ↔ Q453 (charset), Q5932 ↔ Q448/Q457 (viewport meta tag, a 3-way overlap once cluster 4's findings are included).
- **Concept gaps:** `defer` vs `async` script timing (never directly tested despite being name-dropped in another answer); `<noscript>` fallback mechanism (entirely uncovered).

### text-and-formatting-elements (24 Active)
- **Violations:** Q178 (clearest length-tell in this cluster — correct option 2-3x longer), Q5944 (length-tell), Q3232 (mis-leveled Advanced for trivial `<u>` recall).
- **Near-duplicates:** Q176 ↔ Q178 (soft overlap, both hinge on `<i>` carrying no semantic weight).
- **Concept gaps:** `<small>`'s HTML5-redefined semantic meaning (fine print/side comments, not just smaller font) is only ever a wrong-answer distractor elsewhere; `<sup>` is never the correct answer anywhere (only `<sub>` is taught directly).

### links-and-navigation (24 Active, including miscategorized Q362 — 23 legitimate)
- **Violations:** Q362 (wrong topic, Critical Bugs #3), Q180/Q190/Q3186/Q3187/Q3188 (unescaped-tag bug, Critical Bugs #1), Q190 (doesn't clarify its "invalid" framing is HTML4/XHTML-specific, not still true in HTML5).
- **Concept gaps:** `<nav>` as a landmark element (never itself the subject of a question); skip links / "skip to main content" pattern (entirely uncovered accessibility technique); `rel="nofollow"` (only `noopener noreferrer` is tested today).

### lists-and-tables (24 Active)
- **Violations:** Q191/Q193/Q194/Q196/Q3189/Q3190/Q3191/Q5967/Q5969 (unescaped-tag bug, Critical Bugs #1), Q202 (length-tell, correct option 2x+ longer).
- **Concept gaps:** `list-style: none` can silently strip the implicit ARIA `list`/`listitem` role in Safari/VoiceOver (a real, concrete accessibility gotcha, entirely uncovered); `<li value="">` resetting the running `<ol>` counter.

### images-and-multimedia (24 Active)
- **Violations:** Q336/Q338/Q341/Q343/Q3192/Q3193/Q3194/Q5966 (unescaped-tag bug, including the live-broken-embed case, Critical Bugs #1), Q340/Q345/Q347/Q349 (shuffled hints, Critical Bugs #4, same 4 rows also carry the length-tell issue below), Q336's distractor "desk" (looks like a typo for "desc"), Q350 (frames `style="max-width:100%"` as "the HTML attribute" when the actual lever is CSS — mildly misleading).
- **Near-duplicates:** Q336 ↔ Q341 — true duplicate, both test the `<img>` `alt` attribute with no differentiation.
- **Concept gaps:** `width`/`height` attributes preventing layout shift (CLS) is uncovered; `<figure>`/`<figcaption>` semantic grouping is entirely uncovered; fallback content inside `<video>`/`<audio>` for unsupported browsers is uncovered.

### forms-and-input-elements (27 Active)
- **Violations:** Q161/Q164/Q169/Q170/Q3196/Q3197/Q5970/Q5971/Q6001/Q6002 (unescaped-tag bug, Critical Bugs #1 — the largest single-topic count), Q165 (hint points at the *excluded* answer rather than the real one).
- **Concept gaps:** `required` attribute / native HTML5 validation (entirely uncovered); GET vs POST semantic/security distinction (only the `method` attribute's existence is tested, not its values' consequences); `maxlength` (uncovered).

### semantic-html (28 Active, including miscategorized Q422 — 27 legitimate)
- **Violations:** Q422 (wrong topic + questionable claim, Critical Bugs #3), Q5976/Q5978/Q6004 (unescaped-tag bug, Critical Bugs #1), Q3198 (unspelled "ARIA" — the policy's own example acronym), Q3206 (unspelled "DOM"/"postMessage API"), Q367 (length-tell), Q369/Q371 (vague/mushy correct answers), Q365 (mis-leveled — distractors assume more context than a true Foundation learner has).
- **Concept gaps:** heading-level hierarchy / skipped heading levels (`<h1>`→`<h4>` jumps) never tested, distinct from the existing "styled div instead of a real heading" question; `<header>`/`<footer>` scoped per-article/section (only the page-level usage is tested).

### forms-validation-and-attributes (25 Active, including miscategorized Q451 — 24 legitimate)
- **Violations:** Q451 (wrong topic, Critical Bugs #3), Q479 (corrupted hint, Critical Bugs #4), Q477 (mis-leveled Advanced for the basic `placeholder` attribute), Q476 (mis-leveled Advanced for `novalidate`). Cleanest topic in the subject on the escaping bug — zero rows affected.
- **Concept gaps:** `:required`/`:optional` CSS pseudo-classes (only `:valid`/`:invalid` are tested); `checkValidity()` vs `reportValidity()` (a frequent real confusion point, untested); `accept` attribute on `<input type="file">` (uncovered anywhere in the subject).

### embedding-content-iframes-external-me (25 Active)
- **Violations:** Q417/Q420/Q423/Q3250/Q3204/Q3205/Q5982/Q5984 (unescaped-tag bug including the live cross-origin-iframe case, Critical Bugs #1 — worst-affected topic proportionally, 8 of 25), Q419 (weak "all of the above" catch-all design), Q421 (mild length-tell).
- **Concept gaps:** `srcdoc` attribute (only `src` is tested, repeatedly); bare `sandbox` as an opt-in maximum-restriction model (only one narrow cookie/storage consequence is tested, not the "blocks everything, add capabilities back one at a time" mental model).

### accessibility-in-html (26 Active)
- **Violations:** Q426/Q429/Q432/Q440/Q442/Q443 (shuffled hints, Critical Bugs #4), length-tell on Q440 (strong), Q432/Q442/Q443 (moderate), Q429 (minor), stray leading-space formatting on several option strings (cosmetic).
- **Near-duplicates:** Q433 ↔ Q3251 (soft overlap — ARIA `role="main"` attribute vs. the native `<main>` element, technically distinct facts); Q437 ↔ Q5979 (soft overlap, recall vs. applied — the General question adds real depth, not a true duplicate).
- **Concept gaps:** `aria-label` vs `aria-labelledby` (uncovered); removing the focus outline with no replacement and its accessibility consequence (uncovered).

### metadata-and-seo-basics (27 Active, including miscategorized Q462/Q463 — 25 legitimate)
- **Violations:** Q455 (mis-marked correct answer, Critical Bugs #2), Q462/Q463 (wrong topic, Critical Bugs #3), length-tell on Q446/Q453/Q454/Q458 (moderate-strong), Q461 (minor).
- **Near-duplicates:** Q448 ↔ Q457 — true duplicate, both test "viewport meta tag controls mobile scaling," no differentiating angle.
- **Concept gaps:** robots.txt vs. the `<meta name="robots">` tag distinction (uncovered); recommended `<title>` tag length for search-result display (uncovered).

### web-components (10 Active — the subject's clear coverage outlier)
- **Violations:** none found — the existing 10 questions are well-written (balanced option lengths, plausible distractors, clean escaping, accurate content). The problem here is pure coverage, not quality.
- **Coverage gap:** existing questions cover only attachShadow/open-vs-closed mode, `<template>` inertness, `<slot>`/light-DOM projection basics, custom-element naming rules, and `connectedCallback` vs constructor timing — roughly a third of the topic's real surface area. Missing entirely: the rest of the lifecycle (`disconnectedCallback`, `attributeChangedCallback`/`observedAttributes`), encapsulated styling (`:host`, CSS custom-property theming across the shadow boundary), Declarative Shadow DOM, named slots + slot fallback content, registration edge cases (`customElements.get`/`whenDefined`, re-registration errors), customized built-in elements (`extends`/`is=`), the HTML-Imports-is-dead/ES-modules-replaced-it fact, shadow-DOM event retargeting (`composed: true`), and property/attribute reflection. **14 questions drafted below close essentially all of this gap**, which would bring the topic to 24 Active — right in line with the rest of the subject.

## Full Catalog of Draft Questions (46 total)

Each entry shows the exact field values intended for seeding — real HTML tags for structure, single entity-escaped tag mentions in prose (e.g. `&lt;img&gt;`), matching the established, already-fixed pattern elsewhere in the bank. Shown in fenced code blocks to avoid any ambiguity about escaping layers.

### introduction-to-html (3 drafts)

**1. Trivia, Level 1 — the concept of an attribute**
```html
Q: In <img src="cat.jpg" alt="A sleeping cat">, what are src and alt called?
Options:
  - Tags
  - Elements
  - [CORRECT] Attributes
    Comment: src and alt are attributes — name/value pairs written inside an opening tag that provide extra information about an element, such as which image file to load or what alternative text to show. They are not tags or elements themselves.
  - Values
Hint: They sit inside the opening tag, before the closing ">" — but they aren't the tag's name.
```

**2. General, Level 1 — attributes are optional vs. essential**
```html
Q: In <a href="https://example.com" target="_blank">Visit</a>, what job do href and target actually do, and could the element work at all without them?
Answer: <p><code>href</code> and <code>target</code> are attributes — name/value pairs written inside the opening &lt;a&gt; tag that configure how that specific element behaves, rather than being part of the tag's name or its visible content.</p><p><code>href</code> supplies the destination URL the link navigates to, and <code>target</code> controls where that navigation happens, such as opening in a new tab when set to <code>_blank</code>. Without <code>href</code>, the element is still a technically valid &lt;a&gt; tag, but it has nothing to link to and won't behave like a clickable link to a destination.</p><p>Most elements accept a mix of attributes that are optional, like <code>target</code>, which defaults to opening in the same tab, and attributes that are essential to the element doing its job at all, like <code>href</code> here, or <code>src</code> on an &lt;img&gt;.</p>
Hint: Ask what's left of the link if you strip href away — is it still useful?
```

**3. Trivia, Level 3 — attribute values are case-sensitive**
```html
Q: A developer writes class="Header" on one element and later selects it in CSS with .header (lowercase). The style doesn't apply. Given that HTML tag and attribute NAMES are case-insensitive, why does this fail?
Options:
  - Because class is a reserved attribute that must always be lowercase
  - [CORRECT] Because attribute VALUES, unlike tag and attribute names, are treated as case-sensitive text
    Comment: Tag names and attribute names (like class or id) are case-insensitive to HTML's parser, but the text inside an attribute's value is just a string and is compared exactly as written. "Header" and "header" are different strings, so a CSS selector targeting .header never matches class="Header".
  - Because CSS selectors are always case-insensitive, so this is actually a browser bug
  - Because the browser silently lowercases every attribute value except class
Hint: The attribute name's case doesn't matter — but is the text inside the quotes still just an ordinary string?
```

### html-document-structure (3 drafts)

**4. Trivia, Level 3 — defer vs async**
```html
Q: A <head> contains two <script> tags, one with defer and one with async, both pointing at external files. What's the key difference in when each one actually executes?
Options:
  - defer runs the script as soon as it finishes downloading, even mid-parse; async waits until parsing is completely finished
  - [CORRECT] async runs the script as soon as it finishes downloading, potentially pausing HTML parsing to do so, while defer waits until parsing is completely finished before running, in source order
    Comment: async scripts run the moment they're downloaded, which can interrupt parsing at an unpredictable point and in no guaranteed order relative to other scripts. defer scripts are guaranteed to run only after the document has finished parsing, and multiple deferred scripts execute in the order they appear in the markup.
  - Both behave identically; the two attributes are just older and newer names for the same behavior
  - defer and async both block parsing immediately, the same as a plain <script> tag with neither attribute
Hint: Think about what happens the instant each type of script finishes downloading, not just where it's declared.
```

**5. General, Level 3 — defer avoids the "element doesn't exist yet" bug**
```html
Q: A page's <head> includes two external <script> tags: one with defer, one with plain (no attribute at all). Both scripts read elements from the page as soon as they run. One of them intermittently fails because the elements it needs don't exist in the DOM yet. Which script is more likely to fail, and why?
Answer: <p>The plain &lt;script&gt; tag with no attribute is far more likely to fail. By default, a script tag is both parser-blocking and runs immediately once downloaded — if it sits in &lt;head&gt;, it executes before the browser has parsed any of &lt;body&gt;, so any element it tries to read simply doesn't exist in the Document Object Model (DOM) yet.</p><p>A script marked <code>defer</code> downloads in the background without blocking parsing, and is guaranteed to run only after the entire document has finished parsing — so by the time it executes, every element in &lt;body&gt; is already part of the DOM and safe to read.</p><p>This is exactly why <code>defer</code> on a head-placed script is often preferred over moving a plain script to the bottom of &lt;body&gt;: it gets the same safe-timing guarantee without needing the script tag relocated at all.</p>
Hint: Think about what's already been parsed into the DOM by the time each script actually executes.
```

**6. Trivia, Level 2 — noscript**
```html
Q: What is the purpose of a <noscript> element placed in <head> or <body>?
Options:
  - It defines a block of markup that should run only before JavaScript has loaded, then gets removed
  - [CORRECT] It renders its content only when the browser has JavaScript disabled or doesn't support it
    Comment: noscript content is ignored by browsers that run the page's JavaScript normally, and is only rendered when scripting is disabled or unsupported — it's the HTML-level fallback for script-dependent features.
  - It silences JavaScript console errors elsewhere on the page
  - It delays all script tags on the page until the user clicks something
Hint: It's the opposite of a script tag — it only matters when scripts don't run.
```

### text-and-formatting-elements (2 drafts)

**7. Trivia, Level 2 — `<small>`'s real semantic meaning**
```html
Q: What does the <small> element semantically represent, beyond just rendering smaller text?
Options:
  - [CORRECT] Side comments or fine print, such as legal disclaimers or licensing text, not just a visual font-size reduction
    Comment: HTML5 redefined small, giving it the semantic meaning of side comments or fine print — like disclaimers, license notices, or attribution — rather than a purely visual "make the font smaller" tag.
  - Text that should always be read first by screen readers, ahead of the rest of the page
  - A deprecated HTML4 tag with no meaning in HTML5, kept only for backward compatibility
  - An inline alternative to <mark> for highlighting text
Hint: HTML5 gave this old presentational-looking tag an actual semantic job, similar to what happened with <b> and <i>.
```

**8. Trivia, Level 1 — `<sup>` for exponents**
```html
Q: Which element would correctly mark up the "2" in an exponent like x²?
Options:
  - <sub>
  - [CORRECT] <sup>
    Comment: sup renders its content raised above the normal text baseline, exactly the convention used for exponents and footnote markers, while sub does the opposite, lowering content for things like chemical formula subscripts.
  - <small>
  - <mark>
Hint: It's the opposite of the tag used for the 2 in H2O.
```

### links-and-navigation (3 drafts)

**9. Trivia, Level 2 — `<nav>` as a landmark**
```html
Q: What's the main benefit of wrapping a group of navigation links in a <nav> element instead of a plain <div> or <ul>?
Options:
  - It loads the enclosed links before anything else on the page
  - It gives the enclosed links automatic underline and spacing styles
  - [CORRECT] It marks the group as a landmark assistive tech can jump to directly
    Comment: nav is one of HTML5's landmark elements (regions like header, main, and nav), so screen reader users can jump straight to it from a landmarks list instead of tabbing past everything above it.
  - It stops search engines from following any link placed inside it
Hint: Think about how a screen reader user can jump straight to a page's major regions.
```

**10. General, Level 2 — skip links**
```html
Q: A page has a long navigation menu with 20 links before the main content starts. A keyboard-only user says they have to tab through every single one of those links on every page just to reach the content. What's the standard HTML fix?
Answer: <p>The standard fix is a "skip link": a real <code>&lt;a href="#main-content"&gt;</code> placed as the very first focusable element on the page, pointing at an id on the main content area, such as <code>&lt;main id="main-content"&gt;</code>.</p><pre><code>&lt;a href="#main-content" class="skip-link"&gt;Skip to main content&lt;/a&gt;
...
&lt;nav&gt;...20 links...&lt;/nav&gt;
&lt;main id="main-content"&gt;...&lt;/main&gt;</code></pre><p>It's usually styled to stay visually hidden until it receives keyboard focus, at which point it becomes visible. Activating it moves focus straight to the main content, letting a keyboard-only user skip the entire repeated navigation block in one press of Enter.</p>
Hint: It's a link, usually visually hidden until it receives focus, placed right at the top of the page.
```

**11. Trivia, Level 2 — `rel="nofollow"`**
```html
Q: Adding rel="nofollow" to a link mainly signals what to search engines?
Options:
  - The link should open in a new tab automatically
  - [CORRECT] The link shouldn't pass ranking credit to its destination
    Comment: nofollow tells search engine crawlers not to pass SEO ranking credit through that link, which is why it's commonly added to user-submitted content like blog comments or to paid/sponsored links.
  - The link points to a file that should be downloaded
  - The linked page should be excluded from the browser cache
Hint: It's often added to links in comments or paid placements.
```

### lists-and-tables (2 drafts)

**12. General, Level 3 — `list-style: none` and the ARIA list role**
```html
Q: A nav bar is built as a <ul> of links, and a designer removes the bullets with list-style: none in CSS so it looks like a plain horizontal menu. QA later reports that VoiceOver no longer announces it as a list at all. What's actually happening?
Answer: <p>In Safari specifically, applying <code>list-style: none</code> to a &lt;ul&gt; or &lt;ol&gt; removes its implicit <code>list</code> role, and with it the implicit <code>listitem</code> role on each &lt;li&gt;. VoiceOver then announces the items as plain unstructured text instead of as a list, even though the underlying markup is still semantically a list.</p><p>The standard fix is adding the role back explicitly: <code>role="list"</code> on the &lt;ul&gt; and <code>role="listitem"</code> on each &lt;li&gt;, which restores the announcement without bringing the bullets back visually.</p><pre><code>&lt;ul style="list-style: none" role="list"&gt;
  &lt;li role="listitem"&gt;Home&lt;/li&gt;
  &lt;li role="listitem"&gt;Pricing&lt;/li&gt;
&lt;/ul&gt;</code></pre>
Hint: Removing the bullet isn't just visual in every browser — it can touch the element's accessibility role too.
```

**13. Trivia, Level 3 — `<li value="">` resets the counter**
```html
Q: Inside an <ol>, what does adding value="5" directly on one <li> do?
Options:
  - [CORRECT] That item displays as number 5, and every item after it continues counting up from 5
    Comment: The value attribute on a single li resets the ordered list's internal counter from that point onward, so later items keep counting up from the new number rather than continuing the original sequence.
  - Only that one item displays the number 5, with no effect on the items around it
  - It's invalid markup, since value is only allowed on form elements
  - It changes that item's bullet to a custom character instead of a number
Hint: It resets the running count starting from that specific item, not just that item's label.
```

### images-and-multimedia (3 drafts)

**14. Trivia, Level 2 — width/height preventing CLS**
```html
Q: Why is it recommended to always set width and height attributes on an <img>, even when the final size is controlled by CSS?
Options:
  - [CORRECT] They let the browser reserve space early, preventing the page from jumping as the image loads
    Comment: Before an image finishes downloading, the browser doesn't know its dimensions. Declared width and height let it reserve the right space in the layout immediately, avoiding the layout shift that happens when the image pops in — this is what the Cumulative Layout Shift (CLS) metric measures.
  - They compress the image file to a smaller size before it's sent to the browser
  - They're required for the alt attribute to be read correctly by screen readers
  - They tell the browser which file format to decode the image as
Hint: The browser needs to know the image's shape before the file has actually downloaded.
```

**15. Trivia, Level 1 — `<figure>`/`<figcaption>`**
```html
Q: What's the purpose of wrapping an <img> in a <figure> with a <figcaption>?
Options:
  - [CORRECT] It groups the image with a caption that's programmatically tied to it
    Comment: figure groups self-contained content like an image together with its figcaption, and that caption is programmatically associated with the content rather than just being a nearby paragraph.
  - It forces the image to display at its original, unscaled size
  - It makes the image lazy-load automatically without the loading attribute
  - It adds a border and drop shadow around the image by default
Hint: It's the semantic way to pair an image with its own caption.
```

**16. General, Level 1 — media fallback content**
```html
Q: What's the purpose of putting text like "Your browser doesn't support video playback." directly inside a <video> element, between its opening and closing tags?
Answer: <p>Any content placed between &lt;video&gt; and &lt;/video&gt; (or between &lt;audio&gt; and &lt;/audio&gt;) is fallback content, and a browser that supports the element simply ignores it, rendering the player as normal.</p><pre><code>&lt;video controls&gt;
  &lt;source src="demo.mp4" type="video/mp4"&gt;
  Your browser doesn't support video playback.
&lt;/video&gt;</code></pre><p>A very old or unusual browser that doesn't recognize &lt;video&gt; at all skips the tag it doesn't understand and renders the fallback text in its place, so the visitor sees a helpful message instead of a silent blank space.</p>
Hint: Think about what a browser does with content it doesn't recognize versus content it's told to ignore.
```

### forms-and-input-elements (3 drafts)

**17. Trivia, Level 1 — `required` native validation**
```html
Q: What happens when an <input> has the required attribute and the user tries to submit the form while it's empty?
Options:
  - [CORRECT] The browser blocks submission and shows a built-in validation message
    Comment: The required attribute triggers the browser's built-in HTML5 form validation. If the field is empty, the browser blocks submission on its own and displays a native prompt, without any JavaScript needed.
  - The form submits normally, but the field is sent as the word "required"
  - The field is automatically filled with its placeholder text instead
  - Nothing happens unless a JavaScript validation library is also added
Hint: No JavaScript is involved — this is handled by the browser itself.
```

**18. General, Level 2 — GET vs POST for a login form**
```html
Q: A login form currently uses method="get". A security review flags this immediately, even before looking at anything else about the form. Why is GET specifically wrong for a login form, and what should it use instead?
Answer: <p>With <code>method="get"</code>, form data is appended to the submitted URL as a query string, which means a password would end up visible in the browser's address bar, saved in browser history, and potentially logged by servers and proxies along the way.</p><p>A login form should use <code>method="post"</code> instead, which sends data in the request body rather than the URL. That keeps credentials out of the address bar and browser history, though POST alone doesn't encrypt anything — that protection still comes from serving the form over HTTPS.</p><pre><code>&lt;form method="post" action="/login"&gt;...&lt;/form&gt;</code></pre>
Hint: Think about where the submitted data actually ends up when GET is used — specifically, where it becomes visible.
```

**19. Trivia, Level 1 — `maxlength`**
```html
Q: What does setting maxlength="10" on a text <input> do?
Options:
  - [CORRECT] It stops the user from typing more than 10 characters into the field
    Comment: maxlength caps how many characters the browser will let the user type or paste into the field in the first place, rather than silently truncating a longer value after the fact.
  - It shows a validation error if fewer than 10 characters are entered
  - It limits the field's visible width to 10 characters on screen
  - It truncates the submitted value to 10 characters after submission
Hint: It acts while the user is still typing, not just at submission time.
```

### semantic-html (3 drafts)

**20. Trivia, Level 2 — skipping heading levels**
```html
Q: A page uses an <h1> followed directly by an <h4>, skipping <h2> and <h3>, simply because the <h4> already looked the right visual size. What's the actual problem with skipping heading levels like this?
Options:
  - [CORRECT] Screen readers build a page outline from heading levels in sequence, so a gap reads like a missing section
    Comment: Heading levels aren't just font sizes — assistive tech uses them to construct a navigable outline, and an unexplained jump from h1 to h4 looks like an entire subsection vanished.
  - The browser silently renumbers the skipped heading to the next valid level
  - Search engines stop crawling the rest of the page at the gap
  - CSS styles stop applying correctly to every element after the skipped heading
Hint: Think about how a screen reader user navigates by jumping between headings, not by text size.
```

**21. General, Level 2 — missing h1 root**
```html
Q: A product page is marked up with <h2>Product Name</h2> followed by <h2>Specifications</h2> and <h2>Reviews</h2>, all at the same level, with no <h1> anywhere on the page. Visually everything looks fine since CSS sizes each heading the way the team wants. What's actually missing structurally, and why does it matter?
Answer: <p>A page's heading outline is supposed to start from a top-level &lt;h1&gt; that names the page's single main subject, with every other heading nesting underneath it as a subtopic. Starting at &lt;h2&gt; leaves that outline with no root, so assistive technology and search engines have to guess what the page is actually about.</p><pre><code>&lt;h1&gt;Wireless Mouse&lt;/h1&gt;
&lt;h2&gt;Specifications&lt;/h2&gt;
&lt;h2&gt;Reviews&lt;/h2&gt;</code></pre><p>Visual size can still come entirely from CSS — the point is that the outline needs a real top-level entry to hang everything else off of.</p>
Hint: Think about what role a single top-level heading plays in a page's outline, separate from font size.
```

**22. Trivia, Level 2 — scoped header/footer**
```html
Q: Can a <header> and <footer> be used inside an individual <article>, not just once at the top and bottom of the whole page?
Options:
  - [CORRECT] Yes — each article can have its own header and footer, for example showing that article's author and publish date
    Comment: header and footer take their meaning from their nearest sectioning ancestor — inside an article they describe just that article, and the page can have as many scoped pairs as it has articles or sections.
  - No — header and footer are only valid as direct children of body
  - Yes, but only footer can repeat per article; header is restricted to one per page
  - Yes, but only if the article has no other heading elements inside it
Hint: Their meaning depends on which element they're nested inside, not their position in the whole document.
```

### embedding-content-iframes-external-me (3 drafts)

**23. Trivia, Level 2 — `srcdoc`**
```html
Q: What does the srcdoc attribute on an <iframe> do differently from src?
Options:
  - [CORRECT] It lets the iframe render an HTML string provided directly in the attribute, instead of fetching a document from a URL
    Comment: srcdoc takes a literal HTML document as its value and renders that markup directly, handy for something like a live HTML preview pane, while src always points at a separate URL the browser has to request.
  - It sets a fallback URL the iframe loads only if src fails to respond
  - It preloads the destination page's HTML before the user opens the iframe
  - It restricts the iframe to only ever displaying plain, unstyled text
Hint: One of these loads markup handed to it directly; the other always fetches from a URL.
```

**24. Trivia, Level 3 — bare `sandbox` blocks everything**
```html
Q: An <iframe> is given a bare sandbox attribute with no value at all. What does the embedded page end up able to do?
Options:
  - [CORRECT] Essentially nothing extra — scripts, forms, popups, and top navigation are all blocked unless specific allow- tokens are added back
    Comment: An empty sandbox attribute applies every restriction at once, the strictest setting possible; capabilities only come back one at a time via tokens like allow-scripts or allow-forms, which is why sandbox is opt-in rather than opt-out.
  - Everything it could do without sandbox, since an empty value is treated as the attribute being absent
  - Only scripts are blocked; forms, popups, and navigation still work normally
  - Only navigation away from the iframe is blocked; scripts and forms still run
Hint: A bare sandbox attribute with no tokens is the maximum restriction, not a partial one.
```

**25. General, Level 3 — sandbox + allow- tokens scenario**
```html
Q: We added sandbox to a third-party iframe to lock it down, but now the embedded page's own internal links don't work, and a "Continue to checkout" button that's supposed to open a new tab does nothing. The vendor says everything on their end is fine. What's happening, and how do we fix it without removing sandbox entirely?
Answer: <p>A bare <code>sandbox</code> attribute blocks every capability by default, including the embedded page's ability to navigate itself or open new browsing contexts, so both symptoms are expected side effects rather than a vendor bug.</p><p>The fix is adding back only the specific tokens the page needs: <code>allow-top-navigation</code> or <code>allow-popups</code> restores the behaviors in question while everything else stays blocked.</p><pre><code>&lt;iframe sandbox="allow-scripts allow-popups" src="https://vendor.example.com/checkout"&gt;&lt;/iframe&gt;</code></pre><p>This keeps the embed contained to exactly the capabilities it was given, instead of locking it down completely or giving up the protection altogether.</p>
Hint: sandbox with no value blocks navigation and popups along with everything else — specific tokens have to be added back individually.
```

### forms-validation-and-attributes (3 drafts)

**26. Trivia, Level 2 — `:required`/`:optional`**
```html
Q: Which CSS pseudo-class matches a form control simply because it has the required attribute, regardless of whether it's currently valid or empty?
Options:
  - [CORRECT] :required
    Comment: :required matches purely on the presence of the required attribute itself, independent of validity — different from :valid/:invalid, which react to whether the current value actually passes constraint validation.
  - :valid
  - :invalid
  - :placeholder-shown
Hint: This one cares about whether the attribute is present, not whether the value is currently correct.
```

**27. General, Level 2 — checkValidity vs reportValidity**
```html
Q: We call an input's checkValidity() method in some validation code, and it correctly returns false for a bad value, but the user never sees any error message or red outline — the page just silently continues. What's the difference between that method and reportValidity(), and when would we want the one that actually shows something?
Answer: <p><code>checkValidity()</code> only evaluates the field's current constraints and hands back a boolean, with no visible side effect, so it's suited to logic that just needs a pass/fail without involving the UI.</p><p><code>reportValidity()</code> runs that same check but also triggers the browser's native validation UI, showing the built-in error bubble and focusing the first invalid field.</p><pre><code>if (!input.checkValidity()) {
  // silent check, decide something programmatically
}
if (!form.reportValidity()) {
  return; // shows the error bubble, stops submission
}</code></pre><p>Reach for <code>checkValidity()</code> when the result only matters to the code, and <code>reportValidity()</code> whenever the user actually needs to see what's wrong.</p>
Hint: One of the two methods also triggers the browser's visible error UI; the other just returns a boolean.
```

**28. Trivia, Level 2 — `accept` on file inputs**
```html
Q: Which attribute restricts which file types a user is offered when they open the file picker for <input type="file">?
Options:
  - [CORRECT] accept
    Comment: accept takes a list of MIME types or file extensions, like accept="image/png, image/jpeg", and filters what the native file picker shows by default; it's a hint for the picker, not a server-side guarantee.
  - pattern
  - type
  - accept-charset
Hint: It's named for what kinds of files the input will take, not how it validates them after upload.
```

### accessibility-in-html (2 drafts)

**29. Trivia, Level 2 — aria-label vs aria-labelledby**
```html
Q: A button has visible text elsewhere on the page in an <h2 id="section-title">, and the button needs that exact text as its accessible name. What's the difference between using aria-label and aria-labelledby here?
Options:
  - [CORRECT] aria-labelledby references the heading's id and reuses its text, while aria-label needs the text retyped as a separate string
    Comment: aria-labelledby takes element ids and uses their text content as the accessible name, so it stays in sync if that text changes. aria-label instead takes a literal string typed directly into the attribute.
  - aria-label and aria-labelledby are simply two names for the exact same behavior
  - aria-labelledby is only valid on form input elements
  - aria-label points to another element by its id, while aria-labelledby takes a literal typed-out string
Hint: One of the two takes an id reference to existing text; the other takes a typed-out string.
```

**30. Trivia, Level 2 — removing focus outline with no replacement**
```html
Q: A stylesheet includes *:focus { outline: none; } to remove the "ugly" blue focus ring across the whole site, with nothing added in its place. What's the accessibility consequence?
Options:
  - [CORRECT] Keyboard users lose all visual indication of where focus currently is, making the page hard to navigate without a mouse
    Comment: The focus outline is the primary way a sighted keyboard user tracks where they are as they Tab through a page. Removing it with nothing in its place makes keyboard navigation effectively blind. The fix is a custom visible focus style, not deletion.
  - Nothing changes for keyboard users; outline: none only affects mouse-hover styling
  - Screen reader users lose the ability to navigate the page entirely
  - The browser automatically substitutes its own default focus ring regardless
Hint: Think about which group of users relies on this visual cue, and what happens when it's simply deleted.
```

### metadata-and-seo-basics (2 drafts)

**31. Trivia, Level 2 — robots.txt vs meta robots**
```html
Q: What's the key difference between a site's robots.txt file and a page's <meta name="robots"> tag?
Options:
  - [CORRECT] robots.txt sets crawling rules site-wide from one file at the domain root; the meta tag sets rules per page, inside that page's head
    Comment: robots.txt lives once at the domain root and tells crawlers which paths they're allowed to request before a page ever loads. The meta robots tag lives inside one page's head and controls what happens after that page has already been crawled.
  - They're two different syntaxes for the exact same rule, interchangeable anywhere
  - robots.txt controls indexing per-page, while the meta tag controls crawling site-wide
  - robots.txt only applies to image and media files, not HTML pages
Hint: One lives at the domain root and applies broadly before a page loads; the other lives inside one page's own head.
```

**32. Trivia, Level 1 — title tag length**
```html
Q: What's the generally recommended length for a page's <title> tag so it doesn't get truncated in search results?
Options:
  - [CORRECT] Roughly 50-60 characters
    Comment: Search engines typically truncate a displayed title around 50-60 characters, or whenever it exceeds the available pixel width, so keeping it within that range helps the whole title show up instead of cutting off mid-word.
  - Roughly 10-20 characters
  - Roughly 100-120 characters
  - Roughly 300-320 characters
Hint: It's shorter than the length guideline for a meta description, not longer.
```

### web-components (14 drafts — priority gap)

**33. Trivia, Level 2 — disconnectedCallback**
```html
Q: Which lifecycle callback runs on a custom element right before it's removed from the document, and is the right place to release resources like event listeners or timers?
Options:
  - [CORRECT] disconnectedCallback, which runs whenever the element is removed from the DOM
    Comment: disconnectedCallback fires every time the element is taken out of the DOM — it's the natural place to tear down anything set up in connectedCallback, like event listeners, intervals, or observers.
  - constructor, which runs once when the element instance is first created
  - attributeChangedCallback, which runs whenever a watched attribute's value changes
  - adoptedCallback, which runs whenever the element moves to a new document
Hint: Think about the mirror image of connectedCallback — what happens on the way out, not the way in.
```

**34. Trivia, Level 2 — observedAttributes opt-in**
```html
Q: A custom element defines an attributeChangedCallback, but changing one of its attributes never triggers it. What's the most likely reason?
Options:
  - [CORRECT] The element never defined a static observedAttributes getter listing that attribute, so the browser never watches it
    Comment: The browser only calls attributeChangedCallback for attributes explicitly named in a static observedAttributes array/getter. Any attribute change outside that list is silently ignored.
  - attributeChangedCallback only ever fires once, the first time the element is attached
  - Attributes set via setAttribute() in JavaScript never trigger callbacks, only markup ones
  - The element needs attachShadow() called first for the callback to ever work
Hint: The callback existing isn't enough on its own — something else has to opt specific attribute names in.
```

**35. General, Level 3 — observedAttributes + attributeChangedCallback scenario**
```html
Q: A <progress-ring> custom element exposes a value HTML attribute, and the author wants its internal SVG circle to redraw automatically whenever <progress-ring value="40"> is edited in dev tools, without the page doing anything else. What two pieces does the component need, and how do they work together?
Answer: <p>Two pieces have to work together. First, the class needs a <code>static get observedAttributes()</code> getter that returns an array including <code>"value"</code> — this tells the browser to watch that attribute at all, since by default it watches nothing.</p><p>Second, the class needs an <code>attributeChangedCallback(name, oldValue, newValue)</code> method. Once "value" is observed, the browser calls this automatically every time the attribute changes, and the method's job is to read newValue and update the SVG circle.</p><pre><code>static get observedAttributes() {
  return ["value"];
}
attributeChangedCallback(name, oldValue, newValue) {
  this.updateCircle(Number(newValue));
}</code></pre><p>Leaving either piece out breaks the chain: without observedAttributes listing "value", the callback never runs for that attribute, no matter how it's defined.</p>
Hint: One piece opts the attribute in for watching; the other piece reacts once it's being watched.
```

**36. Trivia, Level 2 — `:host`**
```html
Q: Inside a custom element's shadow DOM stylesheet, which selector targets the custom element itself (the host), as opposed to anything inside its shadow tree?
Options:
  - [CORRECT] :host
    Comment: :host is the sole selector that reaches outside the shadow root to style the custom element itself from inside its own shadow DOM stylesheet.
  - ::host
  - :root
  - :scope
Hint: It's a pseudo-class, not a pseudo-element, and it only works from inside the shadow root's own stylesheet.
```

**37. General, Level 3 — CSS custom properties crossing the shadow boundary**
```html
Q: A <themed-button> custom element uses Shadow DOM for style encapsulation, and a consuming page wants to let different pages set its background color differently without ever reaching inside the shadow tree. Regular CSS selectors can't touch anything inside the shadow DOM — so how is page-level theming supposed to work at all?
Answer: <p>Shadow DOM blocks ordinary selectors from the outside from reaching in, but CSS custom properties are a deliberate exception — they inherit through the shadow boundary like any other inherited value. The component defines its internal style using a custom property with a fallback, and the page sets that property on the host element from outside.</p><pre><code>/* inside the component's shadow stylesheet */
.button { background: var(--btn-bg, steelblue); }

/* on the consuming page */
themed-button { --btn-bg: darkgreen; }</code></pre><p>The page never needs a selector that reaches inside the shadow tree — it only sets a custom property on the host element in ordinary page CSS, and the value flows in through inheritance.</p>
Hint: Shadow DOM blocks selectors from crossing in, but one specific kind of CSS value is designed to inherit across that boundary anyway.
```

**38. Trivia, Level 3 — Declarative Shadow DOM**
```html
Q: What does writing <template shadowrootmode="open"> directly inside a custom element's markup in server-rendered HTML accomplish?
Options:
  - [CORRECT] It attaches a shadow root to the element as soon as the HTML parses, with no JavaScript required
    Comment: Declarative Shadow DOM lets the HTML parser itself create and attach a shadow root the moment it parses a template with a shadowrootmode attribute. This is what makes server-rendered web components show their shadow content before any JavaScript has run.
  - It's purely a hint for build tools; the browser still needs attachShadow() called in JavaScript
  - It pre-loads the component's JavaScript file referenced elsewhere on the page
  - It behaves exactly like a regular template, staying inert until script clones it manually
Hint: This feature exists specifically so a shadow root can show up without waiting for any script to execute.
```

**39. Trivia, Level 2 — named slots**
```html
Q: A component's shadow DOM has two slots: <slot name="header"></slot> and a default, unnamed <slot></slot>. In the light DOM, how does a consumer direct an element into the named "header" slot specifically?
Options:
  - [CORRECT] By giving that element a slot="header" attribute in the light DOM
    Comment: A light-DOM element only lands in a named slot when it carries a matching slot="..." attribute — the browser matches that value against the slot's name. Anything without a matching attribute falls into the default slot.
  - By naming the element's own tag header so it matches automatically
  - By placing the element as the very first child inside the custom element's tags
  - Named slots can only be filled from inside the component's own shadow DOM
Hint: The matching happens through an attribute on the light-DOM element, not through its tag name or position.
```

**40. General, Level 2 — slot fallback content**
```html
Q: A <user-avatar> component's shadow DOM includes <slot name="status"></slot> for an online/offline indicator, but most consumers never provide one. What determines what shows up in that slot when nobody fills it, and how would the component author control it?
Answer: <p>When a slot has no matching light-DOM content assigned, whatever markup is written directly inside the slot tag in the shadow DOM renders instead, as fallback content.</p><pre><code>&lt;slot name="status"&gt;
  &lt;span class="dot offline"&gt;&lt;/span&gt;
&lt;/slot&gt;</code></pre><p>Any consumer who does provide a matching slot="status" element overrides this fallback entirely — it only renders when the slot would otherwise be empty. This lets a component ship a sensible default while still letting consumers override it.</p>
Hint: Content written directly between a slot's own tags behaves like a default, only used when nothing claims that slot.
```

**41. Trivia, Level 2 — customElements.define() throws on re-registration**
```html
Q: A script calls customElements.define("user-card", UserCard) twice, once in two different files that both run on the same page. What happens the second time?
Options:
  - [CORRECT] The browser throws an error, because a tag name can only be registered once per page
    Comment: customElements.define() throws a NotSupportedError the moment a tag name is registered a second time — registrations are permanent for the page's lifetime and can never be overwritten.
  - The second definition silently replaces the first, and existing elements switch to the new class
  - Both definitions are merged, with the second file's methods added onto the first
  - Nothing happens until the page is refreshed, then only the second takes effect
Hint: Think about whether a tag name registration, once made, can ever be taken back or swapped out.
```

**42. Trivia, Level 2 — customElements.get() / whenDefined()**
```html
Q: Before manually creating a <fancy-tabs> element with document.createElement, how can code check whether that tag has actually been registered yet, without just trying it and catching an error?
Options:
  - [CORRECT] Call customElements.get("fancy-tabs") and check whether it returns the class or undefined
    Comment: customElements.get() returns the registered constructor for a tag name, or undefined if nothing has registered it yet. Its companion, whenDefined(), returns a promise that resolves once that tag does get registered.
  - Check document.querySelector("fancy-tabs") and see whether it returns an element
  - Read the tag's dataset.defined property, which the browser sets automatically
  - There's no way to check; define() must simply be called defensively every time
Hint: There's a method on customElements made specifically for checking registration status by name.
```

**43. General, Level 3 — customized built-in elements**
```html
Q: A team wants a custom element that behaves like a real <button> in every way browsers already handle for free — form submission, keyboard activation, built-in accessibility — but adds its own extra styling and behavior on top. Wrapping a plain <button> inside a custom element's shadow DOM is one option, but what's the alternative that lets the custom element be a button directly?
Answer: <p>Rather than wrapping a native button inside a separate custom element, it's possible to extend the built-in element directly: a class extends <code>HTMLButtonElement</code> instead of the plain <code>HTMLElement</code> base class, and registers with an extends option naming the built-in tag.</p><pre><code>class FancyButton extends HTMLButtonElement {
  connectedCallback() {
    this.addEventListener("click", () =&gt; this.classList.add("pressed"));
  }
}
customElements.define("fancy-button", FancyButton, { extends: "button" });</code></pre><p>Consumers then write a real button tag with an is attribute naming the custom element: <code>&lt;button is="fancy-button"&gt;Save&lt;/button&gt;</code>. Because the element genuinely is a button, it keeps every native behavior browsers already implement.</p>
Hint: Rather than building a custom element from scratch, a class can extend an existing built-in element's own class.
```

**44. Trivia, Level 2 — HTML Imports is dead, replaced by ES modules**
```html
Q: Older web component tutorials mention "HTML Imports" (<link rel="import">) as a way to share component definitions across files. What's the status of that feature today, and what replaced it?
Options:
  - [CORRECT] HTML Imports were dropped from the spec and removed from browsers; components now share code as plain ES modules instead
    Comment: HTML Imports shipped only in old Chrome versions, never gained support elsewhere, and were eventually removed. The web platform settled on plain JavaScript modules instead — loaded with script type="module" or a bundler, no separate import mechanism needed.
  - HTML Imports are still the current recommended approach, supported in every major browser
  - HTML Imports are deprecated but can still be enabled behind a flag or via a polyfill
  - HTML Imports still function today, but only when wrapped in a template element first
Hint: This is a case of a once-proposed platform feature that didn't survive, not a feature still in active use.
```

**45. General, Level 3 — shadow DOM event retargeting (composed: true)**
```html
Q: A <rating-widget> custom element dispatches a custom event called rating-changed from inside its shadow DOM whenever the user clicks a star, using this.dispatchEvent(new CustomEvent("rating-changed", { detail: 4 })). A listener attached to the <rating-widget> element itself on the main page never fires. What's missing, and why does it matter that the event started inside a shadow tree?
Answer: <p>By default, an event dispatched inside a shadow tree stops at the shadow boundary and never reaches listeners outside it, because its composed flag defaults to false. The fix is passing composed: true when constructing the event:</p><pre><code>this.dispatchEvent(new CustomEvent("rating-changed", {
  detail: 4,
  bubbles: true,
  composed: true
}));</code></pre><p>With composed: true, the event is allowed to cross out of the shadow tree and continue bubbling through the light DOM, so a listener on the rating-widget element on the main page finally receives it. This boundary exists so a component's internal implementation details don't leak out as generic events unless the author deliberately opts a specific event into crossing that line.</p>
Hint: One specific option on the event itself controls whether it's allowed to cross out of the shadow tree at all.
```

**46. General, Level 3 — property/attribute reflection**
```html
Q: A <my-checkbox> custom element has a JavaScript checked property that toggles its internal state perfectly when set from JavaScript (el.checked = true), but CSS written as my-checkbox[checked] { ... } on the page never matches, even right after setting that property. What's missing, and what would need to change?
Answer: <p>Setting a JavaScript property on an element doesn't automatically touch its HTML attributes, and CSS attribute selectors like [checked] only ever look at the actual attribute, not the property. The checked property and the checked attribute are two separate things that happen to share a name.</p><pre><code>class MyCheckbox extends HTMLElement {
  get checked() {
    return this.hasAttribute("checked");
  }
  set checked(value) {
    if (value) {
      this.setAttribute("checked", "");
    } else {
      this.removeAttribute("checked");
    }
  }
}</code></pre><p>This pattern — writing the property's setter so it also updates the matching attribute — is called reflection. Once the setter reflects to the attribute, setting el.checked = true from JavaScript also adds the checked attribute, which finally makes my-checkbox[checked] match in CSS.</p>
Hint: A JavaScript property and an HTML attribute of the same name don't update each other automatically — something has to be written to keep them in sync.
```

## Suggested Next Steps

1. **Fix the unescaped-tag rendering bug on all 44 rows** — the single highest-impact fix, since several rows currently render broken/live content inside the quiz itself.
2. **Backfill Trivia option comments bank-wide** — the largest systemic gap by far; likely needs its own dedicated pass given the scale (~230+ rows), separate from this document's drafted new content.
3. **Fix the 5 miscategorized questions** by correcting their `question_topic` link (not content edits) — Q216 (wrong subject entirely — consider removing from HTML altogether), Q451, Q422, Q462/Q463, Q362.
4. **Fix the 10 shuffled-hint rows** (4 in images-and-multimedia, 6 in accessibility-in-html) and the 1 corrupted hint (Q479).
5. **Fix the one mis-marked correct answer** (Q455).
6. **Decide on the 9 flagged near-duplicate pairs** — 3 are true duplicates with no differentiating angle (Q141/Q3226, Q336/Q341, Q448/Q457) and are reasonable candidates for retirement to Inactive, matching the approach already used on the CSS bank; the other 6 are soft overlaps worth a second look but likely keepable.
7. **Review the length-tell pattern** (~30+ questions across the subject) — same systemic distractor-length issue already fixed once on the CSS bank.
8. **Review the 46 drafted questions above** and mark each approved / needs-edit / reject — web-components' 14 drafts are the priority, since that topic is the subject's clearest coverage gap.
9. Only after 1-8: write the seed/fix scripts (length-validated, idempotent by slug, status Active) for whatever survives review.
