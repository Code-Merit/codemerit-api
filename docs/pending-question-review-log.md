# Pending Question Review Log

Questions reviewed but deliberately left `Pending` because of a quality issue (per the Question Quality Policy).
Codes: DUP = duplicates another question; ELIM = 2+ throwaway/absolute distractors make the answer guessable by elimination; LEN = correct option is a length tell; FACT = factual error; OTHER = see note.

## Relational Databases (reviewed 2026-10-13, 42 held)

| Question ID | Issue |
|---|---|
| 2804 | ELIM: one table per DB / unrelated blob / never connected |
| 2809 | ELIM: translate currencies / one table only / no WHERE |
| 2811 | ELIM: required by SQL syntax / impossible queries / no difference |
| 2814 | DUP: of 2843 (1NF, multi-value column) |
| 2823 | ELIM: not valid SQL / encrypts / always faster |
| 2831 | ELIM: permanently delete / always identical |
| 2833 | ELIM: three Just-one-clause options; correct is the only multi-part one |
| 2834 | ELIM: only two tables ever / different language |
| 2835 | ELIM: JOIN needs unique data / JOINs always dedupe |
| 2837 | FACT: answer says SUM treats missing as 0 — SUM over no rows returns NULL; needs COALESCE |
| 2838 | DUP: of 2832 (HAVING vs WHERE) |
| 2839 | ELIM: one column per table / more duplicates / no PKs |
| 2840 | LEN: correct option much longer than distractors |
| 2841 | DUP: of 2839 (goal of normalization) |
| 2842 | ELIM: only a NoSQL problem / FK not allowed |
| 2844 | ELIM: never need JOINs / removes PKs / unrelated |
| 2845 | ELIM: no trade-off / always slower / removes indexes |
| 2846 | DUP: of 2811 (customer data stored once) |
| 2847 | ELIM: only one / not possible / every student every course |
| 2848 | ELIM: delete tables / more PKs / no way |
| 2851 | ELIM: impossible / NoSQL only / merged is correct |
| 2856 | DUP: of 2853 (index write overhead) |
| 2859 | DUP: of 2853 (index write overhead) |
| 2862 | DUP: of 2853 (index write overhead) |
| 2870 | ELIM: guaranteed fail / always perfect / cannot happen |
| 2872 | ELIM: proceed instantly / permanently inaccessible / no impact |
| 2873 | FACT: a card charge is an external call, a DB transaction cannot roll it back; also DUP of 3528 |
| 2874 | DUP: of 3530 (isolation vs speed trade-off) |
| 3516 | ELIM: translate languages / one user / no queries |
| 3519 | ELIM: ignore indexes by design / always instant / invalid SQL |
| 3522 | DUP: of 2855 (unindexed scan); answer is vague |
| 3527 | DUP: of 3526 (scan cheaper than index) |
| 3528 | ELIM: always faster / no effect / only read-only |
| 3530 | ELIM: always faster / display only / no relationship |

## Earlier sweep (Financial Literacy / Data Entry / Internet) (reviewed 2026-10-13, 3 held)

| Question ID | Issue |
|---|---|
| 962 | DUP: of 995 (padlock = HTTPS encryption) |
| 1121 | DUP: of 1157 (date-first file naming) |
| 5531 | DUP: of 5530/5532 (payback period) |

## Spring Boot (reviewed 2026-10-13, 11 held)

| Question ID | Issue |
|---|---|
| 1983 | DUP: of 2060 (Spring profiles activation) |
| 2009 | FACT: ambiguous — 422 is also a widely accepted answer for validation errors |
| 2013 | FACT: ambiguous — Hibernate also has a ConstraintViolationException for SQL constraint violations, so distractor 1 is arguably correct |
| 2018 | FACT: correct option says N parent queries + N child; it is 1 parent query + N child queries (also DUP of 5566) |
| 2020 | FACT: correct option uses single quotes inside @Query — not valid Java string syntax |
| 2038 | FACT: outdated — Spring now recommends RestClient for blocking calls; WebClient is not the universal preferred choice |
| 2057 | FACT: correct option says @Async returns Future; void and CompletableFuture are also valid |
| 5564 | ELIM: app crashes / retried indefinitely |
| 5565 | ELIM: always succeed / abandon sagas / silently ignored |
| 5567 | DUP: of 5563 (proxy self-invocation bypasses advice) |
| 5568 | ELIM: unrelated / disable all tests / identical contexts |

## Docker (reviewed 2026-10-13, 50 held)

| Question ID | Issue |
|---|---|
| 1346 | FACT: ambiguous — none mode is the most isolated; distractors are nonsense (overlay stores data, none enables global networking) |
| 2967 | ELIM+DUP: portability concept (see 3550); permanently tied / rewrite app / single data center |
| 2971 | DUP+ELIM: of 2968 (shared-kernel isolation) |
| 2977 | ELIM: latest always stable / tags unsupported / no difference |
| 2980 | ELIM: rebuild every 24h / never rebuild / always fails |
| 2981 | DUP+ELIM: of 3556 (cache ordering) |
| 2982 | DUP+ELIM: of 1345 (multi-stage builds) |
| 2987 | ELIM: no effect / always fail / Docker requires |
| 2990 | DUP: of 3565 (non-root) |
| 2991 | DUP+ELIM: of 2977 (pin version tag) |
| 2992 | ELIM: auto removes / no effect / image smaller |
| 2993 | ELIM: CI cannot run Docker / different syntax / always fail |
| 2995 | FACT: answer says default-bridge containers reach each other by name — the default bridge has no DNS name resolution |
| 2998 | ELIM: always faster / cannot be used / only option |
| 3000 | DUP: of 2997 (DNS on user-defined networks) |
| 3001 | DUP: of 2996 (data lost without volume) |
| 3002 | DUP: of 1347 (volume vs bind mount) |
| 3003 | DUP+ELIM: of 2996 (data lost without volume) |
| 3006 | ELIM: user accounts / billing info |
| 3009 | DUP: of 2996/3559 (volume persistence) |
| 3010 | ELIM: identical / disables run / only image for db |
| 3011 | ELIM: only original author / manual config / cannot share |
| 3013 | DUP: of 3564 (depends_on is not readiness) |
| 3014 | ELIM: always identical / stop using Compose / unavoidable |
| 3015 | ELIM: remove db / never public / auto encrypted |
| 3016 | DUP: of 1351 (secrets in images) |
| 3017 | DUP: of 1350 (minimal base image) |
| 3021 | DUP: of 2980 (rebuild for base image patches) |
| 3022 | DUP+ELIM: of 3565 (non-root) |
| 3023 | DUP+ELIM: of 1350 (minimal base image) |
| 3550 | ELIM: only on laptop / fixes bugs / removes testing |
| 3554 | DUP: of 2977 (pin tag instead of latest) |
| 3556 | ELIM: no effect / must copy first / cannot be cached |
| 3557 | ELIM: disable COPY / required / auto filters |
| 3558 | DUP: of 1347 (bind mount maps host path) |
| 3561 | ELIM: purely cosmetic / only bind mounts |
| 3567 | DUP+ELIM: of 2980; switch to root / ignore / remove scanner |

## Microsoft Office (reviewed 2026-10-13, 14 held)

