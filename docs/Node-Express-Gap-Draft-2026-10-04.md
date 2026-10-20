# Node.js Curriculum Enhancement — Express.js Fundamentals (Draft)

**Status: draft for review — no topic created, nothing seeded.**

## Why this topic

All three independent review passes on the 12 original Node.js topics (189 questions, now fully reviewed and promoted to Active) flagged the same gap: **zero curriculum coverage of building an actual web server/API with Express.js** — the dominant real-world Node.js web framework. The raw `http`/`https` module is taught well (nodejs-core-modules, file-system-networking), but nothing bridges that to how real apps are actually built. Two of Node's 11 dependent job roles explicitly name this skill: "Backend Engineer (Node/Express)" and "Backend Engineer (Nest JS)."

## Proposed topic

| Field | Value |
|---|---|
| Title | Express.js Fundamentals |
| Slug | `express-js-fundamentals` |
| Label | Intermediate |
| Track | Node.js Professional (alongside package-management, debugging-testing, performance-scaling, security-fundamentals) |
| Description | Build real HTTP APIs and web servers with Express.js — the framework behind most real-world Node.js backends — covering routing, middleware, request/response handling, and error propagation. |
| Goal | Confidently build, structure, and secure a REST API using Express.js routing and middleware patterns. |

Target depth: ~20 Trivia + 10 General, matching the depth of the other original Node.js topics (15-17 Trivia + 1 General each) plus a bit more given this topic's practical importance.

## Draft Trivia questions (20)

**1. Level 1 — what Express actually is**
```
Q: What is Express.js, fundamentally?
Options:
  - [CORRECT] A minimal web framework built on top of Node's http module, adding routing and middleware
    Comment: Express doesn't replace http — it wraps it, giving you a router and a middleware pipeline instead of handling every request with one raw callback.
  - A separate runtime that replaces Node.js for running web servers
  - A database that stores application data for Node.js apps
  - A built-in Node.js core module, like fs or path
Hint: Think about what it adds on top of something you already know, rather than what it replaces.
```

**2. Level 1 — basic app + listen**
```
Q: What does app.listen(3000) do in an Express app?
Options:
  - [CORRECT] Starts the HTTP server, binding it to port 3000 and beginning to accept requests
    Comment: Under the hood, Express creates a real Node http.Server and calls its own .listen() — app.listen is a thin convenience wrapper.
  - Registers a new route that only responds on port 3000
  - Loads middleware that limits the app to 3000 concurrent requests
  - Compiles the Express app into a production-ready build
Hint: The number here is something you'd recognize from a URL.
```

**3. Level 1 — basic routing**
```
Q: Which Express method handles GET requests to a specific path?
Options:
  - [CORRECT] app.get('/path', handler)
  - app.route('/path', handler)
  - app.request('/path', handler)
  - app.fetch('/path', handler)
Comment (on correct): Express exposes one method per HTTP verb — app.get, app.post, app.put, app.delete, etc. — each taking a path and a handler.
Hint: The method name matches the HTTP verb it responds to.
```

**4. Level 2 — route parameters**
```
Q: In a route defined as app.get('/users/:id', handler), how do you access the id value inside the handler?
Options:
  - [CORRECT] req.params.id
    Comment: Route segments prefixed with : become named properties on req.params, parsed directly from the URL path.
  - req.query.id
  - req.body.id
  - req.id
Hint: This value comes from the URL's path itself, not its query string or a request body.
```

**5. Level 2 — query strings vs route params**
```
Q: For a request to /search?term=node, where does Express put the value of term?
Options:
  - [CORRECT] req.query.term
    Comment: Anything after the ? in the URL is parsed into req.query — distinct from req.params, which comes from named path segments.
  - req.params.term
  - req.body.term
  - req.headers.term
Hint: This part of the URL comes after a question mark, not from a named path segment.
```

**6. Level 2 — middleware signature**
```
Q: What's the standard signature of an Express middleware function?
Options:
  - [CORRECT] (req, res, next) => { ... }
    Comment: Every middleware gets the request, the response, and a next function it must call to pass control to the next middleware/route — or the request hangs forever.
  - (req, res) => { ... }
  - (err, req, res) => { ... }
  - (next, req, res) => { ... }
Hint: There's a third argument whose entire job is passing control onward.
```

