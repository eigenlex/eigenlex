import Workspace from "@/components/WorkspaceLazy";

export default function Home() {
  return (
    <main
      className="Home tw-mx-auto tw-max-w-[1100px] tw-px-6 tw-pb-16 tw-pt-10"
      id="main"
      tabIndex={-1}
    >
      <header className="tw-mb-6">
        <h1 className="tw-heading-xx-large-strong tw-mb-1">eigenlex</h1>
        <p className="tw-body-large tw-max-w-[60ch] tw-text-low-contrast">
          Which English words to learn first. Every word sits on a learning band —
          by raw frequency, or by CEFR level. Look one up to see where it lands, or
          browse the whole vocabulary in order.
        </p>
      </header>
      <Workspace initialWord="water" />
    </main>
  );
}
