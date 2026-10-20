import { AppDataSource } from '../data-source';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';

// Gap-fill pass from the HTML Question Bank Audit (docs/HTML-Question-Bank-Audit-2026-10-02.md,
// reviewed by the user before this run). These 46 questions cover concepts the audit found
// entirely absent from the existing 315 Active HTML questions — they do not touch, duplicate,
// or replace any existing row. web-components gets 14 of the 46 as the subject's confirmed
// coverage gap (10 Active -> 24 after this run, parity with the rest of the subject).
// Seeded straight to Active per the agreed review-before-seed workflow. The critical data bugs
// and near-duplicates the audit also found are handled by separate fix-html-*.ts scripts.
//
// Usage: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-html-audit-gaps.ts

interface OptionSpec { option: string; correct: boolean; comment: string | null; }
interface QuestionSpec {
  slug: string;
  question: string;
  questionType: QuestionTypeEnum;
  answer: string;
  hint: string;
  level: number;
  options: OptionSpec[];
  topicSlug: string;
}

const MARKS = 2;
const TIME_ALLOWED = 50;

function trivia(slug: string, topicSlug: string, level: number, question: string, answer: string, hint: string, correctComment: string, correctOption: string, wrongOptions: string[]): QuestionSpec {
  const options: OptionSpec[] = [
    { option: correctOption, correct: true, comment: correctComment },
    ...wrongOptions.map((o) => ({ option: o, correct: false, comment: null })),
  ];
  return { slug, question, questionType: QuestionTypeEnum.Trivia, answer, hint, level, options, topicSlug };
}

function general(slug: string, topicSlug: string, level: number, question: string, answer: string, hint: string): QuestionSpec {
  return { slug, question, questionType: QuestionTypeEnum.General, answer, hint, level, options: [], topicSlug };
}

