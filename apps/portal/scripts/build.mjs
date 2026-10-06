process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = "1";
process.argv = [process.argv[0], "next", "build"];
await import("next/dist/bin/next");