| Question ID | Issue |
|---|---|
| 3315 | DUP: of 1070 (VLOOKUP #N/A) |
| 3316 | OTHER: bare answer 'Press F5.' with no explanation |
| 3317 | DUP: of 1040 (export to PDF, same distractor set) |

## Tailwind CSS (reviewed 2026-10-13, 18 held — 6 raw-HTML-example holds were re-approved: learner screens render answers as plain text)

| Question ID | Issue |
|---|---|
| 1614 | DUP: of 1615 (only used classes are generated) |
| 1625 | DUP: of 1647 (p-4 = 1rem); also bare answer |
| 1628 | DUP: of 1654 (h-screen = 100vh) |
| 1633 | LEN: correct option much longer than distractors |
| 1635 | FACT: two correct answers — gap-4 also adds space only between items, not on outer edges |
| 1645 | LEN: correct option much longer than distractors |
| 1646 | LEN: correct option much longer than distractors |
| 1650 | DUP: of 1627 (fractional widths are percentages) |
| 1661 | FACT: no height is set, so the div grows with the text and nothing is clipped — correct option is misleading |
| 2361 | DUP: of 2356 (min-width, mobile-first); question wording 'exactly 640px and up' is confusing |
| 2362 | DUP: of 2359 (stack responsive prefixes) |
| 2375 | DUP: of 1624 (@apply inside @layer components); answer also has stripped HTML |
| 2381 | OTHER+DUP: answer contains raw HTML example; also DUP of 2380 (pair dark: variants) |
| 2384 | DUP: of 1623 (theme vs theme.extend) |
| 2400 | DUP: of 1615 (content scanning removes unused CSS) |

## Kubernetes (reviewed 2026-10-13, 59 held)

| Question ID | Issue |
|---|---|
| 2877 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2883 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2884 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2885 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2886 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2887 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2891 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2893 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2894 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2895 | DUP: of 2890 (ReplicaSet replaces missing pod) |
| 2896 | DUP: of 2890 (ReplicaSet replaces missing pod) |
| 2897 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2898 | DUP+ELIM: of 3534 (Deployment vs standalone pod) |
| 2905 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2906 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2908 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2909 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2922 | DUP+ELIM: of 2917 (same image, per-environment config) |
| 2925 | DUP+ELIM: of 2918 (Secrets are only base64) |
| 2943 | DUP+ELIM: of 2897 (revision history enables rollback) |
| 2946 | DUP+ELIM: of 2897 (roll back a bad update) |
| 2956 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2960 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 2961 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 3532 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 3533 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 3534 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 3536 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 3539 | DUP+ELIM: of 2902/3538 (Service gives stable address) |
| 3540 | DUP+ELIM: of 2902/3538 (stable Service address) |
| 3542 | DUP: of 2937 (ReadWriteOnce = one node) |
| 3546 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 3547 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 3548 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |
| 3549 | ELIM: 2+ throwaway/absolute distractors (e.g. no effect / always / identical / unrelated / absurd option) make the answer guessable |

## TypeScript (reviewed 2026-10-13, 6 held)

| Question ID | Issue |
|---|---|
| 627 | DUP: of 1352 (what is TypeScript); weak distractors |
| 1355 | DUP: of 1352 (superset of JavaScript) |
| 1398 | DUP: of 1391 (unknown vs any) |
| 1506 | FACT: describes the legacy experimentalDecorators signature without saying so; Stage 3 method decorators receive (value, context) |
| 1507 | FACT: two correct answers — @Input({ required: true }) is also a valid required input (Angular 16+) |
| 3336 | DUP: of 1361 (structural typing) |

## Computer Fundamentals (reviewed 2026-10-13, 46 held)

| Question ID | Issue |
|---|---|
| 901 | OTHER: every option carries its own explanation, correct one says it is not a computer type — answer given away |
| 942 | FACT: Wi-Fi is a trademark name; "Wireless Fidelity" is a later backronym, not what it stands for |
| 950 | DUP+ELIM: of 939; distractors are obvious bad habits |
| 1514 | DUP: of 919 (Recycle Bin) |
| 1516 | DUP: of 932 (End Task on frozen app) |
| 1517 | DUP: of 943 (router) |
| 1518 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1519 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1522 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1525 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1526 | DUP+ELIM: of 939 (updates) |
| 1527 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1528 | DUP: of 937 (restart first) |
| 1530 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1531 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1532 | DUP: of 903 (RAM) |
| 1533 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1534 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1535 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1536 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1540 | DUP: of 3309 (antivirus) |
| 1541 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1542 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1543 | DUP: of 913 (role of OS) |
| 1544 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1545 | DUP: of 908 (Ctrl+C), near-identical text |
| 1547 | DUP+ELIM: of 922 (rename); open in Notepad / drag to Recycle Bin |
| 1548 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 1549 | DUP: of 919 (Recycle Bin) |
| 1551 | DUP+ELIM: of 946 (restart router) |
| 1552 | DUP+ELIM: of 939 (updates patch vulnerabilities) |
| 3302 | DUP+LEN: of 1515 (Task Manager); option carries extra shortcut |
| 3303 | DUP: of 907 (SSD vs HDD) |
| 3308 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 3342 | DUP: of 904 (GPU) |
| 3343 | DUP: of 903 (RAM) |
| 3344 | DUP: of 936 (printer offline) |
| 3345 | DUP: of 898 (what is software) |
| 3346 | DUP: of 907 (SSD faster); DVD/floppy options |
| 3347 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 3348 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 3349 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 3350 | DUP: of 906 (motherboard) |
| 3351 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |
| 3353 | ELIM: 2+ throwaway distractors (e.g. buy a new computer / CPU cooler / swipe desktop / weather app) make the answer obvious |

## React (reviewed 2026-10-13, 14 held)

| Question ID | Issue |
|---|---|
| 2078 | DUP+FACT: of 2077; same outdated createElement claim |
| 2089 | FACT: answer says React logs PropTypes warnings — React 19 ignores propTypes entirely |
| 2113 | FACT: answer says missing keys force re-render of all items — React falls back to index keys |
| 2119 | DUP: of 2118/3419 (useRef reads DOM value without re-render) |
| 2133 | ELIM: never use Context / Redux deprecated / identical |
| 2144 | FACT: answer says setState after unmount causes a warning — that warning was removed in React 18 |
| 2154 | ELIM: add to every component / deprecated / class components only |
| 2171 | ELIM: identical / SSR and SSG identical |
| 2183 | OTHER: 'prop explosion' is not standard terminology; question tests a made-up distinction |
| 2190 | ELIM: memo everything / convert to classes / avoid hooks; correct option is a keyword list |
| 3417 | FACT: answer calls CRA 'officially supported' — Create React App was deprecated in Feb 2025 |
| 5555 | DUP: of 2112 (index keys break on reorder/insert) |
| 5559 | DUP: of 2131 (Context re-renders every consumer) |

## Web Foundation (reviewed 2026-10-13, 63 held)

| Question ID | Issue |
|---|---|
| 3030 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3031 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3034 | DUP+ELIM: of 3074 (cache speeds second visit) |
| 3035 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3044 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3045 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3053 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3054 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3055 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3056 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3063 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3064 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3065 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3066 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3067 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3071 | DUP+ELIM: of 3068 (incognito cookies not kept); emailed to owner / converted to history |
| 3073 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3078 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3079 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3080 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3081 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3082 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3083 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3084 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3090 | DUP+ELIM: of 3089/3094 (DNS propagation) |
| 3094 | DUP+ELIM: of 3089 (DNS propagation) |
| 3099 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3100 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3102 | DUP+ELIM: of 3099 (expired certificate warnings) |
| 3103 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3106 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3108 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3109 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3112 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3114 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3115 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3116 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3120 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3121 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3569 | DUP: of 3027 (request/response) |
| 3571 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3572 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3573 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3575 | DUP: of 3061 (one owner per domain) |
| 3577 | DUP+ELIM: of 3075 (incognito does not bypass network controls) |
| 3582 | DUP+ELIM: of 3104 (wildcard certificate); odd-numbered days option |
| 3583 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |
| 3584 | DUP+ELIM: of 3056 (mixed content) |
| 3588 | ELIM: 2+ throwaway/absolute distractors (e.g. illegal / a myth / only on weekdays / no risk at all) make the answer guessable |

## Jira (reviewed 2026-10-13, 72 held)

| Question ID | Issue |
|---|---|
| 3991 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 3993 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 3995 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 3997 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 3999 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4000 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4005 | DUP: of 4003 (epic = large multi-sprint body of work) |
| 4006 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4007 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4009 | DUP+ELIM: of 4102 (subtasks split work across people) |
| 4010 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4012 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4013 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4022 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4023 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4024 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4025 | DUP: of 4104 (link duplicates, consolidate) |
| 4028 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4032 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4035 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4040 | FACT: ambiguous — "the team has too few people" is also a defensible reading of constantly exceeded WIP limits |
| 4041 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4042 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4049 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4050 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4051 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4052 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4053 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4055 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4056 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4084 | DUP: of 4078 (CFD widening in-progress band) |
| 4087 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4093 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4094 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4095 | DUP: of 4091 (gadget follows its saved filter) |
| 4097 | ELIM: 2+ throwaway distractors (e.g. Jira auto-deletes / flip a coin / not allowed at any company / crashes at a limit) make the answer guessable |
| 4109 | DUP: of 4100 (watchers get notified without being assigned) |
| 4119 | DUP: of 4116 (retrospective purpose) |

## NgRX (reviewed 2026-10-13, 92 held)

| Question ID | Issue |
|---|---|
| 4287 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4288 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4289 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4294 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4295 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4298 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4299 | DUP: of 4296 (lazy feature state appears when loaded) |
| 4300 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4302 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4305 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4306 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4309 | DUP: of 4304 (actions describe events, not commands) |
| 4312 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4313 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4314 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4316 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4317 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4320 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4321 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4322 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4323 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4326 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4329 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4330 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4332 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4335 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4336 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4340 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4341 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4342 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4343 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4363 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4365 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4366 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4367 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4368 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4370 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4374 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4375 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4376 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4407 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4408 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4409 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4410 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4411 | OTHER: bare answer — only restates the option (e.g. "createAction().") with no explanation (policy rule 3) |
| 4415 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4416 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4418 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4419 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |
| 4420 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / illegal / hard limit / purely stylistic) make the answer guessable |

## Java (reviewed 2026-10-13, 21 held)

| Question ID | Issue |
|---|---|
| 207 | FACT: two options marked correct; answer is just 'Duplicate of …' — broken question |
| 209 | OTHER: options are lowercase (object/string/system) — Java class is Object; sloppy option text |
| 223 | DUP: of 205 (JVM executes bytecode); answer also has a typo |
| 226 | FACT: ambiguous — long and double are both 64-bit, so 'largest size' has two answers |
| 229 | DUP: of 241 (method overloading) |
| 233 | FACT: answer says arrays are objects (classes), contradicting the 'Arrays are classes' distractor being wrong |
| 234 | DUP: of 1956 (objects live on the heap) |
| 236 | DUP: of 214 (do-while runs at least once) |
| 239 | FACT: void is a return type, not a keyword that defines a method |
| 244 | FACT: 'always executed first' is inaccurate — static initialisers run before main() |
| 245 | DUP: of 235 (this keyword) |
| 249 | DUP: of 248 (inheritance); question text is the answer reworded |
| 251 | DUP+ELIM: of 1915 (abstract class vs interface) |
| 253 | DUP: of 220 (no multiple class inheritance, use interfaces) |
| 254 | DUP: of 238 (static methods) |
| 255 | DUP: of 242 (method overriding) |
| 256 | DUP: of 232 (final keyword rules); run-on answer |
| 270 | FACT: premise wrong — == does not compare 'both value and type'; the answer itself contradicts the question |
| 274 | DUP: of 214 (do-while runs at least once) |
| 275 | FACT: two options marked correct plus a 'Both B and C' option — broken question |
| 3239 | DUP: of 204 (James Gosling) |

