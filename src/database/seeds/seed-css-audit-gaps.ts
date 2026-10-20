import { AppDataSource } from '../data-source';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';

// Gap-fill pass from the CSS Question Bank Audit (docs/CSS-Question-Bank-Audit-2026-10-02.md,
// reviewed by the user via a published artifact before this run). These 60 questions cover
// concepts the audit found entirely absent from the existing 287 Active CSS questions — they
// do not touch, duplicate, or replace any existing row. Seeded straight to Active per the
// agreed review-before-seed workflow. The 4 critical data bugs and 20 near-duplicate pairs the
// audit also found are deliberately NOT addressed by this script — that's separate, more
// invasive work on already-live rows, tracked but not yet actioned.
//
// Usage: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-css-audit-gaps.ts

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

  // ── css-basics ───────────────────────────────────────────────────────────
  trivia('css-basics-rem-vs-em-unit', 'css-basics', 1,
    "What is the key difference between the rem and em units in CSS?",
    "rem is always relative to the root element's (html) font size, no matter how deeply the element using it is nested. em is relative to the font size of its own nearest parent, so the same em value can compute to a different pixel size depending on where it's used.",
    "One always looks to the document root; the other looks to its nearest parent.",
    "rem stays anchored to the document root no matter how deeply nested the element is.",
    "rem is always relative to the root element's font size, not the parent's",
    ["em is always relative to the root element's font size, not the parent's", "rem and em both ignore the root font size entirely", "rem only works inside media queries, never in regular rules"]),

  trivia('css-basics-viewport-units-vw-vh', 'css-basics', 2,
    "What do the vw and vh units measure an element's size against?",
    "vw and vh stand for viewport width and viewport height — 1vw equals 1% of the browser viewport's current width, and 1vh equals 1% of its current height, regardless of the element's own parent or position on the page.",
    "Think about \"viewport width\" and \"viewport height\" — the v is the clue.",
    "vw/vh scale against the browser window itself, not any ancestor element.",
    "A percentage of the browser viewport's width and height",
    ["A percentage of the parent element's width and height", "A fixed multiple of the root font size", "The physical screen resolution in actual pixels"]),

  general('css-basics-why-rem-for-font-sizing', 'css-basics', 1,
    "Why do many teams prefer rem over px when setting base font sizes across a site?",
    "Because rem is relative to the root font size, scaling that one root value (for example, when a visitor increases their browser's default font size for accessibility) scales every rem-based size across the page proportionally. A fixed px value never responds to that root change, so text set in px can stay uncomfortably small for visitors who have adjusted their browser's accessibility settings.",
    "Think about what happens when a visitor changes their browser's default font size."),

  trivia('css-basics-important-overrides-specificity', 'css-basics', 2,
    "If a lower-specificity rule uses !important, how does it compare to a higher-specificity rule without it?",
    "The !important flag is specifically designed to override the normal cascade order: a rule carrying it wins over any conflicting rule that lacks it, even one with far higher specificity, because the browser checks for !important before it ever compares specificity.",
    "It's designed to override the normal specificity order entirely.",
    "!important is explicitly designed to override the normal specificity order.",
    "The !important rule wins, regardless of the other rule's specificity",
    ["The higher-specificity rule still wins, since specificity always comes first", "The rule written earlier in the file always wins instead", "Both rules are ignored and the browser default applies"]),

  general('css-basics-two-important-rules-conflict', 'css-basics', 2,
    "Two conflicting rules on the same element both use !important. Which one wins?",
    "When both rules carry !important, the !important flags cancel each other out and normal specificity rules decide the winner between them. If specificity is also tied, the rule that appears later in the source order wins, just as it would without !important involved.",
    "If !important no longer breaks the tie, what normally decides it?"),

  trivia('css-basics-hover-pseudo-class', 'css-basics', 1,
    "Which selector changes a button's style only while the mouse pointer is over it?",
    "button:hover applies a pseudo-class that the browser activates automatically while the pointer sits over that specific element, and removes the moment the pointer leaves — it isn't a real class or attribute written anywhere in the HTML.",
    "It's a pseudo-class triggered by mouse position, not a real class or attribute.",
    ":hover is a pseudo-class, triggered by pointer position, not a real class or attribute.",
    "button:hover { }",
    ["button:focus { }", "button.hover { }", "button[hover] { }"]),

  // ── box-model-positioning ────────────────────────────────────────────────
  trivia('box-model-overflow-hidden-behavior', 'box-model-positioning', 1,
    "What does overflow: hidden do to content that doesn't fit inside its box?",
    "overflow: hidden clips any content that extends past the box's boundary, making that extra content simply not visible — the content itself stays in the HTML and the DOM, it just isn't rendered on screen.",
    "The extra content doesn't disappear from the HTML — it just isn't shown.",
    "The content stays in the HTML; it's just not rendered visibly.",
    "Clips the overflowing content so it's simply not visible",
    ["Shrinks the content's font size until it fits inside the box", "Adds scrollbars so the extra content can be scrolled into view", "Pushes the box's siblings out of the way to make more room"]),

  trivia('box-model-overflow-auto-vs-scroll', 'box-model-positioning', 2,
    "What's the practical difference between overflow: auto and overflow: scroll?",
    "overflow: auto only shows scrollbars when the content actually overflows the box, staying invisible otherwise, while overflow: scroll always reserves scrollbar space and shows scrollbars on that axis whether or not the content currently overflows.",
    "One always reserves scrollbar space; the other only shows up when needed.",
    "auto is conditional; scroll always reserves scrollbar space.",
    "auto shows scrollbars only when content overflows; scroll shows them always",
    ["auto only works on images, while scroll works on any element", "scroll only works horizontally, while auto only works vertically", "They behave identically in every browser and situation"]),

  general('box-model-overflow-clipped-card-text', 'box-model-positioning', 1,
    "A card component has a fixed height, and longer descriptions get cut off abruptly at the bottom edge with no indication there's more text. What CSS causes this, and how would we show an ellipsis instead?",
    "A fixed-height box with overflow: hidden clips any text past its boundary with no visual cue that content was cut. Combining overflow: hidden with text-overflow: ellipsis and white-space: nowrap (for a single line), or a multi-line clamp like -webkit-line-clamp, shows a trailing ellipsis so visitors know the text was truncated.",
    "The fix needs a second property beyond overflow: hidden to show the cut-off cue."),

  trivia('box-model-max-width-responsive-image', 'box-model-positioning', 1,
    "Which CSS rule keeps an image from ever rendering wider than its container, while still shrinking on smaller screens?",
    "max-width: 100% caps the image's rendered width at its container's width and lets it shrink below that on smaller screens, while height: auto scales the height proportionally so the image never distorts.",
    "One keyword caps the size; its opposite would force growth instead.",
    "max-width caps the size; height: auto keeps proportions as it shrinks.",
    "img { max-width: 100%; height: auto; }",
    ["img { width: 100%; height: 100%; }", "img { min-width: 100%; height: auto; }", "img { width: fixed; height: fixed; }"]),

  trivia('box-model-min-height-vs-height', 'box-model-positioning', 2,
    "Why might a developer use min-height instead of height on a content box?",
    "min-height sets only a lower bound — the box can still grow taller than that value if its content needs more room — while a fixed height caps the box regardless of content, which can clip or overflow longer content instead of accommodating it.",
    "One sets a hard size; the other sets a lower bound the box can still exceed.",
    "min-height is a floor, not a fixed ceiling — the box can still grow.",
    "min-height allows the box to grow beyond it if content needs more room",
    ["min-height behaves exactly the same as height in absolutely every situation", "min-height only has any effect inside flex and grid container layouts", "height always expands automatically with content, while min-height never does"]),

  general('box-model-max-width-text-column', 'box-model-positioning', 1,
    "A paragraph of body text stretches edge-to-edge on a wide desktop monitor, making lines uncomfortably long to read. What's a simple CSS fix?",
    "Setting a max-width on the text container, often somewhere around 60ch to 75ch (a unit based on character width), caps how wide the line of text can grow on large screens while still letting it shrink naturally on smaller ones. This keeps line lengths comfortable to read without needing a fixed pixel width that would break responsiveness.",
    "The fix caps the width without hardcoding a pixel value that would break on smaller screens."),

  trivia('box-model-outline-vs-border-layout', 'box-model-positioning', 2,
    "Why doesn't adding an outline to an element change its rendered box size, the way adding a border does?",
    "outline is drawn on top of the element's rendered box, outside the normal box-model layers, so it's never factored into the width/height math the way border, padding, or margin are — adding one never pushes neighboring content around.",
    "It's drawn on top of the layout, not factored into width/height math.",
    "outline is drawn on top of the layout rather than being part of the box model's own math.",
    "outline sits outside the box and isn't counted in the box model's size at all",
    ["outline is just another name for the border property", "outline only ever appears while an element has keyboard focus", "outline always has a width of zero unless a border exists too"]),

  general('box-model-focus-outline-accessibility', 'box-model-positioning', 1,
    "A developer removes the default focus outline on buttons with outline: none to \"clean up\" the design. What problem does this create?",
    "Removing the default focus outline strips away the only visual signal that keyboard and switch-device users rely on to tell which element is currently focused, making the page very difficult to navigate without a mouse. A better fix is to replace it with a custom focus style, such as a visible box-shadow or a styled outline, rather than removing the indicator entirely.",
    "Think about who relies on a visible focus indicator to navigate at all."),

  // ── flexbox ──────────────────────────────────────────────────────────────
  trivia('flex-flow-shorthand-basic', 'flexbox', 1,
    "Which single property is shorthand for setting both flex-direction and flex-wrap together?",
    "flex-flow combines flex-direction and flex-wrap into one declaration, written as e.g. flex-flow: row wrap. It's unrelated to the flex shorthand, which instead sets flex-grow, flex-shrink, and flex-basis on an item.",
    "It's a shorthand that bundles two axis-related properties — not the grow/shrink/basis one.",
    "flex-flow combines flex-direction and flex-wrap into one declaration, e.g. flex-flow: row wrap. The flex shorthand is different — it sets grow/shrink/basis.",
    "flex-flow",
    ["flex", "flex-direction", "flex-wrap"]),

  trivia('flex-flow-column-wrap-meaning', 'flexbox', 2,
    "What does flex-flow: column wrap declare on a flex container?",
    "This is shorthand for flex-direction: column combined with flex-wrap: wrap — items stack vertically along the main axis, and once a column fills up, later items start a new column alongside it instead of overflowing.",
    "column sets the axis; wrap controls what happens when items don't fit.",
    "Shorthand for flex-direction: column; flex-wrap: wrap — items start a new column alongside the full one.",
    "The main axis is vertical, and items wrap onto new columns once a column fills up",
    ["The main axis is horizontal, and items wrap onto new rows once a row fills up", "The main axis is vertical, but wrapping is disabled, so items stay in one column", "The container's own box wraps onto multiple lines like regular text"]),

  trivia('flex-wrap-wrap-reverse-behavior', 'flexbox', 2,
    "How does flex-wrap: wrap-reverse differ from flex-wrap: wrap?",
    "Both values wrap items onto multiple lines the same way, but wrap-reverse flips which cross-axis direction new lines stack toward — the first line created under wrap-reverse ends up positioned at the opposite end from where wrap would have placed it.",
    "It changes which direction new lines stack toward, not the order of items within a line.",
    "Keeps the same wrapping behavior as wrap but flips which cross-axis end new lines stack toward.",
    "Lines still wrap, but stack in reverse cross-axis order instead of the usual order",
    ["Items wrap in the opposite main-axis order, so the last item appears first", "Items no longer wrap at all; they shrink to fit one line instead", "It wraps items but removes any gap between the lines"]),

  general('flex-wrap-reverse-vertical-stack-order', 'flexbox', 2,
    "A flex container uses flex-wrap: wrap-reverse instead of wrap. What visibly changes about how the wrapped lines stack?",
    "The items within each line keep their normal order, but the lines themselves stack in the opposite direction along the cross axis. In a row container, for example, wrap builds new lines downward, while wrap-reverse builds them upward instead, so the first line created ends up at the bottom.",
    "The item order inside each line is unaffected — only the lines' own stacking direction changes."),

  // ── css-grid ─────────────────────────────────────────────────────────────
  trivia('grid-track-size-min-content-keyword', 'css-grid', 2,
    "In grid-template-columns, what does a track sized with the min-content keyword do?",
    "A min-content track shrinks to the smallest width the content can occupy without overflowing or losing information — typically the width of its longest unbreakable word or inline element — rather than growing to fit all available space.",
    "Think about the smallest the content could possibly be without actually overflowing.",
    "min-content sizes to the smallest width without overflowing — the longest word, for an unbroken string.",
    "The column shrinks to the content's smallest possible width, such as its longest unbreakable word",
    ["The column grows to the content's widest possible width, as if nothing ever wrapped", "The column is set to a fixed percentage of the container's width", "The column behaves exactly like fr, based on leftover space"]),

  trivia('grid-auto-columns-max-content-keyword', 'css-grid', 1,
    "Which keyword, when used as a track size, makes a grid column exactly as wide as its widest piece of content, even if that means overflowing the row?",
    "max-content sizes a track to the full natural width its content would take with no wrapping at all, ignoring the container's available space — unlike fr or minmax(), which are constrained to what the container can actually offer.",
    "It takes the content's maximum natural size, not a shrink-to-fit size.",
    "Ignores the container's available space entirely and can overflow — unlike fr or minmax().",
    "max-content",
    ["min-content", "fit-content", "auto"]),

  general('grid-fit-content-vs-minmax-free-space', 'css-grid', 3,
    "How does a column sized with fit-content(200px) behave differently from one sized with minmax(0, 200px) when there's extra free space in the row?",
    "These two track sizes behave differently once there's leftover row space to distribute: fit-content(200px) grows with its content only up to 200px, then stops — it never stretches further no matter how much free space remains. minmax(0, 200px) is a flexible track: even when the content itself is much smaller, it can still be stretched up to its 200px ceiling if there's free space to give it.",
    "Ask whether the track is willing to grow PAST its content's own natural size using leftover space."),

  trivia('grid-template-areas-dot-empty-cell', 'css-grid', 2,
    "In a grid-template-areas declaration, what does a single period (.) represent in place of a name?",
    "A lone period marks a grid cell that is deliberately left empty — no named area occupies that cell, but it still takes up its own row/column slot in the layout rather than being skipped or merged.",
    "It marks a gap, not a name.",
    "It still takes up a row/column slot — it's just deliberately unoccupied.",
    "An empty grid cell that no named area occupies",
    ["A cell that repeats the area named directly above it", "A syntax error that CSS Grid ignores silently", "A cell that is merged with the next cell in the row"]),

  trivia('grid-template-areas-row-string-mismatch', 'css-grid', 3,
    "A grid-template-areas declaration has one row string with 3 names and the next row string with only 2 names. What happens?",
    "CSS Grid requires every row string in a grid-template-areas declaration to describe the same number of cells, so a mismatched row makes the whole property invalid — the browser discards it and falls back to the grid's normal auto-placement behavior instead.",
    "Grid is strict about rectangular shapes here — row strings must line up.",
    "A mismatched row count makes the entire property invalid, falling back to normal auto-placement.",
    "The whole declaration is invalid, since each row string needs the same cell count",
    ["The second row's last column is silently left empty", "The last named area in the second row stretches across two tracks", "Only that one row is skipped; the rest of the areas still apply"]),

  general('grid-template-areas-empty-cell-example', 'css-grid', 2,
    "A 3-column page layout needs a header spanning the full width, a sidebar and main content in the second row, and an empty gap in the third row where the first column would normally sit. How would grid-template-areas express that empty cell?",
    "A period (.) stands in for an unnamed, empty cell anywhere inside a grid-template-areas string. For this layout the rows could be written as grid-template-areas: \"header header header\" \"sidebar main main\" \". footer footer\"; — the period in the third row leaves that cell empty while footer still spans the remaining two columns.",
    "One punctuation character fills the gap without needing an extra named area."),

  general('flexbox-vs-grid-photo-gallery-decision', 'css-grid', 2,
    "A photo gallery needs tiles that align into both consistent rows and consistent columns at the same time, reflowing as the window resizes. Should this be built with Flexbox or CSS Grid, and why?",
    "CSS Grid is the better fit here, because it controls both dimensions at once: rows and columns are defined together, so tiles line up along both axes simultaneously. Flexbox only lays items out along a single axis at a time, so getting a true row-and-column alignment out of it usually means fighting the wrapping behavior with manual widths, rather than it being Flexbox's natural job.",
    "One layout model controls a single axis at a time; the other controls two at once."),

  trivia('flex-vs-grid-one-axis-usecase', 'css-grid', 2,
    "A horizontal navbar needs its links spaced out along a single row, with no need to control vertical alignment across multiple rows. Which layout method fits this job more naturally?",
    "Flexbox is purpose-built for distributing and aligning items along one axis at a time, which matches a single-row navbar exactly. CSS Grid could do it too, but its real strength is controlling rows and columns together — more than this layout actually needs.",
    "Think about how many axes this layout actually needs controlled.",
    "Grid can do it too, but it's designed for cases needing rows and columns controlled together.",
    "Flexbox, since it's built for distributing items along one axis at a time",
    ["CSS Grid, since it's built for distributing items along one axis at a time", "Flexbox, since it always creates a two-dimensional layout automatically", "CSS Grid, since it requires multiple rows and columns before anything can be placed"]),

  // ── responsive-design ────────────────────────────────────────────────────
  trivia('rd-what-does-prefers-reduced-motion-detect', 'responsive-design', 1,
    "What does the @media (prefers-reduced-motion: reduce) feature query detect?",
    "This feature query reads an operating-system-level accessibility preference, reporting true when the user has explicitly asked their system to minimize animations and other motion effects, which lets a site respond by shortening or removing its own animations.",
    "It's a system-level accessibility preference, not a screen size.",
    "People with vestibular disorders can turn this on; a well-built site should shorten/remove animations in response.",
    "Whether the user's operating system is set to minimize animations and motion effects",
    ["Whether the device's screen refresh rate is currently below 60 hertz", "Whether the user has turned off JavaScript in their current browser", "Whether the current page already has an animation actively running"]),

  general('rd-autoplaying-carousel-causes-dizziness', 'responsive-design', 2,
    "An autoplaying image carousel on a page makes some users with vestibular disorders feel dizzy. What CSS-only approach lets the site respect that without removing the carousel for everyone?",
    "Wrapping the animation or transition rules in @media (prefers-reduced-motion: reduce) lets us turn off or shorten the motion specifically for users whose operating system already has that preference set, while everyone else still sees the normal carousel. For example: @media (prefers-reduced-motion: reduce) { .carousel { animation: none; } }",
    "The fix targets only the visitors whose system has already asked for less motion."),

  trivia('rd-hover-none-pointer-coarse-target', 'responsive-design', 3,
    "What does @media (hover: none) and (pointer: coarse) typically target?",
    "hover: none matches devices where hovering isn't possible at all, and pointer: coarse matches imprecise pointing input — together, this combination is the standard way to detect a touchscreen, as opposed to a mouse or trackpad.",
    "It's about input precision and whether hovering is even possible — not screen width.",
    "hover:none = no hover-capable input; pointer:coarse = imprecise input — together the standard touchscreen pattern.",
    "Touchscreens, where hovering isn't possible and taps are less precise than a mouse",
    ["Any screen that happens to be narrower than 768 pixels wide", "Laptops that use a trackpad in place of a physical mouse", "Devices that are currently running in a browser's private mode"]),

  general('rd-dropdown-hover-only-touch-fallback', 'responsive-design', 2,
    "A dropdown menu is built to open on a CSS :hover state, but on phones and tablets the menu never opens since there's no mouse to hover with. What media feature lets the CSS detect that a device can't hover?",
    "The hover media feature, used as @media (hover: none), detects devices where hovering isn't possible at all, such as touchscreens. Wrapping the hover-dependent styles in @media (hover: hover) instead, or adding a tap-based fallback inside @media (hover: none), keeps the menu usable on both input types.",
    "The feature can detect the ABSENCE of hover capability, not just its presence."),

  trivia('rd-aspect-ratio-property-purpose', 'responsive-design', 2,
    "What does the CSS aspect-ratio: 16 / 9; property do on an element?",
    "aspect-ratio locks the relationship between an element's width and height to the given ratio, so once one dimension is known the browser computes the other automatically — commonly used to reserve space for images or video embeds before they finish loading.",
    "It ties width and height together using a ratio, not fixed values.",
    "Replaces the old padding-top percentage hack — the browser computes the missing dimension automatically.",
    "Keeps the element's width and height locked to a 16:9 ratio as it resizes",
    ["Rotates the element by 16 degrees along its 9th axis point", "Sets a fixed width of 16px and a fixed height of 9px", "Crops any overflowing content to a 16:9 visible window"]),

  general('rd-video-embed-aspect-ratio-layout-jump', 'responsive-design', 2,
    "A responsive video embed is set to width: 100% with no height specified, and it collapses to zero height until the video actually loads, causing a layout jump. What single modern CSS property fixes this without a padding-percentage hack?",
    "Setting aspect-ratio: 16 / 9 (or whatever ratio the video actually uses) on the embed reserves the correct height immediately, based on the known width, so the layout doesn't jump once the video finishes loading. This replaces the older technique of faking a ratio with a percentage padding-top trick.",
    "One modern property reserves the height upfront, before the video even loads."),

  // ── typography-colors ───────────────────────────────────────────────────
  trivia('tc-font-display-fallback-value', 'typography-colors', 3,
    "Which font-display value gives the custom font a short window to load invisibly before falling back permanently, rather than swapping in whenever it's ready?",
    "font-display: fallback gives the custom font a brief invisible period, then a short window during which it can still swap in if it finishes loading, and after that window closes it commits to the fallback font for good rather than swapping in later.",
    "It's a middle ground between swap and optional.",
    "The compromise value: ~100ms invisible, ~3s swap window, then locks in rather than swapping late.",
    "fallback — brief invisible period, then a short swap window, then commits to the fallback font",
    ["block — stays invisible indefinitely until the custom font fully loads", "auto — leaves the loading behavior entirely up to the browser's default", "optional — swaps in only if the font was already cached beforehand"]),

  general('tc-font-display-optional-no-swap-flash', 'typography-colors', 3,
    "A site wants to use a custom brand font, but product wants to completely avoid any visible flash of a fallback font changing into the custom one later — even if that occasionally means the custom font never shows up for a slow connection. Which font-display value fits that priority?",
    "font-display: optional gives the browser a very short time to use the custom font if it's already available, and otherwise commits to the fallback font for that page view, with no later swap. This avoids the flash entirely, at the cost of some visitors on slow connections never seeing the brand font at all.",
    "One value is willing to permanently sacrifice the custom font rather than ever risk a visible swap."),

  trivia('tc-text-wrap-balance-heading', 'typography-colors', 2,
    "What does text-wrap: balance do when applied to a multi-line heading?",
    "text-wrap: balance has the browser try several possible line-break combinations and pick the one that makes the wrapped lines closest to equal length, which typically prevents a short, lonely word from being stranded alone on the last line.",
    "It's about making line lengths more even, not changing the font itself.",
    "The browser tries a few line-break combos and picks the most even one, preventing an orphaned word.",
    "Adjusts where lines break so wrapped lines look more even, avoiding a lonely short last line",
    ["Centers the heading horizontally within its parent container", "Balances the font-weight evenly across every character", "Automatically shrinks the font size until the heading fits one line"]),

  general('tc-heading-strands-one-word-text-wrap', 'typography-colors', 2,
    "A two-line page heading keeps stranding just one short word alone on its second line whenever the browser is resized, which looks unbalanced. What CSS property fixes the way the heading wraps, without rewriting the heading text itself?",
    "Applying text-wrap: balance to the heading tells the browser to choose line breaks that make each line roughly the same length, rather than greedily filling each line until it runs out of room. This removes the stranded single-word line without changing any of the heading's actual wording.",
    "The fix changes HOW the browser chooses to break the lines, not the text content."),

  trivia('tc-system-font-stack-benefit', 'typography-colors', 2,
    "What is the main benefit of using a \"system font stack\" (e.g. -apple-system, Segoe UI, Roboto, sans-serif) instead of a custom web font?",
    "A system font stack lists each major operating system's native UI font in turn, so the browser always finds one already installed on the visitor's device — the text renders instantly with zero font file to download, unlike a custom web font that must be fetched first.",
    "It reuses fonts that are already on the user's device.",
    "Lists each OS's native UI font, so the browser always finds one already installed — zero download.",
    "Text renders instantly in the OS's native font with no extra file to download",
    ["It guarantees pixel-identical rendering across every operating system", "It automatically translates text into the user's system language", "It applies a bold weight by default on every platform"]),

  general('tc-slow-page-custom-fonts-system-stack-fix', 'typography-colors', 3,
    "A marketing page loads two custom web fonts for body text and scores poorly on load-time metrics, with visible text reflow once the fonts finish downloading. Product says the actual visual difference from a default system font is barely noticeable to most visitors. What's a reasonable typography-based fix?",
    "Replacing the custom web fonts with a system font stack, such as font-family: -apple-system, \"Segoe UI\", Roboto, sans-serif;, removes the font download entirely, since each operating system already has one of those fonts installed. This eliminates both the load delay and the layout shift that happens when a custom font swaps in, at the cost of the page no longer having a fully custom typographic look.",
    "The fix removes the font DOWNLOAD entirely, rather than trying to optimize how it loads."),

  // ── animations-transforms ───────────────────────────────────────────────
  trivia('rotatey-vs-rotate-axis-difference', 'animations-transforms', 2,
    "What's the key difference between transform: rotate(180deg) and transform: rotateY(180deg)?",
    "rotate() is shorthand for a flat, two-dimensional rotation around the Z axis, keeping the element on the page's plane, while rotateY() rotates around the vertical Y axis instead, turning the element through 3D space — visible as a flip once combined with perspective.",
    "One of these always stays flat on the page.",
    "rotate() is shorthand for rotateZ(); rotateY() needs transform-origin/perspective to read as 3D.",
    "rotate() spins flat around the Z axis; rotateY() spins around the vertical Y axis instead",
    ["They are exactly the same, just two different ways to write a 2D rotation", "rotateY() only works inside an SVG element, never in regular HTML", "rotate() needs a unit like deg, but rotateY() only accepts raw numbers"]),

  trivia('backface-visibility-hidden-purpose', 'animations-transforms', 2,
    "What does backface-visibility: hidden prevent?",
    "backface-visibility: hidden hides an element's reverse side the moment a 3D rotation turns it away from the viewer, instead of continuing to render it mirrored — this is essential for a believable card-flip effect built with rotateY().",
    "It only matters once an element has actually been flipped in 3D.",
    "Essential for card-flip effects using rotateY() — hides the mirrored backside.",
    "Hides the element's reverse side once a 3D rotation turns it away from the viewer",
    ["Stops the element from rendering until the user clicks on it", "Hides the element automatically once its opacity drops below 50%", "Prevents the element from receiving mouse or touch events entirely"]),

  general('card-flip-mirrored-front-mid-flip', 'animations-transforms', 3,
    "A card-flip component uses transform: rotateY(180deg) on click, but briefly shows a mirrored, backwards version of the front face mid-flip instead of smoothly revealing the back face underneath. What CSS property fixes this?",
    "The fix is backface-visibility: hidden on both the front and back faces of the card. Without it, the browser keeps rendering the front face even after it has rotated past 90 degrees, showing it mirrored instead of hiding it. With backface-visibility: hidden set, each face disappears the moment it points away from the viewer, so only the correct face is ever visible. A typical card-flip setup also needs perspective on the parent element and transform-style: preserve-3d on the card itself so the two faces actually occupy the same 3D space instead of flattening on top of each other.",
    "The front face is still rendering after it has rotated past 90 degrees — something should hide it."),

  trivia('animation-play-state-paused-effect', 'animations-transforms', 1,
    "What does animation-play-state: paused do to a running CSS animation?",
    "Setting animation-play-state: paused freezes the animation exactly at its current frame, holding it there until the value is switched back to running, at which point it resumes from that same frame rather than starting over.",
    "It's a freeze, not a reset or a stop.",
    "Setting it back to running resumes from that same point, not from the start.",
    "Freezes the animation at its current frame until play-state is changed back to running",
    ["Stops the animation permanently and resets it to its first frame", "Slows the animation down to half of its original speed", "Removes the animation and reverts all styles to their un-animated state"]),

  general('pause-spinner-on-hover-no-js', 'animations-transforms', 2,
    "A spinning loader animation should pause while the user's mouse is over it, then continue spinning from where it left off when the mouse leaves, without any JavaScript. How can this be done in pure CSS?",
    "animation-play-state can be toggled with the :hover pseudo-class to pause and resume an animation purely in CSS. Setting animation-play-state: running as the default and switching it to paused on :hover freezes the spinner exactly where it is, and removing the hover state lets it continue from that same frame rather than restarting. For example: .loader { animation: spin 1.2s linear infinite; } .loader:hover { animation-play-state: paused; }",
    "One property toggled by :hover is all this needs — no JavaScript required."),

  trivia('animation-shorthand-missing-duration-default', 'animations-transforms', 2,
    "In the animation shorthand, what happens if no duration is specified?",
    "When the animation shorthand omits a duration, it defaults to 0s, meaning the animation technically still runs but completes instantly with no visible motion at all — the same default transition-duration falls back to when it's left unspecified.",
    "The default is the same default transition-duration uses.",
    "Just like transition, animation-duration defaults to 0s when omitted from the shorthand.",
    "It defaults to 0s, so the animation completes instantly with no visible motion",
    ["The animation refuses to run at all until a duration is added", "It defaults to whatever duration was used in the last animation on the page", "It automatically matches the duration of the @keyframes rule's longest step"]),

  general('transition-all-performance-problem', 'animations-transforms', 3,
    "A button has transition: all 0.3s ease applied, and over time more hover effects get added to it (color, transform, box-shadow, border-radius). Developers notice the button starts to feel janky on lower-end devices. What's the likely architectural problem with transition: all here?",
    "transition: all tells the browser to watch every single animatable property for changes, not just the ones actually being transitioned on hover. As more properties get added to the hover state over time, the browser ends up having to check and interpolate far more properties than intended, which adds up to real performance cost, especially on lower-end devices. Listing the specific properties instead, like transition: color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease, keeps the transition limited to only what's actually meant to animate and is more predictable to maintain as the component grows.",
    "The problem grows every time a new hover effect is added, even though transition: all itself never changed."),

  trivia('why-transition-all-discouraged', 'animations-transforms', 2,
    "Why is transition: all generally discouraged in production CSS?",
    "transition: all forces the browser to watch every animatable property on the element for changes, rather than only the specific ones that are actually meant to transition, which wastes work and can also mask an accidental style change as if it were an intentional animation.",
    "It's not about which properties are missing — it's about which ones get watched unnecessarily.",
    "Wasteful, and can mask accidental changes as intentional animation.",
    "It makes the browser watch every animatable property for changes, not just the intended ones",
    ["It only works on properties that don't require layout recalculation", "It overrides any transition-duration set elsewhere in the stylesheet", "It applies the transition to child elements as well as the element itself"]),

  // ── advanced-selectors ───────────────────────────────────────────────────
  trivia('li-last-child-select', 'advanced-selectors', 1,
    "What does li:last-child select?",
    "li:last-child only matches an li element when it is literally the final child of its parent — if some other, non-li element happens to be last instead, no li in that parent gets selected at all, since the check is about position among ALL siblings, not just li siblings.",
    "It mirrors :first-child, but counting from the other end.",
    "If a non-li element is last, no li gets selected at all — mirrors :first-child in reverse.",
    "The li only if it happens to be the final child of its parent",
    ["The last li element anywhere on the page", "Every li except the first one in its parent", "The li with the highest z-index among its siblings"]),

  trivia('nth-last-child-2-select', 'advanced-selectors', 2,
    "What does :nth-last-child(2) select, counting from a card list's end?",
    ":nth-last-child(2) selects whichever element is the second-to-last child of its parent, counting position from the end of the sibling list backward, rather than counting from the first child forward the way :nth-child(2) would.",
    "Counting direction is reversed compared to nth-child.",
    "Counts siblings from the end instead of the start — handy without knowing the total count.",
    "The element that is the second-to-last child of its parent",
    ["The second child counted from the start of its parent", "Every child except the final two", "The last two children combined as one selection"]),

  trivia('only-child-match', 'advanced-selectors', 1,
    "What does :only-child match?",
    ":only-child matches an element only when it is the sole child of its parent, with zero sibling elements at all — the match fails immediately for either element the moment a second sibling exists.",
    "It fails the moment a sibling shows up, even just one.",
    "Fails the moment even one sibling shows up, for either element.",
    "An element that is the sole child of its parent, with no siblings",
    ["The only element on the page with a particular class name", "The first child when a parent has exactly one other sibling", "Any element that has no child elements nested inside it"]),

  general('breadcrumb-separator-skip-last-item', 'advanced-selectors', 2,
    "A horizontal list of breadcrumb links should show a separator after every link except the very last one. What selector lets this be done without adding or removing any extra markup?",
    "The combination of :not() and :last-child handles this cleanly: .breadcrumb li:not(:last-child)::after { content: \" / \"; } adds the separator to every breadcrumb item except the final one, since :not(:last-child) excludes it from the match. This avoids needing JavaScript or an extra wrapper element just to detect which item is last — the selector figures it out from the document structure alone.",
    "A negation selector can exclude exactly the one item that shouldn't get the separator."),

  trivia('input-checked-target', 'advanced-selectors', 1,
    "What does input:checked target?",
    "input:checked matches a checkbox or radio input only while it is currently selected or ticked — it's most often paired with a sibling combinator to restyle a custom checkbox's appearance based on the real, visually-hidden input's actual state.",
    "It only applies to checkboxes and radio buttons.",
    "Commonly paired with a sibling selector to style a custom checkbox based on the real input's state.",
    "A checkbox or radio input that is currently selected/ticked",
    ["An input that has already been validated successfully", "Any input element that currently has keyboard focus", "An input whose value attribute is not empty"]),

  general('custom-toggle-switch-checked-sibling', 'advanced-selectors', 2,
    "A custom-styled toggle switch hides the real checkbox input visually but still needs to change its own appearance when that checkbox becomes checked. How can plain CSS do this without JavaScript?",
    "The :checked pseudo-class combined with a sibling combinator makes this possible. If the visually-hidden checkbox sits right before the custom switch element in the HTML, a rule like input:checked + .switch { background: green; } can restyle the switch purely based on the real checkbox's state. This works because :checked reflects the live state of the form control, and the adjacent sibling combinator lets a rule react to that state on a different element entirely, without any script tracking clicks.",
    "The real checkbox's state can style a completely different sibling element, no script needed."),

  trivia('required-vs-optional-difference', 'advanced-selectors', 2,
    "What's the difference between :required and :optional in CSS?",
    ":required and :optional are exact opposites driven by the same thing: the HTML required attribute on a form field. :required matches fields that carry that attribute, and :optional matches every field that doesn't, with nothing else distinguishing the two pseudo-classes.",
    "One attribute, two pseudo-classes, each catching one side of it.",
    "Exact opposites of each other, driven purely by that one HTML attribute.",
    "They target opposite states of the required HTML attribute on form fields",
    ["required applies to text inputs only; optional applies to all others", "required is deprecated in favor of the aria-required attribute", "Both select the same fields; optional is simply an older, unsupported alias"]),

  trivia('specificity-weight-of-child-combinator', 'advanced-selectors', 3,
    "How much specificity does the child combinator (>) in .nav > li add to a selector's score?",
    "Combinators themselves — the child combinator >, the descendant space, and the sibling combinators ~ and + — never contribute any weight to a selector's specificity score; only the actual selectors written on either side of them (classes, IDs, element names) count toward it.",
    "The symbol itself never counts — only what's written on either side of it.",
    "Only the actual selectors on either side (classes, IDs, element names) contribute weight.",
    "None — combinators (>, ~, +, space) never add any specificity weight",
    ["The same specificity weight as adding one class selector would", "The same specificity weight as adding one element selector would", "It doubles whichever side of the combinator is more specific"]),

  general('child-combinator-specificity-vs-descendant', 'advanced-selectors', 3,
    "Two selectors are compared: #sidebar .widget p and #sidebar > .widget > p. Do the > combinators give the second selector any extra specificity over the first?",
    "No — combinators never contribute to specificity, whether it's the descendant space, the child combinator (>), the sibling combinators (~ and +), or any other combinator. Specificity only counts the actual selectors on either side: one ID, one class, and one element, in both versions here. So #sidebar .widget p and #sidebar > .widget > p score exactly the same specificity, even though the second one is stricter about the exact structural relationship it requires between elements.",
    "Specificity and structural strictness are two separate things — one can change without the other."),

  // ── css-architecture ─────────────────────────────────────────────────────
  trivia('container-queries-problem-solved', 'css-architecture', 2,
    "What problem do container queries (@container) solve that media queries can't?",
    "Container queries let a component's styles respond to the size of whatever container it's actually placed inside, rather than the size of the whole browser viewport — letting the same reusable component adapt correctly whether it sits in a wide main area or a narrow sidebar.",
    "The viewport isn't always the thing that actually constrains a component's width.",
    "The same card can adapt correctly in a wide sidebar or a narrow column.",
    "They let a component respond to the size of its own container, not the whole viewport",
    ["They let a stylesheet respond to the user's current scroll position on the page", "They let a component detect which browser is currently rendering it", "They replace media queries entirely and are required for all new projects"]),

  trivia('container-type-opt-in-requirement', 'css-architecture', 2,
    "What has to be set on an element for its descendants to be able to use @container queries against it?",
    "An ancestor element must explicitly set container-type, naming itself as a query container before any descendant's @container rule can measure and react to its size — without that opt-in, there's no containing context for the query to reference.",
    "An element has to opt in before its descendants can query its size.",
    "Without it, @container has no containing context to measure and won't match anything.",
    "container-type must be set on that ancestor, naming it as a query container",
    ["position: relative must be set on that ancestor element", "display: contents must be set on that ancestor element", "Nothing — any element can be queried against automatically"]),

  general('container-queries-vs-duplicate-card-components', 'css-architecture', 3,
    "A card component needs to show a horizontal layout when placed in a wide area of the page, and a stacked vertical layout when placed in a narrow sidebar — the exact same component, reused in both places. Why do container queries fit this better than writing two separate versions of the card or relying on viewport media queries?",
    "A viewport media query only knows the width of the whole browser window, not where a specific component happens to sit on the page, so it can't tell a card in a wide main area apart from an identical card dropped into a narrow sidebar. Writing two separate card components to cover both cases duplicates markup and styles that are otherwise identical. Container queries let one single card component define its own layout rules based on the width of whatever container it's placed inside, using @container (min-width: 400px) { ... } scoped to a named container ancestor. The component stays reusable and self-contained, which is the real architectural win — the component's own stylesheet decides how it adapts, regardless of where someone drops it on the page.",
    "The component's own stylesheet should decide how it adapts, regardless of where it's placed on the page."),

  trivia('css-modules-prevent-collisions', 'css-architecture', 2,
    "How do CSS Modules prevent class name collisions between components?",
    "CSS Modules work through a build-time step: the developer still writes ordinary class names in plain CSS, but the build tool automatically rewrites each one into a unique generated name before shipping, so no manual naming discipline is needed to guarantee uniqueness.",
    "Nothing happens in the browser itself — the trick happens earlier, during the build.",
    "You still write plain CSS and class names — uniqueness is handled automatically, not by hand.",
    "A build tool rewrites each class name to a unique generated name at compile time",
    ["The browser automatically scopes any stylesheet to the component that loaded it", "They require every class name to be prefixed manually with the component's name", "They store styles as JavaScript objects instead of class names"]),

  general('css-modules-vs-bem-discipline', 'css-architecture', 2,
    "A team currently relies on BEM naming discipline to avoid class name collisions across components. What would switching to CSS Modules actually change about how that collision problem gets solved?",
    "BEM avoids collisions through a naming convention that every developer has to follow consistently by hand — nothing stops someone from accidentally reusing a block name if they forget the convention. CSS Modules move that responsibility to the build tool instead: every class gets automatically rewritten to a unique name at build time, so a collision becomes structurally impossible rather than just unlikely. The trade-off is that CSS Modules need a build step to work at all, while BEM is just plain CSS that runs anywhere, including projects without any build tooling.",
    "One approach relies on humans following a convention; the other makes violating it impossible."),
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

  const subject = await subjectRepo.findOne({ where: { slug: 'css' } });
  if (!subject) throw new Error('Subject "css" not found.');

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
    console.log(`   ${slug.padEnd(28)} ${count} linked (this + any pre-existing)`);
  }

  await AppDataSource.destroy();
  console.log('\nDone.');
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
