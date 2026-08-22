# eigenlex — agent notes

pnpm + turbo monorepo with one app. `apps/web` is the Next.js site and the hosted API.
It is a vocabulary learning tool. Every word gets a frequency band and a CEFR band, so a
learner can see where a word sits and browse the vocabulary in order.

## Source and target

Two languages. They are `source` and `target` everywhere — symbols, URL, storage keys,
our own API params — and in that order. `lang`, `sl` and `tl` name neither.

| | Source | Target |
| --- | --- | --- |
| What it is | The language being studied | What a word is translated into |
| Drives | The bands, the word cloud, the suggestions | The word card only |
| Type | `SourceLang`, one of the six indexed | `TargetLang`, any code Google takes |
| Seeded from | The client's country | The browser language |
| Stored under | `eigenlex:source` | `eigenlex:target` |
| URL and API param | `source` | `target` |

`isSourceLang` asks whether a language is one of the six, whichever role it is in. The
target passes it only when we index it too, which is what CEFR levels on a translation
and the swap button need.

Older spellings are still read, never written: `eigenlex:lang` via `TARGET_KEY_ALT`, and
the two URL params noted below.

`gtxUrl` is the exception that stays: `sl`/`tl` there are Google's own param names, not
ours. `source`/`target` map onto them at that one call.

`source` never means the frequency corpus. That is `corpus`: `SourceLangMeta.corpus`,
`CorpusCredit`.

## Where things live

| Path | Holds |
| --- | --- |
| `src/lib/languages.ts` | `SOURCE_LANGS`, `SourceLang`, `TargetLang`, `SOURCE_LANG_META` |
| `src/lib/bands.ts` | Server registry, `getWord`, all word lookups |
| `src/lib/geo.ts` | Country table, `sourceLang`, `targetLang` |
| `src/lib/scenario.ts` | URL encode / decode, `pageTitle` |
| `src/lib/translate.ts` | Google Translate fetching and parsing, and the relay gate |
| `next.config.mjs` | Response headers, the CSP, `distDir` |
| `scripts/build-bands.ts` | Artifact build, the `LANGS` table |
| `data/word-bands.<code>.json` | Committed artifact, one per language |

Paths are relative to `apps/web/`.

## URL state (deeplinks)

`Workspace` mirrors the scenario into the query string so it can be shared as a link, and
writes it back with `replaceState`. It owns all five values: the target sits there rather
than in `WordCard`, and `band` rather than in `BandBrowser`, so both ride in the URL.
`Workspace` is client-only (`WorkspaceLazy`, `ssr:false`), so this is all client-side.

`?source=<source>&word=<word>&target=<target>&view=freq|cefr&band=<key>`

| Param | Holds | Notes |
| --- | --- | --- |
| `source` | Source language | One of the six. `lang` is read too, never written |
| `word` | The looked-up word | |
| `target` | Target language | Any language, not just the six. `tl` is read too, never written |
| `view` | `freq` or `cefr` | `cefr` is the default, and sits first in the toggle |
| `band` | Pinned band tab | Set only when it differs from the word's own band, which the word and view already imply |

On mount the URL wins over the stored pick, which wins over the seed below.

The tab title carries the word too: `eigenlex: <word>`, in the corpus's display casing
(`eigenlex: Wasser`). `generateMetadata` renders it from `?word=` server-side, so a shared
link names its word in the tab and in link previews before any client JS runs; `Workspace`
recases it to the corpus's spelling once the lookup lands. Both call `pageTitle`, which caps
the word, since a deeplink's has not been looked up.

## Which languages a first-time visitor lands on

The client's country seeds the source. The browser seeds the target.

| Step | Rule | Example |
| --- | --- | --- |
| Read the country | Vercel sets `x-vercel-ip-country`. `page.tsx` reads it and passes it to `Workspace` as a prop | |
| Pick the source | `sourceLang` maps the country to one of the six, en/es/fr/de/pt/it | DE → study German |
| Multilingual country | `CH`, `BE`, `CA` and `LU` list several. The browser locale picks; the first listed is the fallback | CH + fr browser → French |
| Unlisted country | English. `Exclude<SourceLang, "en">` on the table enforces that English has no entries | JP + ja browser → en → ja |
| Pick the target | The browser language | ES + en browser → es → en |
| Same-language clash | `targetLang` returns English instead, or Spanish when English is the source | ES + es browser → es → en; US + en browser → en → es |
| Explicit pick | Never overridden. The clash rule applies only to the derived value | A deeplink or stored pick is used as given |
| Live switch | `chooseSource` moves the target to the language just left when you pick the one it was translating into | en → es, pick Spanish → es → en |

