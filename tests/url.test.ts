import { describe, it, expect } from "vitest";
import { detectPlatform } from "@/lib/validators/url";
import { normalize } from "@/lib/extractors";
import { rateLimit } from "@/lib/utils/rateLimit";
describe("detectPlatform", () => {
  it.each([["https://www.youtube.com/watch?v=x","youtube"],["https://youtu.be/x","youtube"],["https://vm.tiktok.com/x","tiktok"],["https://www.instagram.com/reel/x","instagram"],["https://fb.watch/x","facebook"]])("accepts %s", (u, p) => {
    const r = detectPlatform(u); expect(r.ok && r.platform).toBe(p); });
  it.each(["not a url","http://youtube.com/x","https://localhost/x","https://127.0.0.1/x","https://10.0.0.1/x","https://youtube.com.evil.com/x","https://user:pw@youtube.com/x","https://youtube.com:8080/x","https://example.com"])("rejects %s", (u) => {
    expect(detectPlatform(u).ok).toBe(false); });
});
describe("normalize", () => {
  it("does not invent missing fields", () => { const m = normalize("youtube","https://youtu.be/x",{title:"T"}); expect(m.description).toBeUndefined(); expect(m.status).toBe("partial"); });
  it("flags empty data as unavailable", () => expect(normalize("tiktok","https://vm.tiktok.com/x",{}).status).toBe("unavailable"));
});
describe("rateLimit", () => { it("blocks over the limit", () => { expect(rateLimit("k",2,1000,0)).toBe(true); expect(rateLimit("k",2,1000,1)).toBe(true); expect(rateLimit("k",2,1000,2)).toBe(false); }); });