## REST APIs (reviewed 2026-10-13, 87 held)

| Question ID | Issue |
|---|---|
| 2496 | LEN: correct option is the longest and 1.40x the average distractor length (and ≥1.25x the longest distractor) |
| 2504 | LEN: correct option is the longest and 1.71x the average distractor length (and ≥1.25x the longest distractor) |
| 2507 | LEN: correct option is the longest and 1.54x the average distractor length (and ≥1.25x the longest distractor) |
| 2511 | DUP: of 3456 (Accept header / content negotiation) |
| 2512 | ELIM: page HTML / address bar history / cookie banner |
| 2519 | LEN: correct option is the longest and 1.61x the average distractor length (and ≥1.25x the longest distractor) |
| 2522 | LEN: correct option is the longest and 1.47x the average distractor length (and ≥1.25x the longest distractor) |
| 2528 | LEN: correct option is the longest and 1.72x the average distractor length (and ≥1.25x the longest distractor) |
| 2529 | ELIM: databases always faster / the only way filtering works |
| 2531 | LEN: correct option is the longest and 1.78x the average distractor length (and ≥1.25x the longest distractor) |
| 2535 | LEN: correct option is the longest and 1.45x the average distractor length (and ≥1.25x the longest distractor) |
| 2537 | LEN: correct option is the longest and 1.60x the average distractor length (and ≥1.25x the longest distractor) |
| 2540 | LEN: correct option is the longest and 1.59x the average distractor length (and ≥1.25x the longest distractor) |
| 2542 | LEN: correct option is the longest and 1.70x the average distractor length (and ≥1.25x the longest distractor) |
| 2544 | LEN: correct option is the longest and 1.78x the average distractor length (and ≥1.25x the longest distractor) |
| 2545 | LEN: correct option is the longest and 1.66x the average distractor length (and ≥1.25x the longest distractor) |
| 2548 | LEN: correct option is the longest and 1.54x the average distractor length (and ≥1.25x the longest distractor) |
| 2550 | LEN: correct option is the longest and 1.49x the average distractor length (and ≥1.25x the longest distractor) |
| 2551 | LEN: correct option is the longest and 1.64x the average distractor length (and ≥1.25x the longest distractor) |
| 2552 | LEN: correct option is the longest and 1.42x the average distractor length (and ≥1.25x the longest distractor) |
| 2553 | LEN: correct option is the longest and 1.45x the average distractor length (and ≥1.25x the longest distractor) |
| 2560 | LEN: correct option is the longest and 1.62x the average distractor length (and ≥1.25x the longest distractor) |
| 2562 | LEN: correct option is the longest and 1.53x the average distractor length (and ≥1.25x the longest distractor) |
| 2564 | LEN: correct option is the longest and 1.49x the average distractor length (and ≥1.25x the longest distractor) |
| 2566 | LEN: correct option is the longest and 1.46x the average distractor length (and ≥1.25x the longest distractor) |
| 2568 | LEN: correct option is the longest and 1.58x the average distractor length (and ≥1.25x the longest distractor) |
| 2572 | LEN: correct option is the longest and 1.76x the average distractor length (and ≥1.25x the longest distractor) |
| 2573 | LEN: correct option is the longest and 1.75x the average distractor length (and ≥1.25x the longest distractor) |
| 2574 | LEN: correct option is the longest and 1.53x the average distractor length (and ≥1.25x the longest distractor) |
| 2576 | LEN: correct option is the longest and 1.79x the average distractor length (and ≥1.25x the longest distractor) |
| 2578 | LEN: correct option is the longest and 1.77x the average distractor length (and ≥1.25x the longest distractor) |
| 2580 | LEN: correct option is the longest and 1.53x the average distractor length (and ≥1.25x the longest distractor) |
| 2582 | LEN: correct option is the longest and 1.72x the average distractor length (and ≥1.25x the longest distractor) |
| 2584 | FACT: correct option is wrong — browsers refuse credentialed requests when Access-Control-Allow-Origin is * (see Web Foundation 3120); also LEN |
| 2586 | LEN: correct option is the longest and 1.59x the average distractor length (and ≥1.25x the longest distractor) |
| 2587 | LEN: correct option is the longest and 1.64x the average distractor length (and ≥1.25x the longest distractor) |
| 2588 | LEN: correct option is the longest and 1.40x the average distractor length (and ≥1.25x the longest distractor) |
| 2590 | LEN: correct option is the longest and 1.57x the average distractor length (and ≥1.25x the longest distractor) |
| 2591 | LEN: correct option is the longest and 1.60x the average distractor length (and ≥1.25x the longest distractor) |
| 2592 | LEN: correct option is the longest and 1.53x the average distractor length (and ≥1.25x the longest distractor) |
| 2594 | LEN: correct option is the longest and 1.65x the average distractor length (and ≥1.25x the longest distractor) |
| 2596 | LEN: correct option is the longest and 1.46x the average distractor length (and ≥1.25x the longest distractor) |
| 2597 | LEN: correct option is the longest and 1.58x the average distractor length (and ≥1.25x the longest distractor) |
| 2598 | LEN: correct option is the longest and 1.60x the average distractor length (and ≥1.25x the longest distractor) |
| 2599 | LEN: correct option is the longest and 1.47x the average distractor length (and ≥1.25x the longest distractor) |
| 2600 | LEN: correct option is the longest and 1.79x the average distractor length (and ≥1.25x the longest distractor) |
| 2601 | LEN: correct option is the longest and 1.67x the average distractor length (and ≥1.25x the longest distractor) |
| 2603 | LEN: correct option is the longest and 1.65x the average distractor length (and ≥1.25x the longest distractor) |
| 2605 | LEN: correct option is the longest and 1.53x the average distractor length (and ≥1.25x the longest distractor) |
| 2607 | DUP: of 2506 (which methods are idempotent) |
| 2608 | DUP: of 2506 (POST is not idempotent) |
| 2623 | DUP: of 3482 (respect Retry-After) |
| 3449 | DUP: of Active 2490 (URL represents a resource) |
| 3450 | DUP: of Active 2491 (RESTful resource URL) |
| 3452 | DUP: of Active 2491 (no action verbs in URLs) |
| 3453 | DUP: of Active 2491 (nouns not verbs in URLs) |
| 3481 | DUP: of 2593 (rate-limit login against brute force) |

## Linux & Shell Scripting — length-tell recheck (reviewed 2026-10-13, 1 held)

| Question ID | Issue |
|---|---|
| 2478 | LEN: correct option is 1.56x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Monitoring & Observability — length-tell recheck (reviewed 2026-10-13, 2 held)

| Question ID | Issue |
|---|---|

## Cloud Basics — length-tell recheck (reviewed 2026-10-13, 5 held)

| Question ID | Issue |
|---|---|

## Financial Literacy for Non-Finance Roles — length-tell recheck (reviewed 2026-10-13, 23 held)

| Question ID | Issue |
|---|---|
| 5498 | LEN: correct option is 1.61x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5499 | LEN: correct option is 2.10x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5500 | LEN: correct option is 1.58x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5501 | LEN: correct option is 1.70x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5513 | LEN: correct option is 1.98x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5515 | LEN: correct option is 2.19x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5516 | LEN: correct option is 1.58x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5519 | LEN: correct option is 1.61x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Data Entry & Productivity — length-tell recheck (reviewed 2026-10-13, 16 held)

| Question ID | Issue |
|---|---|
| 1113 | LEN: correct option is 1.55x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1137 | LEN: correct option is 1.53x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Internet & Digital Skills — length-tell recheck (reviewed 2026-10-13, 21 held)

| Question ID | Issue |
|---|---|
| 1004 | LEN: correct option is 1.45x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3312 | LEN: correct option is 1.71x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Relational Databases — length-tell recheck (reviewed 2026-10-13, 6 held)

| Question ID | Issue |
|---|---|
| 2808 | LEN: correct option is 1.54x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2810 | LEN: correct option is 1.63x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2813 | LEN: correct option is 1.47x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2832 | LEN: correct option is 1.51x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2867 | LEN: correct option is 1.45x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3520 | LEN: correct option is 1.78x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Spring Boot — length-tell recheck (reviewed 2026-10-13, 7 held)

| Question ID | Issue |
|---|---|
| 1981 | LEN: correct option is 1.46x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1989 | LEN: correct option is 1.46x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2017 | LEN: correct option is 1.41x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3413 | LEN: correct option is 3.09x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5561 | LEN: correct option is 1.60x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5562 | LEN: correct option is 1.72x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5563 | LEN: correct option is 1.88x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Docker — length-tell recheck (reviewed 2026-10-13, 11 held)