Reading the header server-side is free, because the root layout already reads cookies for
the theme and the route is dynamic anyway. An `/api/geo` round trip would answer after the
first lookup had already gone out under the wrong language. Off Vercel the header is
absent and English is the fallback.

## Build inputs

All inputs are gitignored and live in `apps/web/data/`. The build reads them and writes
one committed artifact per language, `word-bands.<code>.json`: a pure-frequency,
lemma-merged word ranking plus the band definitions.

| Input | Languages | Source | Notes |
| --- | --- | --- | --- |
| `subtlex.csv` | en | SUBTLEX-US | Curated. Its column is per-million, not a raw count |
| `freq-<code>.txt` | es fr de pt it | hermitdave/FrequencyWords, OpenSubtitles 2018 | Take `<code>_full.txt`, not `<code>_50k.txt` |
| `lemma-<code>.txt` | all | michmech/lemmatization-lists | Also the dictionary the filters below consult |
| `casing-<code>.txt` | all | Leipzig Corpora *sentences* file | e.g. `deu_news_2022_1M` from `downloads.wortschatz-leipzig.de`. Named by `casingFile` |
| `names.txt` | shared | michmech-style plain list | Personal-name gazetteer |

Take `_full.txt` because the cut belongs in code, where it is version-controlled, not in
whichever file someone happened to download.

| Command | Does |
| --- | --- |
| `pnpm --filter @eigenlex/web build:bands` | Rebuild every language |
| `pnpm --filter @eigenlex/web build:bands <code>` | Rebuild one |

To add a language: drop its inputs in `data/`, add a `LANGS` entry in the build script, add
it to `SOURCE_LANG_META`, and add the registry import in `bands.ts`.

## Build filters

| Filter | Knob | Rule | Effect |
| --- | --- | --- | --- |
| Frequency floor | `minCount` | Drop words under 10 raw occurrences | Below that the OpenSubtitles tail is mostly hapax noise. Stated in occurrences, not rank, so it means the same in every language. Omitted for English, whose column is per-million |
| Clitics | `clitics`, `mesoEndings`, `cliticExceptions` | Strip pronouns hyphenated onto verbs and merge the frequency back into the verb | 24% of the pt list and 12% of fr. pt `lembrar` 333 → 177, fr `excuser` 761 → 297 |
| Own-entry | — | A surface word that heads its own lemma entry keeps it, instead of merging into whichever lemma claims it | The lists are lemma-sorted, so plain first-wins hands a shared form to the alphabetically-first claimant. That deletes common words (it `governo` into `governare`, fr `tu` into `il`; 100–160 of the top 1,000 per language) and floats the absorber into the beginner bands |
| Dictionary gate | `dictGate` | Past rank 25,000, keep a word only if the lemma list vouches for it | Drops about 80 junk words per real one. Lands the five subtitle languages at 33–40k words each, near where English's SUBTLEX ends on its own |
| Personal names | `determiners`, `NAME_RANK_FLOOR` | Drop a word meeting all four tests below | See the per-language counts below |
| Display casing | `casingFile` | Measure each word's mid-sentence capitalization and store that casing | Sentence-initial position is ignored, since it capitalizes everything |
| Case-homographs | — | Keep both casings of one entry under `variants` | `"essen" -> ["Essen","essen"]`, most frequent first. `getWord` returns them as `forms` |

### Clitics

pt and fr hyphenate pronouns onto verbs, so every verb × pronoun pair spells its own
surface form: `deixa-me`, `fazê-lo`, `donne-moi`, `a-t-il`. None of them is vocabulary.

