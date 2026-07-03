"use client";

import { useState } from "react";
import { Tabs } from "@frontify/fondue/components";
import Explorer from "@/components/Explorer";
import LayersView from "@/components/LayersView";

type View = "layers" | "graph";

export default function Workspace({ initialWord }: { initialWord: string }) {
  const [view, setView] = useState<View>("layers");
  // Shared so a word looked up in one view carries into the other. Tabs unmounts
  // the inactive panel, so the newly shown view mounts fresh with this word.
  const [word, setWord] = useState(initialWord);

  // Tabs.Root doesn't accept className, so a passthrough wrapper carries the name.
  return (
    <div className="Workspace">
      <Tabs.Root padding="none" activeTab={view} onActiveTabChange={(v) => setView(v as View)}>
        <Tabs.Tab value="layers">
          <Tabs.Trigger>layers</Tabs.Trigger>
          <Tabs.Content>
            <LayersView initialWord={word} onWordChange={setWord} />
          </Tabs.Content>
        </Tabs.Tab>
        <Tabs.Tab value="graph">
          <Tabs.Trigger>graph</Tabs.Trigger>
          <Tabs.Content>
            <Explorer initialWord={word} onWordChange={setWord} />
          </Tabs.Content>
        </Tabs.Tab>
      </Tabs.Root>
    </div>
  );
}
