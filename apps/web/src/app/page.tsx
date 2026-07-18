import ThemeToggle from "@/components/ThemeToggle";
import Workspace from "@/components/WorkspaceLazy";

export default function Home() {
  return (
    <main
      className="Home tw-mx-auto tw-max-w-[1100px] tw-px-6 tw-pb-16 tw-pt-10"
      id="main"
      tabIndex={-1}
    >
      <header className="tw-mb-6">
        <div className="tw-mb-1 tw-flex tw-items-start tw-justify-between tw-gap-4">
          <h1 className="tw-heading-xx-large-strong">eigenlex</h1>
          <ThemeToggle />
        </div>
        {/* line-height 1.5 for blocks of text (WCAG 1.4.8); the Fondue type token
            sets a tighter value, so override it inline. */}
        <p className="tw-body-large tw-max-w-[60ch] text-muted-aaa" style={{ lineHeight: 1.5 }}>
          Which words to learn first — in English, Spanish, French, German, or
          Portuguese. Every word sits on a learning band, by raw frequency or by CEFR
          level. Look one up to see where it lands, or browse the whole vocabulary in
          order.
        </p>
      </header>
      <Workspace />
    </main>
  );
}
