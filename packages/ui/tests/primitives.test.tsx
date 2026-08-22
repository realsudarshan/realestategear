import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { es } from "react-day-picker/locale";

import { Alert } from "../src/alert";
import { Button } from "../src/button";
import { Calendar } from "../src/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
  CommandShortcut,
} from "../src/command";
import { DateTimePicker } from "../src/date-time-picker";
import {
  combineCalendarDateAndTime,
  createDateTimePickerHandlers,
  isTimeOptionDisabled,
  setDateTimeMinutes,
  toCalendarDate,
} from "../src/date-time-picker.utils";
import { FormMessage } from "../src/form-message";
import { NativeSelect } from "../src/native-select";
import { Skeleton } from "../src/skeleton";
import { SortableTableHead, Table, TableHeader, TableRow } from "../src/table";

test("Button exposes loading state and disables submission", () => {
  const html = renderToStaticMarkup(<Button loading loadingLabel="Saving">Save</Button>);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /disabled=""/);
  assert.match(html, />Saving</);
});

test("Button keeps a single child when composed with Radix Slot", () => {
  const html = renderToStaticMarkup(<Button asChild><a href="/properties">Properties</a></Button>);
  assert.match(html, /href="\/properties"/);
});

test("FormMessage chooses accessible live-region roles", () => {
  assert.match(renderToStaticMarkup(<FormMessage variant="error">Invalid</FormMessage>), /role="alert"/);
  assert.match(renderToStaticMarkup(<FormMessage>Saved</FormMessage>), /role="status"/);
});

test("Alert leaves announcement priority to the caller", () => {
  assert.doesNotMatch(renderToStaticMarkup(<Alert>Information</Alert>), /role=/);
});

test("NativeSelect preserves native form behavior", () => {
  const html = renderToStaticMarkup(
    <NativeSelect name="status" defaultValue="active">
      <option value="active">Active</option>
    </NativeSelect>,
  );
  assert.match(html, /name="status"/);
  assert.match(html, /selected=""/);
});

test("Calendar applies locale and week-start behavior", () => {
  const html = renderToStaticMarkup(
    <Calendar
      locale={es}
      month={new Date(2026, 7, 1)}
      mode="single"
      weekStartsOn={1}
    />,
  );
  const weekdays = [...html.matchAll(/<th aria-label="([^"]+)"/g)].map((match) => match[1]);

  assert.match(html, /lang="es"/);
  assert.match(html, />agosto 2026</);
  assert.deepEqual(weekdays, ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]);
});

test("Calendar exposes boundaries, disabled dates, and keyboard grid semantics", () => {
  const august = new Date(2026, 7, 1);
  const html = renderToStaticMarkup(
    <Calendar
      disabled={new Date(2026, 7, 20)}
      endMonth={august}
      month={august}
      mode="single"
      startMonth={august}
    />,
  );

  assert.match(html, /role="grid"/);
  assert.match(html, /aria-label="Saturday, August 1st, 2026"/);
  assert.match(html, /type="button" tabindex="0"/);
  assert.match(html, /data-day="2026-08-20" data-disabled="true"/);
  assert.match(html, /aria-label="Go to the Previous Month"/);
  assert.match(html, /aria-label="Go to the Next Month"/);
  assert.equal((html.match(/aria-disabled="true"/g) ?? []).length, 2);
});

test("Command exposes keyboard navigation and focus semantics", () => {
  const html = renderToStaticMarkup(
    <Command label="Available actions">
      <CommandInput label="Search actions" />
      <CommandList>
        <CommandGroup heading="Actions">
          <CommandItem value="first-action">
            First action
            <CommandShortcut>Control A</CommandShortcut>
          </CommandItem>
          <CommandItem value="unavailable-action" disabled>
            Unavailable action
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>,
  );
  const controls = html.match(/aria-controls="([^"]+)"/)?.[1];
  const listId = html.match(/role="listbox"[^>]*id="([^"]+)"/)?.[1];

  assert.match(html, />Available actions<\/label>/);
  assert.match(html, /aria-label="Search actions"/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-autocomplete="list"/);
  assert.equal(controls, listId);
  assert.match(html, /role="group"/);
  assert.match(html, /role="option" aria-disabled="true"/);
  assert.match(html, />Control A<\/span>/);
});

