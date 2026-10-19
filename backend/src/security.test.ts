import { describe, it, expect } from "vitest";
import { isPrivateIp, assertSafeUrl } from "./security";
describe("ssrf", () => {
  it("flags private ranges", () => { for (const ip of ["127.0.0.1","10.1.1.1","169.254.169.254","192.168.0.1","172.20.0.1","::1","fd00::1","::ffff:10.0.0.1"]) expect(isPrivateIp(ip)).toBe(true); });
  it("allows public", () => { expect(isPrivateIp("8.8.8.8")).toBe(false); });
  it("rejects bad urls", async () => {
    for (const u of ["ftp://x.com/a.mp4","http://localhost/a","http://169.254.169.254/latest","http://[::1]/","https://a.com:8443/x","http://u:p@a.com/","nope"]) await expect(assertSafeUrl(u)).rejects.toThrow();
  });
});