| Detail | Rule |
| --- | --- |
| Mesoclisis | pt puts the pronoun inside the verb (`contar-te-ia`), so `mesoEndings` also strips a trailing future or conditional ending |
| Stem repair | `STEM_REPAIR` restores the infinitive `-r` that pt drops before `-lo`/`-la` (`fazer` + `o` → `fazê-lo`) |
| Unknown stem | Dropped, not kept: 346 forms in pt, 400 in fr |
| Whole segments | Segments are matched whole. This is the load-bearing detail: it keeps `guarda-chuva` (ends in "chuva", not "a") and `arc-en-ciel` (ends in "ciel", not "en") |
| Why whole | No lemma list holds a single hyphenated entry, so the dictionary cannot referee it, and rank cannot either — `peut-être` and `rendez-vous` sit among `avez-vous` and `dis-moi` |
| Not clitics | `là` and `ci`, since `celui-là` and `là-bas` are vocabulary. `cliticExceptions` covers the rest (`rendez-vous`, `garde-à-vous`) |

### The tail and the dictionary gate

The subtitle tail is not rare vocabulary. Past rank 25k only about 14% of it is in the
language's own lemma list.

| Junk kind | Examples |
| --- | --- |
| Character names | `ryûji` |
| Untranslated English | `truck`, `workshop` |
| Misspellings | `gerer` for "gérer", `règler` |
| OCR debris | `lslam`, `arrãªtez` |
| Noise | `rrr`, `shhhh` |

Neither frequency nor the name gazetteer can tell that from a rare word; the gazetteer has
no entry for `ryûji` or `rrr`. The dictionary can, which is what `dictGate` uses.

| Known cost | Detail |
| --- | --- |
| Not used for English | Its source is curated and its lemma list is the smallest by far, 808KB against French's 4.9MB. Gating it would cut 11k mostly-real words |
| Real words lost | 1–3% of what the gate drops, 900–2,700 per language |
| Where they cluster | Productive morphology the lists do not headword: `-mente`/`-ment` adverbs, `-ità`/`-ité` nouns, superlatives — `logicamente`, `unanimità`, `rigoureusement`, `Geborgenheit` |
| Spot-check | Italian's list has no `entropia`, so the build's spot-check for it reports `—` |
| 12k–25k untouched | The gate starts at 25k, and 12k–25k is still about half names and English: `Nami`, `Calcutta`, `because`, `corn`, `truck` all sit near rank 13,000 |

### Personal names

Names like "Ahmed", "Moretti" and "Kendra" crowd subtitle corpora without being
vocabulary. A word is dropped only when all four tests agree.

| Test | Spares |
| --- | --- |
| In the `names.txt` gazetteer | |
| Absent from the language's lemma list | Surnames that are also words: "Koch", "Berg" |
| Capitalized mid-sentence | Lowercase function words that collide with short names: "in", "von", "man" |
| Rarely preceded by a determiner | Ordinary nouns michmech lacks, which surname lists are full of: "Kuss", "Fass", "Geduld", "Sheriff" |

The top `NAME_RANK_FLOOR` (1,000) is exempt, because a hit there is likelier a loanword
noun than a name. A language without a `casingFile` is skipped, since the gazetteer alone
would eat "que", "por", "he" and "she". Words dropped per language:

| en | es | fr | de | pt | it |
| --- | --- | --- | --- | --- | --- |
| −1,126 | −2,495 | −2,790 | −2,185 | −1,737 | −2,316 |

Known wart: a few country names sit in the surname list and go with them — `england`,
`france`, `africa`, `canada`, `india` (en), `francia` and `italia` (es), `italia` and
`inghilterra` (it). The determiner test rescues the rest, so fr and pt lose none, but
English never articles a country ("the France" is ungrammatical) so it cannot fire there.
The result looks arbitrary: `germany` stays, `france` goes.

### Display casing

Measuring mid-sentence capitalization needs no per-language rules and gets the right
answer in every language.

| Outcome | Examples |
| --- | --- |
| Capitalized | German nouns and names: `Wasser`, `Berlin`. Proper nouns anywhere: `Roma`, `Lisboa`, `London`, `Dios` |
| Lowercase | Verbs and pronouns. es `lunes`, `enero`, `español`; it `lunedì`, `gennaio` |