const QUESTIONS: QuestionSpec[] = [

  // ── introduction-to-html ─────────────────────────────────────────────────
  trivia('html-what-is-an-attribute', 'introduction-to-html', 1,
    "In <img src=\"cat.jpg\" alt=\"A sleeping cat\">, what are src and alt called?",
    "src and alt are attributes — name/value pairs written inside an opening tag that provide extra information about an element, such as which image file to load or what alternative text to show. They are not tags or elements themselves.",
    "They sit inside the opening tag, before the closing \">\" — but they aren't the tag's name.",
    "src and alt are attributes, not tags or elements.",
    "Attributes",
    ["Tags", "Elements", "Values"]),

  general('html-optional-vs-essential-attributes', 'introduction-to-html', 1,
    "In <a href=\"https://example.com\" target=\"_blank\">Visit</a>, what job do href and target actually do, and could the element work at all without them?",
    "<p><code>href</code> and <code>target</code> are attributes — name/value pairs written inside the opening &lt;a&gt; tag that configure how that specific element behaves, rather than being part of the tag's name or its visible content.</p><p><code>href</code> supplies the destination URL the link navigates to, and <code>target</code> controls where that navigation happens, such as opening in a new tab when set to <code>_blank</code>. Without <code>href</code>, the element is still a technically valid &lt;a&gt; tag, but it has nothing to link to and won't behave like a clickable link to a destination.</p><p>Most elements accept a mix of attributes that are optional, like <code>target</code>, which defaults to opening in the same tab, and attributes that are essential to the element doing its job at all, like <code>href</code> here, or <code>src</code> on an &lt;img&gt;.</p>",
    "Ask what's left of the link if you strip href away — is it still useful?"),

  trivia('html-attribute-values-case-sensitive', 'introduction-to-html', 3,
    "A developer writes class=\"Header\" on one element and later selects it in CSS with .header (lowercase). The style doesn't apply. Given that HTML tag and attribute NAMES are case-insensitive, why does this fail?",
    "Tag names and attribute names (like class or id) are case-insensitive to HTML's parser, but the text inside an attribute's value is just a string and is compared exactly as written. \"Header\" and \"header\" are different strings, so a CSS selector targeting .header never matches class=\"Header\".",
    "The attribute name's case doesn't matter — but is the text inside the quotes still just an ordinary string?",
    "Attribute VALUES are case-sensitive text, unlike tag/attribute names.",
    "Because attribute VALUES, unlike tag and attribute names, are treated as case-sensitive text",
    ["Because class is a reserved attribute that must always be lowercase", "Because CSS selectors are always case-insensitive, so this is actually a browser bug", "Because the browser silently lowercases every attribute value except class"]),

  // ── html-document-structure ──────────────────────────────────────────────
  trivia('html-defer-vs-async-timing', 'html-document-structure', 3,
    "A <head> contains two <script> tags, one with defer and one with async, both pointing at external files. What's the key difference in when each one actually executes?",
    "async scripts run the moment they're downloaded, which can interrupt parsing at an unpredictable point and in no guaranteed order relative to other scripts. defer scripts are guaranteed to run only after the document has finished parsing, and multiple deferred scripts execute in the order they appear in the markup.",
    "Think about what happens the instant each type of script finishes downloading, not just where it's declared.",
    "async runs the instant it downloads, even mid-parse; defer waits until parsing finishes, in order.",
    "async runs the script as soon as it finishes downloading, potentially pausing HTML parsing to do so, while defer waits until parsing is completely finished before running, in source order",
    ["defer runs the script as soon as it finishes downloading, even mid-parse; async waits until parsing is completely finished", "Both behave identically; the two attributes are just older and newer names for the same behavior", "defer and async both block parsing immediately, the same as a plain script tag with neither attribute"]),

  general('html-defer-avoids-dom-not-ready-bug', 'html-document-structure', 3,
    "A page's <head> includes two external <script> tags: one with defer, one with plain (no attribute at all). Both scripts read elements from the page as soon as they run. One of them intermittently fails because the elements it needs don't exist in the DOM yet. Which script is more likely to fail, and why?",
    "<p>The plain &lt;script&gt; tag with no attribute is far more likely to fail. By default, a script tag is both parser-blocking and runs immediately once downloaded — if it sits in &lt;head&gt;, it executes before the browser has parsed any of &lt;body&gt;, so any element it tries to read simply doesn't exist in the Document Object Model (DOM) yet.</p><p>A script marked <code>defer</code> downloads in the background without blocking parsing, and is guaranteed to run only after the entire document has finished parsing — so by the time it executes, every element in &lt;body&gt; is already part of the DOM and safe to read.</p><p>This is exactly why <code>defer</code> on a head-placed script is often preferred over moving a plain script to the bottom of &lt;body&gt;: it gets the same safe-timing guarantee without needing the script tag relocated at all.</p>",
    "Think about what's already been parsed into the DOM by the time each script actually executes."),

  trivia('html-noscript-purpose', 'html-document-structure', 2,
    "What is the purpose of a <noscript> element placed in <head> or <body>?",
    "noscript content is ignored by browsers that run the page's JavaScript normally, and is only rendered when scripting is disabled or unsupported — it's the HTML-level fallback for script-dependent features.",
    "It's the opposite of a script tag — it only matters when scripts don't run.",
    "noscript is the HTML-level fallback shown only when scripting is disabled or unsupported.",
    "It renders its content only when the browser has JavaScript disabled or doesn't support it",
    ["It defines a block of markup that should run only before JavaScript has loaded, then gets removed", "It silences JavaScript console errors elsewhere on the page", "It delays all script tags on the page until the user clicks something"]),

  // ── text-and-formatting-elements ─────────────────────────────────────────
  trivia('html-small-semantic-meaning', 'text-and-formatting-elements', 2,
    "What does the <small> element semantically represent, beyond just rendering smaller text?",
    "HTML5 redefined small, giving it the semantic meaning of side comments or fine print — like disclaimers, license notices, or attribution — rather than a purely visual \"make the font smaller\" tag.",
    "HTML5 gave this old presentational-looking tag an actual semantic job, similar to what happened with <b> and <i>.",
    "small's HTML5 meaning is side comments/fine print, not just a visual size reduction.",
    "Side comments or fine print, such as legal disclaimers or licensing text, not just a visual font-size reduction",
    ["Text that should always be read first by screen readers, ahead of the rest of the page", "A deprecated HTML4 tag with no meaning in HTML5, kept only for backward compatibility", "An inline alternative to mark for highlighting text"]),

  trivia('html-sup-for-exponents', 'text-and-formatting-elements', 1,
    "Which element would correctly mark up the \"2\" in an exponent like x²?",
    "sup renders its content raised above the normal text baseline, exactly the convention used for exponents and footnote markers, while sub does the opposite, lowering content for things like chemical formula subscripts.",
    "It's the opposite of the tag used for the 2 in H2O.",
    "sup raises content above the baseline, the opposite of sub.",
    "<sup>",
    ["<sub>", "<small>", "<mark>"]),

  // ── links-and-navigation ─────────────────────────────────────────────────
  trivia('html-nav-landmark-benefit', 'links-and-navigation', 2,
    "What's the main benefit of wrapping a group of navigation links in a <nav> element instead of a plain <div> or <ul>?",
    "nav is one of HTML5's landmark elements (regions like header, main, and nav), so screen reader users can jump straight to it from a landmarks list instead of tabbing past everything above it.",
    "Think about how a screen reader user can jump straight to a page's major regions.",
    "nav is a landmark element — screen readers can jump straight to it.",
    "It marks the group as a landmark assistive tech can jump to directly",
    ["It loads the enclosed links before anything else on the page", "It gives the enclosed links automatic underline and spacing styles", "It stops search engines from following any link placed inside it"]),

  general('html-skip-links-pattern', 'links-and-navigation', 2,
    "A page has a long navigation menu with 20 links before the main content starts. A keyboard-only user says they have to tab through every single one of those links on every page just to reach the content. What's the standard HTML fix?",
    "<p>The standard fix is a \"skip link\": a real <code>&lt;a href=\"#main-content\"&gt;</code> placed as the very first focusable element on the page, pointing at an id on the main content area, such as <code>&lt;main id=\"main-content\"&gt;</code>.</p><pre><code>&lt;a href=\"#main-content\" class=\"skip-link\"&gt;Skip to main content&lt;/a&gt;\n...\n&lt;nav&gt;...20 links...&lt;/nav&gt;\n&lt;main id=\"main-content\"&gt;...&lt;/main&gt;</code></pre><p>It's usually styled to stay visually hidden until it receives keyboard focus, at which point it becomes visible. Activating it moves focus straight to the main content, letting a keyboard-only user skip the entire repeated navigation block in one press of Enter.</p>",
    "It's a link, usually visually hidden until it receives focus, placed right at the top of the page."),

  trivia('html-rel-nofollow-purpose', 'links-and-navigation', 2,
    "Adding rel=\"nofollow\" to a link mainly signals what to search engines?",
    "nofollow tells search engine crawlers not to pass SEO ranking credit through that link, which is why it's commonly added to user-submitted content like blog comments or to paid/sponsored links.",
    "It's often added to links in comments or paid placements.",
    "nofollow tells crawlers not to pass ranking credit through that link.",
    "The link shouldn't pass ranking credit to its destination",
    ["The link should open in a new tab automatically", "The link points to a file that should be downloaded", "The linked page should be excluded from the browser cache"]),

  // ── lists-and-tables ──────────────────────────────────────────────────────
  general('html-list-style-none-strips-aria-role', 'lists-and-tables', 3,
    "A nav bar is built as a <ul> of links, and a designer removes the bullets with list-style: none in CSS so it looks like a plain horizontal menu. QA later reports that VoiceOver no longer announces it as a list at all. What's actually happening?",
    "<p>In Safari specifically, applying <code>list-style: none</code> to a &lt;ul&gt; or &lt;ol&gt; removes its implicit <code>list</code> role, and with it the implicit <code>listitem</code> role on each &lt;li&gt;. VoiceOver then announces the items as plain unstructured text instead of as a list, even though the underlying markup is still semantically a list.</p><p>The standard fix is adding the role back explicitly: <code>role=\"list\"</code> on the &lt;ul&gt; and <code>role=\"listitem\"</code> on each &lt;li&gt;, which restores the announcement without bringing the bullets back visually.</p><pre><code>&lt;ul style=\"list-style: none\" role=\"list\"&gt;\n  &lt;li role=\"listitem\"&gt;Home&lt;/li&gt;\n  &lt;li role=\"listitem\"&gt;Pricing&lt;/li&gt;\n&lt;/ul&gt;</code></pre>",
    "Removing the bullet isn't just visual in every browser — it can touch the element's accessibility role too."),

  trivia('html-li-value-resets-counter', 'lists-and-tables', 3,
    "Inside an <ol>, what does adding value=\"5\" directly on one <li> do?",
    "The value attribute on a single li resets the ordered list's internal counter from that point onward, so later items keep counting up from the new number rather than continuing the original sequence.",
    "It resets the running count starting from that specific item, not just that item's label.",
    "value resets the ol's running counter from that item onward.",
    "That item displays as number 5, and every item after it continues counting up from 5",
    ["Only that one item displays the number 5, with no effect on the items around it", "It's invalid markup, since value is only allowed on form elements", "It changes that item's bullet to a custom character instead of a number"]),

  // ── images-and-multimedia ────────────────────────────────────────────────
  trivia('html-img-width-height-prevents-cls', 'images-and-multimedia', 2,
    "Why is it recommended to always set width and height attributes on an <img>, even when the final size is controlled by CSS?",
    "Before an image finishes downloading, the browser doesn't know its dimensions. Declared width and height let it reserve the right space in the layout immediately, avoiding the layout shift that happens when the image pops in — this is what the Cumulative Layout Shift (CLS) metric measures.",
    "The browser needs to know the image's shape before the file has actually downloaded.",
    "Declared dimensions let the browser reserve layout space before the image loads.",
    "They let the browser reserve space early, preventing the page from jumping as the image loads",
    ["They compress the image file to a smaller size before it's sent to the browser", "They're required for the alt attribute to be read correctly by screen readers", "They tell the browser which file format to decode the image as"]),

  trivia('html-figure-figcaption-purpose', 'images-and-multimedia', 1,
    "What's the purpose of wrapping an <img> in a <figure> with a <figcaption>?",
    "figure groups self-contained content like an image together with its figcaption, and that caption is programmatically associated with the content rather than just being a nearby paragraph.",
    "It's the semantic way to pair an image with its own caption.",
    "figcaption's caption is programmatically tied to the figure's content.",
    "It groups the image with a caption that's programmatically tied to it",
    ["It forces the image to display at its original, unscaled size", "It makes the image lazy-load automatically without the loading attribute", "It adds a border and drop shadow around the image by default"]),

  general('html-video-fallback-content', 'images-and-multimedia', 1,
    "What's the purpose of putting text like \"Your browser doesn't support video playback.\" directly inside a <video> element, between its opening and closing tags?",
    "<p>Any content placed between &lt;video&gt; and &lt;/video&gt; (or between &lt;audio&gt; and &lt;/audio&gt;) is fallback content, and a browser that supports the element simply ignores it, rendering the player as normal.</p><pre><code>&lt;video controls&gt;\n  &lt;source src=\"demo.mp4\" type=\"video/mp4\"&gt;\n  Your browser doesn't support video playback.\n&lt;/video&gt;</code></pre><p>A very old or unusual browser that doesn't recognize &lt;video&gt; at all skips the tag it doesn't understand and renders the fallback text in its place, so the visitor sees a helpful message instead of a silent blank space.</p>",
    "Think about what a browser does with content it doesn't recognize versus content it's told to ignore."),

  // ── forms-and-input-elements ─────────────────────────────────────────────
  trivia('html-required-native-validation', 'forms-and-input-elements', 1,
    "What happens when an <input> has the required attribute and the user tries to submit the form while it's empty?",
    "The required attribute triggers the browser's built-in HTML5 form validation. If the field is empty, the browser blocks submission on its own and displays a native prompt, without any JavaScript needed.",
    "No JavaScript is involved — this is handled by the browser itself.",
    "required triggers the browser's own built-in form validation.",
    "The browser blocks submission and shows a built-in validation message",
    ["The form submits normally, but the field is sent as the word \"required\"", "The field is automatically filled with its placeholder text instead", "Nothing happens unless a JavaScript validation library is also added"]),

  general('html-get-vs-post-login-form', 'forms-and-input-elements', 2,
    "A login form currently uses method=\"get\". A security review flags this immediately, even before looking at anything else about the form. Why is GET specifically wrong for a login form, and what should it use instead?",
    "<p>With <code>method=\"get\"</code>, form data is appended to the submitted URL as a query string, which means a password would end up visible in the browser's address bar, saved in browser history, and potentially logged by servers and proxies along the way.</p><p>A login form should use <code>method=\"post\"</code> instead, which sends data in the request body rather than the URL. That keeps credentials out of the address bar and browser history, though POST alone doesn't encrypt anything — that protection still comes from serving the form over HTTPS.</p><pre><code>&lt;form method=\"post\" action=\"/login\"&gt;...&lt;/form&gt;</code></pre>",
    "Think about where the submitted data actually ends up when GET is used — specifically, where it becomes visible."),

  trivia('html-maxlength-attribute', 'forms-and-input-elements', 1,
    "What does setting maxlength=\"10\" on a text <input> do?",
    "maxlength caps how many characters the browser will let the user type or paste into the field in the first place, rather than silently truncating a longer value after the fact.",
    "It acts while the user is still typing, not just at submission time.",
    "maxlength caps characters the browser lets the user type/paste in.",
    "It stops the user from typing more than 10 characters into the field",
    ["It shows a validation error if fewer than 10 characters are entered", "It limits the field's visible width to 10 characters on screen", "It truncates the submitted value to 10 characters after submission"]),

  // ── semantic-html ─────────────────────────────────────────────────────────
  trivia('html-skipping-heading-levels', 'semantic-html', 2,
    "A page uses an <h1> followed directly by an <h4>, skipping <h2> and <h3>, simply because the <h4> already looked the right visual size. What's the actual problem with skipping heading levels like this?",
    "Heading levels aren't just font sizes — assistive tech uses them to construct a navigable outline, and an unexplained jump from h1 to h4 looks like an entire subsection vanished.",
    "Think about how a screen reader user navigates by jumping between headings, not by text size.",
    "Screen readers build a page outline from heading levels in sequence.",
    "Screen readers build a page outline from heading levels in sequence, so a gap reads like a missing section",
    ["The browser silently renumbers the skipped heading to the next valid level", "Search engines stop crawling the rest of the page the moment they encounter the gap", "CSS styles stop applying correctly to every element that comes after the skipped heading"]),

  general('html-missing-h1-root-heading', 'semantic-html', 2,
    "A product page is marked up with <h2>Product Name</h2> followed by <h2>Specifications</h2> and <h2>Reviews</h2>, all at the same level, with no <h1> anywhere on the page. Visually everything looks fine since CSS sizes each heading the way the team wants. What's actually missing structurally, and why does it matter?",
    "<p>A page's heading outline is supposed to start from a top-level &lt;h1&gt; that names the page's single main subject, with every other heading nesting underneath it as a subtopic. Starting at &lt;h2&gt; leaves that outline with no root, so assistive technology and search engines have to guess what the page is actually about.</p><pre><code>&lt;h1&gt;Wireless Mouse&lt;/h1&gt;\n&lt;h2&gt;Specifications&lt;/h2&gt;\n&lt;h2&gt;Reviews&lt;/h2&gt;</code></pre><p>Visual size can still come entirely from CSS — the point is that the outline needs a real top-level entry to hang everything else off of.</p>",
    "Think about what role a single top-level heading plays in a page's outline, separate from font size."),

  trivia('html-header-footer-scoped-to-article', 'semantic-html', 2,
    "Can a <header> and <footer> be used inside an individual <article>, not just once at the top and bottom of the whole page?",
    "header and footer take their meaning from their nearest sectioning ancestor — inside an article they describe just that article, and the page can have as many scoped pairs as it has articles or sections.",
    "Their meaning depends on which element they're nested inside, not their position in the whole document.",
    "header/footer scope to their nearest sectioning ancestor, not just the page.",
    "Yes — each article can have its own header and footer, for example showing that article's author and publish date",
    ["No — header and footer are only valid as direct children of body and cannot appear inside article or section", "Yes, but only footer can repeat per article; header is restricted to one per page", "Yes, but only if the article has no other heading elements inside it"]),

  // ── embedding-content-iframes-external-me ────────────────────────────────
  trivia('html-iframe-srcdoc-attribute', 'embedding-content-iframes-external-me', 2,
    "What does the srcdoc attribute on an <iframe> do differently from src?",
    "srcdoc takes a literal HTML document as its value and renders that markup directly, handy for something like a live HTML preview pane, while src always points at a separate URL the browser has to request.",
    "One of these loads markup handed to it directly; the other always fetches from a URL.",
    "srcdoc renders an inline HTML string directly, no URL fetch needed.",
    "It lets the iframe render an HTML string provided directly in the attribute, instead of fetching a document from a URL",
    ["It sets a fallback URL the iframe loads only if the main src attribute fails to respond", "It preloads the destination page's HTML in the background before the user actually opens the iframe", "It restricts the iframe to only ever displaying plain, unstyled text with no HTML tags rendered"]),

  trivia('html-iframe-sandbox-opt-in-model', 'embedding-content-iframes-external-me', 3,
    "An <iframe> is given a bare sandbox attribute with no value at all. What does the embedded page end up able to do?",
    "An empty sandbox attribute applies every restriction at once, the strictest setting possible; capabilities only come back one at a time via tokens like allow-scripts or allow-forms, which is why sandbox is opt-in rather than opt-out.",
    "A bare sandbox attribute with no tokens is the maximum restriction, not a partial one.",
    "Bare sandbox blocks everything; capabilities return one token at a time.",
    "Essentially nothing extra — scripts, forms, popups, and top navigation are all blocked unless specific allow- tokens are added back",
    ["Everything it could do without sandbox, since an empty sandbox value is treated as if the attribute were left off entirely", "Only scripts are blocked; forms, popups, and navigation still work exactly as normal", "Only navigation away from the iframe is blocked; scripts and forms still run normally"]),

  general('html-iframe-sandbox-allow-tokens-scenario', 'embedding-content-iframes-external-me', 3,
    "We added sandbox to a third-party iframe to lock it down, but now the embedded page's own internal links don't work, and a \"Continue to checkout\" button that's supposed to open a new tab does nothing either. The vendor says everything on their end is fine. What's actually happening, and how do we fix it without removing sandbox entirely?",
    "<p>A bare <code>sandbox</code> attribute blocks every capability by default, including the embedded page's ability to navigate itself or open new browsing contexts, so both symptoms are expected side effects of the strictest possible sandbox setting rather than a bug on the vendor's side.</p><p>The fix isn't removing <code>sandbox</code>, it's adding back only the specific tokens the page actually needs: <code>allow-top-navigation</code> or <code>allow-popups</code> restores the behaviors in question while everything else the embed hasn't been explicitly granted stays blocked.</p><pre><code>&lt;iframe sandbox=\"allow-scripts allow-popups\" src=\"https://vendor.example.com/checkout\"&gt;&lt;/iframe&gt;</code></pre><p>This keeps the embed contained to exactly the capabilities it was given, instead of either locking it down completely or giving up the protection altogether.</p>",
    "sandbox with no value blocks navigation and popups along with everything else — specific tokens have to be added back individually."),

  // ── forms-validation-and-attributes ──────────────────────────────────────
  trivia('html-required-vs-optional-pseudo-class', 'forms-validation-and-attributes', 2,
    "Which CSS pseudo-class matches a form control simply because it has the required attribute, regardless of whether it's currently valid or empty?",
    "required matches purely on the presence of the required attribute itself, independent of validity, which is different from :valid and :invalid, which react to whether the current value actually passes constraint validation.",
    "This one cares about whether the attribute is present, not whether the value is currently correct.",
    ":required reacts to the attribute's presence, not current validity.",
    ":required",
    [":valid", ":invalid", ":placeholder-shown"]),

  general('html-checkvalidity-vs-reportvalidity', 'forms-validation-and-attributes', 2,
    "We call an input's checkValidity() method in some validation code, and it correctly returns false for a bad value, but the user never sees any error message or red outline — the page just silently continues. What's the difference between that method and reportValidity(), and when would we want the one that's actually showing something?",
    "<p><code>checkValidity()</code> only evaluates the field's current constraints and hands back a boolean, with no visible side effect at all, so it's suited to logic that just needs to know pass or fail without involving the user interface.</p><p><code>reportValidity()</code> runs that exact same check but also triggers the browser's native validation UI, showing the built-in error bubble and focusing the first invalid field, which is what's actually needed before letting a user know their submission failed.</p><pre><code>if (!input.checkValidity()) {\n  // silent check, decide something programmatically\n}\nif (!form.reportValidity()) {\n  return; // shows the error bubble, stops submission\n}</code></pre><p>In short, reach for <code>checkValidity()</code> when the result only matters to the code, and <code>reportValidity()</code> whenever the user actually needs to see what's wrong.</p>",
    "One of the two methods also triggers the browser's visible error UI; the other just returns a boolean."),

  trivia('html-input-file-accept-attribute', 'forms-validation-and-attributes', 2,
    "Which attribute restricts which file types a user is offered when they open the file picker for <input type=\"file\">?",
    "accept takes a list of MIME types or file extensions, like accept=\"image/png, image/jpeg\", and filters what the native file picker shows by default; it's a hint for the picker, not a hard server-side guarantee, so the backend still needs to validate the uploaded file itself.",
    "It's named for what kinds of files the input will take, not how it validates them after upload.",
    "accept filters what the native file picker shows, as a hint not a guarantee.",
    "accept",
    ["pattern", "type", "accept-charset"]),

  // ── accessibility-in-html ────────────────────────────────────────────────
  trivia('html-aria-label-vs-labelledby', 'accessibility-in-html', 2,
    "A button has visible text elsewhere on the page in an <h2 id=\"section-title\">, and the button needs that exact text as its accessible name. What's the difference between using aria-label and aria-labelledby here?",
    "aria-labelledby takes element ids and uses their text content as the accessible name, so it stays in sync if that text changes. aria-label instead takes a literal string typed directly into the attribute.",
    "One of the two takes an id reference to existing text; the other takes a typed-out string.",
    "aria-labelledby reuses existing text by id; aria-label needs a retyped string.",
    "aria-labelledby references the heading's id and reuses its text, while aria-label needs the text retyped as a separate string",
    ["aria-label and aria-labelledby are simply two different names for the exact same underlying browser behavior", "aria-labelledby is only valid on form input elements, while aria-label can be applied to any element at all", "aria-label points to another element by its id, while aria-labelledby takes a literal typed-out string directly"]),

  trivia('html-focus-outline-removed-no-replacement', 'accessibility-in-html', 2,
    "A stylesheet includes *:focus { outline: none; } to get rid of the \"ugly\" blue focus ring across the whole site, with nothing added in its place. What's the accessibility consequence?",
    "The focus outline is the primary way a sighted keyboard user tracks where they are on the page as they Tab through it. Removing it with nothing in its place doesn't disable keyboard navigation itself, but it makes that navigation effectively blind. The fix is replacing the default with a custom visible focus style, not deleting it outright.",
    "Think about which specific group of users relies on this visual cue to navigate at all, and what happens when it's simply deleted.",
    "Removing the focus ring with no replacement blinds keyboard navigation.",
    "Keyboard users lose all visual indication of where focus currently is, making the page hard to navigate without a mouse",
    ["Nothing changes for keyboard users at all; outline: none only ever affects the mouse-hover styling, not focus state", "Screen reader users lose the ability to navigate the page at all, since outline and screen reader support are directly linked", "The browser automatically substitutes in its own default focus ring whenever a page stylesheet tries to remove it"]),

  // ── metadata-and-seo-basics ───────────────────────────────────────────────
  trivia('html-robots-txt-vs-meta-robots', 'metadata-and-seo-basics', 2,
    "What's the key difference between a site's robots.txt file and a page's <meta name=\"robots\"> tag?",
    "robots.txt lives once at the root of a domain and tells crawlers which paths they're allowed to request at all, before they ever load a page. The meta robots tag lives inside one specific page's own head and controls what happens after that page has already been crawled, like whether it should be indexed or whether its links should be followed.",
    "One lives at the domain root and applies broadly before a page loads; the other lives inside one page's own head.",
    "robots.txt sets crawling rules site-wide; the meta tag sets rules per page.",
    "robots.txt sets crawling rules site-wide from one file at the domain root; the meta tag sets rules per page, inside that page's head",
    ["They're just two different syntaxes for writing the exact same rule, and either one works interchangeably anywhere", "robots.txt actually controls indexing on a per-page basis, while the meta robots tag controls crawling site-wide", "robots.txt only ever applies to image and media files, while the meta robots tag only applies to HTML pages"]),

  trivia('html-title-tag-recommended-length', 'metadata-and-seo-basics', 1,
    "What's the generally recommended length for a page's <title> tag so it doesn't get truncated in search results?",
    "Search engines typically truncate a displayed title around 50-60 characters, or whenever it exceeds the pixel width available in the results snippet, so keeping the actual title text within that range helps make sure the whole thing shows up instead of getting cut off mid-word.",
    "It's shorter than the length guideline for a meta description, not longer.",
    "Titles get truncated around 50-60 characters in search results.",
    "Roughly 50–60 characters",
    ["Roughly 10–20 characters", "Roughly 100–120 characters", "Roughly 300–320 characters"]),

  // ── web-components (priority gap — 14 questions) ────────────────────────
  trivia('html-wc-disconnectedcallback', 'web-components', 2,
    "Which lifecycle callback runs on a custom element right before it's removed from the document, and is the right place to release resources like event listeners or timers?",
    "disconnectedCallback fires every time the element is taken out of the DOM, whether that's a deliberate removal or because an ancestor was removed — it's the natural place to tear down anything set up in connectedCallback, like event listeners, intervals, or observers, so they don't keep running against a detached element.",
    "Think about the mirror image of connectedCallback — what happens on the way out, not the way in.",
    "disconnectedCallback fires on removal — the natural cleanup point.",
    "disconnectedCallback, which runs whenever the element is removed from the DOM",
    ["constructor, which runs once when the element instance is first created", "attributeChangedCallback, which runs whenever a watched attribute's value changes", "adoptedCallback, which runs whenever the element moves to a new document via document.adoptNode"]),

  trivia('html-wc-observedattributes-optin', 'web-components', 2,
    "A custom element defines an attributeChangedCallback, but changing one of its attributes never triggers it. What's the most likely reason?",
    "The browser only calls attributeChangedCallback for attributes explicitly named in a static observedAttributes array/getter on the class. Any attribute change outside that list is silently ignored, which is exactly why a defined callback can still go uninvoked.",
    "The callback existing isn't enough on its own — something else has to opt specific attribute names in.",
    "Only attributes listed in observedAttributes trigger the callback.",
    "The element never defined a static observedAttributes getter listing that attribute, so the browser never bothers watching it",
    ["attributeChangedCallback only ever fires once, the very first time the element gets attached to the page at all", "Attributes set through setAttribute() in JavaScript never trigger callbacks, only ones written directly in the HTML markup", "The element needs attachShadow() called first, since attributeChangedCallback only works inside shadow DOM elements"]),

  general('html-wc-observedattributes-scenario', 'web-components', 3,
    "A <progress-ring> custom element exposes a value HTML attribute, and the author wants its internal SVG circle to redraw automatically whenever <progress-ring value=\"40\"> is edited in dev tools, without the page doing anything else. What two pieces does the component need, and how do they work together?",
    "<p>Two pieces have to work together. First, the class needs a <code>static get observedAttributes()</code> getter that returns an array including <code>\"value\"</code> — this is what tells the browser to actually watch that attribute for changes at all, since by default it watches nothing.</p><p>Second, the class needs an <code>attributeChangedCallback(name, oldValue, newValue)</code> method. Once <code>value</code> is in the observed list, the browser calls this method automatically every time the attribute changes, passing along the old and new values, and the method's job is to read <code>newValue</code> and update the SVG circle accordingly.</p><pre><code>static get observedAttributes() {\n  return [\"value\"];\n}\n\nattributeChangedCallback(name, oldValue, newValue) {\n  this.updateCircle(Number(newValue));\n}</code></pre><p>Leaving either piece out breaks the chain: without <code>observedAttributes</code> listing <code>\"value\"</code>, the callback simply never runs for that attribute, no matter how it's defined.</p>",
    "One piece opts the attribute in for watching; the other piece reacts once it's being watched."),

  trivia('html-wc-host-selector', 'web-components', 2,
    "Inside a custom element's shadow DOM stylesheet, which selector targets the custom element itself (the host), as opposed to anything inside its shadow tree?",
    ":host is the sole selector that reaches outside the shadow root to style the custom element itself from inside its own shadow DOM stylesheet — nothing else in that stylesheet can select the host element directly.",
    "It's a pseudo-class, not a pseudo-element, and it only works from inside the shadow root's own stylesheet.",
    ":host is the only selector reaching the custom element from inside its own shadow styles.",
    ":host",
    ["::host", ":root", ":scope"]),

  general('html-wc-custom-properties-theming', 'web-components', 3,
    "A <themed-button> custom element uses Shadow DOM for style encapsulation, and a consuming page wants to let different pages set its background color differently without ever reaching inside the shadow tree. Regular CSS selectors from the page can't touch anything inside the shadow DOM — so how is page-level theming supposed to work at all?",
    "<p>Shadow DOM blocks ordinary selectors from the outside world from reaching in, but CSS custom properties are a deliberate exception — they inherit through the shadow boundary like any other inherited CSS value. The component defines its internal style using a custom property with a fallback, and the page sets that property on the host element from outside.</p><pre><code>/* inside the component's shadow stylesheet */\n.button { background: var(--btn-bg, steelblue); }\n\n/* on the consuming page */\nthemed-button { --btn-bg: darkgreen; }</code></pre><p>The page never needs a selector that reaches inside the shadow tree at all — it only ever sets a custom property on the host element in ordinary page CSS, and the value flows in through inheritance. This is the standard way web components expose a deliberate, limited styling API without giving up encapsulation entirely.</p>",
    "Shadow DOM blocks selectors from crossing in, but one specific kind of CSS value is designed to inherit across that boundary anyway."),

  trivia('html-wc-declarative-shadow-dom', 'web-components', 3,
    "What does writing <template shadowrootmode=\"open\"> directly inside a custom element's markup in server-rendered HTML accomplish?",
    "Declarative Shadow DOM lets the HTML parser itself create and attach a shadow root the moment it parses a template with a shadowrootmode attribute, turning its content into that shadow root's content immediately. This is what makes server-rendered web components show their shadow DOM content correctly before any JavaScript has run, which matters a lot for SSR and first paint.",
    "This feature exists specifically so a shadow root can show up without waiting for any script to execute.",
    "Declarative Shadow DOM attaches a shadow root during HTML parsing, no JS needed.",
    "It attaches a shadow root to the element as soon as the HTML parses, with no JavaScript required at all",
    ["It's purely a hint for build tools; the browser still needs attachShadow() called in JavaScript to do anything", "It pre-loads the component's JavaScript file referenced elsewhere on the page", "It behaves exactly like a regular template, staying inert until some script clones and attaches it manually"]),

  trivia('html-wc-named-slots', 'web-components', 2,
    "A component's shadow DOM has two slots: <slot name=\"header\"></slot> and a default, unnamed <slot></slot>. In the light DOM, how does a consumer direct an element into the named \"header\" slot specifically?",
    "A light-DOM element only lands in a named slot when it carries a matching slot=\"...\" attribute — the browser matches that attribute's value against the slot's name attribute. Anything without a matching slot attribute falls into the single unnamed, default slot instead.",
    "The matching happens through an attribute on the light-DOM element, not through its tag name or position.",
    "A matching slot=\"\" attribute routes a light-DOM element into a named slot.",
    "By giving that element a slot=\"header\" attribute in the light DOM",
    ["By naming the element's own tag header so it matches automatically", "By placing the element as the very first child inside the custom element's tags", "Named slots can only be filled from inside the component's own shadow DOM, not from the light DOM"]),

  general('html-wc-slot-fallback-content', 'web-components', 2,
    "A <user-avatar> component's shadow DOM includes <slot name=\"status\"></slot> for an online/offline indicator, but most consumers never bother providing one. What determines what actually shows up in that slot when nobody fills it, and how would the component author control it?",
    "<p>When a slot has no matching light-DOM content assigned to it, whatever markup is written directly inside the <code>&lt;slot&gt;</code> tag in the shadow DOM renders instead, as fallback content. It's ordinary HTML written right there in the shadow template.</p><pre><code>&lt;slot name=\"status\"&gt;\n  &lt;span class=\"dot offline\"&gt;&lt;/span&gt;\n&lt;/slot&gt;</code></pre><p>Any consumer who does provide a matching <code>slot=\"status\"</code> element overrides this fallback entirely — the fallback only ever renders when the slot would otherwise be empty. This lets a component ship a sensible default appearance while still letting consumers override it when they have something more specific to show.</p>",
    "Content written directly between a slot's own opening and closing tags behaves like a default, only used when nothing from the light DOM claims that slot."),

  trivia('html-wc-define-throws-on-reregister', 'web-components', 2,
    "A script calls customElements.define(\"user-card\", UserCard) twice, once in two different files that both happen to run on the same page. What happens the second time?",
    "customElements.define() throws a NotSupportedError the moment a tag name is registered a second time — custom element registrations are permanent for the lifetime of the page and can never be overwritten or redefined, which is exactly why loading the same component's script twice is a real bug, not just a harmless no-op.",
    "Think about whether a tag name registration, once made, can ever be taken back or swapped out.",
    "define() throws on a second registration of the same tag name.",
    "The browser throws an error, because a tag name can only be registered once per page",
    ["The second definition silently replaces the first, and all existing user-card elements switch to the new class", "Both definitions are merged, with the second file's methods added onto the first class", "Nothing happens until the page is refreshed, at which point only the second definition takes effect"]),

  trivia('html-wc-get-whendefined', 'web-components', 2,
    "Before manually creating a <fancy-tabs> element with document.createElement, how can code check whether that tag has actually been registered yet, without just trying it and catching an error?",
    "customElements.get() returns the registered constructor for a given tag name, or undefined if nothing has registered it yet, making it the direct way to check registration status. Its companion, customElements.whenDefined(), returns a promise that resolves once that tag does get registered.",
    "There's a method on customElements made specifically for checking registration status by name.",
    "customElements.get() returns the constructor or undefined — the way to check.",
    "Call customElements.get(\"fancy-tabs\") and check whether it returns the class or undefined",
    ["Check document.querySelector(\"fancy-tabs\") and see whether it returns an element", "Read the tag's dataset.defined property, which the browser sets automatically once it's registered", "There's no way to check; customElements.define() must simply be called defensively every time"]),

  general('html-wc-extending-built-ins', 'web-components', 3,
    "A team wants a custom element that behaves like a real <button> in every way browsers already handle for free, like form submission, keyboard activation, and built-in accessibility, but adds its own extra styling and behavior on top. Wrapping a plain <button> inside a custom element's shadow DOM is one option, but what's the alternative that lets the custom element be a button directly?",
    "<p>Rather than wrapping a native <code>&lt;button&gt;</code> inside a separate custom element, it's possible to extend the built-in element directly: a class extends <code>HTMLButtonElement</code> instead of the plain <code>HTMLElement</code> base class, and registers with an <code>extends</code> option naming the built-in tag.</p><pre><code>class FancyButton extends HTMLButtonElement {\n  connectedCallback() {\n    this.addEventListener(\"click\", () =&gt; this.classList.add(\"pressed\"));\n  }\n}\ncustomElements.define(\"fancy-button\", FancyButton, { extends: \"button\" });</code></pre><p>Consumers then write a real <code>&lt;button&gt;</code> tag with an <code>is</code> attribute naming the custom element: <code>&lt;button is=\"fancy-button\"&gt;Save&lt;/button&gt;</code>. Because the element genuinely is a <code>&lt;button&gt;</code>, it keeps every native behavior browsers already implement, like form submission and keyboard activation, which a from-scratch custom element would otherwise have to reimplement by hand.</p>",
    "Rather than building a custom element from scratch, a class can extend an existing built-in element's own class."),

  trivia('html-wc-html-imports-deprecated', 'web-components', 2,
    "Older web component tutorials mention \"HTML Imports\" (<link rel=\"import\">) as a way to load and share component definitions across files. What's the status of that feature today, and what replaced it?",
    "HTML Imports shipped only in old Chrome versions, never gained support elsewhere, and were eventually removed from the spec and from Chrome itself. The web platform settled on plain JavaScript modules instead — a component's class and its customElements.define() call just live in a regular .js file, loaded with a module script or a bundler, with no separate import mechanism needed.",
    "This is a case of a once-proposed platform feature that didn't survive, not a feature still in active use.",
    "HTML Imports were removed from the spec; ES modules replaced them.",
    "HTML Imports were dropped from the spec and removed from browsers; components now share code as plain ES modules instead",
    ["HTML Imports are still the current recommended approach, and every major browser continues to support them natively", "HTML Imports are deprecated but can still be enabled behind a flag or used via a polyfill in current browsers", "HTML Imports still function today, but only when the imported file is wrapped in a template element first"]),

  general('html-wc-event-retargeting-composed', 'web-components', 3,
    "A <rating-widget> custom element dispatches a custom event called rating-changed from inside its shadow DOM whenever the user clicks a star, using this.dispatchEvent(new CustomEvent(\"rating-changed\", { detail: 4 })). A listener attached to the <rating-widget> element itself on the main page never fires. What's missing, and why does it matter that the event started inside a shadow tree?",
    "<p>By default, an event dispatched inside a shadow tree stops at the shadow boundary and never reaches listeners attached outside it, because its <code>composed</code> flag defaults to <code>false</code>. The fix is passing <code>composed: true</code> when constructing the event:</p><pre><code>this.dispatchEvent(new CustomEvent(\"rating-changed\", {\n  detail: 4,\n  bubbles: true,\n  composed: true\n}));</code></pre><p>With <code>composed: true</code>, the event is allowed to cross out of the shadow tree and continue bubbling up through the light DOM, so a listener on the <code>&lt;rating-widget&gt;</code> element on the main page finally receives it. This boundary exists so that a component's internal implementation details, like clicks on individual stars inside its shadow DOM, don't leak out as generic events unless the component author deliberately opts a specific event into crossing that line.</p>",
    "One specific option on the event itself controls whether it's allowed to cross out of the shadow tree at all."),

  general('html-wc-property-attribute-reflection', 'web-components', 3,
    "A <my-checkbox> custom element has a JavaScript checked property that toggles its internal state perfectly when set from JavaScript (el.checked = true), but CSS written as my-checkbox[checked] { ... } on the page never matches, even right after setting that property. What's missing, and what would need to change?",
    "<p>Setting a JavaScript property on an element doesn't automatically touch its HTML attributes, and CSS attribute selectors like <code>[checked]</code> only ever look at the actual attribute, not the property. The <code>checked</code> property and the <code>checked</code> attribute are two separate things here that happen to share a name, and nothing is keeping them in sync.</p><pre><code>class MyCheckbox extends HTMLElement {\n  get checked() {\n    return this.hasAttribute(\"checked\");\n  }\n  set checked(value) {\n    if (value) {\n      this.setAttribute(\"checked\", \"\");\n    } else {\n      this.removeAttribute(\"checked\");\n    }\n  }\n}</code></pre><p>This pattern, writing the property's setter so it also updates the matching attribute, is called reflection. Once the property setter reflects to the attribute, setting <code>el.checked = true</code> from JavaScript also adds the <code>checked</code> attribute, which is what finally makes <code>my-checkbox[checked]</code> start matching in CSS.</p>",
    "A JavaScript property and an HTML attribute of the same name don't update each other automatically — something has to be written to keep them in sync."),
];

