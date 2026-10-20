import { AppDataSource } from '../data-source';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';

// Content-gap fill for subject 'javascript', 3 topics added when the curriculum expanded
// 27 -> 30 topics that had zero Trivia questions (only General): execution-context-and-call-stack,
// javascript-engines-and-jit-compilation, memory-management-and-garbage-collection. Drafted after
// reading every existing Active General question in these 3 topics in full (to avoid duplicating
// facts), reviewed and approved by the user before this run. Seeded straight to Active per the
// agreed review-before-seed workflow (same treatment as the CSS/HTML gap-fill seeds).
//
// 60 new Trivia (20/topic) + 10 new General (genuine concept gaps only, not padding: `this`
// binding + `arguments` object for topic 1; monomorphic/polymorphic, warm-up time, engine-vs-
// rendering-engine for topic 2; stack-vs-heap, generational GC, GC-pause noticeability,
// allocation/deallocation cost for topic 3).
//
// Usage: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-javascript-new-topics.ts

interface OptionSpec { option: string; correct: boolean; comment: string | null; }
interface QuestionSpec {
  slug: string;
  question: string;
  questionType: QuestionTypeEnum;
  answer: string;
  hint: string;
  level: number;
  tag: string | null;
  options: OptionSpec[];
  topicSlug: string;
}

function marksFor(level: number): number { return level === 3 ? 3 : 1; }
function timeFor(level: number): number { return level === 3 ? 90 : 60; }

function trivia(
  slug: string, topicSlug: string, level: number, question: string, hint: string,
  correctComment: string, correctOption: string, wrongOptions: string[],
): QuestionSpec {
  const options: OptionSpec[] = [
    { option: correctOption, correct: true, comment: correctComment },
    ...wrongOptions.map((o) => ({ option: o, correct: false, comment: null })),
  ];
  return { slug, question, questionType: QuestionTypeEnum.Trivia, answer: correctComment, hint, level, tag: null, options, topicSlug };
}

function general(slug: string, topicSlug: string, level: number, question: string, answer: string, hint: string): QuestionSpec {
  return { slug, question, questionType: QuestionTypeEnum.General, answer, hint, level, tag: 'Conceptual', options: [], topicSlug };
}