| Question ID | Issue |
|---|---|
| 1342 | LEN: correct option is 1.64x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1344 | LEN: correct option is 1.47x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1349 | LEN: correct option is 1.53x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2974 | LEN: correct option is 1.65x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2975 | LEN: correct option is 1.56x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2976 | LEN: correct option is 1.76x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2985 | LEN: correct option is 1.40x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2988 | LEN: correct option is 1.50x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3555 | LEN: correct option is 1.62x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3560 | LEN: correct option is 1.47x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Microsoft Office — length-tell recheck (reviewed 2026-10-13, 20 held)

| Question ID | Issue |
|---|---|
| 1044 | LEN: correct option is 1.46x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1059 | LEN: correct option is 1.67x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Tailwind CSS — length-tell recheck (reviewed 2026-10-13, 4 held)

| Question ID | Issue |
|---|---|
| 1617 | LEN: correct option is 1.75x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1621 | LEN: correct option is 1.45x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1623 | LEN: correct option is 1.47x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1644 | LEN: correct option is 1.51x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Kubernetes — length-tell recheck (reviewed 2026-10-13, 15 held)

| Question ID | Issue |
|---|---|
| 2875 | LEN: correct option is 1.76x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2879 | LEN: correct option is 1.54x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2899 | LEN: correct option is 1.54x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2910 | LEN: correct option is 1.56x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2951 | LEN: correct option is 1.52x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2957 | LEN: correct option is 1.76x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2959 | LEN: correct option is 1.53x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3537 | LEN: correct option is 1.44x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## TypeScript — length-tell recheck (reviewed 2026-10-13, 2 held)

| Question ID | Issue |
|---|---|
| 1431 | LEN: correct option is 1.45x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3335 | LEN: correct option is 1.48x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Computer Fundamentals — length-tell recheck (reviewed 2026-10-13, 9 held)

| Question ID | Issue |
|---|---|
| 906 | LEN: correct option is 1.54x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 913 | LEN: correct option is 1.71x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 931 | LEN: correct option is 1.58x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 940 | LEN: correct option is 1.78x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 951 | LEN: correct option is 1.49x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3306 | LEN: correct option is 1.58x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3352 | LEN: correct option is 1.76x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## React — length-tell recheck (reviewed 2026-10-13, 11 held)

| Question ID | Issue |
|---|---|
| 2068 | LEN: correct option is 1.46x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2090 | LEN: correct option is 1.43x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 2164 | LEN: correct option is 1.47x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5553 | LEN: correct option is 1.53x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5554 | LEN: correct option is 1.46x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5556 | LEN: correct option is 1.51x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5557 | LEN: correct option is 1.74x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5558 | LEN: correct option is 1.46x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 5560 | LEN: correct option is 1.57x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Web Foundation — length-tell recheck (reviewed 2026-10-13, 7 held)

| Question ID | Issue |
|---|---|
| 3025 | LEN: correct option is 1.61x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3041 | LEN: correct option is 1.43x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3075 | LEN: correct option is 1.44x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3585 | LEN: correct option is 1.66x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3589 | LEN: correct option is 1.79x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Jira — length-tell recheck (reviewed 2026-10-13, 22 held)

| Question ID | Issue |
|---|---|
| 3992 | LEN: correct option is 1.45x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3994 | LEN: correct option is 1.58x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 3996 | LEN: correct option is 1.45x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4004 | LEN: correct option is 1.76x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4008 | LEN: correct option is 1.71x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4015 | LEN: correct option is 1.67x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4016 | LEN: correct option is 1.66x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4030 | LEN: correct option is 1.57x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4031 | LEN: correct option is 1.51x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4034 | LEN: correct option is 1.42x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4036 | LEN: correct option is 1.67x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4045 | LEN: correct option is 1.62x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4086 | LEN: correct option is 1.61x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## NgRX — length-tell recheck (reviewed 2026-10-13, 10 held)

| Question ID | Issue |
|---|---|
| 4290 | LEN: correct option is 1.53x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4293 | LEN: correct option is 1.48x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4303 | LEN: correct option is 1.50x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4319 | LEN: correct option is 1.50x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4328 | LEN: correct option is 1.50x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 4333 | LEN: correct option is 1.72x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Java — length-tell recheck (reviewed 2026-10-13, 21 held)

| Question ID | Issue |
|---|---|
| 220 | LEN: correct option is 1.70x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 241 | LEN: correct option is 1.47x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 265 | LEN: correct option is 1.64x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1899 | LEN: correct option is 1.43x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1900 | LEN: correct option is 1.73x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1906 | LEN: correct option is 1.58x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1907 | LEN: correct option is 1.42x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1909 | LEN: correct option is 1.48x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1910 | LEN: correct option is 1.42x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1912 | LEN: correct option is 1.40x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1915 | LEN: correct option is 1.42x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1921 | LEN: correct option is 1.67x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1923 | LEN: correct option is 1.57x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1936 | LEN: correct option is 1.55x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1937 | LEN: correct option is 1.64x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1939 | LEN: correct option is 1.55x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1950 | LEN: correct option is 1.44x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1961 | LEN: correct option is 1.58x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1965 | LEN: correct option is 1.50x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1966 | LEN: correct option is 1.40x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |
| 1969 | LEN: correct option is 1.41x the average distractor length (measured: longest, ≥1.25x longest distractor, ≥30 chars) — approved earlier today, reverted to Pending |

## Communication Skills (reviewed 2026-10-13, 106 held)

| Question ID | Issue |
|---|---|
| 4425 | LEN: correct option is 2.50x the average distractor length (measured) |
| 4434 | LEN: correct option is 1.70x the average distractor length (measured) |
| 4435 | LEN: correct option is 1.48x the average distractor length (measured) |
| 4436 | LEN: correct option is 1.77x the average distractor length (measured) |
| 4437 | LEN: correct option is 1.71x the average distractor length (measured) |
| 4438 | LEN: correct option is 2.62x the average distractor length (measured) |
| 4439 | LEN: correct option is 2.67x the average distractor length (measured) |
| 4442 | LEN: correct option is 2.38x the average distractor length (measured) |
| 4443 | LEN: correct option is 3.15x the average distractor length (measured) |
| 4446 | LEN: correct option is 1.47x the average distractor length (measured) |
| 4447 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4452 | LEN: correct option is 2.04x the average distractor length (measured) |
| 4454 | DUP: of 4449 (identify the pronoun) |
| 4457 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4458 | DUP: of 4448 (identify the verb) |
| 4463 | LEN: correct option is 2.59x the average distractor length (measured) |
| 4464 | DUP: of 4460 (complete sentence) |
| 4465 | DUP: of 4432/4515 (semicolon/comma-splice), reuses 4432 sentence |
| 4467 | DUP: of 4424/4462 (singular subject agreement) |
| 4469 | DUP: of 4460 (sentence fragment) |
| 4471 | LEN: correct option is 1.94x the average distractor length (measured) |
| 4477 | DUP: of 4476 (past perfect) |
| 4481 | DUP: of 4475 (have with plural/you) |
| 4490 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4499 | DUP: of 4431 (an before a vowel sound) |
| 4513 | LEN: correct option is 1.68x the average distractor length (measured) |
| 4515 | DUP: of 4432 (comma splice) |
| 4520 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4521 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4522 | LEN: correct option is 3.00x the average distractor length (measured) |
| 4523 | LEN: correct option is 1.80x the average distractor length (measured) |
| 4524 | LEN: correct option is 3.16x the average distractor length (measured) |
| 4525 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4526 | LEN: correct option is 1.85x the average distractor length (measured) |
| 4527 | LEN: correct option is 2.60x the average distractor length (measured) |
| 4528 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4529 | LEN: correct option is 2.33x the average distractor length (measured) |
| 4530 | LEN: correct option is 2.34x the average distractor length (measured) |
| 4531 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4534 | LEN: correct option is 2.50x the average distractor length (measured) |
| 4536 | LEN: correct option is 1.89x the average distractor length (measured) |
| 4537 | LEN: correct option is 1.93x the average distractor length (measured) |
| 4540 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4541 | LEN: correct option is 2.49x the average distractor length (measured) |
| 4543 | LEN: correct option is 1.49x the average distractor length (measured) |
| 4544 | LEN: correct option is 5.05x the average distractor length (measured) |
| 4545 | LEN: correct option is 4.20x the average distractor length (measured) |
| 4546 | LEN: correct option is 1.88x the average distractor length (measured) |
| 4547 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4548 | LEN: correct option is 2.10x the average distractor length (measured) |
| 4549 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4550 | LEN: correct option is 1.86x the average distractor length (measured) |
| 4551 | LEN: correct option is 4.53x the average distractor length (measured) |
| 4552 | LEN: correct option is 1.85x the average distractor length (measured) |
| 4553 | LEN: correct option is 1.48x the average distractor length (measured) |
| 4554 | LEN: correct option is 2.24x the average distractor length (measured) |
| 4555 | LEN: correct option is 4.38x the average distractor length (measured) |
| 4568 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4569 | LEN: correct option is 1.87x the average distractor length (measured) |
| 4570 | LEN: correct option is 1.66x the average distractor length (measured) |
| 4571 | LEN: correct option is 2.96x the average distractor length (measured) |
| 4572 | LEN: correct option is 3.76x the average distractor length (measured) |
| 4573 | LEN: correct option is 1.76x the average distractor length (measured) |
| 4574 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4575 | LEN: correct option is 1.50x the average distractor length (measured) |
| 4576 | LEN: correct option is 2.39x the average distractor length (measured) |
| 4577 | LEN: correct option is 1.80x the average distractor length (measured) |
| 4578 | LEN: correct option is 1.63x the average distractor length (measured) |
| 4579 | LEN: correct option is 2.17x the average distractor length (measured) |
| 4592 | LEN: correct option is 2.30x the average distractor length (measured) |
| 4593 | LEN: correct option is 2.22x the average distractor length (measured) |
| 4594 | ELIM: distractors are obviously wrong (e.g. xoxo / my bad, oops / use as much slang as possible / speak louder) — answer guessable without the skill |
| 4595 | LEN: correct option is 1.85x the average distractor length (measured) |
| 4596 | LEN: correct option is 1.62x the average distractor length (measured) |
| 4597 | LEN: correct option is 1.92x the average distractor length (measured) |
| 4598 | LEN: correct option is 2.49x the average distractor length (measured) |
| 4599 | LEN: correct option is 2.36x the average distractor length (measured) |
| 4600 | LEN: correct option is 2.76x the average distractor length (measured) |
| 4601 | LEN: correct option is 1.55x the average distractor length (measured) |
| 4602 | LEN: correct option is 1.78x the average distractor length (measured) |
| 4603 | LEN: correct option is 1.71x the average distractor length (measured) |