function validateLengths() {
  const problems: string[] = [];
  const seenSlugs = new Set<string>();
  for (const q of QUESTIONS) {
    if (q.slug.length > 100) problems.push(`${q.slug}: slug ${q.slug.length} chars > 100`);
    if (seenSlugs.has(q.slug)) problems.push(`${q.slug}: duplicate slug within this file`);
    seenSlugs.add(q.slug);
    if (q.questionType === QuestionTypeEnum.Trivia && q.options.filter((o) => o.correct).length !== 1) {
      problems.push(`${q.slug}: Trivia question must have exactly 1 correct option`);
    }
    for (const opt of q.options) {
      if (opt.option.length > 255) problems.push(`${q.slug}: option text ${opt.option.length} chars > 255`);
      if (opt.comment && opt.comment.length > 200) problems.push(`${q.slug}: comment ${opt.comment.length} chars > 200 ("${opt.comment.slice(0, 40)}...")`);
    }
  }
  if (problems.length) {
    console.error('Length violations found (would silently truncate mid-word — see QuestionOption.comment history):');
    for (const p of problems) console.error('  - ' + p);
    throw new Error(`${problems.length} length violation(s) — aborting before any writes.`);
  }
  console.log(`✔ Length check passed — all ${QUESTIONS.length} questions' options/comments within limits.\n`);
}