test("Command supports consumer-owned loading and empty states", () => {
  const html = renderToStaticMarkup(
    <Command label="Available actions">
      <CommandInput label="Search actions" />
      <CommandList>
        <CommandLoading>Fetching actions</CommandLoading>
        <CommandEmpty>No matching actions</CommandEmpty>
      </CommandList>
    </Command>,
  );

  assert.match(html, /data-slot="command-loading" role="status" aria-live="polite"/);
  assert.match(html, />Fetching actions<\/div>/);
  assert.match(html, />No matching actions<\/div>/);
  assert.doesNotMatch(html, /aria-label="Loading\.\.\."/);
});

test("DateTimePicker exposes its accessible form contract in static markup", () => {
  const value = new Date("2026-08-21T16:30:00.000Z");
  const html = renderToStaticMarkup(
    <DateTimePicker
      id="showing-time"
      name="showingTime"
      label="Showing time"
      description="Choose an available time."
      error="Check this value."
      value={value}
      onChange={() => {}}
      required
      timeZone="UTC"
    />,
  );

  assert.match(html, /<label[^>]*for="showing-time"/);
  assert.match(html, /id="showing-time"/);
  assert.match(html, /aria-describedby="showing-time-description showing-time-error showing-time-time-zone"/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-required="true"/);
  assert.match(html, /aria-label="Time"/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /type="button"/);
  assert.match(html, /id="showing-time-time-zone"[^>]*>UTC</);
  assert.match(html, /role="alert"/);
  assert.match(html, /type="hidden" name="showingTime" value="2026-08-21T16:30:00.000Z"/);

  const emptyHtml = renderToStaticMarkup(
    <DateTimePicker name="showingTime" label="Showing time" onChange={() => {}} />,
  );
  assert.match(emptyHtml, /type="hidden" name="showingTime" value=""/);
});

test("DateTimePicker disables its date, time, and clear controls together", () => {
  const html = renderToStaticMarkup(
    <DateTimePicker
      id="disabled-picker"
      label="Appointment"
      value={new Date("2026-08-21T12:00:00.000Z")}
      onChange={() => {}}
      disabled
      timeZone="UTC"
    />,
  );

  assert.match(html, /disabled=""[^>]*id="disabled-picker"|id="disabled-picker"[^>]*disabled=""/);
  assert.match(html, /disabled=""[^>]*id="disabled-picker-time"|id="disabled-picker-time"[^>]*disabled=""/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Clear<\/button>/);
});

test("DateTimePicker preserves date and time fields in local and UTC modes", () => {
  const localValue = new Date(2026, 7, 20, 9, 35, 12, 50);
  const localDate = new Date(2026, 7, 22);
  const nextLocalDate = combineCalendarDateAndTime(localDate, localValue, "local");
  const nextLocalTime = setDateTimeMinutes(localValue, 14 * 60 + 15, "local");

  assert.deepEqual(
    [nextLocalDate.getFullYear(), nextLocalDate.getMonth(), nextLocalDate.getDate(), nextLocalDate.getHours(), nextLocalDate.getMinutes()],
    [2026, 7, 22, 9, 35],
  );
  assert.deepEqual(
    [nextLocalTime.getFullYear(), nextLocalTime.getMonth(), nextLocalTime.getDate(), nextLocalTime.getHours(), nextLocalTime.getMinutes()],
    [2026, 7, 20, 14, 15],
  );

  const utcValue = new Date("2026-08-20T09:35:12.050Z");
  const utcCalendarDate = toCalendarDate(utcValue, "UTC");
  const nextUtcDate = combineCalendarDateAndTime(new Date(2026, 7, 22), utcValue, "UTC");
  const nextUtcTime = setDateTimeMinutes(utcValue, 14 * 60 + 15, "UTC");

  assert.deepEqual(
    [utcCalendarDate?.getFullYear(), utcCalendarDate?.getMonth(), utcCalendarDate?.getDate()],
    [2026, 7, 20],
  );
  assert.equal(nextUtcDate.toISOString(), "2026-08-22T09:35:12.050Z");
  assert.equal(nextUtcTime.toISOString(), "2026-08-20T14:15:00.000Z");
});