## AWS Cloud (reviewed 2026-10-13, 89 held)

| Question ID | Issue |
|---|---|
| 2643 | LEN: correct option is 1.42x the average distractor length (measured) |
| 2651 | LEN: correct option is 1.50x the average distractor length (measured) |
| 2652 | LEN: correct option is 1.54x the average distractor length (measured) |
| 2655 | FACT: AWS now designs Regions with a minimum of three AZs; "at least two" is outdated/ambiguous |
| 2660 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2662 | LEN: correct option is 1.55x the average distractor length (measured) |
| 2669 | DUP: of 2663 (Spot = cheapest, interruptible) |
| 2670 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2672 | LEN: correct option is 1.44x the average distractor length (measured) |
| 2673 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2674 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2676 | LEN: correct option is 1.59x the average distractor length (measured) |
| 2683 | DUP: of 2678 (EFS shared file system) |
| 2684 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2687 | DUP+ELIM: of 2677 (instance store is ephemeral) |
| 2691 | LEN: correct option is 1.53x the average distractor length (measured) |
| 2693 | DUP: of 2688 (RDS for relational joins) |
| 2694 | LEN: correct option is 1.40x the average distractor length (measured) |
| 2695 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2696 | DUP: of 2690 (Redshift for historical analytics) |
| 2697 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2698 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2699 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2706 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2707 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2710 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2711 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2712 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2721 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2722 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2723 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2724 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2729 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2731 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2732 | LEN: correct option is 1.54x the average distractor length (measured) |
| 2733 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2741 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2742 | DUP: of 2736 (shared responsibility) |
| 2743 | LEN: correct option is 1.46x the average distractor length (measured) |
| 2745 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2746 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2747 | DUP+ELIM: of 2744 (use an IAM role, not keys) |
| 2748 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2752 | DUP: of 2750 (CloudTrail API history) |
| 2756 | DUP: of 2753 (CloudWatch alarm) |
| 2758 | LEN: correct option is 1.46x the average distractor length (measured) |
| 2759 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2760 | LEN: correct option is 1.45x the average distractor length (measured) |
| 2761 | DUP: of 2750 (CloudTrail audit) |
| 2762 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2765 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2769 | DUP: of 2765 (Budgets alert) |
| 2770 | LEN: correct option is 1.59x the average distractor length (measured) |
| 2772 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2774 | DUP+ELIM: of 2771 (support tier response times) |
| 2777 | DUP: of 2775 (Snow Family bulk transfer) |
| 2781 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2782 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2783 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2784 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2785 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2786 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2787 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2794 | FACT: in CLF-C02, global infrastructure is under Cloud Technology and Services, not Cloud Concepts |
| 2796 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2797 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 2800 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3486 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3487 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3488 | LEN: correct option is 1.52x the average distractor length (measured) |
| 3489 | DUP+ELIM: of 2653/2660 (why multiple AZs) |
| 3491 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3493 | DUP: of 2677 (instance store is ephemeral) |
| 3494 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3496 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3498 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3499 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3500 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3501 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3502 | DUP: of 2728 (SNS fan-out) |
| 3505 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3506 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3507 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3508 | DUP: of 2646 (pay-as-you-go) |
| 3509 | DUP: of 2764 (Cost Explorer) |
| 3510 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |
| 3513 | DUP: of 2776 (rehosting is fastest) |
| 3514 | DUP: of 2789 (Cost Optimization pillar) |
| 3515 | ELIM: 2+ throwaway/absolute distractors (e.g. no way / always redundant / AWS requires both / can never) make the answer guessable |

## Git (reviewed 2026-10-13, 246 held)

