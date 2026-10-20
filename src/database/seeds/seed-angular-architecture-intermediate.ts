import { AppDataSource } from '../data-source';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';

// New-authorship pass (not a review of the existing Pending backlog) for the Intermediate
// half of the "Angular Architecture" curriculum plan: angular-modules, standalone-components,
// lazy-loading, advanced-routing, component-state-patterns, advanced-change-detection. All 6
// topics already exist (seeded with the Angular track work) and currently sit at 0 Active
// questions despite 27-49 Pending each — this pass is deliberately independent of that
// backlog, seeding fresh scenario/judgment-based content straight to Active per the agreed
// plan, rather than reviewing what's already Pending.
//
// Each topic: 9 Trivia (MCQ) + 3 General (free-text) = 12, written to avoid overlapping the
// existing Pending bank's largely definitional angle (sampled before drafting) by leaning on
// "you're debugging X" / "you're deciding between A and B" scenarios instead.
//
// Usage: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-angular-architecture-intermediate.ts

interface OptionSpec { option: string; correct: boolean; comment: string | null; }
interface QuestionSpec {
  slug: string;
  question: string;
  questionType: QuestionTypeEnum;
  answer: string;
  hint: string;
  options: OptionSpec[];
  topicSlug: string;
}

const LEVEL = 2; // Intermediate
const MARKS = 2;
const TIME_ALLOWED = 50;

function trivia(slug: string, topicSlug: string, question: string, answer: string, hint: string, correctComment: string, correctOption: string, wrongOptions: string[]): QuestionSpec {
  const options: OptionSpec[] = [
    { option: correctOption, correct: true, comment: correctComment },
    ...wrongOptions.map((o) => ({ option: o, correct: false, comment: null })),
  ];
  return { slug, question, questionType: QuestionTypeEnum.Trivia, answer, hint, options, topicSlug };
}

function general(slug: string, topicSlug: string, question: string, answer: string, hint: string): QuestionSpec {
  return { slug, question, questionType: QuestionTypeEnum.General, answer, hint, options: [], topicSlug };
}