The lemma list is the authoritative fallback for the rare tail. The stored `ranked` words
carry display casing, and every lookup in `bands.ts` keys on lowercase, so search and
typeahead stay case-insensitive. A language without a `casingFile` stays lowercase; all
six have one.

### CEFR bands

Bands are frequency-rank thresholds calibrated against CEFR-J. They are English-derived
and reused for every language. No graph and no external dictionary is involved.

| Band | Top rank |
| --- | --- |
| A1 | 1,000 |
| A2 | 3,000 |
| B1 | 6,000 |
| B2 | 12,000 |
| C1 | 25,000 |
| C2 | 50,000 |
| `rare` ("Rare · beyond C2") | none — `max: null` |

Tops roughly double, so C2 ends at 50k instead of running open-ended to the end of the
list. `rare` is a backstop, not an expected band: with the gate no language reaches 50k, so
every artifact ends at C2. It stays because `getWord` asserts that a band exists at every
rank, so the last band must be open-ended — keep `max: null` on whichever band is last.
Both band lists are filtered per language to bands that hold words, so an unreached `rare`
never renders as an empty tab.

Comparing one language against another through the bands is the weaker reading. The six
agree almost everywhere, and where they disagree it is usually a word within 20% of a
threshold: en "green" at rank 909 against es 1,170 straddles the A1/A2 line at 1,000. The
rank in the tooltip is what tells that apart from a real difference, like it "parete" at
2,702.

## Translating a word

Every word card fetches `dict=1`, which adds Google's `dt=bd` dictionary block.

| Rule | Why |
| --- | --- |
| Translate from the dictionary terms, not the plain translation | The plain translation of a lone word is sometimes just wrong: "acqua" → "waterfall" |
| Keep the block's part-of-speech groups (`parseSenseGroups`) | A word with more than one reading gets a labelled line each: it "solo" adj. "only" / adv. "just"; es "nada" pron./noun/adv. A single reading stays one line. `flattenSenses` collapses them for the per-casing lines |
| One line per casing of a case-homograph | `dt=bd` is casing-sensitive, unlike the plain translation: "Essen" → food/meal, "essen" → eat/dine. Lines collapse to one when the meanings do not actually differ |
| Flag a homograph only when both casings are used mid-sentence and the lemma list has a capitalized spelling | Filters surnames ("Klein") and quote-capitalized adjectives |
| Cut senses relative to their group's best (`MIN_RELATIVE_SCORE`), not at a fixed rank | Senses trail off into noise: en→de "dog" runs Hund .51, Rüde .0018, then "Schreckschraube" (battle-axe) at 3e-6 |
| Treat an unscored entry as no-confidence | It goes the same way |

### What the route agrees to relay

`/api/translate/[word]` is the one route that answers by calling someone else. Whatever
reaches it is forwarded to Google on our quota, so it checks that the request is one the
card could have made before it makes the call. Without that it is a general-purpose
translation API for anyone who finds it, and Google rate-limits by calling IP — which is
our egress IP, so an abuser's flood lands on real lookups.

| Gate | Rule | Where the bound comes from |
| --- | --- | --- |
| `isSingleWord` | One token, no whitespace, at most 64 characters | The longest word in the six artifacts is 28, `antidisestablishmentarianism`, and none holds whitespace. Hyphens and apostrophes are ordinary vocabulary — fr alone has 1,145 hyphenated headwords, `arc-en-ciel`, `quelqu'un` — so only whitespace splits a word |
| `isSourceLang` | The source is one of the six | It is the language being studied, so it always is |
| `isLangCode` | The target is shaped like `baseLang` output, 2–3 lowercase letters | The target is any language Google takes, not one of the six, so shape is all there is to check. It still separates `ja` and `haw` from a string to hand upstream |

Every refusal answers 400, not the 404 the other routes use for an unknown language: those
looked and there is no such word list, while these gate what this one will pass on. The
tests assert that Google is never called — the status is not the point.

Both predicates live in `lib/translate.ts`, next to `gtxUrl`, so the gate sits with the
call it guards.

### The rate limit in front of it

The gate is the second line of defence. The first is a Vercel firewall rule, which lives
in the dashboard and nowhere in this repo — nothing here would tell you it exists.

