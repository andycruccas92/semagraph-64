declare module "node:fs" {
  export function readFileSync(path: string, encoding: string): string;
}

declare const process: {
  argv: string[];
  exit(code?: number): never;
  stderr: { write(message: string): void };
  stdout: { write(message: string): void };
};

declare const console: {
  error(...args: unknown[]): void;
};