const QUESTIONS: QuestionSpec[] = [

  // ── angular-modules ──────────────────────────────────────────────────────
  trivia('ngmodule-root-provider-shadowed-by-lazy-module', 'angular-modules',
    "A service is declared with providedIn: 'root'. A lazy-loaded feature module also lists that same service in its own providers array. What happens when a component inside that lazy module injects it?",
    "providedIn: 'root' registers a service with the app's root injector, but every lazy-loaded module gets its own child injector. If that module's own providers array also lists the same service, it shadows the root instance for everything inside that module's injector subtree, creating a second, separate instance.",
    "Think about which injector actually resolves the dependency first.",
    "Gets a new instance from the lazy module's own injector, separate from root.",
    "Gets a new instance from the lazy module's own child injector, separate from the app-wide root instance.",
    ["Angular throws a duplicate-provider build error", "It still receives the single root instance; providers arrays are ignored for root-provided services", "The service becomes unusable inside that module"]),

  trivia('coremodule-import-guard-pattern', 'angular-modules',
    "A CoreModule is meant to hold app-wide singleton services and should only ever be imported once, by AppModule. What's the standard technique to fail fast if it's imported a second time by mistake?",
    "Inject CoreModule itself in its own constructor using @Optional() and @SkipSelf(), and throw if that resolves to a truthy value — a truthy result means an ancestor injector already loaded CoreModule once, so this is a second import.",
    "The guard checks whether an ANCESTOR injector already has this exact module.",
    "The @Optional()/@SkipSelf() constructor guard throws on a second import.",
    "Inject CoreModule itself with @Optional() and @SkipSelf(), throwing if it already resolves to an instance.",
    ["Angular deduplicates repeated NgModule imports automatically, no guard needed", "Mark the module class @Injectable() instead of @NgModule()", "Add a code comment warning other developers not to import it twice"]),

  trivia('shared-component-single-declaration-rule', 'angular-modules',
    "OrdersModule and InventoryModule both need the same PriceDisplayComponent. Per Angular's module rules, where should that component actually be declared?",
    "A component, directive, or pipe can only be declared in exactly one NgModule's declarations array — Angular's compiler rejects declaring the same one in two modules. The fix is a SharedModule that both feature modules import, which exports the component once.",
    "A declarable only has ONE home module — reuse happens through exporting, not re-declaring.",
    "SharedModule declares it once; both feature modules import SharedModule.",
    "In a SharedModule that both OrdersModule and InventoryModule import.",
    ["Declared separately in both OrdersModule and InventoryModule's declarations arrays", "Declared in AppModule and exported globally to every module automatically", "Declared in CoreModule since CoreModule is meant for shared things"]),

  trivia('declarations-of-2-modules-error-cause', 'angular-modules',
    "Angular throws \"Type ... is part of the declarations of 2 modules\" at build time. What causes this specific error?",
    "A component, directive, or pipe was listed in the declarations array of two different NgModules. Each declarable can belong to exactly one owning module; to use it elsewhere, that module must export it and the consumer must import the owning module (or share it via a SharedModule).",
    "The error name describes the mistake almost literally — check how many declarations arrays list it.",
    "The same declarable is listed in two different modules' declarations arrays.",
    "The same component/directive/pipe is listed in two separate modules' declarations arrays.",
    ["Two components share the same CSS selector by accident", "A circular import exists between the two modules' TypeScript files", "The component's template references a directive that isn't imported"]),

  trivia('eager-vs-lazy-admin-module-decision', 'angular-modules',
    "AdminModule is only ever visited by 5% of users. You're deciding whether to import it eagerly into AppModule or lazy-load it via a route. What's the architecturally correct call?",
    "Lazy-load it. Code almost nobody runs shouldn't ship in the bundle everybody downloads on first load — lazy loading via loadChildren/loadComponent defers that cost to the rare users who actually navigate to /admin, keeping the initial bundle smaller for everyone else.",
    "Think about who pays the bundle-size cost under each choice.",
    "Lazy-loading defers the cost to the few users who actually visit it.",
    "Lazy-load AdminModule via the router — rarely-used code shouldn't inflate the initial bundle everyone downloads.",
    ["Import it eagerly — bundle size doesn't meaningfully differ either way", "Import it eagerly, since lazy loading only matters for apps with 10+ modules", "Either choice is equivalent as long as AdminModule has no dependencies"]),

  trivia('barrel-file-tree-shaking-pitfall', 'angular-modules',
    "A feature module's index.ts barrel file re-exports everything from a dozen internal files. Over time, bundle size creeps up even for routes that only need one small utility from that module. What's the likely cause?",
    "Barrel files can defeat tree-shaking: importing even a single symbol from the barrel can pull in the whole re-exported module graph behind it, especially when intermediate files have side effects the bundler can't safely prune, so unused code rides along into the bundle.",
    "Importing ONE thing from a barrel file doesn't always mean only that one thing ships.",
    "Barrels often prevent effective tree-shaking of the unused re-exported code.",
    "Barrel re-exports can prevent the bundler from tree-shaking out the unused parts of the module graph.",
    ["Barrel files always tree-shake perfectly — the real cause must be elsewhere", "TypeScript barrel files are deprecated and no longer supported by Angular's compiler", "Angular requires every barrel export to be eagerly loaded as a separate chunk"]),

  trivia('forroot-forchild-singleton-reasoning', 'angular-modules',
    "A library module exposes both RouterModule.forRoot(routes) and RouterModule.forChild(routes) instead of one combined configure(routes) method. Why does this split exist?",
    "forRoot configures and provides the singleton services that should exist exactly once app-wide (like the Router itself), while forChild only registers route configuration without re-providing those singletons. Calling forRoot again in a lazy module would create duplicate singleton instances.",
    "One of the two methods is meant to run exactly once, app-wide.",
    "forRoot provides app-wide singletons once; forChild avoids re-providing them.",
    "forRoot provides the app-wide singleton services once; forChild only adds route configuration without re-providing them.",
    ["forChild is for small apps and forRoot is for large apps", "forRoot is for lazy modules and forChild is for the root module", "There's no real difference — it's just a naming convention"]),

  trivia('sharedmodule-stateful-service-antipattern', 'angular-modules',
    "A SharedModule imported by five different lazy-loaded feature modules lists a stateful CartService in its providers array. What goes wrong?",
    "Each lazy module gets its own child injector, so importing a module that provides a service creates a separate instance per lazy module that imports it — the five feature modules end up with five disconnected CartService instances instead of one shared cart. App-wide singletons belong in providedIn: 'root' or a module imported only by AppModule, never a shared module imported by multiple lazy modules.",
    "Count how many injectors actually exist once five lazy modules are involved.",
    "Each importing lazy module gets its own separate CartService instance.",
    "Each of the five lazy modules gets its own separate CartService instance, breaking the assumption of one shared cart.",
    ["Nothing — SharedModule guarantees exactly one instance app-wide", "Angular throws a build error when a shared module provides a stateful service", "The service only works correctly in the first lazy module that loads"]),

  trivia('ngmodule-import-order-provider-override', 'angular-modules',
    "Within one @NgModule's imports array, two imported modules both configure a provider for the same injection token. Does the order you list those modules affect which provider wins?",
    "Yes. When multiple providers are registered for the same token at the same injector level, Angular's DI uses the last one registered — so import order matters whenever two imported modules both configure the same token.",
    "DI resolves conflicts by registration order, not alphabetically.",
    "Yes — the later-listed module's provider for that token wins.",
    "Yes — whichever module is listed later in the imports array wins for that shared token.",
    ["No, Angular throws an ambiguous-provider error immediately at bootstrap", "No, the first-listed module always wins regardless of order", "Order only matters for lazy-loaded modules, never for eager ones"]),

  general('ngmodule-to-standalone-tradeoff', 'angular-modules',
    "Your app currently uses NgModules for every feature area. A teammate proposes migrating to standalone components instead. Describe one concrete architectural benefit standalone components provide over the NgModule pattern, and one real migration cost to plan for.",
    "Benefit: standalone components remove the module-wrapper boilerplate — a component lists its own dependencies directly in its own imports array, and a single component can be lazy-loaded via loadComponent without needing a whole feature module built just to hold it. Cost: existing NgModule-based code and third-party libraries built around forRoot()/forChild() module patterns need importProvidersFrom() as a bridge, and per-component imports arrays can get verbose without the module-level consolidation of common imports teams previously relied on — migration is usually incremental, file by file, not a single rewrite.",
    "Weigh boilerplate removal against what existing code and libraries assume about modules."),

  general('lazy-module-service-scope-boundary', 'angular-modules',
    "A new engineer adds a stateful service directly to a feature module's providers array instead of using providedIn: 'root'. Under what circumstance does this choice actually matter, and when is it functionally identical to providedIn: 'root'?",
    "It matters when that module is lazy-loaded: the service becomes scoped to that lazy module's own child injector, producing a separate instance from anything injecting the same class elsewhere via providedIn: 'root'. It's functionally identical to providedIn: 'root' only when the module is eagerly loaded as part of the root injector (e.g. imported by AppModule) — there's only one injector in play either way, so the distinction has no observable effect.",
    "The deciding factor is whether the module ever gets its own separate child injector."),

  general('sharedmodule-services-rule-explained', 'angular-modules',
    "A common SharedModule convention says 'only declare and export presentational components/pipes/directives here — never add services to this module's providers array.' Explain what goes wrong if that rule is broken.",
    "SharedModule is typically imported by several feature modules, often more than one of which is lazy-loaded. Since every lazy module gets its own child injector, any service listed in SharedModule's providers array gets instantiated separately for each lazy module that imports it, silently breaking the assumption that the service is a single shared instance across the app — symptoms show up as state that mysteriously doesn't sync between features that both 'use the same service.'",
    "Trace what happens to a provider the moment more than one lazy module imports the module that declares it."),

  // ── standalone-components ────────────────────────────────────────────────
  trivia('standalone-commonmodule-for-structural-directives', 'standalone-components',
    "In a standalone component, what replaces the role an NgModule used to play in making structural directives like NgIf and NgFor available to its template?",
    "The standalone component lists CommonModule (or the specific directives like NgIf/NgFor) directly in its own imports array — there's no wrapping NgModule to supply them implicitly anymore, so each standalone component declares exactly what it needs.",
    "Each standalone component now owns its own list of template dependencies.",
    "Listing CommonModule (or the specific directives) in the component's own imports array.",
    "Listing CommonModule (or the individual directives like NgIf/NgFor) directly in the component's own imports array.",
    ["Nothing is needed — standalone components get all directives globally by default", "A global app.config.ts imports array that applies to every component automatically", "The angular.json build configuration enables them project-wide"]),

  trivia('bootstrapapplication-providers-location', 'standalone-components',
    "You bootstrap with bootstrapApplication(AppComponent) instead of platformBrowserDynamic().bootstrapModule(AppModule). Where do app-wide providers like provideHttpClient() now go?",
    "Into the providers array passed as the second argument to bootstrapApplication() — there's no root AppModule left to hold app-wide providers, so the bootstrap call itself takes over that role.",
    "There's no AppModule anymore, so something else has to carry the root providers.",
    "In the providers array of bootstrapApplication()'s second argument.",
    "In the providers array passed as the second argument to bootstrapApplication().",
    ["In the standalone AppComponent's own @Component providers array", "In a separate providers.module.ts that's still imported somewhere", "They're no longer needed — standalone apps auto-configure HttpClient"]),

  trivia('loadcomponent-for-single-route', 'standalone-components',
    "A standalone component needs to be lazy-loaded at a single route with no nested child routes. Which router API loads it directly, without a feature-module wrapper?",
    "loadComponent, used directly in the route definition, points straight at a standalone component and lazy-loads just that component — no feature module needed to wrap it.",
    "The API name describes exactly what it lazy-loads.",
    "loadComponent.",
    "loadComponent, pointing directly at the standalone component in the route config.",
    ["loadChildren, since it's required for any lazy route", "forChild, configured on a routing module", "loadModule, Angular's module-lazy-loading API"]),

  trivia('standalone-importing-ngmodule-interop', 'standalone-components',
    "SharedModule (an NgModule) exports PriceDisplayComponent. You want to use that component inside a new standalone component. What do you do?",
    "Add SharedModule directly to the standalone component's own imports array — standalone components can import entire NgModules, not just other standalone pieces, which is exactly the bridge that makes incremental migration possible.",
    "Standalone components can import more than just other standalone components.",
    "Add SharedModule to the standalone component's own imports array.",
    "Add SharedModule directly to the standalone component's imports array.",
    ["You cannot mix standalone and NgModule-based code in the same app", "Convert PriceDisplayComponent to standalone first — there's no other way to use it", "Re-declare PriceDisplayComponent inside the new standalone component's own file"]),

  trivia('standalone-component-level-provider-scope', 'standalone-components',
    "A standalone component lists a service in its own @Component({ providers: [...] }) array. What's that service instance's lifetime?",
    "A fresh instance is created for every instance of that component, and destroyed along with it — a component-level provider (standalone or not) ties a service's lifetime to that specific component instance, not the whole app.",
    "Think about what happens if the component is used twice on the same page.",
    "A new instance per component instance, destroyed when the component is.",
    "A new instance is created for each instance of the component, destroyed when that component instance is destroyed.",
    ["One app-wide singleton shared across every usage of the component", "One instance per lazy-loaded route, shared by every component on that route", "The same instance as any providedIn: 'root' registration of that class"]),

  trivia('importprovidersfrom-legacy-library-bridge', 'standalone-components',
    "You need a legacy NgModule-only third-party library (only exposing SomeLibModule.forRoot()) inside a fully standalone app with no AppModule. What bridges the gap?",
    "importProvidersFrom(SomeLibModule.forRoot()), passed into bootstrapApplication()'s providers array — it extracts the module's configured providers so they can be used in a standalone bootstrap context with no AppModule involved.",
    "Something needs to pull providers OUT of an NgModule for a bootstrap call that has no module.",
    "importProvidersFrom(SomeLibModule.forRoot()) in the bootstrap providers array.",
    "importProvidersFrom(SomeLibModule.forRoot()) inside bootstrapApplication's providers array.",
    ["There's no bridge — the library must be rewritten as standalone first", "provideModule(SomeLibModule), a dedicated standalone-interop function", "Wrap AppComponent back in a minimal NgModule just for this one library"]),

  trivia('standalone-imports-array-grouping-convention', 'standalone-components',
    "A large standalone component ends up importing 15 other standalone components, directives, and pipes directly in its own imports array. What's the Angular-recommended way to keep this manageable without reverting to NgModules?",
    "Group related standalone pieces into a plain exported array (e.g. export const SHARED_IMPORTS = [...]) and spread that array into the consuming component's imports array — a lightweight convention for bundling frequently-used-together standalone dependencies, distinct from bringing back NgModules.",
    "You can still group things for reuse — just not inside an @NgModule anymore.",
    "Export a plain array of the common standalone pieces and spread it into imports.",
    "Group them into an exported const array (e.g. SHARED_IMPORTS) and spread it into the component's imports array.",
    ["There's no way around this — large standalone components always need huge imports arrays", "Convert the whole feature back to an NgModule, since this problem is unique to standalone", "Angular caps imports arrays at 10 entries, so this configuration would fail to compile"]),

  trivia('angular-17-standalone-default', 'standalone-components',
    "Since Angular 17, what is the default value of a new component's standalone flag when generated by the Angular CLI?",
    "true — standalone became the CLI default starting with Angular 17, meaning NgModule-based components now require explicitly opting out rather than standalone requiring an explicit opt-in.",
    "The direction of the default flipped in Angular 17.",
    "true, by default — NgModule-based components now need to opt out explicitly.",
    "true — new components are standalone by default; NgModule-based ones must opt out explicitly.",
    ["false — standalone still has to be explicitly enabled per component", "It depends only on whether angular.json lists 'standalone': true, never on CLI version", "There is no such flag; standalone and NgModule components are configured identically"]),

  trivia('ng-generate-standalone-schematic-purpose', 'standalone-components',
    "Running `ng generate @angular/core:standalone` on an existing NgModule-based project primarily automates what?",
    "Converting existing components/directives/pipes to standalone and removing the NgModule declarations/boilerplate that's no longer needed, across whatever scope of the codebase you target — a migration schematic, not a brand-new-project-only tool.",
    "It's a migration tool, not a scaffolding tool for new projects.",
    "Converting existing declarables to standalone and removing now-unnecessary NgModule boilerplate.",
    "Converting existing components/directives/pipes to standalone and stripping the NgModule boilerplate they no longer need.",
    ["Rewriting RxJS-based state management to Signals", "Scaffolding a brand-new standalone project from scratch", "Only works on projects that have zero existing NgModules"]),

  general('component-provider-vs-providedinroot-instance-count', 'standalone-components',
    "Explain the dependency-injection difference between listing a service in a standalone component's @Component({ providers }) versus using providedIn: 'root' on the service's own @Injectable() decorator — specifically regarding how many instances of that service can exist when the component is used in multiple places.",
    "providedIn: 'root' creates exactly one app-wide singleton no matter how many times the component using it appears on screen. A component-level providers entry creates a brand-new instance for every instance of that component — so if the component is rendered five times, there are five completely separate instances of that service, each with its own independent state.",
    "Count instances as a function of how many times the component itself is rendered."),

  general('standalone-ngmodule-incremental-migration', 'standalone-components',
    "A team is migrating gradually from NgModules to standalone components. Explain why this migration can be incremental — a mix of standalone and NgModule-based code coexisting — rather than requiring an all-or-nothing rewrite.",
    "Standalone components can import whole NgModules directly in their own imports array, and standalone pieces can in turn be declared/imported inside NgModule-based code too — Angular's compiler and DI system support both models interoperating in the same app. That two-way bridge is what lets teams convert file by file, feature by feature, instead of needing a single coordinated rewrite of the entire codebase.",
    "The bridge works in both directions, not just one."),

  general('why-standalone-became-the-default', 'standalone-components',
    "What's the main reason the Angular team moved toward standalone as the default, in terms of the problems NgModules created for smaller apps and for lazy-loading individual pieces of UI?",
    "NgModules added a layer of indirection and boilerplate that even small apps and single reusable components had to pay for — every component had to belong to exactly one module just to be usable anywhere, and lazy-loading even one component required wrapping it in its own feature module first. Standalone components let any piece declare its own dependencies directly and be lazy-loaded individually via loadComponent, removing that forced indirection and simplifying the mental model, especially for apps that don't need the module system's full organizational weight.",
    "Think about what a single reusable component had to carry just to exist, before standalone."),

  // ── lazy-loading ──────────────────────────────────────────────────────────
  trivia('custom-preloading-strategy-selective', 'lazy-loading',
    "Your app lazy-loads a rarely-visited /admin route and a frequently-visited /reports route. PreloadAllModules preloads both in the background after initial load, including the admin bundle almost nobody needs. What's a better approach?",
    "A custom PreloadingStrategy that reads route data (e.g. data: { preload: true }) and only preloads routes explicitly flagged that way, so you can preload /reports in the background while skipping /admin entirely until someone actually navigates there.",
    "You don't have to choose between all-or-nothing preloading strategies.",
    "A custom strategy that only preloads routes explicitly flagged via route data.",
    "A custom PreloadingStrategy that only preloads routes flagged via route data (e.g. data: { preload: true }).",
    ["Switch to NoPreloading and accept slower first navigation to every lazy route", "There's no way to control this — PreloadAllModules is strictly all-or-nothing", "Make /admin an eager route instead, defeating the purpose of lazy-loading it"]),

  trivia('lazy-module-provider-invisible-outside', 'lazy-loading',
    "A lazy-loaded feature module provides a service in its own providers array. A component OUTSIDE that lazy module (in the eagerly-loaded part of the app) tries to inject that same service class. What happens?",
    "Injection fails with a NullInjectorError, unless that service is also provided somewhere in an ancestor injector the eager component can actually see. A lazy module's own providers are only visible within that module's own injector subtree, not to the rest of the app.",
    "Think about which injectors are actually ancestors of the eager component.",
    "It fails with a NullInjectorError, since the lazy module's injector isn't an ancestor of the eager component.",
    "Injection fails (NullInjectorError) unless the service is also provided in an injector the eager component can see.",
    ["It works fine — services provided anywhere are automatically app-wide", "The lazy module's bundle loads early just to satisfy the dependency", "Angular silently creates a temporary stub instance for the eager component"]),

  trivia('guard-runs-before-lazy-bundle-fetch', 'lazy-loading',
    "A canActivate guard on a lazy-loaded route checks auth before the route activates. Does the guard run before or after the lazy module's JS bundle is actually fetched?",
    "Before — Angular evaluates route guards first and only fetches/loads the lazy bundle if the guard allows the navigation to proceed, so an unauthorized user never even downloads code they're not permitted to use.",
    "An unauthorized user shouldn't need to download anything at all.",
    "Before — the bundle is only fetched once the guard allows the navigation.",
    "Before the fetch — guards run first, and the lazy bundle only downloads if the guard allows navigation to proceed.",
    ["After — the bundle always downloads first, then the guard decides whether to render it", "Simultaneously, with no defined ordering between the two", "Guards don't apply to lazy-loaded routes at all"]),

  trivia('duplicate-library-across-lazy-chunks', 'lazy-loading',
    "Two separate lazy-loaded feature modules both import the same large third-party chart library. What's the likely effect on the app's bundle output, and the standard fix?",
    "By default the bundler may duplicate that library's code into both lazy chunks, each route paying its own copy's download cost independently. The standard fix is ensuring it's imported from one common place so the bundler's common-chunk optimization can split it into a single shared chunk instead of duplicating it across both.",
    "The same dependency ending up in two chunks usually means it's being bundled twice, not once.",
    "It risks being duplicated into both chunks; a shared common-chunk setup avoids that.",
    "It may get duplicated into both lazy chunks; the fix is a shared-chunk setup so it's bundled once instead of twice.",
    ["Nothing — bundlers always deduplicate shared dependencies across lazy chunks automatically", "The build fails outright when two lazy chunks share a dependency", "Only the first-loaded chunk gets the library; the second one breaks at runtime"]),

  trivia('loadcomponent-vs-loadchildren-single-page', 'lazy-loading',
    "For a single settings page with no nested child routes, comparing loadChildren (pointing at a routing module) and loadComponent (pointing at a standalone component) — which is more appropriate, and why?",
    "loadComponent — wrapping a single page with no nested routing in an entire feature module adds boilerplate for no real benefit. loadChildren earns its keep when there's genuine nested routing to organize underneath that route.",
    "Ask whether there's any nested routing to actually justify a feature-module wrapper.",
    "loadComponent — a feature module wrapper adds boilerplate a single page with no nested routes doesn't need.",
    "loadComponent, since there's no nested routing to justify wrapping the page in a whole feature module.",
    ["loadChildren, because it's required for any lazy-loaded route regardless of nesting", "Neither — single pages should always be eagerly loaded", "They're functionally identical in every situation, so it doesn't matter"]),

  trivia('browseranimationsmodule-duplicate-in-lazy-module', 'lazy-loading',
    "A lazy-loaded module imports BrowserAnimationsModule directly instead of relying on root-level animation providers. What architectural problem does this risk?",
    "BrowserAnimationsModule configures app-wide animation providers meant to exist exactly once at the root. Re-importing it inside a lazy module can register duplicate/conflicting providers in that module's own child injector — wasted bundle size at best, inconsistent animation behavior at worst.",
    "This module configures providers meant to exist exactly ONCE, app-wide.",
    "Duplicate/conflicting animation providers registered in that lazy module's own injector.",
    "It risks duplicate or conflicting animation providers being registered a second time in that lazy module's own injector.",
    ["No risk — animation providers are idempotent no matter how many times they're imported", "It makes animations run faster inside that specific lazy module", "Angular automatically removes the duplicate import at build time"]),

  trivia('verify-lazy-chunk-with-bundle-analysis', 'lazy-loading',
    "After adding several lazy-loaded feature modules, how would you verify the initial/main bundle actually shrank, rather than assuming loadChildren syntax alone guarantees it?",
    "Run a production build and inspect the generated chunk files (or use a bundle analyzer) to confirm the feature module's code landed in its own separate lazy chunk file, not bundled into main.js — syntax alone doesn't prove the bundler actually split it the way you expect.",
    "Trust the build output, not just the route-config syntax.",
    "Inspect the production build's actual chunk files (or use a bundle analyzer).",
    "Run a production build and inspect the generated chunk files / use a bundle analyzer to confirm the split actually happened.",
    ["Check the raw file size of the feature module's .ts source files", "Trust that loadChildren syntax guarantees correct chunking on its own", "Time page load in `ng serve` dev mode, which mirrors production bundling"]),

  trivia('nested-lazy-loading-support', 'lazy-loading',
    "Can a lazy-loaded module itself contain further nested lazy-loaded child routes — lazy-loading inside lazy-loading?",
    "Yes — a lazy-loaded module's own routing configuration can declare further loadChildren/loadComponent entries, splitting the bundle into as many layers as the route structure actually needs.",
    "Nothing about being lazy-loaded prevents a module from having its own lazy children.",
    "Yes, a lazy module's own routes can declare further nested lazy-loaded children.",
    "Yes — a lazy module's own routing config can declare further loadChildren/loadComponent entries beneath it.",
    ["No, Angular only supports one level of lazy loading per app", "Yes, but only for standalone components, never for further feature modules", "This requires a special nestedLazyLoading flag in angular.json"]),

  trivia('router-default-preloading-strategy', 'lazy-loading',
    "What is Angular Router's default PreloadingStrategy if you don't specify one in provideRouter/RouterModule.forRoot?",
    "NoPreloading — by default, lazy routes are only fetched when the user actually navigates to them; nothing is preloaded in the background unless you explicitly configure PreloadAllModules or a custom strategy.",
    "'Default' here means nothing extra happens until the user actually navigates.",
    "NoPreloading — nothing preloads until the user actually navigates there.",
    "NoPreloading — lazy routes are only fetched on actual navigation unless you opt into a preloading strategy.",
    ["PreloadAllModules — every lazy route preloads in the background by default", "QuicklinkStrategy — Angular preloads links visible in the viewport by default", "Angular automatically adjusts preloading based on detected network speed"]),

  general('over-aggressive-lazy-splitting-tradeoff', 'lazy-loading',
    "Your team debates lazy-loading every single feature route 'just in case' versus only lazy-loading large, infrequently-visited sections. Explain the trade-off: what does over-aggressive lazy-loading cost even though each individual bundle gets smaller?",
    "Every lazy chunk is its own network request, each with its own HTTP overhead; splitting too finely trades one moderately-sized request for several small round trips, and navigating between many tiny lazy routes can introduce a visible loading flash on each in-app transition. The actual goal is reducing the INITIAL bundle for first paint, not minimizing every individual route's file size — over-splitting optimizes the wrong thing and can make in-app navigation feel worse.",
    "The goal is a smaller first load, not the smallest possible file for every single route."),

  general('providedinroot-vs-lazy-module-providers-explained', 'lazy-loading',
    "Explain why a service registered with providedIn: 'root' behaves as a true app-wide singleton even when only ever injected from inside a lazy-loaded module, while a service listed in that lazy module's own providers array does not.",
    "providedIn: 'root' always registers with the application's single root injector regardless of which module first requests it — lazy loading doesn't change that targeting. A service explicitly listed in a module's own providers array, by contrast, registers on THAT module's injector, and every lazy-loaded module gets its own separate child injector — so the same service class ends up instantiated independently, once per lazy module that lists it that way.",
    "One targets a fixed injector regardless of context; the other targets whichever injector owns that providers array."),

  general('lazy-chunk-still-loading-early-diagnosis', 'lazy-loading',
    "A developer lazy-loads a feature module, but the Network tab shows its JS file downloading as part of the initial page load, not on-demand. List two common mistakes that would cause this.",
    "(1) The feature module (or a component from it) is also reachable eagerly from AppModule — e.g. an eagerly-loaded module imports or re-exports it somewhere, forcing the bundler to include it in the main chunk regardless of the lazy route config. (2) A PreloadAllModules strategy is configured, so although it genuinely is a separate lazy chunk, it's being preloaded immediately after the initial app load rather than strictly on navigation, which can look identical to 'loading too early' in the Network tab even though the chunk itself is correctly split.",
    "One cause means it's not really a separate chunk; the other means it IS a separate chunk, just fetched sooner than expected."),

  // ── advanced-routing ──────────────────────────────────────────────────────
  trivia('composing-multiple-canactivate-guards', 'advanced-routing',
    "A route needs to check both that a user is authenticated AND that they have a specific role, using two separate, reusable guard functions. How do you compose multiple guards on one route?",
    "List both guard functions in the route's canActivate array. Angular runs each guard in order and only activates the route if every one of them resolves to true (or stops to redirect if any returns a UrlTree).",
    "canActivate already accepts more than one function.",
    "List both guard functions together in the route's canActivate array.",
    "List both guard functions in the route's canActivate array — Angular runs them all and requires every one to pass.",
    ["Guards must be merged into a single combined function manually; arrays aren't supported", "canActivate only accepts one guard per route; use canActivateChild for the second one", "Create two separate route entries for the same path, one per guard"]),

  trivia('resolver-error-redirect-via-urltree', 'advanced-routing',
    "A route resolver fetches a user's profile before activation, and the fetch fails with a 404. What's the architecturally correct way to handle this so the user doesn't see a blank/broken page?",
    "Catch the error inside the resolver and return a UrlTree (e.g. via inject(Router).createUrlTree([...])) to redirect to an error or not-found page — letting the error propagate unhandled can leave the router navigation in an undefined state instead of completing cleanly somewhere.",
    "A resolver can hand the router a redirect instead of just data.",
    "Catch it and return a UrlTree redirecting to an error/not-found page.",
    "Catch the error in the resolver and return a UrlTree redirecting to an error or not-found page.",
    ["Resolvers can't fail — a 404 here is impossible by design", "Let the error bubble to a global ErrorHandler and leave the navigation outcome undefined", "Resolvers should never contain try/catch logic of any kind"]),

  trivia('tabbed-settings-child-routes-pattern', 'advanced-routing',
    "A settings page has three tabs (Profile, Billing, Security), each needing its own deep-linkable URL while sharing the same page shell/layout. What's the standard Angular routing pattern for this?",
    "A parent route renders the settings shell component, and child routes (one per tab) render into a router-outlet inside that shell — giving each tab its own URL segment while reusing the same parent layout.",
    "One component owns the shared layout; each tab becomes a child route inside it.",
    "A parent route for the shell, with each tab as a child route rendering into its router-outlet.",
    "A parent route for the shell component, with child routes (one per tab) rendered into a router-outlet inside it.",
    ["Three fully separate top-level routes, each duplicating the shared layout markup", "A single route with a query parameter toggling an *ngIf between three always-mounted components", "Named router outlets, since they're required for any tabbed interface"]),

  trivia('default-route-reuse-same-route-different-param', 'advanced-routing',
    "Navigating from /products/1 to /products/2 (the exact same route config, just a different :id param) — by Angular's default RouteReuseStrategy, is the component instance destroyed and recreated, or reused?",
    "Reused — Angular's default reuse strategy keeps the same component instance alive across a param-only change on the same matched route. That's precisely why reading route.snapshot.params once in ngOnInit is a common bug: ngOnInit won't fire again, so the component must subscribe to route.paramMap to react to the new id.",
    "A common bug comes from assuming ngOnInit fires again on every param change — does it?",
    "Reused — the same component instance stays alive; only its params actually change.",
    "Reused — Angular keeps the same component instance alive for a param-only change on the same matched route.",
    ["Destroyed and recreated every time, so reading params in ngOnInit is always safe", "It depends only on whether the component is marked standalone", "Angular throws an error navigating between two param values of the same route"]),

  trivia('guard-redirect-via-urltree-not-separate-navigate', 'advanced-routing',
    "A functional canActivate guard needs to redirect an unauthenticated user to /login instead of just silently blocking the navigation. What should it return to achieve that redirect?",
    "A UrlTree, created via inject(Router).createUrlTree(['/login']) (or parseUrl) — returning a UrlTree tells the router to navigate there as part of resolving the current navigation, rather than leaving the guard to trigger a second, separate navigation manually.",
    "A guard can hand back more than just true/false.",
    "A UrlTree pointing at the login route, returned directly from the guard.",
    "A UrlTree (e.g. via createUrlTree(['/login'])) returned directly from the guard function.",
    ["Return false, then separately call router.navigate() as an extra step inside the guard", "Throw an Error whose message is the redirect path", "Guards can only block navigation; they're incapable of triggering a redirect"]),

  trivia('canactivatechild-reruns-every-child-nav', 'advanced-routing',
    "A canActivateChild guard is applied to a parent route. Does it run once for the first child route activated, or for every child route navigated to under that parent?",
    "For every child route activated under that parent — canActivateChild re-evaluates on each navigation into any of that parent's children, rather than being a one-time setup check that only fires the first time.",
    "'Child' here means it reruns per CHILD navigation, not once for the whole parent.",
    "For every child route navigated to under that parent.",
    "For every child route activated under that parent — it re-runs on each such navigation.",
    ["Only once, the first time any child route under that parent is activated", "Only when navigating directly to the parent route itself, never its children", "Only if the child route also separately declares its own canActivateChild"]),

  trivia('route-data-vs-resolve-architectural-difference', 'advanced-routing',
    "What's the architectural difference between a route's static data property and fetching a value via a resolve guard?",
    "data is a static, build-time-known value available immediately with no async work involved (e.g. a page title or a required role); resolve runs an async function — often an HTTP call — and the router waits for it to complete before activating the route, injecting the resolved result into the activated route's data.",
    "One is known upfront with zero async work; the other explicitly waits on something.",
    "data is static and synchronous; resolve is async and the router waits for it before activating.",
    "data holds a static, synchronous value; resolve runs an async function the router waits on before activating the route.",
    ["They're interchangeable — both always run asynchronously before activation", "data can only hold strings, while resolve can return any type", "resolve runs after the route activates, not before"]),

  trivia('matrix-params-vs-query-params-scope', 'advanced-routing',
    "Angular supports matrix URL parameters like /products;category=shoes;size=10, distinct from query parameters like /products?category=shoes. What's the key difference in scope between the two?",
    "Matrix parameters are scoped to a specific route segment and can carry different values per segment within a complex URL, while query parameters are global to the entire URL regardless of which route segment they conceptually belong to.",
    "One is attached to a specific URL segment; the other applies to the whole URL.",
    "Matrix params are scoped per-segment; query params apply globally to the whole URL.",
    "Matrix parameters are scoped to a single route segment; query parameters apply globally across the whole URL.",
    ["They're functionally identical, just different syntax for the same thing", "Matrix params are for GET requests and query params are for POST requests", "Query params can only be set programmatically, never typed directly into a URL"]),

  trivia('declarative-route-title-strategy', 'advanced-routing',
    "You want each route to set the browser tab's document title declaratively, without manually calling Title.setTitle() in every component's ngOnInit. What's the modern Angular Router feature for this?",
    "A static or resolved title property directly on the route configuration (e.g. { path: 'products', title: 'Products' }, or title: ProductTitleResolver for a dynamic one), handled automatically by Angular's built-in TitleStrategy.",
    "The route config itself can own the document title now.",
    "A title property on the route config, handled by Angular's built-in TitleStrategy.",
    "A static or resolved title property on the route configuration, handled by Angular's TitleStrategy.",
    ["Manually calling Title.setTitle() remains the only supported approach", "A global app.config.ts titles map keyed by URL, checked manually on each navigation", "The <title> tag must be set directly in each component's own template"]),

  general('separate-auth-and-role-guards-reasoning', 'advanced-routing',
    "Explain why composing authentication and authorization into two separate guard functions (e.g. authGuard and roleGuard) is usually better architecture than one combined canAccessAdminGuard that checks both concerns at once.",
    "Separate guards are independently reusable and testable: authGuard protects any route needing login regardless of role, and roleGuard can be parameterized and reused across different role checks on different routes. A single combined guard duplicates logic across every route that needs some-but-not-all of those checks, and testing it means covering every concern combination inside one function instead of testing two small, focused ones in isolation.",
    "Think about every OTHER route that needs only one of the two checks, not both."),

  general('resolver-caching-to-avoid-repeat-fetch', 'advanced-routing',
    "A resolver fetches data that rarely changes (e.g. a list of countries) before every navigation to a form page, adding a network round-trip to every visit. Describe an architectural improvement that avoids the unnecessary repeat fetch without removing the resolver pattern entirely.",
    "Cache the result inside the service the resolver calls — e.g. a shareReplay(1) on the underlying Observable, or a simple in-memory cache given the data rarely changes — so the resolver still guarantees the data is present before activation, but subsequent navigations resolve instantly from the cached value instead of re-fetching over the network every single time.",
    "Keep the resolver's guarantee; change what the SERVICE underneath it does on repeat calls."),

  general('deep-nested-routes-risk', 'advanced-routing',
    "Your app has deep, multi-level nested routes (e.g. /org/:orgId/team/:teamId/member/:memberId). Explain one architectural risk of over-nesting routes this way, and how child guards/resolvers interact with that depth.",
    "Each level typically needs its own guard/resolver to validate that segment's ID and load its data, and those run top-down for every navigation into that branch — deep nesting multiplies the number of guards/resolvers evaluated per navigation, making the loading sequence harder to reason about and debug. It also couples the UI's visual nesting to the URL's nesting, which aren't always the same thing — sometimes a visually-nested page should have a flatter URL, or vice versa — so nesting should mirror genuine parent-child relationships in the DATA, not just convenient layout structure.",
    "Nesting the URL and nesting the guard/resolver work are the same decision — is that always what you want?"),

  // ── component-state-patterns ──────────────────────────────────────────────
  trivia('signal-vs-behaviorsubject-simple-sync-state', 'component-state-patterns',
    "A component holds a simple counter that only needs synchronous reads in the template, with no async composition required. Between signal() and BehaviorSubject, which is architecturally the simpler fit?",
    "signal() — it's built for exactly this synchronous, template-read use case, needs no subscription management (no async pipe, no manual unsubscribe), and change detection reacts to it automatically. BehaviorSubject is better reserved for cases that genuinely need RxJS operator composition like debouncing or combining multiple streams.",
    "One of the two needs subscription management; the other doesn't.",
    "signal() — no subscription management needed for simple synchronous state.",
    "signal() — it needs no subscription management and is purpose-built for simple synchronous template state.",
    ["BehaviorSubject, since it's always the more 'proper' reactive choice", "Neither — a plain class property is the only correct choice for a counter", "They're fully interchangeable with zero practical difference for this case"]),

  trivia('onpush-array-push-mutation-no-rerender', 'component-state-patterns',
    "A presentational OnPush child receives an array via @Input(). The parent pushes a new item into that SAME array reference (.push()) instead of creating a new array. What happens to the child's view?",
    "It doesn't re-render. OnPush only checks for a new reference on @Input() bindings, and mutating the array in place keeps the same reference — Angular has no signal that anything changed, so it skips checking that component.",
    "OnPush compares references, not contents.",
    "It doesn't re-render, since the array reference never actually changed.",
    "It doesn't re-render — OnPush sees the same array reference and assumes nothing changed.",
    ["It re-renders, since OnPush still deep-compares array contents", "Angular throws a runtime error when inputs are mutated in place", "It depends on whether .push() runs inside or outside the Angular zone"]),

  trivia('colocate-local-ui-state-not-shared-service', 'component-state-patterns',
    "A piece of UI state (e.g. 'is this dropdown open') is only ever read and written by one component and never needs to survive navigation away from it. Where should that state live?",
    "As a local component property or a local signal(), not in a shared service or global store. State that's genuinely private to one component's lifetime doesn't need to be lifted or centralized — doing so anyway adds indirection with no benefit.",
    "Ask who else, if anyone, actually needs this piece of state.",
    "As a local component property or signal — no one else needs to read or write it.",
    "As a local component property (or local signal) — nothing outside that component needs to read or write it.",
    ["Always in a shared service, for consistency with the rest of the app's state", "In a global NgRx store, since all state should flow through the store", "In a route resolver, so it's available before the component even renders"]),

  trivia('unidirectional-flow-input-mutation-violation', 'component-state-patterns',
    "A reusable SearchBoxComponent directly mutates its own @Input() value: string property inside a template event handler, instead of emitting an @Output() for the parent to act on. What does this break, and what's the real risk?",
    "It breaks unidirectional data flow — a child should never mutate its own @Input() directly. The parent's source of truth and the child's local copy can silently drift apart, and Angular can produce an ExpressionChangedAfterItHasBeenCheckedError in dev mode when an input is both read and reassigned within the same check cycle.",
    "An @Input() is meant to flow in ONE direction only.",
    "It breaks unidirectional data flow — the input should never be mutated by the component that receives it.",
    "It breaks unidirectional data flow by mutating an @Input() the component only received, rather than emitting an @Output().",
    ["Nothing breaks — @Input() properties are freely mutable by the receiving component", "It only matters for OnPush components, not default change detection", "It's fine as long as the parent also happens to be using the same variable name"]),

  trivia('template-method-call-recomputes-every-check', 'component-state-patterns',
    "A component calls a method directly from a template expression (e.g. {{ getFilteredItems() }}) to derive a filtered list. Does that method run once per actual data change, or on every change-detection check regardless?",
    "It re-runs on every single change-detection check, even if the underlying data hasn't changed at all — calling a method directly from a template is a common performance trap. A memoized computed() signal, or a pure pipe, avoids the repeated recomputation.",
    "Template method calls aren't automatically memoized by anything.",
    "On every change-detection check, regardless of whether the data actually changed.",
    "On every change-detection check — template method calls aren't memoized, so it reruns whether or not anything changed.",
    ["Only once per actual data change, since Angular memoizes template method calls automatically", "Only once, ever, on the component's first render", "Only when the method's return type is explicitly typed as an array"]),

  trivia('lightweight-signal-service-vs-full-ngrx', 'component-state-patterns',
    "A mid-sized feature has 3-4 related pieces of state shared across 5 sibling components, with a few simple derived values. What's a reasonable, lighter-weight alternative to adopting full NgRx for just this one feature?",
    "A feature-scoped service holding one or more signal()s (or a single state-object signal) with computed() values derived from it, provided at the feature's routed component level — giving shared, reactive state without the full action/reducer/effect ceremony a global store requires.",
    "Something between 'no shared state' and 'a full global store' usually exists.",
    "A feature-scoped service built on signals and computed(), without a full store.",
    "A feature-scoped service holding signal()s with computed() derived values, provided at the feature's component level.",
    ["There is no lighter alternative — shared state across 3+ components always requires NgRx", "Pass the state through @Input()/@Output() chains across all five siblings", "Store all of it in the URL as query parameters"]),

  trivia('manual-subscribe-requires-unsubscribe-async-pipe-doesnt', 'component-state-patterns',
    "A smart component subscribes to a service's Observable state inside ngOnInit using .subscribe() directly, instead of the async pipe. What must it also do to avoid a memory leak, and why doesn't the async pipe have this problem?",
    "It must manually unsubscribe — e.g. in ngOnDestroy, or via takeUntilDestroyed() — since a manual .subscribe() keeps the subscription alive until explicitly torn down. The async pipe automatically unsubscribes when the component is destroyed, which is exactly why it's generally preferred for template-bound Observable state.",
    "One of the two cleans up after itself automatically on component destroy.",
    "It must manually unsubscribe; the async pipe does this automatically on destroy.",
    "It must manually unsubscribe (e.g. in ngOnDestroy or via takeUntilDestroyed) — the async pipe handles this automatically.",
    ["Nothing extra — Angular always unsubscribes every Observable subscription automatically", "It must call .complete() on the Observable itself after reading the value once", "Only subscriptions created inside constructors need manual cleanup, not ngOnInit"]),

  trivia('nested-mutation-breaks-onpush-trackby-combo', 'component-state-patterns',
    "A state service does state.items[0].done = true directly on the existing state object, then notifies subscribers. A child using OnPush and *ngFor with trackBy doesn't visually update the checked item. What's the root cause?",
    "Mutating the nested object in place keeps every reference identical — the array reference and even the item object reference. OnPush's reference check sees 'nothing changed' at the top level, so the view never re-renders; the fix is creating new array/object references for anything that changed, e.g. via spread syntax, instead of mutating in place.",
    "OnPush and trackBy both rely on references staying stable ONLY when nothing really changed.",
    "The in-place mutation keeps every reference identical, so OnPush sees no change at all.",
    "The nested mutation keeps the array and item references identical, so OnPush's reference check never detects a change.",
    ["trackBy is misconfigured and needs a different key field", "OnPush doesn't support *ngFor at all, regardless of mutation style", "The issue is unrelated to mutation — it's a template binding typo"]),

  trivia('signal-observable-interop-functions', 'component-state-patterns',
    "A component needs to combine a Signal-based piece of state with an existing RxJS Observable from an HTTP call. Which Angular-provided functions bridge Signals and Observables for this kind of interop?",
    "toObservable() converts a signal into an Observable, and toSignal() converts an Observable into a signal — both from @angular/core/rxjs-interop, built specifically to bridge the two reactivity models in either direction.",
    "Two functions exist, one for each direction of conversion.",
    "toObservable() and toSignal(), from @angular/core/rxjs-interop.",
    "toObservable() (signal to Observable) and toSignal() (Observable to signal), both from @angular/core/rxjs-interop.",
    ["signalToObservable() and observableToSignal(), both built into @angular/core directly", "There's no official bridge — manual subscription code is required either way", "Only one direction is supported: converting Observables into signals, never the reverse"]),

  general('smart-dumb-split-testing-and-onpush-fit', 'component-state-patterns',
    "Explain the architectural reasoning behind the smart/dumb (container/presentational) component split beyond 'it's a best practice' — specifically, how does it affect what each type of component needs to be tested, and how does OnPush fit naturally with the dumb half?",
    "Dumb/presentational components depend only on their @Input()s and emit via @Output()s, so they're trivial to unit test: pass inputs, assert rendered output or emitted events, no service mocking required. Smart/container components hold the state and logic, so their tests focus on that logic and the component-to-service wiring rather than rendering details. Because presentational components only change when their inputs change by reference, OnPush is a natural fit — it lets Angular skip checking that whole subtree unless an input reference actually changed, which is exactly the contract a pure presentational component already honors.",
    "Think about what each half of the split actually depends on, and how that maps to test setup."),

  general('mixed-state-styles-when-reasonable', 'component-state-patterns',
    "A codebase mixes three state-management styles across different features: plain component properties, services with BehaviorSubjects, and signals. Is this necessarily bad architecture, and what should decide which approach a given feature uses?",
    "Mixing styles isn't automatically bad — the right choice depends on the state's actual shape and lifetime: purely local, synchronous UI state fits plain properties or signals; state shared across a few components with simple derived values fits a feature service built on signals; genuinely complex async composition (debouncing, combining multiple streams, retry logic) still benefits from RxJS. The real risk isn't variety itself — it's inconsistency for EQUIVALENT problems, e.g. three features all needing 'shared state across siblings with simple derivation' solving it three different ways, which raises onboarding cost without a real benefit.",
    "The problem isn't variety — it's solving the SAME kind of problem differently each time."),

  general('in-place-mutation-breaks-undo-and-equality', 'component-state-patterns',
    "Why is directly mutating a nested property inside a state object (e.g. this.state.user.name = 'X') considered an architectural problem in Angular even outside of OnPush/change-detection concerns — specifically for features like undo/redo or simple equality checks?",
    "In-place mutation destroys the ability to compare 'before' and 'after' by reference. Undo/redo and time-travel debugging typically work by keeping a history of past state snapshots, which only works if each state transition produces a genuinely new object rather than overwriting the one still referenced by history. Similarly, cheap === equality checks — used by OnPush, memoized selectors, and computed signals — become meaningless once earlier references get silently mutated after the fact, since two variables that 'look different' in your code can end up holding identical mutated objects.",
    "Think about what a 'history' of past states actually requires to stay meaningful."),

  // ── advanced-change-detection ─────────────────────────────────────────────
  trivia('outside-zone-update-not-reflected-in-template', 'advanced-change-detection',
    "A third-party library schedules a setTimeout callback inside NgZone.runOutsideAngular(). The callback updates a component property bound in the template. What's the result?",
    "The template does NOT update, even though the property genuinely changed, because the callback ran outside Angular's zone and never triggered change detection for that change. The fix is re-entering the zone around the update (e.g. ngZone.run(() => { ... })) or triggering detection manually.",
    "Something that happens OUTSIDE the zone doesn't automatically trigger a check.",
    "The template doesn't update — the change happened outside the zone Angular watches.",
    "The template doesn't update, because the change happened outside the zone Angular monitors for triggering checks.",
    ["The template updates immediately, since zone.js patches setTimeout regardless of runOutsideAngular", "Angular throws a runtime error the next time change detection runs", "It only fails to update in production builds, not during development"]),

  trivia('onpush-trigger-combination-dom-event-and-async-pipe', 'advanced-change-detection',
    "A component uses OnPush. Which of these also triggers its change detection, besides a new @Input() reference: (a) a DOM event from within its own template, (b) an async pipe emitting a new value, (c) a parent's change detection running with no new input?",
    "Both (a) and (b) trigger it — a DOM event dispatched from inside the component's own template runs change detection for that component and its ancestors, and the async pipe internally marks the component for check whenever its Observable/Promise emits. (c) alone does not, unless that parent check happens to also produce a new @Input() reference or trips one of the other triggers.",
    "Two of the three genuinely trigger it on their own; one doesn't, by itself.",
    "Both (a) and (b) — a template DOM event, and an async pipe emission.",
    "Both (a) a template DOM event and (b) an async pipe emission trigger it; (c) alone does not.",
    ["Only (a) — async pipes never interact with OnPush components", "Only (c) — a parent's own check is the only thing that matters under OnPush", "None of the three — only a new @Input() reference ever triggers OnPush"]),

  trivia('markforcheck-vs-detectchanges-difference', 'advanced-change-detection',
    "Inside an OnPush component, a WebSocket handler running outside the Angular zone changes a value. You call this.cdr.markForCheck(). What does markForCheck() actually do, versus detectChanges()?",
    "markForCheck() flags this component and its ancestors as dirty so they're included in the NEXT change-detection run — it doesn't run detection itself. detectChanges() synchronously runs change detection on this component (and its children) immediately, right now, regardless of the zone's own scheduling.",
    "One schedules a future check; the other runs a check immediately, synchronously.",
    "markForCheck() schedules the next run to include it; detectChanges() runs immediately.",
    "markForCheck() flags it for the next scheduled check; detectChanges() runs change detection on it synchronously, right away.",
    ["They're functionally identical — just two names for the same operation", "markForCheck() runs immediately; detectChanges() only schedules a future run", "Both require NgZone.run() to be called first, or neither has any effect"]),

  trivia('zoneless-change-detection-trigger-source', 'advanced-change-detection',
    "Angular's zoneless change detection mode removes the dependency on zone.js. What primarily triggers change detection instead of 'zone.js noticed an async task completed'?",
    "Explicit reactivity signals — primarily Angular Signals, where a signal's value changing marks dependent views dirty, plus other explicit notification points like markForCheck(). Change detection becomes driven by what actually changed being tracked directly, rather than by patching every async API and re-checking the whole tree afterward.",
    "Without zone.js patching async APIs, something explicit has to replace that signal.",
    "Explicit reactivity — primarily Signals — tracked directly rather than inferred from async APIs.",
    "Explicit reactivity (primarily Signals) that directly marks dependent views dirty when a tracked value changes.",
    ["Nothing replaces it — zoneless apps require manual detectChanges() calls after every state change", "A new global timer that polls every component on a fixed interval", "The browser's native MutationObserver API, used directly by Angular"]),

  trivia('default-strategy-checks-entire-tree', 'advanced-change-detection',
    "A component with the DEFAULT (non-OnPush) strategy sits deep in a component tree. A sibling elsewhere in the app triggers change detection via an event. Does Angular check this unrelated default-strategy component too?",
    "Yes — with the default strategy, Angular's change detection runs top-down through the entire component tree on every trigger, checking every default-strategy component regardless of whether its own inputs changed. This full-tree cost is exactly what OnPush is designed to let you opt specific subtrees out of.",
    "'Default' doesn't mean 'only checks what's relevant' — it means 'checks everything.'",
    "Yes — the default strategy checks the whole tree on every trigger, related or not.",
    "Yes — default-strategy components get checked on every trigger regardless of relevance, which is the cost OnPush opts out of.",
    ["No — Angular only checks components in the same branch as the triggering event", "No — default strategy components are only checked once, on initial render", "It depends on whether the sibling and this component share a common service"]),

  trivia('onpush-same-array-reference-skips-child', 'advanced-change-detection',
    "A component's template does *ngFor over an @Input() items array under OnPush. A parent re-renders and passes back the EXACT same array reference (nothing in it changed). Does the child's *ngFor re-render its items?",
    "No — OnPush compares the new @Input() by reference against the previous one. Since it's the identical reference, Angular considers that input unchanged and skips checking that component entirely, regardless of what the array might actually contain.",
    "Reference equality is the only thing OnPush actually checks on an @Input().",
    "No — the reference is identical, so OnPush treats the input as unchanged.",
    "No — since the array reference is unchanged, OnPush skips checking that component, regardless of the array's contents.",
    ["Yes — OnPush still deep-compares array contents even when the reference is the same", "Yes, but only the first item in the array gets re-checked", "It depends on whether trackBy is configured on the *ngFor"]),

  trivia('expressionchangedafterithasbeenchecked-cause', 'advanced-change-detection',
    "In development mode, a component's ngAfterViewInit sets a property bound in the template, and Angular throws ExpressionChangedAfterItHasBeenCheckedError. What's the architectural cause of this specific error?",
    "Angular's dev-mode double-check verifies a value read during change detection doesn't change again later in the SAME cycle. ngAfterViewInit runs after the view has already been checked once, so changing a bound property there produces a value differing from what was just rendered — Angular flags that as a likely bug rather than silently allowing a value to change after the view already 'settled.'",
    "The error is a dev-only safety check comparing a value against what was JUST rendered.",
    "A bound value changed again after the view had already been checked once this cycle.",
    "A value bound in the template changed again after the view already finished being checked in the same cycle.",
    ["The property was declared with the wrong TypeScript type", "ngAfterViewInit is not allowed to read any component properties at all", "The error only ever occurs in production builds, never in development"]),

  trivia('signal-read-in-template-triggers-onpush-automatically', 'advanced-change-detection',
    "A component uses OnPush and reads a signal() directly in its template (not via @Input()). When that signal changes elsewhere (e.g. a shared service), does the OnPush component still update?",
    "Yes — reading a signal directly in a template automatically makes Angular track it as a dependency of that view, and when the signal changes, Angular marks the component for check under OnPush too, without needing a new @Input() reference or a manual markForCheck() call.",
    "Signals read in a template are tracked automatically, independent of @Input() bindings.",
    "Yes — the template's direct signal read is automatically tracked, triggering a check under OnPush.",
    "Yes — a template's direct signal read is automatically tracked as a dependency, triggering OnPush's check when it changes.",
    ["No — OnPush components can only react to @Input() reference changes, never signals read directly", "Only if the signal is also explicitly passed in as an @Input()", "Only after calling markForCheck() manually inside an effect()"]),

  trivia('trackby-avoids-full-dom-recreation-on-new-reference', 'advanced-change-detection',
    "A large *ngFor list without trackBy re-renders ALL of its DOM nodes whenever the array reference changes, even if only one item's data actually changed. Why does trackBy fix this at the DOM-diffing level?",
    "Without trackBy, Angular identifies list items by position/object identity by default, so a new array reference — even one containing mostly-the-same items — looks like an entirely new list, causing full DOM teardown and recreation. trackBy gives Angular a stable identity per item (e.g. an id), letting it match old and new items across the reference change and only re-render the ones that actually differ.",
    "Without a stable identity, a new reference looks like a totally different list, item for item.",
    "trackBy gives each item a stable identity, so unchanged items are matched instead of recreated.",
    "trackBy provides a stable per-item identity, letting Angular match old and new items instead of recreating the whole list.",
    ["trackBy works by caching the entire previous DOM tree and replaying it unchanged", "trackBy disables change detection for the *ngFor block entirely", "trackBy only affects the order items render in, not whether they're recreated"]),

  general('onpush-contract-and-mutation-violation', 'advanced-change-detection',
    "Explain the architectural purpose of OnPush change detection beyond 'it's faster' — specifically, what contract does a component make with Angular by opting into OnPush, and what breaks if a developer violates that contract by mutating an @Input() object in place?",
    "Opting into OnPush is a promise that this component's rendered output is a pure function of its @Input() references (and whatever signals/async pipes it explicitly reads) — Angular trusts that if none of those references changed, nothing the user needs to see changed either, so it can safely skip checking that subtree. Mutating an @Input() object in place breaks that contract silently: the component's actual displayed state goes stale relative to the mutated data, but Angular has no way to know, since the reference it's watching never changed. The bug is often intermittent, surfacing only when something else coincidentally forces a check elsewhere.",
    "OnPush is a promise about what determines the output — what happens when that promise is broken silently?"),

  general('default-vs-onpush-scaling-tradeoff', 'advanced-change-detection',
    "Compare the performance profile of an app using the DEFAULT change detection strategy everywhere versus one using OnPush everywhere with disciplined immutable updates, as the component tree grows.",
    "With the default strategy, every change-detection trigger re-checks the entire tree regardless of size, so cost scales with total component count even for parts of the UI that didn't change. OnPush with immutable updates instead scales with how much of the tree's DATA actually changed, since unaffected subtrees are skipped entirely via the reference check. The trade-off is that OnPush requires real architectural discipline — treating all state as immutable, never mutating inputs — to be correct, whereas the default strategy is 'correct by default' but pays for that safety with re-check cost everywhere, growing with the tree regardless of what actually changed.",
    "One strategy's cost scales with tree SIZE; the other's scales with how much actually CHANGED."),

  general('zoneless-benefit-and-risk', 'advanced-change-detection',
    "A team is deciding whether to adopt Angular's zoneless change detection mode for a new app. Explain one real benefit and one real risk/cost of going zoneless, beyond 'zone.js adds some bundle size.'",
    "Benefit: change detection becomes explicit and traceable — driven by actual signal/data changes rather than by patching nearly every async browser API and broadly re-checking afterward — which removes a class of bugs where detection runs (or doesn't run) for reasons unrelated to the real UI logic, and typically improves runtime performance by skipping the 'check everything after every async event' default sweep. Risk: any code path that updates state WITHOUT going through a signal or another explicit notification mechanism — some third-party libraries, certain RxJS patterns, or legacy code written assuming zone.js's implicit 'everything triggers a check' behavior — can silently fail to update the view, since there's no zone.js safety net automatically catching async changes anymore. It shifts correctness responsibility from 'happens automatically' to 'the developer must route all state changes through tracked reactivity.'",
    "The benefit and the risk are really the same shift, viewed from two different angles: explicit instead of implicit."),
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

  const subject = await subjectRepo.findOne({ where: { slug: 'angular' } });
  if (!subject) throw new Error('Subject "angular" not found.');

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
      level: LEVEL,
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
    console.log(`   ${slug.padEnd(36)} ${count} linked (this + any pre-existing)`);
  }

  await AppDataSource.destroy();
  console.log('\nDone.');
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