| Setting | Value |
| --- | --- |
| Where | `https://vercel.com/eigenlex/eigenlex-web/settings/firewall` |
| Matches | Path starts with `/api/translate` |
| Keyed by | IP |
| Limit | 100 requests per 60s, then deny |

A blocked request answers **403, not 429**: Vercel's rate-limit action is a deny, and a
deny is a 403. It carries `x-vercel-mitigated: deny`, a plain-text `Forbidden` body and
`server: Vercel`. No route here returns 403, so that header is what identifies the block
as the edge rather than the app. The window clears itself.

Exercising it costs nothing upstream, because the gate refuses a 200-character word
before calling Google. Expect 100 × `400` and then `403`:

```sh
W=$(python3 -c 'print("a"*200)')
for i in $(seq 1 130); do
  curl -s -o /dev/null -w '%{http_code}\n' \
    "https://eigenlex-web.vercel.app/api/translate/$W?source=en&target=es"
done | sort | uniq -c
```

### English is Google's hub

Only pairs touching English have a dictionary at all.

| Pair | What Google returns | What we do |
| --- | --- | --- |
| Touches English | A scored dictionary block | Use it |
| es→de, de→es | An unscored reverse lookup that routinely omits the primary sense: "agua" gives Gänsewein/Urin/Neigung and no "Wasser"; "libro" gives only "Blättermagen" | `parseSenseGroups` drops it, because a wholly unscored response is not a dictionary |
| Any other non-English pair | An empty block | Nothing to use |

That leaves those pairs on the plain translation, which is weak for a bare word: it gets
the number wrong (es→de "mujer" → "Frauen"), the case wrong ("feliz" → "Glücklich") or the
sense wrong ("noche" → "Abend", "casa" → "heim"). So when neither side is English
(`needsPivot`) the route pivots through English. `pivotTerm` takes the best-scoring sense
of the source→en dictionary, then en→target is looked up and `alignGroup` keeps the group
matching the source word's part of speech. The two fetches run together, so a pivot costs
one extra round trip: about 150ms cold, then a day in the data cache.

| Load-bearing detail | Why |
| --- | --- |
| Follow Google's group order, not the top score across groups | "verde" scores adjective "green" and noun "green" identically, and the noun translates it as a lawn: Grün/Rasen/Wiese |
| Require `MIN_PIVOT_SCORE` confidence | Google's "amigo" entry tops out at .004 with no "friend" in it, and there the plain translation ("Freund") is the better answer |
| A part-of-speech miss yields nothing | Better than a translation of a different word: "escuela" is never the verb "to school" |

## CEFR levels on the translation

Google orders the alternatives by confidence, not by difficulty, so a three-to-four
band spread arrives as a flat list of equals: "agua" A1 beside "abrevar" C2, "buddy" A1
beside "cobber" C2. `/api/translate` annotates every dictionary term, and the plain
translation, with its CEFR band and rank in the target language. The card trails each with a
quiet `CefrBadge` carrying the band name and rank in its tooltip.

| Rule | Detail |
| --- | --- |
| The order stays Google's | The badge lets a learner filter; it does not re-rank |
| Annotate server-side | It happens in the route that already fetches the translation, so it costs no extra round trip |
| `levels` is keyed by the term as Google spelled it | `getLevel` keys case-insensitively underneath |
| Only the six indexed languages have levels | For the rest the map is empty and nothing renders |
| Some terms go unbadged | Phrases ("de agua") and inflected forms the lemma merge folded away ("eating"): about 4% of terms |
| The looked-up word gets the same badge inside the search field | In Frequency view that is the only place its CEFR level shows at all |

### Markup

| Rule | Why |
| --- | --- |
| Separators are bare text and the badges are the only elements | A line's text content stays exactly the translation, so what a reader copies is clean |
| No whitespace between a term and its badge | A wrap can never split the two |
| `role="img"` carries the detail as the badge's accessible name | Hidden text would say the same thing but ride along into anything copied out of the translation |

### The badge in the search field

