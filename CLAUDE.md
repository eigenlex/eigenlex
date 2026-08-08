# eigenlex — agent notes

pnpm + turbo monorepo, now a single app: `apps/web` is the Next.js site + hosted API.
It's a vocabulary learning tool — every English word placed on a **frequency** band
and a **CEFR** band, so a learner can see where a word sits and browse the vocabulary
in order.

## URL state (deeplinks)

The `Workspace` mirrors the current scenario into the query string so it can be shared
as a deeplink: `?lang=<source>&word=<word>&tl=<gloss>&view=freq|cefr&band=<key>`. Encode
/ decode lives in `apps/web/src/lib/scenario.ts`; `Workspace` is the single owner of all
five pieces (target language lifted up out of `WordCard`, band tab lifted up out of
`BandBrowser`). On mount the URL wins over the localStorage/browser defaults; thereafter
state is written back with `replaceState`. `band` is only pinned when it differs from the
looked-up word's own band (otherwise it's implied by word + view). `Workspace` is
client-only (`WorkspaceLazy`, `ssr:false`), so this is all client-side.

## Data

The tool is multi-**source-language**: a learner picks the language they're studying
(en/es/fr/de/pt/it). This is separate from the reader's *target* language (the gloss
language chosen in the word card). Source-language metadata lives in
`apps/web/src/lib/languages.ts`; the server registry is `apps/web/src/lib/bands.ts`.

The app reads one committed artifact per language, `apps/web/data/word-bands.<code>.json`
(a pure-frequency, lemma-merged word ranking + the band definitions). They're built by
`apps/web/scripts/build-bands.ts` from gitignored inputs in `apps/web/data/`: a
frequency list + a lemmatization list per language. English uses `subtlex.csv`
(SUBTLEX-US); es/fr/de/pt/it use `freq-<code>.txt` (OpenSubtitles frequency lists from
hermitdave/FrequencyWords). Lemmas are `lemma-<code>.txt` (michmech/lemmatization-lists).

Take hermitdave's **`<code>_full.txt`**, not `<code>_50k.txt`: the cut belongs in code,
where it's version-controlled, not in whichever file someone happened to download.
`minCount` in the `LANGS` table applies it — 10 raw occurrences, below which the
OpenSubtitles tail is mostly hapax noise. It's stated in occurrences rather than rank so
it means the same thing in every language, and it's omitted for English, whose SUBTLEX
column is per-million rather than a raw count.

**Clitics.** Portuguese and French hyphenate pronouns onto verbs, so every verb ×
pronoun pair spells its own surface form — `deixa-me`, `fazê-lo`, `donne-moi`, `a-t-il`.
None is vocabulary, and they were 24% of pt's list and 12% of fr's. `clitics` in the
`LANGS` table strips them and merges the frequency back into the verb, which is where it
belongs: pt `lembrar` 333 → 177, fr `excuser` 761 → 297. Portuguese mesoclisis puts the
pronoun *inside* the verb (`contar-te-ia`), so `mesoEndings` strips a trailing future /
conditional ending along with it, and `STEM_REPAIR` restores the infinitive's `-r` that
pt drops before `-lo`/`-la` (`fazer` + `o` → `fazê-lo`). A stem that resolves to no known
word is dropped rather than kept — 346 forms in pt, 400 in fr.

Segments are matched **whole**, which is the load-bearing detail: it's what keeps
`guarda-chuva` (ends in "chuva", not "a") and `arc-en-ciel` (ends in "ciel", not "en").
Neither lemma list contains a single hyphenated entry, so the dictionary can't referee
this and rank can't either — `peut-être` and `rendez-vous` sit among `avez-vous` and
`dis-moi`. `là`/`ci` are deliberately not clitics, since `celui-là` and `là-bas` are
vocabulary; `cliticExceptions` covers the rest (`rendez-vous`, `garde-à-vous`).

A surface word that **heads its own entry** in the lemma list keeps it, rather than being
merged into whichever lemma claims it. The lists are lemma-sorted, so plain first-wins
silently hands a shared form to the alphabetically-first claimant — which used to delete
common words outright (Italian "governo" absorbed into "governare", French "tu" into "il",
~100–160 of the top 1,000 per language) and float the absorber into the beginner bands.
Rebuild all with `pnpm --filter @eigenlex/web build:bands`, or one with
`… build:bands <code>`. To add a language, drop its two inputs in `data/`, add an entry
to the `LANGS` table in the build script and to `SOURCE_LANG_META` (+ the `bands.ts`
registry import). CEFR bands are frequency-rank thresholds calibrated against CEFR-J
(English-derived, reused for every language); no graph or external dictionary is involved.