async function run() {
  validateLengths();
  await AppDataSource.initialize();
  console.log('Database connected.\n');

  const subjectRepo = AppDataSource.getRepository(Subject);
  const topicRepo = AppDataSource.getRepository(Topic);
  const questionRepo = AppDataSource.getRepository(Question);
  const optionRepo = AppDataSource.getRepository(QuestionOption);
  const qTopicRepo = AppDataSource.getRepository(QuestionTopic);

  const subject = await subjectRepo.findOne({ where: { slug: 'html' } });
  if (!subject) throw new Error('Subject "html" not found.');

  const topicSlugs = [...new Set(QUESTIONS.map((q) => q.topicSlug))];
  const topics = await topicRepo.find({ where: topicSlugs.map((slug) => ({ slug })) as any });
  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));
  for (const slug of topicSlugs) {
    if (!topicBySlug.has(slug)) throw new Error(`Topic "${slug}" not found — aborting.`);
  }

  let created = 0, skipped = 0, optionsCreated = 0, linksCreated = 0;

  for (const q of QUESTIONS) {
    const existing = await questionRepo.findOne({ where: { slug: q.slug } });
    if (existing) { skipped++; continue; }

    const question = await questionRepo.save(questionRepo.create({
      slug: q.slug,
      title: null,
      question: q.question,
      subjectId: subject.id,
      questionType: q.questionType,
      level: q.level,
      marks: MARKS,
      timeAllowed: TIME_ALLOWED,
      tag: null,
      status: QuestionStatusEnum.Active,
      isWhitelisted: false,
      answer: q.answer,
      hint: q.hint,
      orderId: 1,
    }));
    created++;

    for (const opt of q.options) {
      await optionRepo.save(optionRepo.create({
        questionId: question.id,
        option: opt.option,
        correct: opt.correct,
        comment: opt.comment,
      }));
      optionsCreated++;
    }

    const topic = topicBySlug.get(q.topicSlug)!;
    await qTopicRepo.save(qTopicRepo.create({ questionId: question.id, topicId: topic.id }));
    linksCreated++;
  }

  console.log(`✔ Questions   : ${QUESTIONS.length} declared (${created} created, ${skipped} already existed)`);
  console.log(`✔ Options     : ${optionsCreated} created`);
  console.log(`✔ Topic links : ${linksCreated} created`);

  console.log('\nPer-topic Active question counts after this run:');
  for (const slug of topicSlugs) {
    const topic = topicBySlug.get(slug)!;
    const count = await qTopicRepo.count({ where: { topicId: topic.id } });
    console.log(`   ${slug.padEnd(40)} ${count} linked (this + any pre-existing)`);
  }

  await AppDataSource.destroy();
  console.log('\nDone.');
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