Nothing goes inside an `<input>`, so `WordSearchBox` overlays one: an absolutely-positioned
run holding an `invisible` copy of the value followed by the badge. Laying the same string
out in the same font puts the badge where the text ends with nothing measured, and it
re-flows on its own when Diatype replaces the fallback.

| Rule | Why |
| --- | --- |
| The run is inline, not a flex row | The badge takes the word's baseline instead of being centred against it |
| `TEXT_INSET` mirrors where Fondue starts the text | 1px root border plus 12px input padding. That CSS module's class is a build hash, so it cannot be read |
| Pass `badge` only while the field still holds the resolved word | Pressed against the text, a stale level reads as a claim about what is being typed |
| Stand down whenever the spinner is up | They share that strip of the box, and mid-lookup the level is unknown anyway |
| Hide it when the word leaves no room | 27-char German at a 250px phone field. `fits` compares the overlay's scroll and client widths |
| Hide with `visibility`, keeping the badge in the DOM | It keeps its slot, so the measurement cannot oscillate with its own answer |
| The overlay is `pointer-events-none` except the badge | Clicking the badge puts the caret at the end of the word, which is what a click just past the text means |

## API route params

Next percent-decodes a route param before the handler sees it, so a `decodeURIComponent`
in a handler is a second pass. It is not only redundant: on a param still holding a literal
`%` after Next's decode it throws a `URIError` nothing catches, and the route answers an
empty 500 where it should answer a 404.

Take the param as given. Lowercase it where the lookup wants that, and nothing else.

| Request | Answers | Why |
| --- | --- | --- |
| `/api/word/%` | 400 | Next's own router rejects malformed encoding; the handler never runs |
| `/api/word/%25` | 404 | Decoded once to `%`, which is not a word |
| `/api/word/%77ater` | 200 `water` | Decoded once, by Next |
| `/api/word/%2577ater` | 404 | Decoded once to `%77ater`, which is not a word |

The last row is the check worth remembering: a 200 `water` there means something decoded
twice. `routes.test.ts` pins the same thing with a `%` param, which 500s under a second
decode and 404s without one.

## Response headers