**7. Level 2 — middleware order matters**
```
Q: Two middleware functions are registered with app.use() in a specific order. Does that order matter?
Options:
  - [CORRECT] Yes — middleware runs in the exact order it was registered, and each must call next() to reach the one after it
    Comment: Express builds a literal pipeline from your app.use()/app.get() calls in registration order — reordering them changes what runs before what, every time.
  - No — Express always runs authentication middleware first regardless of registration order
  - No — middleware order only matters for error-handling middleware, never regular middleware
  - Yes, but only for middleware mounted on different HTTP methods
Hint: Think of it as a literal pipeline, built in exactly the order you wrote it.
```

**8. Level 1 — built-in JSON body parsing**
```
Q: A POST request sends a JSON body, but req.body is undefined inside the route handler. What's the most likely missing piece?
Options:
  - [CORRECT] The app never registered express.json() as middleware to parse incoming JSON bodies
    Comment: Express doesn't parse request bodies by default — express.json() (or express.urlencoded() for form data) has to be registered with app.use() before routes that read req.body.
  - The client forgot to set a Content-Length header
  - Express only supports reading request bodies on PUT requests, not POST
  - req.body is read-only and can never be accessed directly
Hint: Express doesn't do this parsing for you automatically — something has to be added first.
```

**9. Level 2 — serving static files**
```
Q: Which built-in Express middleware serves static files (like images or CSS) from a folder?
Options:
  - [CORRECT] express.static('public')
    Comment: express.static maps a folder on disk directly to URLs, so a request for /logo.png is served straight from public/logo.png with no route needed.
  - express.files('public')
  - app.static('public')
  - express.serve('public')
Hint: The method name describes what kind of content it's meant for — content that doesn't change per request.
```

**10. Level 2 — res methods**
```
Q: What's the difference between res.send() and res.json() in Express?
Options:
  - [CORRECT] res.json() always serializes the value to JSON and sets the Content-Type header accordingly; res.send() infers the format from the value's type
    Comment: res.send() is flexible (string, Buffer, object — it guesses), while res.json() is explicit and always produces JSON, which is why most APIs prefer it for consistency.
  - res.send() only works with strings; res.json() only works with numbers
  - They are identical in every way; res.json() is just an older, deprecated alias
  - res.json() ends the response immediately; res.send() keeps the connection open
Hint: One of them is explicit about the output format; the other guesses based on what you pass it.
```

**11. Level 3 — async errors aren't caught automatically**
```
Q: A route handler is declared as an async function and throws inside an await call. What happens in a typical Express 4 app with no extra setup?
Options:
  - [CORRECT] The request hangs or crashes the process — Express's built-in error handling doesn't catch rejected promises from async handlers automatically
    Comment: In Express 4, a thrown error inside an async function becomes an unhandled rejection unless you catch it yourself and call next(err) — this is one of the most common real-world Express gotchas.
  - Express automatically converts the thrown error into a 500 response, the same as a synchronous throw
  - The request silently succeeds with an empty response body
  - Node.js automatically restarts the server to recover from the error
Hint: Express's automatic error-catching was built around synchronous code, before async/await was common.
```

**12. Level 2 — error-handling middleware signature**
```
Q: How does Express distinguish an error-handling middleware function from a regular one?
Options:
  - [CORRECT] It takes four arguments instead of three — (err, req, res, next) — and Express only calls it when next() was called with an error
    Comment: That extra leading err parameter is the signal Express's internals look for; a normal middleware's three-argument function is never treated as an error handler.
  - It must be registered using app.error() instead of app.use()
  - It must be the very first middleware registered in the file
  - It has no special signature; Express checks the function's name instead
Hint: Count the parameters — the real signal isn't where it's registered, it's what it accepts.
```

**13. Level 2 — next(err) propagation**
```
Q: Inside a regular (non-error) middleware, calling next(err) with a truthy argument does what?
Options:
  - [CORRECT] Skips all remaining regular middleware and routes, jumping straight to the nearest error-handling middleware
    Comment: Passing anything to next() switches Express into error-handling mode for that request — it stops looking for the next regular handler entirely.
  - Logs the error to the console but continues to the next regular middleware as normal
  - Immediately crashes the Node.js process
  - Retries the same middleware function up to 3 times automatically
Hint: Think about what calling next() with nothing does, then what changes when you give it an argument.
```