| Question ID | Issue |
|---|---|
| 666 | DUP: of 663 |
| 668 | LEN: correct option is 1.52x the average distractor length (measured) |
| 670 | DUP: of 712 |
| 671 | DUP: of 698 |
| 672 | FACT: working directory is the checked-out files, not "a clone of the repository" |
| 675 | DUP: of 664 |
| 676 | DUP: of 699 |
| 677 | LEN: correct option is 1.66x the average distractor length (measured) |
| 678 | LEN: correct option is 1.54x the average distractor length (measured) |
| 679 | DUP: of 717 |
| 680 | DUP: of 737 |
| 681 | DUP: of 744 |
| 689 | FACT: correct option says --global is system-wide — --global is per-user; --system is system-wide (see 693) |
| 694 | LEN: correct option is 1.86x the average distractor length (measured) |
| 695 | DUP: of 5292 |
| 696 | DUP: of 5286 |
| 704 | LEN: correct option is 1.79x the average distractor length (measured) |
| 709 | FACT: ambiguous — git log also errors outside a repo; the real check is git rev-parse |
| 728 | FACT: correct option says Git shows an error; answer says it opens an editor — neither matches (Git prints "nothing to commit" and exits) |
| 730 | FACT: ambiguous — git diff --staged (a distractor) also shows staged changes |
| 731 | DUP: of 722 |
| 733 | FACT: git diff compares working tree to the index, not to the last commit as the question/answer claim |
| 734 | LEN: correct option is 1.61x the average distractor length (measured) |
| 756 | DUP: of 737 |
| 757 | LEN: correct option is 1.77x the average distractor length (measured) |
| 758 | DUP: of 744 |
| 761 | DUP: of 5189 |
| 762 | LEN: correct option is 1.70x the average distractor length (measured) |
| 764 | DUP: of 759 |
| 766 | FACT: Git does not check file content — deleting markers then git add completes the merge; correct option is misleading |
| 768 | FACT: "safest way" is opinion; aborting is not the standard recommendation |
| 771 | FACT: ambiguous — git add -A also marks all conflicts resolved; "(not recommended)" wording is confusing |
| 772 | FACT: frequent integration, not frequent commits, reduces conflicts |
| 773 | DUP: of 5362 |
| 774 | LEN: correct option is 1.77x the average distractor length (measured) |
| 776 | DUP: of 702 |
| 777 | DUP: of 699 |
| 778 | DUP: of 703 |
| 779 | DUP: of 706 |
| 782 | DUP: of 755 |
| 783 | DUP: of 716 |
| 790 | DUP: of 5191 |
| 791 | DUP: of 856 |
| 793 | DUP: of 781 |
| 795 | DUP: of 705 |
| 799 | DUP: of 722 |
| 800 | LEN: correct option is 1.69x the average distractor length (measured) |
| 804 | LEN: correct option is 1.50x the average distractor length (measured) |
| 806 | DUP: of 811 |
| 807 | DUP: of 722 |
| 808 | OTHER: question is confusingly worded; options do not map cleanly to it |
| 809 | FACT: git restore . restores from the index (staged content), not the last commit |
| 810 | LEN: correct option is 1.72x the average distractor length (measured) |
| 814 | OTHER: answer ends with a stray "---" artifact |
| 816 | DUP: of 750 |
| 821 | LEN: correct option is 1.63x the average distractor length (measured) |
| 824 | DUP: of 5176 |
| 826 | DUP: of 5176 |
| 830 | LEN: correct option is 1.76x the average distractor length (measured) |
| 834 | LEN: correct option is 1.56x the average distractor length (measured) |
| 838 | DUP: of 829 |
| 839 | DUP: of 831 |
| 845 | LEN: correct option is 2.66x the average distractor length (measured) |
| 846 | LEN: correct option is 1.55x the average distractor length (measured) |
| 850 | LEN: correct option is 1.52x the average distractor length (measured) |
| 859 | DUP: of 848 |
| 861 | DUP: of 3428 |
| 865 | LEN: correct option is 2.20x the average distractor length (measured) |
| 869 | FACT: prepare-commit-msg (a distractor) also runs before the message is entered |
| 870 | LEN: correct option is 1.61x the average distractor length (measured) |
| 873 | FACT: answer says pre-push runs after refs are updated — it runs before anything is transferred |
| 874 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / purely historical / always fails) make the answer guessable |
| 884 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / purely historical / always fails) make the answer guessable |
| 886 | LEN: correct option is 1.75x the average distractor length (measured) |
| 2214 | DUP: of 663 |
| 2217 | DUP: of 725 |
| 2218 | DUP: of 5298 |
| 2219 | DUP: of 717 |
| 2220 | DUP: of 741 |
| 2222 | DUP: of 724 |
| 2224 | DUP: of 737 |
| 2225 | LEN: correct option is 1.80x the average distractor length (measured) |
| 2226 | DUP: of 742 |
| 2227 | DUP: of 740 |
| 2228 | DUP: of 747 |
| 2229 | DUP: of 750 |
| 2231 | LEN: correct option is 1.62x the average distractor length (measured) |
| 2232 | DUP: of 787 |
| 2233 | DUP: of 702 |
| 2234 | LEN: correct option is 1.42x the average distractor length (measured) |
| 2236 | DUP: of 759 |
| 2237 | DUP: of 5189 |
| 2238 | DUP: of 751 |
| 2241 | DUP: of 848 |
| 2242 | DUP: of 856 |
| 2243 | DUP: of 721 |
| 2244 | DUP: of 5146 |
| 2249 | DUP: of 705 |
| 2250 | DUP: of 811 |
| 2256 | DUP: of 2252 |
| 2261 | DUP: of 750 |
| 2263 | DUP: of 847 |
| 2264 | LEN: correct option is 1.54x the average distractor length (measured) |
| 2265 | DUP: of 831 |
| 2267 | DUP: of 867 |
| 2268 | DUP: of 5107 |
| 3292 | DUP: of 760 |
| 3293 | DUP: of 5176 |
| 3294 | LEN: correct option is 1.41x the average distractor length (measured) |
| 3295 | DUP: of 847 |
| 3427 | DUP: of 748 |
| 5097 | LEN: correct option is 1.58x the average distractor length (measured) |
| 5106 | LEN: correct option is 1.75x the average distractor length (measured) |
| 5109 | DUP: of 880 |
| 5116 | LEN: correct option is 1.55x the average distractor length (measured) |
| 5117 | LEN: correct option is 1.47x the average distractor length (measured) |
| 5120 | LEN: correct option is 1.42x the average distractor length (measured) |
| 5122 | LEN: correct option is 1.46x the average distractor length (measured) |
| 5123 | LEN: correct option is 1.75x the average distractor length (measured) |
| 5127 | DUP: of 803 |
| 5128 | LEN: correct option is 1.64x the average distractor length (measured) |
| 5129 | LEN: correct option is 1.50x the average distractor length (measured) |
| 5133 | LEN: correct option is 1.62x the average distractor length (measured) |
| 5134 | LEN: correct option is 1.61x the average distractor length (measured) |
| 5135 | DUP: of 825 |
| 5136 | LEN: correct option is 1.67x the average distractor length (measured) |
| 5137 | DUP: of 5132 |
| 5141 | LEN: correct option is 1.70x the average distractor length (measured) |
| 5142 | LEN: correct option is 1.75x the average distractor length (measured) |
| 5143 | DUP: of 735 |
| 5144 | LEN: correct option is 1.77x the average distractor length (measured) |
| 5147 | LEN: correct option is 1.45x the average distractor length (measured) |
| 5149 | LEN: correct option is 1.57x the average distractor length (measured) |
| 5153 | LEN: correct option is 1.61x the average distractor length (measured) |
| 5155 | LEN: correct option is 1.48x the average distractor length (measured) |
| 5157 | LEN: correct option is 1.86x the average distractor length (measured) |
| 5158 | LEN: correct option is 1.75x the average distractor length (measured) |
| 5162 | LEN: correct option is 1.42x the average distractor length (measured) |
| 5164 | FACT: answer contradicts the premise — question says no other clone/backup exists, answer is to fetch from another clone |
| 5168 | LEN: correct option is 1.78x the average distractor length (measured) |
| 5169 | LEN: correct option is 1.42x the average distractor length (measured) |
| 5170 | DUP: of 2255 |
| 5171 | LEN: correct option is 1.55x the average distractor length (measured) |
| 5172 | LEN: correct option is 1.65x the average distractor length (measured) |
| 5173 | LEN: correct option is 1.64x the average distractor length (measured) |
| 5175 | LEN: correct option is 1.41x the average distractor length (measured) |
| 5178 | LEN: correct option is 1.67x the average distractor length (measured) |
| 5181 | DUP: of 2252 |
| 5182 | LEN: correct option is 1.50x the average distractor length (measured) |
| 5183 | LEN: correct option is 1.75x the average distractor length (measured) |
| 5184 | LEN: correct option is 1.60x the average distractor length (measured) |
| 5185 | LEN: correct option is 1.56x the average distractor length (measured) |
| 5188 | LEN: correct option is 1.59x the average distractor length (measured) |
| 5190 | LEN: correct option is 1.77x the average distractor length (measured) |
| 5192 | LEN: correct option is 1.50x the average distractor length (measured) |
| 5193 | LEN: correct option is 1.75x the average distractor length (measured) |
| 5196 | LEN: correct option is 1.69x the average distractor length (measured) |
| 5197 | LEN: correct option is 1.48x the average distractor length (measured) |
| 5198 | LEN: correct option is 1.68x the average distractor length (measured) |
| 5200 | LEN: correct option is 1.57x the average distractor length (measured) |
| 5201 | LEN: correct option is 1.62x the average distractor length (measured) |
| 5202 | LEN: correct option is 1.75x the average distractor length (measured) |
| 5205 | LEN: correct option is 1.53x the average distractor length (measured) |
| 5206 | LEN: correct option is 1.59x the average distractor length (measured) |
| 5208 | LEN: correct option is 1.52x the average distractor length (measured) |
| 5209 | LEN: correct option is 1.70x the average distractor length (measured) |
| 5210 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / purely historical / always fails) make the answer guessable |
| 5211 | DUP: of 848 |
| 5213 | LEN: correct option is 1.54x the average distractor length (measured) |
| 5215 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / purely historical / always fails) make the answer guessable |
| 5216 | DUP: of 5292 |
| 5218 | LEN: correct option is 1.53x the average distractor length (measured) |
| 5219 | DUP: of 714 |
| 5222 | LEN: correct option is 1.75x the average distractor length (measured) |
| 5225 | LEN: correct option is 1.59x the average distractor length (measured) |
| 5226 | LEN: correct option is 1.77x the average distractor length (measured) |
| 5227 | LEN: correct option is 1.44x the average distractor length (measured) |
| 5228 | LEN: correct option is 1.69x the average distractor length (measured) |
| 5230 | LEN: correct option is 1.71x the average distractor length (measured) |
| 5238 | LEN: correct option is 1.60x the average distractor length (measured) |
| 5244 | DUP: of 5194 |
| 5247 | LEN: correct option is 1.58x the average distractor length (measured) |
| 5249 | DUP: of 755 |
| 5251 | DUP: of 825 |
| 5262 | LEN: correct option is 1.52x the average distractor length (measured) |
| 5268 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / purely historical / always fails) make the answer guessable |
| 5275 | DUP: of 5261 |
| 5278 | DUP: of 5265 |
| 5280 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / purely historical / always fails) make the answer guessable |
| 5283 | LEN: correct option is 1.57x the average distractor length (measured) |
| 5287 | LEN: correct option is 1.69x the average distractor length (measured) |
| 5289 | DUP: of 741 |
| 5291 | LEN: correct option is 1.53x the average distractor length (measured) |
| 5294 | LEN: correct option is 1.50x the average distractor length (measured) |
| 5296 | DUP: of 5179 |
| 5297 | DUP: of 784 |
| 5299 | LEN: correct option is 1.56x the average distractor length (measured) |
| 5300 | LEN: correct option is 1.45x the average distractor length (measured) |
| 5301 | DUP: of 5284 |
| 5303 | DUP: of 854 |
| 5304 | DUP: of 858 |
| 5305 | DUP: of 5338 |
| 5306 | DUP: of 5336 |
| 5308 | LEN: correct option is 1.67x the average distractor length (measured) |
| 5310 | LEN: correct option is 1.64x the average distractor length (measured) |
| 5311 | DUP: of 708 |
| 5312 | LEN: correct option is 1.63x the average distractor length (measured) |
| 5313 | LEN: correct option is 1.44x the average distractor length (measured) |
| 5316 | LEN: correct option is 1.52x the average distractor length (measured) |
| 5318 | LEN: correct option is 1.53x the average distractor length (measured) |
| 5319 | LEN: correct option is 1.72x the average distractor length (measured) |
| 5320 | LEN: correct option is 1.74x the average distractor length (measured) |
| 5327 | LEN: correct option is 1.43x the average distractor length (measured) |
| 5328 | LEN: correct option is 1.49x the average distractor length (measured) |
| 5339 | LEN: correct option is 1.69x the average distractor length (measured) |
| 5345 | DUP: of 864 |
| 5348 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / purely historical / always fails) make the answer guessable |
| 5349 | LEN: correct option is 1.41x the average distractor length (measured) |
| 5353 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / purely historical / always fails) make the answer guessable |
| 5357 | LEN: correct option is 1.45x the average distractor length (measured) |
| 5363 | DUP: of 5139 |
| 5369 | ELIM: 2+ throwaway/absolute distractors (e.g. technically forbids / purely historical / always fails) make the answer guessable |
| 5370 | DUP: of 827 |
| 5371 | DUP: of 2252 |
| 5372 | LEN: correct option is 1.53x the average distractor length (measured) |
| 5374 | DUP: of 711 |
| 5375 | DUP: of 737 |
| 5376 | DUP: of 726 |
| 5377 | DUP: of 705 |
| 5380 | DUP: of 722 |
| 5381 | DUP: of 5292 |
| 5382 | DUP: of 727 |

