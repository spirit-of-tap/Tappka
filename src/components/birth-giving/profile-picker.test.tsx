import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingProfilePicker } from "@/components/birth-giving/profile-picker";
import { makeAllProfiles } from "@/tests/component/birth-giving-fixtures";

const PROFILES = makeAllProfiles();

function Harness(props: Omit<Parameters<typeof BirthGivingProfilePicker>[0], "selected" | "onChange"> & { initial?: string[]; onChange?: (selected: string[]) => void }) {
  const { initial = [], onChange, ...pickerProps } = props;
  const [selected, setSelected] = useState(initial);
  return (
    <BirthGivingProfilePicker
      {...pickerProps}
      selected={selected}
      onChange={(next) => {
        setSelected(next);
        onChange?.(next);
      }}
    />
  );
}

describe("BirthGivingProfilePicker", () => {
  it("searches profiles and toggles selection in a multiselect", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness
        profiles={PROFILES}
        initial={[]}
        onChange={onChange}
        label="Organizátor:ky"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Organizátor:ky" }));
    await user.type(await screen.findByLabelText("Hledat profil"), "Candidate");

    expect(screen.queryByText("Org One")).not.toBeInTheDocument();
    const candidateOne = await screen.findByText("Candidate One");
    const candidateTwo = screen.getByText("Candidate Two");
    await user.click(candidateOne);
    await user.click(candidateTwo);

    expect(onChange).toHaveBeenLastCalledWith(["candidate-1", "candidate-2"]);
  });

  it("renders selected profiles as removable chips", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BirthGivingProfilePicker
        profiles={PROFILES}
        selected={["org-1", "member-1"]}
        onChange={onChange}
        label="Organizátor:ky"
      />,
    );

    expect(screen.getByText("Org One")).toBeInTheDocument();
    expect(screen.getByText("Member One")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Odebrat Org One" }));
    expect(onChange).toHaveBeenCalledWith(["member-1"]);
  });

  it("respects a single-select limit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BirthGivingProfilePicker
        profiles={PROFILES}
        selected={["candidate-1"]}
        onChange={onChange}
        label="Pozvat osobu"
        max={1}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Pozvat osobu" }));
    const candidateTwo = await screen.findByText("Candidate Two");
    expect((candidateTwo as HTMLElement).closest('[data-disabled="true"]')).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("excludes given profile ids from the list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BirthGivingProfilePicker
        profiles={PROFILES}
        selected={[]}
        onChange={onChange}
        label="Pozvat osobu"
        excludeIds={["member-1"]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Pozvat osobu" }));
    expect(await screen.findByText("Candidate One")).toBeInTheDocument();
    expect(screen.queryByText("Member One")).not.toBeInTheDocument();
  });
});