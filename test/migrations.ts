const assert = require("node:assert/strict");
const { test } = require("node:test");
const { once } = require("node:events");

test("latest Redis connects explicitly and preserves JSON, expiry, deletion and outage fallback", async () => {
    const store = require("../dist/lib/cache");
    try {
        await Promise.race([
            store.cache.isReady ? Promise.resolve() : once(store.cache, "ready"),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Redis not ready")), 5000).unref()),
        ]);
        await store.set("migration:movie", { name: "Ada Lovelace" }, 60);
        assert.equal(await store.has("migration:movie"), true);
        assert.deepEqual(await store.get("migration:movie"), { name: "Ada Lovelace" });
        assert.ok(await store.cache.ttl("migration:movie") > 0);
        await store.del("migration:movie");
        assert.equal(await store.has("migration:movie"), false);
        assert.equal(await store.get("migration:missing"), undefined);
        await store.cache.set("migration:invalid", "not json");
        assert.equal(await store.get("migration:invalid"), undefined);
        await store.cache.del("migration:invalid");
    } finally {
        if (store.cache.isOpen) store.cache.destroy();
    }
    assert.equal(await store.get("migration:movie"), undefined);
    assert.equal(await store.has("migration:movie"), false);
    await store.set("migration:movie", {});
    await store.del("migration:movie");
});

test("latest scraper keeps poster attributes and movie text intact", () => {
    const { executeKanpai, KanpaiContext } = require("kanpai-scraper");
    const context = new KanpaiContext('<h1 class="headline-1">Ada Lovelace</h1><div class="posteritem"><div class="react-component" data-target-link="/film/ada/" data-item-name="Ada Lovelace"></div></div>');
    assert.deepEqual(executeKanpai(context, {
        name: ".headline-1",
        posters: [".posteritem > .react-component", {
            slug: ["$", "[data-target-link]"],
            title: ["$", "[data-item-name]"],
        }],
    }, { strict: false }), {
        name: "Ada Lovelace",
        posters: [{ slug: "/film/ada/", title: "Ada Lovelace" }],
    });
});

test("ESM-only dependencies load from the compiled CommonJS runtime", async () => {
    const { userAgentString } = require("../dist/lib/axios/user-agent");
    assert.match(userAgentString, /letterboxd-list-radarr\/1\.3\.0/);
    const pLimit = require("p-limit").default;
    assert.deepEqual(await Promise.all([1, 2].map(value => pLimit(1)(async () => value))), [1, 2]);
});