## Angular (reviewed 2026-10-13, 273 held)

| Question ID | Issue |
|---|---|
| 488 | LEN: correct option is 1.66x the average distractor length (measured) |
| 507 | DUP: of 4780 |
| 510 | LEN: correct option is 1.59x the average distractor length (measured) |
| 511 | FACT: ambiguous — ng update @angular/cli (a distractor) is the documented update path |
| 519 | DUP: of 1831 |
| 521 | FACT: outdated — standalone is the default; components go in imports, not an NgModule declarations array |
| 525 | DUP: of 646 |
| 529 | DUP: of 520 |
| 534 | FACT: ambiguous — "never fires" and "treated as an attribute with no listener" are both defensible |
| 535 | DUP: of 520 |
| 540 | DUP: of 528 |
| 541 | FACT: misleading — property and event bindings can coexist separately; [(...)] is not the only way |
| 543 | DUP: of 6461 (already Active) |
| 547 | DUP: of 1836 |
| 550 | DUP: of 4627 |
| 552 | DUP: of 1829 |
| 554 | DUP: of 1830 |
| 555 | DUP: of 1831 |
| 556 | DUP: of 1833 |
| 557 | DUP: of 1832 |
| 559 | DUP: of 4667 |
| 565 | DUP: of 6409 (already Active) |
| 568 | DUP: of 1744 |
| 569 | DUP: of 1743 |
| 572 | DUP: of 1719 |
| 574 | DUP: of 1710 |
| 579 | DUP: of 5054 |
| 580 | FACT: outdated — modern guards are plain functions (CanActivateFn), not @Injectable classes |
| 583 | FACT: two correct answers — loadComponent (a distractor) also enables lazy loading |
| 584 | DUP: of 3396 |
| 586 | DUP: of 5059 |
| 590 | DUP: of 3394 |
| 592 | DUP: of 5053 |
| 593 | DUP: of 530 |
| 601 | DUP: of 4723 |
| 612 | LEN: correct option is 1.43x the average distractor length (measured) |
| 614 | DUP: of 1810 |
| 615 | DUP: of 4884 |
| 617 | DUP: of 4817 |
| 618 | LEN: correct option is 1.41x the average distractor length (measured) |
| 622 | DUP: of 4736 |
| 625 | DUP: of 1786 |
| 633 | DUP: of 1683 |
| 636 | DUP: of 4632 |
| 637 | DUP: of 1676 |
| 638 | DUP: of 4977 |
| 639 | DUP: of 1678 |
| 640 | DUP: of 1717 |
| 641 | DUP: of 1717 |
| 644 | LEN: correct option is 1.51x the average distractor length (measured) |
| 652 | DUP: of 1706 |
| 653 | DUP: of 1696 |
| 656 | DUP: of 1697 |
| 657 | DUP: of 6471 (already Active) |
| 660 | DUP: of 1703 |
| 661 | DUP: of 1699 |
| 662 | DUP: of 1702 |
| 1675 | LEN: correct option is 1.45x the average distractor length (measured) |
| 1689 | DUP: of 6423 (already Active) |
| 1690 | DUP: of 6441 (already Active) |
| 1691 | DUP: of 6434 (already Active) |
| 1693 | DUP: of 1671 |
| 1694 | LEN: correct option is 1.41x the average distractor length (measured) |
| 1698 | DUP: of 6471 (already Active) |
| 1701 | DUP: of 6475 (already Active) |
| 1704 | DUP: of 6477 (already Active) |
| 1705 | DUP: of 6472 (already Active) |
| 1713 | LEN: correct option is 1.43x the average distractor length (measured) |
| 1715 | DUP: of 6459 (already Active) |
| 1727 | DUP: of 1723 |
| 1739 | DUP: of 6465 (already Active) |
| 1752 | DUP: of 6477 (already Active) |
| 1754 | DUP: of 1873 |
| 1755 | DUP: of 1717 |
| 1757 | DUP: of 5053 |
| 1759 | FACT: outdated — differential loading was removed in Angular 12 |
| 1767 | LEN: correct option is 1.75x the average distractor length (measured) |
| 1771 | FACT: outdated name — Angular Universal is now @angular/ssr |
| 1799 | DUP: of 4956 |
| 1800 | DUP: of 6424 (already Active) |
| 1802 | DUP: of 6422 (already Active) |
| 1803 | DUP: of 6423 (already Active) |
| 1819 | DUP: of 523 |
| 1824 | DUP: of 4638 |
| 1826 | FACT: outdated — Angular 18 added ng-content fallback content |
| 1850 | DUP: of 1840 |
| 1853 | LEN: correct option is 1.67x the average distractor length (measured) |
| 1861 | FACT: outdated — standalone apps use provideAnimations(); importing BrowserAnimationsModule is not required |
| 1880 | FACT: the answer says ngsw-worker.js changes each build — it is ngsw.json that changes |
| 3262 | FACT: outdated — Angular 18+ projects use /public for static assets |
| 3263 | FACT: outdated — ng build --prod was removed; production is the default configuration |
| 3265 | DUP: of 1703 |
| 3267 | LEN: correct option is 1.52x the average distractor length (measured) |
| 3275 | DUP: of 564 |
| 3279 | LEN: correct option is 1.46x the average distractor length (measured) |
| 3280 | DUP: of 1687 |
| 3282 | FACT: outdated — standalone apps use provideHttpClient(); HttpClientModule is not required |
| 3283 | DUP: of 619 |
| 3284 | DUP: of 1717 |
| 3286 | DUP: of 4822 |
| 3288 | DUP: of 1674 |
| 3289 | FACT: ngOnInit runs before the first render, not "after the component's first display" |
| 3297 | DUP: of 562 |
| 3298 | DUP: of 3290 |
| 3354 | DUP: of 6412 (already Active) |
| 3355 | DUP: of 6415 (already Active) |
| 3356 | DUP: of 5054 |
| 3357 | DUP: of 4632 |
| 3359 | LEN: correct option is 1.41x the average distractor length (measured) |
| 3360 | DUP: of 6439 (already Active) |
| 3361 | FACT: CanLoad is deprecated in favour of canMatch and the question does not say so |
| 3364 | DUP: of 1717 |
| 3366 | FACT: answer lists mutate() on WritableSignal — removed in Angular 17 |
| 3368 | DUP: of 4811 |
| 3369 | DUP: of 6465 (already Active) |
| 3374 | LEN: correct option is 1.41x the average distractor length (measured) |
| 3385 | DUP: of 1791 |
| 3386 | DUP: of 4855 |
| 3387 | DUP: of 1670 |
| 3389 | DUP: of 4943 |
| 3393 | DUP: of 1820 |
| 3404 | FACT: ambiguous — @angular/pwa (a distractor) is the usual ng add entry point |
| 4605 | DUP: of 4772 |
| 4607 | DUP: of 4762 |
| 4611 | LEN: correct option is 1.43x the average distractor length (measured) |
| 4613 | LEN: correct option is 1.63x the average distractor length (measured) |
| 4621 | DUP: of 4827 |
| 4623 | LEN: correct option is 1.45x the average distractor length (measured) |
| 4626 | DUP: of 6477 (already Active) |
| 4631 | DUP: of 1717 |
| 4633 | DUP: of 5010 |
| 4634 | DUP: of 3290 |
| 4635 | DUP: of 1696 |
| 4636 | DUP: of 4744 |
| 4637 | LEN: correct option is 1.73x the average distractor length (measured) |
| 4639 | DUP: of 1820 |
| 4641 | DUP: of 553 |
| 4643 | DUP: of 1798 |
| 4644 | LEN: correct option is 1.42x the average distractor length (measured) |
| 4648 | DUP: of 4733 |
| 4651 | DUP: of 1722 |
| 4653 | DUP: of 1714 |
| 4655 | DUP: of 1725 |
| 4657 | DUP: of 1726 |
| 4663 | LEN: correct option is 1.66x the average distractor length (measured) |
| 4664 | LEN: correct option is 1.40x the average distractor length (measured) |
| 4666 | LEN: correct option is 1.41x the average distractor length (measured) |
| 4668 | LEN: correct option is 1.48x the average distractor length (measured) |
| 4670 | LEN: correct option is 1.65x the average distractor length (measured) |
| 4673 | DUP: of 1887 |
| 4675 | DUP: of 1886 |
| 4677 | DUP: of 1890 |
| 4682 | LEN: correct option is 1.41x the average distractor length (measured) |
| 4683 | LEN: correct option is 1.41x the average distractor length (measured) |
| 4685 | DUP: of 1773 |
| 4695 | FACT: providedIn: 'any' is deprecated (v15) and the question does not say so |
| 4699 | DUP: of 1785 |
| 4700 | DUP: of 1722 |
| 4701 | LEN: correct option is 1.49x the average distractor length (measured) |
| 4702 | DUP: of 6425 (already Active) |
| 4703 | DUP: of 4960 |
| 4704 | FACT: APP_INITIALIZER is deprecated (v19) in favour of provideAppInitializer() |
| 4705 | LEN: correct option is 1.41x the average distractor length (measured) |
| 4706 | DUP: of 1746 |
| 4707 | DUP: of 1744 |
| 4714 | DUP: of 1847 |
| 4716 | DUP: of 1840 |
| 4720 | DUP: of 4992 |
| 4722 | DUP: of 4994 |
| 4725 | LEN: correct option is 1.56x the average distractor length (measured) |
| 4727 | DUP: of 6470 (already Active) |
| 4728 | DUP: of 6471 (already Active) |
| 4729 | DUP: of 6471 (already Active) |
| 4730 | DUP: of 6476 (already Active) |
| 4731 | DUP: of 518 |
| 4735 | DUP: of 4824 |
| 4737 | LEN: correct option is 1.42x the average distractor length (measured) |
| 4739 | DUP: of 6469 (already Active) |
| 4750 | DUP: of 4811 |
| 4766 | DUP: of 1670 |
| 4768 | DUP: of 513 |
| 4770 | DUP: of 486 (already Active) |
| 4776 | FACT: outdated name — Angular Universal became @angular/ssr in v17 |
| 4779 | DUP: of 4775 |
| 4782 | DUP: of 1662 |
| 4784 | LEN: correct option is 1.56x the average distractor length (measured) |
| 4787 | DUP: of 4629 |
| 4791 | DUP: of 539 |
| 4794 | DUP: of 1831 |
| 4795 | DUP: of 533 |
| 4799 | DUP: of 539 |
| 4801 | DUP: of 6461 (already Active) |
| 4802 | DUP: of 4797 |
| 4803 | DUP: of 655 |
| 4808 | DUP: of 6475 (already Active) |
| 4809 | DUP: of 6471 (already Active) |
| 4810 | DUP: of 6472 (already Active) |
| 4812 | DUP: of 6473 (already Active) |
| 4813 | DUP: of 6469 (already Active) |
| 4814 | DUP: of 1702 |
| 4815 | DUP: of 1810 |
| 4816 | DUP: of 1812 |
| 4818 | LEN: correct option is 1.47x the average distractor length (measured) |
| 4826 | DUP: of 1677 |
| 4831 | DUP: of 1692 |
| 4832 | DUP: of 1687 |
| 4836 | DUP: of 1825 |
| 4841 | DUP: of 1794 |
| 4842 | DUP: of 1871 |
| 4843 | DUP: of 1793 |
| 4847 | DUP: of 4863 |
| 4849 | DUP: of 1836 |
| 4850 | DUP: of 1836 |
| 4851 | DUP: of 4667 |
| 4852 | LEN: correct option is 2.05x the average distractor length (measured) |
| 4857 | DUP: of 4658 |
| 4858 | DUP: of 1828 |
| 4875 | DUP: of 1815 |
| 4886 | DUP: of 6428 (already Active) |
| 4887 | DUP: of 4660 |
| 4888 | LEN: correct option is 1.71x the average distractor length (measured) |
| 4905 | DUP: of 4822 |
| 4912 | DUP: of 1758 |
| 4913 | LEN: correct option is 1.61x the average distractor length (measured) |
| 4914 | LEN: correct option is 1.51x the average distractor length (measured) |
| 4915 | LEN: correct option is 1.42x the average distractor length (measured) |
| 4916 | LEN: correct option is 1.47x the average distractor length (measured) |
| 4918 | LEN: correct option is 1.42x the average distractor length (measured) |
| 4921 | DUP: of 1872 |
| 4928 | LEN: correct option is 1.42x the average distractor length (measured) |
| 4935 | DUP: of 6448 (already Active) |
| 4936 | DUP: of 5052 |
| 4937 | DUP: of 5058 |
| 4938 | DUP: of 1857 |
| 4939 | DUP: of 6449 (already Active) |
| 4940 | DUP: of 6445 (already Active) |
| 4941 | DUP: of 1859 |
| 4942 | DUP: of 6453 (already Active) |
| 4949 | DUP: of 1856 |
| 4950 | LEN: correct option is 1.40x the average distractor length (measured) |
| 4955 | LEN: correct option is 1.40x the average distractor length (measured) |
| 4957 | LEN: correct option is 1.57x the average distractor length (measured) |
| 4961 | LEN: correct option is 1.51x the average distractor length (measured) |
| 4965 | DUP: of 1717 |
| 4968 | DUP: of 1677 |
| 4981 | DUP: of 6437 (already Active) |
| 4982 | DUP: of 6433 (already Active) |
| 4983 | DUP: of 1756 |
| 4984 | DUP: of 6439 (already Active) |
| 4985 | LEN: correct option is 1.44x the average distractor length (measured) |
| 4988 | LEN: correct option is 1.42x the average distractor length (measured) |
| 4989 | DUP: of 1671 |
| 4997 | LEN: correct option is 1.61x the average distractor length (measured) |
| 4999 | FACT: two correct answers — form.value.address.city (a distractor) also reads the value |
| 5008 | LEN: correct option is 1.46x the average distractor length (measured) |
| 5015 | DUP: of 6461 (already Active) |
| 5016 | DUP: of 6472 (already Active) |
| 5019 | DUP: of 6477 (already Active) |
| 5020 | DUP: of 6475 (already Active) |
| 5023 | DUP: of 6469 (already Active) |
| 5024 | DUP: of 4804 |
| 5026 | DUP: of 6470 (already Active) |
| 5029 | DUP: of 6473 (already Active) |
| 5030 | DUP: of 4811 |
| 5036 | DUP: of 1887 |
| 5038 | DUP: of 1677 |
| 5043 | DUP: of 1681 |
| 5047 | DUP: of 4978 |
| 5048 | DUP: of 1887 |
| 5060 | LEN: correct option is 1.58x the average distractor length (measured) |
| 5061 | DUP: of 6445 (already Active) |
| 5074 | DUP: of 3381 |
| 5084 | LEN: correct option is 1.51x the average distractor length (measured) |


