// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PropertySearchForm } from "./property-search-form";

afterEach(() => cleanup());

describe("PropertySearchForm", () => {
  it("submits as a GET form to /properties so filters live in the URL", () => {
    const { container } = render(<PropertySearchForm />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/properties");
  });

  it("defaults every filter to its unfiltered option when no props are given", () => {
    render(<PropertySearchForm />);

    expect(screen.getByLabelText("Search")).toHaveValue("");
    expect(screen.getByLabelText("Min price")).toHaveValue("");
    expect(screen.getByLabelText("Max price")).toHaveValue("");
    expect(screen.getByLabelText("Bedrooms")).toHaveValue("");
    expect(screen.getByLabelText("Bathrooms")).toHaveValue("");
    expect(screen.getByLabelText("Property type")).toHaveValue("");
    expect(screen.getByLabelText("Sort")).toHaveValue("");
  });

  it("prefills fields from the current filter values so state round-trips through the URL", () => {
    render(
      <PropertySearchForm
        q="Lakeview"
        minPrice={300000}
        maxPrice={750000}
        bedrooms={3}
        bathrooms={2}
        propertyType="CONDO"
        sort="yearBuilt_desc"
      />
    );

    expect(screen.getByLabelText("Search")).toHaveValue("Lakeview");
    expect(screen.getByLabelText("Min price")).toHaveValue("300000");
    expect(screen.getByLabelText("Max price")).toHaveValue("750000");
    expect(screen.getByLabelText("Bedrooms")).toHaveValue("3");
    expect(screen.getByLabelText("Bathrooms")).toHaveValue("2");
    expect(screen.getByLabelText("Property type")).toHaveValue("CONDO");
    expect(screen.getByLabelText("Sort")).toHaveValue("yearBuilt_desc");
  });

  it("names every field to match the API's query params", () => {
    render(<PropertySearchForm />);

    expect(screen.getByLabelText("Search")).toHaveAttribute("name", "q");
    expect(screen.getByLabelText("Min price")).toHaveAttribute("name", "minPrice");
    expect(screen.getByLabelText("Max price")).toHaveAttribute("name", "maxPrice");
    expect(screen.getByLabelText("Bedrooms")).toHaveAttribute("name", "bedrooms");
    expect(screen.getByLabelText("Bathrooms")).toHaveAttribute("name", "bathrooms");
    expect(screen.getByLabelText("Property type")).toHaveAttribute("name", "propertyType");
  });
});