**14. Level 2 — modular routing with Router**
```
Q: What does express.Router() let you do?
Options:
  - [CORRECT] Create a self-contained, mountable set of routes and middleware that can be attached to the main app under a path prefix
    Comment: A Router behaves like a mini Express app — defining its own routes/middleware — that you mount with app.use('/prefix', router), keeping large apps organized into modules.
  - Automatically generate API documentation from your route definitions
  - Route requests to a different server entirely, acting as a reverse proxy
  - Cache route responses in memory for faster repeated requests
Hint: Think about organizing a large app's routes into separate, reusable files.
```

**15. Level 1 — status codes**
```
Q: Which Express method explicitly sets the HTTP status code of a response?
Options:
  - [CORRECT] res.status(404)
    Comment: res.status() sets the code and returns res itself, which is why it's commonly chained: res.status(404).json({ error: 'Not found' }).
  - res.code(404)
  - res.setStatus(404)
  - res.http(404)
Hint: It's commonly chained directly onto another res method, like .json() or .send().
```

**16. Level 3 — CORS**
```
Q: A frontend running on localhost:3000 tries to call an Express API on localhost:4000, and the browser blocks the request with a CORS error. What's actually happening?
Options:
  - [CORRECT] The browser is enforcing same-origin policy; the API needs to explicitly send Access-Control-Allow-Origin headers to permit cross-origin requests
    Comment: CORS is a browser-side protection, not a server-side limitation — the server has to opt in to being called from other origins by sending the right response headers (often via the cors npm middleware).
  - Express blocks all requests that don't originate from the exact same port by default, with no way to allow it
  - The two apps are on different ports, so no network request could possibly reach the API at all
  - This only happens if the API and frontend use different programming languages
Hint: This restriction is enforced by something other than Express or Node itself.
```

**17. Level 2 — app.use() with no path**
```
Q: What does app.use(middlewareFn) (with no path argument) apply to?
Options:
  - [CORRECT] Every incoming request to the app, regardless of path or HTTP method
    Comment: Omitting the path makes it a global middleware — it runs for every request before Express even checks which route matches.
  - Only GET requests
  - Only requests to the root path /
  - Only requests that don't match any defined route
Hint: Think about what's missing from this call compared to a route-specific one.
```

**18. Level 2 — request body size**
```
Q: Why might express.json() reject a large request body with a 413 error by default?
Options:
  - [CORRECT] express.json() has a default body size limit (100kb) to protect the server from excessively large payloads
    Comment: The limit is configurable via express.json({ limit: '5mb' }) — it exists specifically so a malicious or buggy client can't send an enormous body and exhaust server memory.
  - Express doesn't actually support JSON bodies larger than a single network packet
  - 413 errors are unrelated to body size and indicate a database connection failure
  - JSON parsing in Node.js has a hard, unconfigurable 100kb ceiling
Hint: Think about what a size limit would actually be protecting the server from.
```

**19. Level 1 — template engines (brief)**
```
Q: What is a "template engine" like EJS or Pug used for in an Express app?
Options:
  - [CORRECT] Rendering dynamic HTML on the server by injecting data into HTML-like template files
    Comment: res.render('page', { data }) combines a template file with real data server-side, producing plain HTML sent to the browser — distinct from an API that just returns JSON.
  - Compiling Express routes into faster machine code
  - Validating incoming request bodies against a schema
  - Managing database migrations for the app
Hint: Think about server-rendered pages, as opposed to an API that just returns JSON.
```

**20. Level 3 — Express vs raw http for this exact job**
```
Q: Why would a team choose Express over the raw http module for a REST API with a dozen different endpoints, each needing different middleware (auth, logging, validation)?
Options:
  - [CORRECT] Express's router and middleware pipeline handle per-route composition and path/method matching that would otherwise require hand-written if/else branching on every request
    Comment: The raw http module gives you exactly one callback per server, with no built-in routing — Express's whole value is replacing that manual branching with a declarative router and reusable middleware.
  - The raw http module cannot handle more than one endpoint per server at all
  - Express requests are processed faster at the network level than raw http requests
  - Raw http module servers cannot run on the same port as other services
Hint: Think about what you'd have to hand-write yourself to replicate Express's routing with only the raw module.
```

## Draft General questions (10)

**1. Level 1 — middleware pipeline mental model**
```
Q: Walk through what actually happens, step by step, when a GET request hits an Express app with three app.use() middleware registered before the matching route.
A: <p>Express processes a request as a pipeline, running each piece in the exact order it was registered. For a GET request, it first checks the three global middleware in order — each one runs, and as long as it calls <code>next()</code>, control passes to the next one in line.</p><p>Once all three have called <code>next()</code>, Express finds the first route definition whose path and HTTP method match the request, and runs that handler. If any middleware along the way sends a response itself (via <code>res.send()</code> or similar) instead of calling <code>next()</code>, the pipeline stops there and the route handler never runs at all.</p>
Hint: Each middleware either passes control forward or ends the request itself — there's no third option.
```