`next.config.mjs` sends the same set on every path. `poweredByHeader: false` drops the
framework name; Vercel adds HSTS on its own, so we do not.

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | See below |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` — what `frame-ancestors` already says, for browsers that do not read it |
| `Permissions-Policy` | Camera, microphone, geolocation and payment all off. The page asks for none of them |

**The policy is `'self'` and nothing else.** Everything the page loads is same-origin —
no CDN, no webfont host, no analytics. That is what makes a tight CSP possible, and it is
also the thing to remember: a Google Font link, a CDN script or an outbound beacon is
blocked, and blocked quietly. Add the host to the matching directive in the same change,
or the resource simply never arrives.

| Concession | Why |
| --- | --- |
| `script-src 'unsafe-inline'` | Next streams the RSC payload through inline `<script>` tags. Nonces would need middleware, which is a larger surface than this buys on a page with no HTML sink |
| `style-src 'unsafe-inline'` | Fondue and the `style={{…}}` props |
| Dev only: `'unsafe-eval'`, `connect-src ws:` | HMR evals and opens a socket back. Keyed off `NODE_ENV`, so production runs the stricter policy — check a CSP change against a production build, not just `pnpm dev` |

The theme cookie takes `; secure` only over https. Unconditional would break a dev server
reached over plain http on the LAN, where the browser drops a Secure cookie and the theme
stops persisting between loads.

## Verifying a build while the web dev server is running

`next dev` and `next build` both default to `apps/web/.next`. Building into it while a dev
server is live overwrites that directory and breaks the running server; its API routes
start returning 500s.

| Command | Safe while `pnpm dev` is up |
| --- | --- |
| `pnpm test`, `pnpm typecheck` | Yes |
| `pnpm --filter @eigenlex/web build:check` | Yes — builds into `.next-build` |
| `pnpm build`, `turbo run build`, `next build` | No — stop the dev server first |

`.githooks/pre-push` runs the typecheck and the suite before a push, which is why it runs
neither of the bottom row: a hook that built would corrupt whatever dev server is up. It
needs `git config core.hooksPath .githooks` once per clone, and `--no-verify` skips it.

Two test files are nets rather than cases, and are worth extending rather than working
around:

| File | Holds |
| --- | --- |
| `src/app/api/hostile-input.test.ts` | Every route crossed with junk input, asserting no 5xx. A new route or param means a new row in `POSITIONS` |
| `src/app/next-config.test.ts` | That the response headers are still sent, and that the CSP still names no host |

`build:check` leaves one tracked file dirty: Next rewrites `next-env.d.ts` to import
`./.next-build/types/routes.d.ts`. Check it out again afterwards, or the committed file
points at a directory only that command builds.

## Vendored skills

`.claude/skills/` holds four skills and none of them is ours. They come from two
upstreams, and nothing in the repo pulls on them, so nothing would notice them rotting.

| Skill | Upstream | Refreshed by |
| --- | --- | --- |
| `next-cache-components-adoption` | `vercel/next.js@canary`, `skills/` | `scripts/sync-next-skills.mjs` |
| `next-cache-components-optimizer` | same | same |
| `next-dev-loop` | same | same |
| `fondue` | `Frontify/fondue@main`, `packages/sdk/skills/fondue/` | `npx skills update`, Vercel's skills CLI |

| Command | Does |
| --- | --- |
| `pnpm skills:check` | Report drift in the three Next.js skills, write nothing, exit 1 if any |
| `pnpm skills:sync` | Write both upstreams over ours |

`skills:check` covers only the Next.js three because the skills CLI has no dry run. Its
`update` either changes fondue or does not, and it is a no-op when upstream has not moved.

Which of the Next.js skills are vendored is read off the disk: any directory in
`.claude/skills/` that also exists upstream is synced, and upstream skills absent here are
listed as `not vendored`. The directory name is the whole declaration, so vendoring a
fourth is a `mkdir` plus `pnpm skills:sync`, with no edit to the script.

### How fondue is laid out

`skills-lock.json` at the repo root is what makes `npx skills update` able to find the
skill at all. Without it nothing knows fondue is installed.

| Path | Holds |
| --- | --- |
| `.agents/skills/fondue/` | The real files. The CLI treats this as the canonical copy |
| `.claude/skills/fondue` | A relative symlink to it, which is where Claude Code looks |
| `skills-lock.json` | Source, path and a content hash. No commit sha, so it pins nothing |

The files are committed rather than left to the lock to restore. `experimental_install`
rebuilds only `.agents/skills/`, never the agent directory, so a clone carrying just the
lock would give Claude Code no skill at all.

The skill names the `@frontify/fondue` version it was written against, while the SDK it
queries is whichever version `apps/web` has installed. The two drift apart on their own,
and the skill says so itself: trust what the SDK returns over what the skill says.

### The weekly workflow

`.github/workflows/skills-freshness.yml` runs both syncs weekly and opens a PR on the
`chore/skills-sync` branch when either upstream has moved. Keeping copies rather than
installing Vercel's Next.js plugin is a deliberate trade: the plugin would track `canary`
on its own, but it clones a 2.42GB monorepo for three markdown files and pins nothing.

| Trap | Detail |
| --- | --- |
| Watching the wrong directory | fondue's real files live in `.agents/`, so `.claude/skills` alone misses every fondue update. `WATCH` names all three paths and both the drift check and the commit read it, so they cannot disagree |
| Symlinks are not directories | `readdir` reports a symlink as a symlink, so `sync-next-skills.mjs` would silently stop covering any Next.js skill that got symlinked. It only ever sees real directories |
| Rate limit | The sync script makes one GitHub API call. Unauthenticated that budget is 60/hour per IP, so a local run can fail on someone else's spending; `GITHUB_TOKEN` raises it |
| Required check | A branch pushed with `github.token` fires no `pull_request` event, so `pr.yml` never runs and the required `check` status never reports. The workflow dispatches `pr.yml` on the branch to put that status on the same commit |
| Scheduled runs stop | GitHub disables a cron workflow after 60 days of repo inactivity. `workflow_dispatch` restarts it |
| Unpinned CLI in CI | The fondue step runs `npx skills@latest` in a job holding `contents: write`. Upstream's own install instructions are unpinned, and pinning would rot; the alternative is fetching the two files by URL and hand-editing the lock |