**The tail, and the dictionary gate.** The subtitle tail is not rare vocabulary. Past
25k only ~14% of it is in the language's own lemma list; the rest is character names,
untranslated English (`truck`, `workshop`), misspellings (`gerer` for "gérer", `règler`),
OCR debris (`lslam`, `arrãªtez`) and pure noise (`rrr`, `shhhh`). Neither frequency nor
the name gazetteer can tell that from a rare word — the gazetteer has no entry for
`ryûji` or `rrr` — but the dictionary can. So `dictGate` (25,000) requires the lemma
list to vouch for a word past that rank. It drops ~80 junk words per real one, and
lands the five subtitle languages at 33–40k words each, about where English's curated
SUBTLEX ends on its own.

It is deliberately **not** applied to English, whose source is curated and whose lemma
list is the smallest by far (808KB vs French's 4.9MB) — gating it would cut 11k
mostly-real words.

*Known costs.* The gate deletes real words michmech happens to lack, ~1–3% of what it
drops (900–2,700 per language), concentrated in productive morphology the lists don't
headword: `-mente`/`-ment` adverbs, `-ità`/`-ité` nouns, superlatives — `logicamente`,
`unanimità`, `rigoureusement`, `Geborgenheit`. Italian's list has no `entropia`, so the
build's own spot-check for it now reports `—`. And the gate starts at 25k, so it does
nothing for 12k–25k, which is still roughly half names and English (`Nami`, `Calcutta`,
`because`, `corn`, `truck` all sit around rank 13,000).

**CEFR band tops** roughly double — 1k, 3k, 6k, 12k, 25k, 50k — so C2 ends at 50k rather
than running open-ended to the end of the list. A seventh band `rare` ("Rare · beyond
C2") covers past 50k, but it is a **backstop, not an expected band**: with the gate no
language reaches 50k, so every artifact currently ends at C2. It stays because `getWord`
asserts a band exists at every rank, so the last band must be open-ended — keep
`max: null` on whichever band is last. Both band lists are filtered per language to
those that actually contain words, so an unreached `rare` never renders as an empty tab.

**Display casing** is optional per language, driven by a third input: `casing-<code>.txt`,
a Leipzig Corpora *sentences* file (`downloads.wortschatz-leipzig.de`, e.g.
`deu_news_2022_1M`), pointed to by `casingFile` in the `LANGS` table. The build measures
each word's *mid-sentence* capitalization (ignoring sentence-initial position, which
capitalizes everything) — so German nouns/names ("Wasser", "Berlin") and proper nouns in
any language come out capitalized while verbs/pronouns stay lowercase, with no
per-language rules. The already-present lemma list supplies an authoritative fallback for
the rare tail. The stored `ranked` words carry display casing; all lookups in `bands.ts`
key on lowercase, so search/typeahead stay case-insensitive. Languages without a
`casingFile` stay lowercase. All six languages now have one, and the measurement is
language-agnostic: Spanish `lunes`/`enero`/`español` and Italian `lunedì`/`gennaio` stay
lowercase where those languages want it, while `Roma`, `Lisboa`, `London`, `Dios` and the
German nouns capitalize — no per-language rules anywhere.

**Personal names** ("Ahmed", "Moretti", "Kendra") crowd subtitle corpora without being
vocabulary. A word is dropped when it is in the shared gazetteer `data/names.txt`
(michmech-style plain list, gitignored), *absent* from the language's lemma list,
capitalized mid-sentence, and rarely preceded by a determiner (`determiners` in the
`LANGS` table). All four are needed: the dictionary spares surnames that are also words
("Koch", "Berg"), casing spares lowercase function words that collide with short names
("in", "von", "man"), and the determiner test spares ordinary nouns michmech simply
lacks ("Kuss", "Fass", "Geduld", "Sheriff") — which surname lists are full of. The top
`NAME_RANK_FLOOR` (1,000) is exempt, where a hit is likelier a loanword noun than a
name. Active for all six (en −1,126, es −2,495, fr −2,790, de −2,185, pt −1,737,
it −2,316); a language without a `casingFile` is skipped entirely, since the gazetteer
alone would eat "que", "por", "he", "she".

*Known wart:* a few country names sit in the surname list and go with them — `england`,
`france`, `africa`, `canada`, `india` (en), `francia`/`italia` (es), `italia`/
`inghilterra` (it). The determiner test rescues the rest (fr and pt lose none), but
English never articles a country ("the France" is ungrammatical) so it can't fire there.
The result is arbitrary-looking: `germany` stays, `france` goes.

**Case-homographs** (German "Essen" the noun vs "essen" the verb) merge into one source
entry but keep both casings. The build flags an entry when both casings are genuinely
used mid-sentence *and* the lemma list has a capitalized (noun) spelling — filtering
surnames ("Klein") and quote-capitalized adjectives. The artifact stores these under
`variants` (`"essen" -> ["Essen","essen"]`, most frequent first); `getWord` returns them
as `forms`. The word card glosses each casing via the translate API's `dict=1` mode
(Google's `dt=bd` dictionary block is casing-sensitive — "Essen"→food/meal,
"essen"→eat/dine — unlike the plain translation) and shows a line per casing, collapsing
to one when the meanings don't actually differ.

**Parts of speech.** The same `dt=bd` block groups its senses by part of speech, which
`parseSenseGroups` keeps (`flattenSenses` collapses them, for the per-casing lines above).
A word reading as more than one — Italian "solo" adj. "only" / adv. "just", Spanish
"nada" pron./noun/adv. — gets a labelled line each; a single reading stays one gloss.
That gloss is the dictionary terms, not the plain translation, which for a lone word is
sometimes just wrong ("acqua" → "waterfall"). So every word card fetches `dict=1` now.

Each entry carries a **confidence score**, and Google's senses trail off into noise —
en→de "dog" runs Hund .51, Rüde .0018, then "Schreckschraube" (battle-axe) at 3e-6. So
senses are cut *relative* to their group's best (`MIN_RELATIVE_SCORE`) rather than at a
fixed rank. An unscored entry counts as no-confidence and goes the same way.

**English is Google's hub**, and only pairs touching it have a dictionary at all. The rest
return an empty block — except es→de and de→es, which return an unscored reverse lookup
that routinely omits the primary sense (es→de "agua" gives Gänsewein/Urin/Neigung and no
"Wasser"; "libro" gives only "Blättermagen"). A wholly unscored response is therefore not
a dictionary and `parseSenseGroups` drops it.

That leaves those pairs on the plain translation, which is weak for a bare word: it gets
the number wrong (es→de "mujer" → "Frauen"), the case wrong ("feliz" → "Glücklich"), or
the sense wrong ("noche" → "Abend", "casa" → "heim"). So when neither side is English
(`needsPivot`) the route **pivots through English**: `pivotTerm` takes the best-scoring
sense of the source→en dictionary, then en→target is looked up and `alignGroup` keeps the
group matching the source word's part of speech. The two independent fetches run together,
so a pivot costs one extra round trip (~150ms cold, then a day in the data cache).

Three details are load-bearing. The pivot follows Google's **group order**, not the top
score across groups: "verde" scores adjective "green" and noun "green" identically, and
the noun glosses it as a lawn (Grün/Rasen/Wiese). It needs `MIN_PIVOT_SCORE` confidence —
Google's "amigo" entry tops out at .004 with no "friend" in it, and there the plain
translation ("Freund") is the better gloss. And a part-of-speech miss yields nothing
rather than a gloss for a different word, since "escuela" is never the verb "to school".

## Verifying a build while the web dev server is running

`next dev` and `next build` both default to `apps/web/.next`. Running `pnpm build`
(or `next build`) while `pnpm dev` is live overwrites that directory and breaks the
running server — its API routes start returning 500s.

So, before verifying the web app:

- **Don't** run `pnpm build` / root `turbo run build` while a web dev server is up.
- To check a production build without stopping dev, use the isolated build:
  `pnpm --filter @eigenlex/web build:check` (builds into `.next-build`).
- For a normal full build, stop the dev server first.

`pnpm test` and `pnpm typecheck` are always safe to run alongside `pnpm dev`.