**2. Level 2 — middleware vs route handler**
```
Q: What's the practical difference between a middleware function and a route handler in Express, given they often have the exact same (req, res, next) signature?
A: <p>Structurally they can look identical, but the role is different. A middleware is meant to do one small job — logging, checking auth, parsing a body — and then call <code>next()</code> to hand off to whatever comes after it. A route handler is the final destination for a specific path and method; it's expected to actually respond, usually via <code>res.send()</code>, <code>res.json()</code>, or similar.</p><p>In practice, a route handler can also receive multiple middleware functions in sequence before it (e.g. <code>app.get('/admin', requireAuth, handler)</code>), so the real distinction is about intent and position in the chain, not the function signature itself.</p>
Hint: Think about what each one is expected to do at the end of its own job — pass along, or actually respond.
```

**3. Level 2 — debugging an app.use() ordering bug**
```
Q: An Express app defines an authentication-check middleware with app.use(), but places it after the routes it was supposed to protect. What actually happens, and how would you fix it?
A: <p>Because Express runs middleware and routes strictly in registration order, any route defined before the auth middleware will already have matched and responded before that middleware ever runs — the protection simply never applies to those routes.</p><p>The fix is purely about ordering: move the <code>app.use(authMiddleware)</code> call so it's registered before the routes it's meant to guard. If only specific routes need protection rather than the whole app, it's often cleaner to pass the middleware directly into those route definitions instead: <code>app.get('/admin', authMiddleware, handler)</code>.</p>
Hint: Nothing about the middleware's own logic is broken — think about what registration order actually controls.
```

**4. Level 3 — the async-handler gotcha, applied**
```
Q: A route handler is written as async (req, res) => { const user = await db.findUser(req.params.id); res.json(user); }. If db.findUser() rejects, the client request just hangs with no response at all, and nothing shows up in the server logs. Why, and what's the fix?
A: <p>In Express 4, a rejected promise from an async route handler isn't automatically caught and converted into an error response the way a synchronous <code>throw</code> would be — it becomes an unhandled promise rejection instead, which Express's built-in error handling never sees. The request is simply left open.</p><p>The fix is to catch the rejection explicitly and hand it to Express's error pipeline: wrap the body in a try/catch and call <code>next(err)</code> in the catch block, or use a small wrapper utility that does this automatically for every async handler. Express 5 changes this behavior to catch rejected promises automatically, but most apps today are still on Express 4.</p>
Hint: Express's automatic error handling was designed around synchronous throws, before async/await existed in the language.
```

**5. Level 2 — choosing JSON API vs server-rendered HTML**
```
Q: A team is deciding whether their new Express app should return JSON (a pure API) or server-rendered HTML (using a template engine). What should that decision actually depend on?
A: <p>The deciding factor is who's consuming the response. If a separate frontend (a React/Angular app, or a mobile app) will call this server and render its own UI, a JSON API is the right fit — the server's only job is data. If the server itself needs to produce a complete, ready-to-display page (common for simpler sites, SEO-sensitive pages, or admin tools with no separate frontend build), a template engine rendering real HTML is more appropriate.</p><p>Many real systems do both: a JSON API for the main application, plus a few server-rendered pages for things like email-unsubscribe links or admin dashboards where a full frontend build would be overkill.</p>
Hint: Ask who's actually going to receive and use the response — a program, or a browser expecting a finished page.
```

**6. Level 2 — modularizing routes with Router**
```
Q: An Express app's single routes file has grown to handle users, products, and orders, all mixed together, and it's getting hard to navigate. How would express.Router() help restructure this, concretely?
A: <p>Each resource gets its own router file — a <code>users.js</code>, <code>products.js</code>, and <code>orders.js</code>, each creating its own <code>express.Router()</code> instance and defining only the routes relevant to that resource.</p><p>The main app file then mounts each one under its own path prefix: <code>app.use('/users', usersRouter)</code>, <code>app.use('/products', productsRouter)</code>, and so on. Inside <code>usersRouter</code>, a route defined as <code>router.get('/:id', handler)</code> actually responds at <code>/users/:id</code> once mounted — the router doesn't need to know its own prefix, which is what makes it reusable and easy to relocate.</p>
Hint: Think about giving each resource its own small, self-contained set of routes, then combining them in one place.
```