const QUESTIONS: QuestionSpec[] = [

  // ════════════════════════════════════════════════════════════════════════
  // TOPIC 1: execution-context-and-call-stack
  // ════════════════════════════════════════════════════════════════════════

  general('ecc-global-this-strict-mode', 'execution-context-and-call-stack', 1,
    "What does the Global Execution Context set up for `this`, and how does that differ in strict mode?",
    `<p>When a script starts running, the engine creates a Global Execution Context before any of our code executes. One of the things it sets up is the value of <code>this</code> at the top level.</p><pre><code>console.log(this === window); // true, in a non-strict browser script

'use strict';
console.log(this); // still window at the top level -- strict mode only
                    // changes the default this inside function calls
</code></pre><p>Outside a function, in a plain browser script, <code>this</code> is bound to the global object (<code>window</code> in browsers, <code>global</code> in Node's CommonJS wrapper). Strict mode changes what <code>this</code> defaults to inside a plain function call (it becomes <code>undefined</code> instead of the global object) &mdash; but it doesn't change the Global Execution Context's own <code>this</code>.</p>`,
    "Strict mode changes the default `this` inside function calls, not the top-level script's `this`."),

  general('ecc-function-this-call-site', 'execution-context-and-call-stack', 2,
    "What gets bound to `this` when a Function Execution Context is created, and what determines that binding?",
    `<p>Every time a (non-arrow) function is called, its Function Execution Context sets up its own <code>this</code> binding &mdash; and crucially, that binding is decided by <em>how</em> the function was called, not by where it was written.</p><pre><code>const user = {
  name: 'Maya',
  greet() { console.log(this.name); }
};

const fn = user.greet;

user.greet();   // 'Maya' -- called as a method, this = user
fn();           // undefined (or throws in strict mode) -- called plain
fn.call(user);  // 'Maya' -- call() explicitly sets this = user
</code></pre><p>The exact same function body produces three different <code>this</code> values, purely based on the call site. This is also why arrow functions behave so differently &mdash; they don't set up a <code>this</code> binding at all when their execution context is created, so <code>this</code> inside one is just whatever the nearest enclosing regular function's <code>this</code> already is.</p>`,
    "Call the same function three different ways and watch `this` change each time -- it's decided at the call site, not the definition site."),

  general('ecc-arguments-object-basics', 'execution-context-and-call-stack', 1,
    "What is the `arguments` object, and how is it different from a function's declared parameters?",
    `<p>Every regular (non-arrow) function gets an <code>arguments</code> object set up automatically as part of its execution context &mdash; an array-like collection of every value actually passed into that call.</p><pre><code>function sum(a, b) {
  console.log(arguments.length); // 3, not 2
  console.log(arguments[2]);     // 30
  return a + b;
}

sum(10, 20, 30);
</code></pre><p><code>arguments</code> reflects the real call, not the function's declared signature &mdash; here it has three entries even though only <code>a</code> and <code>b</code> were named. It's array-like (it has a <code>.length</code> and numeric indexes) but it's not a real <code>Array</code>, so methods like <code>.map()</code> don't work on it directly without converting it first (<code>Array.from(arguments)</code>). Arrow functions don't get their own <code>arguments</code> at all &mdash; referencing it inside one just looks outward to an enclosing regular function's.</p>`,
    "`arguments` reflects what was actually passed at the call site, not what the function declared it expects."),

  trivia('ecc-global-ec-created-first', 'execution-context-and-call-stack', 1,
    "When the JavaScript engine begins running a script, what does it create first, before executing any statement?",
    "Think about what exists in memory even before the first statement executes.",
    "The engine always builds a Global Execution Context first — setting up the global object and binding `this` — before a single line of code runs.",
    "The Global Execution Context, containing the global object and the `this` binding",
    ["The first function's local execution context and its arguments object", "An empty call stack with no entries at all until a function is called", "The event loop's callback queue, pre-loaded with every scheduled timer"]),

  trivia('ecc-global-this-nonstrict', 'execution-context-and-call-stack', 2,
    "In a plain (non-module, non-strict) browser script, what does `this` refer to inside the Global Execution Context?",
    "Compare it to what `this` equals inside a regular top-level function call.",
    "Outside strict mode and modules, the global object itself is bound to `this` at the top level — `window` in browsers, `global` in Node's CommonJS wrapper.",
    "The global object (`window` in browsers)",
    ["`undefined`, exactly like inside a strict-mode function", "The first script tag's DOM element", "A fresh empty object created solely for that script"]),

  trivia('ecc-function-ec-per-call', 'execution-context-and-call-stack', 1,
    "If a function is called three separate times in a program, how many Function Execution Contexts does the engine create for it?",
    "Think about what makes recursion or multiple calls possible without variables colliding.",
    "Every invocation gets its own brand-new execution context — its own variable environment, `this`, and arguments — even calling the same function repeatedly.",
    "Three — one fresh execution context gets created per invocation",
    ["One, reused across all three calls", "Two — the engine caches the context after the first call and skips the next", "Zero, because execution contexts are only created for function declarations, not calls"]),

  trivia('ecc-function-ec-contents-trio', 'execution-context-and-call-stack', 2,
    "Which trio is set up fresh as part of creating a Function Execution Context?",
    "Think about the ingredients an EC needs to run code correctly, not the browser's rendering pipeline.",
    "Each function call gets its own variable environment, its own `this` binding, and a link to the scope it was defined in — the pieces an EC is built from.",
    "A variable environment, a `this` binding, and a reference to the outer environment",
    ["The DOM tree, the CSSOM style tree, and the browser's paint/compositing layers", "The call stack, the heap memory region, and the garbage collector's root set", "The module's import map, its full export list, and its resolved source URL"]),

  trivia('ecc-call-stack-lifo-why', 'execution-context-and-call-stack', 1,
    "Why is the call stack described as \"Last In, First Out\" (LIFO)?",
    "Picture a physical stack of plates -- which one do you take off first?",
    "LIFO means the last context pushed — the most recently called function — is the first to finish and get popped, exactly like a stack of plates.",
    "The most recently pushed execution context is always the first one popped off",
    ["Execution contexts are removed in the exact order they were created, oldest first", "The engine picks whichever context has been idle the longest to run next", "Contexts are removed in a random order chosen by the garbage collector"]),

  trivia('ecc-stack-frame-definition', 'execution-context-and-call-stack', 2,
    "What does a single stack frame on the call stack represent?",
    "Each call, not each file or each lookup, gets its own frame.",
    "A stack frame is the record of one specific call — its own variables, parameters, and the return point — stacked on top of whoever called it.",
    "A single function call's execution context, with its own local variables",
    ["One complete source file, regardless of how many functions it contains", "One single property lookup performed along the scope chain", "One garbage-collection cycle performed by the engine's collector"]),

  trivia('ecc-frame-popped-gc-eligible', 'execution-context-and-call-stack', 2,
    "Once a function's stack frame is popped after it returns, what normally happens to the local variables it held?",
    "What keeps a variable alive even after the function that created it has returned?",
    "With no more references once the frame is gone, those variables are free for the garbage collector — unless a closure elsewhere still points to them.",
    "They become eligible for garbage collection, unless a closure still references them",
    ["They are automatically copied into the Global Execution Context for later reuse", "They remain on the call stack indefinitely as a cached frame", "They are converted into properties of the `arguments` object"]),

  trivia('ecc-hoisting-creation-phase-mechanism', 'execution-context-and-call-stack', 2,
    "What is actually true about how \"hoisting\" works under the hood?",
    "\"Hoisting\" is really just what the creation phase does -- nothing gets relocated in the source.",
    "Nothing physically moves. The creation phase scans the code and reserves memory for declarations up front, which is why they're usable before their line runs.",
    "The engine scans declarations in the creation phase and reserves memory before code runs",
    ["The engine literally relocates the declaration's source code to the top of the file at parse time", "Hoisting only happens if the keyword `var` appears inside a conditional block", "Hoisting is a runtime optimization the JIT compiler applies only to hot functions"]),

  trivia('ecc-class-hoisting-tdz', 'execution-context-and-call-stack', 3,
    "Like `function` declarations, `class` declarations are also hoisted. What's the key difference?",
    "Classes behave more like `let`/`const` than like `function` when it comes to hoisting.",
    "Function declarations are hoisted fully usable. Classes are hoisted too, but — like let/const — sit in the TDZ until their declaration line executes.",
    "A class's binding is hoisted but stays in the TDZ, unlike a function declaration",
    ["Classes are not hoisted at all, unlike every other declaration type", "A class is hoisted with its full body usable immediately, exactly like a function declaration", "Classes are hoisted only inside strict mode code"]),

  trivia('ecc-arguments-object-array-like', 'execution-context-and-call-stack', 1,
    "What is the `arguments` object inside a regular (non-arrow) function?",
    "It reflects what was actually passed in, which can be more or fewer values than the declared parameters.",
    "`arguments` is array-like — indexable and has `.length` — but it's not a real Array, so methods like `.map()` aren't available on it directly.",
    "An array-like object holding every argument actually passed to the function call",
    ["A true Array instance, complete with every Array.prototype method", "An object listing only the parameters declared in the function's signature, not what was passed", "A global object shared across every function call in the program"]),

  trivia('ecc-arrow-no-arguments', 'execution-context-and-call-stack', 2,
    "Why does `arguments` not exist inside an arrow function?",
    "Arrow functions skip creating several of the usual per-call bindings — this is one of them.",
    "Arrow functions don't set up their own `arguments` (or `this`) when their execution context is created — referencing `arguments` inside one looks outward to an enclosing function's.",
    "Arrow functions don't set up their own `arguments` — it resolves to the enclosing function's",
    ["Arrow functions always have zero parameters, so there's nothing to capture", "`arguments` was removed from the language entirely in ES6", "Arrow functions store their arguments on `this` instead of in a separate object"]),

  trivia('ecc-arguments-length-vs-params', 'execution-context-and-call-stack', 2,
    "A function is declared as `function sum(a, b) {}` but called as `sum(1, 2, 3, 4)`. What does `arguments.length` equal inside the call?",
    "`arguments` cares about the call site, not the function's declared signature.",
    "`arguments` tracks what was actually passed at the call site, independent of how many parameters the function declares — extra values aren't dropped.",
    "4 — arguments reflects every value actually passed at the call site",
    ["2 — it only counts the parameters named in the function signature", "It throws a TypeError for passing too many arguments", "0 — extra arguments beyond the signature are silently discarded before the call"]),

  trivia('ecc-this-determined-call-time', 'execution-context-and-call-stack', 2,
    "When is a regular (non-arrow) function's `this` value actually determined?",
    "Try calling the same function two different ways and see if `this` changes.",
    "Unlike variables, a regular function's `this` isn't fixed by where it's written — the engine re-binds it fresh on every call based on the call site.",
    "At call time, based on how the function is actually invoked",
    ["At the moment the function is defined, based on its surrounding code", "Permanently, the first time the function is ever called, then fixed for every later call", "Always as the global object, no matter how the function is called"]),

  trivia('ecc-this-strict-standalone-call', 'execution-context-and-call-stack', 2,
    "In a regular function called as a plain standalone call (not as a method) in strict mode, what does `this` equal inside that function's execution context?",
    "Strict mode is specifically what changes this from the non-strict default.",
    "Strict mode removes the old 'default to the global object' fallback — a bare function call binds `this` to `undefined` instead.",
    "`undefined`, because strict mode disables that automatic global fallback",
    ["The global object, exactly as it would be outside strict mode", "The function itself, treated as its own calling context", "`null`, but only in server-side Node.js code"]),

  trivia('ecc-arrow-no-this-binding', 'execution-context-and-call-stack', 3,
    "Why do arrow functions have no `this` binding of their own set up when their execution context is created?",
    "Arrow functions are missing a few of the usual per-call setup steps — `this` is one.",
    "Arrow functions are built without their own `this` — accessing it just walks the scope chain outward to whatever `this` the enclosing function already has.",
    "They don't create their own `this` binding — it resolves outward through the scope chain instead",
    ["Arrow functions always bind `this` to the global object as a special case", "Arrow functions bind `this` to the object they're declared as a property of", "Arrow functions throw a ReferenceError the first time `this` is accessed inside them"]),

  trivia('ecc-recursion-stack-overflow-why', 'execution-context-and-call-stack', 1,
    "Why does deep, unbounded recursion eventually crash with a stack-related error instead of running forever?",
    "Think about what's actually consumed with every new call that hasn't returned yet.",
    "Every call pushes a new frame, and the call stack's memory is finite — enough unreturned frames eventually exhaust it, however the recursion is written.",
    "Each call adds another frame to the call stack, and the stack has a fixed, finite size in memory",
    ["JavaScript limits any single function to being called at most 1,000 times in its lifetime", "The garbage collector blocks any function from calling itself more than once", "Recursive calls are queued in the event loop and time out after a fixed delay"]),

  trivia('ecc-closure-outlives-ec', 'execution-context-and-call-stack', 3,
    "A function returns another function that references one of its local variables, then the outer function's execution context is popped off the stack. Is that variable still accessible afterward?",
    "The call stack frame disappears, but does every variable it referenced have to disappear with it?",
    "A closure keeps a live reference to the variable itself, so it survives on the heap even after its creating execution context leaves the call stack.",
    "Yes — the closure keeps that one variable alive, even though the outer EC's frame is gone",
    ["No — once an execution context is popped, every variable it created is immediately and permanently inaccessible", "Yes, but only for exactly one more call before it's deleted automatically", "No — accessing it throws a ReferenceError because its scope no longer exists on the stack"]),

  trivia('ecc-ec-vs-scope-chain', 'execution-context-and-call-stack', 2,
    "What's the key difference between an execution context and the scope chain?",
    "One of the two is tied to a single call; the other is fixed by where the function was written.",
    "An EC is call-specific and temporary. The scope chain is the lexical lookup path fixed at definition time — and it's what lets a closure outlive the EC it was born in.",
    "An execution context is created fresh per call; the scope chain is fixed by where the function was written",
    ["They are two different names for exactly the same mechanism, used interchangeably", "The scope chain is created fresh on every call, while the execution context is fixed by where the function is written", "An execution context only exists for arrow functions, while the scope chain only exists for regular functions"]),

  trivia('ecc-global-ec-bottom-of-stack', 'execution-context-and-call-stack', 1,
    "What sits at the very bottom of the call stack for the entire lifetime of a running script?",
    "Think about what's created before any function is ever called, and when it finally gets popped.",
    "The Global EC is pushed first and stays at the bottom the whole time the script runs — every function call stacks temporarily on top of it.",
    "The Global Execution Context",
    ["The most recently called function's context", "The event loop's microtask queue", "An empty placeholder frame with no execution context attached"]),

  trivia('ecc-creation-before-execution-phase', 'execution-context-and-call-stack', 2,
    "Which happens first when a new execution context is created?",
    "Hoisting itself is proof that something happens before your code starts running top to bottom.",
    "Every EC goes through creation (hoisting, `this`, scope setup) in full before the execution phase starts running the actual statements line by line.",
    "Creation (setting up memory and `this`) runs completely, then execution begins",
    ["The execution phase runs first, then the creation phase fills in any gaps afterward", "Both phases run simultaneously, line by line", "There is only one phase — code runs top to bottom with no separate setup step"]),

  // ════════════════════════════════════════════════════════════════════════
  // TOPIC 2: javascript-engines-and-jit-compilation
  // ════════════════════════════════════════════════════════════════════════

  general('jit-monomorphic-vs-polymorphic', 'javascript-engines-and-jit-compilation', 2,
    "What does it mean for a function to be \"monomorphic\" versus \"polymorphic,\" and why does the engine care?",
    `<p>These terms describe how consistent a function's inputs are across all the times it gets called.</p><pre><code>function getX(point) { return point.x; }

getX({ x: 1 });          // shape: {x}
getX({ x: 2 });          // same shape -- monomorphic so far

getX({ x: 3, y: 4 });    // different shape -- now polymorphic
</code></pre><p>A <strong>monomorphic</strong> call site sees only one object shape over and over, so the engine can generate one specialized, fast path and reuse it confidently. A <strong>polymorphic</strong> call site sees a handful of different shapes, which forces the engine to either juggle several specialized paths or fall back to a slower, more general one. See enough different shapes at one call site (often cited around four or more) and the engine gives up specializing entirely &mdash; a state usually called <strong>megamorphic</strong>.</p>`,
    "Picture the same function called with objects shaped totally differently each time, versus always the same shape."),

  general('jit-warmup-time-benchmarking', 'javascript-engines-and-jit-compilation', 2,
    "What is a JIT engine's \"warm-up time,\" and why does it matter for benchmarking?",
    `<p>A function isn't instantly fast the moment it's defined. It starts out running through the slower interpreted path, and only gets compiled to fast machine code once the engine notices it's been called often enough to be worth optimizing &mdash; that ramp-up period is the engine's warm-up time.</p><pre><code>function heavyMath(n) { /* ... */ }

for (let i = 0; i &lt; 1_000_000; i++) {
  heavyMath(i);
  // the first several thousand calls run interpreted (slow);
  // partway through, the JIT kicks in and the rest run compiled (fast)
}</code></pre><p>This is a common benchmarking trap: timing a single call, or just the first handful, measures the slow, cold-start interpreted path &mdash; not the performance real production code settles into once it's warmed up. Fair benchmarks run a function many times and discard the first batch of results before measuring.</p>`,
    "A one-shot timing test and a steady, long-running loop can measure two very different versions of the same function."),

  general('jit-engine-vs-rendering-engine', 'javascript-engines-and-jit-compilation', 1,
    "How does a JavaScript engine differ from a browser's rendering engine?",
    `<p>A browser bundles together several separate engines, each doing a very different job. The JavaScript engine (like V8) parses and runs JS code. The rendering engine (like Blink in Chrome, or WebKit in Safari) is a completely separate piece that parses HTML/CSS, builds the DOM and CSSOM, and paints pixels on screen.</p><pre><code>// the JS engine runs this...
document.getElementById('box').style.color = 'red';

// ...but it's the rendering engine that actually recomputes style,
// re-layouts if needed, and repaints the box red on screen
</code></pre><p>The two communicate constantly &mdash; JS code reads and writes the DOM, and the rendering engine reacts to those changes &mdash; but they're distinct systems with different jobs. Proof of the split: V8 also runs completely standalone inside Node.js, with no rendering engine anywhere nearby.</p>`,
    "One engine runs code; a separate one draws pixels — Node.js running V8 with no browser around is the clearest proof they're not the same thing."),

  trivia('jit-v8-chrome-nodejs', 'javascript-engines-and-jit-compilation', 1,
    "Which JavaScript engine does Google Chrome (and Node.js) use to run JavaScript?",
    "The same engine that powers Chrome also powers Node.js.",
    "V8 is Google's open-source engine, used in Chrome and embedded directly inside Node.js to run JS outside the browser.",
    "V8",
    ["SpiderMonkey", "JavaScriptCore", "Chakra"]),

  trivia('jit-spidermonkey-firefox', 'javascript-engines-and-jit-compilation', 1,
    "Which browser uses the SpiderMonkey JavaScript engine?",
    "Think of the browser made by Mozilla.",
    "SpiderMonkey, originally written by Brendan Eich, has been Mozilla Firefox's JS engine since the very first JavaScript implementation.",
    "Firefox",
    ["Safari", "Chrome", "Microsoft Edge"]),

  trivia('jit-engine-not-same-as-browser', 'javascript-engines-and-jit-compilation', 1,
    "Is a JavaScript engine the same thing as a web browser?",
    "Think about where else V8 runs, completely outside any browser.",
    "An engine is one embeddable piece a browser uses — proven by the fact that the same V8 engine also runs standalone, inside Node.js, with no browser at all.",
    "No — the engine is just one embedded component; it even runs standalone outside a browser, inside Node.js",
    ["Yes — \"JavaScript engine\" and \"browser\" are two names for the identical piece of software", "No — an engine is a larger piece of software that a browser runs inside of", "Yes, but only in Chrome, where the two are merged into a single process"]),

  trivia('jit-parse-to-ast-first-step', 'javascript-engines-and-jit-compilation', 1,
    "Before a JS engine can run any code, what's the first thing it does with the raw source text?",
    "Think about turning raw text into a structure the engine can actually reason about.",
    "Parsing turns source text into a structured tree (the AST) that represents the code's grammar — the foundation every later step builds on.",
    "Parses the source text into an Abstract Syntax Tree (AST)",
    ["Compiles it directly to native machine code with no intermediate step", "Sends it to the garbage collector for pre-validation", "Minifies and compresses it to reduce download size"]),

  trivia('jit-ast-represents-grammar', 'javascript-engines-and-jit-compilation', 2,
    "What does an Abstract Syntax Tree (AST) actually represent?",
    "It's about structure and grammar, not about anything visual or runtime-specific.",
    "An AST models the code's syntax as a tree — e.g., a `BinaryExpression` node with two children — not any runtime value or visual output.",
    "The grammatical structure of the source code, as a tree of nested statements and expressions",
    ["The exact byte-for-byte machine code that will eventually run on the CPU", "A list of every variable's current runtime value during execution", "The visual layout tree used to paint pixels on screen"]),

  trivia('jit-interpreter-vs-compiler', 'javascript-engines-and-jit-compilation', 1,
    "What does an interpreter do with code, as opposed to a compiler?",
    "Think about which one gets code running the fastest, even if it's not the fastest once running.",
    "An interpreter runs code straight away, translating as it goes, which is why it can start executing almost instantly — at some ongoing speed cost.",
    "Executes the code directly, translating and running it step by step as it goes",
    ["Produces a fully compiled native executable before any code runs", "Only checks the code for syntax errors without ever running it", "Converts code into CSS rules for the browser to apply"]),

  trivia('jit-hybrid-interpret-then-compile', 'javascript-engines-and-jit-compilation', 2,
    "Modern engines like V8 are often called \"hybrid.\" What does that mean in this context?",
    "Think about getting the benefits of both a fast start and a fast steady state.",
    "Modern engines blend both approaches: interpret first for quick startup, then JIT-compile whichever functions actually run often.",
    "They start by interpreting code for a fast start, then compile the parts that run often into optimized machine code",
    ["They randomly alternate between interpreting and compiling every other line", "They run half the code on the CPU and half inside a virtual machine simultaneously", "They compile everything ahead of time, then interpret it afterward for safety checks"]),

  trivia('jit-bytecode-definition', 'javascript-engines-and-jit-compilation', 1,
    "What is bytecode, in the context of a JS engine?",
    "It's an intermediate step, not the final machine code and not just minified text.",
    "Bytecode sits between the AST and machine code — a compact instruction set the interpreter can execute faster than re-parsing source text each time.",
    "A compact instruction format produced from the AST, faster to run than raw source text",
    ["The exact same thing as native machine code for the CPU", "The minified version of the original JavaScript source file", "A binary snapshot of the DOM taken at parse time"]),

  trivia('jit-why-bytecode-over-ast-walk', 'javascript-engines-and-jit-compilation', 2,
    "Why do engines bother producing bytecode instead of interpreting the AST directly?",
    "Think about what's more efficient to run again and again: a tree, or a flat list of instructions.",
    "Re-walking an AST on every execution is slow. Bytecode is a flatter, faster-to-run format generated once, which the interpreter executes repeatedly.",
    "Bytecode is more compact and faster to run repeatedly than re-walking an AST's tree",
    ["Bytecode is required by the HTML spec for any script tag to run", "Bytecode removes the need for a garbage collector entirely", "Bytecode is only generated for code that fails to parse correctly"]),

  trivia('jit-inline-caching-purpose', 'javascript-engines-and-jit-compilation', 2,
    "What problem does inline caching solve for a JS engine?",
    "Think about property access happening millions of times a second in a hot loop.",
    "Inline caching remembers where a property was found last time at a given call site, so repeat accesses skip the full lookup and jump straight there.",
    "The repeated cost of looking up where a property lives on an object each time",
    ["The cost of downloading a script file over the network", "The cost of parsing comments inside the source code", "The cost of running the garbage collector too frequently"]),

  trivia('jit-inline-cache-hidden-class-dependency', 'javascript-engines-and-jit-compilation', 3,
    "Why does inline caching depend so heavily on an object's hidden class staying the same?",
    "The cache is tied to a specific object shape, not to objects in general.",
    "The cached property location is only valid for objects sharing that exact hidden class — a shape change means the old cached lookup no longer applies.",
    "The cache is tied to a specific shape — a changed hidden class invalidates it, forcing a slower lookup",
    ["Inline caching is completely unrelated to hidden classes and works identically regardless of object shape", "Hidden classes are recalculated fresh on every single property access, making caching unnecessary", "Inline caching only works on primitive values like numbers and strings, never on objects"]),

  trivia('jit-hidden-class-definition', 'javascript-engines-and-jit-compilation', 2,
    "What is a \"hidden class\" (or \"shape\") in an engine like V8?",
    "It's an internal bookkeeping structure, not something you write yourself.",
    "A hidden class tracks an object's shape internally — it has nothing to do with the `class` keyword or anything visible in the source code.",
    "An internal record of an object's shape — which properties it has, and in what order",
    ["A publicly accessible class defined in the source code using the `class` keyword", "A CSS class applied to a DOM element that JavaScript cannot read", "A secret, randomly generated name assigned to every function for debugging"]),

  trivia('jit-hidden-class-property-order', 'javascript-engines-and-jit-compilation', 3,
    "Two constructors both assign `this.x` and `this.y`, but one assigns `y` before `x` and the other assigns `x` before `y`. Do the resulting objects share a hidden class?",
    "Think about whether \"same properties\" is enough, or whether the order they were added also matters.",
    "Hidden classes track property order as well as names — the same two property names added in a different order still produce two distinct hidden classes.",
    "No — hidden classes also depend on property order, so reversing it produces a different shape",
    ["Yes — hidden classes only care about which property names exist, never their order", "Yes, because both objects still end up with exactly two properties", "No, but only because `x` and `y` are numbers rather than strings"]),

  trivia('jit-deoptimization-definition', 'javascript-engines-and-jit-compilation', 1,
    "What does it mean when an engine \"deoptimizes\" a function?",
    "Think about an optimization getting undone, not the function disappearing.",
    "Deoptimization discards an optimistic fast path once an assumption it relied on breaks, falling back to a slower but always-correct execution path.",
    "It throws away a speculative fast version of the function and falls back to slower code",
    ["It permanently deletes the function from memory so it can never run again", "It automatically rewrites the function's source code to fix a bug", "It pauses the entire program until the user refreshes the page"]),

  trivia('jit-megamorphic-deopt-trigger', 'javascript-engines-and-jit-compilation', 3,
    "Besides a straightforward type mismatch, what else commonly triggers deoptimization in a \"hot\" function?",
    "Think about a call site seeing not just a different type, but too many different shapes to keep specializing for.",
    "Beyond outright type mismatches, a call site that sees too many distinct object shapes goes 'megamorphic' — the engine abandons specialization and falls back to a generic, slower path.",
    "The call site starts seeing so many shapes that the engine gives up specializing (\"megamorphic\")",
    ["The function is moved into a completely different source file, unchanged", "A developer adds an extra comment inside the function body, changing nothing", "The function is redeclared using `const` instead of `let`, with the same logic"]),

  trivia('jit-monomorphic-definition', 'javascript-engines-and-jit-compilation', 1,
    "What does it mean for a function to be \"monomorphic,\" in engine-optimization terms?",
    "It's about consistency of what's passed in, not about code length or call count.",
    "'Monomorphic' describes consistent input shape across calls — the exact pattern that lets an engine specialize and optimize a function effectively.",
    "It is consistently called with arguments of the same type/shape every time",
    ["It has exactly one line of code in its body", "It can only be called once during the entire program's lifetime", "It never returns any value from any of its calls"]),

  trivia('jit-monomorphic-faster-than-polymorphic', 'javascript-engines-and-jit-compilation', 2,
    "Why does a monomorphic function typically run faster, once optimized, than a polymorphic one that's called with many different argument shapes?",
    "Think about how many different \"fast paths\" the engine would need to maintain.",
    "One shape means one clean specialized fast path. Mixed shapes force the engine to either generalize (slower) or keep re-optimizing for each shape it sees.",
    "The engine builds one specialized fast path, instead of juggling multiple shapes or re-optimizing",
    ["Monomorphic functions are always written with fewer lines of code than polymorphic ones", "Polymorphic functions are blocked from using the call stack at all", "There's no real performance difference — this is a common engine myth"]),

  trivia('jit-warmup-slow-first-calls', 'javascript-engines-and-jit-compilation', 2,
    "Why might a function run noticeably slower the first several times it's called compared to later, after being called thousands of times in a loop?",
    "Think about what hasn't happened yet for a brand-new, rarely-called function.",
    "Before a function is flagged 'hot' and JIT-compiled, it runs via the slower interpreted path — this ramp-up is commonly called the engine's warm-up time.",
    "It hasn't been flagged \"hot\" and JIT-compiled yet, so early calls still run interpreted",
    ["The CPU needs to physically warm up to a higher operating temperature before running JS faster", "The first several calls are always run twice by the engine as a safety check", "The network connection needs to re-establish itself for every new function"]),

  trivia('jit-warmup-misleading-benchmark', 'javascript-engines-and-jit-compilation', 3,
    "Why can a performance benchmark that only measures a function's very first call be misleading?",
    "Think about which version of the function a one-shot benchmark actually measures.",
    "A single cold call only shows pre-warm-up, interpreted performance — real-world hot-path performance only shows up after the JIT has kicked in.",
    "It captures slow, cold interpreter performance, not the faster speed the same code reaches once warmed up",
    ["The first call is always artificially slowed down by the engine on purpose to discourage premature optimization", "First calls always run on a separate, permanently slower CPU core", "There's no difference — engines compile every function the moment it's defined, before it's ever called"]),

  trivia('jit-engine-vs-rendering-engine-trivia', 'javascript-engines-and-jit-compilation', 2,
    "How does a JavaScript engine (like V8) differ from a browser's rendering engine (like Blink)?",
    "Think about everything a browser does besides just running JS — like drawing pixels.",
    "A browser bundles multiple engines — one runs JS (V8), a separate one (Blink/WebKit) handles HTML/CSS parsing, layout, and painting.",
    "The JS engine runs JavaScript; a separate rendering engine builds the DOM/CSSOM and paints pixels",
    ["They are two different names for the exact same single component inside a browser", "The rendering engine executes JavaScript, while the JS engine only handles CSS", "The JS engine replaced the rendering engine entirely in all modern browsers"]),

  // ════════════════════════════════════════════════════════════════════════
  // TOPIC 3: memory-management-and-garbage-collection
  // ════════════════════════════════════════════════════════════════════════

  general('mem-stack-vs-heap-basics', 'memory-management-and-garbage-collection', 1,
    "What's the difference between the stack and the heap in how JavaScript stores values in memory?",
    `<p>JS keeps two very different memory regions. Primitive values (numbers, strings, booleans, etc.) and function call frames live on the <strong>stack</strong> &mdash; fast, fixed-size, and automatically cleaned up the instant a function returns. Objects, arrays, and functions live on the <strong>heap</strong> &mdash; a larger, more flexible region for things whose size can grow and whose lifetime isn't tied to a single function call.</p><pre><code>function example() {
  let count = 5;             // primitive -- lives on the stack
  let user = { name: 'A' };  // object -- allocated on the heap;
                              // user on the stack just holds a reference to it
}</code></pre><p>A stack variable holding an object doesn't contain the object itself &mdash; it holds a reference (a pointer) to wherever that object actually lives on the heap. That's also why copying an object variable copies the reference, not the object's contents.</p>`,
    "Fixed-size values that don't outlive their function go on the stack; everything else — and anything that can grow — goes on the heap."),

  general('mem-generational-gc-overview', 'memory-management-and-garbage-collection', 2,
    "What is generational garbage collection, and why do engines like V8 use it?",
    `<p>Most objects in a typical program are short-lived &mdash; created, used briefly, and discarded within the same function call or two. Generational garbage collection takes advantage of that pattern by splitting the heap into a small "young generation" and a larger "old generation."</p><pre><code>function processRequest(req) {
  const temp = { parsed: true, ...req };  // likely to die young
  return temp.parsed;
}
// temp is garbage almost immediately after the call returns --
// exactly the kind of object the young generation is built to catch cheaply</code></pre><p>New objects start in the young generation, which is small and scanned often &mdash; cheap, because there's little to check. An object that survives several of those scans gets "promoted" into the old generation, which is scanned far less frequently since it mostly holds long-lived, genuinely in-use data. Scanning a small region often, instead of a huge region constantly, is what makes this approach faster overall than treating every object the same way.</p>`,
    "Most garbage is young garbage — a small, frequently-checked region catches most of it cheaply."),

  general('mem-gc-pause-noticeable', 'memory-management-and-garbage-collection', 2,
    "Why can garbage collection cause a noticeable pause, and when is that most likely to happen?",
    `<p>Most garbage collection cycles are a "stop-the-world" event &mdash; JavaScript execution on that thread pauses completely until the collector finishes its pass. Young-generation collections are usually too quick to notice, since there's only a small region to scan.</p><pre><code>// a page doing lots of allocation in a hot loop or animation frame
function onScroll() {
  const particles = [];
  for (let i = 0; i &lt; 10000; i++) {
    particles.push({ x: i, y: i * 2 }); // fresh allocations every scroll event
  }
  render(particles);
}
// heavy allocation like this fills the young generation fast,
// and can eventually trigger a slower, more noticeable old-generation sweep</code></pre><p>A full, old-generation sweep is the one most likely to cause a visible stutter or dropped frame &mdash; it covers far more memory, so it takes proportionally longer, and it happens more often when code allocates heavily (as in a hot loop or a busy render path) and pushes a lot of data into the old generation.</p>`,
    "The small, frequent collections are usually invisible — it's the larger, less frequent sweeps that risk a visible stutter."),

  general('mem-allocation-vs-dealloc-cost', 'memory-management-and-garbage-collection', 1,
    "Why is allocating memory for a new object usually much cheaper than running a garbage collection pass?",
    `<p>Allocating a small object is typically just a quick pointer bump into the next free slot of memory &mdash; a near-constant-time operation with almost nothing to check. Freeing memory is a different kind of job entirely: the collector has to actually figure out what's still in use before it can reclaim anything.</p><pre><code>let data = [];
for (let i = 0; i &lt; 100000; i++) {
  data.push({ id: i }); // each allocation: cheap, fast, just grabs the next slot
}
data = null;
// deallocation is not instant or free -- the collector has to walk
// references from the roots to confirm nothing is reachable before reclaiming it</code></pre><p>That asymmetry is exactly why a loop that allocates heavily and then discards everything feels fine moment-to-moment, but can still trigger a slower collection pass later &mdash; the cost of all that cheap allocation gets paid back, in bulk, when the collector eventually has to clean it up.</p>`,
    "Grabbing a free slot is nearly instant; figuring out what's safe to reclaim takes real work."),

  trivia('mem-stack-vs-heap-where-values-live', 'memory-management-and-garbage-collection', 1,
    "Where does a primitive local variable like `let x = 5;` typically get stored, versus an object like `let obj = {};`?",
    "Think about which kind of value has a fixed, known size, and which can grow unpredictably.",
    "Fixed-size primitives fit neatly on the stack. Objects can grow and need to outlive a single call, so they live on the heap — the stack just holds a pointer to them.",
    "The primitive lives on the stack; the object lives on the heap, referenced from the stack",
    ["Both are always stored together on the heap, with no distinction", "Both are always stored together on the stack, with no distinction", "The primitive goes on the heap, while the object is stored directly on the stack"]),

  trivia('mem-why-stack-heap-split-exists', 'memory-management-and-garbage-collection', 2,
    "Why do JS engines maintain two separate memory regions — a stack and a heap — instead of just one?",
    "Think about what each region is actually optimized for — speed and predictability, versus flexibility.",
    "The stack's LIFO structure makes allocation/cleanup nearly free, but it only works for fixed-size, short-lived data — the heap trades that speed for flexibility and longer lifetimes.",
    "The stack needs fast, predictable cleanup tied to calls; the heap supports flexible, longer-lived allocations",
    ["The stack is for numbers only, and the heap is for strings only", "The split exists purely for security — the heap is encrypted and the stack is not", "There is no real difference; it's purely a naming convention with no functional distinction"]),

  trivia('mem-refcounting-zero-trigger', 'memory-management-and-garbage-collection', 2,
    "In a pure reference-counting garbage collector, exactly when does an object become eligible for collection?",
    "The whole approach is literally just counting incoming references.",
    "Reference counting is purely count-driven — the moment the count hits zero, with no references left anywhere, the object qualifies for collection.",
    "The instant its reference count drops all the way to zero",
    ["Only after a fixed timer interval has elapsed since its last access", "Only when the heap runs completely out of free memory", "Only when the developer manually calls a `free()` function"]),

  trivia('mem-mark-sweep-roots', 'memory-management-and-garbage-collection', 2,
    "In a mark-and-sweep collector, what counts as a \"root\" that the collector starts from?",
    "Think about what's reachable before following a single reference.",
    "Roots are the known-reachable starting points — globals and the active call stack — that the collector walks outward from to find everything else still in use.",
    "Things like global variables and whatever is currently on the call stack",
    ["Every single object ever created since the program started, with no exceptions", "Only objects explicitly tagged by the developer with a special keyword", "Only objects that are currently stored inside a Map or a Set"]),

  trivia('mem-mark-sweep-two-phases', 'memory-management-and-garbage-collection', 1,
    "What are the two phases a mark-and-sweep collector performs, in order?",
    "The algorithm's name literally lists its two steps in order.",
    "The name describes the order exactly: first mark every object reachable from a root, then sweep (reclaim) everything that was never marked.",
    "Mark everything reachable from the roots, then sweep away whatever was never marked",
    ["Sweep away all memory first, then mark whatever survives for reuse", "Count every reference first, then mark anything with a count above zero", "Compile all live objects to machine code, then mark them as permanent"]),

  trivia('mem-detached-dom-reference', 'memory-management-and-garbage-collection', 2,
    "A DOM element is removed from the page with `el.remove()`, but a variable elsewhere in the code still holds a reference to it. What happens to that element's memory?",
    "Being invisible on the page and being eligible for garbage collection are two different things.",
    "Removing an element from the page doesn't erase it from memory — it only becomes collectible once every reference to it, detached or not, is gone.",
    "It can't be collected — it's detached from the page but still reachable through that reference",
    ["It's automatically garbage collected the instant `.remove()` runs, regardless of other references", "It's immediately converted into a plain JavaScript object to save memory", "It throws an error the next time the page is rendered"]),

  trivia('mem-forgotten-setinterval-leak', 'memory-management-and-garbage-collection', 2,
    "A component sets up `setInterval(fn, 1000)` but is later removed from the page without ever calling `clearInterval`. What's the consequence?",
    "Nothing stops a timer automatically just because the thing it was set up for is gone.",
    "An uncleared interval is a live reference the engine can't ignore — it keeps calling `fn`, and everything that closure can reach stays alive in memory.",
    "The interval keeps running indefinitely, keeping anything `fn` closes over reachable the whole time",
    ["The browser automatically clears any interval tied to a removed element", "The interval silently stops running on its own once the page scrolls", "`setInterval` throws an error once its target element no longer exists"]),

  trivia('mem-accidental-global-variable', 'memory-management-and-garbage-collection', 2,
    "Inside a function, writing `total = 0;` without `var`, `let`, or `const` (in non-strict mode) creates what, and why is that a leak risk?",
    "Think about where an undeclared assignment actually attaches itself.",
    "Without a declaration keyword, that assignment creates (or overwrites) a property on the global object — a reference that persists for the page's whole lifetime.",
    "An accidental global variable, attached to the global object for the entire life of the page",
    ["A local variable scoped only to that function, no different from using `let`", "A syntax error that stops the script from running at all", "A constant binding that can never be reassigned afterward"]),

  trivia('mem-closure-retains-large-array', 'memory-management-and-garbage-collection', 2,
    "A closure captures one large array from its enclosing scope just to log its `.length` once. What's the memory risk of keeping that closure around afterward?",
    "A closure doesn't trim down what it holds onto based on what it actually reads.",
    "A closure keeps whatever it can reach alive, not just what it actually uses — capturing a big array for one small read still keeps the whole thing in memory.",
    "The entire array stays reachable and alive in memory for as long as the closure exists",
    ["Only the `.length` value is retained; the rest of the array is freed automatically", "There's no risk — closures only ever keep primitive values alive, never whole objects", "The array is copied, not referenced, so the original can be freed immediately"]),

  trivia('mem-weakmap-real-use-case', 'memory-management-and-garbage-collection', 2,
    "What's a typical real-world use case for choosing a `WeakMap` over a regular `Map`?",
    "Think about why you'd want a reference that doesn't keep its key alive.",
    "WeakMap's whole purpose is attaching data to an object without holding it alive yourself — ideal for metadata on DOM nodes or third-party objects.",
    "Attaching metadata to objects you don't own, without keeping them alive yourself",
    ["Storing a large number of plain string keys for fast repeated lookup", "Guaranteeing that the insertion order of every entry is preserved", "Making the whole collection iterable directly with a `for...of` loop"]),

  trivia('mem-generational-gc-basic-idea', 'memory-management-and-garbage-collection', 1,
    "What is the basic idea behind a \"generational\" garbage collector?",
    "Think about why most garbage is found among recently created objects, not old ones.",
    "Generational GC splits memory by object age because most objects are short-lived — scanning that 'young' group often is far cheaper than rescanning everything.",
    "It separates recently-created objects from long-lived ones, since most objects die young",
    ["It collects objects strictly in the order they were created, oldest first, with no other grouping", "It only ever runs once per \"generation\" of the application's deployment history", "It groups objects by which developer originally wrote the code that created them"]),

  trivia('mem-generational-promotion', 'memory-management-and-garbage-collection', 2,
    "In a generational collector, what typically happens to an object that survives several collection cycles in the young generation?",
    "Think about what \"graduating\" out of the frequently-checked group would mean.",
    "An object that keeps surviving young-generation sweeps gets promoted to the old generation — scanned far less often, since it's proven it tends to stick around.",
    "It gets \"promoted\" into the old generation, which is collected less frequently",
    ["It is immediately deleted, since surviving multiple cycles is treated as suspicious", "It is moved back to the stack to free up heap space", "It is converted into a WeakMap entry automatically"]),

  trivia('mem-generational-split-why-faster', 'memory-management-and-garbage-collection', 3,
    "Why does splitting the heap into young and old generations usually make garbage collection faster overall?",
    "Think about where most short-lived garbage actually tends to show up.",
    "Most garbage dies young, so frequently sweeping a small young generation catches most of it cheaply, while the larger, mostly-live old generation is scanned rarely.",
    "The small young generation is scanned often; the far larger old generation is scanned rarely",
    ["It allows the engine to skip running the garbage collector entirely for old objects, forever", "It lets two separate CPU cores run two completely independent JavaScript programs", "It removes the need for a mark-and-sweep algorithm altogether"]),

  trivia('mem-stop-the-world-meaning', 'memory-management-and-garbage-collection', 2,
    "What does it mean for a garbage collection pause to be a \"stop-the-world\" event?",
    "Think about what specifically has to wait, and for how long.",
    "A stop-the-world pause halts all JS execution on that thread for the duration of the collection — nothing else in that thread's code can run until it finishes.",
    "JavaScript execution on the main thread halts completely until that collection cycle finishes",
    ["The entire browser, including all other open tabs, freezes simultaneously", "The network connection is paused until the next page load", "Every `setTimeout` in the program is permanently cancelled"]),

  trivia('mem-young-vs-old-gen-pause-size', 'memory-management-and-garbage-collection', 2,
    "Why are young-generation collection pauses usually far less noticeable to users than old-generation (major) collection pauses?",
    "Think about how the size of the region being scanned relates to how long scanning it takes.",
    "Scanning a small young generation is fast enough to go unnoticed. The old generation is far bigger, so a full sweep there takes measurably longer and can cause visible jank.",
    "The young generation is small and quick to scan; the old generation is far larger and slower",
    ["Young-generation collections never actually pause execution at all, under any circumstances", "Old-generation collections run on a separate CPU core, so they should actually be faster", "There's no real difference in duration — perceived lag is purely due to network latency"]),

  trivia('mem-allocation-cheaper-than-sweep', 'memory-management-and-garbage-collection', 1,
    "Which is typically cheaper for a JS engine to do: allocating a small new object, or running a full garbage collection sweep?",
    "Think about which one just grabs the next free slot, versus which one has to inspect a lot of memory.",
    "Allocating is normally a quick bump of a pointer into free space. A collection sweep has to examine much more memory, making it the costlier of the two.",
    "Allocating the object — it's a fast, lightweight operation, unlike a full sweep of memory",
    ["They cost exactly the same amount of time in every engine", "Running a full sweep, since allocation always requires asking the operating system directly", "Neither has a meaningful cost — both are effectively instantaneous"]),

  trivia('mem-hot-loop-allocation-gc-frequency', 'memory-management-and-garbage-collection', 3,
    "Why does creating a brand-new object or array on every iteration of a hot loop tend to hurt performance, even though each individual allocation is cheap?",
    "One cheap thing done millions of times a second adds up somewhere else.",
    "One allocation is cheap, but a flood of them in a hot loop fills the young generation fast, forcing far more frequent GC cycles than a loop that reuses existing objects.",
    "The sheer volume fills the young generation fast, triggering far more frequent GC cycles",
    ["Each allocation inside a loop is individually far slower than one made outside a loop", "Loops are not allowed to allocate memory at all, so the code silently fails", "Objects created inside a loop are automatically stored on the heap twice, once per iteration"]),

  trivia('mem-reachability-vs-lexical-scope', 'memory-management-and-garbage-collection', 3,
    "A variable goes out of scope when its enclosing function returns. Does that automatically make the value it held unreachable and eligible for collection?",
    "Ask whether anything else in the program could still be pointing at that value.",
    "Scope and reachability aren't the same thing. A value stays reachable, and alive, as long as anything at all still references it — regardless of the original variable's scope.",
    "Not necessarily — if a closure or another object still references that value, it remains reachable",
    ["Yes, always — going out of scope and becoming unreachable are the exact same thing", "No — values are never eligible for collection until the entire program finishes running", "Yes, but this rule applies only to primitive values, never to objects"]),

  trivia('mem-gc-timing-not-guaranteed', 'memory-management-and-garbage-collection', 3,
    "If an object becomes completely unreachable, when exactly will the garbage collector free its memory?",
    "\"Eligible for collection\" and \"collected right now\" are not the same guarantee.",
    "Becoming unreachable only makes an object eligible for collection — the spec never guarantees when, or even that, the engine actually reclaims it right away.",
    "At some unspecified later point the engine chooses — there's no guarantee it happens immediately",
    ["Immediately, in the very next line of code, guaranteed by the spec", "Exactly 1000 milliseconds after it becomes unreachable, per the ECMAScript spec", "Only when the developer calls a global `gc()` function, which always exists in every environment"]),

  trivia('mem-weakmap-key-not-kept-alive', 'memory-management-and-garbage-collection', 2,
    "An object is stored as a key in a `WeakMap`, and nothing else anywhere references it. Does being inside the `WeakMap` keep it alive?",
    "Think about the one thing that makes WeakMap different from a regular Map for GC purposes.",
    "WeakMap keys are held weakly — unlike a regular Map, being stored in one doesn't count as a reference that keeps an object reachable for GC purposes.",
    "No — WeakMap holds its keys weakly, so with no other reference left, it remains collectible",
    ["Yes — any collection that contains a reference to an object always keeps it alive, WeakMap included", "No, but only because WeakMap entries expire automatically after a fixed timeout", "Yes, unless the WeakMap itself is explicitly cleared with a `.clear()` method"]),
];

