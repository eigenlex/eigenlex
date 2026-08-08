// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LangSelect from "./LangSelect";

const OPTIONS = [
  { code: "en", name: "English" },
  { code: "pt", name: "Português" },
];

afterEach(cleanup);

describe("LangSelect", () => {
  it("shows the code, and keeps the endonym as the value assistive tech reads", () => {
    render(<LangSelect label="Source language" value="pt" options={OPTIONS} onChange={() => {}} />);
    const trigger = screen.getByRole("combobox", { name: "Source language" });

    // What is on screen — the endonym beside it is hidden by globals.css, not by CSS
    // that jsdom applies, so assert the elements rather than the rendered text.
    expect(trigger.querySelector(".lang-code")).toHaveTextContent("PT");
    expect(trigger.querySelector(".lang-code")).toHaveAttribute("aria-hidden", "true");

    // What names the current value for a screen reader.
    const endonym = trigger.querySelector(".lang-name");
    expect(endonym).toHaveTextContent("Português");
    expect(endonym).not.toHaveAttribute("aria-hidden");
    expect(endonym).toHaveAttribute("lang", "pt");
  });

  it("names each option by its language and reports the picked code", async () => {
    const onChange = vi.fn();
    render(<LangSelect label="Source language" value="en" options={OPTIONS} onChange={onChange} />);

    await userEvent.click(screen.getByRole("combobox", { name: "Source language" }));
    await userEvent.click(await screen.findByRole("option", { name: "Português" }));

    expect(onChange).toHaveBeenCalledWith("pt");
  });
});