**7. Level 2 — security: helmet and why it matters**
```
Q: A security review recommends adding the helmet middleware to an Express app with no further explanation. What does helmet actually do, and why would a reviewer ask for it specifically?
A: <p>helmet is a collection of small middleware functions that each set one HTTP response header related to a known class of browser-side attack — things like preventing the page from being embedded in a hidden iframe (clickjacking), or stopping the browser from guessing a response's content type in a way that can be exploited (MIME-sniffing).</p><p>None of these headers are set by Express by default, so a reviewer recommending helmet is really asking for a quick, well-tested baseline of browser-security headers rather than asking the team to research and configure each one individually from scratch.</p>
Hint: Think about what category of protection these headers share, even though each one guards against something slightly different.
```

**8. Level 2 — validating request input**
```
Q: An Express route handler reads req.body.age and calls Number(req.body.age) directly, with no validation. What could go wrong, and what's a more defensive approach?
A: <p>Nothing stops a client from sending a string, an object, a missing field entirely, or a deliberately malicious value — <code>Number(req.body.age)</code> on something like <code>"abc"</code> silently produces <code>NaN</code>, which can then flow further into the app's logic (like a database query) without ever triggering an obvious error.</p><p>A more defensive approach validates the shape and type of incoming data before using it — either manually (checking <code>typeof</code> and reasonable bounds) or with a validation library, and responding with a clear 400 error immediately if the input doesn't look right, rather than letting bad data propagate silently into the rest of the request's logic.</p>
Hint: Think about what a client could send that isn't a well-formed number at all, and what happens to that value if nothing catches it.
```

**9. Level 1 — what changes between dev and a real deployment**
```
Q: An Express app runs fine locally with npm start, but in production it needs to handle real traffic reliably. Name two concerns that matter in production that usually don't come up during local development.
A: <p>Two common ones: process management, and environment configuration. Locally, if the Node process crashes you just restart it by hand — in production, something needs to detect the crash and restart the process automatically (a process manager like PM2, or the hosting platform's own restart policy), since nobody's watching the terminal.</p><p>Environment configuration is the other: local development often hardcodes values or uses a loose <code>.env</code> file, but production needs secrets (database credentials, API keys) managed securely rather than committed to the codebase, and typically needs different values entirely (a production database URL, not a local one) injected through the hosting platform's own environment variable system.</p>
Hint: Think about what happens the moment nobody is watching a terminal window anymore.
```

**10. Level 3 — connecting Express to a real database layer**
```
Q: An Express route handler needs to fetch a user from a database before responding. What does that interaction actually look like in terms of async flow, and what's the risk of getting it wrong?
A: <p>Since virtually all database drivers in Node.js are asynchronous, the route handler has to <code>await</code> the query (or use a <code>.then()</code> chain) before it has anything to send back — the handler can't respond with data it doesn't have yet. A typical shape: <code>const user = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]); res.json(user);</code>.</p><p>The real risk is in what happens when that query fails or returns nothing — if there's no check for a missing user, the handler might call <code>res.json(undefined)</code> and send a confusing empty response instead of a proper 404, and if the rejection isn't caught (see the async-handler gotcha), the request can hang entirely instead of returning any error at all.</p>
Hint: Think about the two different ways this could fail silently: a query that fails outright, versus one that succeeds but finds nothing.
```

## Suggested next steps

1. Review this draft — approve, request edits, or reject individual questions.
2. On approval, I'll create the `express-js-fundamentals` topic record, wire it into the Node.js Professional track, and seed these 30 questions as `Pending` (per the established workflow for this platform — review again, then promote to `Active`).
3. Secondary, smaller follow-up worth considering separately: a few of the dependent job roles name NestJS specifically ("Backend Engineer (Nest JS)") — once Express fundamentals are in place, a short NestJS-contrast topic (decorators, dependency injection, modules — building on Express concepts) could close that remaining gap. Not drafted here; flagging for a future pass.
4. Also flagged by the reviews, lower priority: `require` caching/circular-require edge cases, ESM/CJS interop, and `worker_threads`/`cluster` direct coverage are all thinner than ideal in the existing topics — worth a small follow-up gap-fill pass if you want full depth parity with CSS/HTML/JS.
