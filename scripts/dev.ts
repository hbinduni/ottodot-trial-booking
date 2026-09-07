export {};

const children = ["dev:api", "dev:web"].map((script) =>
  Bun.spawn([process.execPath, "run", script], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }),
);
const stop = () => {
  for (const child of children) child.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const code = await Promise.race(children.map((child) => child.exited));
stop();
await Promise.all(children.map((child) => child.exited));
process.exit(code);