test("DateTimePicker handlers emit changes, clear, close, and honor datetime bounds", () => {
  const changes: Array<Date | undefined> = [];
  const openChanges: boolean[] = [];
  const handlers = createDateTimePickerHandlers({
    value: undefined,
    min: new Date("2026-08-21T15:00:00.000Z"),
    max: new Date("2026-08-21T18:00:00.000Z"),
    minuteStep: 15,
    timeZone: "UTC",
    onChange: (value) => changes.push(value),
    setOpen: (open) => openChanges.push(open),
  });

  handlers.selectDate(new Date(2026, 7, 21));
  handlers.clear();

  assert.equal(changes[0]?.toISOString(), "2026-08-21T15:00:00.000Z");
  assert.equal(changes[1], undefined);
  assert.deepEqual(openChanges, [false]);

  const selected = changes[0];
  assert.ok(selected);
  createDateTimePickerHandlers({
    value: selected,
    min: undefined,
    max: undefined,
    minuteStep: 15,
    timeZone: "UTC",
    onChange: (value) => changes.push(value),
    setOpen: () => {},
  }).selectTime(17 * 60 + 30);
  assert.equal(changes[2]?.toISOString(), "2026-08-21T17:30:00.000Z");
});

test("DateTimePicker disables stepped times outside complete datetime bounds", () => {
  const day = new Date(2026, 7, 21);
  const min = new Date("2026-08-21T09:15:00.000Z");
  const max = new Date("2026-08-21T10:00:00.000Z");

  assert.equal(isTimeOptionDisabled(day, 9 * 60, min, max, "UTC"), true);
  assert.equal(isTimeOptionDisabled(day, 9 * 60 + 15, min, max, "UTC"), false);
  assert.equal(isTimeOptionDisabled(day, 10 * 60, min, max, "UTC"), false);
  assert.equal(isTimeOptionDisabled(day, 10 * 60 + 15, min, max, "UTC"), true);
});

test("Skeleton respects reduced-motion preferences", () => {
  assert.match(renderToStaticMarkup(<Skeleton />), /motion-reduce:animate-none/);
});

test("SortableTableHead represents ascending, descending, and unsorted states", () => {
  for (const direction of ["ascending", "descending", "none"] as const) {
    const html = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead sortDirection={direction} onSort={() => {}}>
              Price
            </SortableTableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );

    assert.match(html, new RegExp(`aria-sort="${direction}"`));
  }
});

test("SortableTableHead uses a labeled native button for keyboard activation", () => {
  const onSort = () => {};
  const heading = SortableTableHead({ children: "Price", onSort });
  const button = React.Children.only(heading.props.children) as React.ReactElement<
    React.ComponentProps<"button">
  >;
  const html = renderToStaticMarkup(
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead onSort={onSort}>Price</SortableTableHead>
        </TableRow>
      </TableHeader>
    </Table>,
  );

  assert.equal(button.props.onClick, onSort);
  assert.equal(button.props.type, "button");
  assert.match(html, /<th[^>]*aria-sort="none"/);
  assert.match(html, /<button[^>]*type="button"[^>]*>Price/);
  assert.match(html, /aria-hidden="true"/);
});

test("declares exactly the Radix primitives imported by the package", async () => {
  const sourceDirectory = new URL("../src/", import.meta.url);
  const sourceFiles = (await readdir(sourceDirectory)).filter((file) => file.endsWith(".tsx"));
  const importedPrimitives = new Set<string>();

  for (const file of sourceFiles) {
    const source = await readFile(new URL(file, sourceDirectory), "utf8");
    for (const match of source.matchAll(/from ["'](@radix-ui\/react-[^"']+)["']/g)) {
      importedPrimitives.add(match[1]);
    }
  }

  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { dependencies: Record<string, string> };
  const declaredPrimitives = Object.keys(manifest.dependencies).filter((name) =>
    name.startsWith("@radix-ui/react-"),
  );

  assert.equal(manifest.dependencies["radix-ui"], undefined);
  assert.deepEqual(declaredPrimitives.sort(), [...importedPrimitives].sort());
});
