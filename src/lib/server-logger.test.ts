import { describe, expect, it, vi } from "vitest";

import { loggerProvider } from "@/instrumentation";
import { serverLogger } from "./server-logger";

describe("serverLogger", () => {
  it("emits logs without errors across all severity levels", () => {
    const logger = loggerProvider.getLogger("tappka");
    const emitSpy = vi.spyOn(logger, "emit");

    serverLogger.info("Info test message", { route: "/test" });
    serverLogger.warn("Warn test message", { count: 42 });
    serverLogger.error("Error test message", { failed: true });
    serverLogger.debug("Debug test message");

    expect(emitSpy).toHaveBeenCalledTimes(4);
    expect(emitSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        body: "Info test message",
        attributes: { route: "/test" },
      })
    );
    expect(emitSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: "Warn test message",
        attributes: { count: 42 },
      })
    );
    expect(emitSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        body: "Error test message",
        attributes: { failed: true },
      })
    );
    expect(emitSpy).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        body: "Debug test message",
      })
    );

    emitSpy.mockRestore();
  });

  it("flushes without throwing", async () => {
    await expect(serverLogger.flush()).resolves.toBeUndefined();
  });

  it("captures migrated console output and redacts sensitive values", () => {
    const logger = loggerProvider.getLogger("tappka");
    const emitSpy = vi.spyOn(logger, "emit");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      serverLogger.console.error(
        "Request for person@example.com failed",
        new Error("Bearer secret-token")
      );

      expect(consoleSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: "Request for [REDACTED] failed Error: Bearer [REDACTED]",
          severityText: "ERROR",
          attributes: expect.objectContaining({
            "console.method": "error",
            "error.message": "Bearer [REDACTED]",
            "log.source": "console",
          }),
        })
      );
    } finally {
      consoleSpy.mockRestore();
      emitSpy.mockRestore();
    }
  });
});
