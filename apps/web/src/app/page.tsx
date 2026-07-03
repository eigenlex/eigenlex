import Workspace from "@/components/WorkspaceLazy";

export default function Home() {
  return (
    <main
      className="tw-mx-auto tw-max-w-[1100px] tw-px-6 tw-pb-16 tw-pt-10"
      id="main"
      tabIndex={-1}
    >
      <header className="tw-mb-6">
        <h1 className="tw-heading-xx-large-strong tw-mb-1">eigenlex</h1>
        <p className="tw-body-large tw-max-w-[60ch] tw-text-low-contrast">
          A dictionary is language defining itself. Explore the directed graph
          its definitions form — the words each word is built from, and the words
          built from it.
        </p>
      </header>
      <Workspace initialWord="love" />
    </main>
  );
}
