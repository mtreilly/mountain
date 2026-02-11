import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GrowthRateSlider } from "./GrowthRateSlider";

describe("GrowthRateSlider", () => {
  it("renders formatted percentage and bounds", () => {
    render(<GrowthRateSlider value={0.04} onChange={vi.fn()} min={-0.05} max={0.12} />);

    expect(screen.getByText("4.0%")).toBeInTheDocument();
    expect(screen.getByText("-5.0%")).toBeInTheDocument();
    expect(screen.getByText("12.0%")).toBeInTheDocument();
  });

  it("calls onChange when slider is moved", async () => {
    const onChange = vi.fn();
    render(<GrowthRateSlider value={0.03} onChange={onChange} min={0.001} max={0.15} />);

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "0.031" } });

    expect(onChange).toHaveBeenCalledWith(0.031);
  });

  it("uses preset buttons to set growth rate", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GrowthRateSlider value={0.04} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "China-like" }));
    expect(onChange).toHaveBeenCalledWith(0.07);
  });
});