function validateLengths() {
  const problems: string[] = [];
  const seenSlugs = new Set<string>();
  for (const q of QUESTIONS) {
    if (q.slug.length > 100) problems.push(`${q.slug}: slug ${q.slug.length} chars > 100`);
    if (seenSlugs.has(q.slug)) problems.push(`${q.slug}: duplicate slug within this file`);
    seenSlugs.add(q.slug);
    if (q.questionType === QuestionTypeEnum.Trivia && q.options.filter((o) => o.correct).length !== 1) {
      problems.push(`${q.slug}: Trivia question must have exactly 1 correct option (found ${q.options.filter((o) => o.correct).length})`);
    }
    if (q.questionType === QuestionTypeEnum.Trivia && q.options.length !== 4) {
      problems.push(`${q.slug}: Trivia question must have exactly 4 options (found ${q.options.length})`);
    }
    for (const opt of q.options) {
      if (opt.option.length > 255) problems.push(`${q.slug}: option text ${opt.option.length} chars > 255`);
      if (opt.comment && opt.comment.length > 200) problems.push(`${q.slug}: comment ${opt.comment.length} chars > 200 ("${opt.comment.slice(0, 40)}...")`);
    }
  }
  if (problems.length) {
    console.error('Length/shape violations found (would silently truncate mid-word or break grading):');
    for (const p of problems) console.error('  - ' + p);
    throw new Error(`${problems.length} violation(s) — aborting before any writes.`);
  }
  console.log(`✔ Validation passed — all ${QUESTIONS.length} questions' options/comments within limits, every Trivia has exactly 1 correct option.\n`);
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

  const subject = await subjectRepo.findOne({ where: { slug: 'javascript' } });
  if (!subject) throw new Error('Subject "javascript" not found.');

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
      marks: marksFor(q.level),
      timeAllowed: timeFor(q.level),
      tag: q.tag,
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

  console.log('\nPer-topic question-type breakdown after this run:');
  for (const slug of topicSlugs) {
    const topic = topicBySlug.get(slug)!;
    const rows = await AppDataSource.query(
      `SELECT q.questionType, COUNT(*) as cnt FROM question q
       JOIN question_topic qt ON qt.questionId = q.id
       WHERE qt.topicId = ? AND q.status = 'Active'
       GROUP BY q.questionType`,
      [topic.id],
    );
    console.log(`   ${slug.padEnd(40)} ${JSON.stringify(rows)}`);
  }

  await AppDataSource.destroy();
  console.log('\nDone.');
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