## Fixed & approved 2026-10-13 (49)

947, 959, 963, 966, 967, 974, 975, 977, 979, 986, 991, 992, 994, 997, 999, 1002, 1010, 1011, 1012, 1013, 1015, 1018, 1020, 1021, 1022, 1023, 1024, 1026, 1027, 1028, 1039, 1051, 1053, 1054, 1068, 1069, 1076, 1078, 1081, 1082, 1090, 1529, 1538, 2077, 2083, 2118, 2373, 3314, 2393


## Fixed & approved 2026-10-13 (41)

1092, 1093, 1098, 1100, 1102, 1104, 1119, 1122, 1123, 1126, 1127, 1129, 1130, 1140, 1144, 1148, 1150, 1157, 1160, 1324, 1329, 1330, 1336, 1337, 1341, 2215, 2216, 2964, 2966, 2968, 2969, 2970, 3318, 5232, 5233, 5234, 5235, 5236, 5307, 5379, 1099


## Fixed & approved 2026-10-13 (62)

2853, 2854, 2858, 2860, 2861, 2863, 2913, 2914, 2915, 2916, 2918, 2920, 2921, 2923, 2924, 2926, 2927, 2928, 2929, 2931, 2932, 2933, 2936, 2937, 2938, 2939, 2941, 2942, 2944, 2945, 2948, 2949, 2950, 2972, 2973, 3018, 3019, 3020, 3024, 3525, 3526, 3541, 3543, 3544, 3545, 3565, 3568, 4272, 4277, 4278, 4281, 4283, 4285, 4286, 4274, 4275, 4279, 4282, 4347, 4348, 4349, 4350


## Fixed & approved 2026-10-13 (65)

2472, 2485, 2606, 2609, 2610, 2612, 2613, 2614, 2615, 2616, 2618, 2620, 2621, 2622, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634, 2635, 2636, 2637, 2638, 2639, 2640, 2641, 3086, 3089, 4358, 4359, 4360, 4361, 4381, 4384, 4386, 4387, 4388, 4389, 4390, 4391, 4395, 4397, 4398, 4399, 4400, 4403, 4404, 4406, 4353, 4354, 4355, 4377, 4378, 4379, 4380, 4385, 4392, 4394, 4396


## Fixed & approved 2026-10-13 (51)

3091, 3092, 3095, 3124, 3125, 3126, 3127, 3128, 3129, 3130, 3131, 3581, 3592, 3593, 4057, 4058, 4059, 4061, 4062, 4063, 4064, 4065, 4067, 4068, 4069, 4070, 4071, 4072, 4073, 4075, 4076, 4077, 4078, 4079, 4080, 4081, 4082, 4083, 4100, 4101, 4103, 4105, 4106, 4107, 4108, 4110, 4111, 4112, 4113, 4115, 4116


## Fixed & approved 2026-10-13 (51)

4120, 4121, 4122, 4123, 4124, 4126, 4440, 4441, 4444, 4445, 4556, 4557, 4558, 4559, 4560, 4561, 4562, 4563, 4564, 4565, 4567, 4580, 4581, 4582, 4583, 4585, 4586, 4587, 4588, 4589, 4591, 5502, 5506, 5507, 5508, 5510, 5520, 5523, 5526, 5527, 5528, 5530, 5532, 5533, 5534, 5535, 5547, 5548, 5550, 5551, 5552


## Fixed & approved 2026-10-13 (1)

2402
