import Workspace from "@/components/Workspace";

export default function Home() {
  return (
    <main className="page" id="main" tabIndex={-1}>
      <header className="masthead">
        <h1>eigenlex</h1>
        <p>
          A dictionary is language defining itself. Explore the directed graph
          its definitions form — the words each word is built from, and the words
          built from it.
        </p>
      </header>
      <Workspace initialWord="love" />
    </main>
  );
}
